/* The players' disc stacks at the table: a real set's share per colour, the stacks
 * shrinking as discs are played (and refilling on a Pop Out pop), stable stack positions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { replay } from "../js/game.js";
import { discsEach, discsLeft, stackCounts, stacksSvg } from "../js/seats.js";

test("a real set: 21 red + 21 yellow on 7 x 6, enough of each colour on every size", () => {
  assert.equal(discsEach(7, 6), 21);
  for (const [W, H] of [[7, 6], [6, 5], [8, 7], [9, 7], [5, 4]]) {
    const n = discsEach(W, H);
    assert.ok(2 * n >= W * H, `${W}x${H}: ${n} each fills the board`);
    assert.ok(2 * n <= W * H + 1);
  }
});

test("stacks of 7: full set is three full stacks; the left one is used up first; slots never move", () => {
  assert.deepEqual(stackCounts(21, 21), [7, 7, 7]);
  assert.deepEqual(stackCounts(20, 21), [6, 7, 7]);
  assert.deepEqual(stackCounts(14, 21), [0, 7, 7]);
  assert.deepEqual(stackCounts(13, 21), [0, 6, 7]);
  assert.deepEqual(stackCounts(0, 21), [0, 0, 0]);
  assert.deepEqual(stackCounts(32, 32), [4, 7, 7, 7, 7]);
  for (let n = 0; n <= 21; n++) {
    const c = stackCounts(n, 21);
    assert.equal(c.length, 3);
    assert.equal(c.reduce((a, b) => a + b, 0), n);
  }
});

test("discs left follow a real game: one fewer per own drop, one back per own pop", () => {
  // a 30-move 7x6 game (from the screenshot fixtures): 15 discs each on the board
  const cols = [4, 2, 2, 5, 2, 6, 3, 1, 3, 4, 2, 2, 5, 4, 2, 5, 4, 3, 4, 1, 0, 4, 3, 3, 1, 3, 0, 6, 0, 0];
  let s = replay({ size: "7x6", first: 0 }, cols.map((c, i) => ({ s: i % 2, c })));
  assert.equal(discsLeft(s.cells, 1, s.W, s.H), 6);
  assert.equal(discsLeft(s.cells, 2, s.W, s.H), 6);
  // Pop Out: red pops its own bottom disc, so red has one more in front of it
  s = replay({ size: "7x6", popout: true, first: 0 }, [{ s: 0, c: 3 }, { s: 1, c: 4 }, { s: 0, c: 3, p: true }]);
  assert.equal(discsLeft(s.cells, 1, s.W, s.H), 21);
  assert.equal(discsLeft(s.cells, 2, s.W, s.H), 20);
});

test("stacks drawing: one disc edge per disc, the same width whatever is left", () => {
  const edges = (svg) => (svg.match(/<path /g) || []).length;
  const full = stacksSvg(1, 21, 21, 46, "c4:0"), some = stacksSvg(1, 10, 21, 46, "c4:0"), none = stacksSvg(1, 0, 21, 46, "c4:0");
  assert.equal(edges(full), 21);
  assert.equal(edges(some), 10);
  assert.equal(edges(none), 0);
  const w = (svg) => svg.match(/ width="(\d+)"/)[1];
  assert.equal(w(full), w(some));
  assert.equal(w(full), w(none));
  assert.equal(stacksSvg(1, 10, 21, 46, "c4:0"), some, "same seed, same drawing (no jumping stacks)");
});
