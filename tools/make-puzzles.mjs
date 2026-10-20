// Builds data/puzzles.json: classic-board positions where exactly ONE column wins
// by force (every other column draws or loses), solved exactly by the solver.
// Positions come from sensible random games (take a win, block a win, else random).
// usage: node tools/make-puzzles.mjs [count=40] [seed=7]
import { readFileSync, writeFileSync } from "node:fs";
import { makeFast, ABORTED } from "../js/fast.js";
import { winsAt } from "../js/rules.js";
import { describeScore } from "../js/ai.js";

const W = 7, H = 6;
const COUNT = +(process.argv[2] || 40);
let seed = +(process.argv[3] || 7);
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const fast = await makeFast(readFileSync(new URL("../js/solver.wasm", import.meta.url)), W, H, 22);

const rowOf = (cells, c) => { for (let r = 0; r < H; r++) if (!cells[c * H + r]) return r; return -1; };
function winningCol(cells, p) {
  for (let c = 0; c < W; c++) { const r = rowOf(cells, c); if (r < 0) continue; cells[c * H + r] = p; const w = winsAt(cells, W, H, c, r, p); cells[c * H + r] = 0; if (w) return c; }
  return -1;
}
function sensibleGame(depth) {
  const cells = new Array(W * H).fill(0);
  let p = 1;
  for (let n = 0; n < depth; n++) {
    let c = winningCol(cells, p);
    if (c >= 0) return null; // someone could win now: not a quiet position
    c = winningCol(cells, 3 - p);
    if (c < 0) { const open = [...Array(W).keys()].filter((x) => rowOf(cells, x) >= 0); c = open[Math.floor(rnd() * open.length)]; }
    const r = rowOf(cells, c);
    cells[c * H + r] = p;
    if (winsAt(cells, W, H, c, r, p)) return null;
    p = 3 - p;
  }
  return { cells, toMove: p };
}

const out = [], seen = new Set();
let tries = 0;
while (out.length < COUNT && tries < 100000) {
  tries++;
  const g = sensibleGame(12 + Math.floor(rnd() * 16));
  if (!g) continue;
  const { cells, toMove } = g;
  const key = cells.join("");
  if (seen.has(key) || winningCol(cells, toMove) >= 0 || winningCol(cells, 3 - toMove) >= 0) continue;
  seen.add(key);
  const n = cells.filter(Boolean).length;
  const res = [];
  let bad = false;
  for (let c = 0; c < W; c++) {
    const r = rowOf(cells, c);
    if (r < 0) { res.push(null); continue; }
    cells[c * H + r] = toMove;
    const s = fast.solve(cells, 3 - toMove, { maxNodes: 3e6 });
    cells[c * H + r] = 0;
    if (s === ABORTED) { bad = true; break; }
    res.push(-s); // score for the side to move after playing c
  }
  if (bad) continue;
  const wins = res.map((s, c) => (s !== null && s > 0 ? c : -1)).filter((c) => c >= 0);
  if (wins.length !== 1) continue;
  const d = describeScore(res[wins[0]], n, W, H);
  if (d.turns < 2 || d.turns > 7) continue;
  out.push({ id: "p" + key.replace(/0+$/, "").length + "-" + out.length, W, H, cells: key, toMove, first: 1, turns: d.turns, answer: wins[0] });
  process.stdout.write(`${out.length} `);
}
out.sort((a, b) => a.turns - b.turns);
out.forEach((p, i) => (p.id = `c${i + 1}-${p.cells.slice(0, 6)}${p.answer}`));
writeFileSync(new URL("../data/puzzles.json", import.meta.url), JSON.stringify(out));
console.log(`\nwrote ${out.length} puzzles from ${tries} tries; turns: ${out.map((p) => p.turns).join(",")}`);
