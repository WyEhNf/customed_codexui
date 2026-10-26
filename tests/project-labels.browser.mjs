import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {ensureProjectLabels} from '../integration/project-labels.mjs';
import {loadPayload} from '../vendor/dream-skin/windows/scripts/injector.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const labels=JSON.parse(await fs.readFile(path.join(root,'integration/project-labels.json'),'utf8')).characters;
const expected={columbina:'月庭',ayaka:'霜庭',hutao:'往生堂',nahida:'净善宫',furina:'剧场',citlali:'星帐',mitya:'书房',istaroth:'时庭',sandrone:'工坊'};
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'codex-project-labels-'));
try{
 await fs.mkdir(path.join(temporary,'integration'));await fs.copyFile(path.join(root,'integration/project-labels.json'),path.join(temporary,'integration/project-labels.json'));
 for(const id of Object.keys(expected)){
  const dir=path.join(temporary,'characters',id,'themes/sandrone');await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'theme.json'),JSON.stringify({id:id+'-codex-ui',projectPrefix:'项目 · ',projectLabel:'选择项目',sentinel:'retained'}));
  await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify({themeId:id+'-codex-ui',files:[{path:'theme.json',bytes:0,sha256:'old',mediaType:'application/json'}]}));
 }
 assert.equal((await ensureProjectLabels(temporary)).filter(x=>x.changed).length,9);
 assert.equal((await ensureProjectLabels(temporary)).some(x=>x.changed||x.manifestChanged),false,'repeat builds are byte stable');
 for(const id of Object.keys(expected)){
  const dir=path.join(temporary,'characters',id,'themes/sandrone'),bytes=await fs.readFile(path.join(dir,'theme.json')),theme=JSON.parse(bytes),manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
  assert.equal(theme.sentinel,'retained');assert.equal(theme.projectPrefix,expected[id]+' · ');assert.equal(manifest.files[0].bytes,bytes.length);assert.equal(manifest.files[0].sha256,createHash('sha256').update(bytes).digest('hex'));
 }
}finally{await fs.rm(temporary,{recursive:true,force:true});}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chromium'});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<html><style>#project{position:fixed!important;left:400px!important;top:280px!important;width:300px!important;height:50px!important;box-sizing:border-box!important}#thread{position:fixed;left:400px;top:500px;width:300px;height:50px}</style><body><main role="main"><span data-testid="home-icon"></span><div data-feature="game-source"><button id="project" aria-label="Fixture project"><span id="project-name">Native project</span></button></div></main><section class="thread-scroll-container"><div data-feature="game-source"><button id="thread">Thread project</button></div></section></body></html>');
 await page.evaluate(()=>{window.originalProject=document.getElementById('project');window.originalName=document.getElementById('project-name');window.originalText=window.originalName.firstChild;window.clicks=0;window.originalProject.onclick=()=>window.clicks++;});
 let rectangle;
 for(const [id,prefix]of Object.entries(expected)){
  assert.equal(labels[id].projectPrefix,prefix+' · ');
  const loaded=await loadPayload(path.join(root,'characters',id,'themes/sandrone'));await page.evaluate(code=>eval(code),loaded.payload);await page.waitForTimeout(30);
  const state=await page.evaluate(()=>({content:getComputedStyle(document.getElementById('project'),'::before').content,thread:getComputedStyle(document.getElementById('thread'),'::before').content,retained:window.originalProject===document.getElementById('project')&&window.originalName===document.getElementById('project-name')&&window.originalText===window.originalName.firstChild,aria:window.originalProject.getAttribute('aria-label'),rect:window.originalProject.getBoundingClientRect().toJSON()}));
  assert.equal(state.content,JSON.stringify((prefix+' · ').trimEnd()),id+' is supplied by the original upstream pseudo-element');assert.ok(['none','normal'].includes(state.thread),'thread route receives no homepage project prefix');assert.equal(state.retained,true);assert.equal(state.aria,'Fixture project');
  if(rectangle)assert.deepEqual(state.rect,rectangle,'changing role metadata changes no fixture control rectangle');else rectangle=state.rect;
  await page.evaluate(id=>window.originalText.nodeValue='Dynamic '+id,id);assert.equal(await page.locator('#project-name').textContent(),'Dynamic '+id,'live project name remains React-owned');
  await page.click('#project');
 }
 assert.equal(await page.evaluate(()=>window.clicks),9);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,characters:9,nativeCssBinding:true,dynamicProjectName:true,nativeNodesAndEvents:true,threadRouteGuard:true,idempotentManifestUpdate:true}));
}finally{await browser.close();}
