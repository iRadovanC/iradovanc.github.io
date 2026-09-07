// Optional development preview. Playing the game does not require this server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html'; }
  catch { res.writeHead(400).end(); return; }
  const target = path.resolve(root, name);
  if (!target.startsWith(root + path.sep) || !types[path.extname(target)] || name.startsWith('tools/')) { res.writeHead(404).end(); return; }
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)], 'Cache-Control': 'no-store' }); res.end(data);
  });
});
server.listen(0, '127.0.0.1', () => console.log(`Preview http://127.0.0.1:${server.address().port}`));
process.on('SIGINT', () => server.close(() => process.exit(0)));
