// Solver correctness: known solved positions, a brute-force referee on small
// boards, and the JS and WebAssembly solvers agreeing with each other.
// tests/fixtures/solved-positions.txt: positions ("moves score", columns 1-7,
// score in the standard convention) from Pascal Pons's public solver test sets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeSolver } from "../js/solver.js";
import { makeFast } from "../js/fast.js";
import { winsAt } from "../js/rules.js";
import { describeScore } from "../js/ai.js";

const lines = readFileSync(new URL("./fixtures/solved-positions.txt", import.meta.url), "utf8").trim().split(/\r?\n/);
const wasm = readFileSync(new URL("../js/solver.wasm", import.meta.url));

function cellsOf(seq, W = 7, H = 6) {
  const cells = new Array(W * H).fill(0), h = new Array(W).fill(0);
  let p = 1;
  for (const ch of seq) { const c = parseInt(ch, 36) - 1; cells[c * H + h[c]++] = p; p = 3 - p; }
  return { cells, toMove: p };
}

test("JS solver matches 290 known solved positions", () => {
  const S = makeSolver(7, 6);
  for (const line of lines) {
    const [mv, sc] = line.split(" ");
    assert.equal(S.solvePos(S.fromMoves(mv)), +sc, mv);
  }
});

test("WebAssembly solver matches the same positions", async () => {
  const F = await makeFast(wasm, 7, 6, 20);
  for (const line of lines) {
    const [mv, sc] = line.split(" ");
    const { cells, toMove } = cellsOf(mv);
    assert.equal(F.solve(cells, toMove), +sc, mv);
  }
});

// Plain minimax referee, no tricks: score = (W*H+1 - moves)/2 for a win now, etc.
function brute(cells, W, H, toMove, moves, memo) {
  const key = cells.join("") + toMove;
  if (memo.has(key)) return memo.get(key);
  let best = -Infinity, any = false;
  for (let c = 0; c < W; c++) {
    let r = 0; while (r < H && cells[c * H + r]) r++;
    if (r >= H) continue;
    any = true;
    cells[c * H + r] = toMove;
    let v;
    if (winsAt(cells, W, H, c, r, toMove)) v = Math.floor((W * H + 1 - moves) / 2);
    else if (moves + 1 === W * H) v = 0;
    else v = 0 - brute(cells, W, H, 3 - toMove, moves + 1, memo);
    cells[c * H + r] = 0;
    if (v > best) best = v;
  }
  const out = any ? best : 0;
  memo.set(key, out);
  return out;
}

test("solvers agree with brute force on 5x4 and 4x4 boards (random positions)", async () => {
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  for (const [W, H, depth] of [[5, 4, 6], [4, 4, 4], [5, 4, 9], [6, 4, 15]]) {
    const S = makeSolver(W, H);
    const F = await makeFast(wasm, W, H, 18);
    const memo = new Map();
    let checked = 0;
    while (checked < 40) {
      const cells = new Array(W * H).fill(0), h = new Array(W).fill(0);
      let p = 1, ok = true;
      for (let i = 0; i < depth; i++) {
        const legal = [...Array(W).keys()].filter((c) => h[c] < H);
        const c = legal[Math.floor(rnd() * legal.length)];
        cells[c * H + h[c]] = p;
        if (winsAt(cells, W, H, c, h[c], p)) { ok = false; break; }
        h[c]++; p = 3 - p;
      }
      if (!ok) continue;
      const want = brute(cells.slice(), W, H, p, depth, memo);
      const grid = []; for (let c = 0; c < W; c++) grid.push(cells.slice(c * H, c * H + H));
      const pos = S.fromGrid(grid);
      assert.equal(S.solvePos(pos), want, `JS ${W}x${H} ${cells.join("")}`);
      assert.equal(F.solve(cells, p), want, `wasm ${W}x${H} ${cells.join("")}`);
      checked++;
    }
  }
});

test("turn counts from scores (empty board: centre wins on move 41, edges lose on move 40)", () => {
  assert.deepEqual(describeScore(1, 0, 7, 6), { result: "win", turns: 21 });  // own 21st disc = move 41
  assert.deepEqual(describeScore(-2, 0, 7, 6), { result: "loss", turns: 20 }); // opponent's 20th disc = move 40
  assert.deepEqual(describeScore(-1, 0, 7, 6), { result: "loss", turns: 21 }); // move 42
});

test("score for a win next move matches the formula", () => {
  const S = makeSolver(7, 6);
  const p = S.fromMoves("112233"); // first player to move, can win with column 4
  assert.equal(S.solvePos(p), Math.floor((42 + 1 - 6) / 2));
  assert.deepEqual(describeScore(18, 6, 7, 6), { result: "win", turns: 1 });
});
