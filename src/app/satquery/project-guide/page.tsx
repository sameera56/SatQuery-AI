const sections = [
  {
    title: 'Problem statement',
    body: 'Remote-sensing information is difficult for non-experts because images, sensors, GIS terms, and task-specific tools must usually be understood before a useful answer can be obtained. SATQUERY AI lets a user ask a natural-language question over one image, an optical–SAR pair, or a before/after pair, then returns evidence, confidence, limitations, and an auditable workflow.',
  },
  {
    title: 'Solution',
    body: 'SATQUERY AI is an agentic vision-language web assistant. It validates the supplied raster inputs, selects a permitted workflow from the query and image configuration, calls the available visual components, and presents a concise evidence-grounded answer rather than an unsupported claim.',
  },
] as const;

const modules = [
  ['Image intake', 'JPG/PNG/WebP and TIFF/GeoTIFF upload, size limits, preview, display-raster preparation, and image metadata.'],
  ['Pair validator', 'Checks pair presence, dimensions, and—when the adapter is connected—CRS, bounds, resolution, bands, and relevant sensor tags.'],
  ['Agent controller', 'Routes single image, optical–SAR, and bi-temporal requests and records the selected tools, checks, warnings, and allowed parameters.'],
  ['Vision-language analysis', 'Generates structured evidence, limitations, confidence labels, and text-guided evidence regions from the supplied image content.'],
  ['Remote-sensing adapter', 'BigEarthNet-adapted CLIP inference service for semantic retrieval evidence and a coarse bi-temporal heatmap after a trained checkpoint is connected.'],
  ['Decision support', 'Visual overlays, image-quality screen, map-linked GeoTIFF evidence, audio, downloadable PDF/JSON report, and shareable report flow.'],
] as const;

const datasets = [
  ['BigEarthNet.txt / BigEarthNet', 'Training and adaptation', 'Co-registered Sentinel-1 SAR and Sentinel-2 multispectral image–text data. Use a documented train/held-out split; retain licence, split IDs, seed, checkpoint hash, and Recall@1/Recall@5.'],
  ['VRSBench', 'Single-image benchmark', '29,614 images, 52,472 referring expressions, and 123,221 VQA pairs. Use its official held-out split for captioning, grounding, and VQA. Grounding uses normalized boxes; current upstream guidance uses a 0–100 coordinate convention.'],
  ['RSVQA', 'Single-image VQA benchmark', 'Use its official low/high-resolution split and report accuracy by question type where the evaluator provides it.'],
  ['CDVQA', 'Bi-temporal change VQA benchmark', 'Use ordered, co-registered image pairs and its official held-out split. Preserve T1/T2 image IDs, questions, predictions, and accuracy.'],
  ['ISRO/SAC set', 'Final evaluation only', 'Unseen Cartosat-2S optical and RISAT SAR pairs with undisclosed annotations. Never use it for training or tuning.'],
] as const;

const innovation = [
  'Query-conditioned routing: the same interface chooses VQA, grounding, cross-modal, or change understanding from the mode and query intent.',
  'Evidence-first answers: overlays, input checks, model/tool trace, confidence, and limitations are returned with the answer.',
  'Sensor-aware safety: optical–SAR and date-pair workflows surface co-registration and SAR-interpretation warnings instead of treating all pixels alike.',
  'Accessible operation: image-specific question suggestions, voice input, speech output, and results in 11 Indian-language options.',
  'Practical next innovation: calibrated specialist confidence, cloud/shadow quality masks, a task-trained change segmentation model, active-learning feedback, and offline field-report synchronization.',
] as const;

