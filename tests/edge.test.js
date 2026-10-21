// Odd situations (edge pass 2026-10-20). Browser-side checks live in tools/edge.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { game, replay } from "../js/game.js";
import { today, adoptStored, S } from "../js/ui.js";

test("the 42nd disc fills the board AND makes four: it's a win, not a draw", () => {
  const cols = [1, 0, 2, 0, 2, 0, 5, 3, 2, 6, 0, 2, 1, 4, 3, 3, 0, 3, 0, 6, 1, 3, 6, 4, 5, 4, 6, 1, 2, 2, 4, 6, 6, 5, 4, 5, 4, 5, 1, 1, 3, 5];
  const moves = cols.map((c, i) => ({ s: i % 2, c }));
  const before = replay({}, moves, 41);
  assert.equal(before.result, null, "no four before the last disc");
  const s = replay({}, moves);
  assert.ok(s.cells.every((v) => v), "board is full");
  assert.deepEqual([s.result.winner, s.result.why], [1, "four"]);
});

test("Pop Out, full board: the player to move gets Pop and Draw, nothing else", () => {
  const cols = [0, 1, 0, 1, 1, 0, 1, 0, 2, 3, 2, 3, 3, 2, 3, 2, 4, 4, 4, 4];
  const s = game.setup(2, { size: "5x4", popout: true });
  cols.forEach((c, i) => game.apply(s, i % 2, { c }));
  assert.equal(s.result, null);
  assert.throws(() => game.apply(structuredClone(s), 0, { c: 2 }), /full/);
  game.apply(s, 0, { draw: true });
  assert.equal(s.result.why, "called");
});

test("a game finished late in the evening is dated the local day, not tomorrow's UTC date", () => {
  assert.equal(today(new Date(2026, 9, 20, 23, 30)), "2026-10-20");
  assert.equal(today(new Date(2026, 0, 5, 0, 5)), "2026-01-05");
});

test("another tab's save is taken in (record, history), but this tab keeps its own game", () => {
  const mine = { mode: "friends", id: 9, level: "medium", options: { size: "7x6", popout: false, first: 0, level: "medium" }, names: ["Red", "Yellow"], moves: [{ s: 0, c: 3 }] };
  S.current = mine;
  const other = { record: { "medium:7x6": { w: 2, d: 0, l: 1 } }, history: [{ id: 1, date: "2026-10-20", mode: "friends", opts: { size: "7x6", first: 0 }, names: ["Red", "Yellow"], moves: [0, 1, 0, 1, 0, 1, 0].map((c, i) => ({ s: i % 2, c })) }], current: null };
  adoptStored(JSON.stringify(other));
  assert.deepEqual(S.record["medium:7x6"], { w: 2, d: 0, l: 1 });
  assert.equal(S.history.length, 1);
  assert.equal(S.current, mine);
  adoptStored("{broken"); // ignored
  assert.equal(S.history.length, 1);
});
