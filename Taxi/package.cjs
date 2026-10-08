// Create a portable single HTML file without dependencies or a bundler.
const fs = require('node:fs');
const path = require('node:path');
const dist = path.join(__dirname,'dist');
const css = fs.readFileSync(path.join(dist,'styles.css'),'utf8');
const js = fs.readFileSync(path.join(dist,'app.js'),'utf8');
const favicon = fs.readFileSync(path.join(dist,'favicon.svg'),'utf8');
let html = fs.readFileSync(path.join(dist,'index.html'),'utf8');
html = html.replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">', `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}" type="image/svg+xml">`);
html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>${css}</style>`);
html = html.replace('  <script src="app.js" defer></script>\n','');
html = html.replace('</body>', () => `<script>${js.replace(/<\/script/gi,'<\\/script')}</script>\n</body>`);
fs.writeFileSync(path.join(__dirname,'vamonos.html'),html,'utf8');
console.log('Portable HTML created: vamonos.html');
