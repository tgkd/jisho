# Premium Features Implementation Roadmap

> **Current Status**: Phase 2 completed - IAP integration and subscription management UI ready. Ready for Phase 3: Word AI Chat feature.

## 📋 Quick Summary

**What's Working Now**:
- ✅ Subscription management (trial, usage tracking, storage)
- ✅ On-device AI: Free & unlimited for all users
- ✅ Cloud AI: Premium-only with paywall on settings toggle
- ✅ All subscription logic centralized in `UnifiedAIProvider`
- ✅ Clean UI components - no subscription checks in views
- ✅ Environment-based API auth (no user credentials)
- ✅ IAP integration with `react-native-iap`
- ✅ Subscription settings screen with purchase flow
- ✅ Restore purchases functionality

**Next Steps**:
1. Configure product `com.jisho.premium.monthly` in App Store Connect
2. Test with App Store sandbox
3. Implement Word AI Chat component (Phase 3)

---

## ✅ Completed

### Phase 1-2: Core Infrastructure
- [x] Subscription storage keys (`services/storage.ts`)
- [x] Subscription management service (`services/subscription.ts`)
- [x] Subscription provider with React context (`providers/SubscriptionProvider.tsx`)
- [x] Premium badge component (`components/PremiumBadge.tsx`)
- [x] Paywall prompt modal with feature showcase (`components/PaywallPrompt.tsx`)
- [x] Trial system (7-day free trial)

### Phase 1.5: Architecture Refactor
- [x] **Centralized subscription logic** in `UnifiedAIProvider`
  - All AI methods check subscription before remote calls
  - Automatic usage tracking for remote AI
  - Paywall triggers handled internally
- [x] **Cleaned UI components** - removed subscription logic from:
  - `app/word/[id].tsx` - AI examples & TTS
  - All components just call `ai.generateExamples()`, `ai.generateSpeech()` directly
- [x] **AI Provider toggle in Settings** (`app/settings/index.tsx`)
  - Local AI (free) ↔ Cloud AI (premium)
  - Paywall triggers when non-premium user enables cloud AI
  - Clean UI with status indicators
- [x] **Environment-based API auth**
  - Credentials moved from MMKV to `.env` (EXPO_PUBLIC_AUTH_USERNAME/PASSWORD)
  - Removed user-facing credential inputs
  - `services/request.ts` uses env vars for Basic Auth
- [x] **Storage cleanup**
  - Removed deprecated `API_AUTH_USERNAME` and `API_AUTH_PASSWORD` keys

### Phase 2: IAP & Subscription Management
- [x] **IAP package integration** (`react-native-iap`)
  - Installed and configured `react-native-iap@14.4.12`
  - Product ID: `com.jisho.premium.monthly`
- [x] **Subscription service methods** (`services/subscription.ts`)
  - `initializeIAP()` - Initialize IAP connection
  - `purchaseSubscription(productId)` - Handle purchase flow
  - `restorePurchases()` - Restore previous purchases
  - `getSubscriptionProducts()` - Fetch available products
  - Receipt validation and activation
- [x] **SubscriptionProvider enhancements** (`providers/SubscriptionProvider.tsx`)
  - IAP initialization on mount
  - Products state management
  - `purchase()` and `restore()` methods in context
  - Loading states for purchases
- [x] **Subscription settings screen** (`app/settings/subscription.tsx`)
  - Premium/Trial/Free status display with icons
  - Trial countdown (X days remaining)
  - Daily usage stats (X/3 AI queries used today)
  - Premium benefits list
  - "Upgrade to Premium" button with pricing
  - "Start 7-Day Free Trial" button
  - "Restore Purchases" button
  - "Manage Subscription" link to App Store
- [x] **Settings screen integration** (`app/settings/index.tsx:173-199`)
  - Subscription status card (Premium/Trial/Free)
  - Usage stats display
  - Navigation to subscription screen
- [x] **App configuration** (`app.json`)
  - iOS bundle identifier: `app.jisho.loc`
  - IAP entitlements (SKPaymentTransactionObserver)

### Current State
- ✅ On-device AI: Free for all users (unlimited)
- ✅ Cloud AI: Premium-only with usage limits (3/day free tier)
- ✅ Subscription gating: All handled in provider, not UI
- ✅ Settings: Simple toggle with paywall
- ✅ IAP: Purchase and restore flows implemented
- ✅ Subscription management UI: Complete with all states

---

## 🚧 Next Priority: Word AI Chat Feature

### Manual Setup Required (Before App Store Testing)
**Priority: HIGH** - Required for sandbox testing

1. **App Store Connect Setup**:
   - Create app in App Store Connect
   - Add subscription product: `com.jisho.premium.monthly`
   - Set pricing: $2.99/month
   - Configure subscription group
   - Add free trial period (7 days)

