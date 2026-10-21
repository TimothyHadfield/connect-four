/* The players' places at the table: each player's own discs lying in short
 * stacks in front of them (like real players keep them), and a small name plate.
 * Your seat is the near edge of the table, the other player sits across. */
import "./game-table.js";
import { esc } from "./ui.js";

const PER = 7;                 // discs per stack, as people usually stack them
const RX = 12, RY = 6, T = 3.2, SLOT = 29;
const COL = {
  1: { top: "#e8434b", hi: "#ff8a80", side: "#9e1c24", ring: "#b5262e" },
  2: { top: "#f5c33b", hi: "#ffe48a", side: "#a87808", ring: "#cf9612" },
};
const T_ = () => globalThis.TABLE;

/** Each colour's share of a real set: 21 + 21 for 7 x 6. */
export const discsEach = (W, H) => Math.ceil((W * H) / 2);

/** Discs left in front of a player: their share minus their discs on the board. */
export function discsLeft(cells, v, W, H) {
  let on = 0;
  for (const x of cells) if (x === v) on++;
  return Math.max(0, discsEach(W, H) - on);
}

/** How many discs sit in each stack slot. The left stack is the one being used up; full ones stay put. */
export function stackCounts(left, total) {
  const slots = Math.ceil(total / PER), out = new Array(slots).fill(0);
  let n = left;
  for (let i = slots - 1; i >= 0 && n > 0; i--) { out[i] = Math.min(PER, n); n -= out[i]; }
  return out;
}

function discRim(x, y, c) {
  // one flat disc seen from above the table: the edge band, then the face
  return `<path d="M${x - RX} ${y} v${T} a${RX} ${RY} 0 0 0 ${2 * RX} 0 v${-T} Z" fill="${c.side}"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="${RX}" ry="${RY}" fill="${c.top}" stroke="rgba(0,0,0,.28)" stroke-width=".7"/>`;
}
function discFace(x, y, c) {
  return `<ellipse cx="${x}" cy="${y}" rx="${RX * 0.62}" ry="${RY * 0.62}" fill="none" stroke="${c.ring}" stroke-width="1.6"/>` +
    `<ellipse cx="${x - 3.5}" cy="${y - 2}" rx="4" ry="1.6" fill="${c.hi}" opacity=".7"/>`;
}

/** SVG of a player's stacks. h = height in px. */
export function stacksSvg(v, left, total, h, seed) {
  const counts = stackCounts(left, total), c = COL[v];
  const vbH = 2 * RY + PER * T + 4, vbW = counts.length * SLOT + 2;
  const base = vbH - RY - T - 2;
  let s = "";
  counts.forEach((n, i) => {
    const j = T_() ? T_().jitter(seed, i, { rot: 0, off: 1.6 }) : { x: 0, y: 0 };
    const x = 1 + SLOT * i + SLOT / 2 + j.x, y0 = base + j.y * 0.4;
    if (!n) return;
    s += `<ellipse cx="${x + 2}" cy="${y0 + T + 1}" rx="${RX + 2}" ry="${RY}" fill="rgba(0,0,0,.35)"/>`;
    for (let k = 0; k < n; k++) s += discRim(x + (k % 2 ? 0.5 : -0.3), y0 - k * T, c);
    s += discFace(x, y0 - (n - 1) * T, c);
  });
  const w = Math.round((h * vbW) / vbH);
  return `<svg class="stacks" viewBox="0 0 ${vbW} ${vbH}" width="${w}" height="${h}" aria-hidden="true">${s}</svg>`;
}

/** One seat: stacks + plate. near = your edge of the table. */
export function seatHTML({ v, left, total, name, sub, score, turn, near, h, seed }) {
  const stacks = `<span class="pile" aria-label="${left} discs left">${stacksSvg(v, left, total, h, seed)}</span>`;
  const plate = `<span class="plate"><span class="nm">${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ""}</span>${score != null ? `<span class="sc">${score}</span>` : ""}</span>`;
  return `<div class="pl ${near ? "near" : "far"} ${turn ? "turn" : ""}">${near ? stacks + plate : plate + stacks}</div>`;
}

/** A disc lifts off the top of a seat's stacks and goes toward the board (it was just played).
 *  left = discs left now (after the move). */
export function liftOff(seatEl, v, left, total, seed, toward) {
  const svg = seatEl && seatEl.querySelector("svg.stacks");
  const TB = T_();
  if (!svg || !TB || !TB.animOn()) return;
  const before = stackCounts(left + 1, total), now = stackCounts(left, total);
  const i = before.findIndex((n, k) => n !== now[k]);
  if (i < 0) return;
  const j = TB.jitter(seed, i, { rot: 0, off: 1.6 });
  const vbH = 2 * RY + PER * T + 4, base = vbH - RY - T - 2;
  const x = 1 + SLOT * i + SLOT / 2 + j.x, y = base + j.y * 0.4 - (before[i] - 1) * T;
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.innerHTML = discRim(x, y, COL[v]) + discFace(x, y, COL[v]);
  svg.appendChild(g);
  if (!g.animate) { g.remove(); return; }
  const sp = globalThis.FX && globalThis.FX.settings && globalThis.FX.settings.animSpeed === "fast" ? 0.55 : 1;
  const dy = toward === "up" ? -26 : 18;
  const a = g.animate([{ transform: "translate(0px,0px)", opacity: 1 }, { transform: `translate(0px,${dy}px)`, opacity: 0 }], { duration: 320 * sp, easing: "cubic-bezier(.3,.6,.4,1)", fill: "forwards" });
  const done = () => g.remove();
  a.onfinish = done; a.oncancel = done;
}
