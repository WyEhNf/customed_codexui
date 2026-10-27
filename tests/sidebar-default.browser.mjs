// Native sidebar semantics in an isolated browser; no profile or live UI.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {installDefaultSidebar,removeDefaultSidebar} from '../engine/sidebar-default.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});
const invoke=(page,fn)=>page.evaluate(code=>eval('('+code+')')(),fn.toString());
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const fixture=async({expanded=false,label='显示侧边栏',late=false}={})=>{
  await page.setContent('<html data-dream-skin="active"><style>body{margin:0}aside{position:fixed;top:36px;bottom:0;left:0;width:52px}main{position:fixed;top:36px;left:52px;right:0;bottom:0}.expanded aside{width:373px}.expanded main{left:373px}button{width:32px;height:28px}</style><body><header id="header"></header><aside id="app-shell-sidebar"></aside><main><textarea>preserved draft</textarea><button aria-label="项目侧边栏选项" aria-expanded="false">options</button></main></body></html>');
  await page.evaluate(({expanded,label,late})=>{
   window.sidebarClicks=0;document.documentElement.classList.toggle('expanded',expanded);
   window.mountToggle=()=>{const button=document.createElement('button');button.id='toggle';button.setAttribute('aria-controls','app-shell-sidebar');button.setAttribute('aria-expanded',String(expanded));button.setAttribute('aria-label',label);button.onclick=()=>{window.sidebarClicks++;const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'隐藏侧边栏':'显示侧边栏');document.documentElement.classList.toggle('expanded',open);};document.querySelector('header').append(button);};
   if(!late)window.mountToggle();
  },{expanded,label,late});
 };
 await fixture();assert.equal(await invoke(page,installDefaultSidebar),'opened');
 assert.equal(await page.locator('#toggle').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('main').evaluate(node=>node.getBoundingClientRect().left),373,'native handler reserves sidebar width');
 await page.locator('#toggle').click();for(let i=0;i<20;i++)await invoke(page,installDefaultSidebar);
 await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.sidebarClicks),2,'manual collapse is never fought by idle/theme reapply');
 assert.equal(await page.locator('#toggle').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator('textarea').inputValue(),'preserved draft');
 await invoke(page,removeDefaultSidebar);assert.equal(await page.evaluate(()=>Boolean(window.__CODEX_SIDEBAR_DEFAULT__)),false);
 await fixture({expanded:true,label:'Hide sidebar'});assert.equal(await invoke(page,installDefaultSidebar),'already-open');assert.equal(await page.evaluate(()=>window.sidebarClicks),0,'already expanded sidebar is untouched');await invoke(page,removeDefaultSidebar);
 await fixture({late:true,label:'Show sidebar'});assert.equal(await invoke(page,installDefaultSidebar),'waiting');assert.equal(await page.evaluate(()=>window.sidebarClicks),0,'unrelated sidebar options are ignored');await page.evaluate(()=>window.mountToggle());await page.waitForFunction(()=>window.sidebarClicks===1);await invoke(page,removeDefaultSidebar);
 await fixture();await page.locator('#toggle').evaluate(node=>node.disabled=true);assert.equal(await invoke(page,installDefaultSidebar),'waiting');await page.locator('#toggle').evaluate(node=>node.disabled=false);await page.waitForFunction(()=>window.sidebarClicks===1);await invoke(page,removeDefaultSidebar);
 await fixture();await page.locator('#toggle').evaluate(node=>{node.removeAttribute('aria-controls');node.removeAttribute('aria-expanded');});assert.equal(await invoke(page,installDefaultSidebar),'opened','exact localized label supports native versions without expanded state');await invoke(page,removeDefaultSidebar);
 await fixture({late:true});await invoke(page,installDefaultSidebar);await invoke(page,removeDefaultSidebar);await page.evaluate(()=>window.mountToggle());await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.sidebarClicks),0,'restore cancels pending startup work');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,nativeSidebarDefaultOpen:true,mainReservesSidebar:true,manualCollapseRetained:true,lateMount:true,localizedLabels:true,unrelatedMenusUntouched:true,cleanup:true}));
}finally{await browser.close();}
