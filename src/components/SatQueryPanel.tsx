'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CheckCircle2, ClipboardCheck, Download, ExternalLink, FileImage, ImagePlus, Loader2, MapPinned, Mic, MicOff, QrCode, Search, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';

type EvidenceRegion = { label: string; confidence: 'low' | 'medium' | 'high'; bounds: { x: number; y: number; width: number; height: number }; rationale: string };
type ExecutionPlan = { selectedTask: string; inputChecks: string[]; warnings: string[]; steps: Array<{ task: string; tool: string; purpose: string; parameters: Record<string, string | number | boolean> }> };
type InputDescriptor = { filename?: string; mimeType?: string; width?: number; height?: number; channels?: number; density?: number; isGeoTiff?: boolean };
type AdapterChangeMask = { kind: string; image: string; width: number; height: number; grid: number; threshold: number; changedCells: number; totalCells: number; limitation: string };
type ImageDiagnostics = { primary: { brightness: number; contrast: number; status: 'usable' | 'review' }; comparison?: { brightness: number; contrast: number; status: 'usable' | 'review' }; pairDifference?: { meanAbsoluteDifference: number; flaggedPixelsPercent: number; sampleSize: number; limitation: string }; obstructionScreen?: { brightNeutralPercent: number; darkPercent: number; status: 'clearer-view' | 'review'; limitation: string }; visualCoverMix?: Array<{ label: 'vegetation-like' | 'water-like' | 'built-or-neutral' | 'bare-or-warm'; percent: number }>; limitation: string };
type SpectralResult = { index: string; numeratorBand: number; denominatorBand: number; channels: number; dimensions: { width: number; height: number }; sampledPixels: number; mean: number; min: number; max: number; note: string };
type AnalysisMode = 'optical' | 'sar' | 'optical-sar' | 'bi-temporal';
type AcquisitionMetadata = { sensor: string; acquiredAt: string; resolution: string; crs: string; bandMapping: string };
type MapEvidence = { type: 'FeatureCollection'; features: Array<{ type: 'Feature'; properties: { label: string; confidence: string; rationale: string; id: number }; geometry: { type: 'Polygon'; coordinates: number[][][] } }> };
type Recommendation = { rank: 1 | 2 | 3; recommendation: string; why: string; visibleEvidence: string; advantages: string; disadvantages: string; risks: string; requiredValidation: string };
type QrRecord = { id: string; areaOrFeature: string; category: string; keyFinding: string; evidence: string; potentialUse: string; advantages: string; disadvantages: string; risk: string; requiredValidation: string };
type DecisionSupport = { imageType: string; landCover: string; mainFinding: string; potentialOpportunity: string; mainAffectedArea: string; environmentalConcern: string; topRecommendation: string; confidence: 'low' | 'medium' | 'high'; dataNeeded: string; recommendations: Recommendation[]; qrRecords: QrRecord[] };
type FieldVerification = { id: string; recordId: string; status: 'confirmed' | 'needs-review' | 'not-observed'; verifier: string; observedAt: string; latitude: string; longitude: string; notes: string; createdAt: string };
type UploadSharpness = { state: 'checking' | 'ready' | 'blocked' | 'unavailable'; score?: number; note: string };
type ImageLocation = { status: 'verified' | 'unavailable'; latitude?: number; longitude?: number; placeName?: string; source: string; note: string };
type VisualLocation = { placeName: string; confidence: 'low' | 'medium' | 'high'; evidence: string };
type AnalysisResult = { analysis: string; model: string; timestamp: string; mode?: string; responseLanguage?: string; evidence?: EvidenceRegion[]; limitations?: string[]; decisionSupport?: DecisionSupport; adapter?: { engine: string; checkpoint: string; changeMask?: AdapterChangeMask | null }; imageDiagnostics?: ImageDiagnostics | null; quantitativeChange?: { available: boolean; changedAreaKm2?: number; changedHectares?: number; source?: string; limitation: string } | null; imageLocation?: ImageLocation; visualLocation?: VisualLocation; mapEvidence?: MapEvidence | null; acquisitionMetadata?: Partial<AcquisitionMetadata> | null; execution?: ExecutionPlan; inputMetadata?: { primary?: InputDescriptor; comparison?: InputDescriptor | null; geospatialPair?: { records?: Array<{ crs?: string | null; bounds?: number[]; resolution?: number[]; bands?: number }>; warnings?: string[] } | null }; reports?: Array<{ index: number; title: string; date: string; source: string; url: string | null }>; incidentSearch?: boolean };
type QualityAssessment = { level: 'ready' | 'review'; checks: string[]; cautions: string[] };

function assessImageQuality(input: InputDescriptor | undefined, paired: boolean): QualityAssessment {
  const checks: string[] = [];
  const cautions: string[] = [];
  if (input?.width && input?.height) {
    checks.push(`Raster dimensions available: ${input.width} × ${input.height}px`);
    if (Math.min(input.width, input.height) < 256) cautions.push('Low pixel dimensions can limit small-feature interpretation.');
  } else cautions.push('Image dimensions were not available to the quality check.');
  if (input?.isGeoTiff) checks.push('GeoTIFF/TIFF source identified; inspect CRS and band metadata before operational use.');
  else cautions.push('No geospatial registration was supplied; findings cannot be assigned to exact map coordinates.');
  if ((input?.channels || 0) > 3) checks.push(`${input?.channels} raster channels detected; spectral analysis can be configured from verified band metadata.`);
  else cautions.push('Cloud, haze, calibration, and spectral-band semantics require operator review; they are not inferred from a display image.');
  if (paired) checks.push('Paired workflow selected; co-registration must be verified before acting on changes.');
  return { level: cautions.length > 1 ? 'review' : 'ready', checks, cautions };
}

function disasterGuidance(query: string) {
  const source = query.toLowerCase();
  if (/flood|inundat|water.?log/.test(source)) return { label: 'FLOOD IMPACT SCREEN', action: 'Validate water extent against a cloud-free reference image, then prioritise field verification near roads, settlements, and critical facilities.' };
  if (/fire|burn|wildfire/.test(source)) return { label: 'FIRE / BURN-SCAR SCREEN', action: 'Compare with a pre-event image, review smoke/cloud interference, and send high-confidence areas for incident verification.' };
  if (/drought|crop stress|vegetation loss/.test(source)) return { label: 'VEGETATION-STRESS SCREEN', action: 'Use verified NIR/Red band assignments for NDVI, compare the same season, and validate with local crop or rainfall observations.' };
  if (/landslide|slope|erosion/.test(source)) return { label: 'LANDSLIDE / EROSION SCREEN', action: 'Review terrain, rainfall, and co-registered pre/post-event imagery before issuing a slope-risk assessment.' };
  if (/damage|building|infrastructure|road/.test(source)) return { label: 'INFRASTRUCTURE-IMPACT SCREEN', action: 'Cross-check visible evidence with a pre-event image and request field confirmation before estimating asset damage.' };
  return null;
}

function changeSeverity(mask: AdapterChangeMask | null | undefined) {
  if (!mask || !mask.totalCells) return null;
  const percent = Math.round(mask.changedCells / mask.totalCells * 100);
  return { percent, label: percent >= 45 ? 'HIGH' : percent >= 20 ? 'MODERATE' : 'LOW' };
}

const RESPONSE_LANGUAGES = [
  { label: 'English', value: 'English', speech: 'en-IN' },
  { label: 'Hindi · हिन्दी', value: 'Hindi', speech: 'hi-IN' },
  { label: 'Bengali · বাংলা', value: 'Bengali', speech: 'bn-IN' },
  { label: 'Tamil · தமிழ்', value: 'Tamil', speech: 'ta-IN' },
  { label: 'Telugu · తెలుగు', value: 'Telugu', speech: 'te-IN' },
  { label: 'Marathi · मराठी', value: 'Marathi', speech: 'mr-IN' },
  { label: 'Gujarati · ગુજરાતી', value: 'Gujarati', speech: 'gu-IN' },
  { label: 'Malayalam · മലയാളം', value: 'Malayalam', speech: 'ml-IN' },
  { label: 'Kannada · ಕನ್ನಡ', value: 'Kannada', speech: 'kn-IN' },
  { label: 'Punjabi · ਪੰਜਾਬੀ', value: 'Punjabi', speech: 'pa-IN' },
  { label: 'Urdu · اردو', value: 'Urdu', speech: 'ur-PK' },
] as const;

const BHASHINI_LANGUAGE_CODES: Record<(typeof RESPONSE_LANGUAGES)[number]['value'], string> = {
  English: 'en', Hindi: 'hi', Bengali: 'bn', Tamil: 'ta', Telugu: 'te', Marathi: 'mr',
  Gujarati: 'gu', Malayalam: 'ml', Kannada: 'kn', Punjabi: 'pa', Urdu: 'ur',
};

