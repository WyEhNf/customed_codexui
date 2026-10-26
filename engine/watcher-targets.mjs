import {earlyPayloadFor} from '../vendor/dream-skin/windows/scripts/injector.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
// Reuse upstream's fixed app: protocol/surface guard and bounded bootstrap.
// Only the already validated loadPayload output enters this source.
export const earlyThemeSource=earlyPayloadFor;
const initialized=new WeakSet();
export async function enableTargetBindings(session,listener){
 if(initialized.has(session))return false;
 const off=session.onEvent(listener),names=['sandroneReplayOpening','codexSwitchCharacter'];
 try{
  await session.send('Runtime.enable');
  for(const name of names)await session.send('Runtime.addBinding',{name});
  try{await session.send('Page.enable');}catch(error){if(['CDP_CONTEXT','CDP_CLOSED','CDP_TIMEOUT','CDP_UNAVAILABLE'].includes(error?.code))throw error;}
  initialized.add(session);return true;
 }catch(error){off?.();for(const name of names)try{await session.send('Runtime.removeBinding',{name});}catch{}throw error;}
}
async function removeScript(session,identifier){
 try{await session.send('Page.removeScriptToEvaluateOnNewDocument',{identifier});}
 catch(error){if(error?.cdpCode!==-32000||!/no.*script|script.*(?:not found|unknown)/i.test(error.message))throw error;}
}
export function createTargetLifecycle({now=Date.now,log=()=>{},onScript=async()=>{}}={}){
 const entries=new Map();
 const entry=id=>{let value=entries.get(id);if(!value){value={failures:0,until:0,lastLog:-Infinity,revision:null,script:null,fallback:false};entries.set(id,value);}return value;};
 return {
  allowed(id){return entry(id).until<=now();},
  waitMs(defaultMs){return Math.min(defaultMs,...[...entries.values()].filter(value=>value.until>now()).map(value=>value.until-now()));},
  success(id){const value=entry(id);value.failures=0;value.until=0;},
  failure(id,error){const value=entry(id);value.failures++;value.until=now()+Math.min(30000,1500*2**Math.min(value.failures-1,5));if(now()-value.lastLog>=30000){value.lastLog=now();log({code:error?.code||'TARGET_RETRY',failures:value.failures});}},
  async ensure(id,session,payload,revision){
   const value=entry(id);if(value.revision===revision)return value;
   if(value.script){await removeScript(session,value.script);await onScript(id,null);value.script=null;}
   let next=null;
   try{next=(await session.send('Page.addScriptToEvaluateOnNewDocument',{source:earlyThemeSource(payload,revision)}))?.identifier;if(!next)throw Error('No early-script identifier');value.fallback=false;}
   catch(error){if(['CDP_CONTEXT','CDP_CLOSED','CDP_TIMEOUT','CDP_UNAVAILABLE'].includes(error?.code))throw error;value.fallback=true;}
   value.script=next;if(next)await onScript(id,next);value.revision=revision;
   // Registration affects future documents; cover a document already loading
   // when this watcher attached, without touching a hidden healthy window.
   await session.evaluate(`if(document.visibilityState==='visible'&&!document.hidden){${earlyThemeSource(payload,revision)}}`);
   return value;
  },
  fallback(id){return entry(id).fallback;},
  async forget(id,session){const value=entries.get(id);let cleared=!session||!value?.script;if(session&&!session.closed){if(value?.script)try{await removeScript(session,value.script);cleared=true;}catch{}try{await session.evaluate('window.__CODEX_DREAM_SKIN_EARLY_GENERATION__=null');}catch{}}if(cleared)await onScript(id,null);entries.delete(id);},
  has(id){return entries.has(id);},
 };
}

export async function closeTargetConnections(pool,lifecycle,log=()=>{}){
 let deferred=0;
 await Promise.allSettled([...pool].map(async([id,session])=>{
  try{await lifecycle.forget(id,session);}catch{deferred++;}
  try{if(!session.closed)for(const name of ['sandroneReplayOpening','codexSwitchCharacter'])try{await session.send('Runtime.removeBinding',{name});}catch{}}
  finally{await session.close();}
 }));
 if(deferred)log({code:'WATCHER_CLEANUP_DEFERRED',targets:deferred});
}

export async function clearEarlyScripts(journal,pages,connect){
 for(const [id,script]of journal.entries()){
  const page=pages.find(page=>page.id===id);if(!page){await journal.delete(id);continue;}
  const session=await connect(page);
  try{await removeScript(session,script);await session.evaluate('window.__CODEX_DREAM_SKIN_EARLY_GENERATION__=null');await journal.delete(id);}
  finally{await session.close();}
 }
}

// CDP registrations can outlive a killed watcher. Persist identifiers only,
// bound to this browser, so a replacement watcher and native restore can clear
// them without retaining renderer source or any client/profile information.
export async function earlyScriptJournal(file,browserId){
 const valid=value=>typeof value==='string'&&/^[A-Za-z0-9._-]{1,200}$/.test(value);
 if(!valid(browserId))throw Error('Invalid early-script browser identity');
 let records=new Map(),pending=Promise.resolve();
 try{
  const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536)throw Error('Invalid early-script journal');
  const data=JSON.parse(await fs.readFile(file,'utf8'));
  if(data?.schemaVersion!==1||!valid(data.browserId)||!Array.isArray(data.scripts)||data.scripts.length>128||data.scripts.some(record=>!Array.isArray(record)||record.length!==2||!record.every(valid)))throw Error('Invalid early-script journal');
  if(data.browserId===browserId)records=new Map(data.scripts);
 }catch(error){if(error.code!=='ENOENT')throw error;}
 const write=()=>{
  const snapshot=JSON.stringify({schemaVersion:1,browserId,scripts:[...records]})+'\n';
  const job=async()=>{
   await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';
   try{await fs.writeFile(tmp,snapshot);for(let attempt=0;;attempt++){try{await fs.rename(tmp,file);break;}catch(error){if(!['EPERM','EBUSY','EACCES'].includes(error.code)||attempt>=5)throw error;await new Promise(resolve=>setTimeout(resolve,30*(attempt+1)));}}}
   finally{await fs.unlink(tmp).catch(()=>{});}
  };
  pending=pending.then(job,job);return pending;
 };
 return {
  entries(){return [...records];},
  async set(id,script){if(!valid(id)||!valid(script))throw Error('Invalid early-script identifier');if(records.get(id)===script)return;records.set(id,script);await write();},
  async delete(id){if(records.delete(id))await write();},
  async clear(){records.clear();await write();},
 };
}
