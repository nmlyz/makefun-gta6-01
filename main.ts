// Neon Bay — make.fun gta6-01 entrypoint (Node 22, stdlib only).
// Copies game/ and screenshots/ from beside this file to the output dir
// (env MAKEFUN_OUTPUT_DIR, else /output), then writes /output/dossier.json
// by calling buildDossier from './vendor/makefun-game.min.js'.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.min.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
mkdirSync(outDir, { recursive: true });
for (const name of ['game', 'screenshots']) {
  const src = join(here, name);
  if (existsSync(src)) cpSync(src, join(outDir, name), { recursive: true });
}
// buildDossier reads game/ and screenshots/ from the output dir it is given,
// so it runs after the copies above and takes the output dir as first arg.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000
});
// buildDossier returns the dossier bytes as a Uint8Array, not a string.
if (!(dossier instanceof Uint8Array) || dossier.length === 0) throw new Error('buildDossier returned an empty dossier');
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossier);
console.log('Neon Bay dossier written to ' + dossierPath + ' (' + dossier.byteLength + ' bytes)');
