import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createExecutionPlan, type InputDescriptor, type SatQueryMode } from '@/lib/satquery-orchestrator';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 12 * 1024 * 1024;
// Inline image data is base64 encoded before it reaches Gemini. Keep image pairs
// below this raw-size budget so the encoded request remains under API limits.
const MAX_COMBINED_FILE_SIZE = 14 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/tif', 'application/geotiff']);
const ANALYSIS_MODES = new Set(['optical', 'sar', 'optical-sar', 'bi-temporal']);
const IMAGE_ANALYSIS_MODEL = 'gemini-flash-lite-latest';
const ADAPTER_URL = process.env.SATQUERY_ADAPTER_URL?.replace(/\/$/, '');
const RESPONSE_LANGUAGES = new Set(['English', 'Hindi', 'Bengali', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Malayalam', 'Kannada', 'Punjabi', 'Urdu']);

type EvidenceRegion = {
  label: string;
  confidence: 'low' | 'medium' | 'high';
  bounds: { x: number; y: number; width: number; height: number };
  rationale: string;
};
type Recommendation = { rank: 1 | 2 | 3; recommendation: string; why: string; visibleEvidence: string; advantages: string; disadvantages: string; risks: string; requiredValidation: string };
type QrRecord = { id: string; areaOrFeature: string; category: string; keyFinding: string; evidence: string; potentialUse: string; advantages: string; disadvantages: string; risk: string; requiredValidation: string };
type DecisionSupport = { imageType: string; landCover: string; mainFinding: string; potentialOpportunity: string; mainAffectedArea: string; environmentalConcern: string; topRecommendation: string; confidence: 'low' | 'medium' | 'high'; dataNeeded: string; recommendations: Recommendation[]; qrRecords: QrRecord[] };
type ImageLocation = { status: 'verified' | 'unavailable'; latitude?: number; longitude?: number; placeName?: string; source: string; note: string };
type VisualLocation = { placeName: string; confidence: 'low' | 'medium' | 'high'; evidence: string };

type AnalysisPayload = {
  status?: 'ok' | 'needs_clarification';
  analysis: string;
  evidence: EvidenceRegion[];
  limitations: string[];
  decisionSupport?: DecisionSupport;
  visualLocation?: VisualLocation;
  clarification?: string;
};

/** Read GPS coordinates from a JPEG EXIF APP1 block. This is deliberately
 * metadata-only: visual appearance alone cannot establish an exact location. */
function readJpegGps(source: Buffer): { latitude: number; longitude: number } | null {
  try {
    if (source.readUInt16BE(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 <= source.length) {
      if (source[offset] !== 0xff) { offset += 1; continue; }
      const marker = source[offset + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const size = source.readUInt16BE(offset + 2);
      if (size < 2 || offset + 2 + size > source.length) return null;
      if (marker === 0xe1 && source.subarray(offset + 4, offset + 10).toString('ascii') === 'Exif\0\0') {
        const base = offset + 10;
        const little = source.subarray(base, base + 2).toString('ascii') === 'II';
        const u16 = (at: number) => little ? source.readUInt16LE(at) : source.readUInt16BE(at);
        const u32 = (at: number) => little ? source.readUInt32LE(at) : source.readUInt32BE(at);
        const ifd = base + u32(base + 4);
        if (ifd + 2 > source.length) return null;
        let gpsOffset: number | null = null;
        for (let index = 0, count = u16(ifd); index < count; index += 1) {
          const entry = ifd + 2 + index * 12;
          if (entry + 12 > source.length) return null;
          if (u16(entry) === 0x8825) { gpsOffset = u32(entry + 8); break; }
        }
        if (gpsOffset === null) return null;
        const gps = base + gpsOffset;
        if (gps + 2 > source.length) return null;
        const values = new Map<number, { type: number; count: number; value: number }>();
        for (let index = 0, count = u16(gps); index < count; index += 1) {
          const entry = gps + 2 + index * 12;
          if (entry + 12 > source.length) return null;
          values.set(u16(entry), { type: u16(entry + 2), count: u32(entry + 4), value: u32(entry + 8) });
        }
        const ascii = (tag: number) => { const item = values.get(tag); return item ? String.fromCharCode(item.value & 0xff) : ''; };
        const coordinate = (tag: number) => {
          const item = values.get(tag); if (!item || item.type !== 5 || item.count !== 3) return null;
          const at = base + item.value; if (at + 24 > source.length) return null;
          const rational = (position: number) => { const denominator = u32(position + 4); return denominator ? u32(position) / denominator : NaN; };
          const degrees = rational(at), minutes = rational(at + 8), seconds = rational(at + 16);
          return [degrees, minutes, seconds].every(Number.isFinite) ? degrees + minutes / 60 + seconds / 3600 : null;
        };
        const latitude = coordinate(2), longitude = coordinate(4);
        if (latitude === null || longitude === null || latitude > 90 || longitude > 180) return null;
        return { latitude: ascii(1) === 'S' ? -latitude : latitude, longitude: ascii(3) === 'W' ? -longitude : longitude };
      }
      offset += size + 2;
    }
  } catch { /* malformed metadata is simply not location evidence */ }
  return null;
}

async function resolveImageLocation(file: File | null): Promise<ImageLocation> {
  if (!file) return { status: 'unavailable', source: 'No original upload', note: 'No verified location metadata was supplied.' };
  const coordinates = readJpegGps(Buffer.from(await file.arrayBuffer()));
  if (!coordinates) return { status: 'unavailable', source: 'Upload metadata', note: 'This file has no readable GPS metadata, so an exact place cannot be verified from the image alone.' };
  let placeName: string | undefined;
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2'); url.searchParams.set('lat', String(coordinates.latitude)); url.searchParams.set('lon', String(coordinates.longitude)); url.searchParams.set('zoom', '14');
    const response = await fetch(url, { headers: { 'User-Agent': 'SATQUERY-AI/1.0 location lookup' }, signal: AbortSignal.timeout(5_000) });
    const payload = await response.json().catch(() => null) as { display_name?: unknown } | null;
    if (response.ok && typeof payload?.display_name === 'string') placeName = payload.display_name.slice(0, 240);
  } catch { /* Coordinates remain useful if reverse geocoding is unavailable. */ }
  return { status: 'verified', ...coordinates, placeName, source: 'Embedded GPS metadata', note: 'Coordinates were read from the uploaded file metadata. Confirm against the original source before operational use.' };
}

function parseAnalysisPayload(text: string): AnalysisPayload {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    // The provider can add a short preamble despite the JSON response mode.
    // Recover the object embedded in that response when it is present.
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const json = firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
    const parsed = JSON.parse(json) as Partial<AnalysisPayload>;
    if (typeof parsed.analysis !== 'string') {
      return {
        status: 'needs_clarification', analysis: '', evidence: [], limitations: [],
        clarification: 'I could not interpret that request from the image. Please ask a specific satellite-image question, for example: “Identify flooded areas and describe the visible evidence.”',
      };
    }
    const decision = parsed.decisionSupport;
    const safeText = (value: unknown, fallback = 'Not determined from the supplied image.') => typeof value === 'string' && value.trim() ? value.trim().slice(0, 700) : fallback;
    const recommendations = Array.isArray(decision?.recommendations) ? decision.recommendations.slice(0, 3).map((item, index) => ({ rank: (index + 1) as 1 | 2 | 3, recommendation: safeText(item?.recommendation), why: safeText(item?.why), visibleEvidence: safeText(item?.visibleEvidence), advantages: safeText(item?.advantages), disadvantages: safeText(item?.disadvantages), risks: safeText(item?.risks), requiredValidation: safeText(item?.requiredValidation) })) : [];
    const qrRecords = Array.isArray(decision?.qrRecords) ? decision.qrRecords.slice(0, 6).map((item, index) => ({ id: safeText(item?.id, `SQ-${index + 1}`), areaOrFeature: safeText(item?.areaOrFeature), category: safeText(item?.category), keyFinding: safeText(item?.keyFinding), evidence: safeText(item?.evidence), potentialUse: safeText(item?.potentialUse), advantages: safeText(item?.advantages), disadvantages: safeText(item?.disadvantages), risk: safeText(item?.risk), requiredValidation: safeText(item?.requiredValidation) })) : [];
    return {
      status: parsed.status === 'needs_clarification' ? 'needs_clarification' : 'ok',
      analysis: parsed.analysis,
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.slice(0, 8).filter((item): item is EvidenceRegion => Boolean(item && typeof item.label === 'string' && item.bounds && Number.isFinite(item.bounds.x) && Number.isFinite(item.bounds.y) && Number.isFinite(item.bounds.width) && Number.isFinite(item.bounds.height))).map((item) => ({
        label: item.label,
        confidence: item.confidence === 'high' || item.confidence === 'medium' ? item.confidence : 'low',
        bounds: {
          x: Math.max(0, Math.min(1000, item.bounds.x)),
          y: Math.max(0, Math.min(1000, item.bounds.y)),
          width: Math.max(0, Math.min(1000, item.bounds.width)),
          height: Math.max(0, Math.min(1000, item.bounds.height)),
        },
        rationale: typeof item.rationale === 'string' ? item.rationale : '',
      })) : [],
      limitations: Array.isArray(parsed.limitations) ? parsed.limitations.filter((item): item is string => typeof item === 'string').slice(0, 4) : [],
      decisionSupport: decision ? { imageType: safeText(decision.imageType), landCover: safeText(decision.landCover), mainFinding: safeText(decision.mainFinding), potentialOpportunity: safeText(decision.potentialOpportunity), mainAffectedArea: safeText(decision.mainAffectedArea), environmentalConcern: safeText(decision.environmentalConcern), topRecommendation: safeText(decision.topRecommendation), confidence: decision.confidence === 'high' || decision.confidence === 'medium' ? decision.confidence : 'low', dataNeeded: safeText(decision.dataNeeded), recommendations, qrRecords } : undefined,
      visualLocation: parsed.visualLocation && typeof parsed.visualLocation.placeName === 'string' && parsed.visualLocation.placeName.trim() && (parsed.visualLocation.confidence === 'low' || parsed.visualLocation.confidence === 'medium' || parsed.visualLocation.confidence === 'high') && typeof parsed.visualLocation.evidence === 'string' ? { placeName: parsed.visualLocation.placeName.trim().slice(0, 160), confidence: parsed.visualLocation.confidence, evidence: parsed.visualLocation.evidence.trim().slice(0, 360) } : undefined,
      clarification: typeof parsed.clarification === 'string' ? parsed.clarification : undefined,
    };
  } catch {
    // A useful plain-text observation should be shown even if Gemini did not
    // honour the structured-output contract. Region overlays are omitted in
    // this case instead of wrongly telling the user that their query failed.
    const fallback = text.trim().replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/, '').trim();
    // A response can be cut off while generating its optional evidence array.
    // The main analysis is generated first, so recover that complete field
    // rather than rejecting an otherwise successful answer.
    const analysisMatch = fallback.match(/"analysis"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (analysisMatch) {
      try {
        const analysis = JSON.parse(`"${analysisMatch[1]}"`);
        if (typeof analysis === 'string' && analysis.trim()) {
          return {
            status: 'ok', analysis, evidence: [],
            limitations: ['The model response ended before evidence-region annotations could be completed.'],
          };
        }
      } catch {
        // Continue to the plain-text recovery below.
      }
    }
    if (fallback && !fallback.startsWith('{')) {
      return {
        status: 'ok', analysis: fallback, evidence: [],
        limitations: ['The model returned unstructured text, so no image-region annotations were generated.'],
      };
    }
    return { status: 'needs_clarification', analysis: '', evidence: [], limitations: [], clarification: 'I could not understand the analysis response. Please give your query in a clear format, for example: “Identify flooded areas in this image and explain the visible evidence.”' };
  }
}

function explainGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/api key not valid|invalid api key|permission_denied|\b401\b|\b403\b/i.test(message)) return { error: 'Gemini rejected the API key. Create a new key in Google AI Studio, paste it in the panel, and try again.', status: 401 };
  if (/quota|resource_exhausted|\b429\b/i.test(message)) return { error: 'Gemini quota is currently exhausted. Wait and retry, or check quota and billing in Google AI Studio.', status: 429 };
  if (/not found|\b404\b|model.*not/i.test(message)) return { error: 'The selected Gemini model is unavailable for this API key or region. Confirm that the key has Gemini API access.', status: 502 };
  if (/too large|request.*size|payload|\b413\b/i.test(message)) return { error: 'The image request is too large. For image pairs, use two images whose combined size is 14 MB or less.', status: 413 };
  if (/timeout|timed out|fetch failed|network/i.test(message)) return { error: 'The Gemini request timed out or could not reach the service. Use smaller images and try again.', status: 504 };
  return { error: 'Gemini could not analyze these images. Ensure both are valid JPG, PNG, or WebP files and try smaller images.', status: 502 };
}

