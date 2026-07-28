import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyze,
  analyzeBlocks,
  compareDimensions,
  handSeparation,
  modelPerformance,
  parseTrace,
  percentile,
  recallByPunchType,
  SUPPORTED_SCHEMA,
  UnsupportedTraceError,
} from './trace-analysis';
import { makeBlock, makePunch, makeSample, makeTrace, resetIds } from './fixtures/make-fixture';

beforeEach(resetIds);

describe('parseTrace', () => {
  it('treats an absent schema field as version 1 — session-1 exports predate it', () => {
    const { schema } = parseTrace({ ua: 'x', samples: [], punches: [] });
    expect(schema).toBe(1);
  });

  it('accepts the current schema', () => {
    expect(parseTrace(makeTrace()).schema).toBe(SUPPORTED_SCHEMA);
  });

  it('refuses a newer schema rather than misreading fields that moved', () => {
    expect(() => parseTrace(makeTrace({ schema: SUPPORTED_SCHEMA + 1 })))
      .toThrow(UnsupportedTraceError);
  });

  it('refuses a trace missing its arrays', () => {
    expect(() => parseTrace({ schema: 2, ua: 'x' })).toThrow(UnsupportedTraceError);
  });
});

describe('percentile', () => {
  it('returns null for an empty set rather than a misleading zero', () => {
    expect(percentile([], 99)).toBeNull();
  });

  it('reports the extremes', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 100)).toBe(10);
  });
});

describe('recallByPunchType', () => {
  it('computes recall against the declared rep count', () => {
    const trace = makeTrace({
      blocks: [
        makeBlock({ id: 1, label: 'jab', hand: 'lead', expected: 10, detected: 9, detectedOnDeclaredHand: 9 }),
        makeBlock({ id: 2, label: 'cross', hand: 'rear', expected: 10, detected: 0, detectedOnDeclaredHand: 0 }),
      ],
    });
    const rows = recallByPunchType(trace);
    expect(rows.find((r) => r.label === 'jab')?.recall).toBe(0.9);
    // The session-1 finding: zero rear-hand detections while crosses were thrown.
    expect(rows.find((r) => r.label === 'cross')?.recall).toBe(0);
  });

  it('pools repeated blocks of the same type, model and context', () => {
    const trace = makeTrace({
      blocks: [
        makeBlock({ id: 1, expected: 10, detected: 8, detectedOnDeclaredHand: 8 }),
        makeBlock({ id: 2, expected: 10, detected: 10, detectedOnDeclaredHand: 9 }),
      ],
    });
    const row = recallByPunchType(trace)[0];
    expect(row.blocks).toBe(2);
    expect(row.expected).toBe(20);
    expect(row.recall).toBe(0.9);
    expect(row.handRecall).toBe(0.85);
  });

  it('keeps models separate — a session spans several and pooling them is meaningless', () => {
    const trace = makeTrace({
      blocks: [
        makeBlock({ id: 1, model: 'movenet-lightning', expected: 10, detected: 10, detectedOnDeclaredHand: 10 }),
        makeBlock({ id: 2, model: 'blazepose-full', expected: 10, detected: 4, detectedOnDeclaredHand: 4 }),
      ],
    });
    const rows = recallByPunchType(trace);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.recall).sort()).toEqual([0.4, 1]);
  });

  it('keeps bag and shadowboxing separate — the punch terminates differently', () => {
    const trace = makeTrace({
      blocks: [
        makeBlock({ id: 1, context: 'shadow', expected: 10, detected: 10 }),
        makeBlock({ id: 2, context: 'bag', expected: 10, detected: 6 }),
      ],
    });
    expect(recallByPunchType(trace)).toHaveLength(2);
  });

  it('excludes freestyle blocks, which declare no ground truth', () => {
    const trace = makeTrace({
      blocks: [makeBlock({ id: 1, label: 'freestyle', hand: null, expected: null, detected: 40 })],
    });
    expect(recallByPunchType(trace)).toHaveLength(0);
  });
});

