import { build } from 'esbuild';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
const model = await readFile(new URL('../assets/soldier.glb', import.meta.url));
await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
await writeFile(new URL('../tmp/model.js', import.meta.url), `export default '${model.toString('base64')}';\n`);
const textures={};
for(const name of await readdir(new URL('../assets/textures/',import.meta.url))){if(!name.endsWith('.jpg'))continue;const file=await readFile(new URL('../assets/textures/'+name,import.meta.url));textures[name.replace('.jpg','')]='data:image/jpeg;base64,'+file.toString('base64');}
await writeFile(new URL('../tmp/textures.js',import.meta.url),`export default ${JSON.stringify(textures)};\n`);
// Embed glTF buffers and images so both entry points still work over file://.
const props={};
for(const name of ['wooden_military_crate','power_box_01']){
  const directory=new URL(`../assets/models/${name}/`,import.meta.url);
  const gltf=JSON.parse(await readFile(new URL(`${name}.gltf`,directory),'utf8'));
  for(const buffer of gltf.buffers||[])buffer.uri='data:application/octet-stream;base64,'+(await readFile(new URL(buffer.uri,directory))).toString('base64');
  for(const image of gltf.images||[])image.uri='data:image/jpeg;base64,'+(await readFile(new URL(image.uri,directory))).toString('base64');
  props[name]=gltf;
}
await writeFile(new URL('../tmp/props.js',import.meta.url),`export default ${JSON.stringify(props)};\n`);
await build({entryPoints:['src/main.js'],bundle:true,format:'iife',target:['chrome110','firefox115','safari16'],outfile:'game.bundle.js',minify:true,legalComments:'eof',logLevel:'info'});
const html=(await readFile('index.html','utf8')).replace('<link rel="stylesheet" href="city.css">',''),css=(await readFile('style.css','utf8'))+'\n'+(await readFile('city.css','utf8')),js=await readFile('game.bundle.js','utf8');
const credits=await readFile('CREDITS.md','utf8'),license=await readFile('licenses/THREE-LICENSE.txt','utf8');
const standalone=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`).replace('<script src="game.bundle.js"></script>',()=>`<script>${js.replace(/<\/script/gi,'<\\/script')}</script>\n<script type="text/plain" id="asset-credits">${credits}\n\n${license}</script>`);
await writeFile('Vanguard.html',standalone);
console.log('Offline build ready: open index.html. No server or network required.');