function getConfiguredKey() {
  const primaryKey = process.env.GEMINI_API_KEY?.trim();
  if (primaryKey) return primaryKey;
  for (let index = 1; index <= 8; index += 1) {
    const key = process.env[`GEMINI_API_KEY_${index}`]?.trim();
    if (key) return key;
  }
  return undefined;
}

type AdapterEvidence = {
  engine: string;
  checkpoint: string;
  evidence: Array<{ label: string; score: number }>;
  pairEmbeddingDifference: number | null;
  limitation: string;
  changeMask?: { kind: string; image: string; width: number; height: number; grid: number; threshold: number; changedCells: number; totalCells: number; limitation: string } | null;
};

type GeoRasterValidation = {
  available: boolean;
  valid: boolean;
  warnings: string[];
  records: Array<{ crs: string | null; bounds: number[]; resolution: number[]; width: number; height: number; bands: number; descriptions: Array<string | null>; tags: Record<string, string> }>;
};

type ImageDiagnostics = {
  primary: { brightness: number; contrast: number; status: 'usable' | 'review' };
  comparison?: { brightness: number; contrast: number; status: 'usable' | 'review' };
  pairDifference?: { meanAbsoluteDifference: number; flaggedPixelsPercent: number; sampleSize: number; limitation: string };
  obstructionScreen?: { brightNeutralPercent: number; darkPercent: number; status: 'clearer-view' | 'review'; limitation: string };
  visualCoverMix?: Array<{ label: 'vegetation-like' | 'water-like' | 'built-or-neutral' | 'bare-or-warm'; percent: number }>;
  limitation: string;
};
type AcquisitionMetadata = { sensor?: string; acquiredAt?: string; resolution?: string; crs?: string; bandMapping?: string };
type QuantitativeChange = { available: boolean; changedAreaKm2?: number; changedHectares?: number; source?: string; limitation: string };
type VisualCoverLabel = 'vegetation-like' | 'water-like' | 'built-or-neutral' | 'bare-or-warm';

