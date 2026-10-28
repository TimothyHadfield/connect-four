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
 *    call it a draw. The same position three times = draw.
 *  - Five in a row (option `five`): 9 x 6 board whose two outer columns start
 *    full of alternating discs (left: red at the bottom, right: yellow); five in
 *    a line wins. 42 discs are played, like the classic game.
 *  - Power discs (option `power`, house rules after the Power Up edition):
 *    once per game each player may play instead of a normal disc
 *      Anvil {c, w:"a"}: your disc that knocks every disc below it out of the
 *                        column and lands on the bottom;
 *      Bomb  {c, w:"b"}: pop one of the OTHER player's discs out of the bottom
 *                        row (the column slides down; lines are judged like a pop);
 *      Wall  {c, w:"w"}: a grey disc (cell value 3) that belongs to nobody. */

import { winsAt, hasLine, lineCells, drop, pop, isFull, boardKey } from "./rules.js";

export const SIZES = { "7x6": [7, 6], "8x7": [8, 7], "9x7": [9, 7], "6x5": [6, 5], "5x4": [5, 4] };

export function sizeOf(options = {}) { return options.five ? [9, 6] : SIZES[options.size] || SIZES["7x6"]; }

/** Which rule set the options ask for (one at a time): "five" | "power" | "popout" | "". */
export function variantOf(o = {}) { return o.five ? "five" : o.power ? "power" : o.popout ? "popout" : ""; }
export const VARIANT_NAMES = { five: "Five in a row", power: "Power discs", popout: "Pop Out", "": "" };
export const POWER_NAMES = { a: "Anvil", b: "Bomb", w: "Wall" };
const fresh = () => ({ a: 1, b: 1, w: 1 });

export const game = {
  id: "connect-four",
  minSeats: 2,
  maxSeats: 2,

  setup(n = 2, options = {}, rng = Math.random, seats = []) {
    const [W, H] = sizeOf(options);
    const first = options.first === 1 ? 1 : 0;
    const v = variantOf(options);
    const cells = new Array(W * H).fill(0);
    if (v === "five") for (let r = 0; r < H; r++) { cells[r] = r % 2 ? 2 : 1; cells[(W - 1) * H + r] = r % 2 ? 1 : 2; }
    return {
      W, H, popout: v === "popout", size: W + "x" + H,
      n: v === "five" ? 5 : 4, five: v === "five", power: v === "power",
      ...(v === "power" ? { pw: [fresh(), fresh()] } : {}),
      cells,
      first, turn: first,
      names: [0, 1].map((i) => (seats[i] && seats[i].name) || (i === 0 ? "Red" : "Yellow")),
      moves: [],          // {s: seat, c: column, p: true if pop}
      result: null,       // {winner: seat or -1 for draw, line: [cell indexes], why}
      botLevel: options.level || "medium", // computer seats in an online room
      reps: v === "popout" ? { [boardKey(new Array(W * H).fill(0), first)]: 1 } : {}, // Pop Out: position -> times seen
    };
  },

  toAct(s) { return s.result ? [] : [s.turn]; },

  apply(s, seat, a) {
    if (s.result) throw new Error("The game is over.");
    if (seat !== s.turn) throw new Error("Not your turn.");
    const { W, H } = s;
    const n = s.n || 4;
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
    if (a.w) {
      if (!s.power) throw new Error("Power discs are off.");
      if (!["a", "b", "w"].includes(a.w)) throw new Error("No such power disc.");
      if (!s.pw[seat][a.w]) throw new Error(`You've used your ${POWER_NAMES[a.w]}.`);
      if (a.w === "b") {
        if (s.cells[c * H] !== them) throw new Error("The Bomb takes one of the other player's bottom discs.");
        pop(s.cells, W, H, c);
      } else {
        if (s.cells[c * H + H - 1]) throw new Error("That column is full.");
        if (a.w === "a") { for (let r = 0; r < H; r++) s.cells[c * H + r] = 0; s.cells[c * H] = me; }
        else drop(s.cells, W, H, c, 3);
      }
      s.pw[seat][a.w]--;
      s.moves.push({ s: seat, c, w: a.w });
      if (hasLine(s.cells, W, H, me, n)) s.result = { winner: seat, line: lineCells(s.cells, W, H, me, n), why: "four" };
      else if (hasLine(s.cells, W, H, them, n)) s.result = { winner: 1 - seat, line: lineCells(s.cells, W, H, them, n), why: "four" };
    } else if (a.p) {
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
      if (winsAt(s.cells, W, H, c, r, me, n)) s.result = { winner: seat, line: lineCells(s.cells, W, H, me, n), why: "four" };
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
      names: s.names, moves: s.moves, result: s.result, n: s.n || 4, five: !!s.five, power: !!s.power, ...(s.pw ? { pw: s.pw } : {}) };
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
  if (s.power && s.pw) {
    const pw = s.pw[seat];
    for (let c = 0; c < s.W; c++) {
      const open = !s.cells[c * s.H + s.H - 1];
      if (pw.a && open) out.push({ c, w: "a" });
      if (pw.b && s.cells[c * s.H] === 3 - me) out.push({ c, w: "b" });
      if (pw.w && open) out.push({ c, w: "w" });
    }
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

/** The action to replay a stored move. */
export function actOf(m) { return m.d ? { draw: true } : m.w ? { c: m.c, w: m.w } : m.p ? { c: m.c, p: true } : { c: m.c }; }

/** Rebuild a state from a list of moves (study / replay). */
export function replay(options, moves, upto = moves.length) {
  let s = game.setup(2, options);
  for (let i = 0; i < upto && i < moves.length; i++) s = game.apply(s, moves[i].s, moves[i]);
  return s;
}
