import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ids=new Set(['columbina','sandrone','hutao','ayaka','nahida','furina','citlali','mitya','istaroth']);
const cache=new Map();
let rendererSource;
async function bounded(file,max){const stat=await fs.stat(file);if(!stat.isFile()||stat.size>max)throw new Error('Workspace background asset exceeds budget');return fs.readFile(file);}

// Only package-owned, fixed-name assets enter the renderer. Never resolve a path
// supplied by the art JSON, and never permit SVG to load another resource.
export async function getWorkspaceBackgroundConfig(root,id){
 if(!ids.has(id))throw new Error('Unknown workspace character');
 const dir=path.join(root,'characters',id,'assets/ui');
 const raw=await bounded(path.join(dir,'workspace-background.json'),8192),config=JSON.parse(raw);
 if(config.schemaVersion!==1||config.id!==id||config.width!==1920||config.height!==1080||config.foreground!=='workspace-foreground.png'||config.frame!=='workspace-frame.svg'||config.mode!==(id==='sandrone'?'original-in-main':'layered')||!/^#[a-f0-9]{6}$/i.test(config.canvasColor)||!Number.isFinite(config.focusX)||!Number.isFinite(config.focusY)||config.focusX<0||config.focusX>1||config.focusY<0||config.focusY>1)throw new Error('Invalid workspace background config');
 const [foreground,frame]=await Promise.all([bounded(path.join(dir,'workspace-foreground.png'),16*1024*1024),bounded(path.join(dir,'workspace-frame.svg'),2*1024*1024)]);
 if(foreground.length<33||!foreground.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||foreground.toString('ascii',12,16)!=='IHDR'||foreground.readUInt32BE(16)!==1920||foreground.readUInt32BE(20)!==1080)throw new Error('Invalid workspace foreground PNG');
 const svg=frame.toString('utf8');
 if(!/^\s*<svg\b/.test(svg)||!/<svg\b[^>]*\bpreserveAspectRatio=["']none["']/.test(svg)||/<(?:script|style|image|use|foreignObject|iframe|object|embed|a|animate\w*|set)\b|<!|\b(?:href|on\w+)\s*=|url\s*\(|(?:https?:|file:|data:)(?!\/\/www\.w3\.org\/2000\/svg["'])/i.test(svg))throw new Error('Unsafe workspace frame SVG');
 for(const tag of svg.matchAll(/<\/?([\w:-]+)/g))if(!['svg','g','path','rect','circle','ellipse','line','polyline','polygon','defs','linearGradient','radialGradient','stop'].includes(tag[1]))throw new Error('Unsupported workspace frame geometry');
 rendererSource??=fs.readFile(new URL(import.meta.url));
 const revision=createHash('sha256').update(raw).update(foreground).update(frame).update(await rendererSource).digest('hex');
 if(cache.has(revision))return cache.get(revision);
 const result={schemaVersion:1,id,mode:config.mode,canvasColor:config.canvasColor,width:config.width,height:config.height,focusX:config.focusX,focusY:config.focusY,foreground:'data:image/png;base64,'+foreground.toString('base64'),frame:'data:image/svg+xml;base64,'+frame.toString('base64'),revision};
 cache.set(revision,result);return result;
}

