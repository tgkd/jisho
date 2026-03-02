#!/usr/bin/env node
/**
 * Fetch latest dictionary data from upstream sources.
 *
 * Downloads into a timestamped folder: data/YYYY-MM-DD_HHMMSS/
 * Does NOT rebuild the database — copy files to data/ and run db:create + db:import separately.
 *
 * Usage:
 *   tsx scripts/fetch-data.ts              # fetch all
 *   tsx scripts/fetch-data.ts --jmdict     # JMdict only → words.ljson
 *   tsx scripts/fetch-data.ts --kanji      # KANJIDIC only
 *   tsx scripts/fetch-data.ts --examples   # example sentences only
 *   tsx scripts/fetch-data.ts --furigana   # furigana data only
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const DATA_DIR = join(__dirname, '../data');
const TEMP_DIR = join(tmpdir(), 'jisho-fetch-' + Date.now());

const SAMPLE_SIZE = 50;
const KATAKANA_RE = /[\u30A0-\u30FF]/;
const HIRAGANA_RE = /[\u3040-\u309F]/;
const CJK_RE = /[\u3400-\u9FFF\u{20000}-\u{2A6DF}\u{2A700}-\u{2EBEF}\u{30000}-\u{323AF}]/u;

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function fileSize(path: string): string {
  const bytes = statSync(path).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function download(url: string, dest: string): void {
  console.log(`  Downloading ${url}`);
  execSync(`curl -fsSL -o "${dest}" "${url}"`, { stdio: 'pipe' });
}

function gunzipFile(src: string, dest: string): void {
  execSync(`gunzip -c "${src}" > "${dest}"`, { stdio: 'pipe' });
}

/* ──────────────────────────────────────────────
 *  JMdict XML → words.ljson conversion
 * ────────────────────────────────────────────── */

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseXmlEntry(xml: string): Record<string, any> | null {
  const obj: Record<string, any> = {};

  const kanji = [...xml.matchAll(/<keb>([^<]+)<\/keb>/g)].map(m => m[1]);
  if (kanji.length > 0) obj.k = kanji;

  const readings = [...xml.matchAll(/<reb>([^<]+)<\/reb>/g)].map(m => m[1]);
  if (readings.length === 0) return null;
  obj.r = readings;

  const senseBlocks = xml.split('<sense>').slice(1).map(s => s.split('</sense>')[0]);
  const senses: Record<string, any>[] = [];

  for (const block of senseBlocks) {
    const sense: Record<string, any> = {};

    const glosses = [...block.matchAll(/<gloss(?:\s[^>]*)?>([^<]+)<\/gloss>/g)]
      .map(m => decodeXmlEntities(m[1]));
    if (glosses.length === 0) continue;
    sense.g = glosses;

    if (block.includes('g_type="expl"')) sense.gt = 1;

    const pos = [...block.matchAll(/<pos>([^<]+)<\/pos>/g)].map(m => m[1]);
    if (pos.length > 0) sense.pos = pos;

    const field = [...block.matchAll(/<field>([^<]+)<\/field>/g)].map(m => m[1]);
    if (field.length > 0) sense.field = field;

    const misc = [...block.matchAll(/<misc>([^<]+)<\/misc>/g)].map(m => m[1]);
    if (misc.length > 0) sense.misc = misc;

    const info = [...block.matchAll(/<s_inf>([^<]+)<\/s_inf>/g)]
      .map(m => decodeXmlEntities(m[1]));
    if (info.length > 0) sense.inf = info.join('; ');

    senses.push(sense);
  }

  if (senses.length === 0) return null;
  obj.s = senses;
  return obj;
}

