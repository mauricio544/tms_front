const fs = require('fs');
const path = 'src/app/features/envios/envios.html';
let s = fs.readFileSync(path, 'utf8');
// Fix the header title to "Envíos"
s = s.replace(/(<h1[^>]*>)[\s\S]*?(<\/h1>)/, (m, a, b) => a + 'Envíos' + b);
// Fix the subtitle paragraph to "Órdenes y tracking."
s = s.replace(/(<p[^>]*>)[\s\S]*?(<\/p>)/, (m, a, b) => a + 'Órdenes y tracking.' + b);
fs.writeFileSync(path, s, 'utf8');
console.log('envios header fixed');