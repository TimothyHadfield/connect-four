// Builds data/book7x6.bin: win/draw/loss for every 7x6 position with 0..8 discs.
//   node tools/build-book.mjs <path to connect-4.data (UCI, John Tromp)> [forced.json]
// Depth 8 comes from Tromp's database; positions it leaves out ("next move forced")
// are solved by our own wasm solver; depths 0..7 are minimaxed from their children.
import { readFileSync, writeFileSync } from "node:fs";
import { makeFast } from "../js/fast.js";
import { bookKey, encodeBook, decodeBook } from "../js/book.js";
import { winsAt } from "../js/rules.js";

const W = 7, H = 6;
const src = process.argv[2];
const F = await makeFast(readFileSync(new URL("../js/solver.wasm", import.meta.url)), W, H, 24);

const db = new Map();
for (const line of readFileSync(src, "utf8").trim().split(/\r?\n/)) {
  const f = line.split(",");
  const cells = new Int8Array(42);
  for (let i = 0; i < 42; i++) cells[i] = f[i] === "x" ? 1 : f[i] === "o" ? 2 : 0;
  const v = f[42] === "win" ? 2 : f[42] === "draw" ? 1 : 0;
  const k = bookKey(cells);
  if (db.has(k) && db.get(k) !== v) throw new Error("mirror disagreement at " + k);
  db.set(k, v);
}
console.log("Tromp 8-ply positions (mirror-folded):", db.size);

const FULL = +(process.env.FULL || 9);
const forced = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf8")) : {}; // from tools/forced-solve.mjs // below this depth every child is evaluated (no cut-offs)
const memo = new Map(); // key -> first-player value
let solved = 0;
// Minimax with cut-offs: a node stops as soon as one child gives the best possible
// result, and children that need a real solve are only tried when cheaper ones didn't decide it.
// Children skipped this way are simply left out of the book (the app solves them live).
function canWinNow(cells, toMove) {
  for (let c = 0; c < W; c++) {
    let r = 0; while (r < H && cells[c * H + r]) r++;
    if (r >= H) continue;
    cells[c * H + r] = toMove; const w = winsAt(cells, W, H, c, r, toMove); cells[c * H + r] = 0;
    if (w) return true;
  }
  return false;
}
function value(cells, depth, cheap) {
  const k = bookKey(cells);
  if (memo.has(k)) return memo.get(k);
  const toMove = depth % 2 === 0 ? 1 : 2;
  const target = toMove === 1 ? 2 : 0;
  let v;
  if (depth === 8) {
    if (db.has(k)) v = db.get(k);
    else if (canWinNow(cells, toMove)) v = target;
    else if (k in forced) v = forced[k];
    else if (cheap) return undefined;
    else {
      const s = F.solve(cells, toMove, { weak: true });
      if (++solved % 100 === 0) console.log("solved", solved, "in", ((performance.now() - t) / 1000).toFixed(0), "s");
      v = s > 0 ? 2 : s === 0 ? 1 : 0; // side to move = first player at depth 8
    }
  } else if (canWinNow(cells, toMove)) v = target;
  else {
    let best = toMove === 1 ? -1 : 3;
    const pending = [];
    const kids = [];
    for (let c = 0; c < W; c++) { let r = 0; while (r < H && cells[c * H + r]) r++; if (r < H) kids.push([c, r]); }
    for (const [c, r] of kids) {
      cells[c * H + r] = toMove;
      const cv = value(cells, depth + 1, true);
      cells[c * H + r] = 0;
      if (cv === undefined) pending.push([c, r]);
      else best = toMove === 1 ? Math.max(best, cv) : Math.min(best, cv);
      if (best === target && depth >= FULL) break;
    }
    if ((best !== target || depth < FULL) && pending.length) {
      if (cheap) return undefined;
      for (const [c, r] of pending) {
        cells[c * H + r] = toMove;
        const cv = value(cells, depth + 1, false);
        cells[c * H + r] = 0;
        best = toMove === 1 ? Math.max(best, cv) : Math.min(best, cv);
        if (best === target && depth >= FULL) break;
      }
    }
    v = best;
  }
  memo.set(k, v);
  return v;
}
for (const [k, v] of db) memo.set(k, v);
const t = performance.now();
const root = value(new Int8Array(42), 0, false);
console.log(`empty board: ${["loss", "draw", "win"][root]} for the first player; ${memo.size} positions; ${solved} solved by us; ${((performance.now() - t) / 1000).toFixed(0)} s`);

const bytes = encodeBook(memo);
writeFileSync(new URL("../data/book7x6.bin", import.meta.url), bytes);
const back = decodeBook(bytes);
for (const [k, v] of memo) if (back.get(k) !== v) throw new Error("round trip failed");
console.log("wrote data/book7x6.bin", bytes.length, "bytes");
