// Offline lifecycle tests: no browser, account, CDP endpoint or desktop UI.
import assert from 'node:assert/strict';
import {showOpening,installNativeUi,removeNativeUi,setStartupPhase} from '../characters/columbina/engine/renderer.mjs';
let canvasEnabled=false;
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.style={};this.classes=new Set();this.attrs={};this.classList={add:c=>this.classes.add(c),remove:c=>this.classes.delete(c)};}
 play(){this.played=true;return Promise.resolve();}pause(){this.paused=true;}load(){this.released=true;}
 getContext(){if(!canvasEnabled)return null;return {drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{this.painted=true;}};}
 requestVideoFrameCallback(fn){this.frameFn=fn;return 1;}cancelVideoFrameCallback(){this.frameCancelled=true;this.frameFn=null;}
 removeAttribute(name){delete this.attrs[name];if(name==='src')this.src='';}
 set className(v){this.classes=new Set(v.split(' '));}get className(){return [...this.classes].join(' ');}
 append(n){this.children.push(n);n.parent=this;}appendChild(n){this.append(n);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
 insertBefore(n,reference){const i=this.children.indexOf(reference);this.children.splice(i<0?this.children.length:i,0,n);n.parent=this;}
 setAttribute(name,value){this.attrs[name]=value;if(name==='class')this.className=value;}
 get isConnected(){return this===document.documentElement||Boolean(this.parent?.isConnected)||Boolean(this.ownerHost?.isConnected);}
 attachShadow(){const root=new Element('shadow');root.ownerHost=this;this.shadowRoot=root;return root;}
 set innerHTML(html){this.children=[];for(const m of html.matchAll(/<([a-z][\w-]*)([^>]*)>/g)){const e=new Element(m[1]);const cls=/class="([^"]+)"/.exec(m[2]);if(cls)e.className=cls[1];this.append(e);}}
 all(){return this.children.flatMap(n=>[n,...n.all()]);}
 querySelectorAll(selector){if(selector==='.sigils img')return this.all().filter(n=>n.tag==='img').slice(-3);if(selector.startsWith('.'))return this.all().filter(n=>n.classes.has(selector.slice(1)));return [];}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 addEventListener(type,fn){this.events[type]=fn;}
 focus(){document.activeElement=this.parent?.ownerHost||this;}
 getBoundingClientRect(){return {width:500,height:300};}
 getAttribute(name){return this.attrs[name]||null;}
 dispatch(type,extra={}){this.events[type]?.({preventDefault(){},...extra});}
}
let now=0,seq=0;const intervals=new Map(),timeouts=new Map();
globalThis.window={};globalThis.document={documentElement:new Element('html'),adoptedStyleSheets:[],createElement:t=>new Element(t)};
document.createElementNS=(ns,t)=>new Element(t);
document.documentElement.attrs['data-dream-skin']='active';
const composer=new Element();document.documentElement.append(composer);document.querySelector=s=>s==='[data-ds-part="composer"]'?composer:null;
const previous=new Element();document.documentElement.append(previous);document.activeElement=previous;
globalThis.CSSStyleSheet=class{replaceSync(css){this.css=css;}};
globalThis.performance={now:()=>now};globalThis.matchMedia=()=>({matches:false});
globalThis.setInterval=fn=>{const id=++seq;intervals.set(id,fn);return id;};globalThis.clearInterval=id=>intervals.delete(id);
globalThis.clearTimeout=id=>timeouts.delete(id);
globalThis.setTimeout=(fn,delay)=>{const id=++seq;timeouts.set(id,{fn,time:now+delay});return id;};
function advance(ms){now+=ms;for(const fn of [...intervals.values()])fn();for(const [id,t]of [...timeouts])if(t.time<=now){timeouts.delete(id);t.fn();}}
const assets={background:'data:image/png;base64,eA==',avatar:'data:image/png;base64,eA=='};
assert.equal(showOpening(assets,{preview:true}).shown,true);
assert.equal(showOpening(assets,{preview:true}).shown,false,'duplicate does not cover the scene twice');
const host=()=>document.documentElement.children.find(n=>n.id==='sandrone-opening');
const originalDocument=document.documentElement;
const scene=()=>host().shadowRoot.querySelector('.scene');
advance(1200);scene().dispatch('dblclick');assert.equal(window.__SANDRONE_OPENING_STATE__.reason,'double-click');
advance(800);assert.equal(host(),undefined);assert.equal(document.activeElement,previous,'focus returns to prior surface');assert.equal(document.documentElement,originalDocument,'same document survives');
showOpening(assets,{preview:true});advance(200);scene().dispatch('keydown',{key:' ',repeat:false});advance(200);scene().dispatch('keydown',{key:' ',repeat:false});assert.equal(window.__SANDRONE_OPENING_STATE__.reason,'double-key');advance(800);assert.equal(host(),undefined);
showOpening(assets,{preview:true});advance(5300);assert.equal(window.__SANDRONE_OPENING_STATE__.reason,'ready');advance(800);assert.equal(host(),undefined);
showOpening(assets,{preview:true});const originalSheet={name:'official'};document.adoptedStyleSheets=[originalSheet];installNativeUi('body{}');installNativeUi('body{}');assert.equal(document.adoptedStyleSheets.length,2,'no duplicate component sheets');removeNativeUi();assert.equal(host(),undefined);assert.deepEqual(document.adoptedStyleSheets,[originalSheet]);assert.equal(intervals.size,0,'no polling after restore or dismissal');
assets.video='data:video/mp4;base64,eA==';showOpening(assets,{preview:true});
let media=host().shadowRoot.querySelector('.motion');assert.equal(media.muted,true);assert.equal(media.loop,false);assert.equal(media.playsInline,true);
media.dispatch('loadeddata');await Promise.resolve();assert.equal(media.played,true);assert.ok(scene().classes.has('motion-ready'));
scene().dispatch('dblclick');assert.equal(media.paused,true);advance(800);assert.equal(media.src,'');assert.equal(media.released,true);assert.equal(host(),undefined);
showOpening(assets,{preview:true});media=host().shadowRoot.querySelector('.motion');media.dispatch('error');assert.equal(window.__SANDRONE_OPENING_STATE__.video,'fallback');assert.equal(scene().classes.has('motion-ready'),false);removeNativeUi();
globalThis.matchMedia=()=>({matches:true});showOpening(assets,{preview:true});media=host().shadowRoot.querySelector('.motion');assert.equal(media.src,undefined,'reduced motion does not load video');removeNativeUi();assert.equal(intervals.size,0);
globalThis.matchMedia=()=>({matches:false});assets.videoPoster='data:image/jpeg;base64,eA==';
assert.equal(setStartupPhase('untrusted-phase'),false);
setStartupPhase('connecting');showOpening(assets);assert.ok(scene().classes.has('motion-pending'));
advance(5300);assert.equal(window.__SANDRONE_OPENING_STATE__.stage,'playing','elapsed time does not fake readiness');
setStartupPhase('applying');advance(150);assert.equal(host().shadowRoot.querySelector('.status').textContent,'银月之庭，渐次亮起。');
setStartupPhase('ready');advance(150);assert.equal(window.__SANDRONE_OPENING_STATE__.stage,'fading');
removeNativeUi();assert.equal(host(),undefined,'restore/replay also works during fade');assert.equal(timeouts.size,0);assert.equal(intervals.size,0);
assets.outline={paths:['M500,200 L700,400','M900,300 L950,350'],waterPaths:['M600,500 Q650,505 700,500']};
showOpening(assets,{preview:true});media=host().shadowRoot.querySelector('.motion');media.dispatch('loadeddata');await Promise.resolve();
assert.equal(media.played,undefined,'video stays on matching first frame while contours draw');assert.equal(window.__SANDRONE_OPENING_STATE__.reveal,'outline');
assert.equal(host().shadowRoot.querySelector('.character-path').attrs.d,assets.outline.paths[0]);
assert.ok(host().shadowRoot.querySelector('.mechanism-frame'),'one separate large rotating gear');
assert.equal(host().shadowRoot.querySelector('.mechanism-rotor').children.length,11,'sparse gear: toothed rim, two circles and eight short marks');
assert.equal(host().shadowRoot.querySelectorAll('.water-path').length,1,'water is separate from character contours');
assert.equal(host().shadowRoot.querySelectorAll('.ripple-ring').length,0,'no synthetic rings before the source video is ready');
advance(1950);assert.equal(media.played,undefined);advance(200);await Promise.resolve();assert.equal(media.played,true);assert.equal(window.__SANDRONE_OPENING_STATE__.reveal,'color');assert.ok(scene().classes.has('motion-ready'));
scene().dispatch('dblclick');advance(800);assert.equal(host(),undefined);assert.equal(intervals.size,0);
showOpening(assets,{preview:true});media=host().shadowRoot.querySelector('.motion');media.dispatch('error');advance(2200);assert.ok(scene().classes.has('motion-pending'),'matching poster remains as media-error fallback');assert.ok(scene().classes.has('color-reveal'));removeNativeUi();
showOpening(assets,{preview:true});media=host().shadowRoot.querySelector('.motion');scene().dispatch('dblclick');advance(800);media.dispatch('loadeddata');await Promise.resolve();assert.equal(media.played,undefined,'late decode after skip cannot restart playback');assert.equal(intervals.size,0);
globalThis.matchMedia=()=>({matches:true});showOpening(assets,{preview:true});assert.equal(host().shadowRoot.querySelector('.trace-frame'),null,'reduced motion skips path drawing');removeNativeUi();
assets.signature={paths:['M50,100 Q100,40 200,100','M200,100 Q250,80 300,100']};
showOpening(assets,{preview:true});assert.equal(host().shadowRoot.querySelector('.title').attrs['aria-label'],'Columbina');assert.equal(host().shadowRoot.querySelector('.title').children[0].children.length,2);removeNativeUi();
globalThis.matchMedia=()=>({matches:false});assets.traceVideo='data:video/mp4;base64,eA==';assets.environmentTrace=true;
showOpening(assets,{preview:true});media=host().shadowRoot.querySelector('.motion');
let trace=host().shadowRoot.querySelector('.source-motion-frame').children[0];
media.dispatch('loadeddata');await Promise.resolve();assert.equal(media.played,undefined,'wait for the matching prerender');
trace.dispatch('loadeddata');await Promise.resolve();await Promise.resolve();
assert.equal(media.played,true);assert.equal(trace.played,true);assert.equal(window.__SANDRONE_OPENING_STATE__.sourceTrace,'prerendered');
assert.ok(host().shadowRoot.querySelector('.trace-frame'),'character remains vector geometry over baked environment');
assert.equal(host().shadowRoot.querySelector('canvas'),null,'live app never samples pixels');
media.currentTime=.5;trace.currentTime=.5;media.frameFn(now,{mediaTime:.5});
assert.equal(window.__SANDRONE_OPENING_STATE__.sourceFrames,1);assert.equal(window.__SANDRONE_OPENING_STATE__.sourceTime,.5);
advance(2200);assert.ok(scene().classes.has('motion-ready'));assert.equal(media.currentTime,.5,'reveal never restarts the color source');
advance(1300);assert.equal(media.frameCancelled,true);assert.equal(trace.paused,true);assert.equal(trace.src,'');
scene().dispatch('dblclick');advance(800);assert.equal(host(),undefined);assert.equal(media.paused,true);assert.equal(intervals.size,0);
showOpening(assets,{preview:true});media=host().shadowRoot.querySelector('.motion');trace=host().shadowRoot.querySelector('.source-motion-frame').children[0];
media.dispatch('loadeddata');trace.dispatch('loadeddata');await Promise.resolve();await Promise.resolve();const lateFrame=media.frameFn;
removeNativeUi();lateFrame?.(now,{mediaTime:1});assert.equal(host(),undefined);assert.equal(trace.paused,true);assert.equal(intervals.size,0);
showOpening(assets,{preview:true});media=host().shadowRoot.querySelector('.motion');trace=host().shadowRoot.querySelector('.source-motion-frame').children[0];
media.dispatch('loadeddata');trace.dispatch('error');await Promise.resolve();await Promise.resolve();assert.equal(media.played,true,'broken optional trace cannot block playback');
removeNativeUi();
console.log(JSON.stringify({pass:true,checks:['double-click-skip','double-space-skip','automatic-ready-fade','focus-return','same-document','restore-cleanup','no-duplicate-sheet','no-leaked-timers','muted-single-playback','media-release','decode-error-fallback','reduced-motion-no-video','real-startup-phases','first-frame-poster','cleanup-during-fade']}));
