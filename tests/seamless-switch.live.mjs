// Explicit manual smoke test of watcher handoff in an already managed app.
// Does not switch characters, remove styles, edit chat, or request an opening.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {appPages,Session} from '../engine/cdp.mjs';
import {windowsPowerShellEnv} from '../integration/control-env.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const managed=()=>fs.readFile(path.join(root,'state/managed.json'),'utf8').then(s=>JSON.parse(s.replace(/^\uFEFF/,'')));
const original=await managed();
async function control(action){
 const token=randomUUID().replaceAll('-','');
 const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',path.join(root,'engine/control.ps1'),'-Action',action,'-Token',token],{cwd:root,stdio:'ignore',windowsHide:true,timeout:55000,env:windowsPowerShellEnv()});
 if(result.error)throw result.error;
 const value=JSON.parse((await fs.readFile(path.join(root,'state/result-'+token+'.json'),'utf8')).replace(/^\uFEFF/,''));assert.equal(value.status,'ready',value.detail);return value;
}
async function snapshot(){
 const records=[];
 for(const page of await appPages(original.browserId)){
  const session=await new Session(page.webSocketDebuggerUrl).open();
  try{
   const record=await session.evaluate(`(()=>({active:document.documentElement.getAttribute('data-dream-skin')==='active',revision:window.__CODEX_DREAM_SKIN_STATE__?.revision,styles:document.adoptedStyleSheets.length,native:Boolean(window.__SANDRONE_NATIVE_UI__),openingStarted:window.__SANDRONE_OPENING_STATE__?.started||null,pauseUi:Boolean(document.getElementById('chatgpt-dream-skin-operation'))}))()`);
   if(record.active)records.push({target:page.id,...record});
  }finally{await session.close();}
 }
 return records;
}
const before=await snapshot();assert.ok(before.length,'An existing themed app is required');
let suspended=false,afterPrepare,afterResume;
try{
 await control('prepare-switch');suspended=true;afterPrepare=await snapshot();
 assert.deepEqual(afterPrepare,before,'preparation must not touch live skin, styles or opening');
}finally{if(suspended)await control('launch');}
afterResume=await snapshot();assert.deepEqual(afterResume,before,'warm handoff preserves visual state without replay');
const current=await managed();assert.equal(current.ownerPid,original.ownerPid);assert.equal(current.browserId,original.browserId);assert.notEqual(current.watcherPid,original.watcherPid);
const report={pass:true,scope:'live-managed-watcher-handoff-no-character-change',character:JSON.parse(await fs.readFile(path.join(root,'state/selection.json'),'utf8')).id,targets:before.length,stylesRetained:true,pauseUi:false,extraOpening:false,ownerUnchanged:true,watcherReplaced:true};
await fs.writeFile(path.join(root,'evidence/seamless-switch-live.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
