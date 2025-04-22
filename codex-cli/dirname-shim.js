
// Shim for __dirname in ES modules
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Make __dirname available in ES modules
globalThis.__dirname = typeof __dirname !== 'undefined' 
  ? __dirname 
  : dirname(fileURLToPath(import.meta.url));
