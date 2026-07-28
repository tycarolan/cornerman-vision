/**
 * Synthetic trace builders for the analyzer tests.
 *
 * These are NOT a substitute for a recorded trace — they encode the schema, not
 * real motion. Once session 2 has run, a real export belongs beside them as a
 * regression fixture, and the figures the analyzer reports from it should
 * reproduce what is written into `docs/spec.md`.
 */

import type { Block, Punch, Sample, Trace } from '../trace-analysis';

let seq = 0;

export function makeBlock(over: Partial<Block> = {}): Block {
  const id = over.id ?? ++seq;
  return {
    id,
    label: 'jab',
    hand: 'lead',
    context: 'shadow',
    stance: 'orthodox',
    model: 'movenet-lightning',
    depthActive: false,
    expected: 10,
    t0: 0,
    t1: 10_000,
    f0: 0,
    f1: 600,
    detected: 10,
    detectedOnDeclaredHand: 10,
    ...over,
  };
}

export function makePunch(over: Partial<Punch> = {}): Punch {
  return { hand: 'lead', t: 0, ms: 98, frames: 6, peak: 1.5, elbow: 88, b: 1, ...over };
}

/**
 * A sample frame. `reach3`/`elbow3` default to the 2D values, matching what a
 * depth-less model emits — pass them explicitly to simulate a depth model.
 */
export function makeSample(over: {
  b?: number;
  d3?: boolean;
  conf?: number;
  leadReach2d?: number;
  leadReach3d?: number;
  rearReach2d?: number;
  rearReach3d?: number;
  leadElbow2d?: number;
  leadElbow3d?: number;
  rearElbow2d?: number;
  rearElbow3d?: number;
  dropBoth?: boolean;
  f?: number;
} = {}): Sample {
  const {
    b = 1, d3 = false, conf = 0.67, f = 0, dropBoth = false,
    leadReach2d = 0.32, rearReach2d = 0.3,
    leadElbow2d = 90, rearElbow2d = 90,
  } = over;
  const s: Sample = { t: f * 17, f, fps: 58, conf, d3, b };
  if (dropBoth) return s;
  s.lead = {
    reach: over.leadReach3d ?? leadReach2d,
    elbow: over.leadElbow3d ?? leadElbow2d,
    reach2d: leadReach2d,
    elbow2d: leadElbow2d,
  };
  s.rear = {
    reach: over.rearReach3d ?? rearReach2d,
    elbow: over.rearElbow3d ?? rearElbow2d,
    reach2d: rearReach2d,
    elbow2d: rearElbow2d,
  };
  return s;
}

export function makeTrace(over: Partial<Trace> = {}): Trace {
  const blocks = over.blocks ?? [makeBlock({ id: 1 })];
  return {
    schema: 3,
    ua: 'fixture/1.0',
    cfg: { thresh: 1.25, refract: 140, minConf: 0.3 },
    model: blocks[0]?.model ?? 'movenet-lightning',
    modelsUsed: [...new Set(blocks.map((b) => b.model))],
    stance: blocks[0]?.stance ?? 'orthodox',
    depthActive: false,
    meanFps: 57.9,
    inferenceFrames: 600,
    runSeconds: 10,
    framesPerPunch: 5.7,
    punches: [],
    samples: [],
    ...over,
    blocks,
  };
}

/** Reset block id numbering, so tests are order-independent. */
export function resetIds(): void {
  seq = 0;
}
