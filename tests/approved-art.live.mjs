// Explicit live smoke test. Changes only the managed character theme, then
// returns to the initial character. No chat text, project data or inputs read.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {appPages,Session} from '../engine/cdp.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const managed=async()=>JSON.parse((await fs.readFile(path.join(root,'state/managed.json'),'utf8')).replace(/^\uFEFF/,''));
const original=await managed(),initial=JSON.parse(await fs.readFile(path.join(root,'state/selection.json'),'utf8')).id;
const sessions=[];let current=initial;
const select=id=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[path.join(root,'integration/switch.mjs'),'--select',id],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',error='';
 child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);child.on('error',reject);child.on('exit',code=>{try{const result=JSON.parse(output.trim().split(/\r?\n/).at(-1));if(code||result.status!=='ready')throw new Error(result.detail||result.message||error);current=id;resolve(result);}catch(e){reject(e);}});
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(const page of await appPages(original.browserId)){
  const s=await new Session(page.webSocketDebuggerUrl).open();
  const themed=await s.evaluate(`document.documentElement.getAttribute('data-dream-skin')==='active'&&document.visibilityState==='visible'`);
  if(!themed){await s.close();continue;}
  await s.evaluate(`(()=>{const record={openings:0,pauseUi:0,frames:0,unthemedFrames:0,stopped:false};const observer=new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes){if(n.id==='sandrone-opening')record.openings++;if(n.id==='chatgpt-dream-skin-operation')record.pauseUi++;}});observer.observe(document.documentElement,{childList:true,subtree:true});const frame=()=>{if(record.stopped)return;record.frames++;if(document.documentElement.getAttribute('data-dream-skin')!=='active')record.unthemedFrames++;requestAnimationFrame(frame);};requestAnimationFrame(frame);window.__CODEX_APPROVED_ART_CHECK__={record,dispose(){record.stopped=true;observer.disconnect();delete window.__CODEX_APPROVED_ART_CHECK__;}};})()`);
  sessions.push(s);
 }
 assert.ok(sessions.length,'A visible already themed window is required');
 const stages=[];
 const targets=['hutao','mitya'];if(targets.at(-1)!==initial)targets.push(initial);
 for(const id of targets){
  await select(id);
  const facts=[];
  for(const s of sessions){
   const fact=await s.evaluate(`(()=>{const icons=window.__CODEX_CHARACTER_ICONS__;return {id:icons?.id,icons:icons?.owned?.size||0,menuId:JSON.parse(window.__CODEX_CHARACTER_SWITCHER__.fingerprint).selectedId,pauseUi:Boolean(document.getElementById('chatgpt-dream-skin-operation')),opening:window.__SANDRONE_OPENING_STATE__?.stage};})()`);
   assert.equal(fact.id,id);assert.equal(fact.menuId,id);assert.ok(fact.icons>0);assert.equal(fact.pauseUi,false);facts.push(fact);
  }
  const deadline=Date.now()+20000;let playing;
  do{playing=(await Promise.all(sessions.map(s=>s.evaluate(`Boolean(window.__SANDRONE_OPENING__)`)))).some(Boolean);if(playing)await sleep(250);}while(playing&&Date.now()<deadline);
  assert.equal(playing,false,'opening finishes after theme readiness');stages.push({id,icons:facts[0].icons});
 }
 const records=await Promise.all(sessions.map(s=>s.evaluate(`window.__CODEX_APPROVED_ART_CHECK__.record`)));
 assert.equal(records.reduce((sum,r)=>sum+r.openings,0),stages.length,'one opening for each switch');
 assert.equal(records.reduce((sum,r)=>sum+r.pauseUi,0),0);assert.equal(records.reduce((sum,r)=>sum+r.unthemedFrames,0),0);
 const after=await managed();assert.equal(after.ownerPid,original.ownerPid);assert.equal(after.browserId,original.browserId);
 const result={pass:true,scope:'live-managed-character-switch',initial,final:current,stages,records,ownerUnchanged:true,browserUnchanged:true,inputsRead:false};
 await fs.writeFile(path.join(root,'evidence/approved-art-live.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{
 if(current!==initial)await select(initial).catch(()=>{});
 for(const s of sessions){try{await s.evaluate(`window.__CODEX_APPROVED_ART_CHECK__?.dispose()`);}catch{}await s.close();}
}
