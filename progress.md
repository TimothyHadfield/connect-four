# progress — Connect Four

## START HERE
Read this, then CLAUDE.md (commands, traps), then docs/rules-check.md and docs/ideas.md. Last updated 2026-10-27 (build 8, My stats + Daily game, live).

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
| Tests | `npm test` 56/56 since build 8 (was 49/49 in build 6; about 40 s). Odd-situation browser checks: `node tools/edge.mjs [url] [shotDir]` (24 checks). Every test seen failing on a mutated engine. Browser checks: `node tools/regress.mjs [url]` (12 checks from the QA pass; all 11 bug checks failed on build 1, all pass on build 2). |
| Done gate | Tests, live smoke (phone + desktop, 0 errors, 0 failed requests, no overflow), live two-browser online, QA pass + fixes (build 2): 2026-10-20. |
| Design pass (build 3) | 2026-10-20: board art (shaded holes, light lip, disc highlight, feet + shadow), win dims the other discs, hover tint only on the frame, status/verdict fixed heights (board never moves at game end, measured 0 px), bigger laptop status/players, Study side panels on laptop, review picker ellipsis, 40px "?" tap area, online card at the top, size-table glyphs bigger. Before/after shots in the manager's scratchpad `design/connect-four/`. |
| Real-table look (build 5) | 2026-10-20: Play tab is a wooden table (shared `_table` kit: css/table.css + js/game-table.js, byte-for-byte copies; the kit's table.js is renamed game-table.js because js/table.js is this site's Table tab). Board drawn like the real grid: see-through holes, drop slot on each column, ridges, side legs on flared feet, slider bar with pull tab (slides out on New game / Clear). Each player's own discs lie in stacks of 7 at their seat (js/seats.js): yours at the near edge, the opponent's across the table; stacks shrink as discs are played (a disc lifts off), refill on a pop. Phone landscape puts the seats left/right of the board. Research: manager scratchpad `table/connect-four/real.md`, before/after shots there. |
| Sound & effects (build 4) | 2026-10-20: js/fx.js (shared _fx 1.0.3 since build 5, never edit here) + js/sfx.js (event → sound map, custom sounds). Settings › "Sound & effects". Tests: tests/fx.test.js (15). Map below. |
| Edge pass (build 6) | 2026-10-20: 45 odd situations tested, 10 failed, all fixed. See "Odd situations" below. |
| Visibility pass (build 7) | 2026-10-21: laptop Play puts status, verdict and buttons at the top of the side column (app.js `placeControls`, moved back under 900 px) so the board gets the table's full height (1280: holes 51 → 65 px, board 26% → 41% of the screen). Phone on its side: board in the middle at full table height, your seat + status + verdict on the left, opponent's seat on the right (holes 19 → 26 px); Table and Study on their side put the board left and the controls in a right column (Table holes 15 → 33 px, Study 3.5 → 29 px). Chip text 25 → 32 units (393 px phone: 11.4 → 14.6 px). Portrait phone Study: move list and puzzle list are one row that scrolls sideways (current move scrolled into view), 25-move review holes 26.5 → 31 px; Study on its side gives the controls half the width. Check: `node tools/layout.mjs [url] [webkit\|chrome]` (both pass; build 6 failed 11). Audit + before/after shots: manager scratchpad `vis/connect-four/`. Shipped 2026-10-27. |
| My stats (build 8) | 2026-10-27, pilot of the shared `_profile` kit (game-profile 1.0.1, repo TimothyHadfield/game-profile): js/profile.js + css/profile.css are byte-for-byte copies (never edit here); Connect Four's part is js/profile-c4.js. Avatar button in the table's top-left corner ("My stats" label on laptop) opens the panel: name + picture, Elo, W/D/L per level, 8 achievements, Daily tab, export/import. Level Elo from strength-data (Beginner 800, Easy 1200, Medium 1500, Strong 1700, Perfect 2100). A game where the solver chips were shown, Hint or Undo was used counts under "Computer, with help" and is not rated (chips are on by default). Elo change shows after a rated game. Daily game (New game › Daily, or the panel): today's seeded 4-disc opening vs Strong on 7×6, no chips/hint/undo, once a day; leaving it unfinished counts as a loss; survives reload (keeps its start day past midnight). Older history brought in once on first load. Tests: tests/profile.test.js (7). |
| Saved data (js/saved.js) | Every field of `c4:v1` checked on load; history and the unfinished game replayed through the rules, bad ones dropped. Unfinished local game restored on reload (`S.current`). Table keeps one board per size (`c4:table:WxH`). |

