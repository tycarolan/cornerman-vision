/**
 * Offline analysis over traces exported by `spike/index.html`.
 *
 * Pure functions only — no filesystem, no console. The CLI in `analyze-trace.ts`
 * supplies I/O, and this module is what the tests drive against fixtures.
 *
 * The schema this reads is documented in `docs/knowledge/domains/trace-format.md`.
 */

/** Highest export schema this module knows how to read. */
export const SUPPORTED_SCHEMA = 2;

export interface SideSample {
  /** Depth-aware where the model supplies it; identical to `reach2d` otherwise. */
  reach: number;
  elbow: number;
  /** Always the projected 2D value, on the same frame. */
  reach2d: number;
  elbow2d: number;
}

export interface Sample {
  t: number;
  f: number;
  fps: number;
  conf: number;
  /** Whether depth was live for this frame. */
  d3: boolean;
  /** Block id. Absent on schema 1 traces. */
  b?: number;
  lead?: SideSample;
  rear?: SideSample;
}

export interface Punch {
  hand: 'lead' | 'rear';
  t: number;
  ms: number;
  frames: number;
  peak: number;
  elbow: number;
  b?: number;
}

export interface Block {
  id: number;
  label: string;
  hand: 'lead' | 'rear' | null;
  context: 'shadow' | 'bag';
  model: string;
  depthActive: boolean;
  /** Declared rep count. Null for freestyle blocks, which have no ground truth. */
  expected: number | null;
  t0: number;
  t1?: number;
  f0: number;
  f1?: number;
  detected: number;
  detectedOnDeclaredHand: number;
  open?: boolean;
}

export interface Trace {
  schema?: number;
  ua: string;
  cfg: { thresh: number; refract: number; minConf: number };
  model: string;
  modelsUsed?: string[];
  depthActive: boolean;
  meanFps: number | null;
  inferenceFrames: number;
  runSeconds: number;
  framesPerPunch: number | null;
  blocks?: Block[];
  punches: Punch[];
  samples: Sample[];
}

export class UnsupportedTraceError extends Error {}

/**
 * Validate a parsed trace and normalize its version.
 *
 * Refuses schema versions it does not recognize rather than reading a file whose
 * fields have moved — a misread trace produces plausible, wrong numbers, which is
 * the failure mode this project keeps hitting.
 *
 * @throws {UnsupportedTraceError} if the schema version is newer than supported.
 */
export function parseTrace(raw: unknown): { trace: Trace; schema: number } {
  if (raw === null || typeof raw !== 'object') {
    throw new UnsupportedTraceError('Trace is not an object.');
  }
  const t = raw as Trace;
  // Session-1 exports predate the field entirely.
  const schema = t.schema ?? 1;
  if (!Number.isInteger(schema) || schema < 1) {
    throw new UnsupportedTraceError(`Trace declares a nonsensical schema: ${String(t.schema)}`);
  }
  if (schema > SUPPORTED_SCHEMA) {
    throw new UnsupportedTraceError(
      `Trace schema ${schema} is newer than this analyzer supports (${SUPPORTED_SCHEMA}). ` +
        'Update the analyzer rather than reading it anyway.',
    );
  }
  if (!Array.isArray(t.samples) || !Array.isArray(t.punches)) {
    throw new UnsupportedTraceError('Trace is missing its samples or punches array.');
  }
  return { trace: t, schema };
}

/** Percentile over an unsorted numeric array. Returns null for an empty input. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

const round = (n: number | null, dp = 2): number | null =>
  n === null ? null : +n.toFixed(dp);

export interface BlockResult {
  id: number;
  label: string;
  context: string;
  model: string;
  hand: 'lead' | 'rear' | null;
  expected: number | null;
  detected: number;
  onDeclaredHand: number;
  /** detected / expected. Null for freestyle blocks. May exceed 1 — see falsePositives. */
  recall: number | null;
  /** Detections beyond the declared rep count. A false-positive signal, not clamped away. */
  falsePositives: number;
  /** Frames per second sustained within this block, from the real frame counter. */
  fps: number | null;
  open: boolean;
}

