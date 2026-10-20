# progress — Connect Four

## START HERE
Read this, then CLAUDE.md (commands, traps), then docs/rules-check.md and docs/ideas.md. Last updated 2026-10-20.

## Goal right now
A Connect Four site in the board-games family: play the computer at measured levels, study games with a perfect solver, check a real table's board, and play friends online. Built as part of Tim's "add risk, clue, battleship, connect four, … to the list of games" wave. Live: https://timothyhadfield.github.io/connect-four/ (repo TimothyHadfield/connect-four).

## Status
| Part | State |
|---|---|
| Rules engine (js/game.js, rules.js) | Done. Sizes 7×6, 6×5, 8×7, 9×7, 5×4; Pop Out (own-pop, both-four goes to the popper, repetition draw at 3, full-board pop-or-draw). |
| Solver | Done. Pons-style negamax in WebAssembly (js/solver.wasm from wasm/solver.ts) for boards with W·(H+1) ≤ 64, JS fallback (js/solver.js), opening book data/book7x6.bin (128,323 positions). |
| Computer levels | Beginner / Easy / Medium / Strong / Perfect, measured 2026-10-20 over 3,700 games (js/strength-data.js, shown in Study › Lab). |
| Play tab | Chips above each column (win/draw/lose + turns), hint, undo, record. |
| Study | Review (tags Best…Blunder, points lost, threats), 27 puzzles, Lab (opening map, Tromp size table, cell power, strength table). |
| Table tab | Copy a real board; verdict per column. |
| Online | Shared `../_online/online.js` (security fix of 2026-10-20 included, commit 0b193d8 of _online), gameId "connect-four". Two-browser test passes on LIVE site 2026-10-20. |
| Tests | `npm test` 26/26 (about 40 s). Every test seen failing on a mutated engine. Browser checks: `node tools/regress.mjs [url]` (12 checks from the QA pass; all 11 bug checks failed on build 1, all pass on build 2). |
| Done gate | Tests, live smoke (phone + desktop, 0 errors, 0 failed requests, no overflow), live two-browser online, QA pass + fixes (build 2): 2026-10-20. |
| Design pass (build 3) | 2026-10-20: board art (shaded holes, light lip, disc highlight, feet + shadow), win dims the other discs, hover tint only on the frame, status/verdict fixed heights (board never moves at game end, measured 0 px), bigger laptop status/players, Study side panels on laptop, review picker ellipsis, 40px "?" tap area, online card at the top, size-table glyphs bigger. Before/after shots in the manager's scratchpad `design/connect-four/`. |
| Saved data (js/saved.js) | Every field of `c4:v1` checked on load; history and the unfinished game replayed through the rules, bad ones dropped. Unfinished local game restored on reload (`S.current`). Table keeps one board per size (`c4:table:WxH`). |

## Standing instructions
- Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games."
- Tim (for all games): online play "with a computer or other online players … that match exactly the play of the in-person game." $0, static Pages only.
- Tim owns looks, wording and names; don't restyle uninvited.

## Traps
- Never `import "./app.js"` from another module (index.html loads `app.js?v=N`, a second copy breaks the page). Shared bits are in ui.js.
- Study stores Pop Out values under `popv` (`cols.pop` collides with Array.prototype.pop).
- Windows: the test script needs the quoted glob `node --test "tests/*.test.js"`.
- phone-view `--do` cannot take spaces; the scratch smoke script (c4cache/smoke.mjs in the Temp folder) drives full games instead.
- WebKit logs cut-off Firestore requests on reload; tools/two-browsers.mjs treats them as noise.
- The computer's "busy" flag is a game number (`P.botGen`), not a boolean: a boolean got stuck when a new game started mid-think and the computer never moved again (QA 2026-10-20).
- The record counts each game once (`P.gameId` survives Undo); a re-finished game replaces its history entry.
- Exact win distances early in a game can take up to a minute; the Table tab caps the budget at 4e6 nodes, Review at 1.5e6.

## Decisions
- Red always seat 0 and moves first unless "who starts" says otherwise.
- Pop Out repetition draw (same position 3 times) is declared automatically.
- 5×4 board added beyond the brief's list (small, fully solvable, good for learning).
- Solver chips shown by default on Play (switch in Settings).
- Strength measured from random 2-disc openings played twice with colours swapped.
- Pop 10 and special editions not built (docs/rules-check.md "Not built").

## NOT verified
- Real iPhone (only WebKit at iPhone size).
- "Perfect" is truly perfect only when the solver finishes in time: in 1 of 900 measured games it did worse than its start allowed; on 9×7 and Pop Out it looks ahead and can be beaten (said in Help).
- Pop Out analysis is heuristic, not solved.
