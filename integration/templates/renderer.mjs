// Trusted, fixed engine code. Imported theme packages cannot supply JavaScript.
export function installNativeUi(css) {
 const key='__SANDRONE_NATIVE_UI__';
 if(window[key]?.version==='0.5.3'&&window[key]?.css===css&&document.adoptedStyleSheets.includes(window[key].sheet)){window[key].syncCaption();return {installed:true};}
 window[key]?.dispose?.();
 const sheet=new CSSStyleSheet();sheet.replaceSync(css);
 document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet];
 let removeCaption=()=>{},syncCaption=()=>{};
 const overlay=typeof navigator==='object'&&navigator.windowControlsOverlay;
 if(overlay&&typeof overlay.getTitlebarAreaRect==='function'){
  const backing=document.createElement('div');backing.id='sandrone-caption-backing';
  backing.setAttribute('aria-hidden','true');backing.hidden=true;
  document.documentElement.appendChild(backing);
  const replay=document.createElement('button');replay.id='sandrone-replay-opening';replay.type='button';
  replay.textContent='↻  重播开屏';replay.title='在当前窗口重播桑多涅开屏，不重启 Codex';replay.setAttribute('aria-label','重播桑多涅开屏动画');
  replay.addEventListener('click',()=>{if(typeof window.sandroneReplayOpening==='function'){window.sandroneReplayOpening('replay');}else{replay.title='主题连接正在恢复，请稍后再试';}});
  document.documentElement.appendChild(replay);
  // Never duplicate OS glyphs: use the official read-only native theme signal
  // to choose a contrasting surface under the actual native buttons.
  const bridge=window.electronBridge;
  let seenGeometry=false;
  const sync=()=>{
   let tone;try{tone=bridge?.getSystemThemeVariant?.();}catch{}
   backing.style.setProperty?.('--sandrone-caption-surface',tone==='light'?'#c8c4b7':tone==='dark'?'#19232f':'#897350');
   let area;try{area=overlay.getTitlebarAreaRect();}catch{}
   let width=area?window.innerWidth-area.x-area.width:0;
   const valid=overlay.visible&&area?.x<=1&&width>=60&&width<=240&&area.height>0&&area.height<=70;
   const full=Boolean(document.fullscreenElement)||window.matchMedia?.('(display-mode: fullscreen)').matches;
   // At cold start WCO may return zero before its first geometry event.
   // Use the app's measured menu bar only until genuine WCO geometry arrives.
   const bar=!valid&&!seenGeometry?document.querySelector('[class*="ApplicationMenuTopBar_"]')?.getBoundingClientRect():null;
   const fallback=bar&&bar.y<=1&&bar.height>=24&&bar.height<=70&&bar.width>=320;
   backing.hidden=Boolean(full||(!valid&&!fallback));
   if(valid){seenGeometry=true;backing.style.top=area.y+'px';backing.style.height=area.height+'px';backing.style.width=width+'px';}
   else if(!backing.hidden){backing.style.top='0px';backing.style.height=bar.height+'px';backing.style.width=Math.min(240,bar.height*138/36)+'px';}
   replay.hidden=backing.hidden;replay.style.right=(parseFloat(backing.style.width||'137')+12)+'px';replay.style.top=(parseFloat(backing.style.top||'0')+Math.max(1,(parseFloat(backing.style.height||'36')-26)/2))+'px';
  };
  const unsubscribeTone=bridge?.subscribeToSystemThemeVariant?.(sync);
  overlay.addEventListener('geometrychange',sync);
  window.addEventListener?.('resize',sync);document.addEventListener?.('fullscreenchange',sync);
  // One lightweight observer handles late header creation/replacement, rather
  // than relying on repeated full theme injection from a background process.
  const observer=typeof MutationObserver==='function'?new MutationObserver(()=>{if(!backing.isConnected)document.documentElement.appendChild(backing);if(!replay.isConnected)document.documentElement.appendChild(replay);sync();}):null;
  observer?.observe(document.documentElement,{childList:true,subtree:false});
  syncCaption=sync;sync();removeCaption=()=>{unsubscribeTone?.();observer?.disconnect();overlay.removeEventListener('geometrychange',sync);window.removeEventListener?.('resize',sync);document.removeEventListener?.('fullscreenchange',sync);backing.remove();replay.remove();};
 }
 window[key]={version:'0.5.3',css,sheet,syncCaption,dispose(){removeCaption();document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==sheet);delete window[key];}};
 return {installed:true};
}
export function removeNativeUi(){
 window.__SANDRONE_OPENING__?.dispose?.('restore');
 window.__SANDRONE_NATIVE_UI__?.dispose?.();
 delete window.__SANDRONE_STARTUP__;
 return {removed:true};
}
export function setStartupPhase(phase){
 if(!['connecting','applying','waiting','ready','error'].includes(phase))return false;
 window.__SANDRONE_STARTUP__={phase,updated:Date.now()};
 window.__SANDRONE_OPENING__?.setPhase?.(phase);
 return true;
}
export function showOpening(assets,options={}) {
 if(window.__SANDRONE_OPENING__)return {shown:false,reason:'already-present'};
 const host=document.createElement('div');host.id='sandrone-opening';
 host.style.cssText='position:fixed;inset:0;z-index:2147483000;display:block;isolation:isolate;';
 const shadow=host.attachShadow({mode:'open'});
 const style=new CSSStyleSheet();style.replaceSync(`
 :host{font-family:"Segoe UI","Microsoft YaHei",sans-serif;color:#eee9dc;--gold:#d3b77e;--ice:#a8ddea}
 *{box-sizing:border-box} .scene{position:absolute;inset:0;overflow:hidden;background:#0b111b;opacity:1;transition:opacity .7s cubic-bezier(.2,.65,.3,1);outline:0}
 .scene.leaving{opacity:0;pointer-events:none}
 .scene.leaving .copy,.scene.leaving .brand,.scene.leaving .bottom{opacity:0;animation:none;transition:opacity .28s ease}
 .back{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.6;animation:back-in 1.8s ease both}
 .motion{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:70% center;opacity:0;transition:opacity .25s ease;pointer-events:none}
 .motion-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:70% center;opacity:0;transition:opacity .3s ease;pointer-events:none}
 .motion-pending .motion-poster{opacity:1}.motion-pending .character,.motion-pending .back{opacity:0;animation:none}
 .motion-ready .motion-poster{opacity:0}
 .motion-ready .motion{opacity:1}.motion-ready .character{opacity:0;animation:none}.motion-ready .back{opacity:0;animation:none}
 .motion-ready .gear,.motion-ready .iris{opacity:.06}.motion-ready .strings{opacity:.2}.motion-ready .orbit{opacity:.2}.motion-ready .grain{opacity:.035}
 .trace-frame,.mechanism-frame,.source-motion-frame{position:absolute;width:max(100vw,177.77778vh);height:max(100vh,56.25vw);left:70%;top:50%;transform:translate(-70%,-50%);pointer-events:none;opacity:0;transition:opacity .95s ease}
 .trace-frame svg,.mechanism-frame svg{width:100%;height:100%;overflow:hidden}
 .mechanism-frame svg{filter:drop-shadow(0 0 1.6px #7fdcec60)}
 .trace-frame path{fill:none;stroke:#e9aa63;stroke-width:.95;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:trace-draw var(--duration) var(--delay) cubic-bezier(.25,.5,.4,1) both}
 .trace-frame .face-path{stroke:#ffd19a;stroke-width:1.25}
 .trace-frame path{vector-effect:non-scaling-stroke}
 .trace-frame .water-path{stroke:#88becb;stroke-width:.85;opacity:.45}
 .water-lines{opacity:.4;filter:drop-shadow(0 0 1.6px #7fdcec60)}
 .mechanism-frame path,.mechanism-frame circle{fill:none;stroke:#b8c9c2;stroke-width:1;stroke-linejoin:round}
 .mechanism-frame circle{stroke:#b9a172;stroke-width:.8}
 .mechanism-rotor{transform-origin:1000px 355px;animation:orbit 36s linear infinite}
 .trace-intro .trace-frame{opacity:.9}.trace-intro .mechanism-frame{opacity:.2}
 .trace-intro .gear,.trace-intro .iris,.trace-intro .strings,.trace-intro .orbit,.trace-intro .grain{display:none}
 .trace-intro .motion,.trace-intro .motion-poster{transition:opacity 1.15s ease}
 .trace-intro.motion-pending .motion-poster{opacity:0}.trace-intro.color-reveal.motion-pending .motion-poster{opacity:1}
 .trace-intro.motion-ready .motion-poster{opacity:0}.trace-intro.color-reveal .trace-frame{opacity:0}
 .trace-intro.color-reveal .mechanism-frame{opacity:.11}
 .source-motion-frame video{width:100%;height:100%;display:block;object-fit:fill}.prerender-ready .mechanism-frame{display:none}
 .source-trace-ready .source-motion-frame{opacity:.9;transition:opacity 1.15s ease}
 .source-trace-ready .mechanism-frame,.source-trace-ready .water-lines{display:none}
 .source-trace-ready.color-reveal .source-motion-frame{opacity:0}
 @keyframes trace-draw{0%{stroke-dashoffset:1;opacity:0}8%{opacity:.95}100%{stroke-dashoffset:0;opacity:.9}}
 /* The character material turns first, then the complete scene is revealed. */
 .entrance-seal{position:absolute;left:69%;top:50%;width:min(54vh,48vw);aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none;opacity:1;transition:opacity .8s ease;filter:drop-shadow(0 0 12px color-mix(in srgb,var(--ice) 18%,transparent))}
 .entrance-seal svg{width:100%;height:100%;overflow:visible}
 .entrance-seal .seal-rotor{transform-origin:192px 192px;animation:seal-turn 1.3s cubic-bezier(.12,.62,.18,1) both}
 .entrance-seal .seal-counter{transform-origin:192px 192px;animation:seal-counter 1.3s cubic-bezier(.12,.62,.18,1) both}
 .entrance-seal .seal-material{animation:seal-material 1.3s ease both}
 .character-entrance .back,.character-entrance .character{animation:none}
 .character-entrance:not(.entrance-revealed) .back,.character-entrance:not(.entrance-revealed) .character,.character-entrance:not(.entrance-revealed) .motion,.character-entrance:not(.entrance-revealed) .motion-poster{opacity:0!important}
 .character-entrance.full-scene:not(.entrance-revealed)::before{opacity:0!important}
 .character-entrance.full-scene::before{transition:opacity 1.1s ease}
 .character-entrance .motion,.character-entrance .motion-poster{transition:opacity 1.1s ease}
 .character-entrance.media-fallback .motion-poster{transition:opacity .25s ease}
 .character-entrance.entrance-revealed .entrance-seal{opacity:0}
 .character-entrance .brand{animation-delay:1.1s}.character-entrance .copy{animation-delay:1.2s}
 .character-entrance .signature-title path{animation-delay:calc(var(--delay) + 1100ms)}
 .character-entrance .gear,.character-entrance .iris,.character-entrance .strings,.character-entrance .orbit,.character-entrance .particle,.character-entrance .sweep{display:none}
 @keyframes seal-turn{0%{transform:rotate(-145deg) scale(.86);opacity:0}16%{opacity:1}78%{transform:rotate(4deg) scale(1)}100%{transform:rotate(0deg) scale(1);opacity:.95}}
 @keyframes seal-counter{from{transform:rotate(65deg);opacity:0}20%{opacity:.7}to{transform:rotate(0deg);opacity:.55}}
 @keyframes seal-material{0%,8%{opacity:0}40%,100%{opacity:1}}
 .grain{position:absolute;inset:0;opacity:.12;background-image:linear-gradient(90deg,transparent 99%,#a8ddea 100%),linear-gradient(0deg,transparent 99%,#a8ddea 100%);background-size:64px 64px;animation:drift 18s linear infinite}
 .orbit{position:absolute;width:64vh;height:64vh;left:57%;top:15%;border:1px solid #c8a16a55;border-radius:50%;animation:orbit 22s linear infinite}
 .orbit:before,.orbit:after{content:"";position:absolute;border:1px dashed #d3b77e66;inset:-7%;border-radius:50%}.orbit:after{inset:10%;border-style:solid;border-color:#a8ddea44}
 .gear{position:absolute;width:69vh;height:69vh;left:56%;top:12%;opacity:.32;animation:orbit 34s linear infinite}
 .iris{position:absolute;width:30vh;height:30vh;left:48%;bottom:-6%;opacity:.25;animation:reverse-orbit 16s linear infinite}
 .strings{position:absolute;width:20vh;height:20vh;left:46%;top:10%;opacity:.6;transform-origin:50% 0;animation:sway 3.4s ease-in-out infinite}
 .character{position:absolute;width:104vw;height:92vh;object-fit:contain;left:24%;top:4%;filter:brightness(0);opacity:0;animation:character 1.65s .35s ease both,float 5s 2s ease-in-out infinite}
 .sweep{position:absolute;left:44%;top:-15%;height:130%;width:12%;background:linear-gradient(90deg,transparent,#a8ddea18,transparent);transform:rotate(20deg) translateX(-350%);animation:sweep 3.3s .5s ease-in-out both;mix-blend-mode:screen;pointer-events:none}
 .shade{position:absolute;inset:0;background:linear-gradient(90deg,#0b111bfc 0%,#0b111bf0 32%,#0b111b9c 48%,transparent 72%)}
 .edge{position:absolute;inset:24px;border:1px solid #c8a16a40;pointer-events:none}.edge:before,.edge:after{content:"";position:absolute;width:58px;height:58px;border-top:2px solid var(--gold);border-left:2px solid var(--gold);left:-1px;top:-1px}.edge:after{left:auto;top:auto;right:-1px;bottom:-1px;transform:rotate(180deg)}
 .brand{position:absolute;left:5%;top:7%;display:flex;align-items:center;gap:13px;font-size:11px;letter-spacing:.15em;color:var(--gold);animation:rise .8s .15s both}.avatar{width:31px;height:31px}
 .copy{position:absolute;left:6%;top:28%;width:46%;animation:rise .55s .1s both}.label{font-size:11px;letter-spacing:.2em;color:var(--gold)}
 h1{font-family:Georgia,serif;font-size:clamp(32px,5.2vw,76px);font-weight:400;letter-spacing:.035em;margin:24px 0 6px}
 .signature-title{margin:18px 0 8px;width:100%;max-width:560px;height:auto;aspect-ratio:1080/330;line-height:0}
 .signature-title svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 2px #85d9e63d)}
 .signature-title path{fill:none;stroke:#c5edf2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:signature-write var(--duration) var(--delay) linear both}
 @keyframes signature-write{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
 .sub{font-size:clamp(12px,1.4vw,20px);letter-spacing:.38em;color:var(--gold)}
 .rule{width:84px;height:1px;margin:29px 0;background:linear-gradient(90deg,var(--gold),transparent);transform-origin:0 50%;animation:line 1s 1s both}
 .cn{font-size:44px;line-height:1.2;font-weight:700;letter-spacing:normal}
 .bottom{position:absolute;left:6%;bottom:10%;width:34%;animation:rise .8s 1s both}.status{font-size:12px;color:#c8d4df;letter-spacing:.09em}
 .track{margin-top:14px;height:2px;background:#d3b77e22;overflow:hidden}.progress{height:100%;width:100%;background:linear-gradient(90deg,#946641,#ecd399,#a8ddea);transform:scaleX(.333);transform-origin:0 50%;transition:transform .32s ease}
 .hint{margin-top:13px;color:#96a9bb;font-size:10px;letter-spacing:.12em}.footer{position:absolute;right:4%;bottom:5%;font-size:10px;color:#d3b77eaa;letter-spacing:.12em}
 .art-lettering{position:relative}.art-lettering .lettering-fallback{color:transparent!important;text-shadow:none!important}.art-lettering .lettering-surface{position:absolute;left:0;top:0;height:100%;max-width:100%;pointer-events:none;overflow:visible;fill:currentColor}.cn.art-lettering .lettering-surface{filter:drop-shadow(0 1px 0 #fff2) drop-shadow(0 0 7px #a8ddea24)}
 .sigils{position:absolute;right:4%;top:7%;display:flex;gap:15px;opacity:.65}.sigils img{width:23px;height:23px;object-fit:contain;animation:pulse 3s ease-in-out infinite}.sigils img:nth-child(2){animation-delay:.5s}.sigils img:nth-child(3){animation-delay:1s}
 .particle{position:absolute;width:2px;height:2px;background:#d5f3ff;border-radius:50%;box-shadow:0 0 8px #a8ddea;animation:spark 4s ease-in-out infinite;pointer-events:none}
 @keyframes character{0%{opacity:0;filter:brightness(0);transform:translateY(18px)}35%{opacity:.6;filter:brightness(.15)}100%{opacity:1;filter:brightness(1);transform:translateY(0)}}
 @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
 @keyframes orbit{to{transform:rotate(360deg)}}@keyframes reverse-orbit{to{transform:rotate(-360deg)}}
 @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes line{from{transform:scaleX(0)}to{transform:scaleX(1)}}
 @keyframes spark{0%,100%{opacity:0;transform:translateY(10px) scale(.5)}40%{opacity:.8}75%{opacity:.35;transform:translateY(-28px) scale(1.2)}}
 @keyframes sweep{to{transform:rotate(20deg) translateX(650%)}}@keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
 @keyframes drift{to{transform:translate(-32px,16px)}}@keyframes pulse{50%{opacity:.4;filter:drop-shadow(0 0 6px #a8ddea)}}@keyframes back-in{from{opacity:0}to{opacity:.6}}
 @media(max-width:800px){.copy{left:6%;top:29%;width:52%}.brand{font-size:9px}.cn{font-size:40px}.bottom{width:44%}.edge{inset:15px}}
 @media(prefers-reduced-motion:reduce){*{animation:none !important;transition-duration:.05s !important}.character{opacity:1;filter:none}.progress{transform:scaleX(1)}.signature-title path{stroke-dashoffset:0}}
 `);shadow.adoptedStyleSheets=[style];
 shadow.innerHTML=`<div class="scene" tabindex="0" role="dialog" aria-label="桑多涅开屏，双击或连续按两次空格跳过" aria-modal="true"><div class="back"></div><img class="motion-poster" alt=""><video class="motion" muted playsinline preload="auto" aria-hidden="true"></video><div class="grain"></div><div class="orbit"></div><img class="gear" alt=""><img class="iris" alt=""><img class="strings" alt=""><img class="character" alt="桑多涅"><div class="sweep"></div><div class="shade"></div><div class="edge"></div><div class="brand"><img class="avatar" alt=""><span>THE MARIONETTE WORKSHOP</span></div><div class="sigils"><img alt=""><img alt=""><img alt=""></div><div class="copy"><div class="label">FATUI / NO. 007</div><h1 class="title">SANDRONE</h1><div class="sub">MARIONETTE</div><div class="rule"></div><div class="cn">CodeX</div></div><div class="bottom"><div class="status" aria-live="polite">解算开始。</div><div class="track"><div class="progress"></div></div><div class="hint">双击任意处 · 或连续按两次空格跳过</div></div><div class="footer">OFFICIAL CODEX · SANDRONE EDITION</div></div>`;
 const scene=shadow.querySelector('.scene');
 const node=(name,attributes={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [key,value]of Object.entries(attributes))n.setAttribute(key,value);return n;};
 const setOpeningText=(element,text,glyph)=>{
  if(!element)return;
  if(!glyph||glyph.text!==text){element.textContent=text;return;}
  if(element.__openingArtText===text)return;element.__openingArtText=text;
  element.textContent='';element.classList.add('art-lettering');element.setAttribute('data-art-text',text);
  const fallback=document.createElement('span');fallback.className='lettering-fallback';fallback.textContent=text;
  const svg=node('svg',{viewBox:`0 0 ${glyph.width} ${glyph.height}`,preserveAspectRatio:'xMinYMid meet','aria-hidden':'true',focusable:'false','class':'lettering-surface'});
  svg.style.width=`min(100%,${(glyph.width/glyph.height*1.2).toFixed(4)}em)`;
  svg.appendChild(node('path',{d:glyph.path,'fill-rule':'evenodd'}));element.appendChild(fallback);element.appendChild(svg);
 };
 const lettering=assets.lettering?.entries;
 if(lettering){for(const [selector,key]of [['.brand span','brand'],['.label','label'],['.sub','sub'],['.cn','cn'],['.hint','hint'],['.status','connecting']]){const glyph=lettering[key];if(glyph)setOpeningText(shadow.querySelector(selector),glyph.text,glyph);}}
 if(assets.signature?.paths?.length){
  const title=shadow.querySelector('.title');title.textContent='';title.classList.add('signature-title');title.setAttribute('aria-label','Sandrone');
  const svg=node('svg',{viewBox:'0 0 1080 330','aria-hidden':'true'});
  let delay=550;const durations=[240,100,75,230,70,100,85,100];
  assets.signature.paths.forEach((d,i)=>{const p=node('path',{d,pathLength:'1','stroke-width':i===0?'7':'6.3'});p.style.cssText=`--delay:${delay}ms;--duration:${durations[i]||170}ms`;delay+=durations[i]||170;svg.appendChild(p);});title.appendChild(svg);
 }
 for(const [selector,key]of [['.character','portrait'],['.gear','gear'],['.iris','iris'],['.strings','strings'],['.avatar','avatar']]){const img=shadow.querySelector(selector);if(assets[key])img.src=assets[key];}
 shadow.querySelector('.back').style.backgroundImage=`url("${assets.background}")`;
 shadow.querySelectorAll('.sigils img').forEach((el,i)=>{el.src=assets[['cryo','skill','burst'][i]]||assets.avatar;});
 for(let i=0;i<(assets.outline?8:26);i++){const p=document.createElement('i');p.className='particle';p.style.cssText=`left:${43+(i*17%55)}%;top:${10+(i*23%80)}%;animation-delay:${-(i*37%400)/100}s;animation-duration:${3+i%4}s`;scene.append(p);}
 document.documentElement.append(host);
 const before=document.activeElement;
 const started=performance.now();let ended=false,removed=false,lastKey=-1000,timer,removeTimer,stopSourceTrace=()=>{},sourceTraceActive=false,colorStarted=null;
 const info={stage:'playing',phase:window.__SANDRONE_STARTUP__?.phase||'connecting',skipped:false,started:Date.now()};window.__SANDRONE_OPENING_STATE__=info;
 const video=shadow.querySelector('.motion');
 const clearMedia=()=>{stopSourceTrace();video?.pause?.();if(video){video.removeAttribute('src');video.load?.();}};
 const remove=()=>{if(removed)return;removed=true;clearTimeout(removeTimer);clearMedia();const focused=document.activeElement===host;host.remove();if(focused&&before?.isConnected)before.focus({preventScroll:true});info.stage='finished';info.finished=Date.now();delete window.__SANDRONE_OPENING__;};
 const finish=(reason,immediate=false)=>{
  if(ended){if(immediate)remove();return;}ended=true;clearInterval(timer);info.skipped=reason==='double-click'||reason==='double-key'||reason==='escape';info.reason=reason;info.stage=immediate?'removed':'fading';
  scene.classList.add('leaving');stopSourceTrace();video?.pause?.();
  if(immediate)remove();else removeTimer=setTimeout(remove,720);
 };
 window.__SANDRONE_OPENING__={dispose:reason=>finish(reason||'restore',true),setPhase:phase=>{if(!ended)info.phase=phase;}};
 scene.addEventListener('dblclick',e=>{e.preventDefault();finish('double-click');});
 scene.addEventListener('keydown',e=>{if(e.key==='Escape')finish('escape');if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();const now=performance.now();if(now-lastKey<500)finish('double-key');lastKey=now;}});
 scene.focus({preventScroll:true});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const roleNames={columbina:'银月',ayaka:'霜樱',hutao:'幽蝶',nahida:'新叶',furina:'水光',citlali:'星纹',mitya:'星轨',istaroth:'时砂'};
 const entrance=!reduced&&assets.fullScene&&assets.videoPoster&&assets.entrance?.id===assets.lettering?.id&&roleNames[assets.entrance.id]&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(assets.entrance.ornament)?assets.entrance:null;
 const entranceDelay=entrance?1200:0;
 let entranceRevealed=!entrance;
 if(entrance){
  scene.classList.add('character-entrance');
  info.entrance={id:entrance.id,motif:roleNames[entrance.id],phase:'material',revealDelayMs:entranceDelay};
  const seal=document.createElement('div');seal.className='entrance-seal';seal.setAttribute('aria-hidden','true');
  const svg=node('svg',{viewBox:'0 0 384 384',focusable:'false'}),defs=node('defs');
  const metal=node('linearGradient',{id:'entrance-metal',x1:'0',y1:'0',x2:'1',y2:'1'});
  for(const [offset,color,opacity]of [['0','var(--ice)','1'],['.32','var(--gold)','.45'],['.55','var(--ice)','.95'],['1','var(--gold)','.35']])metal.appendChild(node('stop',{offset,'stop-color':color,'stop-opacity':opacity}));
  defs.appendChild(metal);svg.appendChild(defs);
  const rotor=node('g',{'class':'seal-rotor',fill:'none',stroke:'url(#entrance-metal)','stroke-width':'.9'});
  for(const radius of [155,148])rotor.appendChild(node('circle',{cx:'192',cy:'192',r:String(radius),opacity:'.65'}));
  for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%3===0?136:143;rotor.appendChild(node('path',{d:`M${192+Math.cos(a)*r} ${192+Math.sin(a)*r}L${192+Math.cos(a)*151} ${192+Math.sin(a)*151}`,opacity:i%3===0?'.8':'.35'}));}
  const material=node('image',{href:entrance.ornament,x:'96',y:'96',width:'192',height:'192',preserveAspectRatio:'xMidYMid meet','class':'seal-material'});rotor.appendChild(material);svg.appendChild(rotor);
  const counter=node('g',{'class':'seal-counter',fill:'none',stroke:'url(#entrance-metal)','stroke-width':'.8'});
  counter.appendChild(node('path',{d:'M192 25A167 167 0 0 1 359 192M192 359A167 167 0 0 1 25 192'}));
  for(const [x,y]of [[192,25],[359,192],[192,359],[25,192]])counter.appendChild(node('path',{d:`M${x} ${y-4}l4 4-4 4-4-4Z`}));
  svg.appendChild(counter);seal.appendChild(svg);scene.insertBefore(seal,shadow.querySelector('.grain'));
 }
 const durationMs=Number.isFinite(assets.durationMs)?Math.min(15000,Math.max(6000,assets.durationMs)):null;
 info.durationMs=durationMs;info.animationKind=assets.animationKind||'legacy';
 if(assets.fullScene){scene.classList.add('full-scene');if(assets.videoPoster)scene.style.setProperty('--opening-scene-poster','url('+JSON.stringify(assets.videoPoster)+')');const sheet=document.createElement('style');sheet.textContent='.full-scene::before{content:"";position:absolute;inset:0;background-image:var(--opening-scene-poster);background-size:cover;background-position:center;filter:blur(16px);opacity:.65}.full-scene .motion,.full-scene .motion-poster{object-fit:contain;object-position:center}.full-scene .shade{background:linear-gradient(90deg,#080c1748,transparent 60%)}.full-scene .gear,.full-scene .iris,.full-scene .strings,.full-scene .character,.full-scene .orbit,.full-scene .particle,.full-scene .sweep{display:none}.full-scene .copy,.full-scene .brand,.full-scene .bottom,.full-scene .footer{text-shadow:0 2px 8px #020617,0 0 24px #020617c9}';shadow.append(sheet);}
 if(assets.videoPoster){shadow.querySelector('.motion-poster').src=assets.videoPoster;scene.classList.add('motion-pending');}
 if(reduced)info.video='reduced-poster';
 const tracing=!reduced&&assets.videoPoster&&assets.outline?.paths?.length>0;
 if(tracing){scene.classList.add('trace-intro');info.reveal='outline';}
 if(tracing&&(!assets.traceVideo||assets.environmentTrace)){
  const frame=document.createElement('div');frame.className='trace-frame';
  const svg=node('svg',{viewBox:'0 0 1280 720',preserveAspectRatio:'none','aria-hidden':'true'});
  const face=node('g',{'class':'face-lines'});
  (assets.outline.facePaths||[]).forEach((d,i)=>{const path=node('path',{d,pathLength:'1','class':'face-path'});path.style.cssText=`--delay:${90+i*10}ms;--duration:${850+(i%3)*100}ms`;face.appendChild(path);});svg.appendChild(face);
  assets.outline.paths.forEach((d,i)=>{const path=node('path',{d,pathLength:'1','class':'character-path'});path.style.cssText=`--delay:${250+i*8}ms;--duration:${850+(i%3)*100}ms`;svg.appendChild(path);});
  const water=node('g',{'class':'water-lines'});
  (assets.outline.waterPaths||[]).forEach(d=>{const path=node('path',{d,pathLength:'1','class':'water-path'});path.style.cssText='--delay:650ms;--duration:900ms';water.appendChild(path);});svg.appendChild(water);
  // One quiet, large gear, positioned behind the character. Geometry is fixed code.
  const mechanism=document.createElement('div');mechanism.className='mechanism-frame';
  const wheel=node('svg',{viewBox:'0 0 1280 720',preserveAspectRatio:'none','aria-hidden':'true'});
  const defs=node('defs'),clip=node('clipPath',{id:'opening-gear-water-clip'});
  clip.appendChild(node('path',{d:'M0,0 L1280,0 L1280,578 L391,198 L0,198 Z'}));defs.appendChild(clip);wheel.appendChild(defs);
  const aboveWater=node('g',{'clip-path':'url(#opening-gear-water-clip)'}),rotor=node('g',{'class':'mechanism-rotor'});
  let teeth='';for(let i=0;i<96;i++){const a=(i/96)*Math.PI*2,r=i%4===1||i%4===2?224:213;teeth+=(i?' L':'M')+(1000+Math.cos(a)*r).toFixed(2)+','+(355+Math.sin(a)*r).toFixed(2);}
  rotor.appendChild(node('path',{d:teeth+' Z'}));
  for(const radius of [202,185])rotor.appendChild(node('circle',{cx:'1000',cy:'355',r:String(radius)}));
  for(let i=0;i<8;i++){const a=i*Math.PI/4;rotor.appendChild(node('path',{d:`M${1000+Math.cos(a)*185},${355+Math.sin(a)*185} L${1000+Math.cos(a)*202},${355+Math.sin(a)*202}`}));}
  aboveWater.appendChild(rotor);wheel.appendChild(aboveWater);mechanism.appendChild(wheel);scene.insertBefore(mechanism,shadow.querySelector('.grain'));
  frame.appendChild(svg);scene.insertBefore(frame,shadow.querySelector('.grain'));scene.classList.add('trace-intro');info.reveal='outline';
 }
 let mediaLoaded=false,playRequested=false,mediaEnded=false;
 let traceVideo=null,traceLoaded=false,sourceStarted=false,frameCallback=null;
 const usePrerender=tracing&&assets.traceVideo?.startsWith('data:video/mp4;base64,');
 if(usePrerender){
  const frame=document.createElement('div');frame.className='source-motion-frame';
  traceVideo=document.createElement('video');traceVideo.muted=true;traceVideo.playsInline=true;traceVideo.preload='auto';traceVideo.setAttribute('aria-hidden','true');
  frame.appendChild(traceVideo);scene.insertBefore(frame,shadow.querySelector('.trace-frame')||shadow.querySelector('.grain'));
  traceVideo.addEventListener('loadeddata',()=>{if(ended)return;traceLoaded=true;startPair();},{once:true});
  traceVideo.addEventListener('error',()=>{if(ended)return;traceLoaded=false;info.video='trace-fallback';scene.classList.remove('prerender-ready');scene.classList.remove('source-trace-ready');stopSourceTrace();if(mediaLoaded)startPair();},{once:true});
 }
 const startPair=()=>{
  if(ended||sourceStarted||!mediaLoaded)return;
  // Both fixed clips were made from frame zero of the same source. No per-pixel
  // work or canvas readback runs here. Drift checks are limited to four/second.
  if(usePrerender&&!traceLoaded&&info.video!=='trace-fallback')return;
  sourceStarted=true;playRequested=true;
  const track=traceLoaded?traceVideo:null;
  if(track){scene.classList.add('prerender-ready');scene.classList.add('source-trace-ready');sourceTraceActive=true;info.sourceTrace='prerendered';}
  Promise.all([video.play(),...(track?[track.play()]:[])]).then(()=>{
   if(ended){video.pause();track?.pause();return;}info.video='playing';
   const sample=(now,metadata)=>{
    if(ended||!sourceTraceActive)return;
    info.sourceTime=track.currentTime;info.videoTime=video.currentTime;info.sourceFrames=(info.sourceFrames||0)+1;
    if(!info.lastSync||now-info.lastSync>250){info.lastSync=now;if(Math.abs(track.currentTime-video.currentTime)>.12)track.currentTime=video.currentTime;}
    frameCallback=video.requestVideoFrameCallback?.(sample);
   };
   if(track)frameCallback=video.requestVideoFrameCallback?.(sample);
   if(!tracing||performance.now()-started>=2100)beginColor();
  }).catch(()=>{if(!ended)fallback();});
 };
 stopSourceTrace=()=>{if(frameCallback!=null)video.cancelVideoFrameCallback?.(frameCallback);frameCallback=null;sourceTraceActive=false;traceVideo?.pause();if(traceVideo){traceVideo.removeAttribute('src');traceVideo.load?.();}info.sourceTrace='stopped';};
 const beginColor=()=>{
  if(ended)return;
  if(!entranceRevealed){
   if(performance.now()-started<entranceDelay)return;
   entranceRevealed=true;scene.classList.add('entrance-revealed');info.entrance.phase='scene';info.entrance.revealedAtMs=Math.round(performance.now()-started);
  }
  if(tracing){scene.classList.add('color-reveal');info.reveal='color';colorStarted??=performance.now();}
  if(info.video==='playing'){scene.classList.remove('motion-pending');scene.classList.add('motion-ready');return;}
  if(!mediaLoaded||playRequested)return;playRequested=true;
  video.play().then(()=>{if(!ended){scene.classList.remove('motion-pending');scene.classList.add('motion-ready');info.video='playing';}else video.pause();}).catch(()=>{if(!ended)fallback();});
 };
 const fallback=()=>{info.video='fallback';scene.classList.add('media-fallback');scene.classList.remove('motion-ready');scene.classList.remove('source-trace-ready');if(assets.videoPoster)scene.classList.add('motion-pending');else if(!tracing)scene.classList.remove('motion-pending');clearMedia();};
 if(video&&assets.video?.startsWith('data:video/mp4;base64,')&&!reduced){
  video.muted=true;video.loop=false;video.playsInline=true;
  video.addEventListener('ended',()=>{mediaEnded=true;info.playbackEnded=true;},{once:true});
  if(assets.videoPoster){shadow.querySelector('.motion-poster').src=assets.videoPoster;scene.classList.add('motion-pending');}
  video.addEventListener('error',()=>{if(!ended)fallback();},{once:true});
  video.addEventListener('loadeddata',()=>{
   if(ended)return;mediaLoaded=true;
   if(usePrerender)startPair();else if(!tracing||performance.now()-started>=2100)beginColor();
  },{once:true});
  video.src=assets.video;
  if(traceVideo)traceVideo.src=assets.traceVideo;
 }
 timer=setInterval(()=>{
  const t=performance.now()-started;
  if(entrance&&!entranceRevealed&&t>=entranceDelay)beginColor();
  if(usePrerender&&!sourceStarted&&t>1300){info.video='trace-fallback';startPair();}
  if(tracing&&t>=2100)beginColor();
  if(sourceTraceActive&&colorStarted!==null&&performance.now()-colorStarted>1200)stopSourceTrace();
  const composer=document.querySelector('[data-ds-part="composer"]');
  const replayPhase=t<600?'connecting':t<1600?'applying':t<3000?'waiting':'ready';
  if(options.preview)info.phase=replayPhase;
  const nativeReady=document.documentElement.getAttribute('data-dream-skin')==='active'&&composer&&composer.getBoundingClientRect().width>0;
  const ready=options.preview?info.phase==='ready':options.replay?nativeReady:window.__SANDRONE_STARTUP__?info.phase==='ready':nativeReady;
  const phase=options.replay&&ready?replayPhase:ready?'ready':info.phase;
  const statusText=({connecting:'解算开始。',applying:'填入变量。',waiting:'进程良好。',ready:'析构万理！啊哈哈哈...',error:'主题接入暂未完成'})[phase]||'进程良好。';
  setOpeningText(shadow.querySelector('.status'),statusText,lettering?.[phase]||lettering?.waiting);
  shadow.querySelector('.progress').style.transform=`scaleX(${phase==='ready'?1:phase==='connecting'?.333:phase==='waiting'?.9:.667})`;
  const playbackComplete=reduced?t>1000:durationMs&&info.video==='playing'?mediaEnded||(video.duration>0&&video.currentTime>=video.duration-.08):t>(durationMs||5200);
  if(ready&&playbackComplete)finish('ready');
  if(t>18000)finish('native-ui-wait');
 },150);
 return {shown:true,version:'0.5.3'};
}