function convertJmdictToLjson(xmlPath: string, outputPath: string): void {
  console.log('  Converting JMdict XML → words.ljson...');

  let content = readFileSync(xmlPath, 'utf8');

  // Build entity map — resolve each user-defined entity to its short name
  const entityMap: Record<string, string> = {};
  const entityDefRegex = /<!ENTITY\s+([\w-]+)\s+"[^"]*">/g;
  let match;
  while ((match = entityDefRegex.exec(content)) !== null) {
    entityMap[match[1]] = match[1];
  }

  // Replace user-defined entity references: &adj-i; → adj-i
  content = content.replace(/&([\w-]+);/g, (full, name) => {
    if (name in entityMap) return entityMap[name];
    return full; // keep standard XML entities (&amp; etc.)
  });

  // Split on <entry> and parse each block
  const blocks = content.split('<entry>').slice(1);
  const lines: string[] = [];

  for (const raw of blocks) {
    const xml = raw.split('</entry>')[0];
    const entry = parseXmlEntry(xml);
    if (entry) lines.push(JSON.stringify(entry));
  }

  writeFileSync(outputPath, lines.join('\n') + '\n');
  console.log(`  ${lines.length.toLocaleString()} entries → ${fileSize(outputPath)}`);
}

/* ──────────────────────────────────────────────
 *  Validation
 * ────────────────────────────────────────────── */

interface ValidationResult {
  total: number;
  valid: number;
  invalid: number;
  errors: string[];
}

function validateWordsLjson(filePath: string): ValidationResult {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const result: ValidationResult = { total: lines.length, valid: 0, invalid: 0, errors: [] };

  // Sample evenly across file
  const step = Math.max(1, Math.floor(lines.length / SAMPLE_SIZE));
  const indices = Array.from({ length: Math.min(SAMPLE_SIZE, lines.length) }, (_, i) => i * step);

  for (const idx of indices) {
    const line = lines[idx];
    try {
      const data = JSON.parse(line);

      if (!Array.isArray(data.r) || data.r.length === 0) {
        result.errors.push(`line ${idx + 1}: missing readings`);
        result.invalid++;
        continue;
      }

      if (!Array.isArray(data.s) || data.s.length === 0) {
        result.errors.push(`line ${idx + 1}: missing senses`);
        result.invalid++;
        continue;
      }

      const hasGloss = data.s.some((s: any) => Array.isArray(s.g) && s.g.length > 0);
      if (!hasGloss) {
        result.errors.push(`line ${idx + 1}: no glosses in any sense`);
        result.invalid++;
        continue;
      }

      // readings should contain kana
      const hasKana = data.r.some((r: string) => KATAKANA_RE.test(r) || HIRAGANA_RE.test(r));
      if (!hasKana) {
        result.errors.push(`line ${idx + 1}: reading "${data.r[0]}" has no kana`);
        result.invalid++;
        continue;
      }

      result.valid++;
    } catch (e) {
      result.errors.push(`line ${idx + 1}: invalid JSON`);
      result.invalid++;
    }
  }

  return result;
}

function validateKanjidic(filePath: string): ValidationResult {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const result: ValidationResult = { total: lines.length, valid: 0, invalid: 0, errors: [] };

  const step = Math.max(1, Math.floor(lines.length / SAMPLE_SIZE));
  const indices = Array.from({ length: Math.min(SAMPLE_SIZE, lines.length) }, (_, i) => i * step);

  for (const idx of indices) {
    const line = lines[idx];

    if (line.startsWith('#') || line.trim().length === 0) {
      result.valid++;
      continue;
    }

    const char = [...line][0];
    if (!CJK_RE.test(char)) {
      result.errors.push(`line ${idx + 1}: first char U+${char.codePointAt(0)!.toString(16).toUpperCase()} is not CJK`);
      result.invalid++;
      continue;
    }

    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) {
      result.errors.push(`line ${idx + 1}: "${char}" has no data fields`);
      result.invalid++;
      continue;
    }

    result.valid++;
  }

  return result;
}

