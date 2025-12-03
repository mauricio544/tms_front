#!/usr/bin/env node
/* check-encoding.js: Fail build on encoding artifacts and mojibake in src/ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(process.cwd(), 'src');
const exts = new Set(['.html', '.ts', '.css']);
const badChar = '\uFFFD'; // replacement character
const patterns = [
  /Env\?os/g, /Env\?o/g, /Gu\?a/g, /N\?mero/g, /Recepci\?n/g, /Planificaci\?n/g, /P\?gina/g,
  /\?tem/g, /\?rdenes/g, /v\?lida/g, /registr\?/g, /S\?/g
];

/** recursively list files */
function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.angular')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p));
    else if (exts.has(path.extname(entry.name))) out.push(p);
  }
  return out;
}

function scanFile(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const lines = txt.split(/\r?\n/);
  const hits = [];
  lines.forEach((line, idx) => {
    if (line.includes(badChar)) hits.push({ line: idx + 1, text: line });
    for (const rx of patterns) {
      if (rx.test(line)) { rx.lastIndex = 0; hits.push({ line: idx + 1, text: line }); }
    }
  });
  return hits;
}

function main() {
  if (!fs.existsSync(ROOT)) return;
  const files = listFiles(ROOT);
  let bad = [];
  for (const f of files) {
    const hits = scanFile(f);
    if (hits.length) {
      for (const h of hits) {
        bad.push(`${f}:${h.line}: ${h.text}`);
      }
    }
  }
  if (bad.length) {
    console.error('\nEncoding check failed. Found potential mojibake or replacement chars:');
    for (const line of bad) console.error('  ' + line);
    console.error('\nFix encoding to UTF-8 and correct the strings above.');
    process.exit(1);
  } else {
    console.log('Encoding check passed.');
  }
}

main();