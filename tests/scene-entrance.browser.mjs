import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url);
let playwright;try{playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch(error){if(process.env.PLAYWRIGHT_MODULE)throw error;playwright=require('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const evidence=path.join(root,'evidence/scene-entrance');await fs.mkdir(evidence,{recursive:true});
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
const browser=await playwright.chromium.launch({headless:true,channel:'msedge'}),report={pass:false,characters:[],errors:[]};
const invoke=(page,fn,...args)=>page.evaluate(({code,args})=>eval('('+code+')')(...args),{code:fn.toString(),args});
const load=async id=>{const pack=path.join(root,'characters',id);return {assets:await(await import(pathToFileURL(path.join(pack,'engine/assets.mjs')).href)).openingAssets(),renderer:await import(pathToFileURL(path.join(pack,'engine/renderer.mjs')).href)};};
const sample=page=>page.evaluate(()=>{const s=document.getElementById('sandrone-opening').shadowRoot,frame=s.querySelector('.scene-intro-frame'),svg=frame?.querySelector('svg'),movie=s.querySelector('.motion'),matrix=svg?.getScreenCTM();return {intro:window.__SANDRONE_OPENING_STATE__.sceneIntro,video:window.__SANDRONE_OPENING_STATE__.video,time:movie.currentTime,source:movie.getAttribute('src')!==null,posterOpacity:Number(getComputedStyle(s.querySelector('.motion-poster')).opacity),movieOpacity:Number(getComputedStyle(movie).opacity),blurOpacity:Number(getComputedStyle(s.querySelector('.scene'),'::before').opacity),svg:svg?{viewBox:svg.getAttribute('viewBox'),aspect:svg.getAttribute('preserveAspectRatio'),matrix:{a:matrix.a,d:matrix.d,e:matrix.e,f:matrix.f}}:null,oldSeal:!!s.querySelector('.entrance-seal'),frameOpacity:frame?Number(getComputedStyle(frame).opacity):null,rotors:s.querySelectorAll('.scene-time-rotor').length,generic:['.gear','.iris','.orbit','.grain'].map(k=>getComputedStyle(s.querySelector(k)).display)};});
const fixture=async options=>{const context=await browser.newContext({viewport:{width:1440,height:900},...options}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.setContent('<html data-dream-skin="active"><body><textarea data-ds-part="composer">retained draft</textarea></body></html>');await page.evaluate(()=>{window.native=document.querySelector('textarea');window.__SANDRONE_STARTUP__={phase:'connecting'};});return {context,page};};
try{
 for(const c of catalog.characters){
  const {assets,renderer}=await load(c.id),{context,page}=await fixture();
  await invoke(page,renderer.showOpening,assets);await page.waitForTimeout(350);
  const early=await sample(page);assert.equal(early.oldSeal,false,'no detached material medallion');
  await page.screenshot({path:path.join(evidence,c.id+'-01-environment.png')});
  if(c.id==='sandrone'){
   assert.equal(early.svg,null);assert.equal(await page.locator('#sandrone-opening').evaluate(h=>h.shadowRoot.querySelector('.scene').classList.contains('trace-intro')),true);
   await page.waitForTimeout(1000);await page.screenshot({path:path.join(evidence,c.id+'-02-outline.png')});await page.waitForTimeout(2200);await page.screenshot({path:path.join(evidence,c.id+'-03-color.png')});
  }else{
   assert.ok(assets.sceneIntro&&!assets.sceneIntroFallback,c.id+' loader validates actual source contours');
   assert.equal(early.intro.id,c.id);assert.equal(early.intro.phase,'outline');assert.equal(early.svg.viewBox,'0 0 1920 1080');assert.equal(early.svg.aspect,'xMidYMid meet');
   assert.equal(early.movieOpacity,0);assert.equal(early.posterOpacity,0);assert.equal(early.blurOpacity,0,'no colored face or blurred person before tracing');assert.ok(early.generic.every(v=>v==='none'));
   assert.equal(early.rotors,c.id==='istaroth'?1:0,c.id+' rotation belongs only to time ring');
   await page.waitForTimeout(1000);const outline=await sample(page);assert.equal(outline.intro.phase,'outline');assert.ok(outline.time>.05,'same color source is already playing hidden');await page.screenshot({path:path.join(evidence,c.id+'-02-outline.png')});
   await page.waitForFunction(()=>window.__SANDRONE_OPENING_STATE__.sceneIntro?.phase==='color');await page.waitForTimeout(1250);const color=await sample(page);assert.ok(color.intro.revealAtMs>=2100);assert.ok(color.movieOpacity>.95);assert.ok(color.time>outline.time,'color reveal never restarts video');assert.equal(color.frameOpacity,0);await page.screenshot({path:path.join(evidence,c.id+'-03-color.png')});
   for(const [width,height]of [[1440,900],[1800,800],[850,1000]]){
    await page.setViewportSize({width,height});const state=await sample(page),scale=Math.min(width/1920,height/1080),expected={a:scale,d:scale,e:(width-1920*scale)/2,f:(height-1080*scale)/2};
    for(const key of Object.keys(expected))assert.ok(Math.abs(state.svg.matrix[key]-expected[key])<.1,c.id+' aligned '+key+' at '+width+'x'+height);
   }
   report.characters.push({id:c.id,kind:early.intro.kind,sourceMapped:true,revealAtMs:color.intro.revealAtMs,continuousClock:true,uniformAlignmentAtThreeRatios:true,rotorOnlyForTime:c.id==='istaroth'});
  }
  assert.equal(await page.evaluate(()=>document.querySelector('textarea')===window.native&&window.native.value==='retained draft'),true);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('sandrone-opening'));await context.close();
 }
 const {assets,renderer}=await load('columbina');
 assert.ok(assets.sceneIntro&&!assets.sceneIntroFallback,'fallback fixtures use the final source-bound contours');
 for(const mode of ['reduced','decode-error','early-skip','missing-contours']){
  const {context,page}=await fixture(mode==='reduced'?{reducedMotion:'reduce'}:{}),input=structuredClone(assets);if(mode==='missing-contours')delete input.sceneIntro;
  await invoke(page,renderer.showOpening,input);
  if(mode==='reduced'){await page.waitForFunction(()=>getComputedStyle(document.getElementById('sandrone-opening').shadowRoot.querySelector('.motion-poster')).opacity==='1');const s=await sample(page);assert.equal(s.svg,null);assert.equal(s.source,false);assert.equal(s.posterOpacity,1);}
  if(mode==='decode-error'){await page.locator('#sandrone-opening').evaluate(h=>h.shadowRoot.querySelector('.motion').dispatchEvent(new Event('error')));await page.waitForFunction(()=>window.__SANDRONE_OPENING_STATE__.sceneIntro?.phase==='color');await page.waitForTimeout(1250);const s=await sample(page);assert.equal(s.video,'fallback');assert.equal(s.posterOpacity,1);assert.equal(s.source,false);}
  if(mode==='early-skip'){await page.evaluate(()=>window.oldVideo=document.getElementById('sandrone-opening').shadowRoot.querySelector('.motion'));await page.keyboard.press('Escape');await page.waitForTimeout(2300);assert.equal(await page.locator('#sandrone-opening').count(),0);assert.deepEqual(await page.evaluate(()=>({paused:oldVideo.paused,src:oldVideo.getAttribute('src')})),{paused:true,src:null});}
  if(mode==='missing-contours'){await page.waitForTimeout(500);const s=await sample(page);assert.equal(s.svg,null);assert.equal(s.oldSeal,false);assert.ok(s.generic.every(v=>v==='none'));}
  await invoke(page,renderer.removeNativeUi);await context.close();report[mode]=true;
 }
 assert.deepEqual(report.errors,[]);report.pass=true;console.log(JSON.stringify({pass:true,sourceSceneEntrances:8,originalSandrone:true,threeAspectRatios:true,reduced:true,decodeFallback:true,skip:true,browserErrors:0}));
}finally{await browser.close();await fs.writeFile(path.join(evidence,'browser-results.json'),JSON.stringify(report,null,2)+'\n');}
