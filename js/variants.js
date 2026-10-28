/* Computer players for Five in a row and Power discs (game.js has the rules).
 * Neither is solved, so every level is a look-ahead search (like Pop Out):
 *   Five in a row: perfect 7, strong 6, medium 3, easy 2 discs ahead;
 *   Power discs:   perfect 6, strong 5, medium 3, easy 2;
 *   easy also plays 1 move in 4 at random; beginner is random but takes a win
 *   it sees and usually blocks one.
 * Power discs are searched only on the first two plies (yours and the reply);
 * deeper down an unused power disc is worth a small bonus, so the computer keeps
 * it until it wins something or saves the game. Pure and synchronous: runs in
 * the Web Worker and in an online room's host page. */

import { hasLine, winsAt } from "./rules.js";

export const VAR_DEPTH = {
  five: { perfect: 7, strong: 6, medium: 3, easy: 2, beginner: 0 },
  power: { perfect: 6, strong: 5, medium: 3, easy: 2, beginner: 0 },
};
const WIN = 100000;
const HOLD = 12; // value of an unused power disc

const winCache = {};
function windows(W, H, n) {
  const k = W + "x" + H + ":" + n;
  if (winCache[k]) return winCache[k];
  const out = [];
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const ec = c + (n - 1) * dc, er = r + (n - 1) * dr;
    if (ec < 0 || ec >= W || er < 0 || er >= H) continue;
    out.push([...Array(n).keys()].map((i) => (c + i * dc) * H + (r + i * dr)));
  }
  return (winCache[k] = out);
}
const WEIGHTS = { 4: [0, 1, 5, 25], 5: [0, 1, 4, 16, 64] };

function held(pw) { return pw ? pw.a + pw.b + pw.w : 0; }

/** Static value for `me` (1 or 2). */
function evaluate(cells, W, H, n, me, pwMe, pwThem) {
  const wt = WEIGHTS[n] || WEIGHTS[4];
  let s = 0;
  for (const w of windows(W, H, n)) {
    let a = 0, b = 0, dead = false;
    for (const i of w) { const v = cells[i]; if (v === me) a++; else if (v === 3) { dead = true; break; } else if (v) b++; }
    if (dead) continue;
    if (a && !b) s += wt[a]; else if (b && !a) s -= wt[b];
  }
  const mid = (W - 1) / 2;
  for (let c = 0; c < W; c++) if (Math.abs(c - mid) < 1) for (let r = 0; r < H; r++) { const v = cells[c * H + r]; if (v === me) s += 2; else if (v === 3 - me) s -= 2; }
  return s + HOLD * (held(pwMe) - held(pwThem));
}

const orderCache = {};
function centre(W) {
  if (orderCache[W]) return orderCache[W];
  const m = (W - 1) / 2;
  return (orderCache[W] = [...Array(W).keys()].sort((a, b) => Math.abs(a - m) - Math.abs(b - m) || a - b));
}
const rowOf = (cells, H, c) => { for (let r = 0; r < H; r++) if (!cells[c * H + r]) return r; return -1; };

/** Moves for `me`: drops, then the power discs still in hand (pw = {a,b,w} or null). */
export function varMoves(cells, W, H, me, pw) {
  const out = [];
  const order = centre(W);
  for (const c of order) if (!cells[c * H + H - 1]) out.push({ c });
  if (pw) for (const c of order) {
    const open = !cells[c * H + H - 1];
    if (pw.a && open && cells[c * H]) out.push({ c, w: "a" }); // an anvil in an empty column is just a disc
    if (pw.b && cells[c * H] === 3 - me) out.push({ c, w: "b" });
    if (pw.w && open) out.push({ c, w: "w" });
  }
  return out;
}

/** New cells after `me` plays m. */
function applyMove(cells, W, H, m, me) {
  const n = cells.slice();
  const c = m.c;
  if (m.w === "b") { for (let r = 0; r < H - 1; r++) n[c * H + r] = n[c * H + r + 1]; n[c * H + H - 1] = 0; }
  else if (m.w === "a") { for (let r = 0; r < H; r++) n[c * H + r] = 0; n[c * H] = me; }
  else n[c * H + rowOf(n, H, c)] = m.w === "w" ? 3 : me;
  return n;
}
const spend = (pw, m) => (m.w && pw ? { ...pw, [m.w]: pw[m.w] - 1 } : pw);

