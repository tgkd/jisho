# Premium Features TODO

> **Status**: RevenueCat integrated. Phase 3 (Word AI Chat) & Phase 4 (AI Reading Passages) complete. Ready for sandbox testing.

## 🔧 Setup Required

### RevenueCat Dashboard
- [x] Create project at https://app.revenuecat.com
- [x] Configure App Store Connect integration
- [x] Create entitlement: `premium`
- [x] Create offering with monthly package
- [x] Set environment variables:
  - `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY`
  - `EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY`

### App Store Connect
- [x] Create app in App Store Connect
- [x] Add subscription product: `jisho.month`
- [x] Set pricing and subscription group
- [x] Link to RevenueCat project

### Sandbox Testing
- [ ] Create sandbox test accounts
- [ ] Test purchase flow
- [ ] Verify entitlement activation
- [ ] Test restore purchases
- [ ] Trial activation/expiration
- [ ] Daily usage limits reset

---

## 📱 Feature Implementation

### Phase 3: Word AI Chat ✅ COMPLETE
- [x] Reuse existing `app/word/chat.tsx` screen (no new component needed)
- [x] Add route params support for word context (word, reading, meanings, initialPrompt)
- [x] Auto-send initial message when navigating with word context
- [x] Add "Ask AI" button in `app/word/[id].tsx`
- [x] Navigation to chat screen with pre-populated context
- [x] Uses `ai.chatWithMessages()` (gating handled by provider)
- [x] Context-aware header and empty state

**Implementation Note**: Instead of creating a bottom sheet component, we enhanced the existing chat screen to accept word context via route params and auto-initialize conversations. This provides a cleaner, full-screen experience while reusing existing infrastructure.

### Phase 4: AI Reading Passages ✅ COMPLETE
- [x] Practice section navigation (`app/practice/`)
- [x] JLPT level selection UI (N5-N1)
- [x] Passages list screen with AI generation
- [x] Passage reader with full features
- [x] Furigana toggle (uses existing MMKV settings)
- [x] Translation show/hide
- [x] Audio playback (TTS via UnifiedAI)
- [x] Word lookup integration (tap words to search)
- [x] Database migrations (v13-v14): `practice_passages`, `audio_cache` tables
- [x] Passage caching service (`services/database/passages.ts`)
- [x] Audio caching service (`services/database/audioCache.ts`)
- [x] API integration: `getAiReadingPassage(level)` in UnifiedAIProvider
- [x] Practice tab added to main navigation

**Implementation Note**: Created a three-screen flow: level selection → passages list → passage reader. The system generates JLPT-appropriate reading passages on demand via cloud AI, stores them locally, and provides a full-featured reading experience with furigana, translation, TTS audio, and word lookup. All subscription gating is handled centrally by UnifiedAIProvider following the established pattern.

### Phase 5: Backend Optimization
- [ ] Cloudflare Workers for AI gateway
- [ ] TTS caching (Cloudflare KV)
- [ ] Rate limiting per user
- [ ] LLM prompt optimization
- [ ] Implement `/passage/{provider}?level={level}` endpoint for Phase 4
  - Returns: `{ title: string, content: string, translation: string }`
  - JLPT levels: N5, N4, N3, N2, N1
  - Content should be Japanese text appropriate for the level
  - Translation should be English

---

## 🛠️ Development Pattern

### Adding New AI Features
```typescript
// UI Component (NO subscription logic)
const ai = useUnifiedAI();
const result = await ai.generateExamples(prompt);

// Provider Method (if adding new capability)
// 1. For local: Execute without checks
// 2. For remote:
//    - Call checkRemoteAccess("Feature Name")
//    - Execute remote API call
//    - Track with subscription.trackAIUsage()
```

---

## 📁 Key Files

**Subscription**
- `providers/SubscriptionProvider.tsx` - RevenueCat integration, trial management
- `providers/SubscriptionContext.tsx` - TypeScript interfaces
- `services/storage.ts` - MMKV keys

**AI Provider**
- `providers/UnifiedAIProvider.tsx` - Centralized subscription gating
- `providers/AppleAIProvider.tsx` - On-device Apple Intelligence
- `services/request.ts` - Cloud AI (env vars auth)

**Database**
- `services/database/core.ts` - Database migrations (currently v14)
- `services/database/passages.ts` - Practice passages CRUD operations
- `services/database/audioCache.ts` - Audio caching with auto-cleanup

**UI**
- `components/PaywallPrompt.tsx` - Paywall modal
- `app/settings/subscription.tsx` - Subscription management screen
- `app/word/[id].tsx` - Word detail page with AI chat integration
- `app/word/chat.tsx` - AI chat screen with word context support
- `app/practice/index.tsx` - JLPT level selection screen
- `app/practice/passages/[level].tsx` - Passages list with generation
- `app/practice/passage/[id].tsx` - Passage reader with full features

**Docs**
- RevenueCat: https://www.revenuecat.com/docs/getting-started/installation/reactnative
- Dashboard: https://app.revenuecat.com