describe('analyzeBlocks', () => {
  it('reports over-detection as false positives rather than clamping recall', () => {
    const trace = makeTrace({ blocks: [makeBlock({ expected: 10, detected: 13 })] });
    const [b] = analyzeBlocks(trace);
    expect(b.recall).toBe(1.3);
    expect(b.falsePositives).toBe(3);
  });

  it('derives per-block framerate from the real frame counter', () => {
    const trace = makeTrace({ blocks: [makeBlock({ t0: 0, t1: 10_000, f0: 100, f1: 679 })] });
    expect(analyzeBlocks(trace)[0].fps).toBe(57.9);
  });

  it('flags a block that was still open at export', () => {
    const trace = makeTrace({ blocks: [makeBlock({ open: true })] });
    expect(analyzeBlocks(trace)[0].open).toBe(true);
  });
});

describe('handSeparation', () => {
  it('reproduces the session-1 shape: rear tracked but never crossing threshold', () => {
    // Rear hand present in nearly every frame, yet its reach never approaches the
    // lead hand's — the signal was never projected into the image.
    const samples = [
      ...Array.from({ length: 100 }, (_, f) =>
        makeSample({ f, leadReach2d: 1.6, rearReach2d: 0.85 })),
      ...Array.from({ length: 100 }, (_, f) =>
        makeSample({ f: f + 100, leadReach2d: 0.32, rearReach2d: 0.3 })),
    ];
    const trace = makeTrace({
      samples,
      blocks: [
        makeBlock({ id: 1, label: 'jab', hand: 'lead', expected: 10, detected: 10, detectedOnDeclaredHand: 10 }),
        makeBlock({ id: 2, label: 'cross', hand: 'rear', expected: 10, detected: 0, detectedOnDeclaredHand: 0 }),
      ],
    });
    const [s] = handSeparation(trace);
    expect(s.lead.crossings).toBe(100);
    expect(s.rear.crossings).toBe(0);
    expect(s.rear.frames).toBe(200);
    // Criterion 13 requires the gap within 10 points; a 100-point gap fails it.
    expect(s.recallGapPoints).toBe(-100);
  });

  it('reports a passing gap when both hands are equally legible', () => {
    const trace = makeTrace({
      samples: [makeSample({ leadReach2d: 1.6, rearReach2d: 1.55 })],
      blocks: [
        makeBlock({ id: 1, label: 'jab', hand: 'lead', expected: 10, detected: 10, detectedOnDeclaredHand: 10 }),
        makeBlock({ id: 2, label: 'cross', hand: 'rear', expected: 10, detected: 10, detectedOnDeclaredHand: 10 }),
      ],
    });
    expect(handSeparation(trace)[0].recallGapPoints).toBe(0);
  });

  it('returns a null gap when one hand was never declared', () => {
    const trace = makeTrace({
      samples: [makeSample({})],
      blocks: [makeBlock({ id: 1, hand: 'lead', expected: 10, detected: 10, detectedOnDeclaredHand: 10 })],
    });
    expect(handSeparation(trace)[0].recallGapPoints).toBeNull();
  });
});

describe('compareDimensions', () => {
  it('ignores frames without depth — comparing a metric against itself says nothing', () => {
    const trace = makeTrace({ samples: [makeSample({ d3: false })] });
    expect(compareDimensions(trace)).toHaveLength(0);
  });

  it('separates 2D from 3D on identical frames — the synthetic arm-along-axis case', () => {
    // The spec's synthetic check: an arm extended along the camera axis reads
    // reach 0.0 and elbow 90 in 2D, and reach 1.5 and elbow 180 in 3D.
    const trace = makeTrace({
      samples: Array.from({ length: 10 }, (_, f) =>
        makeSample({
          f, d3: true,
          rearReach2d: 0.0, rearReach3d: 1.5,
          rearElbow2d: 90, rearElbow3d: 180,
        })),
    });
    const [d] = compareDimensions(trace);
    expect(d.depthFrames).toBe(10);
    expect(d.rear.p99Reach3d).toBe(1.5);
    expect(d.rear.p99Reach2d).toBe(0);
    // Only the 3D metric crosses the threshold, so only it contributes a peak.
    expect(d.rear.peakElbow3d).toBe(180);
    expect(d.rear.peakElbow2d).toBe(90);
  });
});

