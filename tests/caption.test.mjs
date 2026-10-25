import assert from 'node:assert/strict';
// Use a fixed artwork variant so the user's current selection does not affect expectations.
import {installNativeUi,removeNativeUi} from '../characters/columbina/engine/renderer.mjs';
const nodes=[];const events=new Map();let geometry={x:0,y:0,width:953,height:36};
let header=null;
const root={getAttribute:()=>mode,appendChild:n=>nodes.push(n)};let mode='light';
globalThis.window={innerWidth:1090};
globalThis.document={querySelector:()=>header,documentElement:root,adoptedStyleSheets:[],createElement:()=>({style:{setProperty(name,value){this[name]=value;}},addEventListener(type,fn){this[type]=fn;},setAttribute(){},remove(){nodes.splice(nodes.indexOf(this),1);}})};
globalThis.CSSStyleSheet=class{replaceSync(){}};
const windowEvents=new Map();window.addEventListener=(type,fn)=>windowEvents.set(type,fn);window.removeEventListener=type=>windowEvents.delete(type);
let nativeTone='light',onTone,unsubscribed=0;window.electronBridge={getSystemThemeVariant:()=>nativeTone,subscribeToSystemThemeVariant:fn=>{onTone=fn;return ()=>{unsubscribed++;};}};
const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
const overlay={visible:true,getTitlebarAreaRect:()=>geometry,addEventListener:(type,fn)=>events.set(type,fn),removeEventListener:type=>events.delete(type)};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{windowControlsOverlay:overlay}});
try{
 installNativeUi('caption-test');const node=nodes[0];let requests=0;window.sandroneReplayOpening=payload=>{assert.equal(payload,'replay');requests++;};nodes[1].click();assert.equal(requests,1,'replay only requests fixed animation');
 assert.equal(node.innerHTML,undefined,'only native OS glyphs, no duplicated symbols');assert.equal(node.style['--sandrone-caption-surface'],'#c6d0e4');nativeTone='dark';onTone();assert.equal(node.style['--sandrone-caption-surface'],'#171c32');
 assert.equal(node.hidden,false);assert.equal(node.style.width,'137px');assert.equal(node.style.height,'36px');
 geometry={x:0,y:0,width:1200,height:36};window.innerWidth=1337;events.get('geometrychange')();assert.equal(node.style.width,'137px');
 mode='dark';events.get('geometrychange')();assert.equal(node.hidden,false,'native glyphs may disagree with renderer theme');
 overlay.visible=false;events.get('geometrychange')();assert.equal(node.hidden,true,'fullscreen keeps no backing');
 installNativeUi('caption-test');assert.equal(nodes.length,2,'idempotent backing and replay');
 removeNativeUi();assert.equal(nodes.length,0);assert.equal(events.size,0);assert.equal(windowEvents.size,0);
 window.innerWidth=1090;geometry={x:0,y:0,width:0,height:0};header={getBoundingClientRect:()=>({y:0,height:36,width:1090})};
 installNativeUi('cold-start');const cold=nodes[0];assert.equal(cold.hidden,false,'cold WCO zero rectangle uses measured titlebar');assert.equal(cold.style.width,'138px');
 geometry={x:0,y:0,width:953,height:36};overlay.visible=true;events.get('geometrychange')();assert.equal(cold.style.width,'137px');
 document.fullscreenElement={};windowEvents.get('resize')();assert.equal(cold.hidden,true);document.fullscreenElement=null;
 overlay.visible=true;geometry={x:0,y:0,width:1200,height:36};window.innerWidth=1337;windowEvents.get('resize')();assert.equal(cold.style.width,'137px');
 removeNativeUi();assert.equal(windowEvents.size,0);
 assert.equal(unsubscribed,2,'native appearance listeners released');
 console.log('PASS: caption geometry, resize, theme-independent/fullscreen visibility, restore cleanup');
}finally{if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;}
