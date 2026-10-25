import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
try{
 for(const id of ['mitya','citlali']){
  const pack=path.join(root,'characters',id),{openingAssets}=await import(pathToFileURL(path.join(pack,'engine/assets.mjs'))),{showOpening}=await import(pathToFileURL(path.join(pack,'engine/renderer.mjs')));const assets=await openingAssets();
  for(const viewport of [{width:1920,height:1032},{width:2560,height:1080}]){
   const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage();await page.setContent('<html data-dream-skin="active"><body><textarea data-ds-part="composer"></textarea></body></html>');
   await page.evaluate(({code,assets})=>eval('('+code+')')(assets,{preview:true}),{code:showOpening.toString(),assets});
   const metrics=await page.evaluate(()=>{const s=document.getElementById('sandrone-opening').shadowRoot,p=s.querySelector('.motion-poster');return {fit:getComputedStyle(p).objectFit,movieFit:getComputedStyle(s.querySelector('.motion')).objectFit,poster:p.src.startsWith('data:image/jpeg'),backdrop:getComputedStyle(s.querySelector('.scene'),'::before').backgroundImage.startsWith('url(')};});
   assert.deepEqual(metrics,{fit:'contain',movieFit:'contain',poster:true,backdrop:true},id+' entire approved frame survives wide app viewports');
   results.push({id,viewport,...metrics});await context.close();
  }
 }
}finally{await browser.close();}
await fs.mkdir(path.join(root,'evidence/release-qa'),{recursive:true});await fs.writeFile(path.join(root,'evidence/release-qa/opening-aspect.json'),JSON.stringify({pass:true,results},null,2));console.log('PASS: complete Mitya/Citlali scene retained at desktop and ultrawide aspect ratios');
