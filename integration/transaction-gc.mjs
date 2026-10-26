import fs from 'node:fs/promises';
import path from 'node:path';

const tokenPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const targets=['assets','themes','engine/renderer.mjs','engine/native-ui.css','integrity.json','state/selection.json'];
const childOf=(root,target)=>target.startsWith(root+path.sep);
async function readBounded(file,max=65536){const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max)throw Error('Invalid transaction record');return JSON.parse(await fs.readFile(file,'utf8'));}
async function safeTree(base,directory){
 const resolved=path.resolve(directory);if(!childOf(base,resolved))throw Error('Cleanup outside transaction root');
 const stat=await fs.lstat(resolved);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Linked transaction directory');
 const real=await fs.realpath(resolved);if(!childOf(base,real))throw Error('Redirected transaction directory');
 for(const entry of await fs.readdir(resolved,{withFileTypes:true})){
  const file=path.join(resolved,entry.name),item=await fs.lstat(file);if(item.isSymbolicLink())throw Error('Linked transaction child');
  if(item.isDirectory())await safeTree(base,file);else if(!item.isFile())throw Error('Unexpected transaction child');
 }
}
// Run while holding the character-switch lock. Pending, failed, malformed and
// redirected transactions are never cleanup candidates. Keep rollback history.
export async function pruneCompletedTransactions(root,{keep=3}={}){
 if(!Number.isInteger(keep)||keep<1||keep>20)throw Error('Invalid transaction retention');
 const rootReal=await fs.realpath(path.resolve(root)),base=path.resolve(rootReal,'state/transactions');
 let stat;try{stat=await fs.lstat(base);}catch(error){if(error.code==='ENOENT')return {removed:0,retained:0,skipped:0};throw error;}
 if(!stat.isDirectory()||stat.isSymbolicLink()||await fs.realpath(base)!==base)throw Error('Unsafe transaction root');
 let pending=null;try{const record=await readBounded(path.join(rootReal,'state/pending-switch.json'),4096);if(!record||typeof record!=='object'||Array.isArray(record)||!tokenPattern.test(record.token))return {removed:0,retained:0,skipped:1};pending=record.token;}catch(error){if(error.code!=='ENOENT')return {removed:0,retained:0,skipped:1};}
 const candidates=[];let skipped=0;
 for(const entry of await fs.readdir(base,{withFileTypes:true})){
  if(!tokenPattern.test(entry.name)||entry.name===pending||!entry.isDirectory()||entry.isSymbolicLink()){skipped++;continue;}
  const directory=path.join(base,entry.name);
  try{
   const journal=await readBounded(path.join(directory,'journal.json'));
   if(journal.schemaVersion!==1||journal.token!==entry.name||journal.committed!==true||journal.rolledBack||!Array.isArray(journal.steps)||journal.steps.length!==targets.length||journal.steps.some((s,i)=>s.target!==targets[i]||s.installed!==true)){skipped++;continue;}
   try{await fs.lstat(path.join(directory,'failed'));skipped++;continue;}catch(error){if(error.code!=='ENOENT')throw error;}
   const record=await fs.stat(path.join(directory,'journal.json')),stamp=Date.parse(journal.completedAt||'');
   candidates.push({directory,stamp:Number.isFinite(stamp)?stamp:record.mtimeMs});
  }catch{skipped++;}
 }
 candidates.sort((a,b)=>b.stamp-a.stamp||b.directory.localeCompare(a.directory));let removed=0;
 for(const {directory}of candidates.slice(keep))try{
  // Verify the final absolute target and all descendants immediately before a
  // recursive removal. Node removes links rather than following them; reject
  // them here as well so no redirected workspace path enters cleanup.
  await safeTree(base,directory);await fs.rm(directory,{recursive:true,force:false});removed++;
 }catch{skipped++;}
 return {removed,retained:Math.min(keep,candidates.length),skipped};
}
