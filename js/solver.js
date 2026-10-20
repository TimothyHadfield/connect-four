/* Connect Four solver: bitboard negamax with alpha-beta, a transposition table,
 * "don't hand the opponent a win" move filtering and threat-count move ordering.
 * The method follows the well-known approach described by Pascal Pons
 * (blog.gamesolver.org); this is our own code, generated per board size.
 *
 * Board layout: every column gets 8 bits (rows 0..H-1 are cells, the rest are
 * always-empty guard rows), 4 columns per 32-bit word. That works for any board
 * up to 12 columns x 7 rows with plain 32-bit JavaScript bit operations
 * (no BigInt, which is slow on iPhone Safari).
 *
 * Score convention (from the side to move):
 *   0  = draw with perfect play
 *   s>0 = win;  you drop your winning disc on your k-th turn from now,
 *         k = floor((W*H + 3 - moves)/2) - s
 *   s<0 = loss; the opponent wins on their k-th turn from now,
 *         k = floor((W*H + 2 - moves)/2) + s   (s negative)
 */

const BIG = 1000; // heuristic search: exact results are reported as +-(BIG + score)

function genSource(W, H, N) {
  const ws = Array.from({ length: N }, (_, i) => i);
  const L = (p) => ws.map((i) => p + i).join(",");
  const shl = (p, s) => ws.map((i) => (i === 0 ? `(${p}0<<${s})` : `((${p}${i}<<${s})|(${p}${i - 1}>>>${32 - s}))`));
  const shr = (p, s) => ws.map((i) => (i === N - 1 ? `(${p}${i}>>>${s})` : `((${p}${i}>>>${s})|(${p}${i + 1}<<${32 - s}))`));

  // winPos(p, m): the empty cells where stones p would complete four. Result in R0..R{N-1}.
  let wp = `function winPos(${L("p")},${L("m")}){\n`;
  for (const i of ws) wp += `let r${i}=(p${i}<<1)&(p${i}<<2)&(p${i}<<3);\n`;
  for (const s of [8, 7, 9]) {
    const l1 = shl("p", s), l2 = shl("p", 2 * s), l3 = shl("p", 3 * s);
    const r1 = shr("p", s), r2 = shr("p", 2 * s), r3 = shr("p", 3 * s);
    for (const i of ws) {
      wp += `{const a=${l1[i]},b=${r1[i]};let t=a&${l2[i]};r${i}|=t&${l3[i]};r${i}|=t&b;t=b&${r2[i]};r${i}|=t&a;r${i}|=t&${r3[i]};}\n`;
    }
  }
  for (const i of ws) wp += `R${i}=r${i}&(BM${i}^m${i});\n`;
  wp += `}\n`;
  // Same thing inlined (hot path): declares out0.. from stone expressions pex[] and mask prefix mp.
  const WPI = (out, pex, mp) => {
    let s = `let ${ws.map((i) => `${out}${i}`).join(",")};{const ${ws.map((i) => `p${i}=${pex[i]}`).join(",")};`;
    s += `let ${ws.map((i) => `r${i}=(p${i}<<1)&(p${i}<<2)&(p${i}<<3)`).join(",")};`;
    for (const sft of [8, 7, 9]) {
      const l1 = shl("p", sft), l2 = shl("p", 2 * sft), l3 = shl("p", 3 * sft);
      const r1 = shr("p", sft), r2 = shr("p", 2 * sft), r3 = shr("p", 3 * sft);
      for (const i of ws) s += `{const a=${l1[i]},b=${r1[i]};let t=a&${l2[i]};r${i}|=t&${l3[i]};r${i}|=t&b;t=b&${r2[i]};r${i}|=t&a;r${i}|=t&${r3[i]};}`;
    }
    for (const i of ws) s += `${out}${i}=r${i}&(BM${i}^${mp}${i});`;
    return s + "}";
  };

  // aligned(p): does p contain four in a row? (used by Pop Out checks / tests)
  let al = `function aligned(${L("p")}){\n`;
  for (const s of [1, 8, 7, 9]) {
    const a1 = shr("p", s);
    for (const i of ws) al += `const a${s}_${i}=p${i}&${a1[i]};\n`;
    const a2 = shr(`a${s}_`, 2 * s);
    al += `if(${ws.map((i) => `(a${s}_${i}&${a2[i]})`).join("|")})return true;\n`;
  }
  al += `return false;}\n`;

  const popAll = (p) => ws.map((i) => `popc(${p}${i})`).join("+");
  const anyNZ = (p) => ws.map((i) => `${p}${i}`).join("|");

  // Possible non-losing moves for the side to move -> q0.. ; returns false if none.
  const nonLosing = `
  let ${ws.map((i) => `q${i}=((m${i}+BOT${i})|0)&BM${i}`).join(",")};
  ${WPI("o", ws.map((i) => `c${i}^m${i}`), "m")}
  {const ${ws.map((i) => `f${i}=q${i}&o${i}`).join(",")};
   if(${anyNZ("f")}){ if((${popAll("f")})>1) return LOSS; ${ws.map((i) => `q${i}=f${i};`).join("")} }}
  ${ws.map((i) => `q${i}&=~(o${i}>>>1);`).join("")}
  if(!(${anyNZ("q")})) return LOSS;`;

  const keyExpr = ws.map((i) => `const k${i}=(c${i}+m${i})|0;`).join("");
  const hashExpr = `let h=${ws.map((i) => `Math.imul(k${i}^${0x2545f491 + i * 0x1000193},${[0x9e3779b1, 0x85ebca77, 0xc2b2ae3d][i]})`).join("^")}; h^=h>>>15; h=Math.imul(h,0x27d4eb2d); h^=h>>>13; const idx=h&(TTS-1);`;
  const ttMatch = ws.map((i) => `TK${i}[idx]===k${i}`).join("&&");
  const ttStore = (v) => `${ws.map((i) => `TK${i}[idx]=k${i};`).join("")}TV[idx]=${v};`;

  // Move ordering: fill MV/SC at base with candidate columns (sorted ascending, read from the end).
  const order = `
  const base=moves*W; let cnt=0;
  for(let k=W-1;k>=0;k--){ const col=ORDER[k];
    ${ws.map((i) => `const v${i}=q${i}&CMW[${i}*W+col];`).join("")}
    if(${anyNZ("v")}){
      ${WPI("w", ws.map((i) => `c${i}|v${i}`), "m")}
      const sc=SCOREFN;
      let p=cnt++; while(p>0&&SC[base+p-1]>sc){SC[base+p]=SC[base+p-1];MV[base+p]=MV[base+p-1];p--;}
      SC[base+p]=sc; MV[base+p]=col;
    }
  }`;

  const child = (call) => `
    const col=MV[base+i];
    const sc=0-${call}(${ws.map((i) => `c${i}^m${i}`).join(",")},${ws.map((i) => `m${i}|(q${i}&CMW[${i}*W+col])`).join(",")},moves+1`;

  return `"use strict";
const W=cfg.W,H=cfg.H,N=cfg.N,WH=W*H,TTS=cfg.ttSize;
const MIN_SCORE=-(WH>>1)+3, MAX_SCORE=((WH+1)>>1)-3;
const CMW=new Int32Array(N*W);
${ws.map((i) => `let BM${i}=0,BOT${i}=0,R${i}=0;`).join("")}
for(let col=0;col<W;col++){const w=col>>2,sh=(col&3)*8;const cm=(((1<<H)-1)<<sh)|0;CMW[w*W+col]=cm;
  ${ws.map((i) => `if(w===${i}){BM${i}|=cm;BOT${i}|=(1<<sh);}`).join("")}}
// centre-first order: e.g. W=7 -> 3,2,4,1,5,0,6
const ORDER=new Int32Array(W);
{const c=(W-1)/2;const cols=[...Array(W).keys()].sort((a,b)=>Math.abs(a-c)-Math.abs(b-c)||a-b);for(let i=0;i<W;i++)ORDER[i]=cols[i];}
${ws.map((i) => `const TK${i}=new Int32Array(TTS);`).join("")}
const TV=new Uint8Array(TTS);
const MV=new Int32Array((WH+2)*W),SC=new Int32Array((WH+2)*W);
let nodes=0, stop=false, budget=Infinity;
function popc(x){x=x-((x>>>1)&0x55555555);x=(x&0x33333333)+((x>>>2)&0x33333333);return Math.imul((x+(x>>>4))&0x0F0F0F0F,0x01010101)>>>24;}
${wp}
${al}
function negamax(${L("c")},${L("m")},moves,alpha,beta){
  if(++nodes>budget){stop=true;return 0;}
  const LOSS=-((WH-moves)>>1);
  ${nonLosing.replace(/return LOSS/g, "return LOSS")}
  if(moves>=WH-2) return 0;
  let min=-((WH-2-moves)>>1);
  if(alpha<min){alpha=min;if(alpha>=beta)return alpha;}
  let max=(WH-1-moves)>>1;
  ${keyExpr}${hashExpr}
  if(${ttMatch}){const val=TV[idx];
    if(val>MAX_SCORE-MIN_SCORE+1){min=val+2*MIN_SCORE-MAX_SCORE-2;if(alpha<min){alpha=min;if(alpha>=beta)return alpha;}}
    else if(val){max=val+MIN_SCORE-1;if(beta>max){beta=max;if(alpha>=beta)return beta;}}}
  ${order.replace("SCOREFN", popAll("w"))}
  for(let i=cnt-1;i>=0;i--){${child("negamax")},-beta,-alpha);
    if(stop) return 0;
    if(sc>=beta){${ttStore("sc+MAX_SCORE-2*MIN_SCORE+2")}return sc;}
    if(sc>alpha)alpha=sc;
  }
  ${ttStore("alpha-MIN_SCORE+1")}
  return alpha;
}
function canWinNext(${L("c")},${L("m")}){winPos(${L("c")},${L("m")});return !!(${ws.map((i) => `(R${i}&((m${i}+BOT${i})&BM${i}))`).join("|")});}
// Exact solve with null-window iterative narrowing. Returns null if the node budget ran out.
function solve(${L("c")},${L("m")},moves,weak,maxNodes){
  budget=maxNodes||Infinity;stop=false;
  if(canWinNext(${L("c")},${L("m")})) return (WH+1-moves)>>1;
  let min=-((WH-moves)>>1),max=(WH+1-moves)>>1;
  if(weak){min=-1;max=1;}
  while(min<max){
    let med=min+Math.trunc((max-min)/2);
    if(med<=0&&Math.trunc(min/2)<med)med=Math.trunc(min/2);
    else if(med>=0&&Math.trunc(max/2)>med)med=Math.trunc(max/2);
    const r=negamax(${L("c")},${L("m")},moves,med,med+1);
    if(stop){budget=Infinity;return null;}
    if(r<=med)max=r;else min=r;
  }
  budget=Infinity;
  return min|0;
}
// Heuristic: winning cells (threats) and centre control, from the side to move.
const CENTER=new Int32Array(N);
{const c=(W-1)/2;for(let col=0;col<W;col++){if(Math.abs(col-c)<1){const w=col>>2;CENTER[w]|=CMW[w*W+col];}}}
function evalPos(${L("c")},${L("m")}){
  winPos(${L("c")},${L("m")}); const mine=${popAll("R")};
  winPos(${ws.map((i) => `c${i}^m${i}`).join(",")},${L("m")}); const theirs=${popAll("R")};
  const cen=${ws.map((i) => `popc(c${i}&CENTER[${i}])-popc((c${i}^m${i})&CENTER[${i}])`).join("+")};
  return (mine-theirs)*6+cen*2;
}
// Depth-limited alpha-beta. Exact wins/losses found inside the horizon come back as +-(BIG+score).
function hsearch(${L("c")},${L("m")},moves,depth,alpha,beta){
  ++nodes;
  const LOSS=-(${BIG}+((WH-moves)>>1));
  ${nonLosing}
  if(moves>=WH-2) return 0;
  if(depth<=0) return evalPos(${L("c")},${L("m")});
  ${order.replace("SCOREFN", popAll("w"))}
  let best=-1e9;
  for(let i=cnt-1;i>=0;i--){${child("hsearch")},depth-1,-beta,-alpha);
    if(sc>best)best=sc;
    if(sc>alpha)alpha=sc;
    if(alpha>=beta)break;
  }
  return best;
}
function hroot(${L("c")},${L("m")},moves,depth){
  if(canWinNext(${L("c")},${L("m")})) return ${BIG}+((WH+1-moves)>>1);
  return hsearch(${L("c")},${L("m")},moves,depth,-1e9,1e9);
}
function clearTT(){TV.fill(0);}
return {negamax,solve,canWinNext,winPos,aligned,hroot,evalPos,clearTT,popc,
  get nodes(){return nodes;}, set nodes(v){nodes=v;}, R(){return [${ws.map((i) => `R${i}`).join(",")}];}, CMW, ORDER, BM:[${ws.map((i) => `BM${i}`).join(",")}], BOT:[${ws.map((i) => `BOT${i}`).join(",")}]};
`;
}

