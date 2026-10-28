// Isolated native-structure scroll tests; no live conversations or profile.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {installThreadTail,removeThreadTail} from '../engine/thread-tail.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});
const invoke=(page,fn)=>page.evaluate(code=>eval('('+code+')')(),fn.toString());
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push(error.message));
 const fixture=async({rows=30,nativeButton=false}={})=>{
  await invoke(page,removeThreadTail);
  await page.setContent(`<!doctype html><html data-dream-skin="active"><style>body{margin:0;min-height:2000px}[data-app-shell-active-page="false"]{display:none}aside{position:fixed;left:0;top:30px;width:200px;height:600px;overflow:auto}main{position:fixed;left:240px;top:30px;width:900px;height:650px}.layout{position:relative}.thread-scroll-container{height:500px;overflow:auto;overflow-anchor:none;scroll-behavior:auto}.row{height:80px;box-sizing:border-box}.other{height:1300px}textarea{height:40px}</style><aside id="sidebar"><div style="height:3000px">sidebar fixture</div></aside>${['A','B'].map((id,i)=>`<div id="page${id}" data-app-shell-active-page="${i===0}"><main data-ds-part="main"><div data-request-input-activity-root class="layout"><div id="thread${id}" class="thread-scroll-container" data-ds-part="thread" tabindex="0"><div id="rows${id}"></div></div>${nativeButton?'<button id="native'+id+'" aria-label="Scroll to bottom">latest</button>':''}<textarea id="draft${id}">retained draft</textarea></div></main></div>`).join('')}<div id="settings" hidden><div id="settings-scroll" style="height:300px;overflow:auto"><div style="height:2000px">settings fixture</div></div></div></html>`);
  await page.evaluate(({rows,nativeButton})=>{
   window.addRows=(id,count)=>{const root=document.getElementById('rows'+id);for(let i=0;i<count;i++){const row=document.createElement('div');row.className='row';row.setAttribute('data-message-author-role','assistant');row.textContent='synthetic message';root.append(row);}};
   addRows('A',rows);addRows('B',30);window.nativeClicks=0;window.manualScrollCalls=0;
   for(const id of ['A','B']){const thread=document.getElementById('thread'+id),original=thread.scrollTo.bind(thread);thread.scrollTo=(...args)=>{window.manualScrollCalls++;original(...args);};if(nativeButton)document.getElementById('native'+id).onclick=()=>{window.nativeClicks++;const current=document.getElementById('thread'+id);current.scrollTop=current.scrollHeight;};}
   document.getElementById('sidebar').scrollTop=420;window.scrollTo(0,200);
  },{rows,nativeButton});
 };
 const tail=async id=>page.waitForFunction(id=>{const node=document.getElementById('thread'+id);return node.scrollHeight>node.clientHeight&&Math.abs(node.scrollHeight-node.clientHeight-node.scrollTop)<2;},id);
 const done=()=>page.waitForFunction(()=>window.__CODEX_THREAD_TAIL__?.phase==='done');
 const activate=id=>page.evaluate(id=>{for(const key of ['A','B'])document.getElementById('page'+key).setAttribute('data-app-shell-active-page',String(key===id));},id);
 await fixture({rows:0});assert.equal(await invoke(page,installThreadTail),true);await page.waitForTimeout(60);await page.evaluate(()=>addRows('A',30));await tail('A');await done();
 assert.deepEqual(await page.evaluate(()=>({sidebar:document.getElementById('sidebar').scrollTop,body:scrollY,draft:document.getElementById('draftA').value})),{sidebar:420,body:200,draft:'retained draft'});
 await page.locator('#threadA').evaluate(node=>node.scrollTop=240);await activate('B');await tail('B');await activate('A');await tail('A');await done();
 assert.equal(await page.evaluate(()=>window.__CODEX_THREAD_TAIL__.activations),3,'returning to a retained thread starts one new tail restore');
 await page.locator('#threadA').evaluate(node=>node.scrollTop=400);const activations=await page.evaluate(()=>window.__CODEX_THREAD_TAIL__.activations);await activate('A');await page.waitForTimeout(250);
 assert.equal(await page.locator('#threadA').evaluate(node=>node.scrollTop),400,'same-value active-page attributes cannot pull a reader back down');assert.equal(await page.evaluate(()=>window.__CODEX_THREAD_TAIL__.activations),activations);
 await page.evaluate(()=>{window.fakeHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.fakeHidden});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(30);await page.evaluate(()=>{window.fakeHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(250);assert.equal(await page.locator('#threadA').evaluate(node=>node.scrollTop),400,'returning focus to an already read conversation preserves its position');await page.evaluate(()=>delete document.hidden);
 await page.evaluate(()=>document.documentElement.setAttribute('data-dream-skin','inactive'));await page.waitForTimeout(30);await page.evaluate(()=>document.documentElement.setAttribute('data-dream-skin','active'));await page.waitForTimeout(250);assert.equal(await page.locator('#threadA').evaluate(node=>node.scrollTop),400,'theme reapply is not a new conversation activation');
 // After the bounded initial restore, streaming tokens cause zero document scans
 // and do not override a manually chosen reading position.
 const idle=await page.evaluate(async()=>{const query=document.querySelectorAll.bind(document);let scans=0;document.querySelectorAll=(...args)=>{scans++;return query(...args);};try{for(let i=0;i<30;i++){const span=document.createElement('span');span.textContent='.';document.getElementById('rowsA').append(span);await new Promise(requestAnimationFrame);}return {scans,top:document.getElementById('threadA').scrollTop};}finally{document.querySelectorAll=query;}});
 assert.deepEqual(idle,{scans:0,top:400});
 for(const type of ['wheel','pointerdown','keydown']){
  await fixture({rows:0});await invoke(page,installThreadTail);
  await page.locator('#threadA').evaluate((node,type)=>node.dispatchEvent(type==='wheel'?new WheelEvent(type,{bubbles:true,deltaY:-100}):type==='keydown'?new KeyboardEvent(type,{bubbles:true,key:'PageUp'}):new PointerEvent(type,{bubbles:true})),type);
  await page.evaluate(()=>addRows('A',30));await page.waitForTimeout(500);
  assert.equal(await page.locator('#threadA').evaluate(node=>node.scrollTop),0,type+' cancels pending automatic scrolling');assert.equal(await page.evaluate(()=>window.__CODEX_THREAD_TAIL__.reason),'user');
 }
 await fixture();await invoke(page,installThreadTail);await tail('A');await page.waitForTimeout(300);await page.locator('#rowsA').evaluate(node=>node.style.paddingBottom='500px');await tail('A');await done();
 await page.locator('#threadA').evaluate(node=>node.scrollTop=300);await page.locator('#rowsA').evaluate(node=>node.style.paddingBottom='900px');await page.waitForTimeout(250);assert.equal(await page.locator('#threadA').evaluate(node=>node.scrollTop),300,'late changes after restoration do not pin future reading');
 await fixture({nativeButton:true});await invoke(page,installThreadTail);await tail('A');await done();assert.equal(await page.evaluate(()=>window.nativeClicks),1,'prefer the native latest-message action');assert.equal(await page.evaluate(()=>window.manualScrollCalls),0,'native action retains ownership of follow mode');
 const before=await page.evaluate(()=>window.__CODEX_THREAD_TAIL__.activations);await invoke(page,installThreadTail);assert.equal(await page.evaluate(()=>window.__CODEX_THREAD_TAIL__.activations),before,'watcher refresh/reapply is idempotent');
 await page.locator('#threadA').evaluate(node=>{const replacement=node.cloneNode(true);replacement.scrollTop=0;node.replaceWith(replacement);});await tail('A');await done();assert.equal(await page.evaluate(()=>window.__CODEX_THREAD_TAIL__.activations),before+1,'replaced native thread binds independently');
 await page.evaluate(()=>{for(const id of ['A','B'])document.getElementById('page'+id).setAttribute('data-app-shell-active-page','false');document.getElementById('settings').hidden=false;document.getElementById('settings-scroll').scrollTop=77;});await page.waitForTimeout(250);assert.equal(await page.locator('#settings-scroll').evaluate(node=>node.scrollTop),77,'settings scroll is untouched');
 await fixture({rows:0});await invoke(page,installThreadTail);await invoke(page,removeThreadTail);await page.evaluate(()=>addRows('A',30));await page.waitForTimeout(500);assert.equal(await page.locator('#threadA').evaluate(node=>node.scrollTop),0);assert.equal(await page.evaluate(()=>Boolean(window.__CODEX_THREAD_TAIL__)),false,'restore removes listeners, observers and pending work');
 await fixture({rows:0});await invoke(page,installThreadTail);await page.evaluate(()=>{window.fakeHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.fakeHidden});document.dispatchEvent(new Event('visibilitychange'));addRows('A',30);});await page.waitForTimeout(150);assert.equal(await page.locator('#threadA').evaluate(node=>node.scrollTop),0,'hidden pages never auto-scroll');await page.evaluate(()=>{window.fakeHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await tail('A');await done();await page.evaluate(()=>delete document.hidden);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,asyncHistory:true,cachedRoutes:true,manualNavigationRespected:true,nativeTailAction:true,lateLayout:true,settingsAndSidebarUnchanged:true,idleDocumentScans:idle.scans,cleanup:true}));
}finally{await browser.close();}
