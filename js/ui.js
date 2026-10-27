/* Small shared UI helpers: settings store, toast, bottom sheets, "?" help. */

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

import { cleanSettings } from "./saved.js";

const KEY = "c4:v1";
export const S = (() => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
  return cleanSettings(s);
})();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: keep going */ } }
/** Another tab of the site saved: take its record, history and settings so this tab's next save
 *  doesn't wipe them. Each tab keeps its own unfinished game. */
export function adoptStored(json) {
  let raw = null;
  try { raw = JSON.parse(json); } catch (e) { return; }
  if (!raw) return;
  const c = cleanSettings(raw);
  for (const k of Object.keys(c)) if (k !== "current") S[k] = c[k];
}
try { addEventListener("storage", (e) => { if (e.key === KEY && e.newValue) adoptStored(e.newValue); }); } catch (e) { /* not a browser */ }
/** Today's date where the player is (YYYY-MM-DD), not in UTC. */
export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

let toastTimer = null;
export function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

export function sheet(html, bind) {
  const o = $("#overlay");
  o.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  o.classList.add("show");
  o.onclick = (e) => { if (e.target === o) closeSheet(); };
  if (bind) bind(o.firstElementChild);
}
export function closeSheet() { const o = $("#overlay"); o.classList.remove("show"); o.innerHTML = ""; }

export function help(title, body) {
  // a "?" inside an open sheet: OK goes back to that sheet (with its choices), not to nothing
  const o = $("#overlay");
  const under = o.classList.contains("show") ? o.firstElementChild : null;
  if (under) under.remove();
  sheet(`<h3>${esc(title)}</h3><div class="muted" style="display:flex;flex-direction:column;gap:8px">${body}</div><div class="row end"><button class="btn primary" data-close>OK</button></div>`,
    (el) => { el.querySelector("[data-close]").onclick = () => { if (under) { o.innerHTML = ""; o.appendChild(under); } else closeSheet(); }; });
}
export const q = (key) => `<button class="q" data-help="${key}" aria-label="Why?">?</button>`;

export const BUILD = "7";
export function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
/** Hooks the page controller fills in (avoids importing app.js, which would load a second copy). */
export const hooks = { settingsChanged: () => {} };

export const discIcon =(v, size = 18) => {
  const [a, b] = v === 1 ? ["#ff7b72", "#d0313a"] : ["#ffe27a", "#f0b429"];
  return `<svg viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="${b}"/><circle cx="8.5" cy="8" r="5.5" fill="${a}" opacity=".7"/><circle cx="10" cy="10" r="5.6" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/></svg>`;
};
