// Rebuild trusted opening code from checked-in templates and pack metadata.
// No original authoring folders, image libraries or video tools are required.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const groups={background:['#0c1016','#0b111b','#0b111a'],panel:['#17191f','#151e2a','#151d29','#192330'],panelAlt:['#202027','#202d3e','#263345','#273443','#2c394a','#384252','#34465e','#202833'],text:['#f3eee3','#f4eddd','#eee9dc','#eee8da','#ebe3d1'],muted:['#b8afa2','#c2c8cf','#aeb9c5','#9da7b4','#8c98a7'],accent:['#c7a86e','#d3b77e','#ddbb79','#cfb476','#c8a16a','#b9a172','#e9aa63'],accentAlt:['#e3d4b1','#efd29a','#ecd399','#ffd19a','#e8d4ae'],secondary:['#a8ddea','#a9cbd5','#b1ddeb','#85d9e6','#c5edf2'],highlight:['#993e50'],line:['#766246','#9e8256','#344153','#526176','#71839a','#687b91','#8e7953']};
export function renderCharacter(template,c){
 const p=c.palette,changes={};
 for(const key of Object.keys(groups)){if(!/^#[a-f0-9]{6}$/i.test(p[key]))throw Error('Invalid renderer palette');for(const color of groups[key])changes[color]=p[key];}
 Object.assign(changes,{'#101721':p.background,'#121923':p.background,'#131b26':p.background,'#19232f':p.panel,'#c8c4b7':'#c6d0e4','#897350':'#7a8090','#946641':p.accent});
 const rgb=color=>color.match(/\w\w/g).map(x=>parseInt(x,16)).join(',');
 let renderer=template.replace(/#[0-9a-f]{6}\b/gi,m=>changes[m.toLowerCase()]||m).replaceAll('rgba(199,168,110','rgba('+rgb(p.accent)).replaceAll('rgba(218,185,119','rgba('+rgb(p.accent)).replaceAll('rgba(221,187,121','rgba('+rgb(p.accent));
 const copy={'桑多涅':c.name,'THE MARIONETTE WORKSHOP':c.themeName.toUpperCase()+' · '+c.brandName.toUpperCase(),'FATUI / NO. 007':c.subtitle,'SANDRONE</h1>':c.brandName.toUpperCase()+'</h1>','>MARIONETTE<':'>'+c.themeName+'<','OFFICIAL CODEX · SANDRONE EDITION':'CODEX · '+c.brandName.toUpperCase()+' EDITION',"'Sandrone'":"'"+c.brandName+"'",'解算开始。':c.loadingStates[0],'填入变量。':c.loadingStates[1],'进程良好。':c.loadingStates[2],'析构万理！啊哈哈哈...':c.loadingStates[3]};
 for(const [a,b]of Object.entries(copy))renderer=renderer.replaceAll(a,b);
 return renderer;
}
export async function writeCharacterRenderers(){
 const template=await fs.readFile(path.join(root,'integration/templates/renderer.mjs'),'utf8');
 const {characters}=JSON.parse(await fs.readFile(path.join(root,'integration/characters-build.json'),'utf8'));
 for(const c of characters){const pack=path.join(root,c.path),meta=JSON.parse(await fs.readFile(path.join(pack,'presentation.json'),'utf8'));await fs.writeFile(path.join(pack,'engine/renderer.mjs'),renderCharacter(template,meta));}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await writeCharacterRenderers();
