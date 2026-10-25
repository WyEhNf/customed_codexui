import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {installCharacterIcons,removeCharacterIcons} from '../integration/character-icons.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalogue=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
const contract=JSON.parse(await fs.readFile(path.join(root,'integration/icon-contract.json'),'utf8'));
const native=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/native-ui-icons.json'),'utf8')).icons;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'}),results=[];
const svg=(role,size=20,extra='')=>`<svg data-character-ui-icon="${role}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" ${extra}><title>Original accessible SVG title</title><path d="M3 3h18v18H3Z" fill="none" stroke="currentColor"/></svg>`;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(`<html data-dream-skin="active"><style>body{margin:0;background:#0f1726;color:#eaf0ff;font:14px "Segoe UI"}main{padding:32px}button{font:inherit;color:inherit;background:#19243b;border:1px solid #40516d;border-radius:6px;min-height:38px;display:inline-flex;align-items:center;gap:8px;padding:6px 10px;margin:5px}svg{flex:none}#matrix{display:flex;gap:5px;flex-wrap:wrap;max-width:1300px}.guard{display:inline-flex;margin:15px;padding:8px;border:1px solid #556}</style><main><h1>角色图标 · 原节点与交互保持</h1><div id="matrix"></div><div id="native"><button id="native-folder" aria-label="Example project"><svg width="16" height="16" viewBox="${native[0].viewBox}">${native[0].shape}</svg></button><button id="native-file" aria-label="Example document"><svg width="16" height="16" viewBox="${native[2].viewBox}">${native[2].shape}</svg></button></div><div data-ds-part="message" class="guard"><button>${svg('folder')}正文中的示例图标</button></div><div data-ds-part="composer" class="guard"><button>${svg('terminal')}输入框操作</button></div><button id="disclosure">${svg('projects',16,'class="icon-disclosure"')}展开箭头</button><button id="filetype">${svg('file',16,'data-file-type="typescript"')}TypeScript 类型标识</button><button id="colored"><svg data-character-ui-icon="file" width="16" height="16" viewBox="0 0 24 24"><path d="M3 3h18v18H3Z" fill="#00aeff"/></svg>原文件类型颜色</button><button id="stop" aria-label="停止"><svg width="20" height="20" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14"/></svg></button></main></html>`);
 for(const c of catalogue.characters){
  const set=JSON.parse(await fs.readFile(path.join(root,c.path,'assets/icons/ui/icon-set.json'),'utf8'));
  await page.evaluate(()=>window.__CODEX_CHARACTER_ICONS__?.dispose());
  await page.locator('#matrix').evaluate((e,markup)=>e.innerHTML=markup,set.roles.map(role=>`<button data-role="${role}" aria-label="${role}">${svg(role,20)}${svg(role,16)}<span>${role}</span></button>`).join(''));
  await page.evaluate(()=>{window.__nodes=[...document.querySelectorAll('svg')].map(svg=>({svg,children:[...svg.children],markup:svg.innerHTML,rect:svg.getBoundingClientRect().toJSON()}));window.__clicks=0;document.querySelector('[data-role=folder]').onclick=()=>window.__clicks++;});
  const installed=await page.evaluate(({code,config})=>eval('('+code+')')(config),{code:installCharacterIcons.toString(),config:{...set,contract}});
  assert.equal(installed.id,c.id);assert.equal(await page.locator('#matrix [data-codex-character-icon]').count(),set.roles.length*2);
  assert.equal(await page.locator('#native-folder svg').getAttribute('data-codex-character-icon'),'folder','real native project glyph matches without its label');
  assert.equal(await page.locator('#native-file svg').getAttribute('data-codex-character-icon'),'file');
  assert.equal(await page.locator('[data-ds-part] [data-codex-character-icon]').count(),0,'business prose and composer are untouched');
  for(const id of ['disclosure','filetype','colored','stop'])assert.equal(await page.locator('#'+id+' [data-codex-character-icon]').count(),0,id+' retains original meaning');
  assert.equal(await page.evaluate(()=>window.__nodes.every(r=>r.svg.isConnected&&r.svg.innerHTML===r.markup&&r.children.every((child,i)=>r.svg.children[i]===child)&&JSON.stringify(r.svg.getBoundingClientRect().toJSON())===JSON.stringify(r.rect))),true,'React nodes, original children and exact geometry survive');
  await page.locator('[data-role=folder]').click();assert.equal(await page.evaluate(()=>window.__clicks),1,'existing click listener survives');
  await page.locator('#native-folder').evaluate(e=>e.setAttribute('aria-expanded','true'));await page.waitForFunction(()=>document.querySelector('#native-folder svg').getAttribute('data-codex-character-icon')==='folder-open');
  await page.locator('[data-role=projects]').evaluate(e=>e.setAttribute('aria-selected','true'));await page.waitForFunction(()=>document.querySelector('[data-role=projects] svg').getAttribute('data-codex-character-icon-selected')==='true');
  const uri=await page.locator('[data-role=projects] svg').first().evaluate(s=>getComputedStyle(s).backgroundImage);assert.ok(uri.includes(set.icons.projects.selected),'selected colour variant follows native selected state');
  const originalCount=await page.locator('svg').count();await page.evaluate(({code,config})=>eval('('+code+')')(config),{code:installCharacterIcons.toString(),config:{...set,contract}});assert.equal(await page.locator('svg').count(),originalCount,'idempotent installation creates no SVG nodes');
  // Newly mounted native nodes and recycled SVG children update without replacing DOM.
  await page.locator('#native').evaluate((e,markup)=>e.insertAdjacentHTML('beforeend',markup),`<button id="late-native"><svg width="16" height="16" viewBox="${native[0].viewBox}">${native[0].shape}</svg></button>`);
  await page.waitForFunction(()=>document.querySelector('#late-native svg')?.hasAttribute('data-codex-character-icon'));
  await page.locator('#late-native').evaluate(e=>e.remove());
  if(['columbina','hutao','sandrone'].includes(c.id))await page.locator('main').screenshot({path:path.join(root,'evidence',c.id+'-icons-installed.png')});
  await page.evaluate(code=>eval('('+code+')')(),removeCharacterIcons.toString());assert.equal(await page.locator('[data-codex-character-icon]').count(),0);
  assert.equal(await page.locator('#native-folder path').first().evaluate(p=>getComputedStyle(p).visibility),'visible','restore reveals original native paths');
  await page.locator('#native-folder').evaluate(e=>e.removeAttribute('aria-expanded'));
  results.push({id:c.id,roles:set.roles.length,reactNodesPreserved:true,geometryPreserved:true,eventsPreserved:true,newMounts:true,nativeFingerprint:true,semanticExclusions:true,restore:true});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(root,'evidence/character-icons-browser.json'),JSON.stringify({pass:true,scope:'offline-browser-component',characters:results,browserErrors:errors},null,2));
 console.log(JSON.stringify({pass:true,characters:results.length,rolesEach:19,displaySizes:[16,20],reactNodesPreserved:true,geometryPreserved:true,eventsPreserved:true,browserErrors:0}));
}finally{await browser.close();}
