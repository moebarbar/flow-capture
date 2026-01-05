const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const archiver = require('archiver');

const EXTENSION_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(EXTENSION_DIR, 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'flowcapture-extension.zip');

const FILES_TO_INCLUDE = [
  'manifest.json',
  'icons',
  'popup',
  'src'
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

async function createZip() {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(OUTPUT_FILE);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      const size = (archive.pointer() / 1024).toFixed(2);
      console.log(`\nBuild complete: ${OUTPUT_FILE}`);
      console.log(`Package size: ${size} KB`);
      resolve();
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    for (const item of FILES_TO_INCLUDE) {
      const fullPath = path.join(EXTENSION_DIR, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        archive.directory(fullPath, item);
      } else {
        archive.file(fullPath, { name: item });
      }
    }
    
    archive.finalize();
  });
}

async function main() {
  console.log('Building FlowCapture Chrome Extension...\n');
  
  try {
    ensureDistDir();
    cleanOldBuild();
    validateManifest();
    await createZip();
    
    console.log('\nNext steps:');
    console.log('1. Go to https://chrome.google.com/webstore/devconsole');
    console.log('2. Click "New Item" and upload the zip file');
    console.log('3. Fill in the store listing details');
    console.log('4. Submit for review');
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

main();
