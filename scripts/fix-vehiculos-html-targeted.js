const fs = require('fs');
const p = 'src/app/features/vehiculos/vehiculos.html';
let s = fs.readFileSync(p, 'utf8');
function rep(rx, to){ s = s.replace(rx, to); }
// h1 title
s = s.replace(/(<h1[^>]*>)([^<]*?)(<\/h1>)/, function(_, a, b, c){ return a + 'Vehículos' + c; });
// search placeholder
rep(/placeholder="Buscar[^"]*"/, 'placeholder="Buscar vehículo"');
// year filter placeholder on the input with [(ngModel)]="filterAnio"
s = s.replace(/(\[\(ngModel\)\]=\"filterAnio\"[^\n]*?)placeholder=\"[^\"]*\"/m, '$1placeholder="Año"');
// Año : span in cards
rep(/>A[^<]*o:\s*\{\{/, '>Año: {{');
// Mostrando ... vehículos
rep(/veh[^\s<]*culos/g, 'vehículos');
// Página current/total line
s = s.replace(/<span>[^<]*page[^<]*<\/span>/, '<span>Página {{ page }} / {{ totalPages }}</span>');
// Empty state
s = s.replace(/No hay[^<]*mostrar\./, 'No hay vehículos para mostrar.');
// Modal title (editar/nuevo)
s = s.replace(/\{\{\s*editing\s*\?[^}]*\}\}/, '{{ editing ? "Editar vehículo" : "Nuevo vehículo" }}');
// Label Año fabricación
s = s.replace(/>A[^<]*o\s*fabricaci[^<]*</, '>Año fabricación<');
// Valid message
s = s.replace(/valores[^<]*</, 'valores válidos<');
// Loading text
s = s.replace(/Cargando[^<]*</, 'Cargando…<');
fs.writeFileSync(p, s, 'utf8');
console.log('vehiculos.html targeted fixes applied');