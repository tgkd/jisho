#!/usr/bin/env tsx
/**
 * Deploys the index.html file to Cloudflare Pages project "jisho"
 *
 * This script:
 * 1. Creates a temporary build directory
 * 2. Copies index.html to the build directory
 * 3. Uses wrangler to deploy to Cloudflare Pages
 * 4. Cleans up temporary files
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const PROJECT_NAME = 'jisho';
const BUILD_DIR = resolve(PROJECT_ROOT, 'dist');
const INDEX_HTML = resolve(PROJECT_ROOT, 'index.html');

/**
 * Executes a command and logs it for transparency
 */
function executeCommand(command: string, cwd: string = PROJECT_ROOT): void {
  console.log(`\n🔧 Executing: ${command}`);
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd,
      env: { ...process.env }
    });
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    throw error;
  }
}

/**
 * Main deployment function
 */
async function deploy(): Promise<void> {
  console.log('🚀 Starting Cloudflare Pages deployment for Jisho...\n');

  try {
    // Step 1: Verify index.html exists
    if (!existsSync(INDEX_HTML)) {
      throw new Error(`index.html not found at ${INDEX_HTML}`);
    }
    console.log('✅ Found index.html');

    // Step 2: Create build directory
    if (existsSync(BUILD_DIR)) {
      rmSync(BUILD_DIR, { recursive: true, force: true });
    }
    mkdirSync(BUILD_DIR, { recursive: true });
    console.log('✅ Created build directory');

    // Step 3: Copy index.html to build directory
    copyFileSync(INDEX_HTML, resolve(BUILD_DIR, 'index.html'));
    console.log('✅ Copied index.html to build directory');

    // Step 4: Deploy using wrangler
    const deployCommand = `wrangler pages deploy ${BUILD_DIR} --project-name=${PROJECT_NAME}`;
    executeCommand(deployCommand);

    console.log('\n🎉 Deployment completed successfully!');
    console.log(`📄 Your site should be available at: https://${PROJECT_NAME}.pages.dev`);

  } catch (error) {
    console.error('\n❌ Deployment failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    // Step 5: Clean up build directory
    if (existsSync(BUILD_DIR)) {
      rmSync(BUILD_DIR, { recursive: true, force: true });
      console.log('🧹 Cleaned up build directory');
    }
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);
const isProduction = args.includes('--production') || args.includes('-p');

if (isProduction) {
  console.log('📦 Deploying to production environment');
} else {
  console.log('🧪 Deploying to preview environment');
}

// Run deployment
deploy().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
