// Real browser CDP regression, isolated from the installed app and its profile.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createNativeViewportReset} from '../engine/native-viewport.mjs';
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try{
 // Playwright's ordinary viewport is itself a device override. Start from the
 // browser's actual native window to test the correct post-reset dimensions.
 const context=await browser.newContext({viewport:null}),page=await context.newPage();
 await page.setContent('<html><body><textarea>retained fixture draft</textarea></body></html>');
 const cdp=await context.newCDPSession(page),before=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1032,deviceScaleFactor:2,mobile:false});
 await cdp.send('Emulation.setFocusEmulationEnabled',{enabled:true});
 await cdp.send('Page.startScreencast',{format:'jpeg',maxWidth:800,maxHeight:600,everyNthFrame:1});
 assert.deepEqual(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),{width:1920,height:1032,dpr:2});
 const reset=createNativeViewportReset();await reset.prepare('main',cdp);
 // CDP acknowledges the reset before Chromium commits its resize frame.
 await page.waitForFunction(({width,height,dpr})=>innerWidth===width&&innerHeight===height&&devicePixelRatio===dpr,before);
 assert.deepEqual(await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),before,'native logical viewport and monitor scaling restored after canceled recording');
 const samples=[];
 for(let i=0;i<20;i++){
  assert.equal(await reset.prepare('main',cdp),false);
  samples.push(await page.evaluate(()=>[innerWidth,innerHeight,devicePixelRatio,visualViewport.scale]));
  await page.waitForTimeout(40);
 }
 assert.equal(new Set(samples.map(JSON.stringify)).size,1,'no full-view/top-left scale oscillation during watcher-style idle passes');
 assert.equal(await page.locator('textarea').inputValue(),'retained fixture draft');
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1024,height:700,deviceScaleFactor:1,mobile:false});
 assert.equal(await reset.prepare('main',cdp),false);
 assert.equal(await page.evaluate(()=>innerWidth),1024,'a new deliberate recording is not repeatedly overridden');
 await cdp.send('Emulation.clearDeviceMetricsOverride');await context.close();
 console.log('PASS: real CDP recording/emulated-DPI recovery; stable native viewport; later recordings and draft preserved');
}finally{await browser.close();}
