const fs = require('fs');
function fixFile(p){
  const raw = fs.readFileSync(p, 'utf8');
  const before = (raw.match(/Ã|Â|�/g)||[]).length;
  const repaired = Buffer.from(raw, 'latin1').toString('utf8');
  const after = (repaired.match(/Ã|Â|�/g)||[]).length;
  if (after < before) { fs.writeFileSync(p, repaired, 'utf8'); console.log('fixed', p, `${before} -> ${after}`); }
  else { console.log('nochange', p, `${before}`); }
}
fixFile('src/app/features/vehiculos/vehiculos.html');
fixFile('src/app/features/vehiculos/vehiculos.ts');