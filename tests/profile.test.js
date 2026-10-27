// The player profile in Connect Four: level ratings, achievements, the daily opening and
// bringing older games in from the history. Uses the shared js/profile.js (game-profile kit).
import { test } from "node:test";
import assert from "node:assert/strict";

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
await import("../js/profile.js");
const Profile = globalThis.Profile;
const { C4_LEVELS, C4_ACHIEVEMENTS, dailyOpening, profileResult, seedFromHistory } = await import("../js/profile-c4.js");
const { replay } = await import("../js/game.js");
const { LEVELS } = await import("../js/ai.js");

let clock = new Date(2026, 9, 27, 12);
const fresh = () => { mem.clear(); clock = new Date(2026, 9, 27, 12); Profile.init({ game: "connect-four", levels: C4_LEVELS, achievements: C4_ACHIEVEMENTS, daily: true, toast: false, now: () => clock }); };

test("every computer level has a rating, ordered by measured strength", () => {
  assert.deepEqual(C4_LEVELS.map((l) => l.id).sort(), LEVELS.slice().sort());
  const r = Object.fromEntries(C4_LEVELS.map((l) => [l.id, l.rating]));
  assert.ok(r.beginner < r.easy && r.easy < r.medium && r.medium < r.strong && r.strong < r.perfect);
});

test("5 to 8 achievements, each with a title and a short description", () => {
  assert.ok(C4_ACHIEVEMENTS.length >= 5 && C4_ACHIEVEMENTS.length <= 8);
  for (const a of C4_ACHIEVEMENTS) { assert.ok(a.id && a.title && a.desc); assert.ok(a.desc.split(" ").length <= 6, a.desc); }
  assert.equal(new Set(C4_ACHIEVEMENTS.map((a) => a.id)).size, C4_ACHIEVEMENTS.length);
});

// a real finished game: Red stacks column 4, Yellow plays column 1 -> Red wins on its 4th disc
const quickWin = replay({ size: "7x6", popout: false, first: 0 }, [0, 1, 2, 3, 4, 5, 6].map((i) => ({ c: i % 2 ? 0 : 3, s: i % 2 })));

test("a game vs the computer is recorded with its level, and quick wins / beating a level unlock", () => {
  fresh();
  const r = Profile.recordResult(profileResult({ mode: "computer", level: "strong", pub: quickWin, you: 0 }));
  const ids = r.unlocked.map((a) => a.id);
  assert.ok(ids.includes("first"), ids);
  assert.ok(ids.includes("fast"), ids);
  assert.ok(ids.includes("strong"), ids);
  assert.ok(!ids.includes("perfect"));
  assert.deepEqual(Profile.stats().byLevel.strong, { g: 1, w: 1, l: 0, d: 0 });
  assert.ok(r.elo.change > 0);
});

test("a loss and a 2-player game don't unlock wins; 2-player games count as played only", () => {
  fresh();
  let r = Profile.recordResult(profileResult({ mode: "computer", level: "easy", pub: quickWin, you: 1 }));
  assert.deepEqual(r.unlocked, []);
  r = Profile.recordResult(profileResult({ mode: "friends", pub: quickWin, you: -1 }));
  assert.deepEqual(r.unlocked, []);
  const s = Profile.stats();
  assert.equal(s.losses, 1); assert.equal(s.wins, 0); assert.equal(s.byMode.friends.g, 1);
});

test("daily opening: same for everyone today, legal, two discs, changes from day to day", () => {
  fresh();
  const a = dailyOpening(Profile.daily.rng("2026-10-27"));
  const b = dailyOpening(Profile.daily.rng("2026-10-27"));
  assert.deepEqual(a, b);
  assert.equal(a.length, 2);
  assert.deepEqual(a.map((m) => m.s), [0, 1]);
  const s = replay({ size: "7x6", popout: false, first: 0 }, a);
  assert.ok(!s.result);
  const week = new Set();
  for (let d = 1; d <= 14; d++) week.add(JSON.stringify(dailyOpening(Profile.daily.rng(`2026-11-${String(d).padStart(2, "0")}`))));
  assert.ok(week.size >= 8, "openings vary: " + week.size);
});

test("older games from the history are brought in once, oldest first, quietly", () => {
  fresh();
  const hist = [
    { id: 3, date: "2026-10-22", mode: "computer", level: "medium", you: 0, winner: 0, moves: quickWin.moves, opts: { size: "7x6", popout: false, first: 0 } },
    { id: 2, date: "2026-10-21", mode: "friends", level: null, you: -1, winner: 1, moves: quickWin.moves, opts: { size: "7x6", popout: false, first: 0 } },
    { id: 1, date: "2026-10-20", mode: "computer", level: "easy", you: 1, winner: 0, moves: quickWin.moves, opts: { size: "7x6", popout: false, first: 0 } },
  ];
  assert.equal(seedFromHistory(Profile, hist), 3);
  const s = Profile.stats();
  assert.equal(s.games, 3); assert.equal(s.wins, 1); assert.equal(s.losses, 1);
  assert.equal(s.first, "2026-10-20");
  assert.equal(s.recent[0].t, "2026-10-22");
  assert.equal(seedFromHistory(Profile, hist), 0, "only when the profile is empty");
});
