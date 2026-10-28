// Variants (wave 3): Five in a row (9 x 6, the two outer columns start filled) and
// Power discs (one Anvil, one Bomb and one Wall each). Rules: docs/rules-check.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { game, legalMoves, replay, sizeOf } from "../js/game.js";
import { botMove } from "../js/ai.js";
import { replayOk, cleanSettings } from "../js/saved.js";

const clone = (s) => JSON.parse(JSON.stringify(s));
const play = (s, seat, a) => game.apply(clone(s), seat, a);
let seed = 777;
const rng = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);

/* ------------------------------------------------------------ five in a row */
test("Five in a row: 9 x 6 board, the outer columns start full of alternating discs", () => {
  const s = game.setup(2, { five: true, size: "6x5" }); // the size setting is ignored
  assert.equal(s.W, 9); assert.equal(s.H, 6); assert.equal(s.n, 5);
  assert.deepEqual(sizeOf({ five: true }), [9, 6]);
  const col = (c) => s.cells.slice(c * 6, c * 6 + 6);
  assert.deepEqual(col(0), [1, 2, 1, 2, 1, 2]);
  assert.deepEqual(col(8), [2, 1, 2, 1, 2, 1]);
  for (let c = 1; c < 8; c++) assert.deepEqual(col(c), [0, 0, 0, 0, 0, 0]);
  assert.equal(s.moves.length, 0);
  assert.equal(legalMoves(s, 0).length, 7); // only the 7 middle columns are open
});

test("Five in a row: four in a row does not win, five does", () => {
  let s = game.setup(2, { five: true });
  // red stacks column 5 (index 4), yellow stacks column 7 (index 6)
  for (let k = 0; k < 3; k++) { s = play(s, 0, { c: 4 }); s = play(s, 1, { c: 6 }); }
  s = play(s, 0, { c: 4 });               // four up and down
  assert.equal(s.result, null);
  s = play(s, 1, { c: 7 });
  s = play(s, 0, { c: 4 });               // five
  assert.equal(s.result.winner, 0);
  assert.equal(s.result.line.length, 5);
});

test("Five in a row: an outer column disc counts toward a line", () => {
  let s = game.setup(2, { five: true });
  // bottom-left (0,0) is red: red at 1..4 makes five with it
  for (const c of [1, 2, 3]) { s = play(s, 0, { c }); s = play(s, 1, { c }); }
  s = play(s, 0, { c: 4 });
  assert.equal(s.result.winner, 0);
  assert.ok(s.result.line.includes(0));
});

test("Five in a row: 42 discs fill the board; a full board with no five is a draw", () => {
  for (let k = 0; k < 200; k++) {
    let s = game.setup(2, { five: true, first: k % 2 });
    while (!s.result) { const m = legalMoves(s, s.turn); s = game.apply(s, s.turn, m[Math.floor(rng() * m.length)]); }
    assert.ok(s.moves.length <= 42);
    if (s.result.winner < 0) { assert.equal(s.moves.length, 42); assert.equal(s.result.why, "full"); }
  }
});

/* ------------------------------------------------------------- power discs */
test("Power discs: each player has one Anvil, one Bomb and one Wall", () => {
  const s = game.setup(2, { power: true });
  assert.deepEqual(s.pw, [{ a: 1, b: 1, w: 1 }, { a: 1, b: 1, w: 1 }]);
  const kinds = legalMoves(s, 0).map((m) => m.w || "-");
  assert.equal(kinds.filter((k) => k === "a").length, 7);
  assert.equal(kinds.filter((k) => k === "w").length, 7);
  assert.equal(kinds.filter((k) => k === "b").length, 0); // nothing to bomb yet
  assert.throws(() => play(game.setup(2, {}), 0, { c: 3, w: "a" }), /Power/);
});

test("Anvil: lands on the bottom and clears every disc that was in the column", () => {
  let s = game.setup(2, { power: true });
  s = play(s, 0, { c: 3 }); s = play(s, 1, { c: 3 }); s = play(s, 0, { c: 3 });
  s = play(s, 1, { c: 3, w: "a" });
  assert.deepEqual(s.cells.slice(18, 24), [2, 0, 0, 0, 0, 0]);
  assert.equal(s.pw[1].a, 0);
  assert.equal(s.turn, 0);
  s = play(s, 0, { c: 2 });
  assert.throws(() => play(s, 1, { c: 4, w: "a" }), /used/);
});

