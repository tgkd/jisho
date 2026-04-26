# Migration Analysis: `@react-native-ai/apple` → `react-native-executorch`

**Context**: Jisho (Japanese dictionary app, Expo 55 / RN 0.83 / New Architecture) currently uses `@react-native-ai/apple` (0.12.0) from the `callstackincubator/ai` monorepo for on-device Apple Intelligence. Goal under evaluation: migrate to `software-mansion/react-native-executorch` to run Llama/Gemma locally.

**TL;DR (opinion up front)**: A full migration is probably the wrong move. The most honest framing is that you are choosing between three things: (1) keep Apple-only, (2) add a second local backend alongside Apple, (3) replace Apple entirely. Option 2 is almost always the right answer, and `callstackincubator/ai` already supports it natively via `@react-native-ai/llama` or `@react-native-ai/mlc` — you do not need to leave the library at all. Also: **Gemma is not on ExecuTorch's pre-built model list**, **Qwen is a significantly better Japanese LLM than Llama 3.2 at every size tier**, and **ExecuTorch's pre-built TTS (Kokoro) is English-only — no Japanese voices, no Japanese phonemizer** — so for a Japanese dictionary, ExecuTorch's TTS story is actively worse than what you have today with Apple's Kyoko voice. TTS is a reason to **stay**, not to migrate.

---

## 1. What you have today

- **Library**: `@react-native-ai/apple@0.12.0`, part of `callstackincubator/ai` (MIT, ~1.3k★, active).
- **Backend**: Apple Foundation Models via Vercel AI SDK v6 (`ai@6.0.146`).
- **Usage surface** (`providers/AppleAIProvider.tsx`):
  - `generateObject({ model: apple(), schema: aiExampleSchemaArray, prompt })` — structured JSON output using a Zod schema. Used for the 5-example generator.
  - `streamText({ model: apple(), messages, abortSignal, maxOutputTokens, temperature })` — streaming chat + explanation.
  - `experimental_generateSpeech({ model: apple.speechModel(), text, voice, language })` — base64 audio via `AVSpeechSynthesizer`.
  - `AppleSpeech.getVoices()` — voice enumeration, picks Kyoko for ja-JP.
  - `apple.isAvailable()` — gates the whole provider.
- **Runtime cost**: 0 MB download. Models live in iOS. Requires iOS 26+ for text generation (iOS 17+ for embeddings, iOS 13+ for speech).

---

## 2. What `callstackincubator/ai` actually is (worth re-reading before migrating away)

It is not an "Apple-only" wrapper. It's a multi-provider monorepo:

| Package | Backend | Platforms | Models |
|---|---|---|---|
| `@react-native-ai/apple` | Apple Foundation Models | iOS 26+ | Built-in, 0 download |
| `@react-native-ai/llama` | `llama.rn` (llama.cpp) | iOS + Android | GGUF from HuggingFace (Llama 3.2, Qwen 2.5, SmolLM3, etc.) |
| `@react-native-ai/mlc` | MLC LLM | iOS + Android | Llama-3.2-3B, Phi-3-mini, Mistral-7B, Qwen2.5-1.5B |
| `@react-native-ai/dev-tools` | Rozenite / OpenTelemetry | — | profiling |

All providers plug into the same Vercel AI SDK surface (`streamText`, `generateObject`, `embed`, `experimental_generateSpeech`). **This is the crucial fact**: if the goal is "better local LLMs than Apple Intelligence," you can add `@react-native-ai/llama` and keep the exact code you already wrote — just swap `model: apple()` for a `llama()` factory in a settings-switched code path.

---

## 3. What `react-native-executorch` actually is