2. **Sandbox Testing**:
   - Create sandbox test accounts
   - Install on physical device
   - Test purchase flow with sandbox account
   - Verify receipt validation
   - Test restore purchases

---

## 📱 Phase 3: Word-Specific AI Features
**Priority**: MEDIUM-HIGH
**Status**: 🔴 Not Started

### 3.1 Word AI Chat Component
**File**: `components/WordAIChat.tsx`

**Purpose**: Interactive AI chat about specific words (premium feature)

**Features**:
- Bottom sheet/modal interface
- Pre-populated with word context
- Suggested prompts: "Show examples", "Explain nuances", "Compare similar words", "Formality level?"
- Session-only chat history
- Uses `ai.chatWithMessages()` - gating handled automatically by provider

**Integration** (`app/word/[id].tsx`):
- Add "💬 Ask AI" button below meanings card
- Button calls `ai.chatWithMessages()` - provider handles premium check
- No explicit subscription logic needed in UI

---

## 📚 Phase 4: AI Reading Passages (Future)
**Priority**: MEDIUM
**Status**: 🔴 Not Started

**Overview**: JLPT-leveled reading practice with AI-generated content

**Key Features**:
- Practice section navigation (`app/practice/`)
- JLPT level-based passages (N5-N1)
- Furigana toggle, translation, audio playback
- Word lookup integration
- Database: `practice_passages` and `audio_cache` tables
- Premium-only content generation

---

## 🎨 Phase 5: UX & Onboarding (Future)
**Priority**: LOW
**Status**: 🔴 Not Started

**Key Improvements**:
- Premium features tour carousel
- Contextual upgrade prompts (after 3rd AI query, in-chat, practice tab access)
- Usage stats widget: "2/3 AI queries used today" with upgrade link

---

## 🔧 Phase 6: Backend & Optimization (Future)
**Priority**: LOW
**Status**: 🔴 Not Started

**Key Improvements**:
- Cloudflare Workers for AI gateway
- TTS caching (Cloudflare KV) - reduce costs by 70%+
- Rate limiting per user
- LLM prompt optimization for better quality and lower token usage

---

## 🎯 AI Provider Strategy

### On-Device AI (Local)
**FREE FOR ALL USERS** - No subscription required when using Apple Intelligence:
- Available on iOS 18.2+ devices with Apple Silicon
- User toggles AI provider in Settings (`app/settings/index.tsx`)
- When local AI is active, **ALL AI features are unlimited and free**:
  - ✅ Unlimited AI-generated examples
  - ✅ Unlimited AI explanations
  - ✅ Unlimited local TTS (Apple Speech Synthesis)
  - ✅ No daily query limits
- UnifiedAIProvider automatically routes to local when enabled
- No API costs, completely offline

### Cloud AI (Remote)
**PREMIUM FEATURE** - Requires subscription or daily limits:
- Toggle in Settings shows paywall for non-premium users
- Free tier: 3 AI queries per day (when enabled)
- Premium: Unlimited queries + cloud TTS with natural voices
- Costs ~$0.50/month per user for API usage
- Requires internet connection
- ✅ **Implemented**: Paywall trigger in settings toggle (`app/settings/index.tsx:116-120`)
- ✅ **API Auth**: Credentials stored in `.env` (EXPO_PUBLIC_AUTH_USERNAME/PASSWORD), not user-facing

### Implementation Note
**ALL subscription logic is handled inside `UnifiedAIProvider`** - UI components don't need to know about subscriptions:

```typescript
// UI components just call AI methods directly:
const ai = useUnifiedAI();

// No subscription checks needed - provider handles everything:
await ai.generateExamples(prompt);
await ai.generateSpeech(text);
```

**Internal Provider Logic**:
- Local AI calls: Always allowed, no checks or tracking
- Remote AI calls:
  - Check `subscription.canUseAI()` before request
  - Show paywall via `subscription.showPaywall(featureName)` if not allowed
  - Track usage via `subscription.trackAIUsage()` after success
  - Throw `SubscriptionRequiredError` for non-streaming methods

**Benefits**:
- UI components are subscription-agnostic
- Single source of truth for gating logic
- Easier to maintain and test
- Consistent behavior across all features

**Key Principle**: On-device AI democratizes access while premium features focus on cloud-powered enhancements (better voices, faster processing, advanced models).

---

## 📊 Success Metrics

### Conversion Goals
- **Free → Trial**: 15-20% conversion rate (cloud AI users)
- **Trial → Paid**: 40-50% conversion rate
- **Monthly Churn**: <10%
- **On-device AI adoption**: 30-40% of eligible devices

### Usage Metrics
- Daily AI queries per premium user: 10-20
- Reading passages generated per week: 5-10
- Word AI chat sessions per week: 3-5
- On-device AI usage: 50+ queries/day (no limits)

### Technical Metrics
- API cost per premium user: <$0.50/month
- TTS cache hit rate: >60%
- App load time: <2s
- Local AI fallback success rate: >95%

