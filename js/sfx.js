/* Sounds and small animations for Connect Four events, on top of the shared fx.js
 * (window.FX). Everything here obeys the Sound & effects switches in Settings:
 * FX.play gates sounds by category, FX helpers and our own disc animations check
 * FX.settings.animations, and "Fast" shortens our durations the same way fx.js does.
 * No imports, so node tests can drive it with fake elements. */

const fx = () => globalThis.FX;
const CELL = 100;
export const COLORS = {
  1: ["#ff7b72", "#d0313a", "#a82029", "#ffb3ad", "#ffffff"],
  2: ["#ffe27a", "#f0b429", "#c98d0c", "#fff1b8", "#ffffff"],
};

/* ---------------------------------------------------------------- sounds */
let defined = false;
export function defineSounds() {
  const F = fx();
  if (!F || defined) return;
  defined = true;
  // a plastic disc landing in the slot: bright click on top of a small hollow knock
  F.define("clack", (k) => {
    k.noise({ f: 3200, q: 2.2, dur: 0.03, vol: 0.42 });
    k.tone({ f: 1250, f2: 900, dur: 0.045, vol: 0.16, type: "triangle" });
    k.tone({ f: 330, f2: 190, dur: 0.08, vol: 0.26 });
    k.noise({ f: 900, filter: "lowpass", dur: 0.06, vol: 0.18 });
  }, "moves");
  // the small bounce after it lands
  F.define("clackBounce", (k) => {
    k.noise({ f: 3600, q: 2.5, dur: 0.02, vol: 0.2 });
    k.tone({ f: 1400, f2: 1100, dur: 0.03, vol: 0.06, type: "triangle" });
  }, "moves");
  // Pop Out: the bottom disc slides out of the slot and drops onto the table
  F.define("discPop", (k) => {
    k.noise({ f: 1400, f2: 2600, q: 1.2, dur: 0.09, a: 0.02, vol: 0.3 });
    k.tone({ f: 420, f2: 980, dur: 0.06, vol: 0.14 });
    k.tone({ f: 240, f2: 140, dur: 0.07, vol: 0.22, at: 0.15 });
    k.noise({ f: 2400, q: 2, dur: 0.025, vol: 0.28, at: 0.15 });
  }, "moves");
  // the column above it settles down one row
  F.define("settle", (k) => {
    k.noise({ f: 2800, q: 2, dur: 0.03, vol: 0.32 });
    k.tone({ f: 300, f2: 180, dur: 0.07, vol: 0.2 });
    k.noise({ f: 3300, q: 2.5, dur: 0.02, vol: 0.12, at: 0.045 });
  }, "moves");
  // new game: the slider pulls out and the discs clatter down into the tray
  F.define("release", (k) => {
    k.noise({ f: 700, filter: "lowpass", dur: 0.09, vol: 0.45 });
    k.tone({ f: 190, f2: 110, dur: 0.09, vol: 0.3 });
    k.noise({ f: 1500, f2: 900, q: 0.8, dur: 0.12, vol: 0.25, at: 0.02 });
    let t = 0.08;
    for (let i = 0; i < 12; i++) {
      t += k.rnd(0.025, 0.06);
      k.noise({ f: k.rnd(2400, 3800), q: 2.2, dur: 0.025, vol: 0.26 - i * 0.012, at: t });
      k.tone({ f: k.rnd(900, 1500), dur: 0.02, vol: 0.05, type: "triangle", at: t });
    }
    k.noise({ f: 600, filter: "lowpass", dur: 0.35, a: 0.08, vol: 0.14, at: 0.1 });
  }, "moves");
  // a draw: two soft, even notes (neither happy nor sad)
  F.define("drawTone", (k) => {
    k.tone({ f: 659, dur: 0.32, vol: 0.12, type: "triangle", lp: 2200 });
    k.tone({ f: 523, dur: 0.55, vol: 0.12, type: "triangle", at: 0.2, lp: 2000 });
    k.tone({ f: 784, dur: 0.5, vol: 0.05, type: "triangle", at: 0.2, lp: 2000 });
  }, "celebrations");
}

