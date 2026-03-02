#!/usr/bin/env tsx
/**
 * Generate a fresh SQLite asset bundle.
 *
 * Always overwrites the same fixed asset file (jisho-seed.db) so old
 * timestamped builds don't accumulate.  The app's DATABASE_NAME
 * ("jisho.db") is separate — the asset is only copied on first install.
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ASSET_DB_NAME = 'jisho-seed.db';

function runStep(step: string, args: string[], env: NodeJS.ProcessEnv): void {
  console.log(`\n➡️  ${step}`);
  execFileSync('tsx', args, {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    env
  });
}

function main(): void {
  const relativeDbPath = `assets/db/${ASSET_DB_NAME}`;
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
