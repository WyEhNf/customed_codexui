// Fixed renderer operations, testable without a browser or account.
import {installNativeUi,setStartupPhase} from './renderer.mjs';
export const transient = error => ['CDP_UNAVAILABLE','CDP_CLOSED','CDP_CONTEXT','CDP_TIMEOUT','RENDERER_NOT_READY'].includes(error?.code);
export const call = (fn,...values)=>`(${fn.toString()})(${values.map(v=>JSON.stringify(v)).join(',')})`;
export async function applyTargets({pages,connect,resources,verify,opening,decorate,force=false}){
 const results=await Promise.allSettled(pages.map(async page=>{
  let session;
  try{
   session=await connect(page);
   const visible=await session.evaluate(`Boolean(document.visibilityState==='visible'&&!document.hidden&&innerWidth>=320&&innerHeight>=180&&document.body&&document.querySelector('button,[role="main"],textarea,[contenteditable="true"]'))`);
   if(!visible){
    const idle=await session.evaluate(`document.documentElement.getAttribute('data-dream-skin')==='active'&&window.__SANDRONE_NATIVE_UI__?.version==='0.5.3'&&document.adoptedStyleSheets.includes(window.__SANDRONE_NATIVE_UI__.sheet)`);
    return {ready:false,visible:false,idle:Boolean(idle)};
   }
   const {loaded,css}=await resources();
   if(opening)await opening(session);
   const skinPresent=!force&&await session.evaluate(`Boolean(document.documentElement.getAttribute('data-dream-skin')==='active'&&window.__CODEX_DREAM_SKIN_STATE__?.revision===${JSON.stringify(loaded.revision)})`);
   if(!skinPresent){await session.evaluate(call(setStartupPhase,'applying'));await session.evaluate(loaded.payload);}
   const nativePresent=!force&&await session.evaluate(`window.__SANDRONE_NATIVE_UI__?.version==='0.5.3'&&window.__SANDRONE_NATIVE_UI__.css===${JSON.stringify(css)}&&document.adoptedStyleSheets.includes(window.__SANDRONE_NATIVE_UI__.sheet)`);
   if(!nativePresent)await session.evaluate(call(installNativeUi,css));
   if(decorate)await decorate(session);
   const ready=verify?Boolean((await verify(session,page.id,loaded.theme.id,loaded.revision))?.pass):true;
   if(verify||!skinPresent)await session.evaluate(call(setStartupPhase,ready?'ready':'waiting'));
   return {visible:true,ready};
  }finally{await session?.close();}
 }));
 const fatal=results.find(r=>r.status==='rejected'&&!transient(r.reason));
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