describe('modelPerformance', () => {
  it('attributes frames and punches to the model that produced them', () => {
    const trace = makeTrace({
      blocks: [
        makeBlock({ id: 1, model: 'movenet-lightning', t0: 0, t1: 10_000, f0: 0, f1: 579 }),
        makeBlock({ id: 2, model: 'blazepose-full', t0: 10_000, t1: 20_000, f0: 579, f1: 829 }),
      ],
      punches: [
        makePunch({ b: 1, frames: 6 }),
        makePunch({ b: 2, frames: 3 }),
      ],
      samples: [makeSample({ b: 1 }), makeSample({ b: 2 })],
    });
    const perf = modelPerformance(trace);
    const blaze = perf.find((p) => p.model === 'blazepose-full')!;
    const move = perf.find((p) => p.model === 'movenet-lightning')!;
    expect(move.fps).toBe(57.9);
    expect(blaze.fps).toBe(25);
    // Three frames per punch sits under the floor at which classification was
    // to be abandoned; the analyzer says so rather than leaving it to be noticed.
    expect(blaze.belowClassificationFloor).toBe(true);
    expect(move.belowClassificationFloor).toBe(false);
  });

  it('measures two-arm dropout, since absence is data', () => {
    const trace = makeTrace({
      samples: [
        makeSample({ f: 0 }),
        makeSample({ f: 1 }),
        makeSample({ f: 2, dropBoth: true }),
        makeSample({ f: 3 }),
      ],
    });
    expect(modelPerformance(trace)[0].twoArmDropout).toBe(0.25);
  });
});

describe('analyze', () => {
  it('warns that a schema 1 trace cannot support recall', () => {
    const a = analyze({ ua: 'x', cfg: { thresh: 1.25, refract: 140, minConf: 0.3 }, samples: [], punches: [] });
    expect(a.schema).toBe(1);
    expect(a.caveats.join(' ')).toContain('recall cannot be computed');
  });

  it('warns when a trace spans several models', () => {
    const trace = makeTrace({
      blocks: [makeBlock({ id: 1, model: 'movenet-lightning' }), makeBlock({ id: 2, model: 'blazepose-lite' })],
    });
    expect(analyze(trace).caveats.join(' ')).toContain('never pooled');
  });

  it('warns when no frame carried depth', () => {
    expect(analyze(makeTrace({ samples: [makeSample({ d3: false })] })).caveats.join(' '))
      .toContain('comparison is empty');
  });

  it('warns when every block was freestyle', () => {
    const trace = makeTrace({ blocks: [makeBlock({ label: 'freestyle', hand: null, expected: null })] });
    expect(analyze(trace).caveats.join(' ')).toContain('no ground truth');
  });

  it('reports the declared stance', () => {
    expect(analyze(makeTrace()).stances).toEqual(['orthodox']);
  });

  it('warns that a pre-stance trace reads lead and rear as left and right', () => {
    // Schema 2 mapped lead onto the body's left unconditionally, so every hand
    // figure in such a trace is correct only if the operator happened to be
    // orthodox — and nothing in the file says whether they were.
    const trace = makeTrace({ schema: 2, blocks: [makeBlock({ stance: undefined })] });
    const a = analyze(trace);
    expect(a.stances).toEqual([]);
    expect(a.caveats.join(' ')).toContain('inverted if they were southpaw');
  });

  it('warns when a trace pools blocks thrown from different stances', () => {
    const trace = makeTrace({
      blocks: [makeBlock({ id: 1, stance: 'orthodox' }), makeBlock({ id: 2, stance: 'southpaw' })],
    });
    const a = analyze(trace);
    expect(a.stances).toEqual(['orthodox', 'southpaw']);
    expect(a.caveats.join(' ')).toContain('spans 2 stances');
  });

  it('does not raise the stance caveat on a schema 3 trace', () => {
    expect(analyze(makeTrace()).caveats.join(' ')).not.toContain('southpaw');
  });
});
