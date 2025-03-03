const { initializeDatabase } = require("../config/db");

const DB_PATH = path.join(__dirname, "..", "out", "jisho.db");
const db = initializeDatabase(DB_PATH);

function compress() {
  return new Promise((resolve, reject) => {
    db.exec("VACUUM;", (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

compress().catch((error) => {
  console.error("Unhandled error during compression:" + error);
  process.exit(1);
});
