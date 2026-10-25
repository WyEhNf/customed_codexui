// Deterministic local-font-to-outline export. Font binaries are never bundled.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {windowsPowerShellEnv} from './control-env.mjs';
import {validateLettering} from '../engine/assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=path.join(root,'evidence/opening-lettering');await fs.mkdir(evidence,{recursive:true});
const raw=path.join(evidence,'font-outline-export.json');
const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',path.join(root,'integration/build-lettering.ps1'),'-Root',root,'-Output',raw],{encoding:'utf8',windowsHide:true,env:windowsPowerShellEnv(),timeout:60000});
if(result.status!==0)throw Error(result.stderr||result.stdout||'Local outline export failed');
const records=JSON.parse(await fs.readFile(raw,'utf8'));const summary=[];
for(const c of records){
 const value={schemaVersion:1,id:c.id,origin:'local-font-outline',fontsEmbedded:false,entries:c.entries};
 value.geometrySha256=createHash('sha256').update(JSON.stringify(value.entries)).digest('hex');
 validateLettering(value);
 const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length>512*1024)throw Error(c.id+' lettering exceeds asset limit');
 const branding=path.join(root,'characters',c.id,'assets/branding');await fs.writeFile(path.join(branding,'opening-lettering.json'),bytes);
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 for(const [key,glyph]of Object.entries(value.entries)){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${glyph.width}" height="${glyph.height}" viewBox="0 0 ${glyph.width} ${glyph.height}"><title>${escape(glyph.text)}</title><path d="${glyph.path}" fill="#dce8ff" fill-rule="evenodd"/></svg>`;
  await fs.writeFile(path.join(evidence,c.id+'-'+key+'.svg'),svg);
 }
 summary.push({id:c.id,bytes:bytes.length,marks:Object.keys(value.entries),fonts:[...new Set(Object.values(value.entries).map(e=>e.font))],fontsEmbedded:false,geometrySha256:value.geometrySha256});
 console.log('Art lettering: '+c.id+' '+bytes.length+' bytes');
}
await fs.writeFile(path.join(evidence,'build-summary.json'),JSON.stringify({pass:true,method:'Installed Hua Wen Xing Kai and Segoe Script outlined through GraphicsPath; no font files redistributed',characters:summary},null,2));