/** Per-block recall, hand agreement, and sustained framerate. */
export function analyzeBlocks(trace: Trace): BlockResult[] {
  return (trace.blocks ?? []).map((b) => {
    const spanSec = b.t1 !== undefined ? (b.t1 - b.t0) / 1000 : null;
    const frames = b.f1 !== undefined ? b.f1 - b.f0 : null;
    return {
      id: b.id,
      label: b.label,
      context: b.context,
      model: b.model,
      hand: b.hand,
      expected: b.expected,
      detected: b.detected,
      onDeclaredHand: b.detectedOnDeclaredHand,
      recall: b.expected ? round(b.detected / b.expected, 3) : null,
      falsePositives: b.expected ? Math.max(0, b.detected - b.expected) : 0,
      fps: spanSec && frames !== null && spanSec > 0 ? round(frames / spanSec, 1) : null,
      open: b.open === true,
    };
  });
}

export interface RecallRow {
  model: string;
  label: string;
  context: string;
  hand: 'lead' | 'rear' | null;
  expected: number;
  detected: number;
  onDeclaredHand: number;
  recall: number;
  /** Recall counting only detections on the hand the label implies. */
  handRecall: number;
  blocks: number;
}

/**
 * Recall aggregated per model, punch type, and context — the table the model
 * decision turns on. Freestyle blocks are excluded: they declare no rep count,
 * so they carry no ground truth.
 */
export function recallByPunchType(trace: Trace): RecallRow[] {
  const acc = new Map<string, RecallRow>();
  for (const b of trace.blocks ?? []) {
    if (!b.expected) continue;
    const key = `${b.model}|${b.label}|${b.context}`;
    const row = acc.get(key) ?? {
      model: b.model,
      label: b.label,
      context: b.context,
      hand: b.hand,
      expected: 0,
      detected: 0,
      onDeclaredHand: 0,
      recall: 0,
      handRecall: 0,
      blocks: 0,
    };
    row.expected += b.expected;
    row.detected += b.detected;
    row.onDeclaredHand += b.detectedOnDeclaredHand;
    row.blocks += 1;
    acc.set(key, row);
  }
  for (const row of acc.values()) {
    row.recall = +(row.detected / row.expected).toFixed(3);
    row.handRecall = +(row.onDeclaredHand / row.expected).toFixed(3);
  }
  return [...acc.values()].sort(
    (a, b) => a.model.localeCompare(b.model) || a.context.localeCompare(b.context) || a.label.localeCompare(b.label),
  );
}

export interface HandSeparation {
  model: string;
  lead: { medianReach: number | null; p99Reach: number | null; crossings: number; frames: number };
  rear: { medianReach: number | null; p99Reach: number | null; crossings: number; frames: number };
  /** Rear p99 as a fraction of lead p99. Near 1 means the hands are equally legible. */
  ratio: number | null;
  /**
   * Rear-hand recall minus lead-hand recall, in percentage points, over labelled
   * blocks. Acceptance criterion 13 requires this within 10 points.
   */
  recallGapPoints: number | null;
}

/**
 * Lead-versus-rear legibility — the criterion-13 number.
 *
 * Reach distributions come from the sample stream (every frame), threshold
 * crossings from the configured detection threshold, and the recall gap from the
 * labelled blocks. The three answer the same question from different directions:
 * session 1 showed the rear hand present in 91% of frames yet crossing the
 * threshold 6 times against the lead hand's 101.
 */
export function handSeparation(trace: Trace, threshold = trace.cfg?.thresh ?? 1.25): HandSeparation[] {
  const byModel = new Map<number, string>();
  for (const b of trace.blocks ?? []) byModel.set(b.id, b.model);

  const buckets = new Map<string, { lead: number[]; rear: number[] }>();
  for (const s of trace.samples) {
    const model = (s.b !== undefined ? byModel.get(s.b) : undefined) ?? trace.model;
    const bucket = buckets.get(model) ?? { lead: [], rear: [] };
    if (s.lead) bucket.lead.push(s.lead.reach);
    if (s.rear) bucket.rear.push(s.rear.reach);
    buckets.set(model, bucket);
  }

  const recall = recallByPunchType(trace);
  const results: HandSeparation[] = [];

  for (const [model, bucket] of buckets) {
    const side = (vals: number[]) => ({
      medianReach: round(percentile(vals, 50), 3),
      p99Reach: round(percentile(vals, 99), 3),
      crossings: vals.filter((v) => v > threshold).length,
      frames: vals.length,
    });
    const lead = side(bucket.lead);
    const rear = side(bucket.rear);

    const forHand = (h: 'lead' | 'rear') => {
      const rows = recall.filter((r) => r.model === model && r.hand === h);
      if (rows.length === 0) return null;
      const exp = rows.reduce((a, r) => a + r.expected, 0);
      const det = rows.reduce((a, r) => a + r.onDeclaredHand, 0);
      return exp > 0 ? det / exp : null;
    };
    const leadRecall = forHand('lead');
    const rearRecall = forHand('rear');

    results.push({
      model,
      lead,
      rear,
      ratio: lead.p99Reach && rear.p99Reach ? round(rear.p99Reach / lead.p99Reach, 3) : null,
      recallGapPoints:
        leadRecall !== null && rearRecall !== null ? round((rearRecall - leadRecall) * 100, 1) : null,
    });
  }
  return results.sort((a, b) => a.model.localeCompare(b.model));
}

