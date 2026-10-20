// Game engine: the rules (docs/rules-check.md), Pop Out edge cases, repetition,
// random playouts, JSON safety, a full computer-vs-computer room, and the opening book.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { game, legalMoves, replay, SIZES } from "../js/game.js";
import { winsAt, hasLine, isFull } from "../js/rules.js";
import { createLocal } from "../js/online.js";
import { decodeBook, bookKey } from "../js/book.js";
import { makeFast } from "../js/fast.js";

let seed = 12345;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
const clone = (s) => JSON.parse(JSON.stringify(s));
const play = (s, seat, a) => game.apply(clone(s), seat, a);
const disc = (seat) => (seat === 0 ? 1 : 2);

test("classic board: 7 columns x 6 rows, 21 discs each fill it", () => {
  const s = game.setup(2, {});
  assert.equal(s.W, 7); assert.equal(s.H, 6);
  assert.equal(s.cells.length, 42);
  assert.deepEqual(SIZES["7x6"], [7, 6]);
  // A final board with no four anywhere: value = ((col >> 1) + row) % 2.
  const target = (c, r) => (((c >> 1) + r) % 2 ? 2 : 1);
  // find a drop order that alternates red, yellow, ... and builds it (depth-first)
  const h = new Array(7).fill(0), order = [];
  const dfs = (p) => {
    if (order.length === 42) return true;
    for (let c = 0; c < 7; c++) if (h[c] < 6 && target(c, h[c]) === p) {
      h[c]++; order.push(c);
      if (dfs(3 - p)) return true;
      h[c]--; order.pop();
    }
    return false;
  };
  assert.ok(dfs(1));
  let st = s;
  for (const c of order) { assert.equal(st.result, null); st = play(st, st.turn, { c }); }
  const count = [0, 0, 0];
  for (const v of st.cells) count[v]++;
  assert.equal(count[1], 21); assert.equal(count[2], 21);
  assert.deepEqual(st.result, { winner: -1, line: [], why: "full" });
});

test("there are exactly 69 ways to make four on 7x6, and each one wins", () => {
  const W = 7, H = 6;
  let n = 0;
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const cells = [];
    for (let k = 0; k < 4; k++) { const cc = c + dc * k, rr = r + dr * k; if (cc < 0 || cc >= W || rr < 0 || rr >= H) break; cells.push([cc, rr]); }
    if (cells.length < 4) continue;
    n++;
    const b = new Array(W * H).fill(0);
    for (const [cc, rr] of cells) b[cc * H + rr] = 1;
    for (const [cc, rr] of cells) assert.ok(winsAt(b, W, H, cc, rr, 1), `window ${c},${r} ${dc},${dr}`);
    assert.ok(hasLine(b, W, H, 1));
    // three of four is not a win
    b[cells[3][0] * H + cells[3][1]] = 0;
    assert.ok(!hasLine(b, W, H, 1));
  }
  assert.equal(n, 69);
});

test("discs fall to the lowest empty spot; full columns and wrong turns are refused", () => {
  let s = game.setup(2, {});
  s = play(s, 0, { c: 3 });
  assert.equal(s.cells[3 * 6 + 0], 1);
  s = play(s, 1, { c: 3 });
  assert.equal(s.cells[3 * 6 + 1], 2);
  assert.throws(() => play(s, 1, { c: 0 }), /turn/);
  for (let i = 0; i < 4; i++) s = play(s, s.turn, { c: 3 });
  assert.throws(() => play(s, s.turn, { c: 3 }), /full/);
  assert.throws(() => play(s, s.turn, { c: 7 }), /column/);
  assert.throws(() => play(s, s.turn, { c: -1 }), /column/);
  assert.throws(() => play(s, s.turn, {}), /column/);
  assert.throws(() => play(s, s.turn, { c: "2" }), /column/);
  assert.throws(() => play(s, s.turn, null), /move/);
  assert.throws(() => play(s, s.turn, { c: 1, p: true }), /Pop Out/);
  assert.throws(() => play(s, s.turn, { draw: true }), /draw/);
});

test("four across, up, and both diagonals win and end the game", () => {
  const cases = {
    across: [0, 0, 1, 1, 2, 2, 3],
    up: [0, 1, 0, 1, 0, 1, 0],
    diagUp: [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3],
    diagDown: [6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3],
  };
  for (const [name, seq] of Object.entries(cases)) {
    let s = game.setup(2, {});
    for (const c of seq) s = play(s, s.turn, { c });
    assert.ok(s.result, name);
    assert.equal(s.result.winner, 0, name);
    assert.equal(s.result.line.length, 4, name);
    assert.deepEqual(game.toAct(s), [], name);
    assert.throws(() => play(s, s.turn, { c: 5 }), /over/, name);
  }
});

