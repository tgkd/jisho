export const meta = {
  name: 'code-quality-audit',
  description: 'Audit the Jisho RN/Expo codebase for quality, bugs, and DB issues; verify each finding (DB findings against the live seed DB) and synthesize a prioritized improvement report',
  whenToUse: 'When you want a thorough, verified code-quality + bug + database review of the whole codebase, producing a prioritized list of what to fix/improve.',
  phases: [
    { title: 'Review', detail: 'one agent per code area; DB areas weighted heavier' },
    { title: 'Verify', detail: 'adversarially refute each finding; DB findings re-checked with real EXPLAIN QUERY PLAN' },
    { title: 'Synthesize', detail: 'dedup, prioritize, write the improvement report' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Ground truth gathered inline before this workflow ran. Fed to agents so they
// explain real tool output and do NOT hallucinate issues the tools disprove.
// ─────────────────────────────────────────────────────────────────────────────

const GT_DB = [
  'LIVE seed DB: assets/db/jisho-seed.db (288 MB, queryable now via the sqlite3 CLI through Bash).',
  'Verified facts:',
  '- Row counts: words=203,627  meanings=235,897  examples=147,865  kanji=13,108  words_fts=203,627',
  '- PRAGMA journal_mode = wal ; PRAGMA user_version = 25',
  '  (NOTE: CLAUDE.md and code comments say "seed DB is v20" — that is STALE; treat the v20 claim as a doc bug.)',
  '- words_fts is an FTS5 EXTERNAL-CONTENT table: fts5(word, reading, reading_hiragana, kanji, search_ngrams, content=\'words\', content_rowid=\'id\')',
  '- A SECOND FTS table EXISTS and is undocumented in CLAUDE.md: meanings_fts. Triggers present: words_ai/words_ad/words_au, meanings_ai/meanings_ad/meanings_au',
  '- words columns: id, word, reading, reading_hiragana, kanji, position, search_ngrams, priority_rank DEFAULT 999',
  '- Indexes: idx_words_word, idx_words_reading, idx_words_reading_hiragana, idx_words_kanji, idx_words_priority_rank,',
  '  idx_meanings_word_id, idx_meanings_meaning, idx_furigana_text, idx_furigana_reading, idx_furigana_text_reading,',
  '  idx_kanji_character, idx_examples_japanese, idx_examples_english, idx_examples_word_id, idx_history_*, idx_practice_sessions_*',
  '- Repo root has leftover EMPTY jisho.db (0 bytes) plus database_new.db-shm and database_new.db-wal with NO main database_new.db file.',
  '',
  'HARD RULE: any claim about index usage, query plans, whether a query is sargable, or whether triggers/FTS fire MUST be backed by a real command you ran, e.g.:',
  '  sqlite3 assets/db/jisho-seed.db "EXPLAIN QUERY PLAN <the exact query>;"',
  'Quote the actual output. "This misses an index" is a guess from reading SQL; it is a fact only after EXPLAIN QUERY PLAN. Do not guess.',
].join('\n')

const GT_TEST = [
  'TEST/BUILD GROUND TRUTH (verified by running the tools):',
  '- `yarn test:ci` FAILS TO RUN AT ALL. jest-expo error: "The React Native Jest preset that jest-expo relies on has moved to a separate package. Install @react-native/jest-preset". The entire RN Jest suite is currently broken — most likely since the SDK 55->56 upgrade (commit 8137c9e). The package.json jest config is just { "preset": "jest-expo" }.',
  '- Node-config tests exist (jest.config.node.js, `yarn test:db`) and may still run — verify whether they do.',
  '- `tsc --noEmit` (no typecheck script exists in package.json) reports 513 errors INSIDE __tests__/test-utils: "Cannot find name describe/expect/test/beforeAll", "Cannot use namespace jest as a value". @types/jest is a devDep but is not wired into tsconfig `types`/`include`, so tests do not typecheck.',
].join('\n')

const GT_TSC_SOURCE = [
  'TS SOURCE ERRORS (tsc --noEmit, excluding test files) — these are REAL, confirm and explain them, then look for what tsc cannot catch:',
  '- hooks/useThemeColor.ts (lines 14, 19): TS7053 — indexing Colors with ColorSchemeName; the "unspecified"/null case of ColorSchemeName is unhandled.',
  '- app/settings/subscription-info.tsx: 18 instances of the same TS7053 ColorSchemeName-indexing error (lines 45,54,68,77,91,100,120,133,146,160,174,180,199,203,215,230,235).',
  '- components/ui/Card.tsx (lines 21, 22): same TS7053 ColorSchemeName indexing.',
  '- components/ui/IconSymbol.tsx (lines 23, 47): TS2344/TS2538 SFSymbols name type misuse, and TS2322 StyleProp<ViewStyle> passed where StyleProp<TextStyle> expected.',
  '- scripts/generate-example-readings.ts (lines 2, 3): TS2307 Cannot find module \'kuroshiro\' / \'kuroshiro-analyzer-kuromoji\' — deps absent; script is broken/dead.',
].join('\n')

const GT_LINT = [
  'ESLint errors/warnings (expo lint) — REAL, confirm and explain, then look for logic bugs the linter cannot see:',
  '- react-hooks/set-state-in-effect (ERROR — calling setState synchronously in an effect, cascading renders):',
  '    app/practice/[sessionId].tsx:81 ; app/practice/index.tsx:48 ; app/word/[id].tsx:93, 120, 305 ; app/word/kanji/[id].tsx:36, 125 ; components/ChatView.tsx:72',
  '- app/practice/[sessionId].tsx: 157 "Cannot access variable before it is declared"; 173 "Cannot reassign variable after render completes"; 335 "Cannot access refs during render"; 91 "Existing memoization could not be preserved".',
  '- components/ChatMessage.tsx:43 "Cannot access variable before it is declared"; 36 isLoadingFurigana assigned but never used.',
  '- react-hooks/exhaustive-deps warnings: app/practice/index.tsx:49 (loadSessions), app/word/[id].tsx:94 (initEntry), app/word/kanji/[id].tsx:37 (loadKanjiDetails), components/ChatMessage.tsx:45 (loadFurigana), components/ThemedText.tsx:50 (darkColor/lightColor).',
  '- components/ui/Pill.tsx:1 \'Text\' imported but never used.',
].join('\n')

// ─────────────────────────────────────────────────────────────────────────────
// Review units. DB gets 4 focused units (the user emphasized "db work").
// ─────────────────────────────────────────────────────────────────────────────

const UNITS = [
  {
    key: 'db-core-schema',
    isDb: true,
    files: ['services/database/core.ts', 'schema.sql', 'constants/Database.ts'],
    focus: 'DB init & migration flow (ensureUserDataTables, removed v1-v20 migrations, seed-asset copy logic), schema design, column types, index coverage vs the queries that exist, WAL/pragma setup, FTS5 external-content + trigger correctness, the v20-vs-v25 user_version drift, and the leftover empty DB files at repo root.',
    ground: GT_DB,
  },
  {
    key: 'db-search',
    isDb: true,
    files: ['services/database/search.ts', 'services/database/dictionary.ts'],
    focus: 'The search pipeline: query normalization, FTS5 MATCH query construction (quoting/escaping of user input into FTS — injection AND FTS-syntax-error risk), the tiered LIKE fallback (exact/prefix/contains and the leading-% non-sargable risk), n-gram column usage, priority_rank ordering, the 30s cache, and SQLITE_BUSY/retry handling. Run EXPLAIN QUERY PLAN on the actual generated queries against the seed DB to prove which path uses indexes and which does a full scan.',
    ground: GT_DB,
  },
  {
    key: 'db-queries',
    isDb: true,
    files: ['services/database/utils.ts', 'services/database/history.ts', 'services/database/kanji.ts', 'services/database/furigana.ts', 'services/database/practice-sessions.ts', 'services/database/types.ts', 'services/database/index.ts'],
    focus: 'retryDatabaseOperation correctness (does it actually catch SQLITE_BUSY, backoff, infinite-loop/retry-storm risk?), parameterization vs string interpolation in every query, transaction boundaries, N+1 query patterns, history dedup/growth, type mismatches between TS types and actual column types. Run sample queries against the seed DB where it clarifies behavior.',
    ground: GT_DB,
  },
  {
    key: 'db-scripts',
    isDb: true,
    files: ['scripts/migrate.ts', 'scripts/build-database.ts', 'scripts/fetch-data.ts', 'scripts/generate-example-readings.ts', 'scripts/import/words-importer.ts', 'scripts/import/kanji-importer.ts', 'scripts/import/examples-importer.ts', 'scripts/import/furigana-importer.ts', 'scripts/import/utils/database.ts', 'scripts/import/utils/parsers.ts', 'scripts/import/utils/ngram.ts', 'scripts/import/utils/progress.ts'],
    focus: 'Import-pipeline integrity: batch insert sizing & transaction wrapping (perf + atomicity), error handling on malformed upstream rows, encoding (iconv) correctness, idempotency/reset safety, FTS rebuild after bulk insert, and the broken generate-example-readings.ts (missing kuroshiro deps). Verify whether build/import would actually succeed.',
    ground: GT_DB + '\n\n' + GT_TSC_SOURCE,
  },
  {
    key: 'svc-parse',
    isDb: false,
    files: ['services/parse.ts', 'services/tsegmenter.ts'],
    focus: 'Japanese text processing correctness: romaji/hiragana/katakana conversion via wanakana, tiny-segmenter usage, furigana alignment, kanji/kana boundary handling, edge cases (mixed scripts, punctuation, empty input, long strings), and performance of hot paths called during search/render.',
    ground: '',
  },
  {
    key: 'svc-ai',
    isDb: false,
    files: ['services/request.ts', 'services/ai-streams.ts', 'services/storage.ts', 'services/queryClient.ts'],
    focus: 'Streaming response handling (onChunk/onComplete/onError, partial-chunk parsing, abort/cancel, leaks), API error handling & retries, secret/endpoint handling, MMKV typed-key correctness in storage.ts, and React Query client config (staleness/retry/gc).',
    ground: '',
  },
  {
    key: 'providers',
    isDb: false,
    files: ['providers/UnifiedAIProvider.tsx', 'providers/AppleAIProvider.tsx', 'providers/SpeechProvider.tsx', 'providers/SubscriptionProvider.tsx'],
    focus: 'Context provider patterns: stable context values (memoization to avoid re-render storms), premium gating & SubscriptionRequiredError flow, speech pause/resume lifecycle, listener/subscription cleanup on unmount, and the local/remote AI selection logic. Also list any other files in providers/ you find.',
    ground: '',
  },
  {
    key: 'app-word',
    isDb: false,
    files: ['app/word/[id].tsx', 'app/word/index.tsx', 'app/word/kanji/[id].tsx', 'app/word/chat.tsx', 'app/word/kanji-list.tsx', 'app/word/_layout.tsx', 'app/index.tsx'],
    focus: 'Screen logic & data fetching. The set-state-in-effect lint errors here are real — explain the actual render/effect bug each represents (cascading renders, stale data on param change, missing cleanup, race between debounced search and navigation). Check FlashList key/recycling correctness and loading/error states.',
    ground: GT_LINT,
  },
  {
    key: 'app-practice-settings',
    isDb: false,
    files: ['app/practice/[sessionId].tsx', 'app/practice/index.tsx', 'app/practice/new.tsx', 'app/practice/_layout.tsx', 'app/settings/index.tsx', 'app/settings/subscription-info.tsx', 'app/settings/about.tsx', 'app/settings/_layout.tsx', 'app/paywall.tsx', 'app/_layout.tsx', 'app/+not-found.tsx'],
    focus: 'The practice/[sessionId].tsx lint errors are the highest-risk in the app (refs accessed during render, variable reassigned after render completes, variable used before declared) — explain the concrete runtime bug each implies under React 19/Fabric. Also the 18 ColorSchemeName TS errors in subscription-info.tsx, the provider wrapping order in _layout.tsx, and premium-gating of the practice tab.',
    ground: GT_LINT + '\n\n' + GT_TSC_SOURCE,
  },
  {
    key: 'components-chat',
    isDb: false,
    files: ['components/ChatView.tsx', 'components/ChatMessage.tsx', 'components/ChatFooter.tsx', 'components/ListItem.tsx', 'components/FuriganaText.tsx', 'components/HighlightText.tsx'],
    focus: 'The ChatView.tsx:72 and ChatMessage.tsx:43 lint errors are real — explain the bug. Look at ListItem.tsx (572 lines, likely a perf/complexity hotspot rendered in lists — memoization, prop stability), FuriganaText alignment correctness, and HighlightText substring-match correctness with Japanese input.',
    ground: GT_LINT,
  },
  {
    key: 'components-ui',
    isDb: false,
    files: ['components/ThemedText.tsx', 'components/Collapsible.tsx', 'components/KanjiList.tsx', 'components/HapticTab.tsx', 'components/ui/Card.tsx', 'components/ui/IconSymbol.tsx', 'components/ui/IconSymbol.ios.tsx', 'components/ui/Pill.tsx', 'components/ui/SegmentedControl.tsx'],
    focus: 'Card.tsx and IconSymbol.tsx TS errors are real (explain the type unsafety and runtime risk). ThemedText useMemo missing-deps and Pill unused import. Check theming approach: per project rules theming should be via CSS/variables not theme props — flag prop-drilled theme/color values and the unsafe ColorSchemeName indexing pattern repeated across components.',
    ground: GT_TSC_SOURCE + '\n\n' + GT_LINT,
  },
  {
    key: 'hooks',
    isDb: false,
    files: ['hooks/useThemeColor.ts', 'hooks/useColorScheme.ts', 'hooks/useColorScheme.web.ts', 'hooks/useDebouncedCallback.ts', 'hooks/useMdStyles.ts', 'hooks/useSearchHistory.ts', 'hooks/useStreamedChat.ts', 'hooks/useStreamedPassage.ts'],
    focus: 'useThemeColor.ts TS errors are real (ColorSchemeName indexing). Check useDebouncedCallback for stale-closure / cleanup-on-unmount bugs, useStreamedChat/useStreamedPassage for missing abort on unmount or dependency-change (leaked streams), and useSearchHistory for race conditions.',
    ground: GT_TSC_SOURCE,
  },
  {
    key: 'config-build',
    isDb: false,
    files: ['package.json', 'tsconfig.json', 'jest.config.node.js', 'eslint.config.js', 'babel.config.js', 'app.json'],
    focus: 'The broken Jest suite (jest-expo preset moved -> needs @react-native/jest-preset) is a HIGH-priority finding: the RN test suite cannot run, so CI/regression safety is gone. Also: no `typecheck` script despite tsc finding real errors; @types/jest not wired into tsconfig (513 phantom test errors); dependency-version sanity after SDK56; and any scripts referencing deleted/missing modules. Recommend concrete fixes (exact package + config change).',
    ground: GT_TEST + '\n\n' + GT_TSC_SOURCE,
  },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', description: 'one-line summary of the issue' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          category: { type: 'string', enum: ['bug', 'db', 'performance', 'security', 'quality', 'maintainability', 'testing', 'types'] },
          file: { type: 'string' },
          location: { type: 'string', description: 'line number(s) or function name' },
          description: { type: 'string', description: 'what is wrong and the concrete consequence' },
          evidence: { type: 'string', description: 'what you observed in the code; for DB findings, the exact query/command you ran and its output' },
          recommendation: { type: 'string', description: 'specific fix' },
        },
        required: ['title', 'severity', 'category', 'file', 'description', 'recommendation'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    isReal: { type: 'boolean', description: 'true only if you confirmed the issue is real after independent checking' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    adjustedSeverity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'] },
    verification: { type: 'string', description: 'HOW you checked: code re-read with line refs, tsc/lint match, or the exact sqlite3 command you ran + its output' },
    notes: { type: 'string', description: 'correction to the finding if the original was imprecise; reason for rejection if not real' },
  },
  required: ['isReal', 'confidence', 'adjustedSeverity', 'verification'],
}

function reviewPrompt(u) {
  return [
    'You are reviewing part of the Jisho app — a cross-platform Japanese dictionary built with Expo / React Native 0.85 / React 19 / expo-router / expo-sqlite (FTS5) / @tanstack/react-query / MMKV. Working dir is the repo root.',
    '',
    'Review THESE files for code quality, bugs, and (where relevant) database issues:',
    u.files.map((f) => '  - ' + f).join('\n'),
    '',
    'Primary lens for this unit: ' + u.focus,
    '',
    u.ground ? ('GROUND TRUTH (already verified by running real tooling — explain these, do NOT contradict them, then find what the tools cannot catch):\n' + u.ground + '\n') : '',
    'Method:',
    '1. Read every file listed. Use Grep to trace how symbols are used across the codebase before judging.',
    u.isDb
      ? '2. For ANY claim about query plans / index usage / sargability / FTS / triggers, run the real command against assets/db/jisho-seed.db via Bash (sqlite3) and quote the output in `evidence`. No guessing.'
      : '2. Confirm each issue by reading the actual code; cite file:line in `evidence`. Cross-check against the ground-truth tool output above.',
    '3. Report genuine, actionable issues. Quality over quantity — do NOT pad with style nitpicks or speculative concerns. Cap at ~12 findings; keep the most important.',
    '4. Severity: critical = data loss / crash / security / silently wrong results; high = real bug or broken tooling; medium = correctness-risky or notable perf/maintainability; low = minor.',
    '',
    'Return ONLY the structured findings object. Each finding must name a specific file and a concrete fix.',
  ].join('\n')
}

function verifyPrompt(f, unitKey) {
  const isDb = f.category === 'db' || unitKey.startsWith('db-')
  return [
    'You are an adversarial verifier. A prior reviewer reported the finding below for the Jisho RN/Expo codebase (repo root is the working dir). Your job is to REFUTE it. Assume it is wrong until you prove otherwise. Default to isReal=false when you cannot independently confirm it.',
    '',
    'FINDING:',
    '  title: ' + f.title,
    '  severity: ' + f.severity,
    '  category: ' + f.category,
    '  file: ' + f.file,
    '  location: ' + (f.location || '(unspecified)'),
    '  description: ' + f.description,
    '  evidence(claimed): ' + (f.evidence || '(none)'),
    '  recommendation: ' + f.recommendation,
    '',
    'How to verify:',
    '- Open ' + f.file + ' and read the actual code at the cited location. If the code does not match the claim, it is not real.',
    isDb
      ? '- This is a DB claim: you MUST run the relevant query yourself against assets/db/jisho-seed.db via Bash, e.g. `sqlite3 assets/db/jisho-seed.db "EXPLAIN QUERY PLAN <query>;"`. Put the exact command + output in `verification`. A DB finding with no query you actually ran should be isReal=false / low confidence.'
      : '- Cross-check against tsc/lint ground truth where applicable, and confirm the logic genuinely misbehaves (not just looks odd). Trace callers with Grep if needed.',
    '- If the issue is real but the description/severity is off, set isReal=true and correct it in `notes` + adjustedSeverity.',
    '',
    'Return ONLY the structured verdict.',
  ].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Run: pipeline each unit through review -> per-finding adversarial verify.
// Pipeline (no barrier) so a unit's findings start verifying the moment its
// review lands, while other units are still being reviewed.
// ─────────────────────────────────────────────────────────────────────────────

log('Auditing ' + UNITS.length + ' code areas (' + UNITS.filter((u) => u.isDb).length + ' DB-focused). Each finding is adversarially verified.')

const reviewed = await pipeline(
  UNITS,
  (u) => agent(reviewPrompt(u), { label: 'review:' + u.key, phase: 'Review', schema: FINDINGS_SCHEMA })
            .then((r) => ({ unit: u, findings: (r && r.findings) || [] })),
  (r) => {
    const fs = r.findings
    if (!fs.length) return { unit: r.unit, verified: [] }
    return parallel(
      fs.map((f) => () =>
        agent(verifyPrompt(f, r.unit.key), { label: 'verify:' + r.unit.key + ':' + (f.file || '').split('/').pop(), phase: 'Verify', schema: VERDICT_SCHEMA })
          .then((v) => ({ ...f, unitKey: r.unit.key, verdict: v }))
      )
    ).then((verified) => ({ unit: r.unit, verified: verified.filter(Boolean) }))
  }
)

const allVerified = reviewed.filter(Boolean).flatMap((r) => r.verified)
const confirmed = allVerified.filter((f) => f.verdict && f.verdict.isReal && f.verdict.adjustedSeverity !== 'none')
const rejected = allVerified.filter((f) => !(f.verdict && f.verdict.isReal && f.verdict.adjustedSeverity !== 'none'))

log('Verified: ' + confirmed.length + ' confirmed, ' + rejected.length + ' rejected as false-positive/duplicate-noise.')

// ─────────────────────────────────────────────────────────────────────────────
// Synthesize the confirmed findings into one prioritized report.
// ─────────────────────────────────────────────────────────────────────────────

phase('Synthesize')

const forSynth = confirmed.map((f) => ({
  title: f.title,
  severity: (f.verdict && f.verdict.adjustedSeverity) || f.severity,
  category: f.category,
  file: f.file,
  location: f.location || '',
  description: f.description,
  recommendation: f.recommendation,
  verification: (f.verdict && f.verdict.verification) || '',
  notes: (f.verdict && f.verdict.notes) || '',
}))

const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    report_markdown: { type: 'string', description: 'the full prioritized improvement report in GitHub-flavored markdown' },
    critical_count: { type: 'number' },
    high_count: { type: 'number' },
    top_fixes: { type: 'array', items: { type: 'string' }, description: 'the 5 highest-leverage fixes, one line each' },
  },
  required: ['report_markdown', 'critical_count', 'high_count', 'top_fixes'],
}

const synth = await agent(
  [
    'You are the lead engineer writing the final code-quality / bug / database audit report for the Jisho RN/Expo Japanese-dictionary app.',
    'Below are ' + forSynth.length + ' findings that were each INDEPENDENTLY VERIFIED by an adversarial checker (DB findings re-checked with real EXPLAIN QUERY PLAN). Treat them as confirmed.',
    '',
    'FINDINGS (JSON):',
    JSON.stringify(forSynth, null, 2),
    '',
    'Write a prioritized improvement report as GitHub-flavored markdown. Requirements:',
    '- Start with a short Executive Summary (3-6 sentences): overall health, and the biggest themes (e.g. broken test suite, render-phase React violations, ColorSchemeName type unsafety, DB query-plan issues).',
    '- A "Top fixes (do these first)" ordered list.',
    '- Group findings into sections: 1) Critical / Bugs, 2) Database, 3) React/UI correctness, 4) Tooling & Build, 5) Quality & Maintainability. Drop empty sections.',
    '- DEDUPLICATE: the same root cause repeated across files (e.g. ColorSchemeName indexing, setState-in-effect) becomes ONE entry that lists all affected files.',
    '- Each entry: bold title, Severity, affected file(s):line, the concrete consequence, and the recommended fix. Keep entries tight.',
    '- End with a short "Suggested order of work" paragraph.',
    'Be precise and honest; do not inflate. Return the markdown in report_markdown plus the counts and top_fixes.',
  ].join('\n'),
  { label: 'synthesize-report', phase: 'Synthesize', schema: SYNTH_SCHEMA }
)

return {
  counts: { confirmed: confirmed.length, rejected: rejected.length, critical: synth.critical_count, high: synth.high_count },
  top_fixes: synth.top_fixes,
  report_markdown: synth.report_markdown,
  confirmed_findings: forSynth,
}
