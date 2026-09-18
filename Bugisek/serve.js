/* Optional development server. The game also opens directly from index.html. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon' };
http.createServer((req,res)=>{
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch (_) { res.writeHead(400);res.end('Bad request');return; }
  if(pathname === '/favicon.ico'){res.writeHead(204);res.end();return;}
  const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});
}).listen(port,'0.0.0.0',()=>console.log(`Skřítek Bugísek: http://localhost:${port}`));
