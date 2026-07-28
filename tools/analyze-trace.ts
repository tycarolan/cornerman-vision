/**
 * CLI over `trace-analysis.ts`.
 *
 *   npm run analyze -- path/to/vision-spike-*.json [more.json ...]
 *   npm run analyze -- path/to/directory
 *   npm run analyze -- traces/ --json
 *
 * Every number it prints is measured. Nothing here estimates, infers, or fills a
 * gap — where a trace cannot support a figure, the figure is omitted and the
 * reason is printed as a caveat.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { analyze, UnsupportedTraceError, type Analysis } from './trace-analysis';

function collectFiles(paths: string[]): string[] {
  const out: string[] = [];
  for (const p of paths) {
    if (statSync(p).isDirectory()) {
      for (const entry of readdirSync(p).sort()) {
        if (extname(entry) === '.json') out.push(join(p, entry));
      }
    } else {
      out.push(p);
    }
  }
  return out;
}

const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(0)}%`);
const num = (n: number | null) => (n === null ? '—' : String(n));

function table(headers: string[], rows: (string | number | null)[][]): string {
  if (rows.length === 0) return '  (none)\n';
  const cells = rows.map((r) => r.map((c) => (c === null ? '—' : String(c))));
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...cells.map((r) => (r[i] ?? '').length)),
  );
  const line = (r: string[]) => '  ' + r.map((c, i) => c.padEnd(widths[i])).join('  ');
  return [line(headers), '  ' + widths.map((w) => '─'.repeat(w)).join('  '), ...cells.map(line)].join('\n') + '\n';
}

function report(file: string, a: Analysis): string {
  const out: string[] = [];
  out.push(`\n══ ${file}`);
  out.push(`   schema ${a.schema} · ${a.modelsUsed.join(', ')}`
    + `   stance ${a.stances.length ? a.stances.join(', ') : 'undeclared'}`);
  out.push(`   thresh ${a.config.thresh} · refract ${a.config.refract}ms · minConf ${a.config.minConf}`);

  if (a.caveats.length) {
    out.push('\n  CAVEATS');
    for (const c of a.caveats) out.push(`  ! ${c}`);
  }

  out.push('\n  MODEL PERFORMANCE');
  out.push(
    table(
      ['model', 'fps', 'frames/punch', 'punches', 'mean conf', 'dropout', 'flag'],
      a.performance.map((p) => [
        p.model,
        num(p.fps),
        num(p.framesPerPunch),
        p.punches,
        num(p.meanConfidence),
        pct(p.twoArmDropout),
        p.belowClassificationFloor ? 'BELOW FLOOR' : '',
      ]),
    ),
  );

  out.push('  RECALL BY PUNCH TYPE');
  out.push(
    table(
      ['model', 'context', 'punch', 'hand', 'expected', 'detected', 'recall', 'on declared hand'],
      a.recall.map((r) => [
        r.model,
        r.context,
        r.label,
        r.hand,
        r.expected,
        r.detected,
        pct(r.recall),
        pct(r.handRecall),
      ]),
    ),
  );

  out.push('  LEAD VERSUS REAR  (acceptance criterion 13: gap within 10 points)');
  out.push(
    table(
      ['model', 'lead p99', 'rear p99', 'ratio', 'lead cross', 'rear cross', 'recall gap', 'verdict'],
      a.separation.map((s) => [
        s.model,
        num(s.lead.p99Reach),
        num(s.rear.p99Reach),
        num(s.ratio),
        s.lead.crossings,
        s.rear.crossings,
        s.recallGapPoints === null ? '—' : `${s.recallGapPoints} pts`,
        s.recallGapPoints === null
          ? 'not measurable'
          : Math.abs(s.recallGapPoints) <= 10
            ? 'PASSES'
            : 'FAILS',
      ]),
    ),
  );

  out.push('  2D VERSUS 3D, ON IDENTICAL FRAMES');
  if (a.dimensions.length === 0) {
    out.push('  (no depth-carrying frames in this trace)\n');
  } else {
    out.push(
      table(
        ['model', 'hand', 'depth frames', 'p99 reach 3D', 'p99 reach 2D', 'peak elbow 3D', 'peak elbow 2D'],
        a.dimensions.flatMap((d) =>
          (['lead', 'rear'] as const).map((h) => [
            d.model,
            h,
            d.depthFrames,
            num(d[h].p99Reach3d),
            num(d[h].p99Reach2d),
            num(d[h].peakElbow3d),
            num(d[h].peakElbow2d),
          ]),
        ),
      ),
    );
  }

  out.push('  BLOCKS');
  out.push(
    table(
      ['id', 'label', 'context', 'model', 'exp', 'det', 'recall', 'false pos', 'fps', ''],
      a.blocks.map((b) => [
        b.id,
        b.label,
        b.context,
        b.model,
        num(b.expected),
        b.detected,
        pct(b.recall),
        b.falsePositives || '',
        num(b.fps),
        b.open ? 'OPEN AT EXPORT' : '',
      ]),
    ),
  );

  return out.join('\n');
}

function main(argv: string[]): number {
  const asJson = argv.includes('--json');
  const paths = argv.filter((a) => !a.startsWith('--'));

  if (paths.length === 0) {
    process.stderr.write(
      'usage: npm run analyze -- <trace.json | directory> [...] [--json]\n' +
        'Traces are exported from spike/index.html. See docs/knowledge/domains/trace-format.md.\n',
    );
    return 2;
  }

  const files = collectFiles(paths);
  if (files.length === 0) {
    process.stderr.write('No .json traces found at the given paths.\n');
    return 1;
  }

  const results: { file: string; analysis: Analysis }[] = [];
  let failed = 0;

  for (const file of files) {
    try {
      const analysis = analyze(JSON.parse(readFileSync(file, 'utf8')));
      results.push({ file, analysis });
    } catch (err) {
      failed += 1;
      // A rejected trace is reported and skipped — one unreadable file must not
      // take down the analysis of the rest of a session.
      const why = err instanceof UnsupportedTraceError ? err.message : `unreadable: ${String(err)}`;
      process.stderr.write(`\n✗ ${file}\n  ${why}\n`);
    }
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  } else {
    for (const { file, analysis } of results) process.stdout.write(report(file, analysis) + '\n');
    process.stdout.write(
      `\n${results.length} trace(s) analyzed${failed ? `, ${failed} rejected` : ''}.\n` +
        'These figures are measured. Record them in docs/spec.md as such.\n',
    );
  }

  return failed > 0 && results.length === 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