export interface DimensionComparison {
  model: string;
  /** Frames where the model actually supplied depth. Zero means nothing to compare. */
  depthFrames: number;
  lead: DimensionPair;
  rear: DimensionPair;
}

export interface DimensionPair {
  p99Reach3d: number | null;
  p99Reach2d: number | null;
  medianElbow3d: number | null;
  medianElbow2d: number | null;
  /** Peak-frame elbow angles, 3D and 2D, over frames where reach crossed threshold. */
  peakElbow3d: number | null;
  peakElbow2d: number | null;
}

/**
 * The 2D-versus-3D comparison, taken on identical frames.
 *
 * This is the whole model argument. The trace format records both metrics on
 * every frame precisely so this comparison never has to be made across two
 * separate runs, where the punches would differ.
 *
 * Only frames with `d3` set are included: on a model without depth the two
 * metrics are the same numbers and comparing them says nothing.
 */
export function compareDimensions(
  trace: Trace,
  threshold = trace.cfg?.thresh ?? 1.25,
): DimensionComparison[] {
  const byModel = new Map<number, string>();
  for (const b of trace.blocks ?? []) byModel.set(b.id, b.model);

  const buckets = new Map<
    string,
    { n: number; lead: Acc; rear: Acc }
  >();
  type Acc = { r3: number[]; r2: number[]; e3: number[]; e2: number[]; pe3: number[]; pe2: number[] };
  const emptyAcc = (): Acc => ({ r3: [], r2: [], e3: [], e2: [], pe3: [], pe2: [] });

  for (const s of trace.samples) {
    if (!s.d3) continue;
    const model = (s.b !== undefined ? byModel.get(s.b) : undefined) ?? trace.model;
    const bucket = buckets.get(model) ?? { n: 0, lead: emptyAcc(), rear: emptyAcc() };
    bucket.n += 1;
    for (const hand of ['lead', 'rear'] as const) {
      const v = s[hand];
      if (!v) continue;
      const acc = bucket[hand];
      acc.r3.push(v.reach);
      acc.r2.push(v.reach2d);
      acc.e3.push(v.elbow);
      acc.e2.push(v.elbow2d);
      if (v.reach > threshold) {
        acc.pe3.push(v.elbow);
        acc.pe2.push(v.elbow2d);
      }
    }
    buckets.set(model, bucket);
  }

  const pair = (a: Acc): DimensionPair => ({
    p99Reach3d: round(percentile(a.r3, 99), 3),
    p99Reach2d: round(percentile(a.r2, 99), 3),
    medianElbow3d: round(percentile(a.e3, 50), 1),
    medianElbow2d: round(percentile(a.e2, 50), 1),
    peakElbow3d: round(percentile(a.pe3, 50), 1),
    peakElbow2d: round(percentile(a.pe2, 50), 1),
  });

  return [...buckets.entries()]
    .map(([model, b]) => ({ model, depthFrames: b.n, lead: pair(b.lead), rear: pair(b.rear) }))
    .sort((a, b) => a.model.localeCompare(b.model));
}

export interface ModelPerformance {
  model: string;
  frames: number;
  seconds: number;
  fps: number | null;
  punches: number;
  framesPerPunch: number | null;
  /** Mean keypoint confidence over the model's frames. */
  meanConfidence: number | null;
  /** Fraction of frames where neither arm cleared the confidence floor. */
  twoArmDropout: number | null;
  /** True when frames per punch sits under the floor at which classification was to be abandoned. */
  belowClassificationFloor: boolean;
}

