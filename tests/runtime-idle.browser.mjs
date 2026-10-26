// Full production decorators; isolated browser only, no native client or profile.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {embeddedConfig} from '../integration/embedded-bridge.mjs';
import {createDecoratorBundle,decorateSession} from '../integration/decorators.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setContent('<!doctype html><html data-dream-skin="active"><style>body{margin:0;color:#eee;background:#17203b}aside{position:fixed;left:0;width:200px;height:800px}main{position:absolute;left:200px;top:40px;width:1000px;height:760px}textarea{width:300px;height:100px}</style><body><aside data-ds-part="sidebar"><button>Project</button></aside><main role="main" data-ds-part="main"><h1>Offline runtime fixture</h1><textarea>Retain this draft</textarea></main></body></html>');
 let sent=0;const session={evaluate:async source=>{sent+=Buffer.byteLength(source);return page.evaluate(code=>eval(code),source);}};
 const config=await embeddedConfig(root),bundle=createDecoratorBundle(config);
 const initial=await decorateSession(session,bundle);assert.deepEqual(initial.installed,['workspace','icons','switcher','materials']);
 await page.waitForTimeout(60);
 const urls=await page.evaluate(()=>[...window.__CODEX_WORKSPACE_BACKGROUND__.assetUrls]);
 const before=sent;for(let i=0;i<20;i++){const idle=await decorateSession(session,bundle);assert.deepEqual(idle.installed,[]);}
 const idleBytes=sent-before;assert.ok(idleBytes/20<4096,'idle probe stays under 4 KiB instead of retransferring multi-megabyte artwork');
 await page.evaluate(()=>window.__CODEX_CHARACTER_SWITCHER__.dispose());
 assert.deepEqual((await decorateSession(session,bundle)).installed,['switcher'],'only a missing component receives its configuration again');
 assert.deepEqual(await page.evaluate(()=>[...window.__CODEX_WORKSPACE_BACKGROUND__.assetUrls]),urls,'missing switcher does not reallocate background art');
 await page.evaluate(()=>window.__CODEX_CHARACTER_SWITCHER__.host.shadowRoot.adoptedStyleSheets=[]);
 assert.deepEqual((await decorateSession(session,bundle)).installed,['switcher'],'a connected host with its owned sheet removed is repaired selectively');
 assert.equal(await page.evaluate(()=>window.__CODEX_CHARACTER_SWITCHER__.host.shadowRoot.adoptedStyleSheets.includes(window.__CODEX_CHARACTER_SWITCHER__.sheet)),true);
 const revised=createDecoratorBundle({...config,palette:{...config.palette,accent:'#e7cc99'}});
 assert.deepEqual((await decorateSession(session,revised)).installed,['switcher'],'config revision refresh transfers only its owning component');
 await page.evaluate(()=>window.__CODEX_CHARACTER_MATERIALS__.dispose());
 assert.deepEqual((await decorateSession(session,revised)).installed,['materials']);
 assert.equal(await page.locator('textarea').inputValue(),'Retain this draft');
 assert.equal(await page.locator('#codex-character-switcher').count(),1);assert.equal(await page.locator('#codex-character-materials').count(),1);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,scope:'isolated-production-decorators',initialBytes:initial.bytes,idleBytesPerPass:idleBytes/20,selectiveReinstall:true,draftPreserved:true}));
}finally{await browser.close();}