/* ------------------------------------------------------------- what happened */
/** Pure diff of two public views. Only a single new move counts (Undo, reloads
 *  and new games change more than that and stay silent). */
export function eventsFor(prev, pub) {
  if (!prev || !pub || prev.W !== pub.W || prev.H !== pub.H) return [];
  if (pub.moves.length !== prev.moves.length + 1 || prev.result) return [];
  const m = pub.moves[pub.moves.length - 1];
  const { W, H, cells } = pub;
  const out = [];
  if (m.d) out.push({ type: "drawCall", seat: m.s });
  else if (m.p) {
    let above = 0;
    for (let r = 0; r < H; r++) if (cells[m.c * H + r]) above++;
    out.push({ type: "pop", seat: m.s, c: m.c, above });
  } else {
    let r = H - 1;
    while (r >= 0 && !cells[m.c * H + r]) r--;
    out.push({ type: "drop", seat: m.s, c: m.c, r, fall: (H - r) / H, W });
  }
  if (pub.result) out.push({ type: "end", winner: pub.result.winner, why: pub.result.why, line: pub.result.line || [] });
  else out.push({ type: "turn", seat: pub.turn });
  return out;
}

/* ---------------------------------------------------------------- helpers */
const animOn = () => { const F = fx(); return !!(F && F.settings.animations); };
const speed = () => { const F = fx(); return F && F.settings.animSpeed === "fast" ? 0.55 : 1; };
/** Multiplier for the board's own drop/pop animations (0 = instant). */
export function boardAnim(dropSwitch) { return dropSwitch && animOn() ? speed() : 0; }
function at(ms, fn) { if (ms > 0) setTimeout(fn, ms); else fn(); }
const pan = (c, W) => (W > 1 ? ((c / (W - 1)) * 2 - 1) * 0.35 : 0);

/** Celebration kind for the player looking at this screen. me = their seat, or -1 when
 *  both players share the device (then the winner always gets the win). */
export function celebrationFor(winner, me) {
  if (winner < 0) return "draw";
  if (me >= 0 && winner !== me) return "lose";
  return "win";
}

/** Pop a few SVG disc groups in turn (the winning four). */
function popDiscs(gs) {
  const F = fx();
  if (!F || !animOn()) return;
  gs.forEach((g, i) => {
    if (!g || !g.style) return;
    g.style.transformBox = "fill-box"; g.style.transformOrigin = "center";
    setTimeout(() => F.pop(g), i * 90 * speed());
  });
}

/* ----------------------------------------------------------------- react */
/**
 * Play the sounds and animations for one render.
 * ctx: { mode: "computer"|"friends"|"online", me: my seat (-1 = shared device),
 *        comp: computer seat or -1, animMs: board animation length, board, alive(): still this game,
 *        status: status element, players: [player elements], level }
 * Returns the events it handled (for tests).
 */
export function react(prev, pub, ctx) {
  const F = fx();
  const evs = eventsFor(prev, pub);
  if (!F || !evs.length) return evs;
  const alive = ctx.alive || (() => true);
  const ms = ctx.animMs || 0;
  const mine = (seat) => ctx.me < 0 || seat === ctx.me;
  for (const e of evs) {
    if (e.type === "drop") {
      dropSound(e, ms, mine(e.seat) ? 1 : 0.85, alive);
    } else if (e.type === "pop") {
      const vol = mine(e.seat) ? 1 : 0.85;
      F.play("discPop", { vol, pan: pan(e.c, pub.W) });
      if (e.above > 0) at(Math.max(ms * 0.95, 160), () => alive() && F.play("settle", { vol: vol * Math.min(1.2, 0.7 + e.above * 0.1), pitch: 1.15 - Math.min(5, e.above) * 0.05, pan: pan(e.c, pub.W) }));
    } else if (e.type === "turn") {
      // your-turn chime only when the OTHER side just moved (computer or online opponent)
      if (ctx.me >= 0 && e.seat === ctx.me && ctx.mode !== "friends") {
        at(ms + 120, () => {
          if (!alive()) return;
          F.play("turn");
          const pl = ctx.players && ctx.players[ctx.me];
          if (pl && pl.isConnected !== false) F.pop(pl);
        });
      }
    } else if (e.type === "end") {
      const kind = celebrationFor(e.winner, ctx.me);
      at(ms + 80, () => {
        if (!alive()) return;
        if (kind === "draw") { F.play("drawTone"); if (ctx.status) F.pulse(ctx.status); return; }
        const colors = COLORS[e.winner === 0 ? 1 : 2];
        popDiscs((e.line || []).map((i) => ctx.board && ctx.board.discs && ctx.board.discs.get(i)).map((w) => w && w.firstChild));
        F.celebrate({ kind, colors });
        // signature highs: a five-in-a-row or double four, or beating Strong / Perfect
        const big = kind === "win" && ((e.line || []).length > 4 || (ctx.mode === "computer" && (ctx.level === "strong" || ctx.level === "perfect")));
        if (big) setTimeout(() => alive() && F.celebrate({ kind: "big", colors, at: ctx.status }), 900 * speed());
      });
    }
  }
  return evs;
}