/** Sustained framerate, frames per punch, and tracking quality, per model. */
export function modelPerformance(trace: Trace): ModelPerformance[] {
  const blocks = trace.blocks ?? [];
  const byModel = new Map<number, string>();
  for (const b of blocks) byModel.set(b.id, b.model);

  const acc = new Map<
    string,
    { frames: number; seconds: number; punches: number; punchFrames: number; conf: number[]; dropped: number; n: number }
  >();
  const get = (m: string) => {
    const cur = acc.get(m) ?? { frames: 0, seconds: 0, punches: 0, punchFrames: 0, conf: [], dropped: 0, n: 0 };
    acc.set(m, cur);
    return cur;
  };

  for (const b of blocks) {
    if (b.t1 === undefined || b.f1 === undefined) continue;
    const cur = get(b.model);
    cur.frames += b.f1 - b.f0;
    cur.seconds += (b.t1 - b.t0) / 1000;
  }
  for (const s of trace.samples) {
    const model = (s.b !== undefined ? byModel.get(s.b) : undefined) ?? trace.model;
    const cur = get(model);
    cur.conf.push(s.conf);
    cur.n += 1;
    if (!s.lead && !s.rear) cur.dropped += 1;
  }
  for (const p of trace.punches) {
    const model = (p.b !== undefined ? byModel.get(p.b) : undefined) ?? trace.model;
    const cur = get(model);
    cur.punches += 1;
    cur.punchFrames += p.frames;
  }

  return [...acc.entries()]
    .map(([model, a]) => {
      // Fall back to the trace-level totals when no block bounded the run —
      // schema 1 traces have no blocks at all.
      const seconds = a.seconds > 0 ? a.seconds : trace.runSeconds;
      const frames = a.frames > 0 ? a.frames : trace.inferenceFrames;
      const fpp = a.punches > 0 ? a.punchFrames / a.punches : null;
      return {
        model,
        frames,
        seconds: round(seconds, 2) ?? 0,
        fps: seconds > 0 ? round(frames / seconds, 1) : null,
        punches: a.punches,
        framesPerPunch: round(fpp, 2),
        meanConfidence: a.conf.length ? round(a.conf.reduce((x, y) => x + y, 0) / a.conf.length, 3) : null,
        twoArmDropout: a.n > 0 ? round(a.dropped / a.n, 4) : null,
        belowClassificationFloor: fpp !== null && fpp < 4,
      };
    })
    .sort((a, b) => a.model.localeCompare(b.model));
}

export interface Analysis {
  schema: number;
  device: string;
  config: Trace['cfg'];
  modelsUsed: string[];
  /** Warnings about what this trace cannot support, rather than silent omission. */
  caveats: string[];
  blocks: BlockResult[];
  recall: RecallRow[];
  separation: HandSeparation[];
  dimensions: DimensionComparison[];
  performance: ModelPerformance[];
}

/** Run every analysis over one parsed trace. */
export function analyze(raw: unknown): Analysis {
  const { trace, schema } = parseTrace(raw);
  const blocks = trace.blocks ?? [];
  const labelled = blocks.filter((b) => b.expected);
  const caveats: string[] = [];

  if (schema < 2) {
    caveats.push(
      'Schema 1 trace: no labelled blocks, so recall cannot be computed. ' +
        'Framerate, reach distributions, and lead-versus-rear separation are still valid.',
    );
  }
  if (schema >= 2 && labelled.length === 0) {
    caveats.push('No labelled blocks in this trace — every block was freestyle, so there is no ground truth to compute recall against.');
  }
  if (blocks.some((b) => b.open)) {
    caveats.push('One block was still open at export. Its counts are real but its span is truncated.');
  }
  const models = trace.modelsUsed ?? [trace.model];
  if (models.length > 1) {
    caveats.push(`Trace spans ${models.length} models — every figure below is reported per model, never pooled.`);
  }
  if (!trace.samples.some((s) => s.d3)) {
    caveats.push('No frame in this trace carried depth, so the 2D-versus-3D comparison is empty.');
  }

  return {
    schema,
    device: trace.ua,
    config: trace.cfg,
    modelsUsed: models,
    caveats,
    blocks: analyzeBlocks(trace),
    recall: recallByPunchType(trace),
    separation: handSeparation(trace),
    dimensions: compareDimensions(trace),
    performance: modelPerformance(trace),
  };
}