export default async function ProjectGuidePage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  const isSimpleWorkspace = workspace === 'simple';
  const returnHref = isSimpleWorkspace ? '/analysis' : '/government';
  const returnLabel = isSimpleWorkspace ? '← BACK TO SIMPLE WORKSPACE' : '← BACK TO EXPERT WORKSPACE';

  return (
    <main className="docs-root min-h-screen bg-[#050a12] px-4 py-10 text-white sm:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-xs tracking-[0.22em] text-cyan-200">SATQUERY AI · JURY GUIDE</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">How SATQUERY AI works</h1></div><div className="flex flex-wrap gap-2"><a href={returnHref} className="rounded border border-white/25 px-3 py-2 font-mono text-xs text-white/75 hover:border-cyan-300/50 hover:bg-cyan-300/10 hover:text-cyan-100">{returnLabel}</a><a href="/satquery/evaluation" className="rounded border border-cyan-300/35 px-3 py-2 font-mono text-xs text-cyan-100 hover:bg-cyan-300/10">EVALUATION READINESS →</a></div></div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">{sections.map((section) => <article key={section.title} className="rounded-xl border border-white/15 bg-white/[0.03] p-5"><h2 className="font-mono text-sm tracking-[0.14em] text-cyan-100">{section.title.toUpperCase()}</h2><p className="mt-3 text-sm leading-6 text-white/70">{section.body}</p></article>)}</div>

        <section className="mt-6 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.04] p-5"><h2 className="font-mono text-sm tracking-[0.14em] text-cyan-100">WORKFLOW · QUERY TO ANSWER</h2><div className="mt-4 grid gap-3 text-center text-xs font-medium md:grid-cols-5">{['User query + image(s)', 'Input / pair checks', 'Intent + mode router', 'Specialist tools', 'Evidence report'].map((step, index) => <div key={step} className="rounded border border-white/15 bg-black/20 p-3 text-white/75"><span className="block text-cyan-200">{index + 1}</span><span className="mt-1 block">{step}</span></div>)}</div><p className="mt-4 text-sm leading-6 text-white/65">For a single image the route is remote-sensing VQA or text-guided grounding. For a before/after pair it is pair validation → change understanding → change-VQA/reporting. For an optical–SAR pair it is pair validation → complementary multimodal extraction → reporting.</p></section>

        <section className="mt-8"><h2 className="font-mono text-sm tracking-[0.14em] text-cyan-100">MODULES & TECHNICAL APPROACH</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{modules.map(([name, detail]) => <article key={name} className="rounded-xl border border-white/15 p-4"><h3 className="font-medium text-white">{name}</h3><p className="mt-2 text-sm leading-6 text-white/65">{detail}</p></article>)}</div><p className="mt-4 text-sm leading-6 text-white/60">Implementation: Next.js + TypeScript web UI/API, Sharp raster decoding/diagnostics, MapLibre evidence display, a deterministic TypeScript task router, Gemini structured multimodal output, and an optional Python/FastAPI BigEarthNet-adapted CLIP service. The controller is deliberately separate from the language model so routing and the observable execution trace are reproducible.</p></section>

        <section className="mt-8 overflow-x-auto rounded-xl border border-white/15"><table className="w-full min-w-[860px] border-collapse text-left text-sm"><thead className="bg-white/10 font-mono text-xs tracking-wide text-cyan-100"><tr><th className="p-4">Dataset</th><th className="p-4">Use</th><th className="p-4">Parameters / handling</th></tr></thead><tbody>{datasets.map(([dataset, use, details]) => <tr key={dataset} className="border-t border-white/10 align-top"><td className="p-4 font-medium">{dataset}</td><td className="p-4 text-white/70">{use}</td><td className="p-4 leading-6 text-white/65">{details}</td></tr>)}</tbody></table></section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2"><article className="rounded-xl border border-white/15 p-5"><h2 className="font-mono text-sm tracking-[0.14em] text-cyan-100">NLP, MULTILINGUAL & LANGUAGE ASSISTANT</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-white/70"><li>Intent routing currently uses explainable query cues such as “highlight”, “where”, “change”, “before/after”, “increase”, and “decrease”, combined with the selected input mode.</li><li>Prompt engineering constrains the VLM to visible evidence, structured JSON, evidence regions, confidence, and limitations; it must not invent place, date, sensor, or measured area.</li><li>The interface provides image-specific query suggestions, microphone input/transcription, speech output, and English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Malayalam, Kannada, Punjabi, and Urdu result options.</li><li>Translation is requested as part of the structured response; speech uses the matching browser language voice where available.</li></ul></article><article className="rounded-xl border border-white/15 p-5"><h2 className="font-mono text-sm tracking-[0.14em] text-cyan-100">WHAT HAPPENS IN THE BACKGROUND</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/70"><li>The browser validates file type/size, creates a preview, and resizes ordinary display images for efficient analysis. TIFF/GeoTIFF remains traceable while the server creates a compatible analysis raster.</li><li>The API records metadata and constructs a deterministic execution plan. Paired modes require a second input and emit co-registration warnings.</li><li>If a trained adapter is connected, it validates GeoTIFF pair metadata and returns adapted semantic retrieval evidence; bi-temporal mode can add a coarse semantic heatmap.</li><li>The vision-language stage receives the permitted image(s) and query and returns structured findings, labelled evidence boxes, confidence, and limitations.</li><li>The UI renders the answer and overlays, shows the agent trace, and can export the result. Without a connected trained adapter, the UI must not claim remote-sensing fine-tuning is active.</li></ol></article></section>

        <section className="mt-8 rounded-xl border border-[#d4af37]/35 bg-[#d4af37]/[0.06] p-5"><h2 className="font-mono text-sm tracking-[0.14em] text-[#f4d889]">HOW WE ARE DIFFERENT · MULTIPLE SPECIALIST MODELS</h2><p className="mt-3 text-sm leading-6 text-white/70">A generic chatbot gives one opaque answer. SATQUERY constrains the job before answering: input validator → task router → selected visual specialist(s) → evidence/report layer. The current project implements this controller, VQA/grounding UI, paired workflows, and the integration point for a BigEarthNet-adapted CLIP specialist. Before final judging, train and connect that adapter and add task-trained change/fusion specialists with official VRSBench, RSVQA, and CDVQA results. This is the correct, defensible way to claim “multiple specialised models”.</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-white/70">{innovation.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </section>
    </main>
  );
}
