// Production components in an isolated, native-structure browser fixture.
// No CDP connection, native client launch, profile read, or active-package write.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {loadCatalog} from '../integration/selection.mjs';
import {loadPayload} from '../vendor/dream-skin/windows/scripts/injector.mjs';
import {installCharacterIcons,removeCharacterIcons} from '../integration/character-icons.mjs';
import {installMaterialUi,removeMaterialUi,getMaterialUiConfig} from '../integration/material-ui.mjs';
import {installCharacterSwitcher,removeCharacterSwitcher} from '../integration/embedded-ui.mjs';
import {getWorkspaceBackgroundConfig,installWorkspaceBackground,removeWorkspaceBackground} from '../integration/workspace-background.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=path.join(root,'evidence/release-qa');await fs.mkdir(evidence,{recursive:true});
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const read=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
const catalog=await loadCatalog(root),contract=await read(path.join(root,'integration/icon-contract.json'));
const native=(await read(path.join(root,'tests/fixtures/native-ui-icons.json'))).icons;
const invoke=(page,fn,...args)=>page.evaluate(({code,args})=>eval('('+code+')')(...args),{code:fn.toString(),args});
const glyph=role=>{const item=native.find(item=>item.role===role)||native[0];return `<svg width="16" height="16" viewBox="${item.viewBox}">${item.shape}</svg>`;};
const fixture=`<!doctype html><html><head><style>
*{box-sizing:border-box}body{margin:0;background:#15203a;color:#f0f0f6;font:14px 'Segoe UI';height:900px}button{font:inherit;color:inherit;cursor:pointer}._ApplicationMenuTopBar_azz1c_2{height:38px;display:flex;align-items:center;padding-left:20px}._ApplicationMenuTopBar_azz1c_2 button{width:58px;height:28px;border:0;background:transparent;padding:0}.layout{display:grid;grid-template-columns:230px 1fr;height:862px}aside{padding:25px 18px}aside button{height:34px;display:flex;align-items:center;gap:8px;padding:4px 10px;width:184px;border:1px solid #7284a455;background:#18263b;border-radius:7px}main{padding:32px;width:850px}h1{margin:0 0 24px;font-size:24px;font-weight:450}.message{width:720px;height:164px;border:1px solid #73819a50;padding:18px;border-radius:10px}.message p{margin:0 0 10px}.message pre{height:70px;margin:0;padding:12px;border-radius:6px}.composer{width:720px;height:108px;margin-top:28px;border:1px solid #73819a50;padding:12px;border-radius:12px}.composer textarea{display:block;resize:none;width:100%;height:48px;padding:0;border:0;color:inherit;background:transparent;font:inherit;outline:none}.composer button{width:54px;height:25px;padding:0;border:0}.menu{position:absolute;left:20px;top:260px;width:190px;height:112px;padding:10px;border:1px solid #73819a50;border-radius:8px}.menu button{display:block;background:transparent;border:0;padding:0 8px;height:28px;width:100%;text-align:left}.guard{margin-top:20px}#colored,#stop{width:40px;height:30px}.token{display:inline-flex;gap:7px;align-items:center}
</style></head><body>
<div id="native-menu" class="_ApplicationMenuTopBar_azz1c_2"><div role="menubar"><button id="file" aria-haspopup="menu">文件</button><button id="edit">编辑</button><button>视图</button><button>帮助</button></div></div>
<div class="layout"><aside id="native-sidebar" class="app-shell-left-panel" data-ds-part="sidebar"><div class="group/project-selector"><button id="project" aria-label="Project example">${glyph('folder')}<span>Example project</span></button></div><button id="search" aria-label="搜索">${glyph('search')}搜索</button><div id="menu" class="menu" role="menu"><button role="menuitem">新建聊天</button><button role="menuitem">打开文件夹</button><button role="menuitem">设置</button></div></aside>
<main id="native-main" class="main-surface" role="main"><h1>Production release verification</h1><section id="message" class="message" data-message-author-role="assistant" data-ds-part="message"><p>聊天内容、草稿和原生控件保持原样。</p><pre id="code"><code>const message = 'retained';</code></pre><button id="message-guard" aria-label="打开文件夹">${glyph('folder')}</button></section><section id="composer" class="composer composer-surface-chrome" data-ds-part="composer"><textarea id="draft" aria-label="测试输入框">保留的草稿 · retained draft</textarea><button id="composer-guard" aria-label="搜索">${glyph('search')}</button></section><div class="guard"><button id="colored" aria-label="文件夹"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 2h12v12H2Z" fill="#ff4850"/></svg></button><button id="stop" aria-label="停止">${glyph('folder')}</button></div></main></div>
</body></html>`;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
const report={pass:false,scope:'isolated browser fixture with actual production code and assets; no live-process interaction',characters:[],browserErrors:[]};
report.componentSha256=Object.fromEntries(await Promise.all(['integration/character-icons.mjs','integration/material-ui.mjs','integration/embedded-ui.mjs',...catalog.characters.flatMap(c=>[`characters/${c.id}/engine/renderer.mjs`,`characters/${c.id}/engine/native-ui.css`])].map(async file=>[file,createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex')])));
const publicCharacters=await Promise.all(catalog.characters.map(async({id,name,themeName})=>({id,name,themeName,avatar:'data:image/png;base64,'+(await fs.readFile(path.join(root,`characters/${id}/assets/characters/sandrone/round-icon.png`))).toString('base64')})));
const load=async id=>{const pack=path.join(root,'characters',id);return {id,pack,renderer:await import(pathToFileURL(path.join(pack,'engine/renderer.mjs')).href),assets:await(await import(pathToFileURL(path.join(pack,'engine/assets.mjs')).href)).openingAssets(),css:await fs.readFile(path.join(pack,'engine/native-ui.css'),'utf8'),icons:{...await read(path.join(pack,'assets/icons/ui/icon-set.json')),contract},material:await getMaterialUiConfig(root,id),presentation:await read(path.join(pack,'presentation.json')),payload:await loadPayload(path.join(pack,'themes/sandrone'))};};
async function newFixture(options={}){
 const context=await browser.newContext({viewport:{width:1440,height:900},...options}),page=await context.newPage();
 page.on('pageerror',error=>report.browserErrors.push(error.message));await page.setContent(fixture);return {context,page};
}
async function assertNative(page){
 const failures=await page.evaluate(()=>window.savedNative.filter(({node,children,rect,aria})=>!node.isConnected||children.length!==node.childNodes.length||children.some((child,index)=>node.childNodes[index]!==child)||JSON.stringify(rect)!==JSON.stringify(node.getBoundingClientRect().toJSON())||node.getAttribute('aria-label')!==aria).map(({node,children,rect,aria})=>({node:node.id||node.tagName,connected:node.isConnected,children:children.length===node.childNodes.length&&children.every((child,index)=>node.childNodes[index]===child),before:rect,after:node.getBoundingClientRect().toJSON(),aria:node.getAttribute('aria-label')===aria})));
 assert.deepEqual(failures,[],'native nodes/children/ARIA and exact bounding rectangles remain unchanged');
 assert.equal(await page.evaluate(()=>document.getElementById('draft')===window.savedDraft&&window.savedDraft.value==='保留的草稿 · retained draft'),true,'same editor node and draft survive');
}
async function recordNative(page){await page.evaluate(()=>{window.savedDraft=document.getElementById('draft');window.savedNative=[...document.querySelectorAll('body *')].map(node=>({node,children:[...node.childNodes],rect:node.getBoundingClientRect().toJSON(),aria:node.getAttribute('aria-label')}));window.nativeClicks=0;document.getElementById('project').onclick=()=>window.nativeClicks++;window.switchRequests=[];window.codexSwitchCharacter=request=>window.switchRequests.push(JSON.parse(request));window.openingCount=0;window.frameAudit={frames:0,unthemed:0,pause:0};new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.id==='sandrone-opening')window.openingCount++;}).observe(document.documentElement,{childList:true});const inspect=()=>{window.frameAudit.frames++;if(document.documentElement.dataset.dreamSkin!=='active')window.frameAudit.unthemed++;if(document.getElementById('chatgpt-dream-skin-operation'))window.frameAudit.pause++;window.frameRaf=requestAnimationFrame(inspect);};inspect();});}
async function install(page,item){
 await page.evaluate(code=>eval(code),item.payload.payload);
 await invoke(page,item.renderer.installNativeUi,item.css);
 await invoke(page,installWorkspaceBackground,await getWorkspaceBackgroundConfig(root,item.id));
 await invoke(page,installCharacterIcons,item.icons);
 await invoke(page,installCharacterSwitcher,{selectedId:item.id,palette:item.presentation.palette,characters:publicCharacters});
 await invoke(page,installMaterialUi,item.material);
}
async function skipAndVerify(page,why='escape'){
 await page.evaluate(()=>window.lastVideo=document.getElementById('sandrone-opening').shadowRoot.querySelector('video.motion'));
 if(why==='escape')await page.keyboard.press('Escape');else await page.locator('#sandrone-opening').evaluate(host=>host.shadowRoot.querySelector('.scene').dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
 await page.waitForFunction(()=>!document.getElementById('sandrone-opening'));
 assert.deepEqual(await page.evaluate(()=>({paused:window.lastVideo.paused,src:window.lastVideo.getAttribute('src'),readyState:window.lastVideo.readyState})),{paused:true,src:null,readyState:0},'skip unloads media decoder and source');
}
try{
 const {context,page}=await newFixture();const first=await load(catalog.defaultId);await page.evaluate(code=>eval(code),first.payload.payload);await invoke(page,first.renderer.installNativeUi,first.css);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);await recordNative(page);
 let installed=first;
 for(const c of catalog.characters){
  const item=await load(c.id);installed=item;await install(page,item);await assertNative(page);
  // The input itself is clear; alpha belongs to its panel, never the text.
  const alpha=await page.evaluate(()=>{const read=id=>{const s=getComputedStyle(document.getElementById(id));return {background:s.backgroundColor,opacity:s.opacity};};return {composer:read('composer'),message:read('message'),code:read('code'),menu:read('menu'),draft:read('draft')};});report.lastSurfaceSample={id:c.id,alpha,variables:await page.evaluate(()=>({panel:getComputedStyle(document.documentElement).getPropertyValue('--ds-panel-rgb'),background:getComputedStyle(document.documentElement).getPropertyValue('--ds-bg-rgb')}))};
  const channel=value=>{const m=value.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);return m?Number(m[1]):value==='transparent'?0:1;};
  assert.equal(channel(alpha.composer.background),.72,c.id+' composer background alpha');assert.equal(channel(alpha.message.background),.64,c.id+' message background alpha');assert.equal(channel(alpha.code.background),.88,c.id+' readable code background alpha');assert.equal(channel(alpha.menu.background),.94,c.id+' readable menu alpha');assert.equal(channel(alpha.draft.background),0,c.id+' editor background clear');assert.ok(Object.values(alpha).every(value=>value.opacity==='1'),c.id+' controls and text stay fully opaque');
  await page.locator('#draft').focus();await page.waitForTimeout(180);assert.equal(await page.locator('#composer').evaluate(node=>getComputedStyle(node).backgroundColor.match(/,\s*([\d.]+)\)$/)?.[1]),'0.8');await page.locator('#draft').blur();
  await page.waitForFunction(()=>document.getElementById('file').dataset.codexMaterialRole==='menu-button');assert.equal(await page.locator('#edit').getAttribute('data-codex-material-role'),null,'only File gets a clasp');
  for(const id of ['message-guard','composer-guard','stop','colored'])assert.equal(await page.locator('#'+id+' svg').getAttribute('data-codex-character-icon'),null,id+' icon guard');
  assert.ok(await page.locator('#project svg').getAttribute('data-codex-character-icon'),'measured native folder glyph uses material icon');
  await page.locator('#project').click();assert.equal(await page.evaluate(()=>window.nativeClicks),report.characters.length+1);
  await page.locator('#codex-character-switcher').evaluate(host=>host.shadowRoot.querySelector('.trigger').click());await page.waitForFunction(()=>document.getElementById('codex-character-materials').shadowRoot.querySelectorAll('.avatar').length===9);
  assert.equal(await page.locator('#codex-character-switcher').evaluate(host=>host.shadowRoot.querySelectorAll('button.character').length),9,'all destinations present inside each UI');
  await page.locator('#codex-character-switcher').evaluate((host,id)=>{const s=host.shadowRoot;s.querySelector('[data-character="'+id+'"]').click();s.querySelector('[data-character="'+id+'"]').click();},c.id);
  assert.equal(await page.evaluate(()=>window.switchRequests.length),report.characters.length+1,'busy guard sends one request, including same-character replay');
  await page.evaluate(()=>{const state=window.__CODEX_CHARACTER_SWITCHER__;state.settle(state.pending.requestId,{status:'ready',message:'Fixture switch acknowledged'});state.host.shadowRoot.querySelector('.close').click();});
  await invoke(page,item.renderer.setStartupPhase,'connecting');const shown=await invoke(page,item.renderer.showOpening,item.assets);assert.equal(shown.shown,true);assert.equal((await invoke(page,item.renderer.showOpening,item.assets)).reason,'already-present');
  await page.waitForFunction(()=>{const v=document.getElementById('sandrone-opening')?.shadowRoot.querySelector('video.motion');return v?.readyState>=2&&v.currentTime>.06;},null,{timeout:12000});
  assert.equal(await page.locator('#sandrone-opening').evaluate((host,expected)=>host.shadowRoot.querySelector('video.motion').src===expected,item.assets.video),true,'selected character movie source is exact');
  await page.waitForFunction(()=>!document.getElementById('codex-character-materials').shadowRoot.querySelector('.menu-button,.menu-panel,.tag'));
  const opening=await page.locator('#sandrone-opening').evaluate(host=>{const s=host.shadowRoot,v=s.querySelector('video.motion'),title=s.querySelector('.signature-title');return {loop:v.loop,muted:v.muted,time:v.currentTime,duration:v.duration,width:v.videoWidth,height:v.videoHeight,full:s.querySelector('.scene').classList.contains('full-scene'),signature:title?.getAttribute('aria-label'),paths:title?.querySelectorAll('path').length,kind:window.__SANDRONE_OPENING_STATE__.animationKind,durationMs:window.__SANDRONE_OPENING_STATE__.durationMs};});
  assert.equal(opening.loop,false,c.id+' plays one finite cycle');assert.equal(opening.muted,true);assert.equal(opening.width,1920,c.id+' decoded HD movie width');assert.equal(opening.height,1080,c.id+' decoded HD movie height');assert.ok(opening.paths>0&&opening.signature,c.id+' cursive signature and accessible character name retained');assert.equal(opening.durationMs,item.assets.durationMs);assert.equal(opening.full,item.assets.fullScene===true);if(c.id!=='sandrone')assert.equal(opening.kind,'illustrated-local-motion');
  await page.waitForTimeout(160);assert.ok(await page.locator('#sandrone-opening').evaluate((host,time)=>host.shadowRoot.querySelector('video.motion').currentTime>time,opening.time),'decoded production movie advances');
  await page.screenshot({path:path.join(evidence,c.id+'-opening.png')});await skipAndVerify(page,report.characters.length%2?'double-click':'escape');await assertNative(page);
  report.characters.push({id:c.id,signature:opening.signature,finitePlayback:true,decodedDuration:opening.duration,nativeLayoutAndChildren:true,inputDraftRetained:true,backgroundAlpha:alpha,skipReleasesMedia:true,embeddedNineWaySwitcher:true,semanticIconGuards:true});
 }
 assert.equal(await page.evaluate(()=>window.openingCount),9,'exactly one host per request');const frames=await page.evaluate(()=>window.frameAudit);assert.equal(frames.unthemed,0);assert.equal(frames.pause,0);assert.ok(frames.frames>30);report.transitionFrames=frames;
 await invoke(page,removeWorkspaceBackground);await invoke(page,removeMaterialUi);await invoke(page,removeCharacterIcons);await invoke(page,removeCharacterSwitcher);await invoke(page,installed.renderer.removeNativeUi);await assertNative(page);assert.equal(await page.locator('#codex-character-materials,#codex-character-switcher,#sandrone-opening,[data-codex-material-role],[data-codex-character-icon]').count(),0,'all owned overlays and marks removed');await page.evaluate(()=>cancelAnimationFrame(window.frameRaf));await context.close();

 // Readiness can arrive immediately, but must not truncate the nine-second movie.
 const full=await load('columbina');const cycle=await newFixture();await install(cycle.page,full);await invoke(cycle.page,full.renderer.setStartupPhase,'ready');await invoke(cycle.page,full.renderer.showOpening,full.assets);
 await cycle.page.waitForFunction(()=>{const v=document.getElementById('sandrone-opening')?.shadowRoot.querySelector('video.motion');return v?.currentTime>.1;},null,{timeout:10000});
 await cycle.page.evaluate(()=>{const scene=document.getElementById('sandrone-opening').shadowRoot.querySelector('.scene');window.cycleVideo=scene.querySelector('video.motion');window.mediaEndedAt=null;window.leavingTime=null;window.lastTime=0;window.cycleVideo.addEventListener('timeupdate',()=>{if(window.cycleVideo.getAttribute('src'))window.lastTime=window.cycleVideo.currentTime;});window.cycleVideo.addEventListener('ended',()=>window.mediaEndedAt=performance.now());new MutationObserver(()=>{if(scene.classList.contains('leaving')&&window.leavingTime===null)window.leavingTime=window.cycleVideo.currentTime;}).observe(scene,{attributes:true,attributeFilter:['class']});});
 await cycle.page.waitForTimeout(5500);assert.equal(await cycle.page.locator('#sandrone-opening').count(),1,'early ready does not use the legacy 5.2 second cutoff');assert.equal(await cycle.page.evaluate(()=>window.__SANDRONE_OPENING_STATE__.stage),'playing');
 await cycle.page.waitForFunction(()=>!document.getElementById('sandrone-opening'),null,{timeout:12000});
 const complete=await cycle.page.evaluate(()=>({time:window.leavingTime,lastTimeupdate:window.lastTime,ended:window.mediaEndedAt,reason:window.__SANDRONE_OPENING_STATE__.reason,paused:window.cycleVideo.paused,src:window.cycleVideo.getAttribute('src')}));report.fullCycle=complete;assert.ok(complete.time>=full.assets.durationMs/1000-.1,'the actual movie reaches its tail');assert.equal(complete.reason,'ready');assert.equal(complete.paused,true);assert.equal(complete.src,null);await cycle.context.close();

 // Reduced-motion and actual media error both retain the correct scene poster.
 for(const mode of ['reduced','decode-error']){
  const sample=await newFixture(mode==='reduced'?{reducedMotion:'reduce'}:{});await install(sample.page,full);await invoke(sample.page,full.renderer.setStartupPhase,'connecting');await invoke(sample.page,full.renderer.showOpening,full.assets);
  if(mode==='decode-error'){await sample.page.waitForFunction(()=>{const v=document.getElementById('sandrone-opening')?.shadowRoot.querySelector('video.motion');return v?.currentTime>.08&&Number(getComputedStyle(v).opacity)>.95;});await sample.page.locator('#sandrone-opening').evaluate(host=>host.shadowRoot.querySelector('video.motion').dispatchEvent(new Event('error')));}
  await sample.page.waitForTimeout(400);const poster=await sample.page.locator('#sandrone-opening').evaluate((host,expected)=>{const s=host.shadowRoot,p=s.querySelector('.motion-poster'),v=s.querySelector('video.motion');return {source:p.src===expected,complete:p.complete&&p.naturalWidth>0,opacity:Number(getComputedStyle(p).opacity),videoSrc:v.getAttribute('src'),loop:v.loop,state:window.__SANDRONE_OPENING_STATE__.video};},full.assets.videoPoster);report[mode]=poster;
  assert.equal(poster.source,true,mode+' uses actual scene first frame');assert.equal(poster.complete,true);assert.equal(poster.opacity,1,mode+' poster remains visibly painted');assert.equal(poster.videoSrc,null);assert.equal(poster.loop,false);await skipAndVerify(sample.page);report[mode]=poster;await sample.context.close();
 }
 assert.deepEqual(report.browserErrors,[]);report.pass=true;report.restoreClean=true;report.nativeScopeLimit='OS-owned menus/account avatars are not fabricated or claimed tested by this fixture';
 console.log(JSON.stringify({pass:true,characters:report.characters.length,fullMovieCycle:true,reducedPoster:true,decodeFallbackPoster:true,nativeNodeAndLayoutPreservation:true,restore:true,browserErrors:0}));
}catch(error){report.failure={message:error.message,stack:error.stack};throw error;}finally{await browser.close();await fs.writeFile(path.join(evidence,'production-browser.json'),JSON.stringify(report,null,2)+'\n');}
