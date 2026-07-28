/**
 * Regression cover for the spike's frame-loop liveness machinery.
 *
 * The garage session of 2026-07-28 captured nothing. The frame loop died at the
 * first export — the iOS share sheet backgrounds the page and
 * requestVideoFrameCallback stops firing — and nothing re-armed it. The UI stayed
 * responsive, a block recorded 14.9 seconds of punching, and the export was
 * well-formed with `f1 - f0 === 0` and zero detections. Nothing on screen
 * distinguished that from a working run.
 *
 * These tests run the spike's real script in a stubbed DOM rather than a
 * reimplementation of it, because the defect was never in the logic as written
 * down — it was in what the page did when the browser stopped calling it.
 *
 * Not co-located beside `spike/index.html` on purpose: `npm run deploy:spike`
 * uploads that whole directory, so a test file there would ship to Vercel.
 */
import { readFileSync } from 'node:fs';
import { createContext, Script } from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

const SPIKE = new URL('../spike/index.html', import.meta.url);

/** Watchdog interval, in ms — the spike's own cadence, used to find its timer. */
const WATCHDOG_MS = 500;
/** Longer than the spike's STALL_MS, so any gap this size reads as stalled. */
const SILENCE = 5000;

interface StubElement {
  textContent: string;
  className: string;
  classList: { add(c: string): void; remove(c: string): void;
               toggle(c: string, on?: boolean): void; contains(c: string): boolean };
  _cls: Set<string>;
  [key: string]: unknown;
}

interface Harness {
  /** Advance the fake clock. */
  tick(ms: number): void;
  /** Fire the spike's watchdog once. */
  watchdog(): void;
  /** Fire the spike's visibilitychange handler. */
  foreground(): void;
  /** Read a stubbed element by id. */
  el(id: string): StubElement;
  /** Count of inference calls the stub detector has served. */
  inferenceCalls(): number;
  /** Replace the stub detector — used to model inference that hangs. */
  setInference(fn: () => Promise<unknown[]>): void;
  spike: {
    frameNo: number;
    lastFrameAt: number;
    readonly loopEpoch: number;
    readonly stalled: boolean;
    running: boolean;
    readonly curBlock: { label: string; f0: number; f1?: number } | null;
    readonly blocks: { f0: number; f1: number }[];
    loopAlive(): boolean;
    openBlock(label: string, expected: number | null): void;
    closeBlock(): void;
    onFrame(now: number, metadata: unknown, epoch: number): Promise<void>;
  };
}

/**
 * Loads the spike's inline script into a VM with a stubbed browser, and exposes
 * the lexically-scoped state the assertions need.
 */
