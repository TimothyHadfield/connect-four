// Checks the solver against a test file of "moves score" lines and times it.
//   node tools/bench.mjs <file> [count] [--weak]
import { readFileSync } from "node:fs";
import { makeSolver } from "../js/solver.js";

const [file, countArg] = process.argv.slice(2);
const weak = process.argv.includes("--weak");
const lines = readFileSync(file, "utf8").trim().split(/\r?\n/).slice(0, +countArg || 1000);
const S = makeSolver(7, 6, { ttBits: 23 });
let bad = 0, total = 0, nodes = 0, worst = 0;
for (const line of lines) {
  const [mv, sc] = line.split(" ");
  const p = S.fromMoves(mv);
  S.clearTT(); S.nodes = 0;
  const t = performance.now();
  const s = S.solvePos(p, { weak });
  const dt = performance.now() - t;
  total += dt; nodes += S.nodes; worst = Math.max(worst, dt);
  const want = weak ? Math.sign(+sc) : +sc;
  if (s !== want) { bad++; if (bad < 5) console.log("MISMATCH", mv, "want", want, "got", s); }
}
console.log(`${file.split(/[\\/]/).pop()}: ${lines.length} positions, wrong ${bad}, mean ${(total / lines.length).toFixed(2)} ms, worst ${worst.toFixed(0)} ms, mean nodes ${(nodes / lines.length).toFixed(0)}`);
