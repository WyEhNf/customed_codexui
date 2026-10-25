import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export async function getMaterialUiConfig(root,id){
 if(!/^(columbina|sandrone|hutao|ayaka|nahida|furina|citlali|mitya|istaroth)$/.test(id))throw new Error('Unknown material character');
 let raw;try{raw=await fs.readFile(path.join(root,`characters/${id}/assets/ui/personality.json`),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;raw=await fs.readFile(path.join(root,`integration/materials/output/${id}/personality.json`),'utf8');}
 const config=JSON.parse(raw);if(config.schemaVersion!==1||config.id!==id)throw new Error('Material config identity mismatch');const iconContract=JSON.parse(await fs.readFile(path.join(root,'integration/icon-contract.json'),'utf8'));config.contract={...config.contract,settingsNavigation:iconContract.settingsNavigation};config.rendererRevision=createHash('sha256').update(await fs.readFile(path.join(root,'integration/material-ui.mjs'))).digest('hex');return config;
}

// This function is injected verbatim in the renderer: keep all browser dependencies inside it.
export function installMaterialUi(config){
 const KEY='__CODEX_CHARACTER_MATERIALS__',ATTR='data-codex-material-role';
 if(!config||config.schemaVersion!==1||!config.id||!config.ornament||!config.avatarFrame)return false;
 const fingerprint=`material-ui-v1:${config.id}:${config.revision}:${config.rendererRevision||''}`;
 if(window[KEY]?.fingerprint===fingerprint){window[KEY].sync();return true;}
 window[KEY]?.dispose();
 const host=document.createElement('div');host.id='codex-character-materials';host.setAttribute('aria-hidden','true');host.setAttribute('data-character',config.id);
 host.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483100;overflow:hidden;contain:strict;';
 const shadow=host.attachShadow({mode:'open'}),sheet=new CSSStyleSheet();
 sheet.replaceSync(`:host{pointer-events:none!important}.ornament{position:fixed;pointer-events:none!important;box-sizing:border-box;overflow:visible;isolation:isolate;color:var(--metal)}.ornament *{pointer-events:none!important;box-sizing:border-box}.rim{position:absolute;inset:0;border:1px solid transparent;border-image:linear-gradient(125deg,var(--light),var(--metal) 30%,var(--shadow) 65%,var(--metal)) 1;opacity:.7}.clasp{position:absolute;width:20px;height:20px;object-fit:contain;filter:drop-shadow(0 1px 1px #0008)}.tag .rim{inset:1px -2px;border-radius:7px;border-image:none;border-color:var(--metal);border-width:0 0 1px;opacity:.5}.tag .clasp{left:-11px;top:50%;transform:translateY(-50%);width:18px;height:23px}.menu-button .rim{inset:auto 5px 1px;height:1px;border-width:0 0 1px;opacity:.55}.menu-button .clasp{width:13px;height:14px;right:-5px;bottom:-5px}.menu-panel .rim{border-image:none;border-color:var(--metal);border-radius:inherit;opacity:.35}.menu-panel .clasp{width:25px;height:29px;right:-10px;top:-13px}.avatar .frame{width:100%;height:100%;display:block;object-fit:contain}.ornament.is-focused .rim{opacity:.95}.ornament.is-focused .clasp{filter:drop-shadow(0 0 3px var(--metal))}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`);
 shadow.adoptedStyleSheets=[sheet];document.documentElement.append(host);
 const settingsImageSheet=new CSSStyleSheet();settingsImageSheet.replaceSync('.settings-icon .rim{display:none}.settings-icon .clasp{width:8px;height:9px;right:-2px;bottom:-2px;filter:drop-shadow(0 1px 1px #0008)}');shadow.adoptedStyleSheets=[...shadow.adoptedStyleSheets,settingsImageSheet];
 const palette=config.palette||{};host.style.setProperty('--light',palette.light||'#f3f0e6');host.style.setProperty('--metal',palette.metal||'#cbb78b');host.style.setProperty('--shadow',palette.shadow||'#6e6380');
 const anchors=new Map(),roots=new Map();let raf=0,dead=false;
 const blocked='[data-ds-part="message"],[data-ds-part="composer"],[contenteditable="true"],textarea,pre,code,[data-markdown],.markdown,[class*="markdown"],[role="progressbar"],[data-character-material-exclude]';
 const safe=(node)=>node instanceof Element&&!node.closest(blocked)&&!node.closest('[data-danger="true"],[data-variant="danger"],[data-variant="destructive"]');
 function paintOpacity(node){let opacity=1;for(let p=node;p;p=p.parentElement||p.getRootNode()?.host)opacity*=Number(getComputedStyle(p).opacity);return opacity;}
 function visible(node){if(!node.isConnected)return false;const s=getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden')return false;for(let p=node;p;p=p.parentElement||p.getRootNode()?.host){if(p.hidden||Number(getComputedStyle(p).opacity)===0)return false;}const r=node.getBoundingClientRect();if(!r.width||!r.height||r.bottom<0||r.right<0||r.top>innerHeight||r.left>innerWidth)return false;return !!node.getClientRects().length;}
 function imageRect(node){const r=node.getBoundingClientRect();if(node.tagName!=='IMG'||!node.naturalWidth||!node.naturalHeight)return r;const s=getComputedStyle(node);if(s.objectFit!=='contain')return r;const scale=Math.min(r.width/node.naturalWidth,r.height/node.naturalHeight),w=node.naturalWidth*scale,h=node.naturalHeight*scale;return {left:r.left+(r.width-w)/2,top:r.top+(r.height-h)/2,width:w,height:h};}
 function forget(node,record){record.el.remove();if(node.getAttribute(ATTR)===record.kind){if(record.previous===null)node.removeAttribute(ATTR);else node.setAttribute(ATTR,record.previous);}resizeObserver?.unobserve(node);anchors.delete(node);}
 function add(node,kind,character=config.id){if(!safe(node)||!visible(node))return;const avatar=kind==='avatar'||kind==='user-avatar';let record=anchors.get(node);if(record&&record.kind!==kind){forget(node,record);record=null;}if(!record){const el=document.createElement('div');el.className='ornament '+kind+(kind==='user-avatar'?' avatar':'');el.setAttribute('data-kind',kind);el.setAttribute('data-character',character);if(avatar){const img=document.createElement('img');img.className='frame';img.alt='';img.src=config.galleryFrames?.[character]||config.avatarFrame;el.append(img);}else{const rim=document.createElement('div');rim.className='rim';const img=document.createElement('img');img.className='clasp';img.alt='';img.src=config.ornament;el.append(rim,img);}shadow.append(el);record={el,kind,previous:node.getAttribute(ATTR)};anchors.set(node,record);node.setAttribute(ATTR,kind);resizeObserver?.observe(node);}record.seen=true;const r=avatar?imageRect(node):node.getBoundingClientRect();const pad=avatar?Math.max(4,r.width*.15):0;record.el.style.left=(r.left-pad)+'px';record.el.style.top=(r.top-pad)+'px';record.el.style.width=(r.width+2*pad)+'px';record.el.style.height=(r.height+2*pad)+'px';record.el.style.borderRadius=getComputedStyle(node).borderRadius;record.el.style.opacity=String(paintOpacity(node));record.el.classList.toggle('is-focused',node.matches(':focus-visible,:hover')||node.getAttribute('aria-expanded')==='true'||node.getAttribute('aria-current')==='true');}
 // Verified Codex 26.1021 navigation rail footer. Never inspect user text or image URLs.
 function userAvatars(){const result=[];for(const rail of document.querySelectorAll('nav[data-app-navigation-rail]')){const footer=rail.lastElementChild;if(!footer||footer.matches('[class~="group/nav-list"]'))continue;for(const button of footer.querySelectorAll('button[aria-haspopup="menu"]')){if(button.closest('[data-settings-panel-slug]'))continue;const candidates=[...button.querySelectorAll('img.rounded-full,.rounded-full,[class*="_ButtonInner_"] > span.relative.isolate.inline-flex.shrink-0')];const node=candidates.find(n=>{const r=n.getBoundingClientRect();return r.width>=20&&r.width<=48&&r.height>=20&&r.height<=48&&Math.abs(r.width-r.height)<3;});if(node){const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(hit&&(hit===node||node.contains(hit)||button.contains(hit)))result.push(node);}}}return result;}
 function observeRoot(root){if(!root||roots.has(root))return;const ob=new MutationObserver(schedule);ob.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','role','aria-expanded','aria-current','hidden','src','data-state','data-dream-skin']});roots.set(root,ob);root.addEventListener('scroll',schedule,true);root.addEventListener('load',schedule,true);}
 function sync(){raf=0;if(dead)return;const active=document.documentElement.getAttribute('data-dream-skin')==='active';host.hidden=!active;if(!active)return;for(const r of anchors.values())r.seen=false;
  const openingHost=document.getElementById('sandrone-opening'),opening=openingHost?.shadowRoot,switcher=document.getElementById('codex-character-switcher')?.shadowRoot;observeRoot(opening);observeRoot(switcher);
  // The material layer sits above the modal opening to frame its brand avatar.
  // Layout visibility alone cannot detect that the opening occludes the app below it.
  if(openingHost){for(const avatar of opening?.querySelectorAll('.brand .avatar')||[])add(avatar,'avatar');}
  else{
   const menuSelector=config.contract?.menuBar||'[class*="ApplicationMenuTopBar_"]';
   for(const bar of document.querySelectorAll(menuSelector)){for(const item of bar.querySelectorAll('button,[role="menuitem"]')){const label=(item.getAttribute('aria-label')||item.textContent||'').trim();if(/^(文件|File)(?:\s*\([A-Z]\))?$/.test(label)){add(item,'menu-button');break;}}}
   for(const panel of document.querySelectorAll('[role="menu"]'))if(!panel.closest('#codex-character-switcher,#sandrone-opening'))add(panel,'menu-panel');
   const project=config.contract?.projectSelector||'[class~="group/project-selector"]';for(const holder of document.querySelectorAll(project)){const button=holder.matches('button')?holder:holder.querySelector('button');if(button)add(button,'tag');}
   for(const avatar of userAvatars())add(avatar,'user-avatar');
   // Some Settings rows ship a raster asset rather than an SVG. Keep that
   // native icon and its semantic colours, and attach the same small CG clasp.
   const slugs=config.contract?.settingsNavigation?.slugs||['general-settings','appearance','notifications','personalization','keyboard-shortcuts','agent','git-settings','code-review','usage','analytics','browser-use','computer-use','local-environments','worktrees','mcp-settings','gateways','hooks-settings','connections','plugins-settings','file-type-handlers','skills-settings','security','data-controls','pets','codex-cloud','cloud-environments','cloud-settings'];
   for(const row of document.querySelectorAll('nav [data-settings-panel-slug]')){const slug=row.getAttribute('data-settings-panel-slug');if(!slugs.includes(slug)||['teams','account','profile'].includes(slug)||!safe(row))continue;const icon=[...row.querySelectorAll('img')].find(img=>{const r=img.getBoundingClientRect();return r.width>=12&&r.width<=32&&r.height>=12&&r.height<=32;});if(icon)add(icon,'settings-icon');}
   for(const avatar of switcher?.querySelectorAll('button.character[data-character] > img')||[])add(avatar,'avatar',avatar.parentElement.dataset.character);
  }
  for(const [node,record]of anchors)if(!record.seen)forget(node,record);
  for(const [root,ob]of roots)if(root instanceof ShadowRoot&&!root.host.isConnected){ob.disconnect();root.removeEventListener('scroll',schedule,true);root.removeEventListener('load',schedule,true);roots.delete(root);}
  // Follow only finite brand/panel entrance and exit motion. Particle/video loops never keep this layer polling.
  const moving=(openingHost?[opening?.querySelector('.brand'),opening?.querySelector('.scene')]:[switcher?.querySelector('.panel')]).some(node=>node?.getAnimations?.().some(animation=>animation.playState==='running'||animation.playState==='pending'));if(moving)schedule();
 }
 function schedule(){if(!dead&&!raf)raf=requestAnimationFrame(sync);}
 const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
 observeRoot(document.documentElement);window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);window.addEventListener('focusin',schedule,true);window.addEventListener('pointerover',schedule,true);
 function dispose(){if(dead)return;dead=true;if(raf)cancelAnimationFrame(raf);resizeObserver?.disconnect();for(const [node,r]of [...anchors])forget(node,r);for(const [root,ob]of roots){ob.disconnect();root.removeEventListener('scroll',schedule,true);root.removeEventListener('load',schedule,true);}roots.clear();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);window.removeEventListener('focusin',schedule,true);window.removeEventListener('pointerover',schedule,true);host.remove();if(window[KEY]?.fingerprint===fingerprint)delete window[KEY];}
 window[KEY]={fingerprint,id:config.id,sync:schedule,dispose};sync();return true;
}

export function removeMaterialUi(){window.__CODEX_CHARACTER_MATERIALS__?.dispose();}
