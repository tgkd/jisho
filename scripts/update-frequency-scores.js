#!/usr/bin/env node
/**
 * Frequency Score Updater - Extract existing priority data and update frequency scores
 * This script updates the database with position-based frequency scores as a starting point
 */

const { existsSync } = require('fs');
const Database = require('better-sqlite3');

// Find the correct database path
function findDatabasePath() {
  const possiblePaths = [
    './assets/db/d_3.db',
    './database.db',
    './dictionary.db'
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  throw new Error('No database file found. Please ensure the database exists.');
}

function updateFrequencyScores() {
  const dbPath = findDatabasePath();
  console.log(`🗄️  Using database: ${dbPath}`);
  
  let db;
  try {
    db = new Database(dbPath);
    console.log('✅ Database connected successfully');
    
    // Check if frequency_score column exists
    const columns = db.prepare("PRAGMA table_info(words)").all();
    const hasFrequencyScore = columns.some(col => col.name === 'frequency_score');
    
    if (!hasFrequencyScore) {
      console.log('❌ frequency_score column not found. Running migration...');
      
      // Add frequency columns
      db.exec(`
        ALTER TABLE words ADD COLUMN frequency_score INTEGER DEFAULT 0;
        ALTER TABLE words ADD COLUMN frequency_source TEXT DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_words_frequency ON words(frequency_score DESC);
      `);
      
      console.log('✅ Added frequency_score column and index');
    }
    
    // Get count of words without frequency scores
    const wordsToUpdate = db.prepare(`
      SELECT COUNT(*) as count 
      FROM words 
      WHERE frequency_score = 0 OR frequency_score IS NULL
    `).get();
    
    console.log(`📊 Found ${wordsToUpdate.count} words to update`);
    
    if (wordsToUpdate.count === 0) {
      console.log('✅ All words already have frequency scores');
      return;
    }
    
    // Update words with position-based frequency scores
    // This gives us a reasonable starting point until we get real frequency data
    console.log('🔄 Updating frequency scores based on position...');
    
    const updateStmt = db.prepare(`
      UPDATE words 
      SET frequency_score = CASE 
        WHEN position <= 1000 THEN 900000
        WHEN position <= 5000 THEN 800000
        WHEN position <= 10000 THEN 700000
        WHEN position <= 25000 THEN 600000
        WHEN position <= 50000 THEN 500000
        WHEN position <= 100000 THEN 400000
        WHEN position <= 200000 THEN 300000
        WHEN position <= 500000 THEN 200000
        WHEN position <= 1000000 THEN 100000
        ELSE 50000
      END,
      frequency_source = 'position_based'
      WHERE frequency_score = 0 OR frequency_score IS NULL
    `);
    
    const result = updateStmt.run();
    console.log(`✅ Updated ${result.changes} words with frequency scores`);
    
    // Show some sample results
    const sampleResults = db.prepare(`
      SELECT word, reading, position, frequency_score 
      FROM words 
      WHERE frequency_score > 0 
      ORDER BY frequency_score DESC, position ASC
      LIMIT 10
    `).all();
    
    console.log('\n📈 Sample frequency scores:');
    sampleResults.forEach((row, index) => {
      console.log(`${index + 1}. ${row.word} (${row.reading}) - Score: ${row.frequency_score} (Position: ${row.position})`);
    });
    
    console.log('\n🎯 Frequency distribution:');
    const distribution = db.prepare(`
      SELECT 
        CASE 
          WHEN frequency_score >= 800000 THEN 'Very High (800k+)'
          WHEN frequency_score >= 600000 THEN 'High (600k-800k)'
          WHEN frequency_score >= 400000 THEN 'Medium (400k-600k)'
          WHEN frequency_score >= 200000 THEN 'Low (200k-400k)'
          ELSE 'Very Low (<200k)'
        END as frequency_tier,
        COUNT(*) as word_count
      FROM words 
      WHERE frequency_score > 0
      GROUP BY frequency_tier
      ORDER BY MIN(frequency_score) DESC
    `).all();
    
    distribution.forEach(row => {
      console.log(`   ${row.frequency_tier}: ${row.word_count} words`);
    });
    
    console.log('\n✅ Frequency score update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating frequency scores:', error.message);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run the update
if (require.main === module) {
  updateFrequencyScores();
}