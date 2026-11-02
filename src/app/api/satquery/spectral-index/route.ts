import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 12 * 1024 * 1024;

/**
 * Computes a normalized-difference index from operator-selected raster bands.
 * Band semantics are deliberately never guessed: RGB imagery has no reliable
 * NIR band, and an incorrect NDVI is worse than an unavailable result.
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const image = form.get('image');
    const numeratorBand = Number(form.get('numeratorBand'));
    const denominatorBand = Number(form.get('denominatorBand'));
    const index = String(form.get('index') || 'normalized-difference');
    if (!(image instanceof File)) return NextResponse.json({ error: 'A raster image is required.' }, { status: 400 });
    if (image.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Raster must be 12 MB or smaller.' }, { status: 413 });
    if (!Number.isInteger(numeratorBand) || !Number.isInteger(denominatorBand) || numeratorBand < 1 || denominatorBand < 1 || numeratorBand === denominatorBand) return NextResponse.json({ error: 'Select two different 1-based raster bands.' }, { status: 400 });

    const source = Buffer.from(await image.arrayBuffer());
    const decoded = await sharp(source, { limitInputPixels: 40_000_000 }).raw().toBuffer({ resolveWithObject: true });
    const { data, info } = decoded;
    if (numeratorBand > info.channels || denominatorBand > info.channels) return NextResponse.json({ error: `This raster exposes ${info.channels} band(s); choose band numbers within that range.` }, { status: 400 });

    // sharp's raw output is interleaved unsigned samples. A normalized
    // difference is scale-independent, so it remains valid for uncalibrated
    // digital numbers; the result is labelled accordingly by the client.
    const stride = Math.max(1, Math.ceil((info.width * info.height) / 1_000_000));
    let count = 0, sum = 0, min = Infinity, max = -Infinity;
    for (let pixel = 0; pixel < info.width * info.height; pixel += stride) {
      const a = data[pixel * info.channels + numeratorBand - 1];
      const b = data[pixel * info.channels + denominatorBand - 1];
      const total = a + b;
      if (!Number.isFinite(total) || total === 0) continue;
      const value = (a - b) / total;
      if (!Number.isFinite(value)) continue;
      count += 1; sum += value; min = Math.min(min, value); max = Math.max(max, value);
    }
    if (!count) return NextResponse.json({ error: 'The selected bands contain no valid normalized-difference samples.' }, { status: 422 });
    return NextResponse.json({ index, numeratorBand, denominatorBand, channels: info.channels, dimensions: { width: info.width, height: info.height }, sampledPixels: count, mean: sum / count, min, max, note: 'Computed from sampled source raster values. Band meaning, calibration, no-data masking, and atmospheric correction were not inferred.' });
  } catch (error) {
    console.error('[SATQUERY] spectral index failed:', error);
    return NextResponse.json({ error: 'The raster could not be decoded for spectral analysis. Use a supported multi-band TIFF/GeoTIFF.' }, { status: 422 });
  }
}
