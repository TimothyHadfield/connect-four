/* Checks everything read back from localStorage, field by field. A broken or
 * hand-edited value falls back to its default instead of breaking a tab; saved
 * games are replayed through the rules and dropped if any move is illegal. */
import { replay, SIZES } from "./game.js";

export const LEVEL_KEYS = ["beginner", "easy", "medium", "strong", "perfect"];

export const DEFAULTS = {
  size: "7x6", popout: false, level: "medium", starts: "you", showSolver: false, anim: true, threats: false,
  name: "", nextStart: 0, record: {}, history: [], puzzle: { solved: [] }, current: null, chipsV: 2,
};

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const count = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);

/** Replays a list of moves; returns the final state, or null if a move is illegal. */
export function replayOk(opts, moves) {
  if (!isObj(opts) || !Array.isArray(moves) || moves.length > 400) return null;
  if (!SIZES[opts.size]) return null;
  if (!moves.every((m) => isObj(m) && (m.s === 0 || m.s === 1))) return null;
  try { return replay({ size: opts.size, popout: !!opts.popout, first: opts.first === 1 ? 1 : 0 }, moves); } catch (e) { return null; }
}

/** A finished game kept for Study › Review. */
export function cleanHistoryEntry(g) {
  if (!isObj(g) || !isObj(g.opts)) return null;
  const s = replayOk(g.opts, g.moves);
  if (!s || !s.result) return null;
  return {
    id: Number.isFinite(g.id) ? g.id : 0,
    date: typeof g.date === "string" ? g.date.slice(0, 10) : "",
    mode: ["computer", "friends", "online"].includes(g.mode) ? g.mode : "friends",
    level: LEVEL_KEYS.includes(g.level) ? g.level : null,
    opts: { size: s.size, popout: s.popout, first: s.first },
    names: Array.isArray(g.names) ? [0, 1].map((i) => String(g.names[i] ?? (i ? "Yellow" : "Red")).slice(0, 40)) : ["Red", "Yellow"],
    you: g.you === 0 || g.you === 1 ? g.you : -1,
    moves: s.moves, winner: s.result.winner, why: s.result.why,
  };
}

/** The unfinished local game, restored after a reload. */
export function cleanCurrent(c) {
  if (!isObj(c) || !["computer", "friends"].includes(c.mode) || !isObj(c.options)) return null;
  const s = replayOk(c.options, c.moves);
  if (!s || s.result) return null;
  return {
    mode: c.mode, id: Number.isFinite(c.id) ? c.id : Date.now(),
    level: LEVEL_KEYS.includes(c.level) ? c.level : "medium",
    options: { size: s.size, popout: s.popout, first: s.first, level: LEVEL_KEYS.includes(c.options.level) ? c.options.level : "medium" },
    names: Array.isArray(c.names) ? [0, 1].map((i) => String(c.names[i] ?? "").slice(0, 40)) : null,
    moves: s.moves,
    ...(typeof c.daily === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.daily) ? { daily: c.daily } : {}),
    ...(c.helped === true ? { helped: true } : {}),
    ...(c.guided === true ? { guided: true } : {}),
  };
}

/** Whatever was stored -> a complete, valid settings object. */
export function cleanSettings(raw) {
  const d = structuredClone(DEFAULTS);
  if (!isObj(raw)) return d;
  const pick = (k, ok) => (ok(raw[k]) ? raw[k] : d[k]);
  const bool = (v) => typeof v === "boolean";
  const out = {
    size: pick("size", (v) => !!SIZES[v]),
    popout: pick("popout", bool),
    level: pick("level", (v) => LEVEL_KEYS.includes(v)),
    starts: pick("starts", (v) => ["you", "computer", "alternate"].includes(v)),
    // build 9: chips off by default so games vs the computer count as rated. Settings saved before
    // (chipsV missing) had the old "on" default stored: switched off once; a later choice sticks.
    showSolver: raw.chipsV === 2 ? pick("showSolver", bool) : false,
    chipsV: 2,
    anim: pick("anim", bool),
    threats: pick("threats", bool),
    name: typeof raw.name === "string" ? raw.name.slice(0, 20) : "",
    nextStart: raw.nextStart === 1 ? 1 : 0,
    record: {},
    history: [],
    puzzle: { solved: [] },
    current: cleanCurrent(raw.current),
  };
  if (isObj(raw.record)) for (const [k, r] of Object.entries(raw.record)) if (isObj(r)) out.record[k] = { w: count(r.w), d: count(r.d), l: count(r.l) };
  if (Array.isArray(raw.history)) out.history = raw.history.slice(0, 40).map(cleanHistoryEntry).filter(Boolean);
  if (isObj(raw.puzzle) && Array.isArray(raw.puzzle.solved)) out.puzzle.solved = raw.puzzle.solved.filter((x) => typeof x === "string" || Number.isInteger(x));
  return out;
}
