/* Opening book for standard 7x6 Connect Four (dropping discs, no Pop Out):
 * win / draw / loss with perfect play for every position with 0..8 discs.
 * Built by tools/build-book.mjs from John Tromp's 8-ply database (UCI Machine
 * Learning Repository "Connect-4", CC BY 4.0) plus our own solver for the
 * positions that database leaves out, then minimax back to the empty board.
 *
 * Key: each column becomes a 7-bit code (1 << height) | (bits of first-player
 * discs); key = sum(code[c] * 128^c). Mirror images share one entry (smaller key).
 * Values are from the FIRST player's point of view: 0 loss, 1 draw, 2 win.
 * File format: sorted keys, each written as varint(deltaFromPrevious * 3 + value). */

export function colCodes(cells, W = 7, H = 6) {
  const codes = new Array(W);
  for (let c = 0; c < W; c++) {
    let h = 0, bits = 0;
    for (let r = 0; r < H; r++) { const v = cells[c * H + r]; if (!v) break; if (v === 1) bits |= 1 << r; h++; }
    codes[c] = (1 << h) | bits;
  }
  return codes;
}
export function bookKey(cells) {
  const codes = colCodes(cells);
  let a = 0, b = 0;
  for (let c = 6; c >= 0; c--) { a = a * 128 + codes[c]; b = b * 128 + codes[6 - c]; }
  return Math.min(a, b);
}

export function encodeBook(entries /* Map key -> value */) {
  const keys = [...entries.keys()].sort((x, y) => x - y);
  const out = [];
  let prev = 0;
  for (const k of keys) {
    let v = (k - prev) * 3 + entries.get(k);
    prev = k;
    while (v >= 128) { out.push((v % 128) | 128); v = Math.floor(v / 128); }
    out.push(v);
  }
  return Uint8Array.from(out);
}

export function decodeBook(bytes) {
  const map = new Map();
  let prev = 0, i = 0;
  while (i < bytes.length) {
    let v = 0, mul = 1, b;
    do { b = bytes[i++]; v += (b & 127) * mul; mul *= 128; } while (b & 128);
    const val = v % 3;
    prev += (v - val) / 3;
    map.set(prev, val);
  }
  return map;
}
