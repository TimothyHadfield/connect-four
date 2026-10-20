// Checks the wasm solver against a "moves score" test file and times it.
//   node tools/bench-wasm.mjs <file> [count] [--weak]
import { readFileSync } from "node:fs";
import { makeFast } from "../js/fast.js";

const [file, countArg] = process.argv.slice(2);
const weak = process.argv.includes("--weak");
const lines = readFileSync(file, "utf8").trim().split(/\r?\n/).slice(0, +countArg || 1000);
const F = await makeFast(readFileSync(new URL("../js/solver.wasm", import.meta.url)), 7, 6, +(process.env.BITS||24));
let bad = 0, total = 0, nodes = 0, worst = 0;
for (const line of lines) {
  const [mv, sc] = line.split(" ");
  const cells = new Int8Array(42), h = new Array(7).fill(0);
  let p = 1;
  for (const ch of mv) { const c = +ch - 1; cells[c * 6 + h[c]++] = p; p = 3 - p; }
  F.clearTT();
  const t = performance.now();
  const s = F.solve(cells, p, { weak });
  const dt = performance.now() - t;
  total += dt; nodes += F.nodes(); worst = Math.max(worst, dt);
  const want = weak ? Math.sign(+sc) : +sc;
  if (s !== want) { bad++; if (bad < 5) console.log("MISMATCH", mv, "want", want, "got", s); }
}
console.log(`${file.split(/[\\/]/).pop()}: ${lines.length} positions, wrong ${bad}, mean ${(total / lines.length).toFixed(2)} ms, worst ${worst.toFixed(0)} ms, mean nodes ${(nodes / lines.length).toFixed(0)}`);
