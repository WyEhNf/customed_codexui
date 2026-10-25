import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const {characters}=JSON.parse(await fs.readFile(path.join(root,'integration/characters-build.json'),'utf8'));
for(const c of characters){
 const pack=path.join(root,c.path),motion=path.join(root,'integration/motion/output',c.id);
 await fs.copyFile(path.join(root,'engine/assets.mjs'),path.join(pack,'engine/assets.mjs'));
 let ledger,copyMotion=true;try{ledger=JSON.parse(await fs.readFile(path.join(motion,'derived.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;ledger=JSON.parse(await fs.readFile(path.join(pack,'assets/motion/derived.json'),'utf8'));if(!['source-video','illustrated-local-motion'].includes(ledger.animationKind))throw new Error('Production motion missing: '+c.id);copyMotion=false;}
 ledger.fullScene=c.id!=='sandrone';ledger.animationKind=c.id==='sandrone'?'source-video':'illustrated-local-motion';
 if(copyMotion)for(const f of await fs.readdir(motion))if(/\.(mp4|jpg|json)$/.test(f))await fs.copyFile(path.join(motion,f),path.join(pack,'assets/motion',f));
 await fs.writeFile(path.join(pack,'assets/motion/derived.json'),JSON.stringify(ledger,null,2)+'\n');
 if(c.id!=='sandrone')for(const f of ['sandrone-trace-1080p.mp4','sandrone-outline.json'])await fs.rm(path.join(pack,'assets/motion',f),{force:true});
 const material=path.join(root,'integration/materials/output',c.id);
 try{await fs.access(path.join(material,'personality.json'));await fs.copyFile(path.join(material,'personality.json'),path.join(pack,'assets/ui/personality.json'));await fs.copyFile(path.join(material,'material-icon-set.json'),path.join(pack,'assets/icons/ui/icon-set.json'));}catch(error){if(error.code!=='ENOENT')throw error;await fs.access(path.join(pack,'assets/ui/personality.json'));}
 const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else if(e.isFile()&&e.name!=='PROVENANCE.json'){const bytes=await fs.readFile(f);files.push({file:path.relative(pack,f).split(path.sep).join('/'),bytes:bytes.length,sha256:sha(bytes)});}}}
 for(const dir of ['assets','themes','engine'])await walk(path.join(pack,dir));
 await fs.writeFile(path.join(pack,'assets/PROVENANCE.json'),JSON.stringify({id:c.id,releaseVersion:'1.4.0',frameRevision:'1.4.2',source:'Retained selected daily originals, native-main-only geometric backdrop and independent opening; see assets/ui/composition.json and assets/motion/derived.json',animationKind:ledger.animationKind,signature:'Font-derived true cursive outline; not an official signature',files},null,2)+'\n');
 console.log('Assembled production: '+c.id);
}
