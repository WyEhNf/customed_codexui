// Actual production openings in an isolated browser; no live app or profile.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);let playwright;
try{playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch(error){if(process.env.PLAYWRIGHT_MODULE)throw error;playwright=require('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const {chromium}=playwright;
const evidence=path.join(root,'evidence/entrance');await fs.mkdir(evidence,{recursive:true});
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
const browser=await chromium.launch({headless:true,channel:'msedge'}),report={pass:false,characters:[],errors:[]};
const invoke=(page,fn,...args)=>page.evaluate(({code,args})=>eval('('+code+')')(...args),{code:fn.toString(),args});
const sample=page=>page.evaluate(()=>{const s=document.getElementById('sandrone-opening').shadowRoot,css=k=>{const n=s.querySelector(k);return n?{opacity:getComputedStyle(n).opacity,transform:getComputedStyle(n).transform,iteration:getComputedStyle(n).animationIterationCount}:null;};return {entrance:window.__SANDRONE_OPENING_STATE__.entrance,video:window.__SANDRONE_OPENING_STATE__.video,time:s.querySelector('video.motion').currentTime,seal:css('.entrance-seal'),rotor:css('.seal-rotor'),poster:css('.motion-poster'),motion:css('.motion'),blur:getComputedStyle(s.querySelector('.scene'),'::before').opacity,ornament:s.querySelector('.seal-material')?.getAttribute('href'),source:!!s.querySelector('video.motion').getAttribute('src')};});
try{
 for(const c of catalog.characters){
  const pack=path.join(root,c.path),assets=await(await import(pathToFileURL(path.join(pack,'engine/assets.mjs')).href)).openingAssets(),renderer=await import(pathToFileURL(path.join(pack,'engine/renderer.mjs')).href);
  const material=JSON.parse(await fs.readFile(path.join(pack,'assets/ui/personality.json'),'utf8'));
  assert.equal(assets.entrance.id,c.id);assert.equal(assets.entrance.ornament,material.ornament);
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.setContent('<html data-dream-skin="active"><body><textarea data-ds-part="composer">retained draft</textarea></body></html>');
  await page.evaluate(()=>{window.native=document.querySelector('textarea');window.__SANDRONE_STARTUP__={phase:'connecting'};});
  await invoke(page,renderer.showOpening,assets);await page.waitForTimeout(200);const first=await sample(page);
  if(c.id==='sandrone'){
   assert.equal(first.entrance,undefined,'Sandrone retains its original gear/trace sequence');assert.equal(first.seal,null);assert.equal(await page.locator('#sandrone-opening').evaluate(h=>h.shadowRoot.querySelector('.scene').classList.contains('trace-intro')),true);
  }else{
   assert.equal(first.entrance.id,c.id);assert.equal(first.entrance.phase,'material');assert.equal(first.ornament,material.ornament);assert.equal(first.rotor.iteration,'1');assert.equal(first.time,0,'movie cannot play before emblem entrance');
   assert.equal(first.poster.opacity,'0');assert.equal(first.motion.opacity,'0');assert.equal(first.blur,'0','blurred scene must not reveal the person early');
   await page.waitForTimeout(300);const turned=await sample(page);assert.notEqual(turned.rotor.transform,first.rotor.transform,'material actually rotates');
   if(['columbina','hutao','mitya'].includes(c.id))await page.screenshot({path:path.join(evidence,c.id+'-1-material.png')});
   await page.waitForFunction(()=>window.__SANDRONE_OPENING_STATE__.entrance?.phase==='scene');
   const reveal=await sample(page);assert.ok(reveal.entrance.revealedAtMs>=1200,'scene waits for material turn');
   await page.waitForTimeout(1250);const visible=await sample(page);assert.equal(visible.seal.opacity,'0');assert.ok(Number(visible.motion.opacity)>.95);assert.ok(visible.time>0,'real movie advances after reveal');
   assert.equal(await page.locator('#sandrone-opening').evaluate(h=>h.shadowRoot.querySelector('.seal-material').getAttribute('preserveAspectRatio')),'xMidYMid meet');
   if(['columbina','hutao','mitya'].includes(c.id))await page.screenshot({path:path.join(evidence,c.id+'-2-scene.png')});
   report.characters.push({id:c.id,motif:first.entrance.motif,revealedAtMs:reveal.entrance.revealedAtMs,singleRotation:true,noEarlyPerson:true,sceneVideo:true});
  }
  assert.equal(await page.evaluate(()=>document.querySelector('textarea')===window.native&&window.native.value==='retained draft'),true);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('sandrone-opening'));await context.close();
 }
 const pack=path.join(root,'characters/columbina'),assets=await(await import(pathToFileURL(path.join(pack,'engine/assets.mjs')).href)).openingAssets(),renderer=await import(pathToFileURL(path.join(pack,'engine/renderer.mjs')).href);
 for(const mode of ['reduced','decode-error','early-skip']){
  const context=await browser.newContext({viewport:{width:1440,height:900},...(mode==='reduced'?{reducedMotion:'reduce'}:{})}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.setContent('<html data-dream-skin="active"><body><textarea data-ds-part="composer"></textarea></body></html>');await invoke(page,renderer.showOpening,assets);
  if(mode==='reduced'){await page.waitForFunction(()=>getComputedStyle(document.getElementById('sandrone-opening').shadowRoot.querySelector('.motion-poster')).opacity==='1');const s=await sample(page);assert.equal(s.seal,null);assert.equal(s.source,false);assert.equal(s.poster.opacity,'1');}
  if(mode==='decode-error'){await page.locator('#sandrone-opening').evaluate(h=>h.shadowRoot.querySelector('video.motion').dispatchEvent(new Event('error')));await page.waitForFunction(()=>window.__SANDRONE_OPENING_STATE__.entrance?.phase==='scene');await page.waitForTimeout(1250);const s=await sample(page);assert.equal(s.video,'fallback');assert.equal(s.poster.opacity,'1');assert.equal(s.source,false);}
  if(mode==='early-skip'){await page.evaluate(()=>window.oldVideo=document.getElementById('sandrone-opening').shadowRoot.querySelector('video.motion'));await page.keyboard.press('Escape');await page.waitForTimeout(1600);assert.equal(await page.locator('#sandrone-opening').count(),0);assert.deepEqual(await page.evaluate(()=>({paused:oldVideo.paused,src:oldVideo.getAttribute('src')})),{paused:true,src:null});}
  await invoke(page,renderer.removeNativeUi);await context.close();report[mode]=true;
 }
 assert.deepEqual(report.errors,[]);report.pass=true;console.log(JSON.stringify({pass:true,themedEntrances:8,originalSandrone:true,earlySkip:true,reduced:true,decodeFallback:true,errors:0}));
}finally{await browser.close();await fs.writeFile(path.join(evidence,'verification.json'),JSON.stringify(report,null,2)+'\n');}
