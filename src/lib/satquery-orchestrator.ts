export type SatQueryMode = 'optical' | 'sar' | 'optical-sar' | 'bi-temporal';

export type InputDescriptor = {
  filename: string;
  mimeType: string;
  width?: number;
  height?: number;
  isGeoTiff: boolean;
  channels?: number;
  density?: number;
};

export type ExecutionStep = {
  task: string;
  tool: string;
  purpose: string;
  parameters: Record<string, string | number | boolean>;
};

export type ExecutionPlan = {
  selectedTask: string;
  inputChecks: string[];
  steps: ExecutionStep[];
  warnings: string[];
};

/**
 * Observable, deterministic routing for SIH26167. This is intentionally kept
 * separate from the language model: the model describes image evidence, while
 * this controller records which remote-sensing workflow was selected and why.
 */
export function createExecutionPlan(
  mode: SatQueryMode,
  query: string,
  first: InputDescriptor,
  second?: InputDescriptor,
): ExecutionPlan {
  const normalized = query.toLowerCase();
  const asksForRegions = /where|highlight|locate|region|area|boundary|water body/.test(normalized);
  const asksForChange = /change|changed|increase|decrease|before|after|between|growth|loss/.test(normalized);
  const inputChecks = [
    `${first.isGeoTiff ? 'GeoTIFF/TIFF' : 'Raster'} input accepted: ${first.filename}`,
    first.width && first.height ? `Input dimensions checked: ${first.width} × ${first.height}px` : 'Input dimensions checked',
  ];
  const warnings: string[] = [];
  if (second) inputChecks.push(`${second.isGeoTiff ? 'GeoTIFF/TIFF' : 'Raster'} paired input accepted: ${second.filename}`);

  if (mode === 'bi-temporal') {
    inputChecks.push('Bi-temporal pair required and supplied');
    warnings.push('Change findings require spatially corresponding, co-registered images.');
    return {
      selectedTask: asksForChange ? 'change visual question answering' : 'change description',
      inputChecks,
      warnings,
      steps: [
        { task: 'pair compatibility', tool: 'geo-raster-validator', purpose: 'Validate compatible raster inputs and record image metadata.', parameters: { pair: true, mode } },
        { task: 'change understanding', tool: 'remote-sensing-change-adapter', purpose: 'Compare corresponding areas across the two acquisition dates.', parameters: { evidenceRegions: true } },
        { task: 'answer synthesis', tool: 'vision-language-reporter', purpose: 'Return an evidence-grounded answer with confidence and limitations.', parameters: { queryGrounded: true } },
      ],
    };
  }

  if (mode === 'optical-sar') {
    inputChecks.push('Co-registered optical–SAR pair required and supplied');
    warnings.push('Optical and SAR observations can differ because of sensor physics and acquisition geometry.');
    return {
      selectedTask: 'cross-modal optical–SAR analysis',
      inputChecks,
      warnings,
      steps: [
        { task: 'pair compatibility', tool: 'geo-raster-validator', purpose: 'Validate the optical–SAR pair before fusion.', parameters: { pair: true, mode } },
        { task: 'multimodal extraction', tool: 'optical-sar-fusion-adapter', purpose: 'Extract complementary optical and radar evidence.', parameters: { modality: 'optical-sar' } },
        { task: 'answer synthesis', tool: 'vision-language-reporter', purpose: 'Answer the user query and attach visual evidence.', parameters: { queryGrounded: true } },
      ],
    };
  }

  const task = asksForRegions ? 'text-guided region grounding' : 'remote-sensing visual question answering';
  if (mode === 'sar') warnings.push('SAR brightness alone does not confirm object class or land cover.');
  return {
    selectedTask: task,
    inputChecks,
    warnings,
    steps: [
      { task: 'input validation', tool: 'geo-raster-validator', purpose: 'Validate format, dimensions, and modality.', parameters: { mode } },
      { task, tool: 'remote-sensing-vqa-adapter', purpose: asksForRegions ? 'Ground the text query in image regions.' : 'Answer the query from visible remote-sensing evidence.', parameters: { modality: mode, grounding: asksForRegions } },
      { task: 'answer synthesis', tool: 'vision-language-reporter', purpose: 'Generate a concise answer, confidence, and limitations.', parameters: { queryGrounded: true } },
    ],
  };
}
