#!/usr/bin/env tsx
/**
 * Deploys all HTML pages to Cloudflare Pages project "jisho"
 *
 * This script:
 * 1. Creates a temporary build directory
 * 2. Copies all HTML files from pages/ directory to build directory
 * 3. Uses wrangler to deploy to Cloudflare Pages
 * 4. Cleans up temporary files
 */

import { execSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const PROJECT_NAME = 'jisho';
const BUILD_DIR = resolve(PROJECT_ROOT, 'dist');
const PAGES_DIR = resolve(PROJECT_ROOT, 'pages');

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
    // Step 1: Verify pages directory exists
    if (!existsSync(PAGES_DIR)) {
      throw new Error(`pages directory not found at ${PAGES_DIR}`);
    }
    console.log('✅ Found pages directory');

    // Step 2: Create build directory
    if (existsSync(BUILD_DIR)) {
      rmSync(BUILD_DIR, { recursive: true, force: true });
    }
    mkdirSync(BUILD_DIR, { recursive: true });
    console.log('✅ Created build directory');

    // Step 3: Copy all files from pages directory to build directory
    const files = readdirSync(PAGES_DIR);
    const deployFiles = files.filter(file => !file.endsWith('.ts') && !file.startsWith('.'));

    if (deployFiles.length === 0) {
      throw new Error('No files found in pages directory');
    }

    deployFiles.forEach(file => {
      copyFileSync(join(PAGES_DIR, file), join(BUILD_DIR, file));
      console.log(`✅ Copied ${file}`);
    });

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
