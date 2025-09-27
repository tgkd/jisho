#!/usr/bin/env tsx
/**
 * Generate a fresh SQLite bundle with a timestamped filename.
 *
 * This wraps the existing migration pipeline so we can run the
 * schema + import steps in one go while preserving previously shipped
 * databases under assets/db/.
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

function formatTimestamp(date: Date): string {
  const yyyy = date.getFullYear().toString();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const min = `${date.getMinutes()}`.padStart(2, '0');
  const ss = `${date.getSeconds()}`.padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
}

function runStep(step: string, args: string[], env: NodeJS.ProcessEnv): void {
  console.log(`\n➡️  ${step}`);
  execFileSync('tsx', args, {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    env
  });
}

function main(): void {
  const timestamp = formatTimestamp(new Date());
  const relativeDbPath = `assets/db/db_${timestamp}.db`;
  const root = join(__dirname, '..');
  const outputDir = join(root, 'assets', 'db');

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const env = {
    ...process.env,
    DB_NAME: relativeDbPath
  };

  console.log('🧱 Generating dictionary database...');
  console.log(`📦 Target file: ${relativeDbPath}`);

  try {
    runStep('Creating empty schema', ['scripts/migrate.ts', '--create'], env);
    runStep('Importing dictionary content', ['scripts/migrate.ts', '--import'], env);
  } catch (error) {
    console.error('\n❌ Database build failed');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\n✅ Database created at ${relativeDbPath}`);
}

main();
