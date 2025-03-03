### Step 1: Set Up Your Node.js Project

1. **Create a new directory for your project:**
   ```bash
   mkdir word-migration
   cd word-migration
   ```

2. **Initialize a new Node.js project:**
   ```bash
   npm init -y
   ```

3. **Install required packages:**
   ```bash
   npm install sqlite3 fs readline
   ```

### Step 2: Create the SQLite Database

Create a file named `database.js` to handle the SQLite database connection and schema.

```javascript
// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'words.db'), (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the words database.');
});

// Create tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        japanese TEXT UNIQUE,
        english TEXT,
        pronunciation TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS examples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word_id INTEGER,
        example TEXT,
        FOREIGN KEY (word_id) REFERENCES words (id)
    )`);
});

module.exports = db;
```

### Step 3: Create the Migration Script

Create a file named `migrate.js` to read data from the three files and insert it into the database.

```javascript
// migrate.js
const fs = require('fs');
const readline = require('readline');
const db = require('./database');

const files = ['file1.txt', 'file2.txt', 'file3.txt']; // Replace with your actual file names

async function migrateData() {
    for (const file of files) {
        const fileStream = fs.createReadStream(file);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            const [japanese, english, pronunciation] = line.split('\t'); // Adjust based on your file format

            // Insert word into the database
            db.run(`INSERT OR IGNORE INTO words (japanese, english, pronunciation) VALUES (?, ?, ?)`, [japanese, english, pronunciation], function(err) {
                if (err) {
                    console.error(err.message);
                } else {
                    const wordId = this.lastID;

                    // Insert example usage if available
                    const example = `Example usage for ${japanese}`; // Replace with actual example extraction logic
                    db.run(`INSERT INTO examples (word_id, example) VALUES (?, ?)`, [wordId, example], function(err) {
                        if (err) {
                            console.error(err.message);
                        }
                    });
                }
            });
        }
    }
}

migrateData().then(() => {
    console.log('Migration completed.');
    db.close();
}).catch(err => {
    console.error(err);
    db.close();
});
```

### Step 4: Prepare Your Data Files

Ensure your data files (`file1.txt`, `file2.txt`, `file3.txt`) are formatted correctly. Each line should contain the Japanese word, English meaning, and pronunciation separated by tabs. For example:

```
彼	He	かれ
忙しい	Busy	いそがしい
```

### Step 5: Run the Migration Script

Run the migration script using Node.js:

```bash
node migrate.js
```

### Step 6: Search Functionality

To implement search functionality, you can create a new file named `search.js`:

```javascript
// search.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'words.db'));

function searchWord(word) {
    db.serialize(() => {
        db.all(`SELECT * FROM words WHERE japanese = ? OR english = ?`, [word, word], (err, rows) => {
            if (err) {
                console.error(err.message);
            }
            if (rows.length > 0) {
                console.log(rows);
            } else {
                console.log('No results found.');
            }
        });
    });
}

// Example usage
const wordToSearch = '彼'; // Replace with the word you want to search
searchWord(wordToSearch);

db.close();
```

### Step 7: Run the Search Script

You can run the search script similarly:

```bash
node search.js
```

### Conclusion

This setup allows you to migrate data from multiple files into an SQLite database, ensuring deduplication and enabling searches by either Japanese or English words. You can expand the example extraction logic and improve the search functionality as needed.