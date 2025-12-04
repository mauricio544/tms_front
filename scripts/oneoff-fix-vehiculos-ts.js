const fs = require('fs');
const p = 'src/app/features/vehiculos/vehiculos.ts';
let s = fs.readFileSync(p, 'utf8');
const map = new Map([
  ['paginaci?n','paginación'],
  ['Derivados de paginaci?n','Derivados de paginación'],
  ['Confirmaci?n','Confirmación'],
  ['eliminaci?n','eliminación'],
  ['Veh?culo','Vehículo'],
  ['veh?culo','vehículo'],
  ['Veh?culos','Vehículos'],
  ['\uFFFDEliminar veh?culo','\u00bfEliminar vehículo'],
  ['No se pudieron cargar los veh?culos','No se pudieron cargar los vehículos'],
  ['No se pudo eliminar el veh?culo','No se pudo eliminar el vehículo'],
  ['No se pudo crear el veh?culo','No se pudo crear el vehículo'],
  ['No se pudo crear/actualizar el veh?culo','No se pudo crear/actualizar el vehículo'],
  ['Veh?culo actualizado','Vehículo actualizado'],
  ['Veh?culo creado','Vehículo creado'],
  ['Veh?culo eliminado','Vehículo eliminado'],
]);
for (const [bad, good] of map) s = s.split(bad).join(good);
fs.writeFileSync(p, s, 'utf8');
console.log('vehiculos.ts accents fixed');