/**
 * Compute simple, reproducible display-raster diagnostics. These values are
 * deliberately separate from semantic change detection: they help an operator
 * spot very dark/flat inputs and gross pair differences before interpreting a
 * VLM answer as an operational finding.
 */
async function computeImageDiagnostics(images: Array<{ data: string }>): Promise<ImageDiagnostics | null> {
  try {
    const samples = await Promise.all(images.map(async ({ data }) => {
      const rgb = await sharp(Buffer.from(data, 'base64'))
        .resize(128, 128, { fit: 'fill' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
      const pixels = new Uint8Array(128 * 128);
      for (let index = 0; index < pixels.length; index += 1) pixels[index] = Math.round((rgb[index * 3] + rgb[index * 3 + 1] + rgb[index * 3 + 2]) / 3);
      const mean = pixels.reduce((total, value) => total + value, 0) / pixels.length;
      const variance = pixels.reduce((total, value) => total + (value - mean) ** 2, 0) / pixels.length;
      return { pixels, rgb, brightness: mean / 255, contrast: Math.sqrt(variance) / 255 };
    }));
    const describe = (sample: { brightness: number; contrast: number }) => ({
      brightness: Number(sample.brightness.toFixed(3)), contrast: Number(sample.contrast.toFixed(3)),
      status: sample.brightness < 0.08 || sample.brightness > 0.92 || sample.contrast < 0.025 ? 'review' as const : 'usable' as const,
    });
    const result: ImageDiagnostics = {
      primary: describe(samples[0]),
      limitation: 'Brightness and contrast are computed from a resized display rendering. They do not measure cloud cover, radiometric calibration, or sensor quality.',
    };
    const mix = { vegetation: 0, water: 0, neutral: 0, warm: 0, brightNeutral: 0, dark: 0 };
    for (let index = 0; index < samples[0].pixels.length; index += 1) {
      const red = samples[0].rgb[index * 3]; const green = samples[0].rgb[index * 3 + 1]; const blue = samples[0].rgb[index * 3 + 2];
      const brightness = samples[0].pixels[index]; const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (brightness > 205 && spread < 26) mix.brightNeutral += 1;
      if (brightness < 48) mix.dark += 1;
      if (green > red * 1.12 && green > blue * 1.06) mix.vegetation += 1;
      else if (blue > red * 1.16 && blue > green * 1.04) mix.water += 1;
      else if (red > green * 1.1 && red > blue * 1.1) mix.warm += 1;
      else mix.neutral += 1;
    }
    const pixelCount = samples[0].pixels.length;
    result.obstructionScreen = {
      brightNeutralPercent: Number((mix.brightNeutral / pixelCount * 100).toFixed(1)), darkPercent: Number((mix.dark / pixelCount * 100).toFixed(1)),
      status: mix.brightNeutral / pixelCount > 0.25 || mix.dark / pixelCount > 0.35 ? 'review' : 'clearer-view',
      limitation: 'Bright-neutral and dark pixels are visual screening proxies only; they do not identify cloud, shadow, smoke, water, or haze reliably.',
    };
    result.visualCoverMix = [
      ['vegetation-like', mix.vegetation], ['water-like', mix.water], ['built-or-neutral', mix.neutral], ['bare-or-warm', mix.warm],
    ].map(([label, count]) => ({ label: label as VisualCoverLabel, percent: Number((Number(count) / pixelCount * 100).toFixed(1)) }));
    if (samples[1]) {
      const left = samples[0].pixels;
      const right = samples[1].pixels;
      let totalDifference = 0;
      let flagged = 0;
      for (let index = 0; index < left.length; index += 1) {
        const difference = Math.abs(left[index] - right[index]) / 255;
        totalDifference += difference;
        if (difference >= 0.15) flagged += 1;
      }
      result.comparison = describe(samples[1]);
      result.pairDifference = {
        meanAbsoluteDifference: Number((totalDifference / left.length).toFixed(3)),
        flaggedPixelsPercent: Number((flagged / left.length * 100).toFixed(1)), sampleSize: left.length,
        limitation: 'This is a display-pixel screen after resizing, not a semantic change map, geospatially measured area, or damage estimate.',
      };
    }
    return result;
  } catch {
    return null;
  }
}

async function runRemoteSensingAdapter(query: string, mode: SatQueryMode, images: Array<{ data: string }>): Promise<AdapterEvidence | null> {
  if (!ADAPTER_URL) return null;
  try {
    const response = await fetch(`${ADAPTER_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode, images: images.map((image) => image.data) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as Partial<AdapterEvidence>;
    if (typeof payload.engine !== 'string' || !Array.isArray(payload.evidence)) return null;
    return {
      engine: payload.engine,
      checkpoint: typeof payload.checkpoint === 'string' ? payload.checkpoint : 'unknown checkpoint',
      evidence: payload.evidence.filter((item): item is { label: string; score: number } => Boolean(item && typeof item.label === 'string' && typeof item.score === 'number')).slice(0, 4),
      pairEmbeddingDifference: typeof payload.pairEmbeddingDifference === 'number' ? payload.pairEmbeddingDifference : null,
      limitation: typeof payload.limitation === 'string' ? payload.limitation : 'Adapter evidence is advisory.',
      changeMask: payload.changeMask && typeof payload.changeMask === 'object' && typeof payload.changeMask.image === 'string' ? payload.changeMask : null,
    };
  } catch {
    return null;
  }
}

async function prepareRaster(file: File): Promise<{ data: string; mimeType: string; descriptor: InputDescriptor }> {
  const source = Buffer.from(await file.arrayBuffer());
  const isGeoTiff = file.type === 'image/tiff' || file.type === 'image/tif' || file.type === 'application/geotiff' || /\.geo?ti?ff?$/i.test(file.name);
  if (!isGeoTiff) {
    const metadata = await sharp(source, { limitInputPixels: 40_000_000 }).metadata().catch(() => null);
    return { data: source.toString('base64'), mimeType: file.type, descriptor: { filename: file.name, mimeType: file.type, width: metadata?.width, height: metadata?.height, channels: metadata?.channels, density: metadata?.density, isGeoTiff: false } };
  }
  // Gemini accepts common display rasters, not GeoTIFF. Decode the approved
  // TIFF input server-side while retaining its format in the execution trace.
  const image = sharp(source, { limitInputPixels: 40_000_000, pages: 1 });
  const metadata = await image.metadata();
  const png = await image.png({ compressionLevel: 8 }).toBuffer();
  return { data: png.toString('base64'), mimeType: 'image/png', descriptor: { filename: file.name, mimeType: file.type, width: metadata.width, height: metadata.height, channels: metadata.channels, density: metadata.density, isGeoTiff: true } };
}

async function validateGeoTiffPair(first: File, second: File, mode: SatQueryMode): Promise<GeoRasterValidation | null> {
  if (!ADAPTER_URL || (mode !== 'bi-temporal' && mode !== 'optical-sar')) return null;
  const isTiff = (file: File) => file.type === 'image/tiff' || file.type === 'image/tif' || file.type === 'application/geotiff' || /\.geo?ti?ff?$/i.test(file.name);
  if (!isTiff(first) || !isTiff(second)) return null;
  try {
    const [left, right] = await Promise.all([first.arrayBuffer(), second.arrayBuffer()]);
    const response = await fetch(`${ADAPTER_URL}/validate-raster`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, images: [Buffer.from(left).toString('base64'), Buffer.from(right).toString('base64')] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const validation = await response.json() as GeoRasterValidation;
    return validation.available ? validation : null;
  } catch { return null; }
}

/**
 * Turns an adapter's coarse change grid into an area only when the pair has a
 * validated projected CRS and metre-based pixel resolution. A display-pixel
 * difference is never converted into an area: it has no physical scale.
 */
function quantifyChange(adapter: AdapterEvidence | null, validation: GeoRasterValidation | null): QuantitativeChange {
  const record = validation?.records?.[0];
  const crs = record?.crs || '';
  const [xResolution, yResolution] = record?.resolution || [];
  if (!adapter?.changeMask) return { available: false, limitation: 'A trained adapter change grid is required before a measured change area can be reported.' };
  if (!validation?.valid || !record || !/^EPSG:(?!4326$)\d+$/i.test(crs) || !Number.isFinite(xResolution) || !Number.isFinite(yResolution) || xResolution <= 0 || yResolution <= 0) {
    return { available: false, limitation: 'Change area is unavailable until both GeoTIFFs pass validation with a projected metre-based CRS and pixel resolution.' };
  }
  const pixelAreaM2 = Math.abs(xResolution * yResolution);
  const gridCellPixels = (record.width * record.height) / (adapter.changeMask.grid * adapter.changeMask.grid);
  const changedAreaM2 = adapter.changeMask.changedCells * gridCellPixels * pixelAreaM2;
  return {
    available: true,
    changedAreaKm2: Number((changedAreaM2 / 1_000_000).toFixed(4)),
    changedHectares: Number((changedAreaM2 / 10_000).toFixed(2)),
    source: `Adapter semantic change grid · ${crs}`,
    limitation: 'This is a coarse semantic-grid estimate, not a survey-grade segmentation or damage measurement. Validate the mask and spatial registration before operational use.',
  };
}

function toMapEvidence(evidence: AnalysisPayload['evidence'], validation: GeoRasterValidation | null) {
  const record = validation?.records?.[0];
  if (!validation?.valid || record?.crs?.toUpperCase() !== 'EPSG:4326' || record.bounds.length !== 4) return null;
  const [west, south, east, north] = record.bounds;
  return {
    type: 'FeatureCollection' as const,
    features: evidence.map((region, index) => {
      const x1 = west + (east - west) * region.bounds.x / 1000;
      const x2 = west + (east - west) * (region.bounds.x + region.bounds.width) / 1000;
      const y1 = north - (north - south) * region.bounds.y / 1000;
      const y2 = north - (north - south) * (region.bounds.y + region.bounds.height) / 1000;
      return { type: 'Feature' as const, properties: { label: region.label, confidence: region.confidence, rationale: region.rationale, id: index + 1 }, geometry: { type: 'Polygon' as const, coordinates: [[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]] } };
    }),
  };
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const image = form.get('image');
    const query = String(form.get('query') || '').trim();
    const requestedLanguage = String(form.get('responseLanguage') || 'English').trim();
    const responseLanguage = RESPONSE_LANGUAGES.has(requestedLanguage) ? requestedLanguage : 'English';
    const imageLastModified = String(form.get('imageLastModified') || '').trim();
    const areaOfInterest = String(form.get('areaOfInterest') || '').trim();
    const acquisitionMetadata = String(form.get('acquisitionMetadata') || '').trim();
    const mode = String(form.get('mode') || 'optical') as SatQueryMode;
    const comparisonImage = form.get('comparisonImage');
    const locationSourceImage = form.get('locationSourceImage');
    if (!(image instanceof File)) return NextResponse.json({ error: 'An image file is required.' }, { status: 400 });
    if (!query) return NextResponse.json({ error: 'A natural-language query is required.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(image.type) && !/\.geo?ti?ff?$/i.test(image.name)) return NextResponse.json({ error: 'Supported formats are JPG, PNG, WebP, TIFF, and GeoTIFF.' }, { status: 415 });
    if (image.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Image must be 12 MB or smaller.' }, { status: 413 });
    if (!ANALYSIS_MODES.has(mode)) return NextResponse.json({ error: 'Choose a supported analysis mode.' }, { status: 400 });
    if ((mode === 'optical-sar' || mode === 'bi-temporal') && !(comparisonImage instanceof File)) return NextResponse.json({ error: 'Add the paired comparison image for this analysis mode.' }, { status: 400 });
    if (comparisonImage instanceof File && ((!ALLOWED_TYPES.has(comparisonImage.type) && !/\.geo?ti?ff?$/i.test(comparisonImage.name)) || comparisonImage.size > MAX_FILE_SIZE)) return NextResponse.json({ error: 'The comparison image must be JPG, PNG, WebP, TIFF, or GeoTIFF and no larger than 12 MB.' }, { status: 415 });
    if (comparisonImage instanceof File && image.size + comparisonImage.size > MAX_COMBINED_FILE_SIZE) return NextResponse.json({ error: 'For paired analysis, keep both images together at 14 MB or less. Large pairs exceed the Gemini inline-image request limit.', code: 'PAIR_TOO_LARGE' }, { status: 413 });

    const apiKey = request.headers.get('x-gemini-key')?.trim() || getConfiguredKey();
    if (!apiKey) return NextResponse.json({ error: 'Add a Gemini API key in the panel or configure GEMINI_API_KEY on the server.' }, { status: 503 });

    const geoValidation = comparisonImage instanceof File ? await validateGeoTiffPair(image, comparisonImage, mode) : null;
    if (geoValidation && !geoValidation.valid) {
      return NextResponse.json({ error: `GeoTIFF pair validation failed: ${geoValidation.warnings.join(' ')}`, code: 'GEO_PAIR_INCOMPATIBLE', validation: geoValidation }, { status: 422 });
    }
    const preparedImage = await prepareRaster(image);
    const preparedComparison = comparisonImage instanceof File ? await prepareRaster(comparisonImage) : null;
    // The browser sends the unmodified file separately because its optimized
    // analysis copy may no longer retain EXIF GPS metadata.
    const imageLocation = await resolveImageLocation(locationSourceImage instanceof File ? locationSourceImage : image);
    // A paired workflow is meaningful only when both rasters plausibly describe
    // the same footprint. This does not prove georegistration (that needs
    // GeoTIFF CRS/transform metadata or a registration model), but it rejects
    // obviously incompatible image shapes before sending them to a VLM.
    if (preparedComparison && (mode === 'bi-temporal' || mode === 'optical-sar')) {
      const firstRatio = (preparedImage.descriptor.width || 0) / (preparedImage.descriptor.height || 1);
      const secondRatio = (preparedComparison.descriptor.width || 0) / (preparedComparison.descriptor.height || 1);
      if (firstRatio > 0 && secondRatio > 0 && Math.abs(firstRatio - secondRatio) / Math.max(firstRatio, secondRatio) > 0.03) {
        return NextResponse.json({
          error: 'The paired images have incompatible aspect ratios. Use spatially corresponding, co-registered images covering the same footprint before running change or optical–SAR analysis.',
          code: 'PAIR_INCOMPATIBLE',
        }, { status: 422 });
      }
    }
    const plan = createExecutionPlan(mode, query, preparedImage.descriptor, preparedComparison?.descriptor);
    if (preparedComparison) {
      const exactDimensions = preparedImage.descriptor.width === preparedComparison.descriptor.width && preparedImage.descriptor.height === preparedComparison.descriptor.height;
      plan.inputChecks.push(exactDimensions
        ? 'Pair raster dimensions match; compatible footprint check passed'
        : 'Pair aspect ratios are compatible; confirm georegistration before operational use');
      if (geoValidation) {
        plan.inputChecks.push(`GeoTIFF CRS validation passed: ${geoValidation.records[0]?.crs || 'unknown CRS'}`);
        plan.inputChecks.push(`GeoTIFF spatial metadata inspected: ${geoValidation.records[0]?.bands || 0} / ${geoValidation.records[1]?.bands || 0} bands`);
        plan.warnings.push(...geoValidation.warnings);
      } else if (preparedImage.descriptor.isGeoTiff && preparedComparison.descriptor.isGeoTiff) {
        plan.warnings.push('GeoTIFF CRS/bounds/band validation is pending because the geospatial validator service is not connected.');
      }
    }
    const adapter = await runRemoteSensingAdapter(query, mode, [preparedImage, ...(preparedComparison ? [preparedComparison] : [])]);
    const imageDiagnostics = await computeImageDiagnostics([preparedImage, ...(preparedComparison ? [preparedComparison] : [])]);
    const quantitativeChange = mode === 'bi-temporal' ? quantifyChange(adapter, geoValidation) : null;
    const parsedMetadata: AcquisitionMetadata | null = acquisitionMetadata ? (() => { try { return JSON.parse(acquisitionMetadata) as AcquisitionMetadata; } catch { return null; } })() : null;
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: IMAGE_ANALYSIS_MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        // A concise response returns materially faster while still leaving
        // enough room for evidence regions and limitations.
        maxOutputTokens: 550,
        temperature: 0.2,
      },
      systemInstruction: `You are SATQUERY AI's evidence-grounded remote-sensing decision-support assistant. Analyze only what is visible in the supplied imagery. Respond entirely in the user-selected language: ${responseLanguage}. Clearly distinguish direct observation from a cautious recommendation. Never invent exact measurements, crop yields, ownership, acquisition details, sensor metadata, or hidden features. If evidence is insufficient, say what additional bands, temporal imagery, GIS layers, field data, or higher-resolution imagery are needed. Optical images show reflected light; SAR brightness depends on radar geometry, surface roughness, moisture, and polarization—never treat SAR brightness alone as confirmed land cover. For optical-SAR and bi-temporal modes, compare only corresponding visible features and flag likely misregistration. ${mode === 'bi-temporal' ? 'For EVERY defensible change, the analysis field MUST use these exact labels on separate lines: NEW FEATURE:, LOCATION IN IMAGE:, CHANGE TYPE: (Added, expanded, removed, or reduced), VISIBLE COMPARISON EVIDENCE:, CONFIDENCE: (High, Medium, or Low), and LIMITATION:.' : ''}

Analyze visible land cover, vegetation/agriculture, water, roads, buildings/settlements, open land, tree cover, infrastructure, environmental concerns, disaster/change cues, and development opportunities where they are actually visible. Agricultural, development, or mitigation recommendations must be tentative: “potentially suitable”, “may be appropriate”, or “requires field validation”. For each recommendation balance advantages, disadvantages, risks, and data required. Return the top three practical recommendations ranked 1–3. Create QR records only for major visible features or recommendations; QR records are unverified decision-support notes, not official records. For visualLocation, provide a place only if distinctive public landmarks, readable place signage, or uniquely identifying geographic features directly support it. Never infer a precise location from generic terrain, a person's appearance, bodies, homes, or a disaster scene; omit visualLocation when the image is not sufficiently distinctive.

Return only valid JSON with this exact schema: {"status":"ok","analysis":"concise evidence-grounded narrative","evidence":[{"label":"short label","confidence":"low|medium|high","bounds":{"x":0-1000,"y":0-1000,"width":0-1000,"height":0-1000},"rationale":"visible support"}],"limitations":["short caveat"],"visualLocation":{"placeName":"possible city, region, or landmark","confidence":"low|medium|high","evidence":"visible landmark/signage/geographic clue"},"decisionSupport":{"imageType":"observed or uncertain","landCover":"concise visible cover summary","mainFinding":"direct observation","potentialOpportunity":"cautious interpretation","mainAffectedArea":"visible location or not determined","environmentalConcern":"direct observation or uncertain","topRecommendation":"rank-1 recommendation","confidence":"low|medium|high","dataNeeded":"specific next data","recommendations":[{"recommendation":"cautious action","why":"reason","visibleEvidence":"directly visible evidence","advantages":"benefits","disadvantages":"limits","risks":"risks","requiredValidation":"data/field validation"}],"qrRecords":[{"id":"SQ-1","areaOrFeature":"feature","category":"Agriculture|Environment|Infrastructure|Disaster|Water|Development","keyFinding":"finding","evidence":"visible support","potentialUse":"application","advantages":"benefit","disadvantages":"limit","risk":"risk","requiredValidation":"next validation"}]}}. Omit visualLocation when no specific visual evidence supports one. Evidence bounds must refer only to the FIRST image using a 1000 by 1000 normalized coordinate space. Return empty arrays when no defensible localized feature exists.`,
    });
    const response = await model.generateContent([
      { inlineData: { data: preparedImage.data, mimeType: preparedImage.mimeType } },
      ...(preparedComparison ? [{ inlineData: { data: preparedComparison.data, mimeType: preparedComparison.mimeType } }, { text: `Second image supplied for ${mode} comparison.` }] : []),
      { text: `Analysis mode: ${mode}. Selected remote-sensing task: ${plan.selectedTask}. User query: ${query}\nFirst-image file timestamp supplied by browser: ${imageLastModified || 'not available'}\nAnalysis time (UTC): ${new Date().toISOString()}${parsedMetadata ? `\nOperator-supplied acquisition metadata (do not treat as independently verified): ${JSON.stringify(parsedMetadata)}` : ''}${areaOfInterest ? `\nMap area-of-interest context: ${areaOfInterest}. This geometry is not image registration; do not claim pixel-level conclusions are constrained to it unless the imagery itself is georeferenced and aligned.` : ''}${adapter ? `\nDomain-adapted BigEarthNet encoder evidence (use as supporting evidence, do not claim it is pixel-level ground truth): ${adapter.evidence.map((item) => `${item.label} (${item.score.toFixed(3)})`).join(', ')}${adapter.pairEmbeddingDifference !== null ? `; pair embedding difference: ${adapter.pairEmbeddingDifference.toFixed(3)}` : ''}.` : '\nNo trained local remote-sensing adapter was available for this request; do not claim a domain-adapted model was used.'}` },
    ]);
    const result = parseAnalysisPayload(response.response.text());
    // Do not force a normal user into prompt-engineering. If a provider still
    // emits its legacy clarification shape, surface it as a useful response
    // rather than failing the request with HTTP 422.
    const analysis = result.status === 'needs_clarification'
      ? result.clarification || 'I could not determine a specific feature with confidence. The image has been reviewed; use the visible evidence and limitations below when interpreting it.'
      : result.analysis;
    return NextResponse.json({ ...result, status: 'ok', analysis, mode, responseLanguage, model: adapter ? `${IMAGE_ANALYSIS_MODEL} + ${adapter.engine}` : IMAGE_ANALYSIS_MODEL, adapter, imageDiagnostics, quantitativeChange, imageLocation, mapEvidence: toMapEvidence(result.evidence, geoValidation), acquisitionMetadata: parsedMetadata, execution: plan, inputMetadata: { primary: preparedImage.descriptor, comparison: preparedComparison?.descriptor || null, geospatialPair: geoValidation }, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[SAT QUTRIYAI] Image analysis failed:', error);
    const response = explainGeminiError(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}