function validateExamples(filePath: string): ValidationResult {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const result: ValidationResult = { total: lines.length, valid: 0, invalid: 0, errors: [] };

  const step = Math.max(1, Math.floor(lines.length / SAMPLE_SIZE));
  const indices = Array.from({ length: Math.min(SAMPLE_SIZE, lines.length) }, (_, i) => i * step);

  for (const idx of indices) {
    const line = lines[idx];

    if (line.startsWith('A: ')) {
      const hasTab = line.includes('\t');
      const hasId = line.includes('#ID=');
      if (!hasTab) {
        result.errors.push(`line ${idx + 1}: A-line missing tab separator`);
        result.invalid++;
        continue;
      }
      if (!hasId) {
        result.errors.push(`line ${idx + 1}: A-line missing #ID=`);
        result.invalid++;
        continue;
      }
      result.valid++;
    } else if (line.startsWith('B: ')) {
      const hasJapanese = HIRAGANA_RE.test(line) || KATAKANA_RE.test(line) || CJK_RE.test(line);
      if (!hasJapanese) {
        result.errors.push(`line ${idx + 1}: B-line has no Japanese text`);
        result.invalid++;
        continue;
      }
      result.valid++;
    } else if (line.trim().length === 0) {
      result.valid++;
    } else {
      result.errors.push(`line ${idx + 1}: unexpected line format`);
      result.invalid++;
    }
  }

  return result;
}

