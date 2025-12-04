const fs = require('fs');
const p = 'src/app/features/vehiculos/vehiculos.ts';
let s = fs.readFileSync(p, 'utf8');
const map = new Map([
  ['Veh\uFFFDculo','Vehículo'],
  ['veh\uFFFDculo','vehículo'],
]);
for (const [bad, good] of map) s = s.split(bad).join(good);
fs.writeFileSync(p, s, 'utf8');
console.log('vehiculos.ts accents patched 3');