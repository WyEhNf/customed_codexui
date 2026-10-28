import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {loadPayload,verifySession} from '../vendor/dream-skin/windows/scripts/injector.mjs';
import {themePreferencesPath} from '../vendor/dream-skin/windows/assets/theme-preferences.mjs';
import {appPages,identity,Session} from './cdp.mjs';
import {removeNativeUi,showOpening,installNativeUi} from './renderer.mjs';
import {openingAssets} from './assets.mjs';
import {applyTargets,call,transient,healthyHiddenTheme,visibleMainSurface,requestMainWindow} from './target-runner.mjs';
import {watchSignal} from './watch-signal.mjs';
import {createRuntimeCache,sourceStamp} from './runtime-cache.mjs';
import {createNativeViewportReset} from './native-viewport.mjs';
import {removeDefaultSidebar} from './sidebar-default.mjs';
import {removeThreadTail} from './thread-tail.mjs';
import {createTargetLifecycle,earlyScriptJournal,clearEarlyScripts,enableTargetBindings,closeTargetConnections} from './watcher-targets.mjs';
import {createDecoratorBundle,decorateSession} from '../integration/decorators.mjs';
import {removeCharacterSwitcher} from '../integration/embedded-ui.mjs';
import {embeddedConfig,parseSwitchRequest,spawnSwitchWorker} from '../integration/embedded-bridge.mjs';
import {removeCharacterIcons} from '../integration/character-icons.mjs';
import {removeMaterialUi} from '../integration/material-ui.mjs';
import {removeWorkspaceBackground} from '../integration/workspace-background.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),mode=args[0],browserId=args[args.indexOf('--browser-id')+1];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let openingShown=false,assetsEntry=null,lastRefreshLog=-Infinity;
const ids=['columbina','ayaka','hutao','nahida','furina','citlali','mitya','istaroth','sandrone'];
const openingPaths=['assets/characters/sandrone/portrait.png','assets/characters/sandrone/round-icon.png','assets/backgrounds/dark-mechanical.jpg','assets/ornaments/01_ornate_gear.png','assets/ornaments/02_mechanical_iris.png','assets/ornaments/04_marionette_strings.png','assets/ornaments/cryo.png','assets/ornaments/skill.png','assets/ornaments/burst.png','assets/branding/signature-reference.jpg','assets/branding/sandrone-signature.json','assets/branding/opening-lettering.json','assets/motion/derived.json','assets/motion/sandrone-loop-1080p.mp4','assets/motion/sandrone-loop-720p.mp4','assets/motion/sandrone-trace-1080p.mp4','assets/motion/sandrone-first-frame.jpg','assets/motion/sandrone-outline.json','assets/motion/scene-intro.json'].map(name=>path.join(root,name));
// Stat a fixed list, never arbitrary paths from JSON. Idle passes do not read
// image/movie bytes; a strong validated audit runs at most every 30 seconds.
const sourcePaths=[...openingPaths,themePreferencesPath('win32'),...['catalog.json','state/selection.json','state/last-switch-result.json','themes/sandrone/theme.json','themes/sandrone/theme.css','themes/sandrone/background.png','engine/native-ui.css','engine/renderer.mjs','integration/icon-contract.json','integration/character-icons.mjs','integration/embedded-ui.mjs','integration/material-ui.mjs','integration/workspace-background.mjs'].map(name=>path.join(root,name)),...ids.flatMap(id=>['presentation.json','assets/characters/sandrone/round-icon.png','assets/icons/ui/icon-set.json','assets/ui/personality.json','assets/ui/workspace-background.json','assets/ui/workspace-foreground.png','assets/ui/workspace-frame.svg'].map(name=>path.join(root,'characters',id,name)))];
const runtime=createRuntimeCache({sources:()=>sourcePaths,onReject(){if(Date.now()-lastRefreshLog>=30000){lastRefreshLog=Date.now();console.error(JSON.stringify({code:'RUNTIME_REFRESH_REJECTED'}));}},load:async()=>{
 const [loaded,css,settings]=await Promise.all([loadPayload(path.join(root,'themes/sandrone')),fs.readFile(path.join(root,'engine/native-ui.css'),'utf8'),embeddedConfig(root)]);
 if(loaded.theme.id!==settings.selectedId+'-codex-ui')throw Error('Active character sources do not match');
 const nativeRevision=createHash('sha256').update(installNativeUi.toString()).update(css).digest('hex');
 return {loaded,css,nativeRevision,settings,bundle:createDecoratorBundle(settings),openingRevision:await sourceStamp(openingPaths)};
}});
const resources=()=>runtime.get();
const config=async()=>(await resources()).settings;
const decorate=async(session,options)=>decorateSession(session,(await resources()).bundle,options);
async function currentOpening(){
 const snapshot=await resources();
 if(assetsEntry?.revision!==snapshot.openingRevision){
  const value=await openingAssets();
  if(value.lettering&&value.lettering.id!==snapshot.settings.selectedId||await sourceStamp(openingPaths)!==snapshot.openingRevision)throw Error('Opening sources changed while loading');
  assetsEntry={revision:snapshot.openingRevision,value};
 }
 return assetsEntry.value;
}
const nativeViewport=createNativeViewportReset();
const connect=async page=>{
 const session=await new Session(page.webSocketDebuggerUrl).open();
 try{
  if(['--start','--resume','--ready','--apply','--watch'].includes(mode))await nativeViewport.prepare(page.id,session);
  return session;
 }catch(error){await session.close();throw error;}
};
async function opening(session){
 if(openingShown)return;
 // Reserve the single opening before awaiting assets so two targets cannot race.
 openingShown=true;
 try{await session.evaluate(call(showOpening,await currentOpening()));}catch(error){openingShown=false;throw error;}
}
async function apply({start=false,force=false,verify=false,connector=connect,pages,eligible,onOutcome,tolerateTargetErrors=false}={}){
 return applyTargets({pages:pages??await appPages(browserId),connect:connector,resources,verify:verify?verifySession:null,opening:start?opening:null,decorate,force,eligible,onOutcome,tolerateTargetErrors});
}
async function waitReady(start,timeoutMs=25000){
 const began=Date.now(),deadline=began+timeoutMs;
 do{
  try{const result=await apply({start,verify:true});if(result.ready)return {pass:true,status:'ready',elapsedMs:Date.now()-began};}
  catch(error){if(!transient(error))throw error;}
  await sleep(250);
 }while(Date.now()<deadline);
 return {pass:false,status:'waiting',code:'RENDERER_NOT_READY',elapsedMs:Date.now()-began};
}
async function resume(){
 const began=Date.now(),{loaded,css}=await resources();
 for(const page of await appPages(browserId)){
  const session=await connect(page);
  try{
   // An already themed hidden main window may receive our fixed accessibility
   // component update. This does not install or verify a new upstream theme.
   const existing=await session.evaluate(`Boolean(document.hidden&&document.documentElement.getAttribute('data-dream-skin')==='active'&&window.__CODEX_DREAM_SKIN_STATE__?.revision===${JSON.stringify(loaded.revision)}&&document.querySelector('[data-ds-part="composer"]'))`);
   if(existing){await session.evaluate(call(installNativeUi,css));await decorate(session);}
   if(await session.evaluate(call(healthyHiddenTheme,loaded.revision,css)))return {pass:true,status:'reused',visible:false,elapsedMs:Date.now()-began};
  }
  catch(error){if(!transient(error))throw error;}finally{await session.close();}
 }
 return waitReady(false,3000);
}
async function mainVisible(){
 // A retained native avatar host may reopen a main window that was destroyed.
 // It receives only the fixed IPC request, never theme/style/asset injection.
 for(const page of await appPages(browserId,{includeOverlays:mode==='--show-main'})){
  // Detached and overlay pages cannot stand in for the main desktop surface.
  if(new URL(page.url).pathname!=='/index.html')continue;
  const session=await connect(page);
  try{
   if(mode==='--show-main'&&await session.evaluate(call(requestMainWindow)))return {pass:true,status:'requested'};
   if(mode!=='--show-main'&&await session.evaluate(call(visibleMainSurface)))return {pass:true,status:'visible'};
  }
  catch(error){if(!transient(error))throw error;}finally{await session.close();}
 }
 return {pass:false,status:'waiting',code:'MAIN_WINDOW_NOT_VISIBLE'};
}
async function watch(){
 const anchor=await new Session(await identity(browserId)).open();
 const signal=watchSignal(),pool=new Map();let switching=false,journal;
 const lifecycle=createTargetLifecycle({log:entry=>console.error(JSON.stringify(entry)),onScript:async(id,script)=>{if(journal)await (script?journal.set(id,script):journal.delete(id));}});
 const wake=()=>{runtime.invalidate();signal.wake();};
 anchor.onEvent(method=>{if(method==='Target.targetCreated'||method==='Target.targetInfoChanged'||method==='Target.targetDestroyed')wake();});
 const pooled=async page=>{
  let session=pool.get(page.id);
  if(!session||session.closed){
   session=await connect(page);pool.set(page.id,session);
   let replaying=false;
   try{await enableTargetBindings(session,(method,params)=>{
    if(method==='Runtime.executionContextsCleared'||method==='Runtime.executionContextDestroyed'||method==='Page.loadEventFired')wake();
    if(method==='Runtime.bindingCalled'&&params.name==='sandroneReplayOpening'&&params.payload==='replay'&&!replaying){
     replaying=true;
     (async()=>{
      if(await session.evaluate(`document.visibilityState==='visible'&&document.documentElement.getAttribute('data-dream-skin')==='active'`))await session.evaluate(call(showOpening,await currentOpening(),{replay:true}));
     })().catch(()=>signal.wake()).finally(()=>{replaying=false;});
    }
    if(method==='Runtime.bindingCalled'&&params.name==='codexSwitchCharacter'){
     (async()=>{
      const request=parseSwitchRequest(params.payload,new Set((await config()).characters.map(c=>c.id)));
      const valid=await session.evaluate(`Boolean(document.visibilityState==='visible'&&document.documentElement.getAttribute('data-dream-skin')==='active'&&window.__CODEX_CHARACTER_SWITCHER__?.pending?.requestId===${JSON.stringify(request.requestId)}&&window.__CODEX_CHARACTER_SWITCHER__?.pending?.id===${JSON.stringify(request.id)})`);
      if(!valid)return;
      if(switching){await session.evaluate(`window.__CODEX_CHARACTER_SWITCHER__?.settle(${JSON.stringify(request.requestId)},${JSON.stringify({status:'error',message:'另一项角色切换正在进行，请稍后重试。'})})`);return;}
      switching=true;
      try{const worker=await spawnSwitchWorker(root,request);worker.once('exit',()=>{switching=false;signal.wake();});}catch(error){switching=false;await session.evaluate(`window.__CODEX_CHARACTER_SWITCHER__?.settle(${JSON.stringify(request.requestId)},${JSON.stringify({status:'error',message:'无法启动切换：'+error.message})})`);}
     })().catch(()=>signal.wake());
    }
   });}catch(error){await session.close();pool.delete(page.id);throw error;}
  }
  const {loaded}=await resources();
  await lifecycle.ensure(page.id,session,loaded.payload,loaded.revision);
  return {evaluate:expression=>session.evaluate(expression),send:(...args)=>session.send(...args),close(){}};
 };
 try{
  journal=await earlyScriptJournal(path.join(root,'state/early-scripts.json'),browserId);
  await clearEarlyScripts(journal,await appPages(browserId),connect);
  await anchor.send('Target.setDiscoverTargets',{discover:true});
  while(!anchor.closed){
   try{await fs.access(path.join(root,'state/paused'));break;}catch{}
   let ready=false;
   try{
    const pages=await appPages(browserId),live=new Set(pages.map(page=>page.id));
    // Shared validation errors remain fatal. Only renderer/connection work is
    // eligible for per-target backoff below.
    await resources();
    for(const [id,s]of pool)if(!live.has(id)){await lifecycle.forget(id);await s.close();pool.delete(id);nativeViewport.forget(id);}
    const result=await apply({pages,connector:pooled,tolerateTargetErrors:true,eligible:id=>lifecycle.allowed(id),onOutcome(page,result){if(result.status==='rejected')lifecycle.failure(page.id,result.reason);else if(!result.value.backoff)lifecycle.success(page.id);}});ready=result.ready||result.idle;
   }catch(error){if(anchor.closed)break;if(!transient(error))throw error;}
   for(const [id,s]of pool)if(s.closed){await s.close();pool.delete(id);}
   await signal.wait(lifecycle.waitMs(ready?15000:1500));
  }
 }finally{signal.dispose();try{await closeTargetConnections(pool,lifecycle,entry=>console.error(JSON.stringify(entry)));}finally{await anchor.close();}}
}
async function diagnostic(){
 let count=0;
 const pages=await appPages(browserId);
 if(mode==='--remove')await clearEarlyScripts(await earlyScriptJournal(path.join(root,'state/early-scripts.json'),browserId),pages,connect);
 for(const page of pages){
  const session=await connect(page);
  try{
   if(mode==='--remove'){await session.evaluate(call(removeThreadTail));await session.evaluate(call(removeDefaultSidebar));await session.evaluate(call(removeWorkspaceBackground));await session.evaluate(call(removeMaterialUi));await session.evaluate(call(removeCharacterIcons));await session.evaluate(call(removeCharacterSwitcher));await session.evaluate(call(removeNativeUi));}
   if(mode==='--opening'){if(await session.evaluate(`document.visibilityState==='visible'&&Boolean(document.querySelector('button,[role="main"]'))`))await opening(session);}
   if(mode==='--metrics')console.log(JSON.stringify(await session.evaluate(`(()=>({skin:document.documentElement.getAttribute('data-dream-skin'),extension:window.__SANDRONE_NATIVE_UI__?.version,opening:window.__SANDRONE_OPENING_STATE__?.stage,visible:document.visibilityState,composer:Boolean(document.querySelector('[data-ds-part="composer"]'))}))()`)));
   if(mode==='--switcher-health')console.log(JSON.stringify(await session.evaluate(`(()=>({installed:Boolean(window.__CODEX_CHARACTER_SWITCHER__?.host?.isConnected),selectedId:window.__CODEX_CHARACTER_SWITCHER__?JSON.parse(window.__CODEX_CHARACTER_SWITCHER__.fingerprint).selectedId:null,characters:document.querySelector('#codex-character-switcher')?.shadowRoot?.querySelectorAll('[data-character]').length||0,binding:typeof window.codexSwitchCharacter==='function',opening:window.__SANDRONE_OPENING_STATE__?.stage}))()`)));
   if(mode==='--icon-health')console.log(JSON.stringify(await session.evaluate(`(()=>{const state=window.__CODEX_CHARACTER_ICONS__;return {installed:Boolean(state&&document.adoptedStyleSheets.includes(state.sheet)),id:state?.id,count:state?.owned?.size||0,roles:[...new Set([...document.querySelectorAll('[data-codex-character-icon]')].map(s=>s.getAttribute('data-codex-character-icon')))]};})()`)));
   if(mode==='--health'){
    const {loaded}=await resources();const v=await verifySession(session,page.id,loaded.theme.id,loaded.revision);
    console.log(JSON.stringify({pass:v.pass,readiness:v.readiness,installed:v.installed,stylePresent:v.stylePresent,homePresent:v.homePresent,homeComposerPass:v.homeComposerPass,overflow:v.documentOverflow,pollution:v.businessClassPollution,scope:v.scope?.level,version:v.version,homeSurface:v.homeSurface,composer:v.composer,nativeReason:v.nativeWindow?.reason}));
   }
   if(mode==='--snapshot'){
    if(!await session.evaluate(`document.visibilityState==='visible'&&Boolean(document.querySelector('button,[role="main"]'))`))continue;
    const shot=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await fs.mkdir(path.join(root,'evidence'),{recursive:true});await fs.writeFile(path.join(root,'evidence','native-readable-0.3.0.png'),Buffer.from(shot.data,'base64'));break;
   }
   count++;
  }finally{await session.close();}
 }
 return {pass:true,targets:count};
}
try{
 if(!['--apply','--ready','--resume','--start','--watch','--opening','--remove','--snapshot','--metrics','--health','--switcher-health','--icon-health','--main-visible','--show-main'].includes(mode)||!args.includes('--browser-id'))throw new Error('Unsupported fixed engine operation');
 if(mode==='--watch')await watch();
 else{
  const result=['--main-visible','--show-main'].includes(mode)?await mainVisible():mode==='--resume'?await resume():mode==='--start'||mode==='--ready'?await waitReady(mode==='--start'):mode==='--apply'?await apply({force:true,verify:true}):await diagnostic();
  if(mode==='--apply'){result.pass=result.ready;result.status=result.ready?'ready':'waiting';}
  console.log(JSON.stringify(result));if(result.pass===false)process.exitCode=result.status==='waiting'?2:1;
 }
}catch(error){
 // Watchers redirect stderr to watcher-error.log. Keep failures on that stream
 // so an early exit retains its actual cause instead of leaving an empty log.
 console.error(JSON.stringify({pass:false,code:error.code||'ENGINE_UNAVAILABLE',...(mode==='--watch'&&error.message!=='Invalid browser ID'?{}:{message:error.message})}));process.exitCode=1;
}