test("the 'first' option decides who drops first; seat 0 is always red", () => {
  const s = game.setup(2, { first: 1 });
  assert.equal(s.turn, 1);
  const t = play(s, 1, { c: 0 });
  assert.equal(t.cells[0], 2);
});

test("other board sizes", () => {
  for (const [k, [W, H]] of Object.entries(SIZES)) {
    let s = game.setup(2, { size: k });
    assert.equal(s.cells.length, W * H, k);
    // a vertical four in the last column
    for (const c of [W - 1, 0, W - 1, 0, W - 1, 0, W - 1]) s = play(s, s.turn, { c });
    assert.equal(s.result.winner, 0, k);
  }
});

test("Pop Out: pop only your own bottom disc; the column slides down", () => {
  let s = game.setup(2, { popout: true });
  s = play(s, 0, { c: 2 });
  s = play(s, 1, { c: 2 });
  assert.throws(() => play(s, 0, { c: 3, p: true }), /own/);
  s = play(s, 0, { c: 4 });
  assert.throws(() => play(s, 1, { c: 2, p: true }), /own/); // red is at the bottom of column 3
  s = play(s, 1, { c: 5 });
  s = play(s, 0, { c: 2, p: true });
  assert.equal(s.cells[2 * 6 + 0], 2);
  assert.equal(s.cells[2 * 6 + 1], 0);
  assert.equal(s.moves.at(-1).p, true);
});

function popBoard(cols, turn = 0) {
  const s = game.setup(2, { popout: true });
  cols.forEach((col, c) => col.forEach((v, r) => (s.cells[c * 6 + r] = v)));
  s.turn = turn;
  return s;
}

test("Pop Out: a pop that makes four for both colours wins for the popper", () => {
  // column 1 = red, yellow, red. After red pops it: yellow row 0, red row 1.
  const s = popBoard([[1, 2, 1], [2, 1], [2, 1], [2, 1]]);
  assert.ok(!hasLine(s.cells, 7, 6, 1) && !hasLine(s.cells, 7, 6, 2));
  const t = play(s, 0, { c: 0, p: true });
  assert.ok(hasLine(t.cells, 7, 6, 1) && hasLine(t.cells, 7, 6, 2));
  assert.equal(t.result.winner, 0);
});

test("Pop Out: a pop that makes four only for the opponent loses", () => {
  const s = popBoard([[1, 2], [2], [2], [2]]);
  const t = play(s, 0, { c: 0, p: true });
  assert.equal(t.result.winner, 1);
});

test("Pop Out: the same position three times is a draw", () => {
  let s = game.setup(2, { popout: true });
  const cycle = [{ c: 0 }, { c: 1 }, { c: 0, p: true }, { c: 1, p: true }];
  for (const a of cycle) s = play(s, s.turn, a);
  assert.equal(s.result, null); // empty board, red to move: 2nd time
  for (const a of cycle) s = play(s, s.turn, a);
  assert.deepEqual(s.result, { winner: -1, line: [], why: "repeat" });
});

test("Pop Out: with a full board you may pop or call a draw", () => {
  const cols = [];
  for (let c = 0; c < 7; c++) cols.push(Array.from({ length: 6 }, (_, r) => ((c >> 1) + r) % 2 ? 2 : 1));
  const s = popBoard(cols, 0);
  assert.ok(isFull(s.cells));
  assert.ok(!hasLine(s.cells, 7, 6, 1) && !hasLine(s.cells, 7, 6, 2));
  const lm = legalMoves(s, 0);
  assert.ok(lm.some((m) => m.draw));
  assert.ok(lm.some((m) => m.p));
  assert.ok(!lm.some((m) => !m.p && !m.draw)); // no drops
  const t = play(s, 0, { draw: true });
  assert.deepEqual(t.result, { winner: -1, line: [], why: "called" });
  // not before the board is full
  const early = play(game.setup(2, { popout: true }), 0, { c: 3 });
  assert.throws(() => play(early, 1, { draw: true }), /full/);
  assert.ok(!legalMoves(early, 1).some((m) => m.draw));
});

