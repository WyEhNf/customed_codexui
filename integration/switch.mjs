import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {recoverPending,loadCatalog,atomicJson} from './selection.mjs';
import {switchCharacter} from './coordinator.mjs';
import {windowsPowerShellEnv} from './control-env.mjs';
import {pruneCompletedTransactions} from './transaction-gc.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),operation=args[0],id=args[1],offline=args.includes('--no-launch');
const requestId=args.includes('--request-id')?args[args.indexOf('--request-id')+1]:null;
const state=path.join(root,'state');await fs.mkdir(state,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const lock=path.join(state,'character-switch.lock');let handle;
async function acquire(){
 const deadline=Date.now()+65000;
 while(Date.now()<deadline){
  try{handle=await fs.open(lock,'wx');await handle.writeFile(JSON.stringify({pid:process.pid,started:new Date().toISOString()}));return;}
  catch(e){
   if(e.code!=='EEXIST')throw e;let record;try{record=JSON.parse(await fs.readFile(lock,'utf8'));}catch{const stat=await fs.stat(lock).catch(()=>null);if(stat&&Date.now()-stat.mtimeMs>5000)await fs.unlink(lock).catch(()=>{});await sleep(200);continue;}
   let alive=true;try{process.kill(record.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
   if(!alive||Date.now()-Date.parse(record.started)>300000){await fs.unlink(lock).catch(()=>{});continue;}await sleep(200);
  }
 }
 throw new Error('另一项角色切换仍在进行，请稍后重试。');
}
function verifyRoot(){
 const r=spawnSync(process.execPath,[path.join(root,'verify-integrity.mjs')],{encoding:'utf8',timeout:30000,windowsHide:true});
 if(r.status!==0)throw new Error('集成版文件校验失败，请重新构建或重新解压。');
}
async function managedAlive(){
 try{const v=JSON.parse((await fs.readFile(path.join(state,'managed.json'),'utf8')).replace(/^\uFEFF/,''));process.kill(v.ownerPid,0);return true;}
 catch(e){if(['ENOENT','ESRCH'].includes(e.code))return false;throw e;}
}
async function control(action,playOpening=false){
 const token=randomUUID().replaceAll('-',''),params=['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',path.join(root,'engine/control.ps1'),'-Action',action,'-Token',token];
 if(action==='launch')params.push('-ActivateWindow');if(playOpening)params.push('-PlayOpening');
 // Results use the controller's atomic JSON file. Do not open captured pipes:
 // a long-lived watcher can inherit them and delay worker completion on Windows.
 const r=spawnSync('powershell.exe',params,{cwd:root,stdio:'ignore',timeout:90000,windowsHide:true,env:windowsPowerShellEnv()});
 try{return JSON.parse((await fs.readFile(path.join(state,'result-'+token+'.json'),'utf8')).replace(/^\uFEFF/,''));}
 catch{throw new Error('启动器未返回结果：'+(r.error?.message||'请查看集成版 state 目录。'));}
}
const report=v=>console.log(JSON.stringify(v));
async function embeddedResult(value){
 if(!requestId||!/^[a-f0-9-]{36}$/.test(requestId))return;
 const result={...value,requestId,finishedAt:new Date().toISOString()};
 await atomicJson(path.join(state,'last-switch-result.json'),result);
 try{
  const {appPages,Session}=await import('../engine/cdp.mjs');
  const managed=JSON.parse((await fs.readFile(path.join(state,'managed.json'),'utf8')).replace(/^\uFEFF/,''));
  for(const page of await appPages(managed.browserId)){
   const session=await new Session(page.webSocketDebuggerUrl).open();
   try{await session.evaluate(`window.__CODEX_CHARACTER_SWITCHER__?.report(${JSON.stringify(result)})`);}finally{await session.close();}
  }
 }catch{} // The persisted notice is also available after a window reload.
}
try{
 await acquire();
 // Recovery does not depend on theme assets passing integrity or on CDP state
 // being importable before the controller can report its identity diagnosis.
 if(operation!=='--restore'){await recoverPending(root);verifyRoot();}
 if(operation==='--status'){
  const catalog=await loadCatalog(root);let selected;try{selected=JSON.parse(await fs.readFile(path.join(state,'selection.json'),'utf8'));}catch{}
  report({status:'ready',selectedId:selected?.id||catalog.defaultId,characters:catalog.characters.map(({id,name,themeName})=>({id,name,themeName}))});
 }else if(operation==='--cleanup'){
  report({status:'ready',cleanup:await pruneCompletedTransactions(root),message:'已清理过期的成功切换备份；保留待处理与失败事务。'});
 }else if(operation==='--launch'){
  const r=await control('launch');report(r);if(!['ready','waiting'].includes(r.status))process.exitCode=2;
 }else if(operation==='--restore'){
  const r=await control('restore');report(r);if(!['ready','waiting'].includes(r.status))process.exitCode=2;
 }else if(operation==='--select'){
  const result=await switchCharacter({root,id,offline,managedAlive,control});await embeddedResult(result);report(result);
 }else throw new Error('Unknown integration operation');
}catch(error){
 const result={status:'error',message:error.message};await embeddedResult(result).catch(()=>{});report(result);process.exitCode=1;
}finally{if(handle){await handle.close();await fs.unlink(lock).catch(()=>{});}}
