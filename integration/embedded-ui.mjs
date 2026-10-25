// Fixed integration UI. Character packs provide data and images, never scripts.
export function installCharacterSwitcher(config) {
 const key='__CODEX_CHARACTER_SWITCHER__',fingerprint=JSON.stringify(config);
 if(window[key]?.fingerprint===fingerprint&&window[key].host.isConnected){window[key].sync();return {installed:true};}
 window[key]?.dispose?.();
 const host=document.createElement('div');host.id='codex-character-switcher';
 host.style.cssText='position:fixed;inset:0;z-index:2147482950;pointer-events:none';
 const shadow=host.attachShadow({mode:'open'}),p=config.palette;
 const sheet=new CSSStyleSheet();sheet.replaceSync(`
 :host{font:12px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;color:${p.text};color-scheme:dark}
 *{box-sizing:border-box} [hidden]{display:none!important}
 button{font:inherit;color:inherit;cursor:pointer;-webkit-app-region:no-drag;pointer-events:auto}
 .trigger{position:absolute;right:260px;top:5px;height:26px;padding:0 9px;border:1px solid ${p.line};border-radius:6px;background:${p.panel};color:${p.accent};white-space:nowrap}
 .trigger:hover,.trigger[aria-expanded=true]{background:${p.panelAlt};border-color:${p.accent}}
 button:focus-visible{outline:2px solid ${p.accent};outline-offset:2px}
 .panel{position:absolute;right:160px;top:40px;width:342px;max-width:calc(100vw - 24px);max-height:calc(100vh - 64px);overflow:auto;pointer-events:auto;-webkit-app-region:no-drag;background:${p.panel};border:1px solid ${p.line};border-radius:12px;box-shadow:0 14px 48px #0009;padding:14px}
 .heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:5px}
 h2{font-size:14px;letter-spacing:.08em;margin:0;color:${p.text}}
 .close{border:0;background:transparent;color:${p.muted};font-size:20px;width:26px;height:26px;line-height:22px;border-radius:4px}
 .close:hover{background:${p.panelAlt};color:${p.text}}
 .hint{font-size:11px;color:${p.muted};margin:0 0 12px}
 .list{display:grid;grid-template-columns:1fr 1fr;gap:7px}
 .character{display:flex;align-items:center;gap:8px;min-height:60px;padding:8px;text-align:left;border:1px solid ${p.line};border-radius:8px;background:${p.background};min-width:0}
 .character:hover{border-color:${p.accent};background:${p.panelAlt}}
 .character[aria-current=true]{border-color:${p.accent};background:${p.panelAlt}}
 .character:disabled{cursor:wait;opacity:.6}
 img{width:34px;height:42px;object-fit:contain;flex:none}
 .copy{min-width:0}.name{display:block;font-size:12px;color:${p.text};white-space:nowrap}.theme{display:block;font-size:10px;color:${p.muted};white-space:nowrap}.current{font-size:10px;color:${p.accent};margin-left:3px}
 .status{font-size:11px;color:${p.muted};margin:12px 0 0;min-height:17px;overflow-wrap:anywhere}.status[data-error=true]{color:#ffb5b5}
 @media(max-width:430px){.panel{width:316px}.list{gap:5px}.character{padding:6px}}
 `);shadow.adoptedStyleSheets=[sheet];
 shadow.innerHTML='<button class="trigger" type="button" aria-expanded="false" aria-controls="character-panel" aria-haspopup="dialog">✦ 切换角色</button><section class="panel" id="character-panel" role="dialog" aria-label="切换角色主题" hidden><div class="heading"><h2>角色主题</h2><button class="close" type="button" aria-label="关闭角色列表">×</button></div><p class="hint">切换后播放一次开屏 · 聊天与项目保留</p><div class="list"></div><p class="status" role="status" aria-live="polite"></p></section>';
 const trigger=shadow.querySelector('.trigger'),panel=shadow.querySelector('.panel'),list=shadow.querySelector('.list'),status=shadow.querySelector('.status');
 let busy=false,timer;
 const notify=(message,error=false)=>{status.textContent=message;status.dataset.error=String(error);};
 const close=()=>{panel.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus({preventScroll:true});};
 const choose=id=>{
  if(busy)return;
  if(typeof window.codexSwitchCharacter!=='function'){notify('主题连接正在恢复，请稍后重试。',true);return;}
  const token=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const request={id,requestId:[token.slice(0,8),token.slice(8,12),token.slice(12,16),token.slice(16,20),token.slice(20)].join('-')};
  busy=true;window[key].pending=request;for(const button of list.children)button.disabled=true;
  notify('正在切换角色，请稍候…');
  // A detached worker finishes the transaction after the old watcher is stopped.
  timer=setTimeout(()=>window[key]?.settle(request.requestId,{status:'error',message:'切换耗时较长，请稍后重试。'}),120000);
  try{window.codexSwitchCharacter(JSON.stringify(request));}catch{window[key].settle(request.requestId,{status:'error',message:'主题连接暂时不可用，请稍后重试。'});}
 };
 for(const c of config.characters){
  const button=document.createElement('button');button.type='button';button.className='character';button.dataset.character=c.id;
  button.setAttribute('aria-current',String(c.id===config.selectedId));button.setAttribute('aria-label',c.name+' · '+c.themeName+(c.id===config.selectedId?'，当前角色，再次选择重播开屏':''));
  const image=document.createElement('img');image.src=c.avatar;image.alt='';
  const copy=document.createElement('span');copy.className='copy';const name=document.createElement('span');name.className='name';name.textContent=c.name;
  if(c.id===config.selectedId){const mark=document.createElement('span');mark.className='current';mark.textContent='✓';name.append(mark);}
  const theme=document.createElement('span');theme.className='theme';theme.textContent=c.themeName;copy.append(name,theme);button.append(image,copy);button.onclick=()=>choose(c.id);list.append(button);
 }
 const sync=()=>{
  const replay=document.getElementById('sandrone-replay-opening'),r=replay&&!replay.hidden?replay.getBoundingClientRect():null;
  let top=5,right=150;
  if(r?.width){top=r.top;right=innerWidth-r.left+8;}
  else{
   const overlay=navigator.windowControlsOverlay;let area;try{area=overlay?.getTitlebarAreaRect();}catch{}
   if(overlay?.visible&&area?.height>0&&area.height<=70){top=area.y+Math.max(1,(area.height-26)/2);right=innerWidth-area.x-area.width+12;}
   else if(document.fullscreenElement||matchMedia('(display-mode: fullscreen)').matches){top=12;right=12;}
  }
  // Narrow windows keep both controls inside the viewport without moving app content.
  trigger.style.right=Math.max(12,Math.min(right,innerWidth-trigger.offsetWidth-12))+'px';trigger.style.top=top+'px';
  panel.style.right=Math.max(12,Math.min(parseFloat(trigger.style.right),innerWidth-panel.offsetWidth-12))+'px';panel.style.top=(top+34)+'px';
 };
 trigger.onclick=()=>{if(!panel.hidden){close();return;}panel.hidden=false;trigger.setAttribute('aria-expanded','true');sync();(list.querySelector('[aria-current=true]')||list.firstElementChild)?.focus({preventScroll:true});};
 shadow.querySelector('.close').onclick=close;
 const outside=e=>{if(!panel.hidden&&!e.composedPath().includes(host))close();};
 document.addEventListener('pointerdown',outside,true);
 shadow.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
  const buttons=[...list.children],index=buttons.indexOf(shadow.activeElement);let next;
  if(['ArrowRight','ArrowDown'].includes(e.key))next=(index+1+buttons.length)%buttons.length;
  if(['ArrowLeft','ArrowUp'].includes(e.key))next=(index-1+buttons.length)%buttons.length;
  if(e.key==='Home')next=0;if(e.key==='End')next=buttons.length-1;
  if(next!==undefined){e.preventDefault();buttons[next]?.focus();}
 });
 window.addEventListener('resize',sync);document.addEventListener('fullscreenchange',sync);
 const overlay=navigator.windowControlsOverlay;overlay?.addEventListener('geometrychange',sync);
 const observer=new MutationObserver(sync);observer.observe(document.documentElement,{childList:true});const replay=document.getElementById('sandrone-replay-opening');if(replay)observer.observe(replay,{attributes:true,attributeFilter:['style','hidden']});
 window[key]={fingerprint,host,sync,pending:null,settle(requestId,result){
  if(!this.pending||this.pending.requestId!==requestId)return false;
  const selected=this.pending.id;clearTimeout(timer);this.pending=null;busy=false;for(const button of list.children)button.disabled=false;
  if(!panel.hidden)list.querySelector('[data-character="'+selected+'"]')?.focus({preventScroll:true});
  notify(result.message||'切换未完成，请重试。',result.status==='error');return true;
 },report(result){
  if(this.pending&&result.requestId===this.pending.requestId)this.settle(result.requestId,result);
  if(result.status==='error'){notify(result.message,true);panel.hidden=false;trigger.setAttribute('aria-expanded','true');sync();}
 },dispose(){clearTimeout(timer);observer.disconnect();document.removeEventListener('pointerdown',outside,true);window.removeEventListener('resize',sync);document.removeEventListener('fullscreenchange',sync);overlay?.removeEventListener('geometrychange',sync);host.remove();delete window[key];}};
 document.documentElement.append(host);sync();
 notify(config.notice||'当前：'+(config.characters.find(c=>c.id===config.selectedId)?.name||''),Boolean(config.notice));
 return {installed:true,selectedId:config.selectedId,characters:list.children.length};
}
export function removeCharacterSwitcher(){window.__CODEX_CHARACTER_SWITCHER__?.dispose?.();return {removed:true};}
