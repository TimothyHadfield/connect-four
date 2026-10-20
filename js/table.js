/* Table tab: copy a real board into the phone and get the solver's verdict. */
import { S, save, $, $$, esc, toast, q, discIcon, ordinal } from "./ui.js";
import { Board } from "./board.js";
import { Analyst, chipsFor, bestLine, popChips, colList } from "./analysis.js";
import { sizeOf } from "./game.js";
import { hasLine, lineCells } from "./rules.js";

const T = { brush: "auto", starter: 1, cells: null, W: 7, H: 6, stack: [], popout: false, gen: 0 };
const analyst = new Analyst(21);
let board = null;

export function initTable() {
  const el = $("#tab-table");
  el.innerHTML = `
  <div class="play-grid">
    <div class="play-main">
      <div class="row between" style="flex:none">
        <div class="seg" id="tBrush" style="flex:1">
          <button data-k="auto">Turns</button>
          <button data-k="1">${discIcon(1, 16)} Red</button>
          <button data-k="2">${discIcon(2, 16)} Yellow</button>
        </div>${q("tablemode")}
      </div>
      <div class="stage"><div class="board-host" id="tboard"></div></div>
      <div class="status" id="tstatus"></div>
      <div class="verdict" id="tverdict"></div>
      <div class="actions">
        <button class="btn" id="tUndo">Undo</button>
        <button class="btn" id="tClear">Clear</button>
        <button class="btn" id="tStarter"></button>
      </div>
    </div>
    <aside class="side"><div class="panel"><h2>At a real table</h2><div class="muted" style="font-size:13.5px;display:flex;flex-direction:column;gap:6px">
      <p style="margin:0">Copy the real board column by column. "Turns" drops red and yellow in turn; pick a colour to place exactly what you see.</p>
      <p style="margin:0">The chips show what each column leads to with perfect play from here. The board size follows Settings.</p></div></div></aside>
  </div>`;
  board = new Board($("#tboard"), { onColumn: tap });
  $$("#tBrush button").forEach((b) => (b.onclick = () => { T.brush = b.dataset.k; draw(); }));
  $("#tUndo").onclick = () => { const i = T.stack.pop(); if (i !== undefined) { T.cells[i] = 0; draw(); } };
  $("#tClear").onclick = () => { T.cells.fill(0); T.stack = []; draw(); };
  $("#tStarter").onclick = () => { T.starter = 3 - T.starter; draw(); };
}

export function showTable() {
  const [W, H] = sizeOf({ size: S.size });
  if (!T.cells || T.W !== W || T.H !== H) {
    T.W = W; T.H = H; T.cells = new Array(W * H).fill(0); T.stack = [];
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("c4:table")); } catch (e) {}
    if (saved && saved.W === W && saved.H === H && Array.isArray(saved.cells)) { T.cells = saved.cells; T.stack = saved.stack || []; T.starter = saved.starter || 1; }
    board.build(W, H);
  }
  draw(false);
}

function counts() { let r = 0, y = 0; for (const v of T.cells) { if (v === 1) r++; else if (v === 2) y++; } return [r, y]; }
function toMove() {
  const [r, y] = counts();
  const a = T.starter, b = 3 - a;
  const na = a === 1 ? r : y, nb = a === 1 ? y : r;
  if (na === nb) return a;
  if (na === nb + 1) return b;
  return 0; // impossible counts
}

function tap(c) {
  const { W, H } = T;
  let r = 0; while (r < H && T.cells[c * H + r]) r++;
  if (r >= H) { toast("That column is full."); return; }
  const v = T.brush === "auto" ? (toMove() || 1) : +T.brush;
  T.cells[c * H + r] = v;
  T.stack.push(c * H + r);
  draw();
}

function draw(animate = true) {
  try { localStorage.setItem("c4:table", JSON.stringify({ W: T.W, H: T.H, cells: T.cells, stack: T.stack, starter: T.starter })); } catch (e) {}
  $$("#tBrush button").forEach((b) => b.classList.toggle("on", b.dataset.k === T.brush));
  $("#tStarter").innerHTML = `${discIcon(T.starter, 16)} ${T.starter === 1 ? "Red" : "Yellow"} started`;
  board.set(T.cells, { animate: animate && S.anim });
  board.setChips(null);
  board.line(null);
  const [r, y] = counts();
  const tm = toMove();
  const st = $("#tstatus"), vd = $("#tverdict");
  vd.textContent = "";
  const redWon = hasLine(T.cells, T.W, T.H, 1), yelWon = hasLine(T.cells, T.W, T.H, 2);
  if (redWon || yelWon) {
    board.line([...lineCells(T.cells, T.W, T.H, 1), ...lineCells(T.cells, T.W, T.H, 2)]);
    st.innerHTML = redWon && yelWon ? "Both colours have four (only possible in Pop Out)" : `${discIcon(redWon ? 1 : 2)} ${redWon ? "Red" : "Yellow"} already has four`;
    analyst.cancel();
    return;
  }
  if (!tm) { st.innerHTML = `Counts don't add up: ${r} red, ${y} yellow. ${q("tablemode")}`; analyst.cancel(); return; }
  if (r + y === T.W * T.H) { st.textContent = "Full board: draw"; analyst.cancel(); return; }
  st.innerHTML = `${discIcon(tm)} ${tm === 1 ? "Red" : "Yellow"} to play · ${r + y} discs`;
  const gen = ++T.gen;
  const n = r + y;
  analyst.analyze({ cells: T.cells, W: T.W, H: T.H, toMove: tm, firstDisc: T.starter, popout: !!S.popout, depth: 5, weakBudget: 6e7, strongBudget: 4e6 }, (m) => {
    if (gen !== T.gen || m.error) return;
    if (m.pop) {
      const { chips, best } = popChips(m.pop, T.W);
      board.setChips(chips);
      if (best) vd.innerHTML = `Best: <b>${best.p ? "pop" : "drop in"} column ${best.c + 1}</b>`;
      return;
    }
    board.setChips(chipsFor(m.cols, n, T.W, T.H));
    const b = bestLine(m.cols, n, T.W, T.H);
    if (!b) return;
    const who = tm === 1 ? "Red" : "Yellow";
    const cols = colList(b.cols);
    vd.innerHTML = b.cat === 2 ? `Best: <b>${cols}</b> · ${who} wins${b.d ? ` on their ${ordinal(b.d.turns)} turn` : ""}`
      : b.cat === 1 ? `Best: <b>${cols}</b> · draw with best play`
      : `Best: <b>${cols}</b> · ${who} loses with best play${b.d ? ` (lasts ${b.d.turns} turns)` : ""}`;
    if (!m.done) vd.innerHTML += ` <span class="muted thinking">checking</span>`;
  });
}
