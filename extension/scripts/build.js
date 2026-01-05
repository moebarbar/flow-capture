const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(EXTENSION_DIR, 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'flowcapture-extension.zip');

const FILES_TO_INCLUDE = [
  'manifest.json',
  'icons/',
  'popup/',
  'src/'
];

const FILES_TO_EXCLUDE = [
  'scripts/',
  'dist/',
  'README.md',
  '.git',
  '.DS_Store',
  'node_modules/'
];

function ensureDistDir() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
}

function cleanOldBuild() {
  if (fs.existsSync(OUTPUT_FILE)) {
    fs.unlinkSync(OUTPUT_FILE);
    console.log('Removed old build');
  }
}

function validateManifest() {
  const manifestPath = path.join(EXTENSION_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  const required = ['name', 'version', 'manifest_version', 'description'];
  const missing = required.filter(field => !manifest[field]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required manifest fields: ${missing.join(', ')}`);
  }
  
  console.log(`Building ${manifest.name} v${manifest.version}`);
  return manifest;
}

function createZip() {
  const includePattern = FILES_TO_INCLUDE.join(' ');
  const excludePattern = FILES_TO_EXCLUDE.map(f => `-x "${f}*"`).join(' ');
  
  try {
    execSync(
      `cd "${EXTENSION_DIR}" && zip -r "${OUTPUT_FILE}" ${includePattern} ${excludePattern}`,
      { stdio: 'inherit' }
    );
    console.log(`\nBuild complete: ${OUTPUT_FILE}`);
    
    const stats = fs.statSync(OUTPUT_FILE);
    console.log(`Package size: ${(stats.size / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('Failed to create zip:', error.message);
    process.exit(1);
  }
}

function main() {
  console.log('Building FlowCapture Chrome Extension...\n');
  
  ensureDistDir();
  cleanOldBuild();
  validateManifest();
  createZip();
  
  console.log('\nNext steps:');
  console.log('1. Go to https://chrome.google.com/webstore/devconsole');
  console.log('2. Click "New Item" and upload the zip file');
  console.log('3. Fill in the store listing details');
  console.log('4. Submit for review');
}

main();
