/* Connect Four's part of the player profile (shared kit: js/profile.js, never edit that one here).
 * Level ratings, the achievement list, the daily opening and turning a finished game into a result. */

/* Elo of each computer level, from js/strength-data.js (3,700 measured games, 2026-10-20):
 * score of the stronger level against the next one down -> gap = 400·log10(p / (1 − p)).
 * easy > beginner 90.7% (+394), medium > easy 86.6% (+324), strong > medium 76.4% (+204),
 * perfect > strong 89.5% (+372). Beginner anchored at 800, rounded to 50. */
export const C4_LEVELS = [
  { id: "beginner", name: "Beginner", rating: 800 },
  { id: "easy", name: "Easy", rating: 1200 },
  { id: "medium", name: "Medium", rating: 1500 },
  { id: "strong", name: "Strong", rating: 1700 },
  { id: "perfect", name: "Perfect", rating: 2100 },
];
const RANK = Object.fromEntries(C4_LEVELS.map((l, i) => [l.id, i]));
const beatAtLeast = (id) => (c) => !!(c.last && c.last.won && c.last.level && RANK[c.last.level] >= RANK[id]);

export const C4_ACHIEVEMENTS = [
  { id: "first", title: "First win", desc: "Win a game", test: (c) => c.stats.wins >= 1 },
  { id: "medium", title: "Getting good", desc: "Beat Medium", test: beatAtLeast("medium") },
  { id: "strong", title: "Strong arm", desc: "Beat Strong", test: beatAtLeast("strong") },
  { id: "perfect", title: "Giant killer", desc: "Beat Perfect", test: beatAtLeast("perfect") },
  { id: "hold", title: "Hold the line", desc: "Draw against Perfect", test: (c) => !!(c.last && c.last.draw && c.last.level === "perfect") },
  { id: "streak", title: "Hat trick", desc: "Win 3 in a row", test: (c) => c.stats.bestStreak >= 3 },
  { id: "fast", title: "Fast four", desc: "Win with 5 discs or fewer", test: (c) => !!(c.last && c.last.won && c.last.extra.discs <= 5) },
  { id: "daily", title: "Daily habit", desc: "3-day Daily streak", test: (c) => c.daily.streak >= 3 },
];

/** Today's opening for the Daily game: one Red and one Yellow disc, from the day's seeded rng. */
export function dailyOpening(rng) {
  const a = Math.floor(rng() * 7) % 7, b = Math.floor(rng() * 7) % 7;
  return [{ c: a, s: 0 }, { c: b, s: 1 }];
}

/** A finished game -> Profile.recordResult input. you = your seat (-1: two players on one device). */
export function profileResult({ mode, level, pub, you, daily = false }) {
  const w = pub.result ? pub.result.winner : -1;
  const discs = you >= 0 ? pub.moves.filter((m) => m.s === you && !m.d && !m.p).length : 0;
  const extra = { discs, size: pub.size, popout: !!pub.popout };
  if (mode === "friends" || you < 0) return { mode, won: null, extra };
  return { mode, level: mode === "computer" ? level : null, won: w >= 0 ? w === you : false, draw: w < 0, daily, extra };
}

/** First time the profile is used: bring in the games already in Study's history (newest first there). */
export function seedFromHistory(Profile, history) {
  if (!Array.isArray(history) || !history.length || Profile.stats().games > 0) return 0;
  let n = 0;
  for (const g of history.slice().reverse()) {
    const pub = { result: { winner: g.winner }, moves: g.moves || [], size: g.opts && g.opts.size, popout: g.opts && g.opts.popout };
    Profile.recordResult({ ...profileResult({ mode: g.mode, level: g.level, pub, you: g.mode === "friends" ? -1 : g.you }), date: g.date, quiet: true });
    n++;
  }
  return n;
}
