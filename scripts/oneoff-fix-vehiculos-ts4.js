const fs = require('fs');
const p = 'src/app/features/vehiculos/vehiculos.ts';
let s = fs.readFileSync(p, 'utf8');
const map = new Map([
  ['paginaci\uFFFDn','paginación'],
  ['Derivados de paginaci\uFFFDn','Derivados de paginación'],
]);
for (const [bad, good] of map) s = s.split(bad).join(good);
fs.writeFileSync(p, s, 'utf8');
console.log('vehiculos.ts comments fixed');