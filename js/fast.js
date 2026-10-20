/* Wrapper around the WebAssembly exact solver (wasm/solver.ts -> js/solver.wasm).
 * Works for boards with W*(H+1) <= 64. Positions are plain boards:
 *   board = { W, H, cells: Int8Array/array W*H, column-major (col*H+row), 0 empty / 1 / 2 }
 * plus who is to move (1 or 2). Scores follow the convention in solver.js. */

export const ABORTED = -1000;

export function fitsWasm(W, H) { return W * (H + 1) <= 64 && W <= 16; }

/** Instantiate from wasm bytes (ArrayBuffer/Uint8Array). One instance = one board size at a time. */
export async function makeFast(bytes, W, H, ttBits = 22) {
  const { instance } = await WebAssembly.instantiate(bytes, { env: { abort() { throw new Error("wasm abort"); } } });
  const x = instance.exports;
  x.init(W, H, ttBits);
  const WH = W * H, CB = H + 1;

  function encode(cells, toMove) {
    let cl = 0, ch = 0, ml = 0, mh = 0, moves = 0;
    for (let col = 0; col < W; col++) {
      for (let row = 0; row < H; row++) {
        const v = cells[col * H + row];
        if (!v) break;
        moves++;
        const b = col * CB + row;
        if (b < 32) { ml |= 1 << b; if (v === toMove) cl |= 1 << b; }
        else { mh |= 1 << (b - 32); if (v === toMove) ch |= 1 << (b - 32); }
      }
    }
    return [cl >>> 0, ch >>> 0, ml >>> 0, mh >>> 0, moves];
  }
  /** exact score for the side to move, or ABORTED if maxNodes ran out */
  function solve(cells, toMove, opts = {}) {
    const [cl, ch, ml, mh, moves] = encode(cells, toMove);
    if (moves >= WH) return 0;
    return x.solve(cl, ch, ml, mh, moves, opts.weak ? 1 : 0, opts.maxNodes || 0);
  }
  return { W, H, WH, solve, encode, clearTT: () => x.clearTT(), nodes: () => x.getNodes(), reinit: (w, h, b = ttBits) => x.init(w, h, b) };
}
