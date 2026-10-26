import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'evidence');await fs.mkdir(out,{recursive:true});
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
assert.ok(!catalog.characters.some(c=>c.id==='durin'));assert.equal(catalog.characters.length,9);
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'}),results=[];
try{
 for(const c of catalog.characters){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__openingCount=0;new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.id==='sandrone-opening')window.__openingCount++;}).observe(document,{childList:true,subtree:true});});
  await page.goto(pathToFileURL(path.join(root,c.path,'preview.html')).href);await page.waitForTimeout(2650);
  assert.equal(await page.locator('#sandrone-opening').count(),1,c.id+' opening exists');
  assert.equal(await page.evaluate(()=>window.__openingCount),1,c.id+' one initial opening');
  const paths=await page.locator('#sandrone-opening .signature-title path').count();assert.ok(paths>=1&&paths<=12,c.id+' cursive SVG is loaded');
  await page.screenshot({path:path.join(out,c.id+'-opening.png')});
  await page.keyboard.press('Escape');await page.waitForTimeout(820);assert.equal(await page.locator('#sandrone-opening').count(),0);
  await page.click('#replay');assert.equal(await page.locator('#sandrone-opening').count(),1);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>window.__openingCount),2,'manual replay adds exactly one opening');
  await page.keyboard.press('Escape');await page.waitForTimeout(820);assert.equal(await page.locator('#sandrone-opening').count(),0);
  assert.deepEqual(errors,[]);results.push({id:c.id,openingCount:1,manualReplayCount:1,cursivePaths:paths,skip:true,browserErrors:0});await page.close();console.log('PASS browser '+c.id);
 }
 const page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'reduce'});await page.goto(pathToFileURL(path.join(root,'characters/columbina/preview.html')).href);await page.waitForTimeout(6000);assert.equal(await page.locator('#sandrone-opening').count(),0);await page.close();
 await fs.writeFile(path.join(out,'characters-browser.json'),JSON.stringify({pass:true,scope:'original-renderer-offline-previews-not-live-Codex',reducedMotion:true,characters:results},null,2));
 console.log(JSON.stringify({pass:true,characters:results.length,reducedMotion:true}));
}finally{await browser.close();}