## Standing instructions
- Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games."
- Tim (for all games): online play "with a computer or other online players … that match exactly the play of the in-person game." $0, static Pages only.
- Tim owns looks, wording and names; don't restyle uninvited.
- Tim (all games, 2026-10-20): "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered."
- Tim (all games, 2026-10-20): "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life, so it's easy to understand if you've already played it before, and also so it feels more like you're actually playing in real life rather than you're playing it online. Even things like how youre cards or other things are laid out infront of you, make it look like they are actual cards laid out similar to how it looks like in real life. Make the decks look like actual decks. Make the board have the same design as it does in real life with the same layouts. It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life (not actually, but the layout and style of everything should be similar)."

- Tim (all games, 2026-10-20): "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird."

- Tim (all games, 2026-10-21): "for a lot of the games the cards or board layout is too small to easily see what's going on. Some games just need small design imporvements like filling the screen with the board view and fitting the cards and other things in the empty space, some have severe errors like TTR. Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense in what's happening and if the user can reasonably see it."

## Odd situations (edge pass, build 6)
45 scenarios (full table: manager scratchpad `edge/connect-four/scenarios.md`). 35 passed as built; 10 failed and were fixed, each seen failing in `tools/edge.mjs` first:
- 2 players: plate said "Red / Red" (colour now said once); the loser now starts the next game (was: whoever didn't start); a double tap no longer drops both players' discs (taps within 350 ms ignored in 2-player mode).
- Pop mode switched off by Undo. Pop Out full board at 320 px: the 5 buttons share the row (labels wrap, icons hidden).
- "?" inside a sheet returns to that sheet; Back with a sheet open closes it and stays put.
- Two tabs: each tab takes in the other's saves (`storage` event, ui.js `adoptStored`), so results aren't wiped. Each tab keeps its own unfinished game.
- History dates use the local day (was UTC: evening games were dated tomorrow).
- Landscape 9×7: stacks shrink to fit beside the board (ran 13 px off the table). Laptop window crossing 900 px redraws the seats.
- By design, not changed: changing board size in Settings starts a new game; reload after a finished game opens a fresh one; Study's Review / Puzzles / Lab switch is not a Back step.

## Event → sound map (js/sfx.js)
| Event | Sound | Animation |
|---|---|---|
| Disc dropped (you, computer, online opponent, Table tab) | `clack` when it lands (82% of the drop), pitch higher / softer the shorter the fall; `clackBounce` on the bounce. Opponent's at 0.85 volume | the board's own drop (Fast = 0.55×, off with Animations) |
| Pop Out pop | `discPop` (slides out, lands on the table), then `settle` when the column above lands | the board's own pop |
| Becomes YOUR turn (vs computer / online only, not pass-and-play) | `turn` after the other disc lands | your player card pops |
| Illegal tap: full column, pop not your disc | `error` | board shakes |
| Tap when not your turn / game over | `error` | none |
| You win / friends-mode win / online winner | `FX.celebrate win` in the winner's disc colours | winning four pop in turn; score counts up with "+1" |
| You lose (computer or online) | `FX.celebrate lose` | computer's score counts up |
| Beat Strong or Perfect, or a five-in-a-row / double four | extra `FX.celebrate big` | sparkles at the status |
| Draw (full board, repetition, called) | `drawTone` (gentle, Celebrations switch) | status pulses |
| New game / Table "Clear" (board had discs) | `release` (slider clack + disc clatter) | old discs fall out through the bottom |
| Undo, reload, resume, joining a room | silent (more than one move changed) | none |

## Traps
- **online.js cache stamp (2026-10-27):** every import of `js/online.js` uses `?v=a3d0418b`, the `_online` content stamp. After a re-copy: put the new stamp from `node ../_online/tools/stamp.mjs` there, bump the importing file's `?v=` (and pwa.js `data-version`), then `node ../_online/tools/stamp.mjs --check .` must say OK.
- Never `import "./app.js"` from another module (index.html loads `app.js?v=N`, a second copy breaks the page). Shared bits are in ui.js.
- Study stores Pop Out values under `popv` (`cols.pop` collides with Array.prototype.pop).
- Windows: the test script needs the quoted glob `node --test "tests/*.test.js"`.
- phone-view `--do` cannot take spaces; the scratch smoke script (c4cache/smoke.mjs in the Temp folder) drives full games instead.
- WebKit logs cut-off Firestore requests on reload; tools/two-browsers.mjs treats them as noise.
- The computer's "busy" flag is a game number (`P.botGen`), not a boolean: a boolean got stuck when a new game started mid-think and the computer never moved again (QA 2026-10-20).
- The record counts each game once (`P.gameId` survives Undo); a re-finished game replaces its history entry.
- fx.js's injected CSS has the same specificity as this site's `.switch` / `.seg` rules and loads later, so it wins: the `.fx-set …` block at the end of style.css puts the site's look back. Keep it when re-copying fx.js.
- Shared copies (js/fx.js, js/game-table.js, css/table.css) are marked `-text` in .gitattributes so Windows merges can't turn them CRLF; after a merge check they still `cmp` equal to `../_fx/fx.js`, `../_table/table.js`, `../_table/table.css`.
- Laptop (≥ 900 px): `#pstatus`, `#pverdict` and `#pactions` live in the side column's `#pctrl` (moved by app.js `placeControls`, not copied); the side panels render into `#pside` (`.side-body`). Don't look for them inside `.tabletop` on laptop.
- Phone on its side: the Table tab and Study use `display: contents` on `.play-main` / `.study-side` so their children sit in a 2-column grid (board left, rest right).
- `#pl` is `display: contents`: its two `.pl` seats stay in seat order (sfx.js and the score bump index them by seat) while CSS `order` puts the far seat above the board and yours below.
- FX.celebrate plays its fanfare through fx.js's own play(), so a spy on FX.play can't see it; tests/fx.test.js counts it from FX.stats.plays.
- `S.nextStart` is shared by 2-player "loser starts" and the computer's "Take turns" (both flip it).
- tools/two-browsers.mjs uses real Firebase and can time out once on a slow network (1 of 3 runs on 2026-10-20); rerun before suspecting code.
- Shared copies js/profile.js + css/profile.css must `cmp` equal to `../_profile/profile.js` / `profile.css` (also `-text`). Profile storage keys: `profile:me`, `profile:connect-four`; finished online game key `c4:onlineDone` (stops a reload counting it twice).
- `P.helped` is set by drawChips / Hint / Undo and saved with the unfinished game; `P.daily` + `P.dailyDate` likewise (saved.js cleanCurrent keeps `daily` and `helped`).
- Exact win distances early in a game can take up to a minute; the Table tab caps the budget at 4e6 nodes, Review at 1.5e6.

## Decisions
- Red always seat 0 and moves first unless "who starts" says otherwise.
- Pop Out repetition draw (same position 3 times) is declared automatically.
- 5×4 board added beyond the brief's list (small, fully solvable, good for learning).
- Solver chips shown by default on Play (switch in Settings).
- Strength measured from random 2-disc openings played twice with colours swapped.
- Table look (build 5, Tim's call to change): dark wood table; discs kept in stacks of 7; friends mode puts Red at the near edge; buttons and tab bar stay app-style, off the table; win rings/dimming and last-move dot kept.
- My stats (build 8, Tim's call to change): button placement, achievement names, "with help" games unrated, Daily = 4-disc opening vs Strong with no help and leaving = loss.
- Pop 10 and special editions not built (docs/rules-check.md "Not built").

## NOT verified
- Real iPhone (only WebKit at iPhone size).
- "Perfect" is truly perfect only when the solver finishes in time: in 1 of 900 measured games it did worse than its start allowed; on 9×7 and Pop Out it looks ahead and can be beaten (said in Help).
- Pop Out analysis is heuristic, not solved.
- Sounds never heard by ear: headless WebKit on Windows has no Web Audio, so checks used a fake AudioContext (which sounds fire, when). Loudness/feel on a real iPhone not checked.
- Table look (build 5): the slider slide-out and disc lift-off seen only as running animations in headless WebKit, not by eye on a phone.
- Online sounds (opponent's disc + your-turn chime from the snapshot) tested in node with the online seat logic, not in a live two-browser run.
- Edge pass: online AFK / host leaving mid-game / Firestore offline-then-back not driven (shared online.js); page left 10 min in the background not run; Pop Out disc supply (more than 21 of one colour on the board) has no limit here, Hasbro sheet not re-read for it.
- My stats (build 8): online result recording and the "not counted twice after reload" guard reasoned, not driven with two browsers; Daily past midnight reasoned (dates passed through, not clock-tested in a browser); export/import file picker not driven in WebKit (kit tests cover the data). Reviewer: phone button sits near the Computer's plate and may read as the computer's picture; Elo / Score not explained in the panel.
- Visibility pass (build 7): sideways swipe of the one-row move list on a real phone not felt (WebKit taps only). Still small, left on purpose: 320 px Study holes 21.8 px, 320 px chip words 11.4 px (chip is one column wide), laptop Table/Study keep 87–169 px wood/blank either side (height-bound, holes 60–70 px). Study game picker still truncates "Red won · 25 moves" on phones (existing label).