// Injected verbatim. Background layers do not add hit targets, wrap native nodes,
// change a box, or draw across the app's text. Only the vector plane stretches.
export function installWorkspaceBackground(config){
 const KEY='__CODEX_WORKSPACE_BACKGROUND__';
 if(!config||config.schemaVersion!==1||!config.id||!config.revision||!['layered','original-in-main'].includes(config.mode)||!/^#[a-f0-9]{6}$/i.test(config.canvasColor)||config.width!==1920||config.height!==1080||!config.foreground?.startsWith('data:image/png;base64,')||!config.frame?.startsWith('data:image/svg+xml;base64,'))return false;
 if(window[KEY]?.revision===config.revision){window[KEY].sync();return true;}
 window[KEY]?.dispose();
 const props=['background-image','background-size','background-position','background-repeat','background-attachment'];
 let body=null,saved=null,main=null,raf=0,dead=false,transitionUntil=0,refreshNeeded=true;
 const leases=[];
 const localImage=data=>{
  if(typeof URL.createObjectURL!=='function'||typeof Blob!=='function')return data;
  const [header,encoded]=data.split(','),raw=atob(encoded),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{type:header.slice(5,header.indexOf(';'))}));leases.push(url);return url;
 };
 const images={foreground:`url("${localImage(config.foreground)}")`,frame:`url("${localImage(config.frame)}")`,canvas:`linear-gradient(${config.canvasColor},${config.canvasColor})`};
 const state={id:config.id,revision:config.revision,mode:config.mode,body:null,geometry:null,updates:0,assetUrls:leases,storageMode:leases.length?'blob':'data',sync:schedule,isHealthy,dispose};
 const normalizer=document.createElement('div').style,normalized=new Map();
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
 const boundaries=new Set(),boundarySelector='[data-ds-part="main"],[data-ds-part="sidebar"],[data-app-shell-active-page],[role="tabpanel"]';
 const boundaryObserver=new MutationObserver(schedule);
 function refreshBoundaries(){
  boundaryObserver.disconnect();boundaries.clear();
  const add=node=>{for(let p=node;p;p=p.parentElement)boundaries.add(p);};
  add(document.body);for(const node of document.querySelectorAll(boundarySelector))add(node);
  for(const node of boundaries)boundaryObserver.observe(node,{attributes:true,attributeFilter:['class','style','hidden','data-ds-part','data-dream-skin','data-app-shell-active-page','data-state']});
  refreshNeeded=false;
 }
 const px=n=>Number(n.toFixed(3))+'px';
 function restore(){if(body&&saved)for(const [p,value,priority]of saved){if(value)body.style.setProperty(p,value,priority);else body.style.removeProperty(p);}saved=null;}
 function usable(node){if(!node.isConnected||!node.getClientRects().length||node.closest('[data-app-shell-active-page="false"],[role="tabpanel"][data-state="inactive"]'))return false;for(let n=node;n;n=n.parentElement){const style=getComputedStyle(n);if(n.hidden||style.display==='none'||style.visibility==='hidden')return false;}const r=node.getBoundingClientRect();return r.width>1&&r.height>1&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;}
 function findMain(){return [...document.querySelectorAll('[data-ds-part="main"]')].filter(usable).sort((a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return y.width*y.height-x.width*x.height;})[0]||null;}
 function sync(){
  raf=0;if(dead)return;state.updates++;
  if(body!==document.body){restore();body=document.body;state.body=body;refreshNeeded=true;}
  if(refreshNeeded)refreshBoundaries();
  const active=document.documentElement.getAttribute('data-dream-skin')==='active';
  if(!body||!active){restore();state.geometry=null;return;}
  if(!saved)saved=props.map(p=>[p,body.style.getPropertyValue(p),body.style.getPropertyPriority(p)]);
  const found=findMain();if(found!==main){if(main)observer?.unobserve(main);main=found;if(main)observer?.observe(main);}
  let area=null;if(main){const r=main.getBoundingClientRect(),left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);if(right>left&&bottom>top)area={left,top,width:right-left,height:bottom-top};}
  const vw=innerWidth,vh=innerHeight;let layers,geometry;
  if(config.mode==='layered'){
   const scale=Math.max(vw/config.width,vh/config.height),width=config.width*scale,height=config.height*scale,foreground={left:(vw-width)*config.focusX,top:(vh-height)*config.focusY,width,height,scale};
   layers={image:images.foreground+','+(area?images.frame:'none')+','+images.canvas,size:`${px(width)} ${px(height)},${area?px(area.width)+' '+px(area.height):'0px 0px'},100% 100%`,position:`${px(foreground.left)} ${px(foreground.top)},${area?px(area.left)+' '+px(area.top):'0px 0px'},0px 0px`,repeat:'no-repeat,no-repeat,no-repeat',attachment:'fixed,fixed,fixed'};
   geometry={viewport:{width:vw,height:vh},main:area,frame:area?{...area}:null,foreground};
  }else{
   const scale=area?Math.min(area.width/config.width,area.height/config.height):0,width=config.width*scale,height=config.height*scale,foreground=area?{left:area.left+(area.width-width)/2,top:area.top+(area.height-height)/2,width,height,scale}:null;
   layers={image:(area?images.foreground:'none')+','+images.canvas,size:`${px(width)} ${px(height)},100% 100%`,position:(foreground?px(foreground.left)+' '+px(foreground.top):'0px 0px')+',0px 0px',repeat:'no-repeat,no-repeat',attachment:'fixed,fixed'};
   geometry={viewport:{width:vw,height:vh},main:area,frame:area?{...area}:null,foreground};
  }
  for(const [key,value]of Object.entries(layers)){const p='background-'+key;let record=normalized.get(p);if(record?.raw!==value){normalizer.setProperty(p,value);record={raw:value,value:normalizer.getPropertyValue(p)};normalized.set(p,record);}if(body.style.getPropertyValue(p)!==record.value||body.style.getPropertyPriority(p)!=='important')body.style.setProperty(p,record.value,'important');}
  state.geometry=geometry;
  if(performance.now()<transitionUntil)schedule();
 }
 function schedule(){if(!dead&&!raf)raf=requestAnimationFrame(sync);}
 function transition(event){const target=event.target;if(!(target instanceof Element)||!boundaries.has(target))return;let ms=0;const style=getComputedStyle(target);for(const value of (style.transitionDuration+','+style.transitionDelay).split(',')){const n=parseFloat(value);if(Number.isFinite(n))ms=Math.max(ms,n*(value.trim().endsWith('ms')?1:1000));}if(event.type==='transitionrun')transitionUntil=Math.max(transitionUntil,performance.now()+Math.min(5000,ms*2+32));else transitionUntil=0;schedule();}
 const contentSelector='[data-ds-part="message"],[data-ds-part="composer"],[contenteditable="true"],textarea,pre,code,[data-markdown],.markdown,[class*="markdown"]';
 const mutations=new MutationObserver(records=>{
  if(records.some(r=>!r.target.closest?.(contentSelector)&&(r.type==='attributes'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&!n.matches?.(contentSelector)&&(boundaries.has(n)||n.matches?.(boundarySelector+',body')||n.querySelector?.(boundarySelector)))))){refreshNeeded=true;schedule();}
 });
 mutations.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ds-part','data-app-shell-active-page']});
 function scroll(event){const target=event.target;if(target===document||target===window||target instanceof Element&&main&&target!==main&&target.contains(main))schedule();}
 function isHealthy(){return !dead&&body===document.body&&!!saved&&body.style.getPropertyValue('background-image')===normalized.get('background-image')?.value;}
 window.addEventListener('resize',schedule);window.addEventListener('scroll',scroll,true);document.addEventListener('transitionrun',transition,true);document.addEventListener('transitionend',transition,true);document.addEventListener('transitioncancel',transition,true);
 function dispose(){if(dead)return;dead=true;if(raf)cancelAnimationFrame(raf);mutations.disconnect();boundaryObserver.disconnect();observer?.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',scroll,true);document.removeEventListener('transitionrun',transition,true);document.removeEventListener('transitionend',transition,true);document.removeEventListener('transitioncancel',transition,true);restore();for(const url of leases)URL.revokeObjectURL(url);state.geometry=null;state.body=null;if(window[KEY]===state)delete window[KEY];}
 window[KEY]=state;sync();return true;
}

export function removeWorkspaceBackground(){window.__CODEX_WORKSPACE_BACKGROUND__?.dispose();}
