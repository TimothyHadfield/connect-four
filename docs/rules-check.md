# Rules check — Connect Four

Every rule the engine (`js/game.js`, `js/rules.js`) enforces, where it comes from, and the test that pins it.
Checked 2026-10-20. Rule wording here is our own summary, not copied text.

**Sources**
- [H] Hasbro, Connect 4 instructions — instructions.hasbro.com (Connect 4 product page, PDF rules sheet; includes Pop Out and Pop 10)
- [W] Wikipedia, "Connect Four" — en.wikipedia.org/wiki/Connect_Four
- [T] John Tromp, "John's Connect Four Playground" — tromp.github.io/c4/c4.html (board-size results, 8-ply database)
- [P] Pascal Pons, "Solving Connect 4" — blog.gamesolver.org and connect4.gamesolver.org (solver method, test positions)
- [K] Pekkala, J. (2014), Master's thesis, University of Oulu — oulurepo.oulu.fi/handle/10024/39813 (Pop Out analysis)

## Standard game

| # | Rule | Sources | Status | Test (tests/game.test.js) |
|---|------|---------|--------|---------------------------|
| 1 | Board is 7 columns × 6 rows, upright; 21 discs per player (42 total) | H, W | 2 sources agree | "classic board: 7 columns x 6 rows, 21 discs each" |
| 2 | Players take turns dropping one disc into any column that isn't full; it falls to the lowest empty spot | H, W | agree | "discs fall to the lowest empty spot…" |
| 3 | Four of your colour in a line — across, up and down, or diagonal — wins at once | H, W | agree | "four across, up, and both diagonals win…" |
| 4 | There are 69 possible lines of four on 7×6 | follows from rules 1 + 3; counted by enumeration in the test (W and T don't state the number) | derived | "there are exactly 69 ways to make four…" |
| 5 | Board full with no four = draw | H, W | agree | "classic board…" (full drawn board, why = full) |
| 6 | Who goes first is chosen by the players (Hasbro: players decide; tournament practice alternates) | H, W | agree | "the 'first' option decides who drops first" (Settings: You / Computer / Take turns) |
| 7 | Hasbro: first to win 5 games is champion | H | single source; shown as a running score per level, no forced match end | — (display only) |
| 8 | No move after the game ends; no move out of turn | implied by H, W | — | "four across…" (throws "over"), "discs fall…" (throws "turn") |

## Pop Out (Hasbro variant)

| # | Rule | Sources | Status | Test |
|---|------|---------|--------|------|
| 9 | On your turn, either drop a disc OR pop one of YOUR OWN discs out of the bottom row; the column slides down | H, W, K | 3 agree | "Pop Out: pop only your own bottom disc…" |
| 10 | A pop that makes four for both colours wins for the player who popped | W, K (Allen's ruling, thesis p. 9) | 2 agree; Hasbro sheet silent | "a pop that makes four for both colours wins for the popper" |
| 11 | A move that makes four only for the opponent: the opponent wins | W, K | agree | "a pop that makes four only for the opponent loses" |
| 12 | Board full: the player to move may pop one of their discs, or call it a draw | H, W | agree | "with a full board you may pop or call a draw"; if they have no disc to pop, the draw is automatic |
| 13 | The same position three times = draw | K (repetition rule used in solving); W mentions endless play | single firm source; **we declare it automatically** (either player could claim it) | "the same position three times is a draw" |
| 14 | Pop Out 7×6 is a first-player win with perfect play | K | single source (the brief's Edelkamp & Kissmann attribution was wrong) | — (Help text only) |

## Board sizes (settings)

| # | Fact | Source | Test |
|---|------|--------|------|
| 15 | 7×6: first player wins (centre opening; wins on the 41st disc) | T, P, W, our book | "opening book: the empty board wins…"; book agrees with exact solver on 40 random 8-disc positions |
| 16 | First-move results on 7×6: columns 1–7 = L L D W D L L | T, P | same test (asserts `[0,0,1,2,1,0,0]`) |
| 17 | 6×5 draw · 8×7 first-player win · 5×4 draw · 9×7 unsolved | T (results table, checked against the page 2026-10-20) | Lab › Board sizes table copies T exactly |
| 18 | Solver scores match 290 published solved positions | P (test sets) | tests/solver.test.js |

## Not built
- **Pop 10** (third Hasbro mode: start full, pop your colour, keep it if it was in a four, first to 10 kept). Different goal and setup; parked as an idea (docs/ideas.md).
- **Power Up / Pop Out "special discs"** editions: product variants with extra pieces, not in the classic rules.
