import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR = resolve(__dirname, '../../dist/client');

async function checkReady() {
  try {
    const response = await fetch('http://localhost:3000/');
    if (response.ok) {
      console.log('Server ready');
      process.exit(0);
    }
  } catch {
    // not ready
  }
  // wait and retry
  await new Promise(r => setTimeout(r, 500));
  checkReady();
}

checkReady().catch(() => process.exit(1));