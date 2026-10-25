import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const name of ['profile','state','machine.json','backups','evidence','Sandrone_Codex_Assets_Starter']){try{await fs.access(path.join(root,name));throw new Error('Private/local-only path present: '+name);}catch(e){if(e.code!=='ENOENT')throw e;}}
const edition=JSON.parse(await fs.readFile(path.join(root,'asset-edition.json'),'utf8'));
if(edition.edition!=='public-placeholder')throw new Error('This edition is not approved for the public source package');
const expected=JSON.parse(await fs.readFile(path.join(root,'PUBLIC-ASSETS.json'),'utf8'));
async function walk(directory){for(const e of await fs.readdir(directory,{withFileTypes:true})){if(e.isSymbolicLink())throw new Error('Asset link rejected');const p=path.join(directory,e.name);if(e.isDirectory())await walk(p);else{const relative=path.relative(root,p).split(path.sep).join('/'),b=await fs.readFile(p);if(createHash('sha256').update(b).digest('hex')!==expected[relative])throw new Error('Unknown or changed public asset: '+relative);}}}
await walk(path.join(root,'assets'));
const bg=await fs.readFile(path.join(root,'themes/sandrone/background.png'));
if(createHash('sha256').update(bg).digest('hex')!==expected['themes/sandrone/background.png'])throw new Error('Character background cannot be published as a placeholder');
console.log(JSON.stringify({pass:true,publicAssetsOnly:true,personalState:false}));