test("2000 random games: every ending is consistent with the board", () => {
  for (let g = 0; g < 2000; g++) {
    const opts = { size: Object.keys(SIZES)[g % 5], popout: g % 3 === 0, first: g & 1 };
    let s = game.setup(2, opts, rng);
    let n = 0;
    while (!s.result && n++ < 400) {
      const lm = legalMoves(s, s.turn).filter((m) => !m.draw);
      const a = lm.length ? lm[Math.floor(rng() * lm.length)] : { draw: true };
      s = game.apply(s, s.turn, a);
    }
    if (!s.result) continue; // very long Pop Out shuffles: fine
    const { winner, why } = s.result;
    if (winner >= 0) assert.ok(hasLine(s.cells, s.W, s.H, disc(winner)), `game ${g}`);
    if (!s.popout && winner >= 0) assert.ok(!hasLine(s.cells, s.W, s.H, disc(1 - winner)), `game ${g}`);
    if (why === "full") assert.ok(isFull(s.cells) && !hasLine(s.cells, s.W, s.H, 1) && !hasLine(s.cells, s.W, s.H, 2), `game ${g}`);
    // replay gives the same final state
    assert.deepEqual(replay(opts, s.moves), s, `replay ${g}`);
  }
});

test("state survives JSON, and the public view holds no secrets", () => {
  let s = game.setup(2, { popout: true }, rng, [{ name: "Ann" }, { name: "Bo" }]);
  for (const c of [3, 3, 2]) s = game.apply(s, s.turn, { c });
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
  assert.deepEqual(game.privateView(s, 0), {});
  assert.deepEqual(game.publicView(s).cells, s.cells);
});

test("a room with two computers plays to the end", { timeout: 20000 }, async () => {
  const room = createLocal({ game, seats: ["computer", "computer"], options: {}, botDelayMs: 0 });
  const done = new Promise((res) => room.on("change", (snap) => { if (snap.status === "finished") res(snap); }));
  room.start();
  const snap = await done;
  assert.ok(snap.pub.result);
  assert.ok(snap.pub.moves.length >= 7);
  room.close && room.close();
});

test("opening book: the empty board wins for the first player; centre wins, next to it draws, the rest lose", () => {
  const book = decodeBook(new Uint8Array(readFileSync(new URL("../data/book7x6.bin", import.meta.url))));
  assert.ok(book.size > 100000);
  const empty = new Array(42).fill(0);
  assert.equal(book.get(bookKey(empty)), 2);
  const first = [];
  for (let c = 0; c < 7; c++) { const x = empty.slice(); x[c * 6] = 1; first.push(book.get(bookKey(x))); }
  assert.deepEqual(first, [0, 0, 1, 2, 1, 0, 0]);
});

test("opening book agrees with the exact solver on 40 random 8-disc positions", async () => {
  const book = decodeBook(new Uint8Array(readFileSync(new URL("../data/book7x6.bin", import.meta.url))));
  const fast = await makeFast(readFileSync(new URL("../js/solver.wasm", import.meta.url)), 7, 6, 22);
  let checked = 0, tries = 0;
  while (checked < 40 && tries++ < 400) {
    const cells = new Array(42).fill(0), h = new Array(7).fill(0);
    let p = 1, ok = true;
    for (let n = 0; n < 8; n++) {
      const c = Math.floor(rng() * 7);
      if (h[c] >= 6) { ok = false; break; }
      cells[c * 6 + h[c]] = p;
      if (winsAt(cells, 7, 6, c, h[c], p)) { ok = false; break; }
      h[c]++; p = 3 - p;
    }
    if (!ok) continue;
    const v = book.get(bookKey(cells));
    if (v === undefined) continue;
    const s = fast.solve(cells, 1, { weak: true, maxNodes: 2e7 });
    if (s === -1000) continue;
    assert.equal(v, s > 0 ? 2 : s < 0 ? 0 : 1, cells.join(""));
    checked++;
  }
  assert.ok(checked >= 20, `only ${checked} positions checked`);
});

test("every puzzle's answer column really wins in the stated number of turns", async () => {
  const puz = JSON.parse(readFileSync(new URL("../data/puzzles.json", import.meta.url), "utf8"));
  assert.ok(puz.length >= 20);
  const fast = await makeFast(readFileSync(new URL("../js/solver.wasm", import.meta.url)), 7, 6, 22);
  const { describeScore } = await import("../js/ai.js");
  for (const p of puz) {
    const cells = p.cells.split("").map(Number);
    const n = cells.filter(Boolean).length;
    let r = 0; while (cells[p.answer * 6 + r]) r++;
    cells[p.answer * 6 + r] = p.toMove;
    const s = -fast.solve(cells, 3 - p.toMove, { maxNodes: 2e7 });
    assert.ok(s > 0, p.id);
    assert.equal(describeScore(s, n, 7, 6).turns, p.turns, p.id);
  }
});
