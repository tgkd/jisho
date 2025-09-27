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
