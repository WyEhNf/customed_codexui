import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {installCharacterSwitcher,removeCharacterSwitcher} from '../integration/embedded-ui.mjs';
import {embeddedConfig} from '../integration/embedded-bridge.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'evidence');await fs.mkdir(out,{recursive:true});
const base=await embeddedConfig(root),browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}),matrix=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<html data-dream-skin="active"><style>body{margin:0;background:#101421;color:#e6edf7;font:14px "Segoe UI"}#sandrone-replay-opening{position:fixed;right:150px;top:5px;height:26px;width:108px}main{position:fixed;left:30px;top:70px;width:900px;height:600px}</style><button id="sandrone-replay-opening">↻ 重播开屏</button><main>内置切换面板 · 离线组件验证</main></html>');
 await page.evaluate(()=>{window.requests=[];window.codexSwitchCharacter=payload=>window.requests.push(JSON.parse(payload));});
 const original=await page.locator('main').boundingBox();
 for(const source of base.characters){
  const presentation=JSON.parse(await fs.readFile(path.join(root,'characters',source.id,'presentation.json'),'utf8'));
  const config={...base,selectedId:source.id,palette:presentation.palette};delete config.notice;
  await page.evaluate(({code,config})=>eval('('+code+')')(config),{code:installCharacterSwitcher.toString(),config});
  assert.equal(await page.locator('#codex-character-switcher').count(),1);
  await page.locator('#codex-character-switcher .trigger').click();
  assert.equal(await page.locator('#codex-character-switcher [data-character]').count(),9);
  assert.equal(await page.locator('#codex-character-switcher [aria-current=true]').getAttribute('data-character'),source.id);
  const trigger=await page.locator('#codex-character-switcher .trigger').boundingBox(),replay=await page.locator('#sandrone-replay-opening').boundingBox();assert.ok(trigger.x+trigger.width<=replay.x-5,'entry leaves original replay and window controls clear');
  for(const target of base.characters){
   const before=await page.evaluate(()=>window.requests.length);
   await page.locator('[data-character="'+target.id+'"]').click();
   const pending=await page.evaluate(()=>window.__CODEX_CHARACTER_SWITCHER__.pending);
   assert.equal(pending.id,target.id);
   // All controls lock until this exact transaction responds; double click cannot duplicate.
   await page.evaluate(id=>document.querySelector('#codex-character-switcher').shadowRoot.querySelector('[data-character="'+id+'"]').click(),target.id);
   assert.equal(await page.evaluate(()=>window.requests.length),before+1);
   assert.equal(await page.locator('#codex-character-switcher .character:disabled').count(),9);
   assert.equal(await page.evaluate(()=>window.__CODEX_CHARACTER_SWITCHER__.settle('wrong-request',{status:'error'})),false);
   await page.evaluate(r=>window.__CODEX_CHARACTER_SWITCHER__.report({...r,status:'ready',message:'切换完成'}),pending);
   assert.equal(await page.locator('#codex-character-switcher .character:disabled').count(),0);
   matrix.push([source.id,target.id]);
  }
  assert.deepEqual(await page.locator('main').boundingBox(),original,'native content does not move');
  if(source.id==='ayaka'){
   await page.locator('#codex-character-switcher .panel').screenshot({path:path.join(out,'embedded-switcher-ayaka.png')});
  }
  await page.keyboard.press('Escape');assert.equal(await page.locator('#codex-character-switcher .panel').isVisible(),false);
  await page.locator('#codex-character-switcher .trigger').click();await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.querySelector('#codex-character-switcher').shadowRoot.activeElement.dataset.character),'sandrone');
  await page.click('main');assert.equal(await page.locator('#codex-character-switcher .panel').isVisible(),false);
 }
 // The original opening remains above the switcher; switching does not spawn a new window.
 assert.equal(browser.contexts().length,1);assert.equal(page.context().pages().length,1);
 for(const width of [780,430,320]){
  await page.setViewportSize({width,height:700});await page.locator('#codex-character-switcher .trigger').click();
  const r=await page.locator('#codex-character-switcher .panel').boundingBox();assert.ok(r.x>=0&&r.x+r.width<=width,'panel fits narrow windows');await page.keyboard.press('Escape');
 }
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>{delete window.codexSwitchCharacter;});await page.locator('#codex-character-switcher .trigger').click();await page.locator('[data-character="mitya"]').click();assert.match(await page.locator('#codex-character-switcher .status').innerText(),/连接/);assert.equal(await page.locator('#codex-character-switcher .character:disabled').count(),0);
 await page.evaluate(()=>window.__CODEX_CHARACTER_SWITCHER__.report({status:'error',message:'模拟失败，已恢复原主题'}));assert.equal(await page.locator('#codex-character-switcher .panel').isVisible(),true);assert.match(await page.locator('#codex-character-switcher .status').innerText(),/恢复/);
 await page.evaluate(code=>eval('('+code+')')(),removeCharacterSwitcher.toString());assert.equal(await page.locator('#codex-character-switcher').count(),0);assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(out,'embedded-switcher-browser.json'),JSON.stringify({pass:true,scope:'offline-component-not-native-app',sourceCharacters:9,destinationCharacters:9,pairs:matrix.length,matrix,geometryUnchanged:true,keyboard:true,narrowWindows:true,doubleClickGuard:true,missingBridge:true,restoreCleanup:true,browserErrors:errors},null,2));
 console.log('PASS: all 81 in-window character routes, lock/retry, keyboard, narrow windows, no content movement, cleanup');
}finally{await browser.close();}
