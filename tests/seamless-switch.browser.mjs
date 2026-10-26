// Exercise the original upstream renderer + opening across real artwork packs.
// This is an offline browser fixture, not a test of the user's native app.
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadPayload} from '../vendor/dream-skin/windows/scripts/injector.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});
const invoke=(page,fn,...args)=>page.evaluate(({code,args})=>eval('('+code+')')(...args),{code:fn.toString(),args});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],transitions=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<html><body><main role="main"><h1>原渲染器热替换测试</h1><textarea aria-label="测试输入框">保留的草稿</textarea><button>测试按钮</button></main></body></html>');
 const first=await loadPayload(path.join(root,'characters/columbina/themes/sandrone'));
 await page.evaluate(code=>eval(code),first.payload);
 const initial=await import(pathToFileURL(path.join(root,'characters/columbina/engine/renderer.mjs')).href);
 await invoke(page,initial.installNativeUi,await fs.readFile(path.join(root,'characters/columbina/engine/native-ui.css'),'utf8'));
 await page.evaluate(()=>{
  window.__draft=document.querySelector('textarea');window.__frames={count:0,unthemed:0,pause:0};window.__openingCount=0;
  new MutationObserver(rs=>{for(const r of rs)for(const node of r.addedNodes)if(node.id==='sandrone-opening')window.__openingCount++;}).observe(document.documentElement,{childList:true});
  const frame=()=>{window.__frames.count++;if(document.documentElement.getAttribute('data-dream-skin')!=='active')window.__frames.unthemed++;if(document.getElementById('chatgpt-dream-skin-operation'))window.__frames.pause++;requestAnimationFrame(frame);};requestAnimationFrame(frame);
 });
 let previous=first.revision;
 for(const id of ['ayaka','hutao','nahida','furina','citlali','mitya','istaroth','sandrone','columbina']){
  const pack=path.join(root,'characters',id),loaded=await loadPayload(path.join(pack,'themes/sandrone'));
  const renderer=await import(pathToFileURL(path.join(pack,'engine/renderer.mjs')).href);
  const {openingAssets}=await import(pathToFileURL(path.join(pack,'engine/assets.mjs')).href);
  // Staging and watcher replacement leave the old theme installed throughout.
  await page.waitForTimeout(60);assert.equal(await page.evaluate(()=>window.__CODEX_DREAM_SKIN_STATE__.revision),previous);
  await invoke(page,renderer.setStartupPhase,'connecting');
  const shown=await invoke(page,renderer.showOpening,await openingAssets());assert.equal(shown.shown,true);
  assert.equal(await page.locator('#sandrone-opening').count(),1,'one opening covers theme replacement');
  await page.evaluate(code=>eval(code),loaded.payload);
  await invoke(page,renderer.installNativeUi,await fs.readFile(path.join(pack,'engine/native-ui.css'),'utf8'));
  await invoke(page,renderer.setStartupPhase,'ready');await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__CODEX_DREAM_SKIN_STATE__.revision),loaded.revision);
  assert.equal(await page.evaluate(()=>document.querySelector('textarea')===window.__draft&&window.__draft.value==='保留的草稿'),true);
  assert.equal(await page.locator('#chatgpt-dream-skin-operation').count(),0,'upstream pause UI is never created');
  await page.evaluate(()=>window.__SANDRONE_OPENING__.dispose('test-skip'));
  transitions.push(id);previous=loaded.revision;
 }
 const frames=await page.evaluate(()=>({...window.__frames,openings:window.__openingCount}));
 assert.equal(frames.unthemed,0);assert.equal(frames.pause,0);assert.equal(frames.openings,9);assert.ok(frames.count>9);assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(root,'evidence/seamless-switch-browser.json'),JSON.stringify({pass:true,scope:'original-renderer-offline-fixture',transitions,frames,draftPreserved:true,browserErrors:errors},null,2));
 console.log(JSON.stringify({pass:true,transitions:9,...frames,draftPreserved:true}));
}finally{await browser.close();}
