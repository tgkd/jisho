## Generate a fresh database bundle

Run the timestamped build to produce a new SQLite file under `assets/db/` without touching existing bundles:

```bash
yarn db:build
```

The script wraps the migration pipeline, creating a file named `db_<timestamp>.db`. You can point the app to the new asset or keep multiple builds side-by-side for comparison.

   ```bash
   npm i
   ```


   ```bash
    npx expo start
   ```


   ```bash
    npx expo run:ios
   ```


   ```bash
    eas build --platform ios
   ```


   ```bash
    eas submit --platform ios
   ```


jpn_transcriptions.tsv

Contains all transcriptions in auxiliary or alternative scripts. A username associated with a transcription indicates the user who last reviewed and possibly modified it. A transcription without a username has not been marked as reviewed. The script name is defined according to the ISO 15924 standard.

Sentence id [tab] Lang [tab] Script name [tab] Username [tab] Transcription



jpn_indices.tar

Contains the equivalent of the "B lines" in the Tanaka Corpus file distributed by Jim Breen. See this page for the format. Each entry is associated with a pair of Japanese/English sentences. Sentence id refers to the id of the Japanese sentence. Meaning id refers to the id of the English sentence.

Sentence id [tab] Meaning id [tab] Text


// Suggested promo words for screenshots
const promoWords = [
  // Basic everyday words
  { word: "こんにちは", reading: "konnichiwa", meaning: "hello, good afternoon" },
  { word: "ありがとう", reading: "arigatou", meaning: "thank you" },
  { word: "水", reading: "みず", meaning: "water" },
  { word: "本", reading: "ほん", meaning: "book" },
  { word: "時間", reading: "じかん", meaning: "time" },

  // Visually appealing kanji
  { word: "桜", reading: "さくら", meaning: "cherry blossom" },
  { word: "雨", reading: "あめ", meaning: "rain" },
  { word: "空", reading: "そら", meaning: "sky" },
  { word: "海", reading: "うみ", meaning: "sea, ocean" },
  { word: "山", reading: "やま", meaning: "mountain" },

  // Common but interesting
  { word: "電話", reading: "でんわ", meaning: "telephone" },
  { word: "学校", reading: "がっこう", meaning: "school" },
  { word: "料理", reading: "りょうり", meaning: "cooking, cuisine" },
  { word: "音楽", reading: "おんがく", meaning: "music" },
  { word: "友達", reading: "ともだち", meaning: "friend" }
];

/**
 * Example AI chat conversations for app store screenshots and marketing materials
 * These demonstrate the natural, helpful AI tutoring capabilities
 */
const aiChatExamples = [
  // Simple word explanation
  {
    user: "What does 桜 mean?",
    ai: "桜 (sakura) means \"cherry blossom\" - Japan's iconic pink and white flowers that bloom in spring. It's written with the kanji for \"tree\" (木) combined with a phonetic element. Cherry blossoms are deeply significant in Japanese culture, representing the fleeting nature of life and beauty."
  },

  // Usage context
  {
    user: "When do I use ありがとう vs ありがとうございます?",
    ai: "Great question! ありがとう is casual - use it with friends, family, or people close to you. ありがとうございます is polite - use it with strangers, customers, bosses, or in formal situations. Think of it like \"thanks\" vs \"thank you\" in English."
  },

  // Cultural context
  {
    user: "Why does 時間 have two different kanji?",
    ai: "時間 combines two related concepts: 時 (ji) means \"time\" or \"hour,\" while 間 (kan/ma) means \"interval\" or \"space between.\" Together they create the complete concept of \"time\" as duration. This compound structure is common in Japanese - combining simpler ideas to express complex concepts."
  },

  // Practical usage
  {
    user: "How do I pronounce 料理?",
    ai: "料理 is pronounced \"ryou-ri\" (REE-oh-ree). The first part りょう has a long 'o' sound. It means \"cooking\" or \"cuisine.\" You'll hear this word everywhere in Japan - on menus, cooking shows, and when talking about food!"
  },

  // Grammar insight
  {
    user: "What's the difference between 海 and 湖?",
    ai: "Both relate to water, but 海 (umi) means \"sea\" or \"ocean\" - the big salty bodies of water. 湖 (mizuumi) means \"lake\" - freshwater surrounded by land. Notice how 湖 contains 水 (water) + 古 (old), while 海 has the water radical 氵on the left side."
  }
];

// Short, snappy examples for smaller UI elements
const quickExamples = [
  {
    user: "What does this mean?",
    ai: "友達 (tomodachi) means \"friend\" - someone you're close to and enjoy spending time with."
  },

  {
    user: "How do I say this?",
    ai: "音楽 is pronounced \"on-gaku\" and means \"music.\" The first kanji relates to sound, the second to enjoyment."
  }
];