/** +WIN / -WIN if the move ended the game for the mover, 0 draw, null = goes on. */
function outcome(cells, W, H, n, m, me, nc) {
  if (!m.w) {
    const r = rowOf(cells, H, m.c);
    if (winsAt(nc, W, H, m.c, r, me, n)) return WIN;
  } else if (m.w !== "w") {
    if (hasLine(nc, W, H, me, n)) return WIN;
    if (hasLine(nc, W, H, 3 - me, n)) return -WIN;
  }
  for (const v of nc) if (!v) return null;
  return 0;
}

function search(cells, W, H, n, me, pwMe, pwThem, depth, alpha, beta, ply) {
  const moves = varMoves(cells, W, H, me, ply < 2 ? pwMe : null);
  if (!moves.length) return 0;
  if (depth === 0) return evaluate(cells, W, H, n, me, pwMe, pwThem);
  let best = -Infinity;
  for (const m of moves) {
    const nc = applyMove(cells, W, H, m, me);
    const o = outcome(cells, W, H, n, m, me, nc);
    let v;
    if (o === WIN) v = WIN - ply;
    else if (o === -WIN) v = -(WIN - ply);
    else if (o === 0) v = 0;
    else v = -search(nc, W, H, n, 3 - me, pwThem, spend(pwMe, m), depth - 1, -beta, -alpha, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** Value of every legal move for disc `me`: [{c, w?, v}] (bigger = better for me). pw = [seat0, seat1] or undefined. */
export function varValues(cells, W, H, n, me, pw, depth) {
  cells = Array.from(cells);
  const pwMe = pw ? pw[me - 1] : null, pwThem = pw ? pw[2 - me] : null;
  return varMoves(cells, W, H, me, pwMe).map((m) => {
    const nc = applyMove(cells, W, H, m, me);
    const o = outcome(cells, W, H, n, m, me, nc);
    const v = o === WIN ? WIN : o === -WIN ? -WIN : o === 0 ? 0
      : -search(nc, W, H, n, 3 - me, pwThem, spend(pwMe, m), depth - 1, -Infinity, Infinity, 1);
    return { ...m, v };
  });
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const strip = (m) => (m.w ? { c: m.c, w: m.w } : { c: m.c });

/** The computer's move in a Five in a row / Power discs game. */
export function chooseVar(pub, seat, level, rng = Math.random) {
  const { W, H } = pub, n = pub.n || 4, me = seat === 0 ? 1 : 2;
  const cells = Array.from(pub.cells);
  const pw = pub.power ? pub.pw : null;
  const all = varMoves(cells, W, H, me, pw ? pw[seat] : null);
  const drops = all.filter((m) => !m.w);
  if (level === "beginner" || level === "easy") {
    const win = all.find((m) => outcome(cells, W, H, n, m, me, applyMove(cells, W, H, m, me)) === WIN);
    if (win) return strip(win);
    if (level === "beginner") {
      const block = drops.filter((m) => { const r = rowOf(cells, H, m.c); const t = cells.slice(); t[m.c * H + r] = 3 - me; return winsAt(t, W, H, m.c, r, 3 - me, n); });
      if (block.length && rng() < 0.6) return strip(pick(block, rng));
      return strip(pick(drops.length ? drops : all, rng));
    }
    if (rng() < 0.25) return strip(pick(drops.length ? drops : all, rng));
  }
  const vals = varValues(cells, W, H, n, me, pw, VAR_DEPTH[pub.power ? "power" : "five"][level] || 3);
  const best = Math.max(...vals.map((x) => x.v));
  // equal values: a plain disc before a power disc, then any of the best at random
  const top = vals.filter((x) => x.v === best);
  const plain = top.filter((x) => !x.w);
  return strip(pick(plain.length ? plain : top, rng));
}
