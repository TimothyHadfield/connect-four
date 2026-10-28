# chat log — Connect Four

## 2026-10-20 — first build (builder agent under the games manager)
- **Asked:** Tim: "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." Manager brief: 7×6 + Pop Out + sizes, bitboard solver in a worker, measured levels, study mode, real-table companion, original SVG art, online via _online.
- **Built:** whole site (Play, Study, Table, Settings), wasm solver + opening book, 5 levels, 27 puzzles, online play, tools (strength, puzzles, book, two-browsers).
- **Verified:** `npm test` 22/22 with mutation checks; live smoke on WebKit iPhone + desktop (full games, every tab, 0 console errors, 0 failed requests, no overflow); `node tools/two-browsers.mjs` on the live site (join, 4 moves, reload rejoin, win seen by both) all PASS; strength run 3,700 games.
- **Open:** see progress.md NOT verified.

## 2026-10-20 — QA fixes (build 2)
- **Asked:** manager relayed the fresh QA agent's 9 bugs + 2 suspicions (computer stuck after a new game mid-think, reload lost the game, broken saved data, Undo double-counting, Hint with solver off, 320px stepper, Table one size only, tap during the falling disc, room-code length, taps during online reconnect).
- **Built:** js/saved.js (validation), game restore on reload, computer gate by game number, once-per-game record, hint on verdicts (not distances), queued taps, per-size table, stepper fits 320px, room code cleaned to 5 characters, "Reconnecting to your room" blocks taps. online.js re-copied (_online cf38e03).
- **Verified:** tests/saved.test.js failed 3/4 on the old loader, passes on the new; tools/regress.mjs 11/12 FAIL on live build 1, 12/12 PASS on build 2; npm test 26/26; smoke and two-browser online (with new reconnect check) pass.

## 2026-10-20 — visual design pass (build 3)
- **Asked:** Tim: "once you're finished with all the games, review them again for design improvements especially visually." Polish only; no rules or wording changes.
- **Built:** board.js art (shaded holes, light lip, disc shine, rounded feet + ground shadow, hover tint only over the frame, win dims the other discs); style.css (fixed status/verdict heights, bigger laptop status and player cards, Study side panels on laptop, picker ellipsis, list fade, 40px "?" hit area, online card at top, size-table glyphs); app.js adds `over` class to the end status.
- **Verified:** npm test 26/26; `node tools/regress.mjs http://127.0.0.1:8741/` 12/12; 10 states x phone + 1280 laptop WebKit shots, 0 errors, no overflow; board rect identical before/after the winning move (phone and laptop).
- **Open:** muted text contrast (~3.5:1, hub palette) and friend-mode "Red / Red" card subtitles left as Tim's call.

## 2026-10-20 — sounds, celebrations, animations (build 4)
- **Asked:** Tim: "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." Manager ideas: disc clack pitched by fall + bounce, full-column error, Pop Out pop + settle, win confetti in the winner's colour, gentle draw, slider-release clatter on new game.
- **Built:** js/fx.js (shared _fx 1.0.2, unchanged copy), js/sfx.js (event map + custom sounds), wiring in app.js / table.js, "Sound & effects" panel in Settings, CSS so the fx rows match the site's switches and segments.
- **Verified:** tests/fx.test.js 15/15 (failed to load on the unfixed code; mutations "always win", "chime every turn", "no settle", "release ignores Animations" each caught); npm test 41/41; in-page WebKit check with a fake AudioContext 15/15 (scratchpad c4-fx-e2e.mjs); tools/regress.mjs 12/12 on local; phone + desktop shots of Settings, mid-game, win with confetti (manager scratchpad design/connect-four-fx/), 0 console errors, no overflow.

## 2026-10-20 — real-table look (build 5)
- **Asked:** Tim (all games): make each game look "almost identical to how the board or card layout looks like in real life … like you're looking through a camera that is connected to a user's glasses" (full quote in progress.md Standing instructions). Manager brief: shared `_table` kit, fx 1.0.3, research first, phone + laptop layouts, one reviewer round + fix + repeat.
- **Built:** fx.js re-copied (1.0.3); `_table` kit copied (css/table.css, js/game-table.js); Play tab on a dark wood table; board.js: see-through holes, drop slots, ridges, side legs on flared feet, slider bar with pull tab that slides out on New game / Clear; js/seats.js: each player's discs in stacks of 7 at their seat (yours near, opponent across), shrinking per disc with a lift-off animation; landscape phone puts seats beside the board; .gitattributes keeps the shared copies byte-identical.
- **Verified:** tests/seats.test.js (failed with the module missing and on two mutations, passes); npm test 45/45 (one unexplained failure in 7 runs, not reproduced); tools/regress.mjs 12/12 local; two-browsers online on the local build PASS; WebKit shots 393×659, 1280×800, 320, 659×393 landscape: 0 errors, no overflow, no page scroll; Effects speed tap leaves the site's own segments alone.
- **Open:** "Red / Red" friends subtitles and confetti over the buttons (shared fx) left as they were.

## 2026-10-20 — edge pass (build 6)
- **Asked:** Tim (all games): "Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." Also re-copy the `_table` kit (1.0.1).
- **Built:** `_table` kit re-copied (no flip cards in this game); fixes for 10 odd situations (progress.md "Odd situations"): app.js, ui.js, seats.js, style.css; tools/edge.mjs (24 browser checks), tests/edge.test.js (4).
- **Verified:** tools/edge.mjs 10 FAIL on build 5 → 24/24 PASS on build 6 (local); stacks check seen failing with the CSS removed; npm test 49/49; regress.mjs 12/12; two-browsers on local and live PASS.
- **Open:** see progress.md NOT verified (online AFK / host leave not driven).

