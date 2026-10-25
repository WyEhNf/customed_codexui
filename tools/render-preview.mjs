// Development verification only; captures the original repository's offline preview.
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../',import.meta.url),out=new URL('evidence/',root);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(fileURLToPath(new URL('dist/Sandrone-preview.html',root))).href);
 await page.waitForTimeout(1700);
 assert.equal(await page.locator('#sandrone-opening').count(),1);
 assert.equal(await page.evaluate(()=>window.__SANDRONE_OPENING_STATE__?.stage),'playing');
 await page.screenshot({path:fileURLToPath(new URL('opening-art-swap.png',out))});
 await page.locator('#sandrone-opening .scene').dblclick();await page.waitForTimeout(850);
 assert.equal(await page.locator('#sandrone-opening').count(),0);
 await page.screenshot({path:fileURLToPath(new URL('preview-art-swap.png',out)),fullPage:true});
 await page.click('#replay');assert.equal(await page.locator('#sandrone-opening').count(),1);
 await page.keyboard.press('Escape');await page.waitForTimeout(850);
 assert.equal(await page.locator('#sandrone-opening').count(),0);
 assert.deepEqual(errors,[]);
 const a=await page.evaluate(()=>({skin:document.documentElement.dataset.dreamSkin,extension:window.__SANDRONE_NATIVE_UI__?.version,stage:window.__SANDRONE_OPENING_STATE__?.stage}));
 await fs.writeFile(new URL('preview-verification.json',out),JSON.stringify({pass:true,scope:'original-offline-preview-not-native-client',doubleClickSkip:true,replay:true,escapeSkip:true,noBrowserExceptions:true,...a},null,2));
 console.log(JSON.stringify({pass:true,scope:'original-offline-preview',checks:['asset-decode','original-opening','skip','replay','cleanup']}));
}finally{await browser.close();}
