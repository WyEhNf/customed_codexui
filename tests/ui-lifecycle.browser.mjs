// Offline fixtures only: no client, profile, authentication, or personal text.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {getWorkspaceBackgroundConfig,installWorkspaceBackground,removeWorkspaceBackground} from '../integration/workspace-background.mjs';
import {getMaterialUiConfig,installMaterialUi,removeMaterialUi} from '../integration/material-ui.mjs';
import {installCharacterSwitcher,removeCharacterSwitcher} from '../integration/embedded-ui.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const invoke=(page,fn,...args)=>page.evaluate(({code,args})=>eval('('+code+')')(...args),{code:fn.toString(),args});
const background=await getWorkspaceBackgroundConfig(root,'columbina'),material=await getMaterialUiConfig(root,'columbina');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<html data-dream-skin="active"><style>body{margin:0}main{position:fixed;left:240px;top:36px;right:0;bottom:0}.ApplicationMenuTopBar_fixture{height:36px}button{width:100px;height:28px}aside{position:fixed;top:36px;left:0;width:240px;bottom:0}</style><body style="background-image:linear-gradient(red,blue)!important;background-size:10px 20px"><div class="ApplicationMenuTopBar_fixture"><button id="file">文件</button></div><aside data-ds-part="sidebar"></aside><main data-ds-part="main"><section data-ds-part="message"><div id="stream">synthetic message</div></section><div id="project-shell"><div class="group/project-selector"><button id="project">fixture project</button></div></div></main></body></html>');
 await page.evaluate(()=>{
  window.urls={created:[],revoked:[]};const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=blob=>{const value=create(blob);window.urls.created.push(value);return value;};URL.revokeObjectURL=value=>{window.urls.revoked.push(value);revoke(value);};
  const read=CSSStyleDeclaration.prototype.getPropertyValue;window.backgroundReads={count:0,bytes:0};CSSStyleDeclaration.prototype.getPropertyValue=function(name){const value=read.call(this,name);if(name==='background-image'){window.backgroundReads.count++;window.backgroundReads.bytes+=value.length;}return value;};
  window.originalBackground=document.body.style.cssText;window.nativeButton=document.getElementById('project');window.nativeChildren=[...window.nativeButton.childNodes];window.nativeClick=0;window.nativeButton.onclick=()=>window.nativeClick++;
 });
 assert.equal(await invoke(page,installWorkspaceBackground,background),true);await invoke(page,installMaterialUi,material);await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>window.__CODEX_WORKSPACE_BACKGROUND__.storageMode),'blob');
 assert.equal(await page.evaluate(()=>window.urls.created.length),2,'two assets are decoded once per document installation');
 assert.equal(await page.evaluate(()=>window.__CODEX_WORKSPACE_BACKGROUND__.isHealthy()),true);
 const work=await page.evaluate(async()=>{
  const before=window.__CODEX_WORKSPACE_BACKGROUND__.updates;window.backgroundReads={count:0,bytes:0};
  const query=document.querySelectorAll.bind(document),elementQuery=Element.prototype.querySelector;let scans=0,subtreeScans=0;document.querySelectorAll=(...args)=>{scans++;return query(...args);};Element.prototype.querySelector=function(...args){subtreeScans++;return elementQuery.apply(this,args);};
  try{for(let i=0;i<60;i++){const node=document.getElementById('stream');node.className='stream-'+i;const token=document.createElement('span');token.textContent='.';node.append(token);await new Promise(requestAnimationFrame);}await new Promise(requestAnimationFrame);}
  finally{document.querySelectorAll=query;Element.prototype.querySelector=elementQuery;}
  return {updates:window.__CODEX_WORKSPACE_BACKGROUND__.updates-before,scans,subtreeScans,...window.backgroundReads};
 });
 assert.equal(work.updates,0,'message streaming does not schedule workspace geometry');assert.equal(work.scans,0,'message streaming does not rescan the document for ornaments');assert.equal(work.subtreeScans,0,'inserted message spans are excluded without subtree queries');assert.equal(work.bytes,0,'message streaming never serializes the background asset');
 await page.evaluate(()=>document.getElementById('project-shell').style.transform='translateX(-13px)');await page.waitForTimeout(60);
 assert.equal(await page.evaluate(()=>{const native=document.getElementById('project').getBoundingClientRect(),art=window.__CODEX_CHARACTER_MATERIALS__.host.shadowRoot.querySelector('[data-kind="tag"]').getBoundingClientRect();return art.left===native.left;}),true,'ancestor style changes track ornament geometry without global attribute scans');
 await invoke(page,installWorkspaceBackground,background);await page.waitForTimeout(60);assert.equal(await page.evaluate(()=>window.urls.created.length),2,'same revision does not re-decode assets');
 // Removing the host and stripping its adopted sheet reproduce the stale
 // fingerprint failures observed during renderer repairs.
 await page.evaluate(()=>window.__CODEX_CHARACTER_MATERIALS__.host.remove());await page.waitForTimeout(60);
 assert.equal(await page.evaluate(()=>window.__CODEX_CHARACTER_MATERIALS__.host.isConnected),true,'host removal heals automatically');
 await page.evaluate(()=>window.__CODEX_CHARACTER_MATERIALS__.host.shadowRoot.adoptedStyleSheets=[]);
 await invoke(page,installMaterialUi,material);await page.waitForTimeout(60);
 assert.equal(await page.evaluate(()=>{const s=window.__CODEX_CHARACTER_MATERIALS__;return s.host.isConnected&&s.host.shadowRoot.adoptedStyleSheets.includes(s.sheet);}),true,'same fingerprint repairs a missing stylesheet');
 assert.equal(await page.locator('#codex-character-materials').count(),1);
 const switcher={selectedId:'columbina',switcherRevision:'fixture-one',palette:{background:'#101020',panel:'#181828',panelAlt:'#222238',accent:'#abcdef',text:'#eeeeff',muted:'#9999aa',line:'#555566'},characters:[{id:'columbina',name:'Fixture',themeName:'Fixture',avatar:material.avatarFrame}]};
 await invoke(page,installCharacterSwitcher,switcher);await page.evaluate(()=>window.firstSwitcher=window.__CODEX_CHARACTER_SWITCHER__.host);
 await invoke(page,installCharacterSwitcher,switcher);assert.equal(await page.evaluate(()=>window.firstSwitcher===window.__CODEX_CHARACTER_SWITCHER__.host),true);
 await page.evaluate(()=>window.__CODEX_CHARACTER_SWITCHER__.host.shadowRoot.adoptedStyleSheets=[]);
 await invoke(page,installCharacterSwitcher,switcher);assert.equal(await page.evaluate(()=>{const s=window.__CODEX_CHARACTER_SWITCHER__;return s.host.isConnected&&s.host.shadowRoot.adoptedStyleSheets.includes(s.sheet);}),true,'same revision repairs a missing switcher stylesheet');
 await invoke(page,installCharacterSwitcher,{...switcher,switcherRevision:'fixture-two'});
 assert.equal(await page.evaluate(()=>window.firstSwitcher!==window.__CODEX_CHARACTER_SWITCHER__.host&&window.__CODEX_CHARACTER_SWITCHER__.revision==='fixture-two'),true,'source-only revision changes replace the stale switcher');
 await invoke(page,removeCharacterSwitcher);await invoke(page,removeMaterialUi);
 await invoke(page,installWorkspaceBackground,{...background,revision:background.revision+'-replacement'});assert.equal(await page.evaluate(()=>window.urls.created.length),4);assert.equal(await page.evaluate(()=>window.urls.revoked.length),2);
 await invoke(page,removeWorkspaceBackground);await page.waitForTimeout(60);
 assert.deepEqual(await page.evaluate(()=>window.urls.revoked),await page.evaluate(()=>window.urls.created),'all object URLs revoked on character replacement/cleanup');
 assert.equal(await page.evaluate(()=>document.body.style.cssText===window.originalBackground),true,'background values and inline priorities restored');
 assert.equal(await page.evaluate(()=>window.nativeButton===document.getElementById('project')&&window.nativeChildren.every((n,i)=>window.nativeButton.childNodes[i]===n)),true);
 await page.click('#project');assert.equal(await page.evaluate(()=>window.nativeClick),1);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,messageMutations:60,geometryUpdates:work.updates,documentScans:work.scans,backgroundBytesRead:work.bytes,blobLifecycle:true,materialSelfHeal:true,switcherSourceRevision:true,nativeEvents:true}));
}finally{await browser.close();}