## 2026-10-21 → 10-27 — visibility pass (build 7)
- **Asked:** Tim (all games): board/cards "too small to easily see what's going on … filling the screen with the board view and fitting the cards and other things in the empty space" (full quote in progress.md Standing instructions). Paused 10-21, resumed 10-27 ("continue working").
- **Built:** laptop Play controls moved to the side column (app.js `placeControls`); landscape-phone grids for Play / Table / Study; chip text 25 → 32 units; portrait-phone move list and puzzle list one sideways-scrolling row; tools/layout.mjs (board share, hole size, chip px, overflow, current move visible, taps per column).
- **Verified:** layout.mjs failed 11 on live build 6, all pass on build 7 in WebKit and Chrome (local); npm test 49/49; regress.mjs and edge.mjs all pass; 45 before / 45 after WebKit shots at 393, 320, 659×393, 1280, 1440 (0 errors, no overflow, no page scroll); one reviewer round, landscape Study widened after it.
- **Open:** see progress.md NOT verified (visibility line).

## 2026-10-27 — My stats + Daily game (build 8)
- **Asked:** improvement wave (common brief): pilot the new shared `_profile` kit (repo game-profile) end to end — "My stats" button, results vs every level, 5–8 achievements, a Daily game if it fits.
- **Built:** kit copies js/profile.js + css/profile.css (1.0.1), js/profile-c4.js (level Elo from strength-data, 8 achievements, 4-disc daily opening, result mapping, one-time history import); app.js avatar button + Daily (New game › Daily, vs Strong, no help, leave = loss, resumes after reload); games with chips/hint/undo counted "with help", unrated; Elo change next to Review; fixed online results never being recorded (P.saved never reset online) and a reload double-count guard.
- **Verified:** tests/profile.test.js 7 (seen failing first); npm test 56/56; layout/edge/regress all pass; button + panel sizes script at 320/393/659×393/1280/1440 in WebKit and Chrome (no overlap, no page scroll, 0 errors); browser runs of chips-on win (unrated) and chips-off win (Elo 1238, "Elo +38"), Daily resume/leave/finish. One reviewer round, 6 findings fixed.
- **Open:** progress.md NOT verified (My stats line); Tim's calls in Decisions.

## 2026-10-27 — improvement pass (build 10)
- **Asked:** Tim: "start building every single improvement you can think of after your competitor analysis" / "I want to make our boardgames the best in every single metric we can." Manager: solver chips on by default made most games unrated; phone My stats button looked like the computer's avatar; re-check kits; add _pwa + _coach; quit after first move = loss; guided games never count; check the ladder and predictability.
- **Built:** chips off by default (+ one-time switch-off of the old saved default), quit = loss with warning, phone My stats button with caption, guided first game + rules sheet (_coach 1.0.0, js/tutorial.js), home-screen/offline (_pwa 1.2.0) with the solver/book kept offline. No AI change (predictability + ladder measured fine).
- **Verified:** tests/saved + profile new tests failed first, npm test 58/58; regress.mjs new checks 13–14 FAIL on live build 8, all 15 PASS local; edge.mjs + layout.mjs pass; pwa-check 2/18 on build 8 → 18/18 WebKit + Chromium; guided game driven at 393×659, 659×393, 1280×800 (every note on screen whole, 0 errors, not counted); shots at 320/393/659×393/1280/1440, no overflow, 0 errors.
- **Open:** online rematch/avatars in rooms (online layer is being rewritten by another builder); kit gap: _pwa sw.js crawl skips .wasm/.bin.
- **Build 11 (same day):** Elo on your plate; layout.mjs seeds the coach offer as seen (it crashed on live); one reviewer round → guided tour moves on when you play on (scratch c4review-fix.mjs: stuck on step 1 for 5 discs before, steps 1→5 after), 1–9 keys, plural. npm 58/58, regress/edge/layout pass, guided drive at 393×659 whole notes, 0 errors.

## 2026-10-28 — wave 3 (build 13)
- **Asked:** Tim: "Just make the games better" (variants, house rules, YouTube links, practical settings, iPhone layout). Manager: two variants the computers can play, a Videos section, reviewer leftovers (Play again, one-column Hint, touch ghost, Board row in New game), practical settings.
- **Built:** Five in a row (9 × 6, pre-filled outer columns) and Power discs (Anvil / Bomb / Wall) with computers (js/variants.js); Rules row in Settings + Board/Rules rows in New game; Five, Power and Videos tabs in the rules sheet; Hint = one column; Play again; touch ghost disc; Settings › Computer speed. Pop 10 skipped (setup phase + scoring cost more for less fun).
- **Verified:** tests/variants.test.js 10/11 failed on build 12, 11/11 after; npm 69/69; regress/edge/layout/pwa-check (18/18) local; ladder in node (progress.md wave-3 row); scratch c4w3/w3.mjs ALL PASS on local and LIVE (4e5d125): power sheet/Wall/Bomb/playout/Play again, Five at 320/393/659×393/1280/1440 with no page scroll and 0 errors, New game sheet, Hint 7 → 1 chips (live before/after), ghost, 4 video links; YouTube links checked by oembed (200 + title).
- **Open:** progress.md NOT verified (wave-3 line); Tim's calls in Decisions.
