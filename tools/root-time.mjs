// Times solving positions given on the command line (move strings, "" = empty board).
//   node tools/root-time.mjs [--weak] [--bits 24] seq1 seq2 ...
import { makeSolver } from "../js/solver.js";
const args = process.argv.slice(2);
const weak = args.includes("--weak");
const bits = args.includes("--bits") ? +args[args.indexOf("--bits") + 1] : 24;
const seqs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--bits");
const S = makeSolver(7, 6, { ttBits: bits });
for (const q of seqs) {
  const seq = q === "-" ? "" : q;
  const p = S.fromMoves(seq);
  S.nodes = 0;
  const t = performance.now();
  const s = S.solvePos(p, { weak });
  console.log(`"${seq}" score ${s} ${weak ? "(weak)" : ""} ${((performance.now() - t) / 1000).toFixed(1)} s, ${S.nodes} nodes`);
}
