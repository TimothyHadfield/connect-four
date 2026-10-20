/* The board: our own SVG drawing (blue frame with round holes, red and yellow
 * discs with a raised ring), plus the drop and pop animations.
 * One cell = 100 units. A row above the frame holds the solver's chip for
 * each column (or the "next disc" preview). */

const NS = "http://www.w3.org/2000/svg";
const CELL = 100, PAD = 18, TOP = 96, FOOT = 34;
let uid = 0;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export function discSvg(v, size = 22) {
  const id = "dg" + ++uid;
  const [a, b, ring] = v === 1 ? ["#ff7b72", "#d0313a", "#a82029"] : ["#ffe27a", "#f0b429", "#c98d0c"];
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs><radialGradient id="${id}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs><circle cx="50" cy="50" r="47" fill="url(#${id})"/><circle cx="50" cy="50" r="31" fill="none" stroke="${ring}" stroke-width="5" opacity=".75"/><circle cx="50" cy="50" r="47" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/><ellipse cx="36" cy="30" rx="16" ry="9" fill="#fff" opacity=".32" transform="rotate(-28 36 30)"/></svg>`;
}

export class Board {
  /** host: element to fill. opts.onColumn(col) when a column is tapped. */
  constructor(host, opts = {}) {
    this.host = host;
    this.opts = opts;
    this.W = 0; this.H = 0;
    this.cells = [];
    this.anim = 1;
  }

  build(W, H) {
    this.W = W; this.H = H;
    this.cells = new Array(W * H).fill(0);
    const vw = W * CELL + 2 * PAD, vh = TOP + H * CELL + 2 * PAD + FOOT;
    this.host.innerHTML = "";
    const svg = el("svg", { viewBox: `0 0 ${vw} ${vh}`, class: "board-svg", role: "img", "aria-label": `Board ${W} columns by ${H} rows` }, this.host);
    this.svg = svg;
    const id = "b" + ++uid;
    const defs = el("defs", {}, svg);
    defs.innerHTML = `
      <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a74ea"/><stop offset="1" stop-color="#2052c4"/></linearGradient>
      <radialGradient id="${id}r" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#ff7b72"/><stop offset="1" stop-color="#d0313a"/></radialGradient>
      <radialGradient id="${id}y" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#f0b429"/></radialGradient>
      <radialGradient id="${id}h" cx="50%" cy="62%" r="62%"><stop offset="0" stop-color="#14295a"/><stop offset=".7" stop-color="#0c1a3c"/><stop offset="1" stop-color="#070f26"/></radialGradient>
      <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2858c8"/><stop offset="1" stop-color="#173c94"/></linearGradient>
      <clipPath id="${id}c"><rect x="0" y="0" width="${vw}" height="${TOP + PAD + H * CELL}"/></clipPath>`;
    this.gradR = `url(#${id}r)`; this.gradY = `url(#${id}y)`;
    // top row: chips / preview
    this.chips = el("g", { class: "chips" }, svg);
    // back of the slot: each hole shaded darker at the rim, so it reads as a hollow
    const back = el("g", {}, svg);
    el("rect", { x: PAD, y: TOP + PAD, width: W * CELL, height: H * CELL, fill: "#0b1734" }, back);
    for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) { const [x, y] = this.xy(c, r); el("circle", { cx: x, cy: y, r: 40, fill: `url(#${id}h)` }, back); }
    this.discLayer = el("g", { "clip-path": `url(#${id}c)` }, svg);
    // frame with holes
    let d = `M0 ${TOP + 6} q0 -6 6 -6 H${vw - 6} q6 0 6 6 V${TOP + H * CELL + 2 * PAD - 6} q0 6 -6 6 H6 q-6 0 -6 -6 Z`;
    for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
      const [x, y] = this.xy(c, r);
      d += ` M${x - 39} ${y} a39 39 0 1 0 78 0 a39 39 0 1 0 -78 0 Z`;
    }
    el("path", { d, fill: `url(#${id}f)`, "fill-rule": "evenodd" }, svg);
    const rims = el("g", { fill: "none", stroke: "rgba(0,0,0,.28)", "stroke-width": "4" }, svg);
    for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) { const [x, y] = this.xy(c, r); el("circle", { cx: x, cy: y + 1.5, r: 40 }, rims); }
    // lip of light under each hole (the frame's thickness catching the light)
    const lips = el("g", { fill: "none", stroke: "rgba(255,255,255,.16)", "stroke-width": "2.5", "stroke-linecap": "round" }, svg);
    for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) { const [x, y] = this.xy(c, r); el("path", { d: `M${x - 30} ${y + 27} A40 40 0 0 0 ${x + 30} ${y + 27}` }, lips); }
    el("rect", { x: 3, y: TOP + 3, width: vw - 6, height: H * CELL + 2 * PAD - 6, rx: 5, fill: "none", stroke: "rgba(255,255,255,.18)", "stroke-width": 3 }, svg);
    // feet, with a soft shadow on the "table"
    const fy = TOP + H * CELL + 2 * PAD;
    el("ellipse", { cx: vw / 2, cy: fy + FOOT - 3, rx: vw / 2 - 10, ry: 5, fill: "rgba(0,0,0,.45)" }, svg);
    for (const fx of [PAD + 10, vw - PAD - 70]) el("path", { d: `M${fx} ${fy} h60 l11 ${FOOT - 7} q1 4 -3 4 h-76 q-4 0 -3 -4 Z`, fill: `url(#${id}t)` }, svg);
    this.marks = el("g", { class: "marks" }, svg);
    // hover tint: only over the frame, never over the chip row
    const hl = el("rect", { x: PAD, y: TOP + 4, width: CELL, height: H * CELL + 2 * PAD - 8, rx: 10, class: "col-hl" }, svg);
    // tap targets
    this.hits = el("g", {}, svg);
    for (let c = 0; c < W; c++) {
      const r = el("rect", { x: PAD + c * CELL, y: 0, width: CELL, height: TOP + H * CELL + 2 * PAD, fill: "transparent", class: "hit", "data-col": c }, this.hits);
      r.addEventListener("click", () => this.opts.onColumn && this.opts.onColumn(c));
      r.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && matchMedia("(hover: hover)").matches) { hl.setAttribute("x", PAD + c * CELL); hl.classList.add("on"); } });
      r.addEventListener("pointerleave", () => hl.classList.remove("on"));
    }
    this.discs = new Map(); // cell index -> element
  }

  xy(c, r) { return [PAD + c * CELL + CELL / 2, TOP + PAD + (this.H - 1 - r) * CELL + CELL / 2]; }

  makeDisc(v) {
    const g = el("g", { class: "disc" });
    g.appendChild(el("circle", { r: 43, fill: v === 1 ? this.gradR : this.gradY }));
    g.appendChild(el("circle", { r: 29, fill: "none", stroke: v === 1 ? "#a82029" : "#c98d0c", "stroke-width": 5, opacity: 0.7 }));
    g.appendChild(el("circle", { r: 43, fill: "none", stroke: "rgba(0,0,0,.22)", "stroke-width": 2 }));
    g.appendChild(el("ellipse", { cx: -13, cy: -19, rx: 15, ry: 8, fill: "#fff", opacity: 0.32, transform: "rotate(-28 -13 -19)" }));
    return g;
  }

  place(i, v, from) {
    const c = Math.floor(i / this.H), r = i % this.H;
    const [x, y] = this.xy(c, r);
    const wrap = el("g", { transform: `translate(${x} ${y})` }, this.discLayer);
    const d = this.makeDisc(v);
    wrap.appendChild(d);
    this.discs.set(i, wrap);
    if (from !== undefined && this.anim && d.animate) {
      const dy = from - y; // negative = starts above
      const ms = Math.min(620, 160 + Math.sqrt(Math.abs(dy)) * 15) * this.anim;
      d.animate([
        { transform: `translate(0px, ${dy}px)`, easing: "cubic-bezier(.5,0,1,1)" },
        { transform: "translate(0px, 0px)", offset: 0.82, easing: "ease-out" },
        { transform: `translate(0px, ${-Math.min(18, Math.abs(dy) * 0.05)}px)`, offset: 0.91, easing: "ease-in" },
        { transform: "translate(0px, 0px)" },
      ], { duration: ms });
      return ms;
    }
    return 0;
  }

  /** Show cells. Animates a single new disc or a pop when that is all that changed. */
  set(cells, { animate = true } = {}) {
    const old = this.cells, H = this.H;
    const diff = [];
    for (let i = 0; i < cells.length; i++) if (old[i] !== cells[i]) diff.push(i);
    let ms = 0;
    if (!diff.length) return 0;
    const added = diff.length === 1 && !old[diff[0]] && cells[diff[0]];
    const popCol = this.findPop(old, cells);
    if (animate && added) {
      const i = diff[0];
      const top = this.xy(0, this.H)[1] - 10;
      ms = this.place(i, cells[i], top);
    } else if (animate && popCol >= 0) {
      ms = this.animatePop(popCol, old, cells);
    } else {
      for (const [, g] of this.discs) g.remove();
      this.discs.clear();
      for (let i = 0; i < cells.length; i++) if (cells[i]) this.place(i, cells[i]);
    }
    this.cells = Array.from(cells);
    return ms;
  }

  findPop(old, cells) {
    const H = this.H;
    let col = -1;
    for (let c = 0; c < this.W; c++) {
      let same = true;
      for (let r = 0; r < H; r++) if (old[c * H + r] !== cells[c * H + r]) same = false;
      if (same) continue;
      if (col >= 0) return -1;
      // shifted down by one?
      for (let r = 0; r < H - 1; r++) if (cells[c * H + r] !== old[c * H + r + 1]) return -1;
      if (cells[c * H + H - 1] !== 0 || !old[c * H]) return -1;
      col = c;
    }
    return col;
  }

  animatePop(c, old, cells) {
    const H = this.H;
    const ms = 420 * this.anim;
    const bottom = this.discs.get(c * H);
    if (bottom && bottom.firstChild.animate && this.anim) {
      bottom.firstChild.animate([{ transform: "translate(0px,0px)", opacity: 1 }, { transform: "translate(0px,120px)", opacity: 0 }], { duration: ms * 0.45, easing: "ease-in", fill: "forwards" });
      setTimeout(() => bottom.remove(), ms * 0.45);
    } else if (bottom) bottom.remove();
    this.discs.delete(c * H);
    for (let r = 1; r < H; r++) {
      const g = this.discs.get(c * H + r);
      if (!g) continue;
      this.discs.delete(c * H + r);
      const [x, y] = this.xy(c, r - 1);
      g.setAttribute("transform", `translate(${x} ${y})`);
      this.discs.set(c * H + r - 1, g);
      if (g.firstChild.animate) g.firstChild.animate([{ transform: `translate(0px, ${-CELL}px)`, easing: "cubic-bezier(.5,0,1,1)" }, { transform: "translate(0px,0px)" }], { duration: ms * 0.7, delay: ms * 0.25, fill: "backwards" });
    }
    return ms;
  }

  /** Ring the winning discs. */
  line(cells) {
    this.marks.innerHTML = "";
    // the winning four stay bright, the rest of the board steps back
    const win = new Set(cells || []);
    this.svg.classList.toggle("over", win.size > 0);
    for (const [i, g] of this.discs) g.classList.toggle("win", win.has(i));
    for (const i of cells || []) {
      const [x, y] = this.xy(Math.floor(i / this.H), i % this.H);
      el("circle", { cx: x, cy: y, r: 44, class: "win-ring" }, this.marks);
    }
  }

  /** Small dots on cells (threat map): list of {i, v}. */
  dots(list) {
    this.marks.querySelectorAll(".threat").forEach((e) => e.remove());
    for (const { i, v, odd } of list || []) {
      const [x, y] = this.xy(Math.floor(i / this.H), i % this.H);
      el("circle", { cx: x + (v === 1 ? -14 : 14), cy: y, r: 11, class: "threat " + (v === 1 ? "tr" : "ty") + (odd ? " odd" : "") }, this.marks);
    }
  }

  /** Highlight poppable bottom discs. */
  popMarks(cols) {
    this.marks.querySelectorAll(".popmark").forEach((e) => e.remove());
    for (const c of cols || []) {
      const [x, y] = this.xy(c, 0);
      el("circle", { cx: x, cy: y, r: 46, class: "popmark" }, this.marks);
    }
  }

  /** Last-move marker. */
  last(i) {
    this.marks.querySelectorAll(".lastmark").forEach((e) => e.remove());
    if (i == null || i < 0) return;
    const [x, y] = this.xy(Math.floor(i / this.H), i % this.H);
    el("circle", { cx: x, cy: y, r: 7, class: "lastmark" }, this.marks);
  }

  /** Chips above the columns: list of {text, sub, cls} or null. */
  setChips(list) {
    this.chips.innerHTML = "";
    if (!list) return;
    list.forEach((ch, c) => {
      if (!ch) return;
      const x = PAD + c * CELL + CELL / 2;
      const g = el("g", { class: "chip " + (ch.cls || "") }, this.chips);
      el("rect", { x: x - 46, y: 8, width: 92, height: 78, rx: 18 }, g);
      const t = el("text", { x, y: ch.sub ? 42 : 56, "text-anchor": "middle", class: "chip-t" }, g);
      t.textContent = ch.text;
      if (ch.sub) { const s = el("text", { x, y: 74, "text-anchor": "middle", class: "chip-s" }, g); s.textContent = ch.sub; }
    });
  }

  /** Preview disc above a column (hover on laptop). */
  preview(c, v) {
    if (this.pv) { this.pv.remove(); this.pv = null; }
    if (c == null || c < 0 || !v) return;
    const g = this.makeDisc(v);
    g.setAttribute("transform", `translate(${PAD + c * CELL + CELL / 2} ${TOP / 2})`);
    g.setAttribute("opacity", "0.55");
    g.setAttribute("class", "preview");
    this.chips.appendChild(g);
    this.pv = g;
  }
}
