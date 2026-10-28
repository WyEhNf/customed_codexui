// Fixed renderer operations, testable without a browser or account.
import {installNativeUi,setStartupPhase} from './renderer.mjs';
import {installDefaultSidebar} from './sidebar-default.mjs';
import {installThreadTail} from './thread-tail.mjs';
export const transient = error => ['CDP_UNAVAILABLE','CDP_CLOSED','CDP_CONTEXT','CDP_TIMEOUT','RENDERER_NOT_READY'].includes(error?.code);
export const call = (fn,...values)=>`(${fn.toString()})(${values.map(v=>JSON.stringify(v)).join(',')})`;
export function visibleMainSurface(){
 if(document.hidden||document.visibilityState!=='visible'||innerWidth<320||innerHeight<180)return false;
 const selector='[data-ds-part="main"],main[data-app-shell-main-surface],main[class*="_MainContentSurface_"],main.main-surface';
 return [...document.querySelectorAll(selector)].some(node=>{
  if(node.closest('[hidden],[inert],[data-app-shell-active-page="false"]'))return false;
  const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
  return rect.width>=320&&rect.height>=180&&rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight&&style.visibility!=='hidden'&&style.display!=='none';
 });
}
export async function requestMainWindow(){
 if(location.protocol!=='app:'||location.pathname!=='/index.html'||typeof window.electronBridge?.sendMessageFromView!=='function')return false;
 // Fixed native host message, verified in the supported desktop main/preload
 // sources. No route, user content or renderer-provided command is forwarded.
 await window.electronBridge.sendMessageFromView({type:'open-current-main-window',stealFocus:true});
 return true;
}
export async function applyTargets({pages,connect,resources,verify,opening,decorate,force=false,eligible=()=>true,onOutcome=()=>{},tolerateTargetErrors=false}){
 const results=await Promise.allSettled(pages.map(async page=>{
  let session;
  try{
   if(!eligible(page.id))return {ready:false,backoff:true};
   session=await connect(page);
   const visible=await session.evaluate(`Boolean(document.visibilityState==='visible'&&!document.hidden&&innerWidth>=320&&innerHeight>=180&&document.body&&document.querySelector('button,[role="main"],textarea,[contenteditable="true"]'))`);
   if(!visible){
    const idle=await session.evaluate(`document.documentElement.getAttribute('data-dream-skin')==='active'&&window.__SANDRONE_NATIVE_UI__?.version==='0.5.3'&&document.adoptedStyleSheets.includes(window.__SANDRONE_NATIVE_UI__.sheet)`);
    if(idle&&!await session.evaluate('Boolean(window.__CODEX_THREAD_TAIL__)'))await session.evaluate(call(installThreadTail));
    return {ready:false,visible:false,idle:Boolean(idle)};
   }
   const {loaded,css,nativeRevision}=await resources();
   if(opening)await opening(session);
   const skinPresent=!force&&await session.evaluate(`Boolean(document.documentElement.getAttribute('data-dream-skin')==='active'&&window.__CODEX_DREAM_SKIN_STATE__?.revision===${JSON.stringify(loaded.revision)})`);
   if(!skinPresent){await session.evaluate(call(setStartupPhase,'applying'));await session.evaluate(loaded.payload);}
   const nativePresent=!force&&await session.evaluate(nativeRevision?`Boolean(window.__SANDRONE_NATIVE_UI__?.runtimeRevision===${JSON.stringify(nativeRevision)}&&document.adoptedStyleSheets.includes(window.__SANDRONE_NATIVE_UI__.sheet))`:`window.__SANDRONE_NATIVE_UI__?.version==='0.5.3'&&window.__SANDRONE_NATIVE_UI__.css===${JSON.stringify(css)}&&document.adoptedStyleSheets.includes(window.__SANDRONE_NATIVE_UI__.sheet)`);
   if(!nativePresent)await session.evaluate(nativeRevision?`window.__SANDRONE_NATIVE_UI__?.dispose?.();${call(installNativeUi,css)};window.__SANDRONE_NATIVE_UI__.runtimeRevision=${JSON.stringify(nativeRevision)};`:call(installNativeUi,css));
   if(!await session.evaluate('Boolean(window.__CODEX_SIDEBAR_DEFAULT__)'))await session.evaluate(call(installDefaultSidebar));
   if(!await session.evaluate('Boolean(window.__CODEX_THREAD_TAIL__)'))await session.evaluate(call(installThreadTail));
   if(decorate)await decorate(session,{force});
   const ready=verify?Boolean((await verify(session,page.id,loaded.theme.id,loaded.revision))?.pass):true;
   if(verify||!skinPresent)await session.evaluate(call(setStartupPhase,ready?'ready':'waiting'));
   return {visible:true,ready};
  }finally{await session?.close();}
 }));
 for(let i=0;i<results.length;i++)onOutcome(pages[i],results[i]);
 // The long-running watcher isolates renderer failures after validating shared
 // resources. Explicit startup/apply retain strict fail-fast verification.
 const fatal=results.find(r=>r.status==='rejected'&&!transient(r.reason)&&(!tolerateTargetErrors||['IDENTITY_MISMATCH','RUNTIME_VALIDATION'].includes(r.reason?.code)));
 if(fatal)throw fatal.reason;
 return {ready:results.some(r=>r.status==='fulfilled'&&r.value.ready),idle:results.some(r=>r.status==='fulfilled'&&r.value.idle),visible:results.some(r=>r.status==='fulfilled'&&r.value.visible)};
}
// Reusing an already themed background window is not a new installation.
// This probe performs no mutation; cold installs retain upstream visibility
// verification. It cannot accept a blank service page or missing stylesheet.
export function healthyHiddenTheme(revision,css){
 const native=window.__SANDRONE_NATIVE_UI__,composer=document.querySelector('[data-ds-part="composer"]'),box=composer?.getBoundingClientRect();
 return Boolean(document.hidden&&document.visibilityState==='hidden'&&document.documentElement.getAttribute('data-dream-skin')==='active'&&window.__CODEX_DREAM_SKIN_STATE__?.revision===revision&&native?.version==='0.5.3'&&native.css===css&&document.adoptedStyleSheets.includes(native.sheet)&&box?.width>=200&&box.height>0&&innerWidth>=320&&innerHeight>=180);
}
