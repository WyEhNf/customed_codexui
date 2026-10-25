// Technical composition preview; source characters are never redrawn.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildWorkspaceFrame} from '../build-workspace-frame.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const baseline='G:/sandrone/CodexUI-Integrated/Windows-Portable';
const sharp=createRequire(import.meta.url)(process.env.SHARP_MODULE||'C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
const out=path.join(root,'evidence/workspace-frame');await fs.mkdir(out,{recursive:true});const layers=[];
for(let i=0;i<catalog.characters.length;i++){
 const c=catalog.characters[i],meta=JSON.parse(await fs.readFile(path.join(root,c.path,'presentation.json'),'utf8')),frame=buildWorkspaceFrame(meta);let render;
 if(c.id==='sandrone')render=await fs.readFile(path.join(baseline,c.path,'themes/sandrone/background.png'));
 else{
  let master=await fs.readFile(path.join(baseline,c.path,'assets/ui/workspace-composition.svg'),'utf8');
  const sourceFile=/href="(workspace-source[^\"]+)"/.exec(master)?.[1];if(!sourceFile)throw new Error('Source master missing');
  const bytes=await fs.readFile(path.join(baseline,c.path,'assets/ui',sourceFile));const mime=sourceFile.endsWith('.jpg')?'image/jpeg':'image/png';
  master=master.replace('</defs>','<linearGradient id="preview-quiet"><stop stop-color="black"/><stop offset=".57" stop-color="white"/></linearGradient><mask id="preview-source-fade"><rect width="1920" height="1080" fill="url(#preview-quiet)"/></mask></defs>');
  master=master.replace(/<rect width="1920" height="1080" fill="url\(#quiet\)"\/>/,'');
  master=master.replace(/<image href="workspace-source[^\"]+"[^>]*\/>/,image=>frame.body+'<g mask="url(#preview-source-fade)">'+image+'</g>');
  master=master.replace(`href="${sourceFile}"`,`href="data:${mime};base64,${bytes.toString('base64')}"`);
  render=await sharp(Buffer.from(master)).png().toBuffer();
 }
 await fs.writeFile(path.join(out,c.id+'-composition.png'),render);
 const w=480,h=270,x=i%3*w,y=Math.floor(i/3)*300;
 layers.push({input:await sharp(render).resize(w,h).png().toBuffer(),left:x,top:y});
 layers.push({input:Buffer.from(`<svg width="480" height="30"><rect width="480" height="30" fill="#101827"/><text x="12" y="21" fill="#d7e1f2" font-family="Segoe UI" font-size="17">${c.id} · complete quiet frame</text></svg>`),left:x,top:y+h});
}
await sharp({create:{width:1440,height:900,channels:4,background:'#0d1420'}}).composite(layers).png().toFile(path.join(out,'nine-character-compositions.png'));
console.log(JSON.stringify({pass:true,characters:catalog.characters.length,output:out,sourcePeopleRedrawn:false,layerOrder:'canvas → full frame → source image with its own quiet fade'}));