---

## 🚀 Implementation Status

### ✅ Phase 1 - Completed
- [x] Core subscription infrastructure
- [x] Paywall UI components
- [x] Centralized subscription gating in `UnifiedAIProvider`
- [x] Settings AI provider toggle with paywall
- [x] Environment-based API authentication
- [x] Clean UI components (no subscription logic)

### ✅ Phase 2 - Completed
- [x] IAP package integration (`react-native-iap`)
- [x] Subscription settings screen (`app/settings/subscription.tsx`)
- [x] Purchase flow implementation
- [x] Restore purchases functionality
- [x] Subscription management UI with all states
- [x] App Store configuration (`app.json`)

### 🎯 Phase 3 - Next Priority
- [ ] Word AI Chat component (`components/WordAIChat.tsx`)
- [ ] Bottom sheet/modal interface
- [ ] Pre-populated word context and suggested prompts
- [ ] Integration with word detail screen

### 🔮 Phase 4-6 - Future
- AI Reading Passages
- UX improvements & onboarding
- Backend optimization

---

## 📝 Testing Checklist

### Pre-Launch Testing
- [ ] Trial activation works correctly
- [ ] Trial expiration triggers properly
- [ ] Daily usage limits reset at midnight
- [ ] Paywall shows for all gated features
- [ ] IAP purchase flow (sandbox testing)
- [ ] Restore purchases works
- [ ] Subscription status persists across app restarts
- [ ] Analytics tracking works

### Edge Cases
- [ ] Subscription expires while app is open
- [ ] Network failure during purchase
- [ ] Multiple rapid AI requests
- [ ] Trial already used (prevent re-activation)
- [ ] Subscription on multiple devices

---

## 🛠️ Development Notes

### Adding New AI Features
When adding new AI features, follow this pattern:

**UI Component** (NO subscription logic):
```typescript
const ai = useUnifiedAI();

// Just call the AI method - provider handles everything:
const handleFeature = async () => {
  try {
    const result = await ai.generateExamples(prompt);
    // Use result...
  } catch (error) {
    // Handle error gracefully
    console.error("AI feature failed:", error);
  }
};
```

**Provider Method** (if adding new capability):
1. Check `currentProvider` type
2. For local: Execute without checks
3. For remote:
   - Call `checkRemoteAccess("Feature Name")` first
   - If check fails, throw `SubscriptionRequiredError` or call `streaming.onError()`
   - Execute remote API call
   - Track usage with `subscription.trackAIUsage()` after success

### Code Quality
- Add JSDoc comments to all subscription functions
- Write unit tests for subscription logic in `UnifiedAIProvider`
- Add E2E tests for purchase flow
- Test paywall triggers for each AI feature type

### Documentation
- Update README with premium features
- Add subscription setup guide
- Document IAP configuration steps
- Create troubleshooting guide for users

---

## 💡 Future Enhancements (Post-MVP)

### Advanced Features
- **AI Speaking Practice**: Voice input → AI feedback
- **Custom Study Plans**: AI-generated study roadmap based on JLPT level
- **Spaced Repetition**: SRS system integrated with AI
- **Grammar Explanations**: Detailed breakdowns with AI
- **Conversation Scenarios**: Multi-turn roleplay with AI

### Monetization
- **Lifetime Premium**: One-time purchase option ($49.99)
- **Family Plan**: Share subscription with 5 users ($5.99/month)
- **Student Discount**: 50% off with .edu email

### Platform Expansion
- **Web App**: Subscription sync across platforms
- **API Access**: For advanced users/developers
- **Partnerships**: Integrate with other Japanese learning tools

---

## 📞 Key Files Reference

### Subscription System
- `services/subscription.ts` - Core subscription logic, trial management, usage tracking
- `providers/SubscriptionProvider.tsx` - React context for subscription state
- `providers/SubscriptionContext.tsx` - TypeScript interfaces
- `services/storage.ts` - MMKV keys for subscription data

### AI Provider System
- `providers/UnifiedAIProvider.tsx` - **Centralized subscription gating** for all AI features
- `providers/AppleAIProvider.tsx` - On-device Apple Intelligence integration
- `services/request.ts` - Cloud AI HTTP requests (uses env vars for auth)

### UI Components
- `components/PaywallPrompt.tsx` - Modal shown when premium features accessed
- `components/PremiumBadge.tsx` - Badge for premium features
- `app/settings/index.tsx` - Settings screen with AI provider toggle and subscription card
- `app/settings/subscription.tsx` - **Subscription management screen** with purchase flow
- `app/word/[id].tsx` - Example of clean AI integration (no subscription logic)

### Documentation
- Apple App Store: https://developer.apple.com/app-store/subscriptions/
- Expo IAP: https://docs.expo.dev/versions/latest/sdk/in-app-purchases/
- React Native IAP: https://react-native-iap.dooboolab.com/
