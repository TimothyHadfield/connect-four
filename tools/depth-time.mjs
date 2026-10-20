// How long does an exact solve take at each depth? Random positions, wasm solver.
//   node tools/depth-time.mjs <depth> [count] [--weak] [--budget nodes]
import { readFileSync } from "node:fs";
import { makeFast, ABORTED } from "../js/fast.js";
const args = process.argv.slice(2);
const depth = +args[0], count = +args[1] || 20, weak = args.includes("--weak");
const budget = args.includes("--budget") ? +args[args.indexOf("--budget") + 1] : 0;
const F = await makeFast(readFileSync(new URL("../js/solver.wasm", import.meta.url)), 7, 6, 23);
let seed = 12345 + depth;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
function wins(cells, c, r, p) {
  const at = (cc, rr) => cc >= 0 && cc < 7 && rr >= 0 && rr < 6 && cells[cc * 6 + rr] === p;
  for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let n = 1;
    for (let k = 1; at(c + dc * k, r + dr * k); k++) n++;
    for (let k = 1; at(c - dc * k, r - dr * k); k++) n++;
    if (n >= 4) return true;
  }
  return false;
}
const times = [];
let aborted = 0;
while (times.length + aborted < count) {
  const cells = new Int8Array(42), h = new Array(7).fill(0);
  let p = 1, ok = true;
  for (let i = 0; i < depth && ok; i++) {
    const opts = [0, 1, 2, 3, 4, 5, 6].filter((c) => h[c] < 6 && !(cells[c * 6 + h[c]] = p, wins(cells, c, h[c], p)) | (cells[c * 6 + h[c]] = 0));
    const legal = [0, 1, 2, 3, 4, 5, 6].filter((c) => h[c] < 6);
    // avoid moves that win on the spot (we want undecided positions)
    const safe = legal.filter((c) => { cells[c * 6 + h[c]] = p; const w = wins(cells, c, h[c], p); cells[c * 6 + h[c]] = 0; return !w; });
    if (!safe.length) { ok = false; break; }
    const c = safe[Math.floor(rnd() * safe.length)];
    cells[c * 6 + h[c]++] = p; p = 3 - p;
  }
  if (!ok) continue;
  F.clearTT();
  const t = performance.now();
  const s = F.solve(cells, p, { weak, maxNodes: budget });
  const dt = performance.now() - t;
  if (s === ABORTED) aborted++; else times.push(dt);
}
times.sort((a, b) => a - b);
const q = (f) => times.length ? times[Math.min(times.length - 1, Math.floor(f * times.length))].toFixed(0) : "-";
console.log(`depth ${depth}${weak ? " weak" : ""}: n=${times.length} aborted=${aborted} median ${q(0.5)} ms, p90 ${q(0.9)} ms, max ${q(1)} ms`);
