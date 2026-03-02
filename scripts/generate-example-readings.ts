import SQLite from "better-sqlite3";
import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";
import path from "path";

const DB_PATH = path.join(__dirname, "../assets/jisho.db");
const BATCH_SIZE = 100;

async function generateReadings() {
  console.log("🚀 Starting reading generation for example sentences...");
  console.log(`📁 Database path: ${DB_PATH}`);

  const db = new SQLite(DB_PATH);

  console.log("🔧 Initializing Kuroshiro...");
  const kuroshiro = new Kuroshiro();
  await kuroshiro.init(new KuromojiAnalyzer());
  console.log("✅ Kuroshiro initialized");

  const totalExamples = db
    .prepare("SELECT COUNT(*) as count FROM examples")
    .get() as { count: number };
  console.log(`📊 Total examples: ${totalExamples.count}`);

  const examplesWithoutReading = db
    .prepare(
      "SELECT COUNT(*) as count FROM examples WHERE reading IS NULL OR reading = ''"
    )
    .get() as { count: number };
  console.log(
    `📝 Examples without reading: ${examplesWithoutReading.count}`
  );

  if (examplesWithoutReading.count === 0) {
    console.log("✅ All examples already have readings!");
    db.close();
    return;
  }

  let processed = 0;
  let updated = 0;
  let errors = 0;

  const updateStmt = db.prepare(
    "UPDATE examples SET reading = ? WHERE id = ?"
  );

  const selectStmt = db.prepare(`
    SELECT id, japanese_text
    FROM examples
    WHERE reading IS NULL OR reading = ''
    LIMIT ?
  `);

  while (true) {
    const batch = selectStmt.all(BATCH_SIZE) as Array<{
      id: number;
      japanese_text: string;
    }>;

    if (batch.length === 0) {
      break;
    }

    for (const example of batch) {
      try {
        const reading = await kuroshiro.convert(example.japanese_text, {
          to: "hiragana",
          mode: "normal",
        });

        updateStmt.run(reading, example.id);
        updated++;
        processed++;

        if (processed % 50 === 0) {
          console.log(
            `⏳ Progress: ${processed}/${examplesWithoutReading.count} (${Math.round((processed / examplesWithoutReading.count) * 100)}%)`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error processing example ${example.id}:`,
          error
        );
        errors++;
        processed++;
      }
    }
  }

  db.close();

  console.log("\n📈 Summary:");
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📊 Total processed: ${processed}`);
  console.log("\n🎉 Reading generation complete!");
}

generateReadings().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