function fileDate(file: File | null): string {
  if (!file || !Number.isFinite(file.lastModified) || file.lastModified <= 0) return 'Date unavailable';
  return new Date(file.lastModified).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fileSize(file: File | null): string {
  if (!file) return '—';
  return `${(file.size / (1024 * 1024)).toFixed(file.size >= 1024 * 1024 ? 1 : 2)} MB`;
}

function describeInput(descriptor: InputDescriptor | undefined, file: File | null): string {
  const name = descriptor?.filename || file?.name || 'Unnamed input';
  const dimensions = descriptor?.width && descriptor?.height ? `${descriptor.width} × ${descriptor.height}px` : 'dimensions unavailable';
  const bands = descriptor?.channels ? ` · ${descriptor.channels} channel${descriptor.channels === 1 ? '' : 's'}` : '';
  return `${name} · ${dimensions}${bands} · ${fileSize(file)}`;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'image/tif', 'application/geotiff'];
const MAX_FILE_SIZE = 12 * 1024 * 1024;
// Vision requests do not benefit much from full-resolution satellite exports.
// Keeping the upload compact leaves substantially more time for Gemini to
// reason about the image instead of receiving and decoding it.
const ANALYSIS_MAX_DIMENSION = 1280;
const ANALYSIS_MAX_BYTES = Math.floor(1.25 * 1024 * 1024);
const ANALYSIS_REQUEST_TIMEOUT_MS = 70_000;
const GEMINI_KEY_STORAGE = 'osiris.satquery.geminiApiKey';
const HISTORY_STORAGE = 'osiris.satquery.history';
const FIELD_VERIFICATION_STORAGE = 'osiris.satquery.field-verifications';
const QUICK_QUERIES = [
  'What changed in this area?',
  'Which areas are flooded?',
  'Compare these two satellite images.',
  'What infrastructure is visible?',
  'Which regions show significant change?',
  'What is the affected area?',
  'What does this satellite image indicate?',
];
const DEMO_WORKFLOWS: Array<{ title: string; mode: AnalysisMode; query: string; detail: string }> = [
  { title: 'FLOOD CHANGE', mode: 'bi-temporal', query: 'Identify newly flooded areas between Date A and Date B and highlight the visible evidence.', detail: 'Upload two co-registered dates.' },
  { title: 'CROP HEALTH', mode: 'optical', query: 'Describe crop health, vegetation stress, and visible irrigation patterns.', detail: 'Use multispectral GeoTIFF for NDVI.' },
  { title: 'URBAN GROWTH', mode: 'bi-temporal', query: 'What built-up infrastructure has changed between the two images?', detail: 'Upload before/after imagery.' },
  { title: 'OPTICAL + SAR WATER', mode: 'optical-sar', query: 'Identify likely water bodies using complementary optical and SAR evidence.', detail: 'Upload matched optical and SAR images.' },
];
const RESEARCH_REFERENCES = [
  { label: 'Sentinel-2 mission & product documentation', source: 'Copernicus Data Space', href: 'https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html', fallback: 'https://browser.dataspace.copernicus.eu/', fallbackLabel: 'DATA BROWSER' },
  { label: 'Landsat data user handbooks', source: 'U.S. Geological Survey', href: 'https://www.usgs.gov/landsat-missions/landsat-data-user-handbooks', fallback: 'https://earthexplorer.usgs.gov/', fallbackLabel: 'EARTH EXPLORER' },
  { label: 'Browse and compare global imagery', source: 'NASA Worldview', href: 'https://worldview.earthdata.nasa.gov/' },
] as const;

function qualityScore(diagnostics: ImageDiagnostics | null | undefined) {
  if (!diagnostics) return null;
  let score = diagnostics.primary.status === 'usable' ? 80 : 48;
  if (diagnostics.obstructionScreen?.status === 'review') score -= 22;
  if (diagnostics.comparison?.status === 'review') score -= 12;
  return Math.max(0, Math.min(100, score));
}

function evidenceQrPayload(record: QrRecord, analysis: AnalysisResult) {
  return JSON.stringify({
    schema: 'satquery-evidence-v1', recordId: record.id, category: record.category,
    feature: record.areaOrFeature, finding: record.keyFinding, evidence: record.evidence,
    requiredValidation: record.requiredValidation, generatedAt: analysis.timestamp,
    disclaimer: 'Image-based decision-support record. Not a verified land, disaster, or ownership record.',
  });
}

async function screenSharpness(file: File): Promise<UploadSharpness> {
  if (/\.geo?ti?ff?$/i.test(file.name) || /tiff|geotiff/.test(file.type)) return { state: 'unavailable', note: 'Blur screening requires a display image. Inspect GeoTIFF quality using its raster metadata and preview.' };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(24, Math.round(bitmap.width * scale)); const height = Math.max(24, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No canvas');
    context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
    const pixels = context.getImageData(0, 0, width, height).data;
    let total = 0; let samples = 0;
    for (let y = 1; y < height - 1; y += 2) for (let x = 1; x < width - 1; x += 2) {
      const at = (xx: number, yy: number) => { const i = (yy * width + xx) * 4; return pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114; };
      const laplacian = Math.abs(4 * at(x, y) - at(x - 1, y) - at(x + 1, y) - at(x, y - 1) - at(x, y + 1)); total += laplacian; samples++;
    }
    const score = Math.round(total / Math.max(samples, 1));
    return score < 4 ? { state: 'blocked', score, note: 'Image appears severely blurred or nearly uniform. Upload a clearer satellite image before analysis.' } : { state: 'ready', score, note: 'Basic sharpness screen passed. Clouds, haze, and sensor quality still need review.' };
  } catch { return { state: 'unavailable', note: 'Sharpness could not be screened in this browser. Review image clarity before analysis.' }; }
}

/**
 * A transparent trust screen for paired workflows. It intentionally measures
 * metadata and input compatibility only; it is not a claim of pixel-perfect
 * image registration or semantic change confidence.
 */
function pairTrust(result: AnalysisResult, mode: AnalysisMode) {
  if (mode !== 'bi-temporal' && mode !== 'optical-sar') return null;
  const primary = result.inputMetadata?.primary;
  const comparison = result.inputMetadata?.comparison;
  const geo = result.inputMetadata?.geospatialPair;
  const checks: string[] = [];
  const cautions: string[] = [];
  let score = 15;

  if (primary && comparison) { score += 15; checks.push('Both required inputs were supplied.'); }
  if (primary?.width && primary?.height && comparison?.width && comparison?.height) {
    if (primary.width === comparison.width && primary.height === comparison.height) { score += 20; checks.push('Raster dimensions match.'); }
    else cautions.push('Raster dimensions differ; verify resampling and grid alignment.');
  } else cautions.push('Raster dimensions could not be compared.');

  const [firstGeo, secondGeo] = geo?.records || [];
  if (firstGeo && secondGeo) {
    if (firstGeo.crs && firstGeo.crs === secondGeo.crs) { score += 20; checks.push(`Shared CRS: ${firstGeo.crs}.`); }
    else cautions.push('CRS is missing or differs between the GeoTIFF inputs.');
    if (JSON.stringify(firstGeo.bounds) === JSON.stringify(secondGeo.bounds)) { score += 15; checks.push('GeoTIFF bounds match.'); }
    else cautions.push('GeoTIFF bounds differ; confirm the same ground footprint.');
    if (JSON.stringify(firstGeo.resolution) === JSON.stringify(secondGeo.resolution)) { score += 10; checks.push('GeoTIFF resolution matches.'); }
    else cautions.push('GeoTIFF resolution differs; review the resampling method.');
  } else cautions.push('No GeoTIFF CRS/bounds validation is available for this pair.');
  if (geo?.warnings?.length) cautions.push(...geo.warnings);

  const metadataVerified = Boolean(firstGeo && secondGeo && firstGeo.crs && firstGeo.crs === secondGeo.crs && JSON.stringify(firstGeo.bounds) === JSON.stringify(secondGeo.bounds));
  const state = metadataVerified && score >= 80 ? 'METADATA VERIFIED' : score >= 45 ? 'REVIEW BEFORE USE' : 'UNVERIFIED PAIR';
  return { score: Math.min(score, 100), state, checks, cautions, metadataVerified };
}

/** Some model responses arrive as a JSON code block despite the API contract.
 * Extract its user-facing text here so raw model protocol is never rendered. */
function getDisplayAnalysis(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const source = value.trim();
  if (!source.startsWith('{') && !source.startsWith('```')) return value;
  try {
    const parsed = JSON.parse(source.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as { analysis?: unknown; clarification?: unknown; status?: unknown };
    if (parsed.status === 'needs_clarification') {
      return typeof parsed.clarification === 'string' ? parsed.clarification : null;
    }
    return typeof parsed.analysis === 'string' ? parsed.analysis : null;
  } catch {
    return null;
  }
}

/** Select a BCP-47 speech language from the script in the returned analysis. */
function languageForSpeech(text: string): string {
  if (/[\u0900-\u097f]/.test(text)) return 'hi-IN'; // Hindi / Marathi
  if (/[\u0980-\u09ff]/.test(text)) return 'bn-IN';
  if (/[\u0a80-\u0aff]/.test(text)) return 'gu-IN';
  if (/[\u0b80-\u0bff]/.test(text)) return 'ta-IN';
  if (/[\u0c00-\u0c7f]/.test(text)) return 'te-IN';
  if (/[\u0d00-\u0d7f]/.test(text)) return 'ml-IN';
  if (/[\u0600-\u06ff]/.test(text)) return 'ur-PK';
  return 'en-IN';
}

function answerForMode(answer: string, mode: 'simple' | 'student' | 'detailed') {
  if (mode === 'detailed') return answer;
  const first = answer.split(/(?<=[.!?])\s+/)[0] || answer;
  return mode === 'simple' ? first : answer.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
}

/**
 * Satellite exports often have far more pixels than a vision model needs. Resize
 * them in the browser so a valid, high-resolution image does not spend most of
 * the request timeout being uploaded or decoded by the provider.
 */
async function prepareImageForAnalysis(file: File): Promise<File> {
  if (file.type === 'image/tiff' || file.type === 'image/tif' || file.type === 'application/geotiff' || /\.geo?ti?ff?$/i.test(file.name)) return file;
  const bitmap = await createImageBitmap(file);
  try {
    if (file.size <= ANALYSIS_MAX_BYTES && Math.max(bitmap.width, bitmap.height) <= ANALYSIS_MAX_DIMENSION) return file;
    const scale = Math.min(1, ANALYSIS_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.76));
    // When dimensions were reduced, use the reduced image even if it happens
    // to be marginally larger than a very efficiently encoded source file.
    // Pixel count is the main contributor to vision-model latency.
    if (!blob) return file;
    const basename = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${basename}-analysis.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

/** Export an actual PDF file, avoiding the popup-dependent print workflow. */
function downloadPdfReport(result: AnalysisResult, query: string) {
  const pdfText = (value: string) => value.replace(/[^\x20-\x7e]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const wrap = (value: string, width = 92) => value.split(/\r?\n/).flatMap((paragraph) => {
    if (!paragraph) return [''];
    const lines: string[] = []; let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (`${line} ${word}`.trim().length > width && line) { lines.push(line); line = word; }
      else line = `${line} ${word}`.trim();
    }
    if (line) lines.push(line);
    return lines;
  });
  const sourceLines = result.reports?.length
    ? ['', 'Incident sources / learn more:', ...result.reports.flatMap((report) => wrap(`${report.date.slice(0, 10)} | ${report.title} | ${report.source}${report.url ? ` | ${report.url}` : ''}`))]
    : [];
  const lines = ['SATQUERY AI ANALYSIS REPORT', '', `Generated: ${result.timestamp}`, `Workflow: ${result.mode || 'optical'}`, `Model: ${result.model}`, '', 'Question:', ...wrap(query), '', 'Findings:', ...wrap(result.analysis), '', 'Limitations:', ...wrap((result.limitations || []).join(' ') || 'No additional limitations returned.'), ...sourceLines];
  const pageLines = 46;
  const pages = Array.from({ length: Math.max(1, Math.ceil(lines.length / pageLines)) }, (_, index) => lines.slice(index * pageLines, (index + 1) * pageLines));
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  pages.forEach((page, index) => {
    const pageId = pageIds[index]; const contentId = pageId + 1;
    const content = `BT\n/F1 10 Tf\n50 790 Td\n14 TL\n${page.map((line) => `(${pdfText(line)}) Tj\nT*`).join('\n')}\nET`;
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url; link.download = `satquery-report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export type AnalysisAoi = { name: string; areaKm2: number; geometry: GeoJSON.Geometry };

export default function SatQueryPanel({ isOpen, onClose, initialMode = 'optical', initialQuery, aoi, onMapEvidence, restoredQrUrl, expertAccess = true, initialExperience }: { isOpen: boolean; onClose: () => void; initialMode?: AnalysisMode; initialQuery?: string; aoi?: AnalysisAoi | null; onMapEvidence?: (evidence: MapEvidence) => void; restoredQrUrl?: string | null; expertAccess?: boolean; initialExperience?: 'simple' | 'expert' }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const comparisonInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | undefined>(undefined);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const resultAudioRef = useRef<HTMLAudioElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [comparisonFile, setComparisonFile] = useState<File | null>(null);
  const [comparisonPreview, setComparisonPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('optical');
  const [query, setQuery] = useState('');
  const [imageSuggestions, setImageSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [responseLanguage, setResponseLanguage] = useState<(typeof RESPONSE_LANGUAGES)[number]['value']>('English');
  const [apiKey, setApiKey] = useState(() => typeof window === 'undefined' ? '' : window.localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [isDragging, setIsDragging] = useState(false);
  const [easyMode, setEasyMode] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [expertFocus, setExpertFocus] = useState<'workspace' | 'evidence'>('workspace');
  const [guidedStage, setGuidedStage] = useState<'welcome' | 'scanning' | 'ready' | 'workspace'>('welcome');
  const [imageNotice, setImageNotice] = useState<{ title: string; message: string; type: 'radar' | 'pair' } | null>(null);
  const [explanationMode, setExplanationMode] = useState<'simple' | 'student' | 'detailed'>('simple');
  const [uploadSharpness, setUploadSharpness] = useState<UploadSharpness | null>(null);
  const [sarConfirmed, setSarConfirmed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredLocation, setDiscoveredLocation] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showQrInfo, setShowQrInfo] = useState(false);
  const [sharedReportUrl, setSharedReportUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [spectralResult, setSpectralResult] = useState<SpectralResult | null>(null);
  const [spectralError, setSpectralError] = useState('');
  const [spectralLoading, setSpectralLoading] = useState(false);
  const [spectralIndex, setSpectralIndex] = useState<'NDVI' | 'NDWI'>('NDVI');
  const [numeratorBand, setNumeratorBand] = useState('');
  const [denominatorBand, setDenominatorBand] = useState('');
  const [feedback, setFeedback] = useState<'confirmed' | 'uncertain' | 'incorrect' | null>(null);
  const [compareSwipe, setCompareSwipe] = useState(50);
  const [watchingAoi, setWatchingAoi] = useState(false);
  const [compareHistoryIds, setCompareHistoryIds] = useState<string[]>([]);
  const [activeEvidenceRecord, setActiveEvidenceRecord] = useState<QrRecord | null>(null);
  const [fieldVerification, setFieldVerification] = useState<Omit<FieldVerification, 'id' | 'createdAt'>>({ recordId: '', status: 'needs-review', verifier: '', observedAt: '', latitude: '', longitude: '', notes: '' });
  const [fieldVerificationMessage, setFieldVerificationMessage] = useState('');
  const [history, setHistory] = useState<Array<{ id: string; createdAt: string; query: string; mode: string; summary: string; pairDifference?: number }>>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(window.localStorage.getItem(HISTORY_STORAGE) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    if (!isOpen || !result) return;
    const savedQr = window.sessionStorage.getItem('satquery.active-qr-report');
    if (savedQr) { setSharedReportUrl(savedQr); setShowQrInfo(true); }
  }, [isOpen, result]);

  useEffect(() => {
    if (isOpen && restoredQrUrl && !result) { setSharedReportUrl(restoredQrUrl); setShowQrInfo(true); }
  }, [isOpen, restoredQrUrl, result]);

  useEffect(() => {
    if (sharedReportUrl) window.sessionStorage.setItem('satquery.active-qr-report', sharedReportUrl);
  }, [sharedReportUrl]);

  useEffect(() => {
    if (!showQrInfo && sharedReportUrl) {
      window.sessionStorage.removeItem('satquery.active-qr-report');
      setSharedReportUrl(null);
      setShareFeedback('');
    }
  }, [showQrInfo, sharedReportUrl]);

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    if (initialQuery) setQuery(initialQuery);
  }, [initialMode, initialQuery, isOpen]);

  // A Simple account must remain in the guided workspace even if the same
  // component is used by Expert users elsewhere in the application.
  useEffect(() => {
    if (!expertAccess) setSimpleMode(true);
  }, [expertAccess]);

  // Entry points choose their intended workspace explicitly. Users can still
  // switch later with the visible SIMPLE / EXPERT control, but an Expert
  // launch must never briefly open the Simple interface first.
  useEffect(() => {
    if (!isOpen || !initialExperience) return;
    setSimpleMode(!expertAccess || initialExperience === 'simple');
    if (initialExperience === 'simple') {
      setMode('optical');
      setSarConfirmed(false);
    }
  }, [expertAccess, initialExperience, isOpen]);

  useEffect(() => { setWatchingAoi(Boolean(aoi && window.localStorage.getItem(`osiris.satquery.watch.${aoi.name}`))); }, [aoi, isOpen]);

  const toggleAoiWatch = () => {
    if (!aoi) return;
    const key = `osiris.satquery.watch.${aoi.name}`;
    if (watchingAoi) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify({ aoi, createdAt: new Date().toISOString(), rule: 'Review every new analysis and escalate pair pixel-difference screens above 20%.' }));
    setWatchingAoi((value) => !value);
  };

  useEffect(() => {
    if (!result || !completedAt) return;
    const item = { id: `${completedAt}-${Math.random()}`, createdAt: completedAt, query, mode: result.mode || mode, summary: result.analysis.slice(0, 180), pairDifference: result.imageDiagnostics?.pairDifference?.flaggedPixelsPercent };
    setHistory((previous) => {
      const next = [item, ...previous].slice(0, 8);
      window.localStorage.setItem(HISTORY_STORAGE, JSON.stringify(next));
      return next;
    });
  // A completed response is the only event that should create a history row.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedAt]);

  const selectFile = async (candidate?: File) => {
    if (!candidate) return;
    if (!ACCEPTED_TYPES.includes(candidate.type) && !/\.geo?ti?ff?$/i.test(candidate.name)) {
      setError('Use a JPG, PNG, WebP, TIFF, or GeoTIFF image.');
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError('Image must be 12 MB or smaller.');
      return;
    }
    setError('');
    setResult(null);
    setCompletedAt(null);
    setImageSuggestions([]);
    setSarConfirmed(false);
    setUploadSharpness({ state: 'checking', note: 'Checking image clarity…' });
    setFile(candidate);
    setGuidedStage('scanning');
    window.setTimeout(() => setGuidedStage('ready'), 1800);
    void screenSharpness(candidate).then(setUploadSharpness);
    if (/\b(sar|radar|sentinel[-_ ]?1|s1|vv|vh)\b/i.test(candidate.name)) {
      setMode('sar'); setSarConfirmed(true);
      setImageNotice({ title: 'RADAR IMAGE DETECTED', message: 'SATQUERY selected the suitable analysis.', type: 'radar' });
    }
    void generateImageSuggestions(candidate);
    if (/\.geo?ti?ff?$/i.test(candidate.name) || candidate.type === 'image/tiff' || candidate.type === 'application/geotiff') setPreview(null);
    else { const reader = new FileReader(); reader.onload = () => setPreview(String(reader.result)); reader.readAsDataURL(candidate); }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => { void selectFile(event.target.files?.[0]); event.target.value = ''; };

  const selectComparisonFile = (candidate?: File) => {
    if (!candidate) return;
    if ((!ACCEPTED_TYPES.includes(candidate.type) && !/\.geo?ti?ff?$/i.test(candidate.name)) || candidate.size > MAX_FILE_SIZE) {
      setError('Use a JPG, PNG, WebP, TIFF, or GeoTIFF comparison image no larger than 12 MB.');
      return;
    }
    setError('');
    setComparisonFile(candidate);
    setCompletedAt(null);
    setImageNotice({ title: 'TWO IMAGES DETECTED', message: 'Would you like to compare these images?', type: 'pair' });
    if (/\.geo?ti?ff?$/i.test(candidate.name) || candidate.type === 'image/tiff' || candidate.type === 'application/geotiff') setComparisonPreview(null);
    else { const reader = new FileReader(); reader.onload = () => setComparisonPreview(String(reader.result)); reader.readAsDataURL(candidate); }
  };

  useEffect(() => () => {
    if (recordingTimerRef.current !== undefined) window.clearTimeout(recordingTimerRef.current);
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    recordingAudioContextRef.current?.close().catch(() => undefined);
    resultAudioRef.current?.pause();
    window.speechSynthesis?.cancel();
  }, []);

  const updateApiKey = (value: string) => {
    setApiKey(value);
    if (value.trim()) window.localStorage.setItem(GEMINI_KEY_STORAGE, value.trim());
    else window.localStorage.removeItem(GEMINI_KEY_STORAGE);
  };

  const generateImageSuggestions = async (image: File) => {
    if (/\.geo?ti?ff?$/i.test(image.name) || /tiff|geotiff/.test(image.type)) return;
    setIsSuggesting(true);
    setImageSuggestions([]);
    try {
      const formData = new FormData();
      formData.append('image', await prepareImageForAnalysis(image));
      const response = await fetch('/api/satquery/suggestions', { method: 'POST', body: formData, headers: apiKey.trim() ? { 'x-gemini-key': apiKey.trim() } : undefined });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Suggestions unavailable');
      if (Array.isArray(payload.suggestions)) setImageSuggestions(payload.suggestions.filter((item: unknown): item is string => typeof item === 'string').slice(0, 4));
    } catch {
      // This is optional guidance: the regular upload and analysis workflow is unchanged.
      setImageSuggestions([]);
    } finally {
      setIsSuggesting(false);
    }
  };

  const discoverImagery = async () => {
    const requestedQuery = query.trim();
    if (!requestedQuery) {
      setError('Enter a place-based question first, for example: “Show flood risk near Guwahati.”');
      return;
    }
    if (!/\b(?:in|near|around|at|for)\s+[\p{L}\d][\p{L}\d\s,.'-]{1,}/iu.test(requestedQuery)) {
      setError('To find imagery, add a place to your question — for example: “Identify visible flooding near Guwahati, Assam.” You can upload an image for a question without a location.');
      return;
    }
    setIsDiscovering(true);
    setError('');
    try {
      const response = await fetch(`/api/satquery/discover?query=${encodeURIComponent(requestedQuery)}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Automatic imagery needs a city, district, or landmark. Add one to your question, or upload an image for a general analysis.');
      }
      const place = response.headers.get('x-satquery-location') || 'the requested area';
      const image = await response.blob();
      if (!image.size) throw new Error('The imagery provider returned an empty image. Please try again.');
      const safeName = place.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'area';
      selectFile(new File([image], `${safeName}-satellite.jpg`, { type: image.type || 'image/jpeg', lastModified: Date.now() }));
      setDiscoveredLocation(place);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'SATQUERY could not discover imagery right now.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const startVoiceQuery = async () => {
    if (recorderRef.current?.state === 'recording' || isTranscribing) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access requires a secure connection. Open the app through HTTPS or localhost, then try again.');
      return;
    }
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onerror = () => { setIsListening(false); setError('Microphone recording failed. Check that no other app is using the microphone.'); };
      recorder.onstop = async () => {
        if (recordingTimerRef.current !== undefined) window.clearTimeout(recordingTimerRef.current);
        setIsListening(false);
        stream.getTracks().forEach((track) => track.stop());
        recordingAudioContextRef.current?.close().catch(() => undefined);
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) { setError('No audio was recorded. Check microphone permission and try again.'); return; }
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', new File([blob], 'voice-query.webm', { type: blob.type || 'audio/webm' }));
          formData.append('sourceLanguage', BHASHINI_LANGUAGE_CODES[responseLanguage]);
          const response = await fetch('/api/satquery/transcribe', { method: 'POST', body: formData });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || 'Offline voice transcription could not be completed.');
          const transcript = typeof payload.transcript === 'string' ? payload.transcript.trim() : '';
          if (!transcript) throw new Error('No speech was detected. Please try again.');
          setQuery((current) => `${current}${current ? ' ' : ''}${transcript}`);
          // Voice input is dictation: leave the recognized words in the
          // question box so the user can review or edit them before asking.
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Offline voice transcription could not be completed.');
        } finally {
          setIsTranscribing(false);
        }
      };
      // Push-to-talk has one safety deadline in case a pointer-up event is
      // missed by the browser. Releasing the mic button stops it immediately.
      const audioContext = new AudioContext();
      recordingAudioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const startedAt = Date.now();
      const enforceMaximumDuration = () => {
        if (recorder.state !== 'recording') return;
        analyser.getByteTimeDomainData(samples);
        if (Date.now() - startedAt > 30_000) recorder.stop();
        else recordingTimerRef.current = window.setTimeout(enforceMaximumDuration, 120);
      };
      setIsListening(true);
      recorder.start();
      recordingTimerRef.current = window.setTimeout(enforceMaximumDuration, 120);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : '';
      setError(name === 'NotAllowedError' ? 'Microphone access was denied. Allow microphone permission in your browser, then try again.' : name === 'NotFoundError' ? 'No microphone was found. Connect a microphone and try again.' : 'Microphone access could not be started. Check browser permissions and try again.');
    }
  };

  const toggleResultAudio = () => {
    if (!result) return;
    const synth = window.speechSynthesis;
    if (isSpeaking) { resultAudioRef.current?.pause(); resultAudioRef.current = null; synth?.cancel(); setIsSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(result.analysis);
    const resultLanguage = result.responseLanguage || responseLanguage;
    const language = RESPONSE_LANGUAGES.find((item) => item.value === resultLanguage)?.speech || languageForSpeech(result.analysis);
    const voices = synth?.getVoices() || [];
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase())
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
    // Use Gemini TTS when no matching local voice exists. This keeps Hindi and
    // other supported scripts audible on devices without Windows voices.
    if (language !== 'en-IN' && !matchingVoice) {
      setIsSpeaking(true);
      void fetch('/api/satquery/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey.trim() ? { 'x-gemini-key': apiKey.trim() } : {}) },
        body: JSON.stringify({ text: result.analysis, language }),
      }).then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'Gemini speech generation was unavailable.');
        }
        const url = URL.createObjectURL(await response.blob());
        const audio = new Audio(url);
        resultAudioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); if (resultAudioRef.current === audio) { resultAudioRef.current = null; setIsSpeaking(false); } };
        audio.onerror = () => { URL.revokeObjectURL(url); if (resultAudioRef.current === audio) { resultAudioRef.current = null; setIsSpeaking(false); setError('Hindi audio could not be played. Please try again.'); } };
        await audio.play();
      }).catch((cause) => { resultAudioRef.current = null; setIsSpeaking(false); setError(cause instanceof Error ? cause.message : 'Gemini speech generation could not be completed.'); });
      return;
    }
    if (!synth) { setError('Audio playback is not supported by this browser.'); return; }
    // Browsers may populate voices asynchronously on the first playback.
    // Give that initialization a moment before choosing the voice.
    const speak = () => {
      const voices = synth.getVoices();
      const matchingVoice = voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase())
        || voices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
      const fallbackVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) || voices[0];
      const selectedVoice = matchingVoice || fallbackVoice;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        // A browser can silently refuse a Hindi/Tamil utterance assigned to an
        // English-only voice. Use the selected voice's locale for the fallback
        // so audio still plays; native pronunciation needs that language voice.
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = language;
      }
      synth.resume();
      synth.speak(utterance);
    };
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => { setIsSpeaking(false); setError(`Audio playback could not be completed. Install or enable a ${language} text-to-speech voice in your browser or Windows speech settings, then try again.`); };
    synth.cancel();
    setIsSpeaking(true);
    // Chrome can ignore speak() when it immediately follows cancel(). Queue it
    // in the next task and resume any browser-paused speech engine first.
    window.setTimeout(speak, 150);
  };
  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setCompletedAt(null);
    setImageSuggestions([]);
    setUploadSharpness(null);
    setSarConfirmed(false);
    setGuidedStage('welcome');
    if (inputRef.current) inputRef.current.value = '';
  };

  const clearComparisonFile = () => {
    setComparisonFile(null);
    setComparisonPreview(null);
    setCompletedAt(null);
    if (comparisonInputRef.current) comparisonInputRef.current.value = '';
  };

  const computeSpectralIndex = async () => {
    if (!file) return;
    if (!numeratorBand || !denominatorBand) {
      setSpectralError('Enter the two band numbers from the image metadata first. NDVI normally uses NIR and red; NDWI normally uses green and NIR.');
      return;
    }
    setSpectralLoading(true); setSpectralError(''); setSpectralResult(null);
    try {
      const form = new FormData();
      form.append('image', file); form.append('index', spectralIndex);
      form.append('numeratorBand', numeratorBand); form.append('denominatorBand', denominatorBand);
      const response = await fetch('/api/satquery/spectral-index', { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Spectral index calculation failed.');
      setSpectralResult(payload as SpectralResult);
    } catch (cause) { setSpectralError(cause instanceof Error ? cause.message : 'Spectral index calculation failed.'); }
    finally { setSpectralLoading(false); }
  };

  const analyze = async (spokenQuery?: string) => {
    const submittedQuery = (typeof spokenQuery === 'string' ? spokenQuery : query).trim();
    if (!submittedQuery) {
      setError('Add a question for the analyst.');
      return;
    }
    if (file && (mode === 'optical-sar' || mode === 'bi-temporal') && !comparisonFile) {
      setError(mode === 'optical-sar' ? 'Add the paired SAR or optical image for fusion.' : 'Add the second-date image for change analysis.');
      return;
    }
    if (!file && mode !== 'optical') {
      setError('Text-only queries fetch one original optical satellite image. Choose OPTICAL, or upload the image pair needed for this mode.');
      return;
    }
    if (file && uploadSharpness?.state === 'blocked') {
      setError(uploadSharpness.note);
      return;
    }
    if ((mode === 'sar' || mode === 'optical-sar') && !sarConfirmed) {
      setError(mode === 'sar' ? 'Confirm that this upload is a SAR/radar image before analysis.' : 'Confirm that Input B is the matched SAR/radar image before fusion analysis.');
      return;
    }
    setIsAnalyzing(true);
    setError('');
    setResult(null);
    setCompletedAt(null);
    let controller: AbortController | undefined;
    let timeout: number | undefined;
    try {
      if (!file) {
        // Retrieve live incident records in parallel with the imagery workflow.
        // A source lookup must never prevent an image analysis from completing.
        const incidentSources = fetch('/api/disaster-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(apiKey.trim() ? { 'x-gemini-key': apiKey.trim() } : {}) },
          body: JSON.stringify({ query: submittedQuery, responseLanguage }),
        }).then(async (response) => response.ok ? await response.json() as { reports?: AnalysisResult['reports'] } : null).catch(() => null);
        const imageryResponse = await fetch(`/api/satquery/discover?query=${encodeURIComponent(submittedQuery)}`);
        if (!imageryResponse.ok) {
          const payload = await imageryResponse.json().catch(() => ({}));
          throw new Error(payload.error || 'Add a city, district, or landmark so SATQUERY can retrieve original satellite imagery.');
        }
        const place = imageryResponse.headers.get('x-satquery-location') || 'the requested area';
        const imagery = await imageryResponse.blob();
        if (!imagery.size) throw new Error('The imagery provider returned an empty image. Please try again.');
        const safeName = place.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'area';
        const fetchedImage = new File([imagery], `${safeName}-esri-world-imagery.jpg`, { type: imagery.type || 'image/jpeg', lastModified: Date.now() });
        selectFile(fetchedImage);
        setDiscoveredLocation(place);
        const analysisImage = await prepareImageForAnalysis(fetchedImage);
        const formData = new FormData();
        formData.append('image', analysisImage);
        formData.append('query', submittedQuery);
        formData.append('imageLastModified', new Date(fetchedImage.lastModified).toISOString());
        formData.append('mode', 'optical');
        formData.append('responseLanguage', responseLanguage);
        if (aoi) formData.append('areaOfInterest', JSON.stringify(aoi));
        controller = new AbortController();
        timeout = window.setTimeout(() => controller?.abort(), ANALYSIS_REQUEST_TIMEOUT_MS);
        const response = await fetch('/api/satquery/analyze', { method: 'POST', body: formData, headers: apiKey.trim() ? { 'x-gemini-key': apiKey.trim() } : undefined, signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'The satellite-image analysis could not be completed.');
        const displayAnalysis = getDisplayAnalysis(payload.analysis);
        if (!displayAnalysis) throw new Error('SATQUERY could not interpret the satellite-image analysis response.');
        const incidentPayload = await incidentSources;
        setResult({ ...payload, analysis: displayAnalysis, reports: incidentPayload?.reports || [], incidentSearch: true, limitations: [...(payload.limitations || []), `Original imagery was retrieved for ${place} from Esri World Imagery. Image date and sensor metadata were not supplied by this basemap export.`] });
        setCompletedAt(new Date().toISOString());
        return;
      }
      const analysisImage = await prepareImageForAnalysis(file);
      const analysisComparison = comparisonFile ? await prepareImageForAnalysis(comparisonFile) : null;
      const formData = new FormData();
      formData.append('image', analysisImage);
      formData.append('query', submittedQuery);
      formData.append('imageLastModified', new Date(file.lastModified).toISOString());
      formData.append('mode', mode);
      formData.append('responseLanguage', responseLanguage);
      formData.append('locationSourceImage', file);
      if (aoi) formData.append('areaOfInterest', JSON.stringify(aoi));
      if (analysisComparison) formData.append('comparisonImage', analysisComparison);
      // Start the deadline only after local image preparation. Large images
      // could otherwise consume most of the request window before uploading.
      controller = new AbortController();
      timeout = window.setTimeout(() => controller?.abort(), ANALYSIS_REQUEST_TIMEOUT_MS);
      const response = await fetch('/api/satquery/analyze', {
        method: 'POST',
        body: formData,
        headers: apiKey.trim() ? { 'x-gemini-key': apiKey.trim() } : undefined,
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The analysis could not be completed.');
      const displayAnalysis = getDisplayAnalysis(payload.analysis);
      if (!displayAnalysis) throw new Error('I could not understand that query. Please ask a clear question about the satellite image, for example: “Identify flooded areas and describe the visible evidence.”');
      setResult({ ...payload, analysis: displayAnalysis });
      setCompletedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === 'AbortError' ? 'Gemini did not respond in time. The image was already optimized; check your Gemini quota or try again shortly.' : cause instanceof Error ? cause.message : 'The analysis could not be completed.');
    } finally {
      if (timeout !== undefined) window.clearTimeout(timeout);
      setIsAnalyzing(false);
    }
  };

  const openQrInfo = async () => {
    if (!result) return;
    setShowQrInfo(true);
    setShareLoading(true);
    setSharedReportUrl(null);
    setShareFeedback('');
    try {
      const formData = new FormData();
      formData.append('analysis', result.analysis); formData.append('question', query);
      formData.append('confidence', result.decisionSupport?.confidence || 'medium');
      formData.append('limitations', JSON.stringify(result.limitations || []));
      if (file) formData.append('image', await prepareImageForAnalysis(file));
      const [shareResponse, originResponse] = await Promise.all([fetch('/api/satquery/share', { method: 'POST', body: formData }), fetch('/api/satquery/share-origin')]);
      const share = await shareResponse.json(); const origin = await originResponse.json();
      if (!shareResponse.ok) throw new Error(share.error || 'The disaster report could not be shared.');
      if (!originResponse.ok || typeof origin.origin !== 'string') throw new Error('A shareable address is unavailable. Configure SATQUERY_PUBLIC_URL for deployment or connect the phone to the same Wi-Fi.');
      setSharedReportUrl(`${origin.origin}${share.path}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The disaster QR report could not be generated.'); }
    finally { setShareLoading(false); }
  };
  const copyShareLink = async () => {
    if (!sharedReportUrl) return;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(sharedReportUrl);
      else {
        const helper = document.createElement('textarea');
        helper.value = sharedReportUrl;
        helper.setAttribute('readonly', '');
        helper.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(helper);
        helper.select();
        const copied = document.execCommand('copy');
        helper.remove();
        if (!copied) throw new Error('Copy failed');
      }
      setShareFeedback('LINK COPIED — PASTE IT IN WHATSAPP, EMAIL, OR ANY APP.');
    } catch { setShareFeedback('COPY WAS BLOCKED BY THIS BROWSER. OPEN REPORT, THEN COPY THE ADDRESS BAR LINK.'); }
  };
  const shareReport = async () => {
    if (!sharedReportUrl) return;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'SATQUERY AI Disaster Report', text: 'View this satellite-image disaster analysis.', url: sharedReportUrl }); setShareFeedback('SHARE OPTIONS OPENED.'); return; }
      catch { /* Some LAN HTTP browsers block Web Share; copy below instead. */ }
    }
    await copyShareLink();
  };
  const downloadQr = async () => {
    if (!sharedReportUrl) return;
    try {
      const response = await fetch(`https://quickchart.io/qr?size=900&margin=2&ecLevel=M&text=${encodeURIComponent(sharedReportUrl)}`);
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = 'satquery-disaster-qr.png'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('The QR image could not be downloaded. You can still scan it directly from this screen.'); }
  };

  const openEvidenceQr = (record: QrRecord) => {
    setActiveEvidenceRecord(record);
    setFieldVerification((current) => ({ ...current, recordId: record.id }));
    setFieldVerificationMessage('');
  };

  const saveFieldVerification = () => {
    if (!activeEvidenceRecord || !fieldVerification.verifier.trim() || !fieldVerification.notes.trim()) {
      setFieldVerificationMessage('Enter verifier name and field notes before saving.');
      return;
    }
    const entry: FieldVerification = { ...fieldVerification, id: `${activeEvidenceRecord.id}-${Date.now()}`, createdAt: new Date().toISOString() };
    try {
      const existing = JSON.parse(window.localStorage.getItem(FIELD_VERIFICATION_STORAGE) || '[]');
      const values = Array.isArray(existing) ? existing : [];
      window.localStorage.setItem(FIELD_VERIFICATION_STORAGE, JSON.stringify([entry, ...values].slice(0, 50)));
      setFieldVerificationMessage(`Field verification saved locally for ${activeEvidenceRecord.id}.`);
      setFieldVerification((current) => ({ ...current, verifier: '', notes: '', latitude: '', longitude: '', observedAt: '' }));
    } catch { setFieldVerificationMessage('This browser could not save the field verification locally.'); }
  };

  const activePairTrust = result ? pairTrust(result, mode) : null;
  const expertSystemStatus = isAnalyzing ? 'ANALYZING' : isListening ? 'LISTENING' : isTranscribing ? 'TRANSCRIBING' : 'SYSTEM ONLINE';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[1100] flex items-center justify-center p-1.5 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-[#02060b]/80 backdrop-blur-sm" aria-label="Close SATQUERY AI" onClick={onClose} />
          <motion.section
            role="dialog" aria-modal="true" aria-labelledby="satquery-title"
            initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ type: 'spring', stiffness: 260, damping: 25 }}
            className="satquery-panel relative max-h-[calc(100dvh-0.75rem)] w-full max-w-5xl overflow-y-auto border border-[var(--border-primary)] bg-[#070b12]/95 shadow-[0_0_70px_rgba(0,229,255,0.12)] sm:max-h-[92vh]"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-primary)] bg-[#090e17]/95 px-4 py-3 backdrop-blur-md sm:px-6">
              <div className="flex items-center gap-3">
                <motion.div animate={{ boxShadow: ['0 0 0 rgba(0,229,255,0)', '0 0 18px rgba(0,229,255,0.45)', '0 0 0 rgba(0,229,255,0)'] }} transition={{ duration: 2.4, repeat: Infinity }} className={`satquery-mark flex h-8 w-8 items-center justify-center rounded border border-cyan-300/50 bg-cyan-400/10 ${!simpleMode ? 'satquery-mark--expert' : ''}`}>
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                </motion.div>
                <div>
                  <h2 id="satquery-title" className="font-mono text-xs font-bold tracking-[0.22em] text-[#d4af37]">SATQUERY AI</h2>
                  <p className="mt-0.5 font-mono text-[9px] tracking-[0.14em] text-[var(--text-muted)]">{simpleMode ? 'SATELLITE ANALYSIS + INTELLIGENCE ASSISTANT' : 'EARTH OBSERVATION RESEARCH CONSOLE'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5"><div className="flex rounded border border-white/15 p-0.5 font-mono text-[8px] tracking-wider"><button type="button" onClick={() => expertAccess ? window.location.assign('/analysis') : setSimpleMode(true)} className={`rounded px-2 py-1 ${simpleMode ? 'bg-cyan-300/15 text-cyan-100' : 'text-white/45'}`}>SIMPLE</button>{expertAccess && <button type="button" onClick={() => setSimpleMode(false)} className={`rounded px-2 py-1 ${!simpleMode ? 'bg-cyan-300/15 text-cyan-100' : 'text-white/45'}`}>EXPERT</button>}</div><button type="button" onClick={() => setEasyMode((value) => !value)} className={`rounded border px-2 py-1.5 font-mono text-[8px] tracking-wider ${easyMode ? 'border-cyan-300/70 bg-cyan-300/15 text-cyan-100' : 'border-white/20 text-white/60'}`}>♿</button><button onClick={onClose} className="rounded p-1.5 text-[var(--text-muted)] transition-colors hover:bg-white/10 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button></div>
            </div>

            <div className={`p-4 sm:p-6 ${!simpleMode ? 'satquery-expert-console' : ''} ${easyMode ? 'text-base [&_button]:min-h-11 [&_button]:text-[11px]' : ''}`}>
              {simpleMode && guidedStage !== 'workspace' ? (
                <section className="mx-auto max-w-3xl py-2 text-center">
                  <input ref={inputRef} onChange={onFileChange} accept="image/*,.tif,.tiff,.geotiff" capture="environment" type="file" className="hidden" />
                  {guidedStage === 'welcome' && <>
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-[radial-gradient(circle_at_50%_15%,rgba(0,229,255,0.16),transparent_32%),linear-gradient(145deg,rgba(11,25,41,0.95),rgba(3,7,14,0.96))] px-5 py-10 sm:px-12">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }} className="absolute left-1/2 top-1/2 h-72 w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/15" />
                      <motion.div animate={{ y: [-6, 6, -6], rotate: [-4, 4, -4] }} transition={{ duration: 4, repeat: Infinity }} className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#d4af37]/70 bg-[#d4af37]/10 text-4xl shadow-[0_0_35px_rgba(212,175,55,0.35)]">🛰️</motion.div>
                      <p className="relative mt-6 font-mono text-[10px] tracking-[0.28em] text-[#d4af37]">SATQUERY AI</p>
                      <h3 className="relative mt-3 font-mono text-xl font-bold tracking-wide text-white sm:text-2xl">WHAT DO YOU WANT TO ANALYZE?</h3>
                      <p className="relative mx-auto mt-3 max-w-md text-sm leading-6 text-white/65">Just upload your image. SATQUERY AI will help choose the right way to understand it.</p>
                      <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} className={`relative mt-8 flex min-h-56 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${isDragging ? 'border-cyan-300 bg-cyan-300/15 scale-[1.01]' : 'border-cyan-300/45 bg-black/30 hover:border-[#d4af37]/80 hover:bg-[#d4af37]/[0.06]'}`}>
                        <span className="text-4xl">📷</span><span className="mt-3 font-mono text-sm font-bold tracking-[0.16em] text-white">DROP YOUR IMAGE HERE</span><span className="mt-2 font-mono text-[9px] tracking-wider text-white/45">OR TAP TO UPLOAD / USE YOUR CAMERA</span>
                        <span className="mt-4 rounded border border-[#d4af37]/50 bg-[#d4af37]/10 px-4 py-2 font-mono text-[9px] tracking-widest text-[#f4d889]">UPLOAD OR TAKE A PHOTO</span>
                      </button>
                      <button type="button" onPointerDown={(event) => { event.preventDefault(); void startVoiceQuery(); }} onPointerUp={() => recorderRef.current?.stop()} className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 px-5 py-3 font-mono text-[9px] tracking-widest text-cyan-100 transition hover:bg-cyan-300/10"><Mic className="h-4 w-4" /> TAP & HOLD TO SPEAK</button>
                      <p className="relative mt-4 font-mono text-[8px] text-white/35">JPG · PNG · WEBP · TIFF · GEOTIFF · UP TO 12 MB</p>
                    </motion.div>
                    <p className="mt-5 font-mono text-[9px] tracking-wider text-white/45">UPLOAD → ASK → UNDERSTAND</p>
                  </>}
                  {guidedStage === 'scanning' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-2xl border border-cyan-300/35 bg-[#06111d] p-6 sm:p-10"><p className="font-mono text-[10px] tracking-[0.25em] text-[#d4af37]">SATQUERY AI</p><h3 className="mt-3 font-mono text-xl font-bold tracking-wide text-white">UNDERSTANDING YOUR IMAGE</h3><div className="relative mx-auto mt-7 h-56 max-w-lg overflow-hidden rounded-lg border border-cyan-300/30 bg-black">{preview ? <img src={preview} alt="Uploaded image being prepared" className="h-full w-full object-contain opacity-65" /> : <div className="flex h-full items-center justify-center text-5xl">🛰️</div>}<motion.div initial={{ top: '-15%' }} animate={{ top: '105%' }} transition={{ duration: 1.3, repeat: Infinity, ease: 'linear' }} className="absolute left-0 right-0 h-1 bg-cyan-200 shadow-[0_0_24px_rgba(0,229,255,1)]" /></div><div className="mx-auto mt-6 grid max-w-md grid-cols-4 gap-1 font-mono text-[8px] tracking-wider text-cyan-100"><span>✓ RECEIVED</span><span className="animate-pulse">⌕ CHECKING</span><span className="text-white/35">◌ MATCHING</span><span className="text-white/35">◌ READY</span></div><p className="mt-5 text-sm text-white/55">Preparing the right analysis for you…</p></motion.div>}
                  {guidedStage === 'ready' && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-cyan-300/35 bg-[radial-gradient(circle_at_50%_0%,rgba(0,229,255,0.13),transparent_48%),#07101a] p-6 sm:p-10"><div className="text-4xl">🛰️</div><p className="mt-3 font-mono text-[10px] tracking-[0.22em] text-[#d4af37]">IMAGE READY</p><h3 className="mt-3 font-mono text-xl font-bold text-white">YOU&apos;RE READY!</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/65">Your image is ready for SATQUERY. Choose what you would like to know next.</p><button type="button" onClick={() => setGuidedStage('workspace')} className="mt-6 rounded border border-[#d4af37]/70 bg-[#d4af37]/15 px-6 py-3 font-mono text-[10px] font-bold tracking-[0.16em] text-[#f4d889] transition hover:bg-[#d4af37]/25">CONTINUE</button><details className="mx-auto mt-6 max-w-xl text-left"><summary className="cursor-pointer font-mono text-[9px] tracking-widest text-cyan-100">NOT SURE WHAT KIND OF IMAGE THIS IS?</summary><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => { setMode('optical'); setGuidedStage('workspace'); }} className="rounded border border-white/15 bg-white/[0.03] p-3 text-left hover:border-cyan-300/60"><span className="text-2xl">📷</span><span className="mt-2 block font-mono text-[9px] text-white">COLOUR IMAGE</span><span className="mt-1 block font-mono text-[8px] text-white/45">This looks like mine</span></button><button type="button" onClick={() => { setMode('sar'); setSarConfirmed(true); setGuidedStage('workspace'); }} className="rounded border border-white/15 bg-white/[0.03] p-3 text-left hover:border-cyan-300/60"><span className="text-2xl">📡</span><span className="mt-2 block font-mono text-[9px] text-white">DARK / GREY IMAGE</span><span className="mt-1 block font-mono text-[8px] text-white/45">This looks like mine</span></button></div></details></motion.div>}
                </section>
              ) : <>
                {simpleMode ? <div className="mb-5 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.05] p-4 text-center"><p className="text-sm font-bold text-white">Start with an image, then ask a question.</p><p className="mt-1 text-sm leading-6 text-white/65">We will explain what we can see in simple words.</p></div> : <div className="satquery-workflow-rail mb-5 grid grid-cols-3 gap-2 font-mono text-[8px] tracking-widest text-[var(--text-muted)] sm:flex sm:items-center sm:gap-3">
                {['IMAGE INPUT', 'ANALYSIS TYPE', 'EVIDENCE'].map((label, index) => <div key={label} className={`satquery-workflow-step flex items-center gap-2 ${index === 0 && file || index === 1 && mode ? 'is-active' : ''}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${index === 0 && file ? 'border-cyan-300 bg-cyan-300/15 text-cyan-200' : 'border-white/20 text-white/50'}`}>{index === 0 && file ? '✓' : index + 1}</span><span>{label}</span>{index < 2 && <span className="hidden h-px w-7 bg-white/15 sm:inline" />}</div>)}
              </div>}

              {simpleMode ? <div className="mb-5"><p className="mb-2 text-sm leading-6 text-white/60">{expertAccess ? 'Choose the kind of image you have. If you are unsure, select “Look at one image”.' : 'You only need one normal satellite, drone, or aerial image. Upload it below, then choose a suggested question.'}</p><div className="grid gap-2 sm:grid-cols-2">{([['optical', '📷', 'Look at one image', 'Use this for a normal satellite or aerial image.'], ['sar', '☁️', 'Look through clouds', 'Use this if you have a radar image.'], ['bi-temporal', '🔄', 'Compare two images', 'Find what changed between an earlier and a newer image.'], ['optical-sar', '🛰️', 'Use two kinds of images', 'Use this only when you have both a normal image and a radar image.']] as const).filter(([value]) => expertAccess || value === 'optical').map(([value, icon, label, detail]) => <button key={value} type="button" onClick={() => setMode(value)} className={`min-h-24 rounded-xl border p-4 text-left transition ${mode === value ? 'border-cyan-300/70 bg-cyan-300/10' : 'border-white/15 bg-white/[0.02] hover:border-cyan-300/45'}`}><span className="block text-2xl">{icon}</span><span className="mt-2 block text-sm font-bold text-white">{label}</span><span className="mt-1 block text-sm leading-5 text-white/60">{detail}</span></button>)}</div></div> : <section className="satquery-expert-hero relative mb-5 overflow-hidden rounded-xl border border-cyan-300/25 p-5 sm:p-6">
                <div className="satquery-expert-grid absolute inset-0 opacity-50" />
                <div className="relative flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#f4d889]">EXPERT RESEARCH ENVIRONMENT</p><h3 className="mt-2 font-mono text-lg font-bold tracking-wide text-white">FROM ACQUISITION TO DEFENSIBLE EVIDENCE</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">Select a sensor workflow, attach source imagery, define the analytical question, and retain source context for review.</p></div><div className="flex flex-wrap items-center justify-end gap-2 font-mono text-[8px] tracking-wider"><span className={`satquery-expert-system ${isAnalyzing || isListening || isTranscribing ? 'is-busy' : ''}`}><i />{expertSystemStatus}</span><button type="button" onClick={() => { setExpertFocus('workspace'); inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); inputRef.current?.click(); }} className={`rounded border px-2 py-1 transition ${expertFocus === 'workspace' ? 'border-cyan-300/55 bg-cyan-300/[0.14] text-cyan-100' : 'border-cyan-300/25 bg-cyan-300/[0.04] text-white/55 hover:border-cyan-300/55'}`}>LIVE WORKSPACE</button><button type="button" onClick={() => { setExpertFocus('evidence'); setQuery('Identify visible evidence, uncertainty, likely alternatives, and the validation data needed before drawing a conclusion.'); document.getElementById('satquery-question')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); window.setTimeout(() => document.getElementById('satquery-question')?.focus(), 350); }} className={`rounded border px-2 py-1 transition ${expertFocus === 'evidence' ? 'border-[#d4af37]/65 bg-[#d4af37]/[0.14] text-[#f4d889]' : 'border-[#d4af37]/25 bg-[#d4af37]/[0.04] text-white/55 hover:border-[#d4af37]/60'}`}>EVIDENCE-FIRST</button></div></div>
                <div className="relative mt-5 grid gap-2 sm:grid-cols-4">
                  {([['optical', 'OPTICAL / MULTISPECTRAL', 'Single-date visual interpretation'], ['sar', 'SAR / RADAR', 'All-weather radar acquisition'], ['bi-temporal', 'BI-TEMPORAL CHANGE', 'Co-registered before / after pair'], ['optical-sar', 'OPTICAL–SAR FUSION', 'Matched complementary sensors']] as const).map(([value, label, detail], index) => <button key={value} type="button" onClick={() => setMode(value)} className={`satquery-sensor-module rounded border px-3 py-2.5 text-left transition-colors ${mode === value ? 'is-selected border-cyan-300/70 bg-cyan-300/10 text-cyan-100' : 'border-white/15 text-white/55 hover:border-white/35'}`}><span className="satquery-sensor-id">0{index + 1} · READY</span><span className="mt-2 block font-mono text-[9px] font-bold tracking-wider">{label}</span><span className="mt-1 block font-mono text-[8px] leading-relaxed text-white/45">{detail}</span></button>)}
                </div>
              </section>}
              <div className={`grid gap-5 lg:grid-cols-[0.9fr_1.1fr] ${!simpleMode ? 'satquery-mission-workspace' : ''}`}>
                <div className={!simpleMode ? 'satquery-acquisition-bay' : ''}>
                  <input ref={inputRef} onChange={onFileChange} accept="image/*,.tif,.tiff,.geotiff" capture="environment" type="file" className="hidden" />
                  {!file ? (
                    <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} className={`satquery-upload-zone flex min-h-64 w-full flex-col items-center justify-center rounded border border-dashed p-6 transition-all ${isDragging ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/20 bg-white/[0.025] hover:border-[#d4af37]/70 hover:bg-[#d4af37]/5'}`}>
                      <ImagePlus className="mb-3 h-8 w-8 text-[#d4af37]" /><span className="font-mono text-xs tracking-widest text-white">UPLOAD YOUR IMAGE</span><span className="mt-2 font-mono text-[9px] text-[var(--text-muted)]">DROP AN IMAGE HERE OR CLICK TO BROWSE</span><span className="mt-3 font-mono text-[8px] text-white/35">JPG · PNG · WEBP · TIFF · GEOTIFF · MAX 12 MB</span>
                    </button>
                  ) : (
                    <div className="satquery-image-viewport relative overflow-hidden rounded border border-cyan-300/30 bg-black">{preview ? <img src={preview} alt="Satellite image selected for analysis" className="h-64 w-full object-contain" /> : <div className="flex h-64 flex-col items-center justify-center font-mono text-[10px] text-cyan-100"><FileImage className="mb-3 h-8 w-8" />TIFF / GEOTIFF READY FOR ANALYSIS</div>}<div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/75 px-3 py-2 font-mono text-[9px] text-white"><span className="flex min-w-0 items-center gap-1.5 truncate"><FileImage className="h-3.5 w-3.5 text-cyan-300" />{file?.name}</span><button onClick={clearFile} className="ml-2 text-[#ff8b78] hover:text-white">REMOVE</button></div></div>
                  )}
                  {file && uploadSharpness && <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 0, y: 0 }} className={`mt-3 overflow-hidden rounded-2xl border ${uploadSharpness.state === 'ready' ? 'border-cyan-300/45 bg-[#071827]' : uploadSharpness.state === 'blocked' ? 'border-[#ff8b78]/45 bg-[#1c0c12]' : 'border-[#ffcf87]/45 bg-[#20190b]'}`}><div className="p-4"><div className="flex flex-wrap items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/10 text-xl">{uploadSharpness.state === 'ready' ? '✦' : '◌'}</span><div className="min-w-0 flex-1"><p className="text-base font-bold text-white">{uploadSharpness.state === 'ready' ? 'Your image is ready' : 'We are checking your image'}</p><p className="mt-1 text-sm leading-5 text-white/60">{uploadSharpness.state === 'ready' ? 'The image is clear enough to explore. Choose a question below.' : 'This only takes a moment. We are checking whether the details are clear enough.'}</p></div><button type="button" onClick={() => setQuery('Give me a simple overview of this image.')} className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-[#03131b] transition hover:scale-[1.03]">Explain this image</button></div></div><div className="grid gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3">{([['👁️', 'What can you see?', 'Give me a simple overview of this image.'], ['🧭', 'What changed?', 'What changed or needs attention in this image?'], ['✓', 'What should I do next?', 'What should I check next?']] as const).map(([icon, label, prompt]) => <button key={label} type="button" onClick={() => setQuery(prompt)} className="flex min-h-16 items-center justify-center gap-2 bg-[#071827] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-cyan-300/10 hover:text-cyan-100"><span className="text-lg">{icon}</span>{label}</button>)}</div></motion.section>}
                  {imageNotice && <div className="mt-3 border border-cyan-300/35 bg-cyan-300/[0.06] p-3"><p className="font-mono text-[9px] tracking-widest text-cyan-100">{imageNotice.title}</p><p className="mt-1 font-mono text-[9px] text-white/65">{imageNotice.message}</p><div className="mt-3 flex gap-2">{imageNotice.type === 'pair' && <button type="button" onClick={() => { setMode('bi-temporal'); setImageNotice(null); }} className="border border-cyan-300/50 px-2 py-1.5 font-mono text-[8px] text-cyan-100">YES, COMPARE</button>}<button type="button" onClick={() => setImageNotice(null)} className="border border-white/20 px-2 py-1.5 font-mono text-[8px] text-white/65">CONTINUE</button></div></div>}
                  {(mode === 'optical-sar' || mode === 'bi-temporal') && <div className="mt-3"><input ref={comparisonInputRef} onChange={(event) => selectComparisonFile(event.target.files?.[0])} accept={ACCEPTED_TYPES.join(',')} type="file" className="hidden" />{comparisonPreview ? <div className="relative overflow-hidden rounded border border-cyan-300/30 bg-black"><img src={comparisonPreview} alt="Comparison image selected for analysis" className="h-36 w-full object-contain" /><span className="absolute left-2 top-2 bg-black/75 px-2 py-1 font-mono text-[8px] text-cyan-100">{mode === 'bi-temporal' ? `DATE B · ${fileDate(comparisonFile)}` : 'INPUT B'}</span><button onClick={clearComparisonFile} className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 font-mono text-[8px] text-[#ff9c8c]">REMOVE PAIR</button></div> : <button type="button" onClick={() => comparisonInputRef.current?.click()} className="flex h-24 w-full items-center justify-center gap-2 rounded border border-dashed border-cyan-300/35 bg-cyan-300/[0.03] font-mono text-[9px] tracking-wider text-cyan-100 hover:bg-cyan-300/[0.08]"><ImagePlus className="h-4 w-4" />{mode === 'optical-sar' ? 'ADD MATCHED OPTICAL / SAR IMAGE' : 'ADD SECOND-DATE IMAGE'}</button>}{mode === 'bi-temporal' && <p className="mt-2 flex items-center gap-1.5 font-mono text-[8px] text-white/45"><CalendarClock className="h-3 w-3 text-cyan-200" />DATE A {fileDate(file)} · DATE B {fileDate(comparisonFile)}</p>}</div>}
                  {file && (mode === 'sar' || mode === 'optical-sar') && <label className="mt-3 flex cursor-pointer items-start gap-2 border border-cyan-300/25 bg-cyan-300/[0.035] px-3 py-2 font-mono text-[8px] leading-relaxed text-white/65"><input type="checkbox" checked={sarConfirmed} onChange={(event) => setSarConfirmed(event.target.checked)} className="mt-0.5 accent-cyan-300" /><span>I confirm {mode === 'sar' ? 'this uploaded image is a SAR/radar product' : 'Input B is the matched SAR/radar product'}. Do not use a normal colour image as SAR.</span></label>}
                  <div className="mt-3 flex items-start gap-2 border-l-2 border-[#d4af37]/60 bg-[#d4af37]/5 px-3 py-2 font-mono text-[9px] leading-relaxed text-[var(--text-muted)]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d4af37]" />{mode === 'sar' ? 'SAR interpretation is evidence-based: brightness alone does not confirm land cover or objects.' : mode === 'bi-temporal' ? 'Use co-registered images of the same area from different dates for change evidence.' : mode === 'optical-sar' ? 'Use co-registered optical and SAR imagery of the same area for multimodal comparison.' : 'For a text-only question with a city, district, or landmark, SATQUERY fetches an original Esri World Imagery basemap and analyzes that image. No AI-generated satellite images are used.'}</div>
                  {file && <div className="mt-3 rounded border border-cyan-300/20 bg-cyan-300/[0.025] p-3"><p className="font-mono text-[9px] tracking-widest text-cyan-100">SPECTRAL INDEX · MULTI-BAND RASTER ONLY</p><div className="mt-2 grid grid-cols-[1fr_52px_52px] gap-1.5"><select value={spectralIndex} onChange={(e) => setSpectralIndex(e.target.value as 'NDVI' | 'NDWI')} className="border border-white/15 bg-black/30 px-2 font-mono text-[9px] text-white"><option>NDVI</option><option>NDWI</option></select><input aria-label="Numerator band" value={numeratorBand} onChange={(e) => setNumeratorBand(e.target.value)} inputMode="numeric" placeholder="NUM" className="border border-white/15 bg-black/30 px-2 font-mono text-[9px] text-white placeholder:text-white/30" /><input aria-label="Denominator band" value={denominatorBand} onChange={(e) => setDenominatorBand(e.target.value)} inputMode="numeric" placeholder="DEN" className="border border-white/15 bg-black/30 px-2 font-mono text-[9px] text-white placeholder:text-white/30" /></div><button type="button" onClick={() => void computeSpectralIndex()} disabled={spectralLoading} className="mt-2 w-full border border-cyan-300/35 px-2 py-1.5 font-mono text-[8px] tracking-wider text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-50">{spectralLoading ? 'COMPUTING…' : `COMPUTE ${spectralIndex}`}</button></div>}
                </div>

                <div className={`flex min-h-64 flex-col ${!simpleMode ? 'satquery-command-console' : ''}`}>
                  <div className="mb-3 flex items-center justify-between gap-3"><label htmlFor="satquery-question" className="font-mono text-base font-bold text-white">{file ? 'Ask about this image' : 'Ask SATQUERY'}</label>{simpleMode ? <label className="flex shrink-0 items-center gap-1.5 font-mono text-[8px] tracking-wider text-white/55">LANGUAGE <select aria-label="Response language" value={responseLanguage} onChange={(event) => setResponseLanguage(event.target.value as (typeof RESPONSE_LANGUAGES)[number]['value'])} className="max-w-32 rounded border border-cyan-300/45 bg-[#071019] px-2 py-1.5 font-mono text-[8px] text-cyan-100 outline-none focus:border-cyan-300"><option value="English">English</option>{RESPONSE_LANGUAGES.slice(1).map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select></label> : <span className={`satquery-ai-status ${isAnalyzing || isListening || isTranscribing ? 'is-busy' : ''}`}><i />{isAnalyzing ? 'AI ANALYZING' : isListening ? 'AI LISTENING' : isTranscribing ? 'AI TRANSCRIBING' : 'AI READY'}</span>}</div>
                  {aoi && <p className="mb-2 border-l-2 border-cyan-300/60 bg-cyan-300/[0.05] px-2 py-1 font-mono text-[8px] leading-relaxed text-cyan-100">MAP AOI ATTACHED · {aoi.name} · {aoi.areaKm2.toFixed(2)} km². It is recorded as geographic context; image-to-map registration is not assumed.</p>}
                  <p className="mb-2 border-l-2 border-[#d4af37]/60 bg-[#d4af37]/5 px-2 py-1 font-mono text-[8px] leading-relaxed text-white/50"><span className="text-[#f4d889]">LANGUAGE:</span> {simpleMode ? 'Choose a language using the selector above. SATQUERY translates the written analysis and Listen audio.' : 'Choose the result language below. SATQUERY translates the written analysis and Listen audio into that language.'}</p>
                  <div className="relative"><textarea id="satquery-question" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={file ? 'Example: Identify signs of flooding and describe the visible evidence.' : 'Ask any question — for example: What causes flooding?'} className="min-h-28 w-full resize-none rounded border border-white/15 bg-black/25 p-3 pr-12 font-mono text-xs leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 focus:border-cyan-300/70" /><button type="button" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); void startVoiceQuery(); }} onPointerUp={(event) => { event.preventDefault(); recorderRef.current?.stop(); }} onPointerCancel={() => recorderRef.current?.stop()} onKeyDown={(event) => { if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void startVoiceQuery(); } }} onKeyUp={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); recorderRef.current?.stop(); } }} disabled={isTranscribing} title={isTranscribing ? 'Converting your voice to text' : 'Hold to speak; release to convert speech to text'} aria-label={isTranscribing ? 'Converting your voice to text' : 'Hold to speak, release to convert speech to text'} className={`absolute right-2 top-2 rounded p-2 transition-colors disabled:cursor-wait ${isListening ? 'bg-[#ff8b78]/20 text-[#ff9c8c] animate-pulse' : 'text-cyan-200 hover:bg-cyan-300/10'}`}>{isListening ? <MicOff className="h-4 w-4" /> : isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}</button></div>
                  {file && <section className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.045] p-3"><p className="font-mono text-[9px] font-bold tracking-[0.13em] text-cyan-100">✨ QUESTIONS YOU MAY WANT TO ASK</p><p className="mt-1 text-xs leading-5 text-white/60">We looked at your image and picked a few useful things to check. Choose one, or write your own question.</p>{isSuggesting ? <p className="mt-3 font-mono text-[9px] tracking-wider text-cyan-100/80"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />LOOKING AT YOUR IMAGE…</p> : <div className="mt-3 flex flex-wrap gap-2">{(imageSuggestions.length ? imageSuggestions.slice(0, 3) : ['Is there water or flooding in this image?', 'Do you see any visible damage or change?', 'Explain what you can see in simple words.']).map((suggestion, index) => <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className="rounded-full border border-cyan-300/35 bg-[#071019] px-3 py-2 text-left font-mono text-[9px] leading-4 text-cyan-100 transition hover:border-[#d4af37]/70 hover:bg-[#d4af37]/10 hover:text-[#f4d889]"><span className="mr-1 text-[#f4d889]">{index + 1}.</span>{suggestion}</button>)}</div>}</section>}
                  <p className="mt-1.5 font-mono text-[8px] tracking-wide text-white/35">{isListening ? 'LISTENING — KEEP HOLDING THE MICROPHONE WHILE YOU SPEAK…' : isTranscribing ? 'CONVERTING YOUR VOICE TO TEXT…' : 'HOLD THE MICROPHONE TO SPEAK · RELEASE TO ADD TEXT'}</p>
                  {!simpleMode && <div className="mt-3 rounded border border-cyan-300/15 bg-cyan-300/[0.025] p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-mono text-[8px] tracking-widest text-cyan-100">SUGGESTED QUESTIONS</p><div className="flex items-center gap-2"><label htmlFor="satquery-language" className="font-mono text-[8px] text-white/45">ANSWER IN</label><select id="satquery-language" value={responseLanguage} onChange={(event) => setResponseLanguage(event.target.value as (typeof RESPONSE_LANGUAGES)[number]['value'])} className="max-w-36 rounded border border-cyan-300/35 bg-[#071019] px-2 py-1 font-mono text-[8px] text-cyan-100 outline-none focus:border-cyan-300"><option value="English">English</option>{RESPONSE_LANGUAGES.slice(1).map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select><button type="button" onClick={() => void discoverImagery()} disabled={isDiscovering} className="flex shrink-0 items-center gap-1 rounded border border-cyan-300/35 px-2 py-1 font-mono text-[8px] text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-50">{isDiscovering ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}{isDiscovering ? 'FINDING…' : 'FIND IMAGERY'}</button></div></div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{file && isSuggesting ? <span className="font-mono text-[8px] tracking-wider text-cyan-100/70">READING IMAGE FOR RELEVANT QUESTIONS…</span> : (imageSuggestions.length ? imageSuggestions : QUICK_QUERIES).map((suggestion) => <button key={suggestion} type="button" onClick={() => setQuery(suggestion)} className={`rounded border px-2 py-1 font-mono text-[8px] transition hover:border-[#d4af37]/60 hover:text-[#f4d889] ${imageSuggestions.length ? 'border-cyan-300/30 text-cyan-100' : 'border-white/10 text-white/55'}`}>{suggestion}</button>)}</div>
                    <section className="mt-3 border-t border-cyan-300/15 pt-3"><div className="flex items-center justify-between gap-2"><p className="font-mono text-[8px] tracking-widest text-cyan-100">METHOD &amp; SOURCE REFERENCES</p><span className="font-mono text-[7px] text-white/35">OPEN IN NEW TAB</span></div><div className="mt-2 grid gap-1.5">{RESEARCH_REFERENCES.map((reference) => <div key={reference.href} className="border border-white/10 bg-black/20 px-2.5 py-2"><div className="flex items-center justify-between gap-3"><span className="min-w-0"><span className="block font-mono text-[8px] text-white/75">{reference.label}</span><span className="mt-0.5 block font-mono text-[7px] text-white/40">{reference.source}</span></span><a href={reference.href} target="_blank" rel="noreferrer" className="shrink-0 text-cyan-200 transition hover:text-white" title={`Open ${reference.label}`}><ExternalLink className="h-3.5 w-3.5" /></a></div>{'fallback' in reference && <a href={reference.fallback} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-mono text-[7px] tracking-wider text-[#f4d889] transition hover:text-white">OPEN {reference.fallbackLabel} <ExternalLink className="h-2.5 w-2.5" /></a>}</div>)}</div></section>
                    <p className="mt-2 flex items-center gap-1 font-mono text-[8px] leading-relaxed text-white/40"><MapPinned className="h-3 w-3 shrink-0 text-cyan-200" />{discoveredLocation ? `Imagery loaded for ${discoveredLocation}. Review it, then start analysis.` : 'For automatic imagery, include a city, district, or landmark in your question.'}</p>
                  </div>}
                  {(!simpleMode || /Gemini API key/i.test(error)) && <details className="mt-3 text-[10px] text-[var(--text-muted)]"><summary className="cursor-pointer font-mono tracking-widest hover:text-white">API KEY (OPTIONAL)</summary><input type="password" value={apiKey} onChange={(event) => updateApiKey(event.target.value)} placeholder="Gemini API key — saved on this browser for future image analyses" className="mt-2 w-full rounded border border-white/10 bg-black/25 px-3 py-2 font-mono text-[10px] text-white outline-none focus:border-cyan-300/70" /><p className="mt-1 text-[8px] text-white/35">Saved only in this browser. Clear this field to remove it.</p></details>}
                  {error && <p role="alert" className="mt-3 border border-[#ff8b78]/30 bg-[#ff8b78]/10 px-3 py-2 font-mono text-[10px] text-[#ff9c8c]">{simpleMode ? (/Gemini API key/i.test(error) ? 'Analysis is ready, but this browser needs a Gemini API key. Open “API KEY (OPTIONAL)” below, paste your key, then press Analyze again.' : error) : error}</p>}
                  <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                    <button onClick={() => { void analyze(); }} disabled={isAnalyzing} className="flex items-center justify-center gap-2 rounded border border-cyan-300/50 bg-cyan-300/10 px-4 py-3 font-mono text-[10px] font-bold tracking-[0.17em] text-cyan-100 transition-colors hover:bg-cyan-300/20 disabled:cursor-wait disabled:opacity-60">{isAnalyzing ? <><Loader2 className="h-4 w-4 animate-spin" />{file ? 'ANALYZING IMAGE...' : 'FETCHING SATELLITE IMAGE...'}</> : <><Send className="h-4 w-4" />{file ? 'ANALYZE IMAGE' : 'FETCH IMAGE + ANALYZE'}</>}</button>
                    <a href="/satquery/evaluation" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded border border-[#d4af37]/50 bg-[#d4af37]/10 px-3 py-3 font-mono text-[8px] font-bold tracking-wider text-[#f4d889] transition hover:bg-[#d4af37]/20" title="Open evaluation and judging readiness"><ExternalLink className="h-3.5 w-3.5" /> EVALUATION</a>
                    <a href={`/satquery/project-guide?workspace=${simpleMode ? 'simple' : 'expert'}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded border border-white/25 bg-white/[0.04] px-3 py-3 font-mono text-[8px] font-bold tracking-wider text-white/75 transition hover:bg-white/10" title="Open SATQUERY project guide"><ExternalLink className="h-3.5 w-3.5" /> GUIDE</a>
                  </div>
                </div>
                </div>

              {showQrInfo && !result && sharedReportUrl && <section className="mt-5 border border-cyan-300/35 bg-[#071019] p-5 text-center"><div className="flex items-center justify-between"><p className="font-mono text-[9px] tracking-[0.16em] text-cyan-100">SATQUERY AI · ACTIVE QR SCANNER</p><button onClick={() => setShowQrInfo(false)} className="border border-white/20 px-2 py-1 font-mono text-[8px] text-white/75">CLOSE SCANNER</button></div><img src={`https://quickchart.io/qr?size=320&margin=2&ecLevel=M&text=${encodeURIComponent(sharedReportUrl)}`} alt="Active QR code for the SATQUERY report" className="mx-auto mt-4 h-60 w-60 rounded-xl bg-white p-3" /><p className="mt-3 font-mono text-[9px] text-white/70">This scanner remains visible until you select Close Scanner.</p><a href={sharedReportUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block border border-cyan-300/40 px-3 py-2 font-mono text-[8px] text-cyan-100">VIEW FULL REPORT ON LAPTOP</a></section>}
              {result?.imageLocation?.status === 'verified' && <section className="mt-5 border border-cyan-300/25 bg-cyan-300/[0.06] px-4 py-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-1 font-mono text-[9px] tracking-widest text-cyan-100"><MapPinned className="h-3.5 w-3.5" />UPLOAD LOCATION</p><p className="mt-1 max-w-2xl text-xs leading-5 text-white/70">{result.imageLocation.placeName || result.imageLocation.note}</p>{typeof result.imageLocation.latitude === 'number' && typeof result.imageLocation.longitude === 'number' && <p className="mt-1 font-mono text-[9px] text-white/50">{result.imageLocation.latitude.toFixed(6)}, {result.imageLocation.longitude.toFixed(6)}</p>}</div>{typeof result.imageLocation.latitude === 'number' && typeof result.imageLocation.longitude === 'number' && <a href={`https://www.openstreetmap.org/?mlat=${result.imageLocation.latitude}&mlon=${result.imageLocation.longitude}#map=15/${result.imageLocation.latitude}/${result.imageLocation.longitude}`} target="_blank" rel="noreferrer" className="shrink-0 border border-cyan-300/45 px-2.5 py-2 font-mono text-[8px] tracking-wider text-cyan-100 hover:bg-cyan-300/10">OPEN MAP ↗</a>}</div></section>}
              {result && result.imageLocation?.status !== 'verified' && result.visualLocation && <section className="mt-5 border border-cyan-300/25 bg-cyan-300/[0.04] px-4 py-3"><p className="flex items-center gap-1 font-mono text-[9px] tracking-widest text-cyan-100"><MapPinned className="h-3.5 w-3.5" />AI LOCATION MATCH · {result.visualLocation.confidence.toUpperCase()} CONFIDENCE</p><p className="mt-1 text-sm font-semibold text-white">{result.visualLocation.placeName}</p><p className="mt-1 text-xs leading-5 text-white/65">Evidence: {result.visualLocation.evidence}</p></section>}
              <AnimatePresence>
                {result && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 border border-cyan-300/30 bg-cyan-300/[0.035]">
                  <div className="flex items-center justify-between border-b border-cyan-300/20 px-4 py-2 font-mono text-[10px] tracking-[0.15em] text-cyan-200"><span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" />ANALYSIS RESULT</span><div className="flex flex-wrap items-center justify-end gap-2"><select aria-label="Explanation level" value={explanationMode} onChange={(event) => setExplanationMode(event.target.value as typeof explanationMode)} className="border border-white/15 bg-[#071019] px-1.5 py-1 font-mono text-[8px] text-white/70"><option value="simple">SIMPLE</option><option value="student">STUDENT</option><option value="detailed">DETAILED</option></select><button onClick={() => downloadPdfReport(result, query)} className="flex items-center gap-1 text-[8px] tracking-wider text-cyan-100 hover:text-white" title="Save this report as a PDF"><Download className="h-3.5 w-3.5" />REPORT</button><button type="button" onClick={() => void openQrInfo()} disabled={shareLoading} className="flex items-center gap-1 rounded border border-[#d4af37]/45 bg-[#d4af37]/[0.06] px-2 py-1 text-[8px] tracking-wider text-[#f4d889] transition hover:bg-[#d4af37]/15 disabled:opacity-50" title="Show a QR code to open this detailed report on a phone"><QrCode className="h-3.5 w-3.5" />{shareLoading ? 'MAKING QR…' : 'SCAN ON PHONE'}</button><button onClick={toggleResultAudio} className="flex items-center gap-1 text-[8px] tracking-wider text-cyan-100 hover:text-white" title={isSpeaking ? 'Stop listening' : 'Listen to analysis'}>{isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}{isSpeaking ? 'STOP' : 'LISTEN'}</button></div></div>
                  {showQrInfo && <div className="border-b border-cyan-300/25 bg-[radial-gradient(circle_at_50%_0%,rgba(0,229,255,0.18),transparent_58%)] p-5"><div className="mx-auto max-w-md text-center"><div className="flex items-center justify-between"><span className="font-mono text-[9px] tracking-[0.16em] text-cyan-100">SATQUERY AI · DISASTER INFORMATION</span><button onClick={() => setShowQrInfo(false)} className="flex items-center gap-1 rounded border border-white/20 px-2 py-1 font-mono text-[8px] tracking-wider text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close QR scanner and return to analysis"><X className="h-3.5 w-3.5" />CLOSE SCANNER</button></div>{shareLoading ? <div className="py-12 font-mono text-[10px] tracking-widest text-cyan-100">CREATING SECURE SHARE LINK…</div> : sharedReportUrl ? <><div className="mx-auto mt-4 w-fit rounded-2xl border border-cyan-200/40 bg-white p-3 shadow-[0_0_32px_rgba(0,229,255,0.24)]"><img src={`https://quickchart.io/qr?size=320&margin=2&ecLevel=M&text=${encodeURIComponent(sharedReportUrl)}`} alt="QR code for the SATQUERY disaster report" className="h-60 w-60" /></div><p className="mt-4 font-mono text-xs font-semibold tracking-wide text-white">Scanner stays open until you select Close Scanner</p><p className="mx-auto mt-2 max-w-sm font-sans text-xs leading-5 text-white/65">Any number of people can scan this code. The laptop scanner and report preview remain open until you close them.</p><p className="mx-auto mt-2 max-w-sm break-all font-mono text-[8px] leading-relaxed text-white/45">{sharedReportUrl}</p>{shareFeedback && <p role="status" aria-live="polite" className="mt-2 rounded border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 font-mono text-[8px] leading-relaxed text-cyan-100">{shareFeedback}</p>}<div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => void downloadQr()} className="border border-cyan-300/40 px-2 py-2 font-mono text-[8px] tracking-wider text-cyan-100 hover:bg-cyan-300/10">DOWNLOAD QR</button><button onClick={() => void copyShareLink()} className="border border-cyan-300/40 px-2 py-2 font-mono text-[8px] tracking-wider text-cyan-100 hover:bg-cyan-300/10">COPY LINK</button><button onClick={() => void shareReport()} className="border border-cyan-300/40 px-2 py-2 font-mono text-[8px] tracking-wider text-cyan-100 hover:bg-cyan-300/10">SHARE</button><a href={sharedReportUrl} target="_blank" rel="noreferrer" className="border border-cyan-300/40 px-2 py-2 font-mono text-[8px] leading-4 tracking-wider text-cyan-100 hover:bg-cyan-300/10">VIEW ON LAPTOP</a></div><section className="mt-4 rounded-lg border border-cyan-300/25 bg-black/25 p-3 text-left"><p className="font-mono text-[8px] tracking-widest text-cyan-100">LAPTOP REPORT PREVIEW</p><p className="mt-2 font-mono text-[9px] leading-relaxed text-white/70">{result.analysis}</p></section></> : <p className="py-10 font-mono text-[9px] text-[#ff9c8c]">The QR report could not be created. Check the message above and try again.</p>}</div></div>}
                  {simpleMode ? <section className="p-4 sm:p-6"><div className="overflow-hidden rounded-2xl border border-cyan-300/30 bg-[radial-gradient(circle_at_50%_0%,rgba(0,229,255,0.14),transparent_42%),#07101a]"><div className="p-5 text-center"><div className="text-4xl">{query.toLowerCase().includes('flood') ? '🌊' : query.toLowerCase().includes('damage') ? '🧱' : query.toLowerCase().includes('vegetation') ? '🌳' : query.toLowerCase().includes('building') ? '🏠' : '🛰️'}</div><p className="mt-3 font-mono text-[9px] tracking-[0.2em] text-[#d4af37]">SATQUERY FOUND</p><h3 className="mt-2 font-mono text-lg font-bold tracking-wide text-white">HERE IS WHAT WE CAN SEE</h3></div>{preview && <div className="relative mx-auto max-w-2xl border-y border-cyan-300/20 bg-black"><img src={preview} alt="Your satellite image" className="max-h-80 w-full object-contain" />{result.evidence?.slice(0, 3).map((region, index) => <div key={`${region.label}-simple-${index}`} className="absolute border-2 border-cyan-300 shadow-[0_0_14px_rgba(0,229,255,0.7)]" style={{ left: `${region.bounds.x / 10}%`, top: `${region.bounds.y / 10}%`, width: `${region.bounds.width / 10}%`, height: `${region.bounds.height / 10}%` }}><span className="absolute left-0 top-0 whitespace-nowrap bg-cyan-300 px-1.5 py-0.5 font-mono text-[8px] font-bold text-black">{index + 1}</span></div>)}</div>}<div className="grid gap-3 p-5 sm:grid-cols-2"><div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4 text-left"><p className="font-mono text-[9px] tracking-widest text-cyan-100">🔎 WHAT I FOUND</p><p className="mt-2 text-sm leading-6 text-white/85">{answerForMode(result.analysis, 'simple')}</p></div><div className="rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/[0.05] p-4 text-left"><p className="font-mono text-[9px] tracking-widest text-[#f4d889]">📍 HOW SURE AM I?</p><p className="mt-2 text-sm leading-6 text-white/80">{result.decisionSupport?.confidence === 'high' ? '✅ I can see clear signs in this image.' : result.decisionSupport?.confidence === 'low' ? '⚠️ Please treat this as an early clue and check another image if possible.' : '🟡 This is a useful first look. Please check important decisions with another source.'}</p></div></div><div className="border-t border-white/10 px-5 py-4"><p className="font-mono text-[9px] tracking-widest text-[#f4d889]">⚠️ GOOD TO KNOW</p><p className="mt-2 text-sm leading-6 text-white/65">{result.limitations?.[0] || 'This is an image-based observation. It cannot confirm everything on the ground.'}</p></div><div className="flex flex-wrap justify-center gap-2 border-t border-white/10 p-4"><button onClick={toggleResultAudio} className="rounded-full border border-cyan-300/45 px-4 py-2 font-mono text-[9px] tracking-wider text-cyan-100 hover:bg-cyan-300/10">{isSpeaking ? '⏹ STOP' : '🔊 LISTEN'}</button><button onClick={() => setSimpleMode(false)} className="rounded-full border border-white/20 px-4 py-2 font-mono text-[9px] tracking-wider text-white/70 hover:bg-white/10">⚙️ VIEW EXPERT DETAILS</button><button onClick={clearFile} className="rounded-full border border-[#d4af37]/45 px-4 py-2 font-mono text-[9px] tracking-wider text-[#f4d889] hover:bg-[#d4af37]/10">🔄 ANALYZE AGAIN</button></div></div></section> : <>
                  <div className="grid grid-cols-2 gap-px border-b border-cyan-300/15 bg-cyan-300/10 sm:grid-cols-4">{[
                    ['STATUS', 'RETURNED'],
                    ['WORKFLOW', (result.mode || mode).toUpperCase()],
                    ['INPUTS', comparisonFile ? '2 IMAGES' : file ? '1 IMAGE' : 'DISASTER QUERY'],
                    ['COMPLETED', completedAt ? new Date(completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'],
                  ].map(([label, value]) => <div key={label} className="bg-[#071019] px-3 py-2"><p className="font-mono text-[7px] tracking-widest text-white/40">{label}</p><p className="mt-0.5 font-mono text-[9px] text-cyan-100">{value}</p></div>)}</div>
                  {file && <div className="border-b border-cyan-300/15 bg-black/15 px-4 py-3"><p className="mb-2 font-mono text-[8px] tracking-widest text-[#f4d889]">INPUT PROVENANCE</p><div className="space-y-1 font-mono text-[9px] leading-relaxed text-white/55"><p><span className="text-white/35">PRIMARY</span> · {describeInput(result.inputMetadata?.primary, file)}</p>{comparisonFile && <p><span className="text-white/35">COMPARISON</span> · {describeInput(result.inputMetadata?.comparison || undefined, comparisonFile)}</p>}{result.inputMetadata?.geospatialPair?.records?.[0]?.crs && <p><span className="text-white/35">GEOTIFF CRS</span> · {result.inputMetadata.geospatialPair.records[0].crs} · {result.inputMetadata.geospatialPair.records[0].bands || '—'} bands</p>}{aoi && <p><span className="text-white/35">MAP AOI CONTEXT</span> · {aoi.name} · {aoi.areaKm2.toFixed(2)} km² · contextual only until image registration is verified</p>}<p><span className="text-white/35">BROWSER FILE DATE</span> · {fileDate(file)}{comparisonFile ? ` → ${fileDate(comparisonFile)}` : ''}</p><p><span className="text-white/35">RESULT TIMESTAMP</span> · {result.timestamp ? new Date(result.timestamp).toLocaleString() : 'Not supplied by analysis service'}</p></div></div>}
                  {file && <div className="grid gap-px border-b border-cyan-300/15 bg-cyan-300/10 md:grid-cols-2"><div className="bg-[#071019] px-4 py-3"><p className="font-mono text-[8px] tracking-widest text-cyan-100">IMAGE QUALITY / SUITABILITY · {assessImageQuality(result.inputMetadata?.primary, Boolean(comparisonFile)).level.toUpperCase()}</p><div className="mt-2 space-y-1 font-mono text-[8px] leading-relaxed text-white/55">{assessImageQuality(result.inputMetadata?.primary, Boolean(comparisonFile)).checks.map((item) => <p key={item}>✓ {item}</p>)}{assessImageQuality(result.inputMetadata?.primary, Boolean(comparisonFile)).cautions.map((item) => <p key={item} className="text-[#ffcf87]">! {item}</p>)}</div></div><div className="bg-[#071019] px-4 py-3">{result.mode === 'bi-temporal' ? <>{changeSeverity(result.adapter?.changeMask) ? <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">CHANGE SEVERITY · {changeSeverity(result.adapter?.changeMask)?.label}</p><p className="mt-2 font-mono text-xl text-white">{changeSeverity(result.adapter?.changeMask)?.percent}%</p><p className="font-mono text-[8px] leading-relaxed text-white/50">Grid cells above the adapted-model threshold; a semantic screening estimate, not changed area.</p></> : <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">CHANGE SEVERITY · VISUAL REVIEW</p><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/55">A trained adapter heatmap is unavailable. Review evidence regions and co-registration before assigning severity.</p></>}</> : disasterGuidance(query) ? <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">{disasterGuidance(query)?.label}</p><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/55">{disasterGuidance(query)?.action}</p></> : <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">DECISION SUPPORT</p><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/55">Use a disaster-focused query such as flood, fire, drought, landslide, or infrastructure damage to receive an operational review prompt.</p></>}</div></div>}
                  {file && <div className="grid gap-px border-b border-cyan-300/15 bg-cyan-300/10 md:grid-cols-2"><div className="bg-[#071019] px-4 py-3"><p className="font-mono text-[8px] tracking-widest text-cyan-100">IMAGE QUALITY / SUITABILITY · {assessImageQuality(result.inputMetadata?.primary, Boolean(comparisonFile)).level.toUpperCase()}</p><div className="mt-2 space-y-1 font-mono text-[8px] leading-relaxed text-white/55">{assessImageQuality(result.inputMetadata?.primary, Boolean(comparisonFile)).checks.map((item) => <p key={item}>✓ {item}</p>)}{assessImageQuality(result.inputMetadata?.primary, Boolean(comparisonFile)).cautions.map((item) => <p key={item} className="text-[#ffcf87]">! {item}</p>)}</div></div><div className="bg-[#071019] px-4 py-3">{result.mode === 'bi-temporal' ? <>{changeSeverity(result.adapter?.changeMask) ? <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">CHANGE SEVERITY · {changeSeverity(result.adapter?.changeMask)?.label}</p><p className="mt-2 font-mono text-xl text-white">{changeSeverity(result.adapter?.changeMask)?.percent}%</p><p className="font-mono text-[8px] leading-relaxed text-white/50">Grid cells above the adapted-model threshold; a semantic screening estimate, not changed area.</p></> : <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">CHANGE SEVERITY · VISUAL REVIEW</p><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/55">A trained adapter heatmap is unavailable. Review evidence regions and co-registration before assigning severity.</p></>}</> : disasterGuidance(query) ? <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">{disasterGuidance(query)?.label}</p><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/55">{disasterGuidance(query)?.action}</p></> : <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">DECISION SUPPORT</p><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/55">Use a disaster-focused query such as flood, fire, drought, landslide, or infrastructure damage to receive an operational review prompt.</p></>}</div></div>}
                  {result.imageDiagnostics && <div className="grid gap-px border-b border-cyan-300/15 bg-cyan-300/10 md:grid-cols-3"><div className="bg-[#071019] px-4 py-3"><p className="font-mono text-[8px] tracking-widest text-cyan-100">IMAGE QUALITY SCORE</p><p className="mt-2 font-mono text-2xl text-white">{qualityScore(result.imageDiagnostics)}<span className="text-xs text-white/40"> / 100</span></p><p className="mt-1 font-mono text-[8px] leading-relaxed text-white/40">Screening score from display brightness, contrast, and obstruction proxies—not a sensor-quality certification.</p></div><div className="bg-[#071019] px-4 py-3"><p className="font-mono text-[8px] tracking-widest text-cyan-100">MEASURED DISPLAY QUALITY · {result.imageDiagnostics.primary.status.toUpperCase()}</p><p className="mt-2 font-mono text-[9px] text-white/65">Brightness {result.imageDiagnostics.primary.brightness.toFixed(3)} · Contrast {result.imageDiagnostics.primary.contrast.toFixed(3)}</p><p className="mt-1 font-mono text-[8px] leading-relaxed text-white/40">{result.imageDiagnostics.limitation}</p></div><div className="bg-[#071019] px-4 py-3">{result.imageDiagnostics.pairDifference ? <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">PAIR PIXEL-DIFFERENCE SCREEN</p><p className="mt-2 font-mono text-[9px] text-white/65">Mean difference {result.imageDiagnostics.pairDifference.meanAbsoluteDifference.toFixed(3)} · {result.imageDiagnostics.pairDifference.flaggedPixelsPercent.toFixed(1)}% flagged</p><p className="mt-1 font-mono text-[8px] leading-relaxed text-white/40">{result.imageDiagnostics.pairDifference.limitation}</p></> : <><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">PAIR SCREEN</p><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/55">Add a corresponding second image to calculate a measured display-pixel difference screen.</p></>}</div></div>}
                  {activePairTrust && <div className="border-b border-cyan-300/15 bg-black/20 px-4 py-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><p className="font-mono text-[8px] tracking-widest text-[#f4d889]">PAIR COMPATIBILITY SCORE</p><p className="mt-1 font-mono text-[8px] leading-relaxed text-white/45">Input and metadata compatibility only; this does not prove real-world change or perfect registration.</p></div><div className="text-right"><p className="font-mono text-2xl text-white">{activePairTrust.score}<span className="text-xs text-white/40"> / 100</span></p><p className={`font-mono text-[8px] ${activePairTrust.metadataVerified ? 'text-[#7fffa4]' : activePairTrust.score >= 45 ? 'text-[#ffcf87]' : 'text-[#ff9c8c]'}`}>{activePairTrust.state}</p></div></div><div className="mt-3 grid gap-2 md:grid-cols-2"><div className="border-l-2 border-cyan-300/50 pl-2 font-mono text-[8px] leading-relaxed text-white/60">{activePairTrust.checks.length ? activePairTrust.checks.map((check) => <p key={check}>✓ {check}</p>) : <p>No compatibility checks passed yet.</p>}</div><div className="border-l-2 border-[#ffcf87]/50 pl-2 font-mono text-[8px] leading-relaxed text-white/55">{activePairTrust.cautions.map((caution) => <p key={caution}>! {caution}</p>)}</div></div></div>}
                  {result.quantitativeChange && <div className="border-b border-cyan-300/15 bg-black/20 px-4 py-3"><p className="font-mono text-[8px] tracking-widest text-[#f4d889]">QUANTITATIVE CHANGE MEASUREMENT</p>{result.quantitativeChange.available ? <><p className="mt-2 font-mono text-xl text-white">{result.quantitativeChange.changedAreaKm2} km² <span className="text-[10px] text-cyan-100">· {result.quantitativeChange.changedHectares} ha</span></p><p className="mt-1 font-mono text-[8px] text-white/45">{result.quantitativeChange.source}</p></> : <p className="mt-2 font-mono text-[9px] leading-relaxed text-white/55">MEASUREMENT LOCKED · {result.quantitativeChange.limitation}</p>}<p className="mt-1 font-mono text-[8px] leading-relaxed text-white/40">{result.quantitativeChange.limitation}</p></div>}
                  {result.mapEvidence?.features.length && onMapEvidence && <div className="flex items-center justify-between border-b border-cyan-300/15 bg-cyan-300/[0.035] px-4 py-3"><div><p className="font-mono text-[8px] tracking-widest text-cyan-100">MAP-LINKED EVIDENCE READY</p><p className="mt-1 font-mono text-[8px] text-white/45">Validated EPSG:4326 GeoTIFF evidence can be added as a map layer.</p></div><button type="button" onClick={() => onMapEvidence(result.mapEvidence!)} className="border border-cyan-300/45 px-2 py-1.5 font-mono text-[8px] text-cyan-100 hover:bg-cyan-300/10">SHOW ON MAP</button></div>}
                  {result.imageDiagnostics && <div className="grid gap-px border-b border-cyan-300/15 bg-cyan-300/10 md:grid-cols-2"><div className="bg-[#071019] px-4 py-3"><p className="font-mono text-[8px] tracking-widest text-cyan-100">OBSTRUCTION SCREEN · {result.imageDiagnostics.obstructionScreen?.status.toUpperCase() || 'UNAVAILABLE'}</p><p className="mt-2 font-mono text-[9px] text-white/65">Bright-neutral {result.imageDiagnostics.obstructionScreen?.brightNeutralPercent.toFixed(1) || '—'}% · Dark {result.imageDiagnostics.obstructionScreen?.darkPercent.toFixed(1) || '—'}%</p><p className="mt-1 font-mono text-[8px] leading-relaxed text-white/40">{result.imageDiagnostics.obstructionScreen?.limitation}</p></div><div className="bg-[#071019] px-4 py-3"><p className="font-mono text-[8px] tracking-widest text-[#ffcf87]">VISUAL LAND-COVER MIX · SCREENING</p><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[8px] text-white/60">{result.imageDiagnostics.visualCoverMix?.map((item) => <p key={item.label}>{item.label.replaceAll('-', ' ')} <span className="text-cyan-100">{item.percent.toFixed(1)}%</span></p>)}</div><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/40">Color-based display estimate only; it is not a classified land-cover map or area calculation.</p></div></div>}
                  {aoi && <div className="flex items-center justify-between border-b border-cyan-300/15 bg-black/15 px-4 py-3"><div><p className="font-mono text-[8px] tracking-widest text-cyan-100">AOI MONITOR · {aoi.name}</p><p className="mt-1 font-mono text-[8px] text-white/45">Stores a local review rule for this AOI. It does not send alerts or infer image-to-map registration.</p></div><button type="button" onClick={toggleAoiWatch} className={`border px-2 py-1.5 font-mono text-[8px] ${watchingAoi ? 'border-[#ffcf87]/60 bg-[#ffcf87]/10 text-[#ffcf87]' : 'border-cyan-300/40 text-cyan-100 hover:bg-cyan-300/10'}`}>{watchingAoi ? 'MONITORING ON' : 'MONITOR AOI'}</button></div>}
                  {preview ? <div className="border-b border-cyan-300/15 p-4">
                    <p className="mb-2 font-mono text-[9px] tracking-widest text-cyan-100">{result.evidence?.length ? 'HIGHLIGHTED IMAGE EVIDENCE' : 'ANALYZED IMAGE'} · {mode.toUpperCase()}</p>
                    <div className={`grid gap-3 ${comparisonPreview ? 'md:grid-cols-2' : ''}`}>
                      <div><p className="mb-1 font-mono text-[8px] tracking-widest text-white/50">{mode === 'sar' ? 'SAR IMAGE' : mode === 'optical-sar' ? 'OPTICAL IMAGE / INPUT A' : mode === 'bi-temporal' ? `IMAGE / DATE A · ${fileDate(file)}` : 'OPTICAL IMAGE'}</p><div className="relative mx-auto w-fit max-w-full overflow-hidden border border-cyan-300/25 bg-black"><img src={preview} alt={`${mode === 'sar' ? 'SAR' : 'Optical'} satellite image analyzed`} className="block max-h-[420px] max-w-full" />{result.adapter?.changeMask?.image && <img src={`data:image/png;base64,${result.adapter.changeMask.image}`} alt="Adapted-model semantic change heatmap" className="pointer-events-none absolute inset-0 h-full w-full opacity-55 mix-blend-screen" />}{result.evidence?.map((region, index) => <div key={`${region.label}-${index}`} title={`${region.label}: ${region.rationale}`} className={`absolute border-2 ${region.confidence === 'high' ? 'border-cyan-300' : region.confidence === 'medium' ? 'border-[#d4af37]' : 'border-[#ff9c8c]'}`} style={{ left: `${region.bounds.x / 10}%`, top: `${region.bounds.y / 10}%`, width: `${region.bounds.width / 10}%`, height: `${region.bounds.height / 10}%` }}><span className="absolute left-0 top-0 whitespace-nowrap bg-black/80 px-1 py-0.5 font-mono text-[8px] text-white">{index + 1}. {region.label} · {region.confidence}</span></div>)}</div></div>
                      {comparisonPreview ? <div><p className="mb-1 font-mono text-[8px] tracking-widest text-white/50">{mode === 'optical-sar' ? 'SAR IMAGE / INPUT B' : `IMAGE / DATE B · ${fileDate(comparisonFile)}`}</p><div className="overflow-hidden border border-cyan-300/25 bg-black"><img src={comparisonPreview} alt={mode === 'optical-sar' ? 'Paired SAR satellite image analyzed' : 'Second-date satellite image analyzed'} className="block max-h-[420px] w-full object-contain" /></div></div> : null}
                    </div>
                    {comparisonPreview && <div className="mt-4 border border-cyan-300/20 bg-black/25 p-3"><div className="mb-2 flex items-center justify-between font-mono text-[8px] tracking-widest text-cyan-100"><span>BEFORE / AFTER SWIPE REVIEW</span><span>DATE A ← → DATE B</span></div><div className="relative aspect-video overflow-hidden border border-white/10 bg-black"><img src={preview} alt="Date A for swipe comparison" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-y-0 right-0 overflow-hidden border-l-2 border-cyan-200" style={{ width: `${100 - compareSwipe}%` }}><img src={comparisonPreview} alt="Date B for swipe comparison" className="absolute right-0 top-0 h-full max-w-none object-cover" style={{ width: `${100 / ((100 - compareSwipe) / 100)}%` }} /></div><div className="pointer-events-none absolute inset-y-0 border-l-2 border-cyan-200" style={{ left: `${compareSwipe}%` }} /></div><input aria-label="Before after comparison position" type="range" min="0" max="100" value={compareSwipe} onChange={(event) => setCompareSwipe(Number(event.target.value))} className="mt-2 w-full accent-cyan-300" /><p className="mt-1 font-mono text-[8px] leading-relaxed text-white/40">Visual alignment aid only. Use co-registered imagery and the compatibility checks before interpreting differences as real change.</p></div>}
                    <p className="mt-3 border-l-2 border-[#d4af37]/60 bg-black/20 px-2 py-1.5 font-mono text-[8px] leading-relaxed text-white/55">{mode === 'sar' ? 'SAR visual guide: smooth open water often appears dark because radar energy reflects away from the sensor; brightness alone is not proof of a feature.' : mode === 'optical' ? 'Optical visual guide: colors represent reflected light. Clouds, shadows, haze, and image date can limit interpretation.' : mode === 'optical-sar' ? 'Optical + SAR visual guide: compare matching terrain in both images; do not treat a single bright or dark SAR area as conclusive.' : 'Change visual guide: compare matching locations in Date A and Date B; differences may also result from clouds, season, or image alignment.'}</p>
                    {result.adapter?.changeMask && <p className="mt-2 border-l-2 border-[#ff6b5f]/70 bg-[#ff6b5f]/5 px-2 py-1.5 font-mono text-[8px] leading-relaxed text-[#ffd3ce]">ADAPTED-MODEL CHANGE HEATMAP · {result.adapter.changeMask.changedCells}/{result.adapter.changeMask.totalCells} grid cells above threshold. {result.adapter.changeMask.limitation}</p>}
                    {result.evidence?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{result.evidence.map((region, index) => <div key={`${region.label}-detail-${index}`} className="border-l-2 border-cyan-300/60 bg-black/20 px-2 py-1.5 font-mono text-[9px] text-white/65"><span className="text-cyan-100">{index + 1}. {region.label.toUpperCase()} · {region.confidence.toUpperCase()}</span><p className="mt-1 leading-relaxed">{region.rationale}</p></div>)}</div> : null}
                  </div> : null}
                  {result.decisionSupport && <div className="border-t border-cyan-300/15">
                    <div className="grid gap-px bg-cyan-300/10 sm:grid-cols-2 lg:grid-cols-3">{([
                      ['IMAGE TYPE', result.decisionSupport.imageType], ['LAND COVER', result.decisionSupport.landCover], ['MAIN FINDING', result.decisionSupport.mainFinding], ['POTENTIAL OPPORTUNITY', result.decisionSupport.potentialOpportunity], ['MAIN AFFECTED AREA', result.decisionSupport.mainAffectedArea], ['ENVIRONMENTAL CONCERN', result.decisionSupport.environmentalConcern], ['TOP RECOMMENDATION', result.decisionSupport.topRecommendation], ['CONFIDENCE', result.decisionSupport.confidence.toUpperCase()], ['DATA NEEDED', result.decisionSupport.dataNeeded],
                    ] as const).map(([label, value]) => <div key={label} className="bg-[#071019] px-3 py-2.5"><p className="font-mono text-[7px] tracking-widest text-cyan-100">{label}</p><p className="mt-1 font-mono text-[9px] leading-relaxed text-white/65">{value}</p></div>)}</div>
                    {result.decisionSupport.recommendations.length > 0 && <div className="border-t border-cyan-300/15 p-4"><p className="font-mono text-[9px] tracking-widest text-[#f4d889]">RANKED PRACTICAL RECOMMENDATIONS</p><div className="mt-3 grid gap-2">{result.decisionSupport.recommendations.map((item) => <details key={`${item.rank}-${item.recommendation}`} className="border border-white/10 bg-black/15 px-3 py-2"><summary className="cursor-pointer font-mono text-[9px] text-white/80"><span className="mr-2 text-[#f4d889]">{item.rank}.</span>{item.recommendation}</summary><div className="mt-2 grid gap-2 font-mono text-[8px] leading-relaxed text-white/55 sm:grid-cols-2"><p><span className="text-cyan-100">WHY:</span> {item.why}</p><p><span className="text-cyan-100">VISIBLE EVIDENCE:</span> {item.visibleEvidence}</p><p><span className="text-cyan-100">ADVANTAGES:</span> {item.advantages}</p><p><span className="text-[#ffcf87]">DISADVANTAGES / RISKS:</span> {item.disadvantages} {item.risks}</p><p className="sm:col-span-2"><span className="text-[#ffcf87]">REQUIRED VALIDATION:</span> {item.requiredValidation}</p></div></details>)}</div></div>}
                    {result.decisionSupport.qrRecords.length > 0 && <details className="border-t border-cyan-300/15 p-4"><summary className="cursor-pointer font-mono text-[9px] tracking-widest text-cyan-100">EVIDENCE QR + FIELD VERIFICATION · {result.decisionSupport.qrRecords.length}</summary><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/40">Each QR contains one self-describing evidence record. A field reviewer can open it, record their observation, and retain the verification on this device.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{result.decisionSupport.qrRecords.map((record) => <div key={record.id} className="border border-white/10 bg-black/15 p-3"><p className="font-mono text-[8px] text-[#f4d889]">{record.id} · {record.category.toUpperCase()}</p><p className="mt-1 font-mono text-[9px] text-white/80">{record.areaOrFeature}</p><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/55">{record.keyFinding}</p><p className="mt-2 font-mono text-[8px] text-cyan-100">Evidence: <span className="text-white/55">{record.evidence}</span></p><p className="mt-1 font-mono text-[8px] text-[#ffcf87]">Validation: <span className="text-white/55">{record.requiredValidation}</span></p><button type="button" onClick={() => openEvidenceQr(record)} className="mt-3 flex w-full items-center justify-center gap-1 border border-cyan-300/40 px-2 py-2 font-mono text-[8px] tracking-wider text-cyan-100 hover:bg-cyan-300/10"><QrCode className="h-3.5 w-3.5" />OPEN QR + VERIFY</button></div>)}</div></details>}
                  </div>}
                  <div className="p-4"><p className="font-mono text-[8px] tracking-widest text-cyan-100">UNDERSTAND</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#dce7f0]">{answerForMode(result.analysis, explanationMode)}</p><details className="mt-3 border-t border-white/10 pt-2"><summary className="cursor-pointer font-mono text-[8px] text-[#f4d889]">WHY?</summary><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/55">Evidence: {result.evidence?.[0]?.rationale || 'No localized evidence was returned.'}<br />Confidence: {result.decisionSupport?.confidence || 'needs review'}<br />Limitations: {result.limitations?.[0] || 'Confirm important findings with other data.'}</p></details></div>
                  </>}
                  <div className="flex flex-wrap items-center gap-2 border-t border-cyan-300/15 px-4 py-3"><span className="mr-1 font-mono text-[8px] tracking-widest text-white/40">WAS THIS USEFUL?</span>{([['confirmed', 'CONFIRMED'], ['uncertain', 'UNCERTAIN'], ['incorrect', 'INCORRECT']] as const).map(([value, label]) => <button key={value} onClick={() => setFeedback(value)} className={`border px-2 py-1 font-mono text-[8px] ${feedback === value ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100' : 'border-white/15 text-white/50 hover:border-white/35'}`}>{label}</button>)}{feedback && <span className="font-mono text-[8px] text-[#7fffa4]">SAVED FOR THIS SESSION</span>}</div>
                  {!simpleMode && <>{result.limitations?.length ? <div className="border-t border-[#d4af37]/20 px-4 py-3"><p className="mb-1 font-mono text-[9px] tracking-widest text-[#d4af37]">LIMITATIONS / AUDIT NOTES</p>{result.limitations.map((note) => <p key={note} className="font-mono text-[9px] leading-relaxed text-white/50">• {note}</p>)}</div> : null}
                  {result.execution ? <details className="border-t border-cyan-300/15 px-4 py-3"><summary className="cursor-pointer font-mono text-[9px] tracking-widest text-cyan-100">AUDITABLE AGENT EXECUTION · {result.execution.selectedTask.toUpperCase()}</summary><div className="mt-2 space-y-2 font-mono text-[9px] leading-relaxed text-white/60"><p>{result.execution.inputChecks.map((check) => `✓ ${check}`).join(' · ')}</p>{result.execution.steps.map((step, index) => <p key={`${step.tool}-${index}`}><span className="text-[#d4af37]">{index + 1}. {step.task.toUpperCase()}</span> — {step.tool}: {step.purpose}</p>)}{result.execution.warnings.map((warning) => <p key={warning} className="text-[#ffcf87]">! {warning}</p>)}</div></details> : null}
                  {result.incidentSearch ? <div className="border-t border-cyan-300/15 px-4 py-3"><p className="mb-1 font-mono text-[9px] tracking-widest text-cyan-100">INCIDENT SOURCES · LEARN MORE</p><p className="mb-2 font-mono text-[8px] leading-relaxed text-white/40">Open the original disaster-source website for further incident information.</p>{result.reports?.length ? result.reports.map((report) => report.url ? <a key={report.index} href={report.url} target="_blank" rel="noreferrer" className="mb-1 flex items-center justify-between gap-3 rounded border border-cyan-300/15 px-2 py-1.5 font-mono text-[10px] text-white/70 transition-colors hover:border-cyan-300/45 hover:bg-cyan-300/10 hover:text-cyan-100"><span><span className="mr-2 text-[#d4af37]">{report.date.slice(0, 10)}</span>{report.title} <span className="text-white/35">· {report.source}</span><span className="ml-2 text-cyan-200">OPEN ORIGINAL REPORT</span></span><ExternalLink className="h-3 w-3 shrink-0" /></a> : <div key={report.index} className="mb-1 rounded border border-white/10 px-2 py-1.5 font-mono text-[10px] text-white/45"><span className="mr-2 text-[#d4af37]">{report.date.slice(0, 10)}</span>{report.title} <span className="text-white/30">· Source URL unavailable</span></div>) : <a href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded border border-white/15 px-2 py-1.5 font-mono text-[9px] text-white/55 transition hover:border-cyan-300/45 hover:text-cyan-100"><span>No matching live incident record was returned. Browse NASA EONET.</span><ExternalLink className="h-3 w-3 shrink-0" /></a>}</div> : null}
                  {activeEvidenceRecord && <section className="border-t border-cyan-300/25 bg-[radial-gradient(circle_at_50%_0%,rgba(0,229,255,0.12),transparent_65%)] p-4"><div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-1 font-mono text-[9px] tracking-widest text-cyan-100"><ClipboardCheck className="h-3.5 w-3.5" />FIELD VERIFICATION RECORD</p><p className="mt-1 font-mono text-[8px] text-white/50">{activeEvidenceRecord.id} · {activeEvidenceRecord.areaOrFeature}</p></div><button type="button" onClick={() => setActiveEvidenceRecord(null)} className="border border-white/20 px-2 py-1 font-mono text-[8px] text-white/70">CLOSE</button></div><div className="mt-3 grid gap-4 md:grid-cols-[170px_1fr]"><div className="rounded-lg border border-cyan-200/35 bg-white p-2"><img src={`https://quickchart.io/qr?size=300&margin=2&ecLevel=M&text=${encodeURIComponent(evidenceQrPayload(activeEvidenceRecord, result))}`} alt={`QR evidence record ${activeEvidenceRecord.id}`} className="h-full w-full" /></div><div className="grid gap-2"><p className="font-mono text-[8px] leading-relaxed text-white/55">Scan to retain this individual evidence record. It carries no private field data and is not an official verified record.</p><div className="grid gap-2 sm:grid-cols-2"><input value={fieldVerification.verifier} onChange={(event) => setFieldVerification((current) => ({ ...current, verifier: event.target.value }))} placeholder="Verifier name *" className="border border-white/15 bg-black/25 px-2 py-2 font-mono text-[9px] text-white outline-none focus:border-cyan-300" /><select value={fieldVerification.status} onChange={(event) => setFieldVerification((current) => ({ ...current, status: event.target.value as FieldVerification['status'] }))} className="border border-white/15 bg-black/25 px-2 py-2 font-mono text-[9px] text-white outline-none focus:border-cyan-300"><option value="confirmed">Confirmed in field</option><option value="needs-review">Needs review</option><option value="not-observed">Not observed</option></select><input type="datetime-local" value={fieldVerification.observedAt} onChange={(event) => setFieldVerification((current) => ({ ...current, observedAt: event.target.value }))} className="border border-white/15 bg-black/25 px-2 py-2 font-mono text-[9px] text-white outline-none focus:border-cyan-300" /><input value={fieldVerification.latitude} onChange={(event) => setFieldVerification((current) => ({ ...current, latitude: event.target.value }))} placeholder="Latitude (optional)" className="border border-white/15 bg-black/25 px-2 py-2 font-mono text-[9px] text-white outline-none focus:border-cyan-300" /><input value={fieldVerification.longitude} onChange={(event) => setFieldVerification((current) => ({ ...current, longitude: event.target.value }))} placeholder="Longitude (optional)" className="border border-white/15 bg-black/25 px-2 py-2 font-mono text-[9px] text-white outline-none focus:border-cyan-300" /></div><textarea value={fieldVerification.notes} onChange={(event) => setFieldVerification((current) => ({ ...current, notes: event.target.value }))} placeholder="Field observation / photo reference *" rows={3} className="border border-white/15 bg-black/25 px-2 py-2 font-mono text-[9px] text-white outline-none focus:border-cyan-300" /><button type="button" onClick={saveFieldVerification} className="border border-[#d4af37]/55 bg-[#d4af37]/10 px-3 py-2 font-mono text-[8px] tracking-wider text-[#f4d889] hover:bg-[#d4af37]/20">SAVE FIELD VERIFICATION LOCALLY</button>{fieldVerificationMessage && <p className="font-mono text-[8px] text-[#7fffa4]">{fieldVerificationMessage}</p>}</div></div><p className="mt-3 font-mono text-[8px] leading-relaxed text-[#ffcf87]">Local-only prototype: field notes remain in this browser. A production deployment should send signed records and photos to an authenticated, auditable backend.</p></section>}</>}
                </motion.div>}
              </AnimatePresence>
              {history.length > 0 && <details className="mt-5 border border-white/10 bg-black/15 px-4 py-3"><summary className="cursor-pointer font-mono text-[9px] tracking-widest text-cyan-100">LOCAL ANALYSIS TIMELINE · {history.length}</summary><p className="mt-2 font-mono text-[8px] text-white/40">Browser-local sequence of analyses. Select two runs to compare their question, workflow, and saved finding side-by-side.</p>{history.length > 1 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{history.map((item) => <button key={`select-${item.id}`} type="button" onClick={() => setCompareHistoryIds((selected) => selected.includes(item.id) ? selected.filter((id) => id !== item.id) : selected.length < 2 ? [...selected, item.id] : [selected[1], item.id])} className={`border p-2 text-left ${compareHistoryIds.includes(item.id) ? 'border-cyan-300/70 bg-cyan-300/10' : 'border-white/10'}`}><span className="font-mono text-[8px] text-cyan-100">{compareHistoryIds.includes(item.id) ? 'SELECTED' : 'SELECT RUN'}</span><span className="mt-1 block font-mono text-[8px] text-white/50">{new Date(item.createdAt).toLocaleString()}</span></button>)}</div>}{compareHistoryIds.length === 2 && <div className="mt-3 grid gap-px border border-cyan-300/25 bg-cyan-300/15 md:grid-cols-2">{history.filter((item) => compareHistoryIds.includes(item.id)).map((item) => <div key={`comparison-${item.id}`} className="bg-[#071019] p-3"><p className="font-mono text-[8px] text-[#f4d889]">{item.mode.toUpperCase()} · {new Date(item.createdAt).toLocaleString()}</p><p className="mt-2 font-mono text-[9px] text-white/70">{item.query}</p><p className="mt-2 font-mono text-[8px] leading-relaxed text-white/45">{item.summary}</p></div>)}</div>}<div className="mt-3 space-y-2">{history.map((item) => <div key={item.id} className="border-l-2 border-white/15 px-2"><p className="font-mono text-[8px] text-white/45">{new Date(item.createdAt).toLocaleString()} · {item.mode.toUpperCase()}{typeof item.pairDifference === 'number' ? ` · ${item.pairDifference.toFixed(1)}% pair-screen flagged` : ''}</p><p className="font-mono text-[9px] text-white/70">{item.query}</p><p className="mt-0.5 font-mono text-[8px] leading-relaxed text-white/40">{item.summary}</p></div>)}</div></details>}
              </>}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
