/* Settings tab. Every choice saves at once (no Save button). */
import { S, save, $, esc, q, BUILD, hooks } from "./ui.js";
import { LEVELS, LEVEL_NAMES } from "./ai.js";
const settingsChanged = (w) => hooks.settingsChanged(w);

const SIZE_LIST = [["7x6", "7 × 6", "Classic"], ["6x5", "6 × 5", "Small"], ["8x7", "8 × 7", "Big"], ["9x7", "9 × 7", "Huge"], ["5x4", "5 × 4", "Tiny"]];

export function renderSettings() {
  const el = $("#tab-settings");
  const rec = Object.entries(S.record || {}).filter(([, r]) => r.w + r.d + r.l > 0);
  el.innerHTML = `<div class="settings-wrap">
    <div class="panel"><h2>Board</h2>
      <div class="seg" id="sSize">${SIZE_LIST.map(([k, t, s]) => `<button data-k="${k}" class="${S.size === k ? "on" : ""}">${t}<small>${s}</small></button>`).join("")}</div>
      <div class="set-row" style="margin-top:6px"><span>Pop Out ${q("popout")}</span><label class="switch"><input type="checkbox" id="sPop" ${S.popout ? "checked" : ""}><span></span></label></div>
    </div>
    <div class="panel"><h2>Computer</h2>
      <div class="field"><span class="label">Level ${q("levels")}</span>
        <div class="seg" id="sLevel">${LEVELS.map((k) => `<button data-k="${k}" class="${S.level === k ? "on" : ""}" style="font-size:12.5px">${LEVEL_NAMES[k]}</button>`).join("")}</div></div>
      <div class="field" style="margin-top:8px"><span class="label">Who starts ${q("starts")}</span>
        <div class="seg" id="sStart">${[["you", "You"], ["computer", "Computer"], ["alternate", "Take turns"]].map(([k, t]) => `<button data-k="${k}" class="${S.starts === k ? "on" : ""}">${t}</button>`).join("")}</div></div>
    </div>
    <div class="panel"><h2>Display</h2>
      <div class="set-row"><span>Show the solver while playing ${q("solver")}</span><label class="switch"><input type="checkbox" id="sSolver" ${S.showSolver ? "checked" : ""}><span></span></label></div>
      <div class="set-row"><span>Drop animation</span><label class="switch"><input type="checkbox" id="sAnim" ${S.anim ? "checked" : ""}><span></span></label></div>
      <div class="set-row"><span>Name for online</span><input type="text" id="sName" maxlength="20" value="${esc(S.name)}" placeholder="Your name" style="max-width:180px"></div>
    </div>
    <div class="panel"><h2>Sound &amp; effects</h2><div id="sFx"></div></div>
    ${rec.length ? `<div class="panel"><h2>Your record vs the computer</h2><table class="strength"><tr><th>Level · board</th><th>Won</th><th>Drawn</th><th>Lost</th></tr>
      ${rec.map(([k, r]) => { const [lv, sz, pop] = k.split(":"); return `<tr><td>${LEVEL_NAMES[lv] || lv} · ${sz.replace("x", "×")}${pop ? " Pop" : ""}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td></tr>`; }).join("")}</table></div>` : ""}
    <div class="panel"><h2>Rules</h2><div class="muted" style="font-size:14px;display:flex;flex-direction:column;gap:6px">
      <p style="margin:0">Take turns dropping a disc into any column that isn't full. It falls to the lowest empty spot.</p>
      <p style="margin:0">Four of your colour in a line (across, up and down, or diagonal) wins. A full board with no four is a draw.</p>
      <p style="margin:0"><b>Pop Out:</b> instead of dropping, you may pop one of your own discs out of the bottom row. A pop that makes four for both colours wins for the popper.</p></div></div>
    <div class="panel"><h2>About</h2><div class="muted" style="font-size:13px;display:flex;flex-direction:column;gap:6px">
      <p style="margin:0">Opening results on the classic board come from John Tromp's 8-ply Connect-4 database (UCI Machine Learning Repository, CC BY 4.0). The solver follows the method Pascal Pons describes at blog.gamesolver.org. Board and disc art drawn for this site.</p>
      <p style="margin:0">Connect Four is a Hasbro trademark; this is a free fan-made study tool. Build ${BUILD}.</p></div></div>
  </div>`;
  if (window.FX) window.FX.renderSettings($("#sFx"));
  const seg = (id, key, after) => el.querySelectorAll(`#${id} button`).forEach((b) => (b.onclick = () => { S[key] = b.dataset.k; save(); renderSettings(); if (after) settingsChanged(after); }));
  seg("sSize", "size", "board");
  seg("sLevel", "level", "level");
  seg("sStart", "starts");
  $("#sPop").onchange = (e) => { S.popout = e.target.checked; save(); settingsChanged("board"); };
  $("#sSolver").onchange = (e) => { S.showSolver = e.target.checked; save(); settingsChanged("solver"); };
  $("#sAnim").onchange = (e) => { S.anim = e.target.checked; save(); settingsChanged("anim"); };
  $("#sName").onchange = (e) => { S.name = e.target.value.trim(); save(); };
}