function validateFurigana(filePath: string): ValidationResult {
  const result: ValidationResult = { total: 0, valid: 0, invalid: 0, errors: [] };

  let data: any[];
  try {
    let raw = readFileSync(filePath, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    data = JSON.parse(raw);
  } catch (e) {
    result.errors.push('failed to parse JSON array');
    result.invalid = 1;
    return result;
  }

  if (!Array.isArray(data)) {
    result.errors.push('root is not an array');
    result.invalid = 1;
    return result;
  }

  result.total = data.length;
  const step = Math.max(1, Math.floor(data.length / SAMPLE_SIZE));
  const indices = Array.from({ length: Math.min(SAMPLE_SIZE, data.length) }, (_, i) => i * step);

  for (const idx of indices) {
    const entry = data[idx];

    if (!entry || typeof entry !== 'object') {
      result.errors.push(`entry ${idx}: not an object`);
      result.invalid++;
      continue;
    }

    if (typeof entry.text !== 'string' || !entry.text.trim()) {
      result.errors.push(`entry ${idx}: missing text`);
      result.invalid++;
      continue;
    }

    if (typeof entry.reading !== 'string' || !entry.reading.trim()) {
      result.errors.push(`entry ${idx}: missing reading`);
      result.invalid++;
      continue;
    }

    if (!Array.isArray(entry.furigana) || entry.furigana.length === 0) {
      result.errors.push(`entry ${idx}: missing furigana segments`);
      result.invalid++;
      continue;
    }

    const hasRuby = entry.furigana.some((s: any) => s && typeof s.ruby === 'string');
    if (!hasRuby) {
      result.errors.push(`entry ${idx}: no valid ruby segments`);
      result.invalid++;
      continue;
    }

    result.valid++;
  }

  return result;
}

function printValidation(name: string, result: ValidationResult): void {
  const sampled = result.valid + result.invalid;
  const pct = sampled > 0 ? ((result.valid / sampled) * 100).toFixed(1) : '0';
  console.log(`  Validated: ${result.valid}/${sampled} sampled OK (${pct}%), ${result.total.toLocaleString()} total rows`);

  if (result.errors.length > 0) {
    const shown = result.errors.slice(0, 5);
    for (const err of shown) console.log(`    ⚠ ${err}`);
    if (result.errors.length > 5) {
      console.log(`    ... and ${result.errors.length - 5} more`);
    }
  }

  if (result.invalid > 0 && result.invalid >= sampled * 0.1) {
    throw new Error(`${name}: too many invalid rows (${result.invalid}/${sampled} sampled)`);
  }
}

/* ──────────────────────────────────────────────
 *  Fetch individual data sources
 * ────────────────────────────────────────────── */

async function fetchJmdict(outDir: string): Promise<void> {
  console.log('\n📖 JMdict → words.ljson');

  const gzPath = join(TEMP_DIR, 'JMdict_e.gz');
  const xmlPath = join(TEMP_DIR, 'JMdict_e');

  download('http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz', gzPath);
  console.log('  Extracting...');
  gunzipFile(gzPath, xmlPath);
  const dest = join(outDir, 'words.ljson');
  convertJmdictToLjson(xmlPath, dest);
  printValidation('words.ljson', validateWordsLjson(dest));
}

async function fetchKanjidic(outDir: string): Promise<void> {
  console.log('\n📝 KANJIDIC');

  const gzPath = join(TEMP_DIR, 'kanjidic_comb_utf8.gz');
  download('http://ftp.edrdg.org/pub/Nihongo/kanjidic_comb_utf8.gz', gzPath);
  const dest = join(outDir, 'kanjidic_comb_utf8');
  gunzipFile(gzPath, dest);
  console.log(`  ${fileSize(dest)}`);
  printValidation('kanjidic', validateKanjidic(dest));
}

async function fetchExamples(outDir: string): Promise<void> {
  console.log('\n💬 Example sentences');

  const gzPath = join(TEMP_DIR, 'examples.utf.gz');
  download('http://ftp.edrdg.org/pub/Nihongo/examples.utf.gz', gzPath);
  const dest = join(outDir, 'examples.utf');
  gunzipFile(gzPath, dest);
  console.log(`  ${fileSize(dest)}`);
  printValidation('examples', validateExamples(dest));
}

async function fetchFurigana(outDir: string): Promise<void> {
  console.log('\n🈁 Furigana');

  const res = await fetch(
    'https://api.github.com/repos/Doublevil/JmdictFurigana/releases/latest',
    { headers: { 'User-Agent': 'jisho-data-fetcher', Accept: 'application/vnd.github.v3+json' } }
  );
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

  const release = await res.json() as {
    tag_name: string;
    assets: { name: string; browser_download_url: string }[];
  };
  console.log(`  Release: ${release.tag_name}`);

  const asset = release.assets.find(a => a.name === 'JmdictFurigana.json');
  if (!asset) {
    const names = release.assets.map(a => a.name).join(', ');
    throw new Error(`JmdictFurigana.json not found in release assets: ${names}`);
  }

  const dest = join(outDir, 'JmdictFurigana.json');
  download(asset.browser_download_url, dest);
  console.log(`  ${fileSize(dest)}`);
  printValidation('furigana', validateFurigana(dest));
}

/* ──────────────────────────────────────────────
 *  Main
 * ────────────────────────────────────────────── */

function showHelp(): void {
  console.log(`
Usage: tsx scripts/fetch-data.ts [options]

Options:
  --all        Fetch everything (default when no flags given)
  --jmdict     JMdict_e → words.ljson
  --kanji      kanjidic_comb_utf8
  --examples   examples.utf
  --furigana   JmdictFurigana.json
  --help       Show this message

Files are saved to data/<timestamp>/.
To use them, copy into data/ and run: yarn db:create && yarn db:import
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const all = args.length === 0 || args.includes('--all');
  const ts = timestamp();
  const outDir = join(DATA_DIR, ts);

  console.log('🔄 Fetching dictionary data');
  console.log(`   Output: data/${ts}/`);

  mkdirSync(outDir, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });

  try {
    if (all || args.includes('--jmdict')) await fetchJmdict(outDir);
    if (all || args.includes('--kanji')) await fetchKanjidic(outDir);
    if (all || args.includes('--examples')) await fetchExamples(outDir);
    if (all || args.includes('--furigana')) await fetchFurigana(outDir);

    console.log(`\n✅ Saved to data/${ts}/`);
    console.log('   To use: copy files to data/ then run yarn db:create && yarn db:import');
  } finally {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error('\n❌', err.message);
  if (existsSync(TEMP_DIR)) rmSync(TEMP_DIR, { recursive: true, force: true });
  process.exit(1);
});
