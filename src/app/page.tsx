/**
 * Deliberately minimal placeholder. Phase 1 (camera, pose, pipeline) is
 * blocked pending the MoveNet-vs-BlazePose decision — see docs/spec.md and
 * docs/plan.md. Do not add product surface here until that gate clears.
 */
export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cornerman Vision
        </h1>
        <p className="text-sm text-muted">
          On-device boxing round analysis.
        </p>
      </div>

      <div className="rounded-[var(--tt-radius)] border border-line bg-surface px-4 py-3">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-warn">
          Pre-implementation
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Phase 1 is blocked pending the pose-model decision (MoveNet vs.
          BlazePose). No camera, pose, or pipeline code exists yet.
        </p>
      </div>

      <div className="flex gap-6 font-mono text-xs uppercase tracking-[0.1em]">
        <a
          href="/spike/index.html"
          className="text-accent underline underline-offset-4"
        >
          Phase 0 spike
        </a>
        <a
          href="/mockups.html"
          className="text-accent underline underline-offset-4"
        >
          Mockups
        </a>
      </div>
    </main>
  );
}
