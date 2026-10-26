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
  replay.textContent='↻  重播开屏';replay.title='在当前窗口重播伊斯塔露开屏，不重启 Codex';replay.setAttribute('aria-label','重播伊斯塔露开屏动画');
  replay.addEventListener('click',()=>{if(typeof window.sandroneReplayOpening==='function'){window.sandroneReplayOpening('replay');}else{replay.title='主题连接正在恢复，请稍后再试';}});
  document.documentElement.appendChild(replay);
  // Never duplicate OS glyphs: use the official read-only native theme signal
  // to choose a contrasting surface under the actual native buttons.
  const bridge=window.electronBridge;
  let seenGeometry=false;
  const sync=()=>{
   let tone;try{tone=bridge?.getSystemThemeVariant?.();}catch{}
   backing.style.setProperty?.('--sandrone-caption-surface',tone==='light'?'#c6d0e4':tone==='dark'?'#18223A':'#7a8090');
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
 :host{font-family:"Segoe UI","Microsoft YaHei",sans-serif;color:#F4EFE3;--gold:#CFB47B;--ice:#EEE6D1}
 *{box-sizing:border-box} .scene{position:absolute;inset:0;overflow:hidden;background:#10172B;opacity:1;transition:opacity .7s cubic-bezier(.2,.65,.3,1);outline:0}
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
 .trace-frame path{fill:none;stroke:#CFB47B;stroke-width:.95;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:trace-draw var(--duration) var(--delay) cubic-bezier(.25,.5,.4,1) both}
 .trace-frame .face-path{stroke:#A98B55;stroke-width:1.25}
 .trace-frame path{vector-effect:non-scaling-stroke}
 .trace-frame .water-path{stroke:#88becb;stroke-width:.85;opacity:.45}
 .water-lines{opacity:.4;filter:drop-shadow(0 0 1.6px #7fdcec60)}
 .mechanism-frame path,.mechanism-frame circle{fill:none;stroke:#b8c9c2;stroke-width:1;stroke-linejoin:round}
 .mechanism-frame circle{stroke:#CFB47B;stroke-width:.8}
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
 /* Scene contours and local motions share the exact full-scene image plane. */
 .scene-intro-frame{position:absolute;inset:0;pointer-events:none;opacity:1;transition:opacity 1.15s ease}
 .scene-intro-frame>svg{display:block;width:100%;height:100%;overflow:hidden}
 .scene-contour{fill:none;stroke:var(--ice);stroke-width:1.35;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:scene-draw var(--path-duration) var(--path-delay) cubic-bezier(.24,.5,.4,1) both}
 .scene-environment .scene-contour{stroke-width:1.05;opacity:.3}
 .scene-character .scene-contour{stroke:var(--gold);opacity:.82}
 .scene-details .scene-contour{stroke-width:1.5;opacity:.95}
 .scene-entrance .back,.scene-entrance .character{animation:none}
 .scene-entrance:not(.scene-color) .back,.scene-entrance:not(.scene-color) .character,.scene-entrance:not(.scene-color) .motion,.scene-entrance:not(.scene-color) .motion-poster{opacity:0!important}
 .scene-entrance.full-scene:not(.scene-color)::before{opacity:0!important}
 .scene-entrance.full-scene::before,.scene-entrance .motion,.scene-entrance .motion-poster{transition:opacity 1.15s ease}
 .scene-entrance.media-fallback .motion-poster{transition:opacity .25s ease}
 .scene-entrance.scene-color .scene-intro-frame{opacity:0}
 .scene-entrance .grain,.scene-entrance .gear,.scene-entrance .iris,.scene-entrance .strings,.scene-entrance .orbit,.scene-entrance .particle,.scene-entrance .sweep{display:none}
 .scene-motions{color:var(--ice)}.scene-motions .warm{color:var(--gold)}
 .scene-soft-glow{opacity:.065;animation:scene-light 4.8s ease-in-out infinite}
 .scene-water-glint{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;animation:scene-water 3.8s ease-in-out infinite}
 .scene-feather{fill:currentColor;fill-opacity:.1;stroke:currentColor;stroke-width:1;opacity:.6;animation:scene-feather 5.8s ease-in-out infinite}
 .scene-butterfly-flight{animation:scene-butterfly-flight 5.4s cubic-bezier(.3,.4,.5,.7) both}
 .scene-butterfly-wing{fill:currentColor;fill-opacity:.3;stroke:currentColor;stroke-width:1.1;animation:scene-butterfly-wing .62s ease-in-out infinite;transform-origin:0 0}
 .scene-butterfly-core{fill:currentColor;opacity:.9}
 .scene-snow{fill:currentColor;opacity:.32;animation:scene-snow 5.7s linear infinite}
 .scene-petal{fill:currentColor;fill-opacity:.3;stroke:currentColor;stroke-width:.7;animation:scene-petal 5.2s ease-in-out infinite}
 .scene-frost{fill:none;stroke:currentColor;stroke-width:1.15;stroke-linecap:round;animation:scene-frost 3.8s ease-in-out infinite}
 .scene-leaf-growth{fill:none;stroke:currentColor;stroke-width:1.2;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:scene-draw 1.7s .08s ease both}
 .scene-firefly{fill:currentColor;animation:scene-firefly 4.6s ease-in-out infinite}
 .scene-droplet{fill:currentColor;fill-opacity:.18;stroke:currentColor;stroke-width:1;animation:scene-droplet 4.2s ease-in infinite}
 .scene-bubble{fill:none;stroke:currentColor;stroke-width:1.1;animation:scene-bubble 5.6s ease-out infinite}
 .scene-crystal-glint{fill:none;stroke:currentColor;stroke-width:1.4;animation:scene-crystal 4.6s ease-in-out infinite}
 .scene-tassel-glint{fill:none;stroke:currentColor;stroke-width:1;animation:scene-tassel 4.9s ease-in-out infinite}
 .scene-time-rotor{transform-origin:0 0;animation:scene-time-turn 9s ease-out both}
 .scene-time-ring{fill:none;stroke:currentColor;stroke-width:1.1;opacity:.42}
 .scene-sand{stroke:currentColor;stroke-width:1.2;stroke-linecap:round;animation:scene-sand 4.6s linear infinite}
 @keyframes scene-draw{0%{stroke-dashoffset:1;opacity:0}9%{opacity:.8}100%{stroke-dashoffset:0}}
 @keyframes scene-light{0%,100%{opacity:.045}50%{opacity:.085}}
 @keyframes scene-water{0%,100%{opacity:.15;transform:translateX(-4px)}48%{opacity:.65;transform:translateX(4px)}}
 @keyframes scene-feather{0%,100%{transform:translate(-7px,-7px);opacity:.2}50%{transform:translate(12px,30px);opacity:.65}}
 @keyframes scene-butterfly-flight{0%{transform:translate(0,14px);opacity:0}12%{opacity:.8}38%{transform:translate(-23px,-28px)}70%{transform:translate(37px,-49px);opacity:.75}100%{transform:translate(73px,-77px);opacity:.25}}
 @keyframes scene-butterfly-wing{0%,100%{transform:scaleX(.38)}50%{transform:scaleX(1)}}
 @keyframes scene-snow{0%{transform:translate(-4px,-18px);opacity:0}18%,70%{opacity:.35}100%{transform:translate(7px,38px);opacity:0}}
 @keyframes scene-petal{0%{transform:translate(0,-15px);opacity:0}15%{opacity:.7}70%{transform:translate(-26px,38px);opacity:.45}100%{transform:translate(-51px,79px);opacity:0}}
 @keyframes scene-frost{0%,100%{opacity:.15}50%{opacity:.65}}
 @keyframes scene-firefly{0%,100%{transform:translate(-3px,3px);opacity:.15}45%{transform:translate(6px,-8px);opacity:.75}}
 @keyframes scene-droplet{0%,8%{transform:translateY(-5px);opacity:0}20%{opacity:.6}86%,100%{transform:translateY(72px);opacity:0}}
 @keyframes scene-bubble{0%{transform:translate(0,8px);opacity:0}18%{opacity:.5}100%{transform:translate(5px,-54px);opacity:0}}
 @keyframes scene-crystal{0%,100%{opacity:.15}42%{opacity:.85}56%{opacity:.28}}
 @keyframes scene-tassel{0%,100%{transform:translateX(-2px);opacity:.35}50%{transform:translateX(3px);opacity:.6}}
 @keyframes scene-time-turn{from{transform:rotate(-13deg)}to{transform:rotate(10deg)}}
 @keyframes scene-sand{0%{transform:translateY(-10px);opacity:0}18%,68%{opacity:.55}100%{transform:translateY(36px);opacity:0}}
 .grain{position:absolute;inset:0;opacity:.12;background-image:linear-gradient(90deg,transparent 99%,#EEE6D1 100%),linear-gradient(0deg,transparent 99%,#EEE6D1 100%);background-size:64px 64px;animation:drift 18s linear infinite}
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
 .signature-title path{fill:none;stroke:#EEE6D1;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:signature-write var(--duration) var(--delay) linear both}
 @keyframes signature-write{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
 .sub{font-size:clamp(12px,1.4vw,20px);letter-spacing:.38em;color:var(--gold)}
 .rule{width:84px;height:1px;margin:29px 0;background:linear-gradient(90deg,var(--gold),transparent);transform-origin:0 50%;animation:line 1s 1s both}
 .cn{font-size:44px;line-height:1.2;font-weight:700;letter-spacing:normal}
 .bottom{position:absolute;left:6%;bottom:10%;width:34%;animation:rise .8s 1s both}.status{font-size:12px;color:#c8d4df;letter-spacing:.09em}
 .track{margin-top:14px;height:2px;background:#d3b77e22;overflow:hidden}.progress{height:100%;width:100%;background:linear-gradient(90deg,#CFB47B,#A98B55,#EEE6D1);transform:scaleX(.333);transform-origin:0 50%;transition:transform .32s ease}
 .hint{margin-top:13px;color:#96a9bb;font-size:10px;letter-spacing:.12em}.footer{position:absolute;right:4%;bottom:5%;font-size:10px;color:#d3b77eaa;letter-spacing:.12em}
 .art-lettering{position:relative}.art-lettering .lettering-fallback{color:transparent!important;text-shadow:none!important}.art-lettering .lettering-surface{position:absolute;left:0;top:0;height:100%;max-width:100%;pointer-events:none;overflow:visible;fill:currentColor}.cn.art-lettering .lettering-surface{filter:drop-shadow(0 1px 0 #fff2) drop-shadow(0 0 7px #a8ddea24)}
 .sigils{position:absolute;right:4%;top:7%;display:flex;gap:15px;opacity:.65}.sigils img{width:23px;height:23px;object-fit:contain;animation:pulse 3s ease-in-out infinite}.sigils img:nth-child(2){animation-delay:.5s}.sigils img:nth-child(3){animation-delay:1s}
 .particle{position:absolute;width:2px;height:2px;background:#d5f3ff;border-radius:50%;box-shadow:0 0 8px #EEE6D1;animation:spark 4s ease-in-out infinite;pointer-events:none}
 @keyframes character{0%{opacity:0;filter:brightness(0);transform:translateY(18px)}35%{opacity:.6;filter:brightness(.15)}100%{opacity:1;filter:brightness(1);transform:translateY(0)}}
 @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
 @keyframes orbit{to{transform:rotate(360deg)}}@keyframes reverse-orbit{to{transform:rotate(-360deg)}}
 @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@keyframes line{from{transform:scaleX(0)}to{transform:scaleX(1)}}
 @keyframes spark{0%,100%{opacity:0;transform:translateY(10px) scale(.5)}40%{opacity:.8}75%{opacity:.35;transform:translateY(-28px) scale(1.2)}}
 @keyframes sweep{to{transform:rotate(20deg) translateX(650%)}}@keyframes sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
 @keyframes drift{to{transform:translate(-32px,16px)}}@keyframes pulse{50%{opacity:.4;filter:drop-shadow(0 0 6px #EEE6D1)}}@keyframes back-in{from{opacity:0}to{opacity:.6}}
 @media(max-width:800px){.copy{left:6%;top:29%;width:52%}.brand{font-size:9px}.cn{font-size:40px}.bottom{width:44%}.edge{inset:15px}}
 @media(prefers-reduced-motion:reduce){*{animation:none !important;transition-duration:.05s !important}.character{opacity:1;filter:none}.progress{transform:scaleX(1)}.signature-title path{stroke-dashoffset:0}}
 `);shadow.adoptedStyleSheets=[style];
 shadow.innerHTML=`<div class="scene" tabindex="0" role="dialog" aria-label="伊斯塔露开屏，双击或连续按两次空格跳过" aria-modal="true"><div class="back"></div><img class="motion-poster" alt=""><video class="motion" muted playsinline preload="auto" aria-hidden="true"></video><div class="grain"></div><div class="orbit"></div><img class="gear" alt=""><img class="iris" alt=""><img class="strings" alt=""><img class="character" alt="伊斯塔露"><div class="sweep"></div><div class="shade"></div><div class="edge"></div><div class="brand"><img class="avatar" alt=""><span>时砂回环 · ISTAROTH</span></div><div class="sigils"><img alt=""><img alt=""><img alt=""></div><div class="copy"><div class="label">时之执政</div><h1 class="title">ISTAROTH</h1><div class="sub">时砂回环</div><div class="rule"></div><div class="cn">CodeX</div></div><div class="bottom"><div class="status" aria-live="polite">正在拨动时序…</div><div class="track"><div class="progress"></div></div><div class="hint">双击任意处 · 或连续按两次空格跳过</div></div><div class="footer">CODEX · ISTAROTH EDITION</div></div>`;
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
  const title=shadow.querySelector('.title');title.textContent='';title.classList.add('signature-title');title.setAttribute('aria-label','Istaroth');
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
 const sceneIntro=!reduced&&assets.fullScene&&assets.videoPoster&&assets.sceneIntro?.id===assets.lettering?.id&&assets.sceneIntro.width===1920&&assets.sceneIntro.height===1080&&assets.sceneIntro.character?.length?assets.sceneIntro:null;
 if(sceneIntro){
  scene.classList.add('scene-entrance');info.reveal='outline';
  info.sceneIntro={id:sceneIntro.id,kind:sceneIntro.scene.kind,phase:'outline',revealAtMs:null,sourceMapped:true};
  const frame=document.createElement('div');frame.className='scene-intro-frame';frame.setAttribute('aria-hidden','true');
  const svg=node('svg',{viewBox:'0 0 1920 1080',preserveAspectRatio:'xMidYMid meet',focusable:'false','data-scene-intro':sceneIntro.id});
  const gradients=node('defs');
  for(const [id,color]of [['scene-glow-cold','var(--ice)'],['scene-glow-warm','var(--gold)']]){
   const gradient=node('radialGradient',{id});
   for(const [offset,alpha]of [['0','1'],['.45','.42'],['1','0']])gradient.appendChild(node('stop',{offset,'stop-color':color,'stop-opacity':alpha}));
   gradients.appendChild(gradient);
  }
  svg.appendChild(gradients);
  for(const key of ['environment','character','details']){
   const group=node('g',{'class':'scene-'+key});
   for(const item of sceneIntro[key]||[]){const path=node('path',{d:item.d,pathLength:'1','class':'scene-contour'});path.style.cssText=`--path-delay:${item.delayMs}ms;--path-duration:${item.durationMs}ms`;group.appendChild(path);}
   svg.appendChild(group);
  }
  const motions=node('g',{'class':'scene-motions','data-scene-motion':sceneIntro.scene.kind});svg.appendChild(motions);
  const anchor=(name,fallback)=>{const a=sceneIntro.scene.anchors?.[name]||fallback;return [a[0]*1920,a[1]*1080];};
  const place=(parent,x,y,kind)=>{const outer=node('g',{transform:`translate(${x} ${y})`}),inner=node('g',{'class':kind});outer.appendChild(inner);parent.appendChild(outer);return inner;};
  const at=(name,fallback,kind,parent=motions)=>{const [x,y]=anchor(name,fallback);return place(parent,x,y,kind);};
  const path=(parent,d,attributes={})=>{const p=node('path',{d,...attributes});parent.appendChild(p);return p;};
  const dot=(parent,x,y,r,attributes={})=>{const p=node('circle',{cx:x,cy:y,r,...attributes});parent.appendChild(p);return p;};
  const glow=(name,fallback,rx,ry,warm=false)=>{const group=at(name,fallback,warm?'warm':'');group.appendChild(node('ellipse',{cx:'0',cy:'0',rx,ry,'class':'scene-soft-glow',fill:`url(#scene-glow-${warm?'warm':'cold'})`}));};
  const delays=(element,index)=>{element.style.animationDelay=(-index*.67)+'s';return element;};
  switch(sceneIntro.scene.kind){
   case 'moon-water':{
    glow('moon',[.815,.11],175,155);const water=at('water',[.28,.82],'');
    for(let i=0;i<4;i++)delays(path(place(water,-80+i*55,(i%2)*12,''),`M-22 0Q0 -2 22 0`,{'class':'scene-water-glint'}),i);
    const feather=at('feather',[.5,.25],'scene-feather');path(feather,'M0 -23C-18 -11-15 13 0 24C14 6 12-15 0-23ZM0-20Q-4 0 0 21M-1-5L-10-10M-2 5L8-1');break;
   }
   case 'lantern-butterfly':{
    glow('lantern',[.91,.91],140,120,true);const flight=at('butterfly',[.49,.45],'scene-butterfly-flight warm');
    const left=node('g',{'class':'scene-butterfly-wing'});path(left,'M0 0C-15-24-30-14-18 2C-28 19-9 20 0 0Z');flight.appendChild(left);
    const right=node('g',{'class':'scene-butterfly-wing'});path(right,'M0 0C15-24 30-14 18 2C28 19 9 20 0 0Z');flight.appendChild(right);path(flight,'M-1-5L1-5 1 9-1 9Z',{'class':'scene-butterfly-core'});break;
   }
   case 'quiet-lamplight':{
    glow('lamp',[.96,.38],95,105,true);const snow=at('window',[.28,.3],'');
    for(let i=0;i<8;i++)delays(dot(place(snow,-210+(i*67)%430,-130+(i*43)%290,''),0,0,i%3===0?1.7:1.1,{'class':'scene-snow'}),i);break;
   }
   case 'frost-petals':{
    const fan=at('fan',[.82,.07],'scene-frost');path(fan,'M-48 3Q0-26 48 3M-29-9L-25-17M-3-15L-3-24M23-10L28-18');
    const petals=at('petal',[.85,.22],'');for(let i=0;i<5;i++){const p=place(petals,-170+i*63,-150+(i%3)*92,'scene-petal');path(p,'M0-8C-13-6-12 5 0 11C10 3 10-6 0-8Z');delays(p,i);}break;
   }
   case 'leaf-growth':{
    const branch=at('leaf',[.75,.59],'');path(branch,'M-65 22Q-33 5 0-20M-34 6Q-62-23-68-10Q-65 5-34 6M-16-6Q12-11 13-31Q-5-33-16-6',{'class':'scene-leaf-growth',pathLength:'1'});
    const flies=at('firefly',[.53,.63],'');for(let i=0;i<6;i++)delays(dot(place(flies,-130+(i*57)%260,-170+(i*73)%300,''),0,0,i%2?1.6:2.2,{'class':'scene-firefly'}),i);break;
   }
   case 'water-stage':{
    glow('curtain',[.5,.2],170,270);const hand=at('hand',[.86,.56],'');path(hand,'M0-13C-3-4-9 1-8 7C-6 18 7 18 9 7C10 1 4-5 0-13Z',{'class':'scene-droplet'});
    const bubbles=at('bubble',[.72,.72],'');for(let i=0;i<4;i++)delays(dot(place(bubbles,-140+i*86,(i%2)*44,''),0,0,3+i,{'class':'scene-bubble'}),i);break;
   }
   case 'crystal-starlight':{
    glow('crystal',[.61,.2],28,45);const crystal=at('crystal',[.61,.2],'');path(crystal,'M-15 0H15M0-25V25',{'class':'scene-crystal-glint'});
    const tassel=at('tassel',[.83,.9],'');path(tassel,'M-5-20V15M0-24V21M5-19V14',{'class':'scene-tassel-glint'});
    for(let i=0;i<5;i++){const stars=place(motions,330+i*135,80+(i*69)%250,'');delays(dot(stars,0,0,i%2?1.1:1.7,{'class':'scene-firefly'}),i);}break;
   }
   case 'time-sand':{
    const rotor=at('ring',[.79,.12],'scene-time-rotor warm');rotor.appendChild(node('ellipse',{cx:'0',cy:'0',rx:'325',ry:'96','class':'scene-time-ring'}));
    for(let i=0;i<18;i++){const a=i*Math.PI/9;path(rotor,`M${Math.cos(a)*310} ${Math.sin(a)*92}L${Math.cos(a)*326} ${Math.sin(a)*97}`,{'class':'scene-time-ring'});}
    const sand=at('sand',[.94,.45],'warm');for(let i=0;i<7;i++)delays(path(place(sand,-35+i*14,-100+(i%3)*59,''),'M0 0V5',{'class':'scene-sand'}),i);break;
   }
  }
  frame.appendChild(svg);scene.insertBefore(frame,shadow.querySelector('.grain'));
 }
 const durationMs=Number.isFinite(assets.durationMs)?Math.min(15000,Math.max(6000,assets.durationMs)):null;
 info.durationMs=durationMs;info.animationKind=assets.animationKind||'legacy';
 if(assets.fullScene){scene.classList.add('full-scene');if(assets.videoPoster)scene.style.setProperty('--opening-scene-poster','url('+JSON.stringify(assets.videoPoster)+')');const sheet=document.createElement('style');sheet.textContent='.full-scene::before{content:"";position:absolute;inset:0;background-image:var(--opening-scene-poster);background-size:cover;background-position:center;filter:blur(16px);opacity:.65}.full-scene .motion,.full-scene .motion-poster{object-fit:contain;object-position:center}.full-scene .shade{background:linear-gradient(90deg,#080c1748,transparent 60%)}.full-scene .grain,.full-scene .gear,.full-scene .iris,.full-scene .strings,.full-scene .character,.full-scene .orbit,.full-scene .particle,.full-scene .sweep{display:none}.full-scene .copy,.full-scene .brand,.full-scene .bottom,.full-scene .footer{text-shadow:0 2px 8px #020617,0 0 24px #020617c9}';shadow.append(sheet);}
 if(assets.videoPoster){shadow.querySelector('.motion-poster').src=assets.videoPoster;scene.classList.add('motion-pending');}
 if(reduced)info.video='reduced-poster';
 const tracing=!sceneIntro&&!reduced&&assets.videoPoster&&assets.outline?.paths?.length>0;
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
  if(sceneIntro){
   if(performance.now()-started<2100)return;
   if(info.sceneIntro.phase!=='color'){scene.classList.add('scene-color');info.reveal='color';info.sceneIntro.phase='color';info.sceneIntro.revealAtMs=Math.round(performance.now()-started);}
  }
  if(tracing){scene.classList.add('color-reveal');info.reveal='color';colorStarted??=performance.now();}
  if(info.video==='playing'){scene.classList.remove('motion-pending');scene.classList.add('motion-ready');return;}
  if(!mediaLoaded||playRequested)return;playRequested=true;
  video.play().then(()=>{if(!ended){scene.classList.remove('motion-pending');scene.classList.add('motion-ready');info.video='playing';}else video.pause();}).catch(()=>{if(!ended)fallback();});
 };
 const startSceneSource=()=>{
  if(ended||!mediaLoaded||playRequested)return;playRequested=true;
  video.play().then(()=>{if(ended){video.pause();return;}info.video='playing';if(performance.now()-started>=2100)beginColor();}).catch(()=>{if(!ended)fallback();});
 };
 const fallback=()=>{info.video='fallback';scene.classList.add('media-fallback');scene.classList.remove('motion-ready');scene.classList.remove('source-trace-ready');if(assets.videoPoster)scene.classList.add('motion-pending');else if(!tracing)scene.classList.remove('motion-pending');clearMedia();};
 if(video&&assets.video?.startsWith('data:video/mp4;base64,')&&!reduced){
  video.muted=true;video.loop=false;video.playsInline=true;
  video.addEventListener('ended',()=>{mediaEnded=true;info.playbackEnded=true;},{once:true});
  if(assets.videoPoster){shadow.querySelector('.motion-poster').src=assets.videoPoster;scene.classList.add('motion-pending');}
  video.addEventListener('error',()=>{if(!ended)fallback();},{once:true});
  video.addEventListener('loadeddata',()=>{
   if(ended)return;mediaLoaded=true;
   if(sceneIntro)startSceneSource();else if(usePrerender)startPair();else if(!tracing||performance.now()-started>=2100)beginColor();
  },{once:true});
  video.src=assets.video;
  if(traceVideo)traceVideo.src=assets.traceVideo;
 }
 timer=setInterval(()=>{
  const t=performance.now()-started;
  if(sceneIntro&&t>=2100)beginColor();
  if(usePrerender&&!sourceStarted&&t>1300){info.video='trace-fallback';startPair();}
  if(tracing&&t>=2100)beginColor();
  if(sourceTraceActive&&colorStarted!==null&&performance.now()-colorStarted>1200)stopSourceTrace();
  const composer=document.querySelector('[data-ds-part="composer"]');
  const replayPhase=t<600?'connecting':t<1600?'applying':t<3000?'waiting':'ready';
  if(options.preview)info.phase=replayPhase;
  const nativeReady=document.documentElement.getAttribute('data-dream-skin')==='active'&&composer&&composer.getBoundingClientRect().width>0;
  const ready=options.preview?info.phase==='ready':options.replay?nativeReady:window.__SANDRONE_STARTUP__?info.phase==='ready':nativeReady;
  const phase=options.replay&&ready?replayPhase:ready?'ready':info.phase;
  const statusText=({connecting:'正在拨动时序…',applying:'正在汇聚流沙…',waiting:'正在点亮圆环…',ready:'时光已就位，准备完成。',error:'主题接入暂未完成'})[phase]||'正在点亮圆环…';
  setOpeningText(shadow.querySelector('.status'),statusText,lettering?.[phase]||lettering?.waiting);
  shadow.querySelector('.progress').style.transform=`scaleX(${phase==='ready'?1:phase==='connecting'?.333:phase==='waiting'?.9:.667})`;
  const playbackComplete=reduced?t>1000:durationMs&&info.video==='playing'?mediaEnded||(video.duration>0&&video.currentTime>=video.duration-.08):t>(durationMs||5200);
  if(ready&&playbackComplete)finish('ready');
  if(t>18000)finish('native-ui-wait');
 },150);
 return {shown:true,version:'0.5.3'};
}