test("Bomb: pops one of the other player's bottom discs; never your own", () => {
  let s = game.setup(2, { power: true });
  s = play(s, 0, { c: 3 }); s = play(s, 1, { c: 3 });
  assert.throws(() => play(s, 0, { c: 3, w: "b" }), /other player/);
  s = play(s, 0, { c: 2 });
  s = play(s, 1, { c: 3, w: "b" });      // red's bottom disc in column 4 goes; yellow slides down
  assert.deepEqual(s.cells.slice(18, 24), [2, 0, 0, 0, 0, 0]);
  assert.equal(s.pw[1].b, 0);
});

test("Bomb: if it makes a line for both colours the bomber wins; only the other's: they win", () => {
  // yellow bombs red's bottom disc in column 1: red's row-1 discs slide... build it simply:
  let s = game.setup(2, { power: true });
  s.cells = new Array(42).fill(0);
  // column 0 (c=0): bottom red, then yellow; yellow has 3 on row 0 at c=1..3 -> after the bomb, yellow has 4
  s.cells[0] = 1; s.cells[1] = 2;
  s.cells[6] = 2; s.cells[12] = 2; s.cells[18] = 2;
  s.turn = 1;
  const t = play(s, 1, { c: 0, w: "b" });
  assert.equal(t.result.winner, 1);
  // the same pop by... red can't bomb its own disc, so test "only the other's": red bombs yellow
  let u = game.setup(2, { power: true });
  u.cells = new Array(42).fill(0);
  u.cells[0] = 2; u.cells[1] = 2;           // column 1: yellow, yellow
  u.cells[6] = 2; u.cells[12] = 2; u.cells[18] = 2; // yellow 3 on the bottom row
  u.turn = 0;
  const v = play(u, 0, { c: 0, w: "b" });   // red pops a yellow; the other yellow lands: yellow has four
  assert.equal(v.result.winner, 1);
});

test("Wall: a grey disc that belongs to nobody and blocks a line", () => {
  let s = game.setup(2, { power: true });
  s = play(s, 0, { c: 0 }); s = play(s, 1, { c: 0 });
  s = play(s, 0, { c: 1 }); s = play(s, 1, { c: 1 });
  s = play(s, 0, { c: 2 }); s = play(s, 1, { c: 3, w: "w" });
  assert.equal(s.cells[18], 3);
  assert.equal(s.result, null);
  s = play(s, 0, { c: 4 });
  assert.equal(s.result, null); // red 0,1,2 + wall + 4: no four
});

test("Power discs: random games end consistently, replay and the saved-game check keep them", () => {
  for (let k = 0; k < 300; k++) {
    let s = game.setup(2, { power: true, size: k % 2 ? "6x5" : "7x6" });
    while (!s.result) { const m = legalMoves(s, s.turn); s = game.apply(s, s.turn, m[Math.floor(rng() * m.length)]); }
    const r = replay({ power: true, size: s.size }, s.moves);
    assert.deepEqual(r.cells, s.cells);
    assert.deepEqual(r.result, s.result);
    const ok = replayOk({ size: s.size, power: true }, s.moves);
    assert.ok(ok && ok.result);
  }
  const s5 = replay({ five: true }, [{ s: 0, c: 4 }]);
  assert.ok(replayOk({ size: "9x6", five: true }, s5.moves));
  const set = cleanSettings({ five: true, power: false, speed: "fast" });
  assert.equal(set.five, true); assert.equal(set.power, false); assert.equal(set.speed, "fast");
});

/* --------------------------------------------------------------- computers */
test("computers play the variants: legal moves, take a win, block a win", () => {
  for (const lv of ["beginner", "easy", "medium", "strong", "perfect"]) {
    // five: red to move can finish five at column 5 (index 4)
    let s = game.setup(2, { five: true });
    for (const c of [1, 2, 3]) { s = play(s, 0, { c }); s = play(s, 1, { c }); }
    const m = botMove(game.publicView(s), 0, lv, rng);
    assert.equal(m.c, 4, lv + " takes the five");
    // power: a legal move every time in a random game
    let p = game.setup(2, { power: true });
    while (!p.result) {
      const mv = botMove(game.publicView(p), p.turn, lv, rng);
      p = game.apply(p, p.turn, mv);
    }
  }
  // medium blocks yellow's open five
  let s = game.setup(2, { five: true, first: 1 });
  for (const c of [1, 2, 3]) { s = play(s, 1, { c: c + 1 }); s = play(s, 0, { c: c + 1 }); }
  // yellow has 2,3,4 on the bottom... make yellow 4 at cols 2..5 then red must block
  s = play(s, 1, { c: 5 });
  const b = botMove(game.publicView(s), 0, "medium", rng);
  assert.ok(b.c === 1 || b.c === 6 || b.w, "medium blocks: " + JSON.stringify(b));
});
