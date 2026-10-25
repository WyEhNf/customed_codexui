import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const activeTargets=['assets','themes','engine/renderer.mjs','engine/native-ui.css','integrity.json','state/selection.json'];
const digest=b=>createHash('sha256').update(b).digest('hex');
export function inside(root,relative){
 if(typeof relative!=='string'||relative.includes('\\')||path.isAbsolute(relative)||relative.split('/').some(x=>!x||x==='.'||x==='..'))throw new Error('Invalid package path');
 const base=path.resolve(root),target=path.resolve(base,relative);
 if(!target.startsWith(base+path.sep))throw new Error('Path escapes package');return target;
}
const exists=async p=>{try{await fs.lstat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
export async function atomicJson(file,value){
 await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';
 await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n');
 // Windows scanners can briefly hold a freshly written journal. Keep the
 // atomic replacement, with a bounded retry, so rollback retains its cause.
 try{for(let attempt=0;;attempt++){try{await fs.rename(tmp,file);break;}catch(error){if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=5)throw error;await new Promise(resolve=>setTimeout(resolve,30*(attempt+1)));}}}
 catch(error){await fs.unlink(tmp).catch(()=>{});throw error;}
}
export async function loadCatalog(root){
 const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
 if(catalog.schemaVersion!==1||!Array.isArray(catalog.characters)||!catalog.characters.length)throw new Error('Invalid character catalog');
 const ids=new Set();for(const c of catalog.characters){
  if(!/^[a-z][a-z0-9-]{1,31}$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||c.path!=='characters/'+c.id)throw new Error('Invalid or duplicate character');
  ids.add(c.id);inside(root,c.path);
 }
 if(!ids.has(catalog.defaultId))throw new Error('Missing default character');return catalog;
}
export async function verifyPack(root,id){
 const catalog=await loadCatalog(root),entry=catalog.characters.find(c=>c.id===id);
 if(!entry)throw new Error('Unknown character: '+id);
 const pack=inside(root,entry.path),bytes=await fs.readFile(path.join(pack,'active-files.json'));
 if(digest(bytes)!==entry.manifestSha256)throw new Error('Character manifest digest mismatch');
 const manifest=JSON.parse(bytes);if(manifest.id!==id||!manifest.files||typeof manifest.files!=='object')throw new Error('Invalid character manifest');
 for(const [name,expected]of Object.entries(manifest.files)){
  if(!(name.startsWith('assets/')||name.startsWith('themes/sandrone/')||['engine/renderer.mjs','engine/native-ui.css'].includes(name)))throw new Error('Unexpected active payload');
  const file=inside(pack,name),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Non-regular character payload');
  if(digest(await fs.readFile(file))!==expected)throw new Error('Character asset changed: '+name);
 }
 for(const n of ['engine/renderer.mjs','engine/native-ui.css','themes/sandrone/theme.json','themes/sandrone/background.png','assets/branding/sandrone-signature.json'])if(!manifest.files[n])throw new Error('Incomplete character payload: '+n);
 return {entry,pack,manifest};
}
export async function stageCharacter(root,id){
 const verified=await verifyPack(root,id),token=randomUUID(),directory=inside(root,'state/transactions/'+token);
 const staged=path.join(directory,'staged');await fs.mkdir(staged,{recursive:true});
 for(const name of Object.keys(verified.manifest.files)){
  const file=inside(staged,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.copyFile(inside(verified.pack,name),file);
 }
 const baseBytes=await fs.readFile(path.join(root,'integration/integrity-base.json'));
 const integrity={...JSON.parse(baseBytes),...verified.manifest.files,'integration/integrity-base.json':digest(baseBytes)};
 await fs.writeFile(path.join(staged,'integrity.json'),JSON.stringify(integrity,null,2)+'\n');
 await atomicJson(path.join(staged,'state/selection.json'),{id,name:verified.entry.name,selectedAt:new Date().toISOString(),status:'selected'});
 const journal={schemaVersion:1,token,id,committed:false,steps:activeTargets.map(target=>({target,backedUp:false,installed:false}))};
 await atomicJson(path.join(directory,'journal.json'),journal);
 return {...verified,directory,staged,journal};
}
export async function rollback(root,{directory,journal}){
 for(const step of [...journal.steps].reverse()){
  if(!activeTargets.includes(step.target))throw new Error('Invalid rollback target');
  const target=inside(root,step.target),backup=inside(path.join(directory,'backup'),step.target);
  const hasBackup=await exists(backup),staged=inside(path.join(directory,'staged'),step.target);
  const preserved=inside(path.join(directory,'failed'),step.target);
  if(step.restored||(!hasBackup&&await exists(preserved)))continue;
  // Recover even if power loss happened between a rename and its journal update.
  const wasInstalled=step.installed||hasBackup||(!await exists(staged)&&await exists(target));
  if(wasInstalled&&await exists(target)){
   const preserve=inside(path.join(directory,'failed'),step.target);await fs.mkdir(path.dirname(preserve),{recursive:true});await fs.rename(target,preserve);
  }
  if(hasBackup){await fs.mkdir(path.dirname(target),{recursive:true});await fs.rename(backup,target);}
  step.restored=true;await atomicJson(path.join(directory,'journal.json'),journal);
 }
 journal.rolledBack=true;await atomicJson(path.join(directory,'journal.json'),journal);
 await fs.unlink(path.join(root,'state/pending-switch.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});
}
export async function commitCharacter(root,transaction,{afterStep}={}){
 const {directory,staged,journal}=transaction;await atomicJson(path.join(root,'state/pending-switch.json'),{token:journal.token});
 try{
  for(const step of journal.steps){
   const target=inside(root,step.target),backup=inside(path.join(directory,'backup'),step.target),replacement=inside(staged,step.target);
   if(await exists(target)){await fs.mkdir(path.dirname(backup),{recursive:true});await fs.rename(target,backup);step.backedUp=true;await atomicJson(path.join(directory,'journal.json'),journal);}
   await fs.mkdir(path.dirname(target),{recursive:true});await fs.rename(replacement,target);step.installed=true;
   await atomicJson(path.join(directory,'journal.json'),journal);await afterStep?.(step.target);
  }
  return transaction;
 }catch(error){await rollback(root,transaction);throw error;}
}
export async function finishCharacter(root,transaction){
 transaction.journal.committed=true;await atomicJson(path.join(transaction.directory,'journal.json'),transaction.journal);
 await fs.unlink(path.join(root,'state/pending-switch.json'));
}
export async function recoverPending(root){
 const pending=path.join(root,'state/pending-switch.json');if(!await exists(pending))return false;
 const {token}=JSON.parse(await fs.readFile(pending,'utf8'));if(!/^[a-f0-9-]{36}$/.test(token))throw new Error('Invalid pending transaction');
 const directory=inside(root,'state/transactions/'+token),journal=JSON.parse(await fs.readFile(path.join(directory,'journal.json'),'utf8'));
 if(journal.committed||journal.rolledBack){await fs.unlink(pending);return false;}await rollback(root,{directory,journal});return true;
}
