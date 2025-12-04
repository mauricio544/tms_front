const fs = require('fs');
const p = 'src/app/features/vehiculos/vehiculos.html';
let s = fs.readFileSync(p, 'utf8');
const map = new Map([
  ['VehÃ­culos','Veh\u00edculos'],
  ['vehÃ­culo','veh\u00edculo'],
  ['VehÃ­culo','Veh\u00edculo'],
  ['vehÃ­culos','veh\u00edculos'],
  ['AÃ±o','A\u00f1o'],
  ['PÃ¡gina','P\u00e1gina'],
  ['fabricaciÃ³n','fabricaci\u00f3n'],
  ['vÃ¡lidos','v\u00e1lidos'],
]);
for (const [bad, good] of map) s = s.split(bad).join(good);
fs.writeFileSync(p, s, 'utf8');
console.log('done');