function loadSpike(): Harness {
  const html = readFileSync(SPIKE, 'utf8');
  const match = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('spike/index.html has no inline script block');

  let now = 1000;
  const timers: { fn: () => void; ms: number }[] = [];
  let visHandler: () => void = () => {};
  let inferenceCalls = 0;

  const mkEl = (): StubElement => {
    const cls = new Set<string>();
    return {
      textContent: '', innerHTML: '', value: '', disabled: false, style: {},
      className: '', children: [], scrollTop: 0, clientWidth: 100, firstChild: null,
      classList: {
        add: (c) => void cls.add(c),
        remove: (c) => void cls.delete(c),
        toggle: (c, on) => void (on ? cls.add(c) : cls.delete(c)),
        contains: (c) => cls.has(c),
      },
      _cls: cls,
      addEventListener() {}, appendChild() {}, insertBefore() {}, remove() {},
      querySelector: () => null,
      getContext: () => new Proxy({}, { get: () => () => {} }),
    };
  };

  const els: Record<string, StubElement> = {};
  const el = (id: string) => (els[id] ??= mkEl());

  const sandbox: Record<string, unknown> = {
    console, Date, Math, JSON, Object, Array, Set, Map, Number, String, Boolean,
    Error, Proxy, Promise,
    Blob: class {},
    URL: { createObjectURL: () => 'blob:stub' },
    performance: { now: () => now },
    setInterval: (fn: () => void, ms: number) => timers.push({ fn, ms }),
    clearInterval: () => {},
    setTimeout: () => 0,
    requestAnimationFrame: () => 0,
    addEventListener: () => {},
    navigator: { userAgent: 'test', mediaDevices: {}, clipboard: {} },
    // Absent rVFC pushes schedule() down its requestAnimationFrame path, which
    // is inert here — frames are driven explicitly by the tests.
    HTMLVideoElement: { prototype: {} },
    poseDetection: {}, tf: {},
    document: {
      getElementById: el,
      createElement: mkEl,
      addEventListener: (ev: string, fn: () => void) => {
        if (ev === 'visibilitychange') visHandler = fn;
      },
      visibilityState: 'visible',
      body: mkEl(),
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  // `let` bindings at script top level are not reachable from the context, so
  // the accessors are appended to the real source rather than declared here.
  const epilogue = `
    globalThis.__spike = {
      get frameNo(){return frameNo}, set frameNo(v){frameNo=v},
      get lastFrameAt(){return lastFrameAt}, set lastFrameAt(v){lastFrameAt=v},
      get loopEpoch(){return loopEpoch},
      get stalled(){return stalled},
      get running(){return running}, set running(v){running=v},
      get curBlock(){return curBlock},
      get blocks(){return blocks},
      loopAlive, openBlock, closeBlock, onFrame,
      setDetector(d){ detector = d },
    };
  `;

  createContext(sandbox);
  new Script(match[1] + epilogue, { filename: 'spike/index.html' }).runInContext(sandbox);

  const spike = sandbox.__spike as Harness['spike'] & { setDetector(d: unknown): void };
  let inference = async (): Promise<unknown[]> => [];
  spike.setDetector({
    estimatePoses: async () => { inferenceCalls++; return inference(); },
  });

  const watchdogTimer = timers.find((t) => t.ms === WATCHDOG_MS);
  if (!watchdogTimer) throw new Error('spike registered no watchdog interval');

  return {
    tick: (ms) => { now += ms; },
    watchdog: () => watchdogTimer.fn(),
    foreground: () => visHandler(),
    el,
    inferenceCalls: () => inferenceCalls,
    setInference: (fn) => { inference = fn; },
    spike,
  };
}

let h: Harness;

beforeEach(() => {
  h = loadSpike();
  h.spike.running = true;
  h.spike.lastFrameAt = 1000;   // a frame has just landed
});

describe('loop liveness', () => {
  it('reports alive immediately after a frame', () => {
    expect(h.spike.loopAlive()).toBe(true);
  });

  it('reports dead once frames stop arriving', () => {
    h.tick(SILENCE);
    expect(h.spike.loopAlive()).toBe(false);
  });

  it('distinguishes a stopped loop from a stalled one', () => {
    h.spike.running = false;
    expect(h.spike.loopAlive()).toBe(false);
  });
});

describe('watchdog', () => {
  it('re-arms a loop that has stopped delivering frames', () => {
    h.tick(SILENCE);
    const before = h.spike.loopEpoch;
    h.watchdog();
    expect(h.spike.loopEpoch).toBe(before + 1);
  });

  it('marks the stall visibly rather than recovering in silence', () => {
    h.tick(SILENCE);
    h.watchdog();
    expect(h.spike.stalled).toBe(true);
    expect(h.el('blockbar')._cls.has('stalled')).toBe(true);
  });

  it('does nothing while frames are flowing', () => {
    const before = h.spike.loopEpoch;
    h.watchdog();
    expect(h.spike.loopEpoch).toBe(before);
  });

  it('does nothing while the loop is deliberately stopped', () => {
    h.spike.running = false;
    h.tick(SILENCE);
    const before = h.spike.loopEpoch;
    h.watchdog();
    expect(h.spike.loopEpoch).toBe(before);
  });
});

describe('visibilitychange', () => {
  // The export case: the share sheet backgrounds the page, the loop dies, and
  // returning to the foreground is the earliest moment recovery is possible.
  it('re-arms the loop when the page comes back and the loop is dead', () => {
    h.tick(SILENCE);
    const before = h.spike.loopEpoch;
    h.foreground();
    expect(h.spike.loopEpoch).toBe(before + 1);
  });

  it('leaves a healthy loop alone', () => {
    const before = h.spike.loopEpoch;
    h.foreground();
    expect(h.spike.loopEpoch).toBe(before);
  });
});

describe('epoch guard', () => {
  // Without this, a callback that fires late after a restart drives a second
  // concurrent loop into the same counters — corruption worse than the stall.
  it('ignores a callback scheduled under a superseded epoch', async () => {
    h.tick(SILENCE);
    h.watchdog();
    const stale = h.spike.loopEpoch - 1;
    const frames = h.spike.frameNo;

    await h.spike.onFrame(0, null, stale);

    expect(h.inferenceCalls()).toBe(0);
    expect(h.spike.frameNo).toBe(frames);
  });

  // The guard is checked twice for a reason. If inference itself is what hangs,
  // the watchdog starts a fresh loop while this call is still awaiting — and the
  // frame it eventually returns is already superseded.
  it('drops a frame whose epoch was superseded during inference', async () => {
    const frames = h.spike.frameNo;
    h.setInference(async () => {
      h.tick(SILENCE);
      h.watchdog();     // the loop is restarted mid-inference
      return [];
    });

    await h.spike.onFrame(0, null, h.spike.loopEpoch);

    expect(h.spike.frameNo).toBe(frames);
  });

  it('processes a callback on the current epoch', async () => {
    const frames = h.spike.frameNo;
    await h.spike.onFrame(0, null, h.spike.loopEpoch);
    expect(h.spike.frameNo).toBe(frames + 1);
  });

  it('clears the stall flag once a real frame lands', async () => {
    h.tick(SILENCE);
    h.watchdog();
    expect(h.spike.stalled).toBe(true);

    await h.spike.onFrame(0, null, h.spike.loopEpoch);

    expect(h.spike.stalled).toBe(false);
    expect(h.el('blockbar')._cls.has('stalled')).toBe(false);
  });
});

describe('block start gate', () => {
  it('refuses to open a block over a dead loop', () => {
    h.tick(SILENCE);
    h.spike.openBlock('jab', 10);
    expect(h.spike.curBlock).toBeNull();
  });

  it('kicks the loop on refusal so the retry can succeed', () => {
    h.tick(SILENCE);
    const before = h.spike.loopEpoch;
    h.spike.openBlock('jab', 10);
    expect(h.spike.loopEpoch).toBe(before + 1);
  });

  it('opens normally while frames are flowing', () => {
    h.spike.openBlock('jab', 10);
    expect(h.spike.curBlock?.label).toBe('jab');
  });

  it('closes a block regardless of liveness — a round must always be endable', () => {
    h.spike.openBlock('jab', 10);
    h.tick(SILENCE);
    h.spike.closeBlock();
    expect(h.spike.curBlock).toBeNull();
    expect(h.spike.blocks).toHaveLength(1);
  });
});

describe('the 2026-07-28 garage regression', () => {
  // Block opens over a live loop, the loop then dies mid-block, and 14.9s of
  // punching lands nowhere. The trace was well-formed and said nothing.
  const LOST_BLOCK_MS = 14906;

  it('surfaces the stall while the block is still open', () => {
    h.spike.openBlock('freestyle', null);
    expect(h.spike.curBlock).not.toBeNull();

    h.tick(LOST_BLOCK_MS);
    h.watchdog();

    expect(h.spike.stalled).toBe(true);
    expect(h.el('blockbar')._cls.has('stalled')).toBe(true);
  });

  it('still records the empty block honestly, as f1 - f0 === 0', () => {
    h.spike.openBlock('freestyle', null);
    h.tick(LOST_BLOCK_MS);
    h.watchdog();
    h.spike.closeBlock();

    const block = h.spike.blocks.at(-1)!;
    expect(block.f1 - block.f0).toBe(0);
  });
});
