// Saved data (localStorage "c4:v1") is checked field by field on load.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSettings, cleanHistoryEntry, cleanCurrent } from "../js/saved.js";
import { replay } from "../js/game.js";

// a real finished game: red wins with a vertical four in column 1
const winMoves = [0, 1, 0, 1, 0, 1, 0].map((c, i) => ({ s: i % 2, c }));
const goodEntry = { id: 1, date: "2026-10-20", mode: "computer", level: "easy", opts: { size: "7x6", popout: false, first: 0 },
  names: ["You", "Computer"], you: 0, moves: winMoves, winner: 0, why: "four" };

test("null or wrong-typed fields fall back to defaults", () => {
  for (const bad of [null, "x", 5, [], { record: null, history: null, puzzle: null, size: "99x99", level: "god", starts: 3, popout: "yes", name: 7 }]) {
    const s = cleanSettings(bad);
    assert.deepEqual(s.record, {});
    assert.ok(Array.isArray(s.history) && s.history.length === 0);
    assert.ok(Array.isArray(s.puzzle.solved));
    assert.equal(s.size, "7x6");
    assert.equal(s.level, "medium");
    assert.equal(s.starts, "you");
    assert.equal(s.popout, false);
    assert.equal(typeof s.name, "string");
  }
});

test("good settings survive unchanged", () => {
  const raw = { size: "6x5", popout: true, level: "perfect", starts: "alternate", showSolver: false, anim: false, threats: true,
    name: "Tim", nextStart: 1, record: { "easy:7x6": { w: 3, d: 1, l: 2 } }, history: [goodEntry], puzzle: { solved: ["c1-1200002"] } };
  const s = cleanSettings(raw);
  for (const k of ["size", "popout", "level", "starts", "showSolver", "anim", "threats", "name", "nextStart"]) assert.equal(s[k], raw[k], k);
  assert.deepEqual(s.record, raw.record);
  assert.equal(s.history.length, 1);
  assert.deepEqual(s.history[0].moves, winMoves);
  assert.deepEqual(s.puzzle.solved, ["c1-1200002"]);
});

test("history entries with illegal moves are dropped, good ones kept", () => {
  const bad = [
    { ...goodEntry, moves: [{ s: 0, c: 99 }] },                        // no such column
    { ...goodEntry, moves: winMoves.slice(0, 5) },                     // not finished
    { ...goodEntry, moves: [{ s: 1, c: 0 }] },                         // wrong player
    { ...goodEntry, opts: null },
    { ...goodEntry, moves: "0101010" },
    null, 7,
  ];
  for (const b of bad) assert.equal(cleanHistoryEntry(b), null, JSON.stringify(b));
  const s = cleanSettings({ history: [...bad, goodEntry] });
  assert.equal(s.history.length, 1);
  assert.equal(s.history[0].winner, 0);
});

test("an unfinished game is kept for reload; finished or broken ones are not", () => {
  const cur = { mode: "computer", id: 5, level: "strong", options: { size: "7x6", popout: false, first: 1, level: "strong" }, names: ["You", "Computer"],
    moves: [{ s: 1, c: 3 }, { s: 0, c: 3 }] };
  const c = cleanCurrent(cur);
  assert.ok(c);
  assert.deepEqual(c.moves, cur.moves);
  assert.equal(c.options.first, 1);
  assert.equal(replay(c.options, c.moves).turn, 1);
  assert.equal(cleanCurrent({ ...cur, moves: winMoves, options: { size: "7x6", first: 0 } }), null); // finished
  assert.equal(cleanCurrent({ ...cur, moves: [{ s: 1, c: 42 }] }), null);
  assert.equal(cleanCurrent({ ...cur, mode: "online" }), null);
  assert.equal(cleanSettings({ current: cur }).current.moves.length, 2);
});
