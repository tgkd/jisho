# Premium Features TODO

> **Status**: RevenueCat integrated. Phase 3 (Word AI Chat) complete. Ready for sandbox testing.

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

### Phase 4: AI Reading Passages
- [ ] Practice section navigation (`app/practice/`)
- [ ] JLPT level-based passages (N5-N1)
- [ ] Furigana toggle, translation, audio
- [ ] Word lookup integration
- [ ] Database: `practice_passages`, `audio_cache` tables

### Phase 5: Backend Optimization
- [ ] Cloudflare Workers for AI gateway
- [ ] TTS caching (Cloudflare KV)
- [ ] Rate limiting per user
- [ ] LLM prompt optimization

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

**UI**
- `components/PaywallPrompt.tsx` - Paywall modal
- `app/settings/subscription.tsx` - Subscription management screen
- `app/word/[id].tsx` - Word detail page with AI chat integration
- `app/word/chat.tsx` - AI chat screen with word context support

**Docs**
- RevenueCat: https://www.revenuecat.com/docs/getting-started/installation/reactnative
- Dashboard: https://app.revenuecat.com
