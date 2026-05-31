# Jisho — Audit Remediation Plan

Living tracker for implementing the findings in [`code-analysis-report.md`](./code-analysis-report.md).
**Status: ✅ MERGED.** PR #28 (https://github.com/tgkd/jisho/pull/28) merged to `master` as `5ea0d51` (merge of `d071bb3` audit + `94e9697` passage fix/Expo bumps). Now on `master`.

Status legend: ✅ done · ⏸️ deferred · ⬜ not started
Verification: **tested** (node test / query / tool run) · **type/lint** (tsc + lint only, not rendered)

## Verification snapshot (current)
- `yarn test:db` — **115 passed, 11/11 suites** (was 0; suite couldn't compile before)
- `yarn typecheck` — **source fully clean** (dead-script errors gone after deletion)
- `yarn lint` — 12 problems (down from 20 baseline). Remaining 10 errors = deferred #14 + render-phase `setState`-in-effect cluster (need app to verify safely); 2 warnings out of scope.
- `yarn test:ci` (jest-expo) — preset throw resolved; still the wrong runner for node-DB tests (5 suites fail under jsdom). Canonical path is `test:db`.

## Batch 1 — High severity + top fixes (DONE)
| # | Finding | Status | Verified |
|---|---------|--------|----------|
| H1 | Homograph search: removed `PARTITION BY (word,reading)` dedup | ✅ | tested (EXPLAIN + new id-uniqueness/homograph tests; 573 entries were hidden) |
| H2 | `getWordExamples` full scan | 🟡 partial | tested — removed redundant `LIKE` block only; **root-cause full-scan deferred** (needs FTS-on-`japanese_text` or import-time `word_id` backfill + DB rebuild) |
| H3 | `kanji/[id]` refetch loop → key on `params.id` + active guard | ✅ | type/lint (lint error cleared) |
| H4 | IconSymbol blank Android/web → mapped all SF names, `satisfies` typing, fallback glyph | ✅ | type/lint (not rendered) |
| H5 | `ColorSchemeName` cluster → narrowed `useColorScheme()` centrally | ✅ | tested (tsc: ~21 errors cleared) |
| H6 | Node test suite restored (`tsconfig.test.json` + ts-jest wiring + JSONStream decl scope) | ✅ | tested (0→115) |
| T5 | QueryClient `retry: false` | ✅ | type/lint |

## Batch 2 — Medium severity (DONE except #14)
| # | Finding | Status | Verified |
|---|---------|--------|----------|
| 7 | Import idempotency (`resetTables` in words/kanji importers) | ✅ | tested (delete triggers cascade to FTS; `optimizeForBulkOperations` doesn't touch triggers) |
| 8 | `initializeSchema` rethrows on trigger-creation failure | ✅ | type/lint + import tests green |
| 9 | `findKanji` → `\p{Unified_Ideograph}` (Ext-B incl., 々 excl.) | ✅ | tested (spot-check + regression tests) |
| 10 | `getJpTokens` preserves 々 + halfwidth katakana | ✅ | tested (spot-check + regression tests) |
| 11 | QueryClient retry | ✅ | (done in Batch 1 / T5) |
| 12 | `useStreamedChat` remote-error branch | ✅ | type/lint (not rendered) |
| 13 | `SubscriptionProvider` AI-provider override gated on activation | ✅ | type/lint (not rendered) |
| 14 | `markdownRules` render-phase mutation | ⏸️ deferred | **needs app running** — rendered `cleanText` ≠ `japaneseParagraphs`; a blind rewrite could play the wrong paragraph's audio. Lint 157/173 remain. |
| 15 | `sessionRef` write moved render→effect | ✅ | type/lint (lint 335 cleared) |
| 16 | `subscription-info` ColorScheme | ✅ | (done in Batch 1 / H5 central narrowing) |
| 17 | practice screen colors via `useThemeColor` (dark mode) | ✅ | type/lint (not rendered) |
| 18 | `ChatMessage` TDZ → deleted (zero importers, dead code) | ✅ | tested (repo-wide grep) |
| 19 | `ListItem` `React.memo` + custom comparator | ✅ | type/lint (comparator keys on item.id; not rendered) |
| 20 | jest-expo preset throw (`@react-native/jest-preset@0.85.3`) | ✅ | tested (config loads) |
| 21 | `typecheck` script added | ✅ | tested (runs) |

## Deferred
- **H2 getWordExamples root cause** — full scan over 147k example rows. Needs an import-time fix (FTS on `japanese_text` or `word_id` backfill) + 288 MB seed rebuild.
- **#14 markdownRules mutation** — needs the app running to verify paragraph→audio alignment.

## Batch 3 — Low severity (27 of 64 done)
Done this batch (verified by tsc/lint/tests):
- Dead code deleted: `ChatMessage` (#68), `HighlightText` (#69/#73), `getAiExplanation` (#54), `generate-example-readings.ts` + `db:generate-readings` (#41/#82), `reset-project` script (#83)
- DB safety: history DELETE+INSERT now transactional (#34), all practice-sessions calls wrapped in `retryDatabaseOperation` (#35), 2 missing history indexes added to `ensureUserDataTables` (#23), abandoned-session DELETE routed through `deleteSession` (#66)
- Logic bugs: `formatJp` missing `break` (#49), FTS `^2` dead operand removed (#28), `Object.freeze` on Map removed (#31), `useDebouncedCallback` flush no longer clobbered (#81), `getAiSound` 32-bit hash → cyrb53 (#55)
- Types/perf: `created_at` typed `string` (#33), `SETTINGS_KEYS as const` (#56-partial), `tinySegmenter` regexes hoisted (#51), FlashList `getItemType` (#61), `UnifiedAIProvider` context memoized (#57), `ThemedText` useMemo deps (#77), `Pill` unused import (#80)
- Routing/docs: root `/` → `<Redirect href="/word" />` (#62), CLAUDE.md + core.ts v20→v25 (#25), CLAUDE.md search-pipeline description (#32)
- Already resolved earlier: #30 (H2), #75/#76 (H5 ColorScheme narrowing)

Not done (categorized):
- **Need the app running to verify** (render-phase, would redbox/regress if wrong): #59, #63, #70, #71, #74 (setState-in-effect / scroll throttle), #50, #72 (furigana/rendering), #58 (generateSpeech rethrow — caller redbox risk)
- **Your decision**: #52 (.env `EXPO_PUBLIC_*` creds bundled — security), #24 (enable FK enforcement or drop clauses), #84 (`expo install --check` upgrades — touches deps), #27 (delete tracked leftover DB files), #65 (deep-link premium gating), #42/#37 (design tradeoffs)
- **Build tooling, can't fully exercise (no data files)**: #43, #44, #45, #46, #47, #48
- **Real fix needs DB rebuild**: #36 (searchKanji FTS), #38 (getAllSessions type), #29 (SELECT columns — minor)
- **Minor / low value**: #22 (runtime PRAGMAs), #26, #40 (retry jitter), #53 (dead remote branch), #67, #78, #79 (theming refactor)

## Review (final, PR #28)
Holistic review of the full committed diff (40 files) — independent pass found **no correctness bug**.
- **Statically verified:** `tsc` source 0 errors · `test:db` 115/115 · `lint` 12 (all deferred render-phase / out-of-scope; no regressions). DB + parse logic is genuinely *tested*.
- **Static-only (compiles + lints, NOT executed):** ~half the diff is UI/runtime — first real run is on-device. Highest-risk to smoke-test:
  1. `/` → `/word` redirect — clean landing, no flash/loop?
  2. IconSymbol glyphs on Android/web (the rendered output was the point of the fix)
  3. a practice screen in dark mode (color rerouting)
  4. force a remote chat error → new error bubble appears (not an empty one)
- **Note:** `ListItem` search-row memo benefit assumes `meaningsMap.get(id)` is a stable reference (flows from the cached search result) — observable in the same smoke-run.
- **Conclusion:** static correctness confirmed; runtime UI unverified. Merge is not blocked on the tested bar; closing the runtime gap needs one app smoke-run.

### Smoke-run (iOS sim, iPhone 16, fresh `expo run:ios` RN 0.85 build)
- ✅ **#1 redirect** — `/` lands on Words/search screen, no flash/loop/redbox. PASS.
- ✅ **ColorScheme narrowing** — search screen renders correctly in **light + dark**; `useColorScheme()` resolves safely. PASS (highest-blast-radius change, runtime-confirmed).
- ⛔ **#2 IconSymbol** — BLOCKED: Android/web-only; iOS uses native SF Symbols. Needs Android build.
- ⛔ **#3 practice dark-mode / #4 chat error** — BLOCKED: premium-gated; RevenueCat can't init in sim (no sandbox) → non-premium → practice tab hidden, remote chat gated.
- Note: stale pre-SDK-56 dev build had to be rebuilt (MessageQueue/Hermes mismatch). RevenueCat sim-init failure is an env limitation, not a PR regression.
- Manual run on device (premium): search homographs ✅, kanji detail ✅, list recycling ✅, history dedup ✅, audio (incl. remote /sound) ✅, practice dark mode ✅.

### Bug found + fixed during manual testing (committed 94e9697)
- **Passage generation never sent /reading** ("No content available", no Worker request). Root cause (confirmed via debug logs): `generatePassage()` ran inline right after `setSession`, before `useStreamedPassage` re-rendered with the real `level` → `getAiReadingPassageStreaming` threw "No level provided". Pre-existing stale-closure (exposed by React 19 batching), not from the audit diff.
- **Fix:** trigger generation from a `session`-keyed effect so the hook has the committed level. Verified working on device (generates + persists).
- A declarative `useQuery`/`enabled` rewrite was attempted to remove effects but **reverted** — moving persistence into the `streamFn` broke stream-end save (`streamedQuery` doesn't drive the generator past its final value). Kept the imperative hook + split-effect fix.
- Also bumped Expo SDK 56 patch versions (audit #84) + synced native lockfiles.

PR #28 (d071bb3 audit + 94e9697 passage fix/Expo bumps) merged to master as 5ea0d51.

## Open decisions
- ✅ PR #28 merged to `master` (`5ea0d51`). Local branch `fix/audit-high-severity` can be deleted.
- Remaining low-tier items (see Batch 3 "Not done") — decide which to pursue: the maintainer **decisions** (#52 security, #24 FK, #84 upgrades, #27 file cleanup, #65), the **render-gated** cluster (best done with the app running), or the **build-tooling** group.
- `getWordExamples` (#H2) + `searchKanji`/`getAllSessions` (#36/#38) root-cause perf — gated on a seed-DB rebuild.
