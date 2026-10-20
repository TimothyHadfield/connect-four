/* Connect Four game engine in the shape online.js expects (pure functions,
 * JSON-safe state). Seat 0 always plays red (disc 1), seat 1 yellow (disc 2);
 * the "first" option says which seat drops first.
 *
 * Rules (sources in docs/rules-check.md):
 *  - Standard: drop a disc in any column that isn't full; four in a row
 *    (across, up, or diagonal) wins; a full board is a draw.
 *  - Pop Out: on your turn either drop a disc OR pop one of YOUR discs out of
 *    the bottom row (the column slides down). A pop that makes four for both
 *    players wins for the popper; a move that makes four only for the opponent
 *    wins for the opponent. With a full board the player to move may pop or
 *    call it a draw. The same position three times = draw. */

import { winsAt, hasLine, lineCells, drop, pop, isFull, boardKey } from "./rules.js";

export const SIZES = { "7x6": [7, 6], "8x7": [8, 7], "9x7": [9, 7], "6x5": [6, 5], "5x4": [5, 4] };

export function sizeOf(options = {}) { return SIZES[options.size] || SIZES["7x6"]; }

export const game = {
  id: "connect-four",
  minSeats: 2,
  maxSeats: 2,

  setup(n = 2, options = {}, rng = Math.random, seats = []) {
    const [W, H] = sizeOf(options);
    const first = options.first === 1 ? 1 : 0;
    return {
      W, H, popout: !!options.popout, size: W + "x" + H,
      cells: new Array(W * H).fill(0),
      first, turn: first,
      names: [0, 1].map((i) => (seats[i] && seats[i].name) || (i === 0 ? "Red" : "Yellow")),
      moves: [],          // {s: seat, c: column, p: true if pop}
      result: null,       // {winner: seat or -1 for draw, line: [cell indexes], why}
      botLevel: options.level || "medium", // computer seats in an online room
      reps: options.popout ? { [boardKey(new Array(W * H).fill(0), first)]: 1 } : {}, // Pop Out: position -> times seen
    };
  },

  toAct(s) { return s.result ? [] : [s.turn]; },

  apply(s, seat, a) {
    if (s.result) throw new Error("The game is over.");
    if (seat !== s.turn) throw new Error("Not your turn.");
    const { W, H } = s;
    const me = seat === 0 ? 1 : 2, them = 3 - me;
    if (!a || typeof a !== "object") throw new Error("No move given.");
    const c = a.c;
    if (a.draw || a.d) {
      if (!(s.popout && isFull(s.cells))) throw new Error("You can only call a draw when the board is full.");
      s.moves.push({ s: seat, d: true });
      s.result = { winner: -1, line: [], why: "called" };
      return s;
    }
    if (!Number.isInteger(c) || c < 0 || c >= W) throw new Error("No such column.");
    if (a.p) {
      if (!s.popout) throw new Error("Popping is only allowed in Pop Out.");
      if (s.cells[c * H] !== me) throw new Error("You can only pop your own disc from the bottom row.");
      pop(s.cells, W, H, c);
      s.moves.push({ s: seat, c, p: true });
      const mine = hasLine(s.cells, W, H, me), theirs = hasLine(s.cells, W, H, them);
      if (mine) s.result = { winner: seat, line: lineCells(s.cells, W, H, me), why: "four" };
      else if (theirs) s.result = { winner: 1 - seat, line: lineCells(s.cells, W, H, them), why: "four" };
    } else {
      const r = drop(s.cells, W, H, c, me);
      if (r < 0) throw new Error("That column is full.");
      s.moves.push({ s: seat, c });
      if (winsAt(s.cells, W, H, c, r, me)) s.result = { winner: seat, line: lineCells(s.cells, W, H, me), why: "four" };
    }
    s.turn = 1 - seat;
    if (!s.result) {
      if (!s.popout) {
        if (isFull(s.cells)) s.result = { winner: -1, line: [], why: "full" };
      } else {
        const k = boardKey(s.cells, s.turn);
        s.reps[k] = (s.reps[k] || 0) + 1;
        if (s.reps[k] >= 3) s.result = { winner: -1, line: [], why: "repeat" };
        else if (isFull(s.cells) && !canPopAny(s, s.turn)) s.result = { winner: -1, line: [], why: "full" };
      }
    }
    return s;
  },

  publicView(s) {
    return { W: s.W, H: s.H, popout: s.popout, size: s.size, cells: s.cells, first: s.first, turn: s.turn,
      names: s.names, moves: s.moves, result: s.result };
  },
  privateView() { return {}; },

  bot(ctx, seat, rng = Math.random) {
    const pub = ctx.pub || game.publicView(ctx.state);
    return botMove(pub, seat, (ctx.state && ctx.state.botLevel) || botLevelDefault, rng);
  },

  isOver(s) { return !!s.result; },
};

/** Legal actions for a seat (for bots, tests and the UI). */
export function legalMoves(s, seat) {
  if (s.result || seat !== s.turn) return [];
  const me = seat === 0 ? 1 : 2, out = [];
  for (let c = 0; c < s.W; c++) if (!s.cells[c * s.H + s.H - 1]) out.push({ c });
  if (s.popout) {
    for (let c = 0; c < s.W; c++) if (s.cells[c * s.H] === me) out.push({ c, p: true });
    if (isFull(s.cells)) out.push({ draw: true });
  }
  return out;
}

function canPopAny(s, seat) {
  const me = seat === 0 ? 1 : 2;
  for (let c = 0; c < s.W; c++) if (s.cells[c * s.H] === me) return true;
  return false;
}

/** Start the online room's computer at a level (host decides in Settings). */
let botLevelDefault = "medium";
let botMove = (pub, seat, level, rng) => { const m = legalMoves(pub, seat).filter((x) => !x.draw); return m[Math.floor(rng() * m.length)]; };
export function setBot(fn, level) { if (fn) botMove = fn; if (level) botLevelDefault = level; }

/** Rebuild a state from a list of moves (study / replay). */
export function replay(options, moves, upto = moves.length) {
  let s = game.setup(2, options);
  for (let i = 0; i < upto && i < moves.length; i++) s = game.apply(s, moves[i].s, moves[i]);
  return s;
}
