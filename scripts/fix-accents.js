#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.cwd(), 'src');
const EXTS = new Set(['.html', '.ts', '.css']);

// Common mojibake sequences and their intended characters
const replacements = [
  // double-encoded (ÃƒÂx)
  ['ÃƒÂ¡','á'], ['ÃƒÂ©','é'], ['ÃƒÂ­','í'], ['ÃƒÂ³','ó'], ['ÃƒÂº','ú'], ['ÃƒÂ±','ñ'],
  ['ÃƒÂÁ','Á'], ['ÃƒÂÉ','É'], ['ÃƒÂÍ','Í'], ['ÃƒÂÓ','Ó'], ['ÃƒÂÚ','Ú'], ['ÃƒÂÑ','Ñ'],
  ['Ãƒâ€°','É'], ['Ãƒâ€˜','Ñ'], ['Ãƒâ€œ','Ó'],
  // single-encoded (Ãx)
  ['Ã¡','á'], ['Ã©','é'], ['Ã­','í'], ['Ã³','ó'], ['Ãº','ú'], ['Ã±','ñ'],
  ['Ã�','Á'], ['Ã‰','É'], ['Ã','Í'], ['Ã“','Ó'], ['Ãš','Ú'], ['Ã‘','Ñ'],
  ['Ã¼','ü'], ['Ãœ','Ü']
];

// Specific corrupted Spanish words using replacement char (�)
const wordFixes = [
  ['Env�os','Envíos'], ['Env�o','Envío'], ['N�mero','Número'], ['P�gina','Página'], ['�tem','Ítem'],
  ['Descripci�n','Descripción'], ['Impresi�n','Impresión'], ['Selecci�n','Selección'], ['Operaci�n','Operación'],
  ['Cat�logos','Catálogos'], ['An�lisis','Análisis'], ['�rdenes','Órdenes'], ['Planificaci�n','Planificación'],
  ['Gesti�n','Gestión'], ['Veh�culos','Vehículos'], ['Recepci�n','Recepción'], ['Gu�a','Guía'], ['Edici�n','Edición'],
  ['Confirmaci�n','Confirmación'], ['eliminaci�n','eliminación'], ['Impresi�n/exportaci�n','Impresión/Exportación']
];

function listFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.angular') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p));
    else if (EXTS.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}

function applyMaps(txt) {
  let out = txt;
  for (const [bad, good] of replacements) {
    if (out.includes(bad)) out = out.split(bad).join(good);
  }
  for (const [bad, good] of wordFixes) {
    if (out.includes(bad)) out = out.split(bad).join(good);
  }
  return out;
}

function fixFile(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const fixed = applyMaps(txt);
  if (fixed !== txt) {
    fs.writeFileSync(file, fixed, 'utf8');
    return true;
  }
  return false;
}

function main() {
  const files = listFiles(ROOT);
  let changed = 0;
  for (const f of files) {
    if (fixFile(f)) { changed++; console.log('fixed', path.relative(process.cwd(), f)); }
  }
  console.log(changed ? `Rewrote ${changed} files with corrected accents.` : 'No files needed changes.');
}

main();