/** A disc dropped into column c landing on row r (0 = bottom) of an H-row board.
 *  It lands at 82% of the board's drop animation (ms), then bounces once. */
export function dropSound(e, ms, volMul = 1, alive = () => true) {
  const F = fx();
  if (!F) return;
  const fall = e.fall != null ? e.fall : (e.H - e.r) / e.H;
  const vol = (0.75 + 0.35 * fall) * volMul;
  const pitch = 1.3 - 0.45 * fall; // short fall onto a tall stack = higher, lighter click
  const p = pan(e.c, e.W);
  at(ms * 0.82, () => alive() && F.play("clack", { pitch, vol, pan: p }));
  if (ms > 0) at(ms * 0.97, () => alive() && F.play("clackBounce", { pitch, vol: vol * 0.5, pan: p }));
}

/** An illegal tap: soft error, and a small shake of the board when the tap was on the board. */
export function refuse(el, shake = true) {
  const F = fx();
  if (!F) return;
  F.play("error");
  if (shake && el) F.shake(el);
}

/** New game / Clear: the slider releases and the old discs fall out of the bottom. */
export function release(board, oldCells, oldW, oldH) {
  const F = fx();
  const n = (oldCells || []).filter((v) => v).length;
  if (!F || !n) return 0;
  F.play("release", { vol: Math.min(1.1, 0.55 + n * 0.03) });
  if (!animOn() || !board || board.W !== oldW || board.H !== oldH || !board.discLayer) return 0;
  const sp = speed();
  const H = board.H;
  if (board.slide) board.slide(); // the slider bar pulls out, then the discs drop
  let longest = 0;
  for (let i = 0; i < oldCells.length; i++) {
    if (!oldCells[i]) continue;
    const c = Math.floor(i / H), r = i % H;
    const [x, y] = board.xy(c, r);
    const wrap = document.createElementNS("http://www.w3.org/2000/svg", "g");
    wrap.setAttribute("transform", `translate(${x} ${y})`);
    const d = board.makeDisc(oldCells[i]);
    wrap.appendChild(d);
    board.discLayer.appendChild(wrap);
    if (!d.animate) { wrap.remove(); continue; }
    // every disc drops out through the bottom (below the clip), lower rows first
    const dist = (r + 1) * CELL + 40;
    const dur = (300 + Math.sqrt(dist) * 6) * sp, delay = r * 18 * sp;
    longest = Math.max(longest, dur + delay);
    const a = d.animate([{ transform: "translate(0px,0px)" }, { transform: `translate(0px,${dist}px)` }], { duration: dur, delay, easing: "cubic-bezier(.5,0,1,1)", fill: "both" });
    const done = () => wrap.remove();
    a.onfinish = done; a.oncancel = done;
    setTimeout(done, dur + delay + 200);
  }
  return longest;
}

/** Record went up: count the score and float a +1. */
export function scoreBump(el, from, to, color = "var(--good)") {
  const F = fx();
  if (!F || !el || to <= from) return;
  F.countUp(el, from, to, { duration: 500 });
  F.floatText(el, "+" + (to - from), color);
}
