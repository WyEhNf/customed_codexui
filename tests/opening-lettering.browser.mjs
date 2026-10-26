import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {validateLettering} from '../engine/assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const ids=['columbina','ayaka','hutao','nahida','furina','citlali','mitya','istaroth','sandrone'];
const templateMode=process.argv.includes('--template');
const evidence=path.join(root,'evidence/opening-lettering');await fs.mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'}),results=[],errors=[];
const invoke=(page,code,assets)=>page.evaluate(({code,assets})=>eval('('+code+')')(assets),{code,assets});
const inspect=()=>{const s=document.getElementById('sandrone-opening').shadowRoot;return {rects:Object.fromEntries(['.brand','.brand span','.copy','.label','.title','.sub','.rule','.cn','.bottom','.status','.track','.hint','.footer'].map(k=>[k,s.querySelector(k).getBoundingClientRect().toJSON()])),marks:Object.fromEntries(['.brand span','.label','.sub','.cn','.status','.hint'].map(k=>{const e=s.querySelector(k);return [k,{text:e.textContent,art:e.classList.contains('art-lettering'),viewBox:e.querySelector('svg')?.getAttribute('viewBox'),paths:e.querySelectorAll('svg path').length}];})),signature:s.querySelectorAll('.signature-title path').length};};
try{
 for(const id of ids){
  const pack=path.join(root,'characters',id),meta=JSON.parse(await fs.readFile(path.join(pack,'presentation.json'),'utf8'));
  const raw=JSON.parse(await fs.readFile(path.join(pack,'assets/branding/opening-lettering.json'),'utf8')),lettering=validateLettering(raw);
  const helper=await import(pathToFileURL(path.join(pack,'engine/assets.mjs'))+'?t='+Date.now());
  const assets={...await helper.openingAssets(),lettering};
  let code=(await import(pathToFileURL(path.join(root,templateMode?'integration/templates/renderer.mjs':`characters/${id}/engine/renderer.mjs`))+'?t='+Date.now())).showOpening.toString();
  if(templateMode){const changes={'桑多涅':meta.name,'THE MARIONETTE WORKSHOP':meta.themeName.toUpperCase()+' · '+meta.brandName.toUpperCase(),'FATUI / NO. 007':meta.subtitle,'SANDRONE</h1>':meta.brandName.toUpperCase()+'</h1>','>MARIONETTE<':'>'+meta.themeName+'<',"'Sandrone'":"'"+meta.brandName+"'",'解算开始。':meta.loadingStates[0],'填入变量。':meta.loadingStates[1],'进程良好。':meta.loadingStates[2],'析构万理！啊哈哈哈...':meta.loadingStates[3]};for(const [a,b]of Object.entries(changes))code=code.replaceAll(a,b);}
  const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<html data-dream-skin="active"><body><textarea data-ds-part="composer"></textarea></body></html>');await page.evaluate(()=>{window.__SANDRONE_STARTUP__={phase:'connecting'};});
  await invoke(page,code,{...assets,lettering:null});await page.evaluate(()=>document.fonts.ready);const before=await page.evaluate(inspect);await page.evaluate(()=>window.__SANDRONE_OPENING__.dispose('test'));
  await invoke(page,code,assets);const after=await page.evaluate(inspect);
  assert.deepEqual(after.rects,before.rects,id+' lettering must preserve original opening container geometry');
  for(const mark of Object.values(after.marks)){assert.ok(mark.art&&mark.paths>0,id+' filled art outline is installed');assert.ok(mark.viewBox,'Outline has bounded canvas');}
  assert.equal(after.marks['.cn'].text,'CodeX');assert.equal(after.marks['.sub'].text,meta.themeName);assert.ok(after.signature>0,id+' original English signature preserved');
  for(const phase of ['applying','waiting','ready','error']){await page.evaluate(phase=>window.__SANDRONE_OPENING__.setPhase(phase),phase);await page.waitForTimeout(170);const status=await page.evaluate(()=>{const e=document.getElementById('sandrone-opening').shadowRoot.querySelector('.status');return {text:e.textContent,art:e.querySelectorAll('svg path').length,role:e.getAttribute('aria-live')};});assert.equal(status.text,lettering.entries[phase].text,id+' exact '+phase+' message');assert.ok(status.art>0,id+' dynamic '+phase+' artistic glyph');assert.equal(status.role,'polite');}
  await page.screenshot({path:path.join(evidence,id+'-opening.png')});await context.close();
  results.push({id,geometryUnchanged:true,exactChinese:true,codeXArtwork:true,englishSignature:true,dynamicArtStates:4,bytes:(await fs.stat(path.join(pack,'assets/branding/opening-lettering.json'))).size});
 }
 const invalid=JSON.parse(await fs.readFile(path.join(root,'characters/columbina/assets/branding/opening-lettering.json'),'utf8'));
 const tampered=structuredClone(invalid);tampered.entries.cn.path='M0,0 L1,1 url(https://example.com)';tampered.geometrySha256=createHash('sha256').update(JSON.stringify(tampered.entries)).digest('hex');assert.throws(()=>validateLettering(tampered),/glyph/);
 const outside=structuredClone(invalid);outside.entries.cn.path='M0,0L99999,1Z';outside.geometrySha256=createHash('sha256').update(JSON.stringify(outside.entries)).digest('hex');assert.throws(()=>validateLettering(outside),/canvas/);
 const extra=structuredClone(invalid);extra.entries.unexpected=extra.entries.cn;assert.throws(()=>validateLettering(extra));
 const small=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await small.newPage();await page.setContent('<html><body></body></html>');const assetsModule=await import(pathToFileURL(path.join(root,'characters/columbina/engine/assets.mjs')));const assets={...await assetsModule.openingAssets(),lettering:validateLettering(invalid)};const code=(await import(pathToFileURL(path.join(root,'integration/templates/renderer.mjs')))).showOpening.toString();await invoke(page,code,assets);const visible=await page.evaluate(()=>{const s=document.getElementById('sandrone-opening').shadowRoot,c=s.querySelector('.cn'),g=c.querySelector('svg');return g.getBoundingClientRect().width<=c.getBoundingClientRect().width+.1&&g.getBoundingClientRect().height<=c.getBoundingClientRect().height+.1;});assert.ok(visible,'Art CodeX fits narrow viewport');await small.close();
 const normal=await browser.newContext({viewport:{width:1440,height:900}}),normalPage=await normal.newPage();await normalPage.setContent('<html><body></body></html>');await invoke(normalPage,code,assets);await normalPage.waitForFunction(()=>window.__SANDRONE_OPENING_STATE__.video==='playing');await normalPage.evaluate(()=>document.getElementById('sandrone-opening').shadowRoot.querySelector('.motion').dispatchEvent(new Event('error')));assert.equal(await normalPage.evaluate(()=>document.getElementById('sandrone-opening').shadowRoot.querySelector('.cn .lettering-surface')!==null),true,'Art lettering survives movie fallback');await normalPage.keyboard.press('Escape');await normalPage.waitForFunction(()=>!document.getElementById('sandrone-opening'));await normal.close();
 assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(evidence,'browser-results.json'),JSON.stringify({pass:true,scope:templateMode?'new renderer template plus actual production text/assets':'actual built production packs',characters:results,fontsEmbedded:false,originalGeometryPreserved:true,invalidMarkupRejected:true,narrowViewport:true,normalAndReducedAndVideoError:true,browserErrors:errors},null,2));
 console.log('PASS: nine artistic Chinese/CodeX openings retain exact geometry, English signature, dynamic status, fallback and narrow sizing');
}finally{await browser.close();}