Software Mansion's declarative wrapper over **Meta's ExecuTorch** (PyTorch's on-device runtime, the same thing powering the "Private Mind" app on the App Store).

**Current state**:
- v0.8.3 (April 2026), MIT, ~1.4k★, 44 releases, active.
- Min versions: iOS 17.0, Android 13, **New Architecture required** (you have this).
- API is hook-based: `useLLM({ model: QWEN3_0_6B_QUANTIZED })` → `{ response, token, generate, sendMessage, interrupt, isReady, isGenerating, downloadProgress }`.
- Streaming works via `tokenCallback` → accumulating `response` state (imperative, React-state-driven; not AsyncIterable).
- Tool use: `generate(messages, tools?: LLMTool[])` + `configure({ toolsConfig })`. So function-calling is a first-class feature.
- **No `generateObject` / structured-output equivalent**. You'd have to reimplement via prompt-engineering + JSON parsing + retries. This is a real regression from your current Zod-schema flow.
- Covers far more than LLMs: OCR, Whisper STT, text embeddings, VAD, TTS, image classification, segmentation, VLMs.

**Pre-built LLM catalog** (on their HuggingFace org, constants in `src/constants/modelUrls.ts`):

| Family | Sizes | Quantizations |
|---|---|---|
| Llama 3.2 | 1B, 3B | bf16 / QLoRA / SpinQuant |
| Qwen 3 | 0.6B, 1.7B, 4B | bf16 / 8da4w (int4 weight + int8 activation) |
| Qwen 2.5 | 0.5B, 1.5B, 3B | bf16 / quantized |
| Phi-4-Mini | — | — |
| SmolLM-2 | — | — |
| Hammer 2.1 | 0.5B, 1.5B, 3B | bf16 / 8da4w |
| Bielik v3.0 | Polish | — |
| LFM 2.5 | 350M, 1.2B | — |

**Gemma is NOT pre-packaged.** You would need to export it yourself via `optimum-executorch` — achievable but non-trivial (PyTorch + Python export pipeline, .pte compilation, quantization tuning, runtime version pinning — "no forward compatibility guaranteed" is in the HF model cards).

---

## 4. The Japanese question (the one that matters most for Jisho)

Apple Foundation Models are English-biased. Fine for English UI copy; mediocre at generating idiomatic Japanese examples with furigana, and weak at nuanced grammatical explanations in Japanese. This is the single most defensible reason to consider moving.

How the candidate local models rank for Japanese (roughly, at ~1–3B scale):

1. **Qwen 2.5 / Qwen 3** — by far the strongest small-model Japanese. Alibaba trained heavily on CJK. Qwen2.5-1.5B or Qwen3-1.7B quantized is the realistic sweet spot for on-device Japanese generation.
2. **Phi-4-Mini** — decent multilingual, weaker on Japanese idiom than Qwen.
3. **Gemma 2/3 (2B)** — multilingual-capable but Japanese is not its strength; not pre-packaged.
4. **Llama 3.2 (1B/3B)** — English-first; Japanese output is noticeably worse than Qwen at the same param count. Meta explicitly lists 8 supported languages and Japanese is not one of them.

**If the whole goal is better Japanese, "Llama/Gemma" is the wrong shortlist. Qwen is the answer.** And Qwen ships in both libraries: ExecuTorch has Qwen 3 0.6B/1.7B/4B and Qwen 2.5 0.5B/1.5B/3B; `@react-native-ai/llama` can load any Qwen GGUF.

---

## 5. Feature-by-feature comparison against your current code

| Feature used in `AppleAIProvider.tsx` | Apple (current) | ExecuTorch | `@react-native-ai/llama` |
|---|---|---|---|
| `generateObject` w/ Zod schema | ✅ native | ❌ not supported — reimplement as prompt + JSON.parse + retry loop | ✅ via AI SDK (same code) |
| `streamText` AsyncIterable | ✅ | ⚠️ callback-based, need adapter to AsyncIterable | ✅ via AI SDK (same code) |
| `abortSignal` | ✅ | ✅ `interrupt()` | ✅ |
| `maxOutputTokens`, `temperature` | ✅ | ✅ via `configure({ generationConfig })` | ✅ |
| `experimental_generateSpeech` | ✅ AVSpeechSynthesizer | ⚠️ separate `useTextToSpeech` hook, model-based TTS (Kokoro etc.), not AVSpeech | — (you'd keep Apple speech) |
| System prompt as first message | ✅ | ✅ | ✅ |
| `apple.isAvailable()` gate | ✅ | N/A (downloads models instead) | N/A |
| Voice picker (Kyoko) | ✅ | ❌ — different TTS stack | — |

**Net**: ExecuTorch forces you to rewrite the structured-output path and the TTS path. `@react-native-ai/llama` drops in against 90% of your existing code.

---

## 5a. TTS deep-dive (the Japanese question, again)

This is the section that changes the decision if TTS quality is a driver.

### What you use today

`@react-native-ai/apple` → `experimental_generateSpeech({ model: apple.speechModel(), text, voice: 'com.apple.voice.compact.ja-JP.Kyoko', language: 'ja-JP' })` → base64 WAV → `expo-audio` playback. The `pickBestJaVoice` helper prefers Kyoko → any non-Eloquence JA voice → any JA voice. This means users get the **best available on-device Apple voice** including iOS 17+ enhanced / premium neural voices (downloadable via iOS Settings → Accessibility → Spoken Content → Voices).

Quality: Kyoko Premium on iOS 17+ is genuinely very good JA TTS. Kyoko Enhanced is acceptable. Default compact Kyoko is OK. All are free, system-provided, and you already support voice selection via `SystemVoice[]` enumeration.

### What ExecuTorch actually ships for TTS

Only **Kokoro-82M** (`KOKORO_SMALL`, `KOKORO_MEDIUM`). The full voice list in `src/constants/tts/voices.ts`:

```
KOKORO_VOICE_AF_HEART   → lang: 'en-us'
KOKORO_VOICE_AF_RIVER   → lang: 'en-us'
KOKORO_VOICE_AF_SARAH   → lang: 'en-us'
KOKORO_VOICE_AM_ADAM    → lang: 'en-us'
KOKORO_VOICE_AM_MICHAEL → lang: 'en-us'
KOKORO_VOICE_AM_SANTA   → lang: 'en-us'
KOKORO_VOICE_BF_EMMA    → lang: 'en-gb'
KOKORO_VOICE_BM_DANIEL  → lang: 'en-gb'
```

**No ja-* voices. No Japanese phonemizer**: only `us_merged.json` and `gb_merged.json` are bundled. Kokoro-82M upstream *does* support Japanese (voice IDs `jf_alpha`, `jf_gongitsune`, `jf_nezumi`, `jf_tebukuro`, `jm_kumo`) via the `misaki` G2P library — but **Software Mansion has not packaged it**. To run Japanese Kokoro you would have to:

1. Export the `misaki` Japanese G2P data to the exact JSON format the RN module expects.
2. Re-export the Kokoro model for Japanese token ranges (the pre-built `.pte` is compiled with English token ranges baked in at export time).
3. Host your own weights bucket with compatible versioning.
4. Track upstream `.pte` compatibility (recall the "no forward compat" warning).

This is a research project, not a library upgrade. It's the kind of thing you pitch to Software Mansion as a PR, not something you own in a dictionary app's main branch.

### What `@react-native-ai/llama` ships for TTS

**Nothing Japanese-capable either.** The `@react-native-ai/llama` package is GGUF LLM inference only. The Vercel AI SDK surface exposes `experimental_generateSpeech`, but there is no TTS model loaded; calling it on a `llama()` model throws. So adding Qwen via `@react-native-ai/llama` doesn't buy you TTS — it just buys you LLM.

### What actually exists for on-device Japanese TTS in React Native

Almost nothing, honestly. The realistic options:

| Option | Status |
|---|---|
| **Apple `AVSpeechSynthesizer` + Kyoko Premium/Enhanced** | Works today, sounds good, free. iOS 13+. |
| **`expo-speech`** | Wraps the same `AVSpeechSynthesizer`. Same voices. |
| **ExecuTorch + Kokoro-JA** | Requires custom export work (above). Not shipped. |
| **ExecuTorch + any other TTS model** | Not packaged; `useTextToSpeech` is Kokoro-specific in types (`KokoroVoiceExtras`). |
| **llama.rn / `@react-native-ai/llama`** | No TTS at all. |
| **VITS-JA / Style-Bert-VITS2 via ONNX Runtime** | Not in either library. Would need a new native module. Heavy. |
| **Cloud TTS (OpenAI / Google / ElevenLabs JA)** | You already have this via `getAiSound`. Best quality, requires network + subscription. |

### Verdict on TTS

If TTS is part of your motivation for switching: **switching hurts you**. ExecuTorch's pre-built TTS doesn't speak Japanese, `llama.rn` has no TTS, and Apple's Kyoko Premium is genuinely competitive with any on-device neural TTS you could realistically ship in 2026 at zero download cost.

Keep `AVSpeechSynthesizer` for TTS no matter what you decide on the LLM side. Either:
- Via `@react-native-ai/apple` (your current path — keep it), or
- Directly via `expo-speech` (already in your deps) if you drop the apple provider entirely.

The tiny argument *for* trying ExecuTorch Kokoro-JA would be for English readings in a JA→EN flow, but you already have that covered by Apple voices too.

---

## 6. Bundle, disk, RAM, UX realities

### App size (at install)
- **Apple**: 0 MB added. All weights are system-provided.
- **ExecuTorch**: the runtime itself is meaningful native binary (C++ kernels per backend: XNNPACK CPU, Core ML delegate, MPS, Vulkan). Ballpark +20–40 MB IPA depending on enabled delegates. Models are downloaded on first use, not bundled — so initial IPA stays modest but first-run UX changes dramatically.

### Per-model disk / RAM
Rough numbers for on-device LLMs (quantized, fits-in-RAM tiers):

| Model | Disk (.pte quantized) | Peak RAM | Realistic devices |
|---|---|---|---|
| Qwen3-0.6B 8da4w | ~400 MB | ~1 GB | iPhone 12+ |
| Qwen3-1.7B 8da4w | ~1.1 GB | ~2.5 GB | iPhone 13+ |
| Llama-3.2-1B SpinQuant | ~1.1 GB | ~2 GB | iPhone 13+ |
| Qwen3-4B 8da4w / Llama-3.2-3B | ~2–2.5 GB | ~4–5 GB | iPhone 15 Pro+, and you need the "Increased Memory Limit" entitlement |
| Apple Foundation (3B distilled) | 0 (system) | shared w/ OS | iPhone 15 Pro / A17+ only anyway |

### First-run UX
First launch with a local LLM means a **multi-hundred-MB to multi-GB download** over the user's network, with a progress UI, pause/resume, cellular warnings, disk-full handling, mid-download backgrounding, and eviction policy (what happens when the user switches models?). That is a feature, not a line item. `useLLM` gives you `downloadProgress`, but everything else is on you.

### iOS version
- Apple provider: iOS 26+ for generation. **This is the real ceiling** — most of your users on iPhone 13/14 on iOS 17/18 get nothing from Apple Intelligence today. If that is why you are reconsidering, say so clearly — that is a legitimate motivation.
- ExecuTorch: iOS 17+. Runs on ~every device sold in the last 5 years, with acceptable perf on A15+ chips.

---

## 7. Hardware acceleration honestly assessed

- **Apple Foundation Models**: first-class ANE + GPU, co-designed with the model. You will not beat this on an A17/A18 device.
- **ExecuTorch on iOS**: supports Core ML delegate (ANE), MPS (GPU), XNNPACK (CPU). In practice Core ML delegate on small LLMs is still maturing. Expect 20–60 tok/s on a 0.6B–1.7B model on A17/A18, slower on older chips. `llama.rn` (Metal) benchmarks similarly.

Nobody beats Apple for Apple's own model on Apple's own silicon. ExecuTorch wins when you need a specific model Apple doesn't provide or when you need to run on iOS 17/18 / older hardware.

---

## 8. Maintenance and ecosystem risk

| Dimension | callstackincubator/ai | react-native-executorch |
|---|---|---|
| Owner | Callstack (long-standing RN agency) | Software Mansion (long-standing RN agency, ships Reanimated, Screens, etc.) |
| Stars / forks | 1.26k / 50 | 1.41k / 69 |
| Open issues | 10 | 68 |
| Last push | 2026-03-24 | 2026-04-17 |
| License | MIT | MIT |
| Breaking-change posture | AI SDK v5→v6 jump required major version bump | "No forward compatibility guaranteed" for .pte files between runtime versions — models re-download on major upgrades |
| App you can point at | — | Private Mind (App Store, Google Play) |

Both are healthy. ExecuTorch has more open issues per star, which tracks with it doing more (OCR, Whisper, VLM, embeddings) and being closer to the bleeding edge. The `.pte` forward-compat caveat is worth internalizing: when you bump the library, users may redownload gigabytes.

---

## 9. Migration cost (if you decide to do it)

Realistic work for a full replacement of `@react-native-ai/apple`:

1. **New provider** (`ExecuTorchAIProvider.tsx`) wrapping `useLLM` and exposing the same `AIProviderValue` shape. ~1 day.
2. **Structured-output reimplementation** for `generateExamples`: prompt asking for JSON only, regex/JSON-repair, Zod parse, retry on failure. ~1 day including edge cases.
3. **Streaming adapter**: bridge `tokenCallback` state updates to your existing `onChunk` callback. ~2 hours.
4. **Model download UX**: progress, pause, retry, cellular warning, disk-space preflight, background-resume. Settings screen for model choice + delete. **~2–3 days if done properly; it is its own feature.**
5. **TTS decision**: either keep Apple `AVSpeechSynthesizer` via `expo-speech` (works on iOS 13+, no AI needed), or adopt ExecuTorch's `useTextToSpeech`. Keeping Apple is the right call here — your `pickBestJaVoice` logic is already solid.
6. **Prompt tuning**: your `JP_EXPLANATION_SYSTEM_PROMPT` and `EXAMPLES_PROMPT` are tuned to Apple's model. Smaller models will need tighter, more explicit prompting and likely few-shot examples.
7. **Evaluation harness**: this is the one people skip and regret. Build a small JSON fixture of ~30–50 headwords and score example generation + explanation quality against Apple / Qwen / Llama before cutting over. ~1 day.
8. **Subscription gating rethink**: today "local AI" is free (no model download), "remote" is premium. If local means 1.2 GB download, is that still the free tier? Business decision.

Realistic total: **1–2 weeks of real work**, plus ongoing prompt/model retuning.

---

## 10. Pros and cons, structured

### Migrating to ExecuTorch — Pros

- **Model choice**: you pick Qwen 2.5/3, Phi-4-Mini, SmolLM-2, Llama 3.2. Qwen in particular unlocks much better Japanese quality.
- **iOS 17+ reach**: works on iPhone 11/12/13/14 where Apple Intelligence does not.
- **Android parity**: if you ever ship Android seriously, ExecuTorch works there. Apple provider does not.
- **Full offline**: truly offline, no dependency on OS-level Apple model availability.
- **Broader capabilities**: OCR (Tesseract/PaddleOCR-class), Whisper, text embeddings — all useful for a dictionary app (OCR for "look up from a photo", embeddings for semantic search over definitions).
- **Tool use / function calling**: first-class in `useLLM`. Could power agentic dictionary features.
- **No silent empty-response bug**: the `"Apple Intelligence is not available on the simulator"` fallback you currently have disappears.

### Migrating to ExecuTorch — Cons

- **No `generateObject` equivalent**. Your Zod-schema flow becomes homemade JSON-mode-with-retries. Real regression, real maintenance cost.
- **Large first-run download** (400 MB – 2 GB+ depending on model). Breaks "it just works" installs.
- **RAM pressure**. You ship a second premium tier (iPhone 15 Pro+) for the better models. Worse, crashes on 3–4GB-RAM devices if the user picks the wrong size.
- **`.pte` forward-compat gaps**. Users re-download GBs on library upgrades. Needs a migration / version-pinning story.
- **Gemma requires custom export**. "Llama/Gemma" is not a drop-in — Gemma means setting up `optimum-executorch`, maintaining your own .pte files, rehosting them, versioning them.
- **Quality**: Apple Intelligence at 3B-distilled-co-designed is roughly on par with Llama-3.2-3B quantized on English tasks. You are not trading up by default; you are trading specifically for Japanese capability and iOS 17 reach.
- **Simulator**: ExecuTorch LLMs on simulator are slow-to-impossible. Dev loop degrades.
- **Bundle size +20–40 MB** native binary.
- **Rewriting working code** — `providers/AppleAIProvider.tsx` is tuned and works. Throwing it out is measurable lost work.
- **TTS regression** if you try to switch away from Apple speech. `AVSpeechSynthesizer` with Kyoko is genuinely very good for JA.

### Staying on callstackincubator/ai — Pros

- **Zero migration**. Your code ships today.
- **Best possible Apple experience** when available.
- **Same AI SDK surface works across Apple / Llama / MLC** — you can add `@react-native-ai/llama` as a second local backend without leaving the library. `generateObject` continues to work.
- **Zero first-run download** for Apple users.
- **Maintained by Callstack**, who know the RN AI space.

### Staying on callstackincubator/ai — Cons

- **iOS 26+ wall** for generation. Big.
- **Japanese quality ceiling** set by Apple's model — not under your control.
- **Android: basically nothing**. If Android ships, Apple provider is dead weight.
- **No model choice**. You get what Apple gives you.

---

## 11. The option you should actually consider: **add, don't replace**

`callstackincubator/ai` is explicitly multi-provider. The lowest-risk path is:

1. Keep `@react-native-ai/apple` as-is. On iOS 26+, Apple Intelligence stays the default free-tier local path.
2. Add `@react-native-ai/llama` for iOS 17/18 users and Android, loading **Qwen 2.5 1.5B Instruct GGUF Q4_K_M** (~1 GB, strong Japanese).
3. Your `UnifiedAIProvider` gets a third `AIProviderType`: `"local-apple" | "local-qwen" | "remote"`, with gating based on `apple.isAvailable()` and model download state.
4. Keep TTS on Apple `AVSpeechSynthesizer` (Kyoko) regardless of LLM backend.
5. Reuse all your existing `generateObject` / `streamText` code. The model factory is the only thing that changes.

This gets you the 80% win (Japanese quality + iOS 17 reach) at ~30% of the cost of a full ExecuTorch migration, and you keep the Apple path for users who can use it.

---

## 12. Recommendation

- If the driver is **"my users are on iOS 17/18 and Apple Intelligence is unavailable"** → **add `@react-native-ai/llama` with Qwen 2.5 1.5B GGUF**. Don't migrate. 2–3 days of work.
- If the driver is **"Apple's Japanese is weak"** → same answer. Qwen > Apple > Llama on Japanese at these sizes.
- If the driver is **"I want Android parity"** → same answer again, because `llama.rn` works on Android too.
- If the driver is **"I want better Japanese TTS"** → **do not migrate**. ExecuTorch's pre-built TTS is Kokoro English-only. `@react-native-ai/llama` has no TTS. Apple Kyoko Premium (free, iOS 17+, downloadable via Settings) is the best realistic on-device JA TTS available to a React Native app in 2026. If Kyoko isn't good enough, the answer is cloud TTS (you already have this via `getAiSound`), not a different local library.
- If the driver is **"I want features beyond LLM: OCR of Japanese photos, Whisper STT for listening practice, embeddings for semantic dictionary search"** → **then** ExecuTorch is the right library for *those things*, because those capabilities don't exist in callstackincubator/ai. But in that case, mix: keep Apple for TTS and primary LLM, add ExecuTorch just for OCR/STT/embeddings. Don't let the OCR tail wag the LLM dog.

Given the actual Jisho feature set (dictionary search, word explanations, example sentences, JLPT reading passages), the OCR/STT case is genuinely plausible within 6–12 months. In that case the migration of *those subsystems* pays off. In the short term, the add-don't-replace option is strictly better than ripping out working Apple code — especially once you account for TTS.

---

## 13. Concrete next steps if you go the "add Qwen to callstack" path

1. `yarn add @react-native-ai/llama llama.rn react-native-blob-util`
2. Download Qwen2.5-1.5B-Instruct Q4_K_M GGUF on first use; store in app documents with version pinning.
3. New factory: `const model = useMMKVString(SETTINGS_KEYS.LOCAL_MODEL) === 'qwen' ? llama({ modelPath }) : apple()`.
4. `generateObject`, `streamText`, `abortSignal` — all unchanged.
5. Add settings UI: "On-device model: Apple (requires iOS 26) / Qwen 1.5B (1 GB download, best Japanese)".
6. Keep `pickBestJaVoice` + `AppleSpeech` TTS exactly as it is.

## 14. Concrete next steps if you go the "full ExecuTorch" path

1. `yarn add react-native-executorch react-native-executorch-expo-resource-fetcher`
2. Build `ExecuTorchAIProvider.tsx` mirroring `AppleAIProvider`'s `AIProviderValue` shape.
3. Start with `QWEN3_1_7B_QUANTIZED` — best Japanese-per-MB on offer.
4. Rebuild `generateExamples` as prompt + `JSON.parse` + retry + Zod parse.
5. Bridge `tokenCallback` → existing `onChunk` contract.
6. Build first-run model download UX (progress, cancel, retry, cellular guard, disk-space preflight).
7. Decide on model management UX: single model, or switchable with eviction?
8. **Keep TTS on Apple `AVSpeechSynthesizer` via `expo-speech` (or keep `@react-native-ai/apple` installed purely for `AppleSpeech.getVoices()` + `apple.speechModel()`)**. Do not adopt `useTextToSpeech` — it is English-only Kokoro and has no Japanese phonemizer in the shipped package. If you strip `@react-native-ai/apple`, port `pickBestJaVoice` to the `expo-speech` voice list.
9. Build a 30-headword eval fixture; compare Qwen 1.7B vs Apple vs current remote provider before cutover.
10. Re-tune `JP_EXPLANATION_SYSTEM_PROMPT` and `EXAMPLES_PROMPT` for a smaller model (more explicit, few-shot, tighter token budgets).

## 15. The "mixed-libraries" path (if OCR/STT/embeddings enter the roadmap)

Both libraries can coexist in one Expo app. If in 6–12 months you want photo-lookup (OCR), listening practice (Whisper), or semantic search (embeddings), the pragmatic stack is:

| Subsystem | Library |
|---|---|
| Chat + explanation LLM | `@react-native-ai/apple` on iOS 26+, `@react-native-ai/llama` (Qwen 1.5B GGUF) elsewhere |
| Structured output (examples) | same (Vercel AI SDK `generateObject`) |
| TTS | `@react-native-ai/apple` speech model or `expo-speech` (AVSpeechSynthesizer + Kyoko) |
| OCR for photo lookup | `react-native-executorch` — their OCR pipeline |
| STT for listening drills | `react-native-executorch` — Whisper |
| Embeddings for semantic dictionary search | `react-native-executorch` — text-embeddings |

This is heavier on native binary size than either library alone, but every subsystem uses the library that actually does it best. The LLM/TTS core stays on the path that works today, and ExecuTorch gets added only when/if the features that justify it ship.