const cache = new Map();

/** makeSolver(W, H) -> solver for that board size (cached). */
export function makeSolver(W = 7, H = 6, { ttBits = 21 } = {}) {
  if (!(W >= 4 && W <= 12 && H >= 4 && H <= 7)) throw new Error("Board size not supported: " + W + "x" + H);
  const ck = W + "x" + H + ":" + ttBits;
  if (cache.has(ck)) return cache.get(ck);
  const N = Math.ceil(W / 4);
  const ttSize = 1 << ttBits;
  const core = new Function("cfg", genSource(W, H, N))({ W, H, N, ttSize });
  const WH = W * H;

  const bit = (col, row) => [col >> 2, 1 << ((col & 3) * 8 + row)];

  /** Position object: { c:[words] (side to move), m:[words] (all discs), h:[heights], moves } */
  function empty() { return { c: new Array(N).fill(0), m: new Array(N).fill(0), h: new Array(W).fill(0), moves: 0 }; }
  function clone(p) { return { c: p.c.slice(), m: p.m.slice(), h: p.h.slice(), moves: p.moves }; }
  function canPlay(p, col) { return col >= 0 && col < W && p.h[col] < H; }
  /** play a column in place (no win check) */
  function play(p, col) {
    const [w, b] = bit(col, p.h[col]);
    for (let i = 0; i < N; i++) p.c[i] ^= p.m[i];
    p.m[w] |= b; p.h[col]++; p.moves++;
    return p;
  }
  /** does the side to move win immediately by playing col? */
  function isWin(p, col) {
    if (!canPlay(p, col)) return false;
    const [w, b] = bit(col, p.h[col]);
    const q = p.c.slice(); q[w] |= b;
    return core.aligned(...q);
  }
  /** "4455" style move list (1-based columns, like the standard solver test format) */
  function fromMoves(seq) {
    const p = empty();
    for (const ch of String(seq)) {
      const col = parseInt(ch, 36) - 1;
      if (!canPlay(p, col) || isWin(p, col)) return null;
      play(p, col);
    }
    return p;
  }
  /** grid[col][row] in {0 empty, 1 first player, 2 second player}, rows from the bottom. */
  function fromGrid(grid) {
    const p = empty();
    let n1 = 0, n2 = 0;
    const s1 = new Array(N).fill(0), s2 = new Array(N).fill(0);
    for (let col = 0; col < W; col++) {
      let h = 0;
      for (let row = 0; row < H; row++) {
        const v = grid[col][row] | 0;
        if (!v) break;
        const [w, b] = bit(col, row);
        p.m[w] |= b; if (v === 1) { s1[w] |= b; n1++; } else { s2[w] |= b; n2++; }
        h++;
      }
      p.h[col] = h;
    }
    p.moves = n1 + n2;
    const toMove = n1 === n2 ? 1 : 2;
    p.c = toMove === 1 ? s1 : s2;
    return p;
  }
  function solvePos(p, opts = {}) {
    return core.solve(...p.c, ...p.m, p.moves, !!opts.weak, opts.maxNodes || 0);
  }
  /** Score of every column (side to move's view); null = column full. Budget per column optional. */
  function analyze(p, opts = {}) {
    const out = new Array(W).fill(null);
    for (const col of core.ORDER) {
      if (!canPlay(p, col)) continue;
      if (isWin(p, col)) { out[col] = (WH + 1 - p.moves) >> 1; continue; }
      const q = play(clone(p), col);
      if (q.moves >= WH) { out[col] = 0; continue; }
      const s = solvePos(q, opts);
      out[col] = s === null ? undefined : -s; // undefined = ran out of budget
    }
    return out;
  }
  /** Heuristic search score of each column (exact wins/losses as +-(BIG+s)). */
  function hAnalyze(p, depth) {
    const out = new Array(W).fill(null);
    for (const col of core.ORDER) {
      if (!canPlay(p, col)) continue;
      if (isWin(p, col)) { out[col] = BIG + ((WH + 1 - p.moves) >> 1); continue; }
      const q = play(clone(p), col);
      if (q.moves >= WH) { out[col] = 0; continue; }
      out[col] = -core.hroot(...q.c, ...q.m, q.moves, depth - 1);
    }
    return out;
  }
  /** Turns a score into "who wins and on which of their turns". */
  function describe(score, moves) {
    if (score === 0) return { result: "draw", turns: null, plies: WH - moves };
    if (score > 0) { const k = ((WH + 3 - moves) >> 1) - score; return { result: "win", turns: k, plies: 2 * k - 1 }; }
    const k = ((WH + 2 - moves) >> 1) + score; return { result: "loss", turns: k, plies: 2 * k };
  }
  /** canonical book key for a position (mirror-folded) */
  function key(p) {
    const k = p.c.map((x, i) => ((x + p.m[i]) >>> 0).toString(36)).join(".");
    // mirror: rebuild from columns reversed
    const mc = new Array(N).fill(0), mm = new Array(N).fill(0);
    for (let col = 0; col < W; col++) {
      const w = col >> 2, sh = (col & 3) * 8;
      const cc = (p.c[w] >>> sh) & 0xff, mmm = (p.m[w] >>> sh) & 0xff;
      const t = W - 1 - col, tw = t >> 2, tsh = (t & 3) * 8;
      mc[tw] |= cc << tsh; mm[tw] |= mmm << tsh;
    }
    const k2 = mc.map((x, i) => ((x + mm[i]) >>> 0).toString(36)).join(".");
    return k < k2 ? k : k2;
  }
  const api = { W, H, N, WH, BIG, core, empty, clone, canPlay, play, isWin, fromMoves, fromGrid, solvePos, analyze, hAnalyze, describe, key,
    get nodes() { return core.nodes; }, set nodes(v) { core.nodes = v; }, clearTT: core.clearTT, order: Array.from(core.ORDER) };
  cache.set(ck, api);
  return api;
}

function prevPrime(n) {
  const isP = (x) => { if (x < 2) return false; for (let d = 2; d * d <= x; d++) if (x % d === 0) return false; return true; };
  while (!isP(n)) n--;
  return n;
}

export { BIG };
