import {createHash} from 'node:crypto';
import {installCharacterIcons} from './character-icons.mjs';
import {installMaterialUi} from './material-ui.mjs';
import {installCharacterSwitcher} from './embedded-ui.mjs';
import {installWorkspaceBackground} from './workspace-background.mjs';

// The small probe is sent on idle passes. Large image/config expressions are
// built once per validated snapshot and transferred only for missing revisions.
export function probeDecorators(expected){
 const states={workspace:window.__CODEX_WORKSPACE_BACKGROUND__,icons:window.__CODEX_CHARACTER_ICONS__,switcher:window.__CODEX_CHARACTER_SWITCHER__,materials:window.__CODEX_CHARACTER_MATERIALS__};
 const healthy={
  workspace:()=>states.workspace&&typeof states.workspace.isHealthy==='function'?states.workspace.isHealthy():Boolean(states.workspace&&document.body?.isConnected),
  icons:()=>Boolean(states.icons&&document.adoptedStyleSheets.includes(states.icons.sheet)),
  switcher:()=>Boolean(states.switcher?.host?.isConnected&&states.switcher.host.shadowRoot?.adoptedStyleSheets.includes(states.switcher.sheet)),
  materials:()=>Boolean(states.materials?.host?.isConnected&&states.materials.host.shadowRoot?.adoptedStyleSheets.includes(states.materials.sheet)),
 };
 return Object.keys(expected).filter(key=>states[key]?.runtimeRevision!==expected[key]||!healthy[key]?.());
}
export function stampDecorator(key,revision){
 const state=({workspace:window.__CODEX_WORKSPACE_BACKGROUND__,icons:window.__CODEX_CHARACTER_ICONS__,switcher:window.__CODEX_CHARACTER_SWITCHER__,materials:window.__CODEX_CHARACTER_MATERIALS__})[key];
 if(!state)throw Error('Decorator installation did not create its owned state');state.runtimeRevision=revision;
}
const expression=(fn,...args)=>`(${fn.toString()})(${args.map(value=>JSON.stringify(value)).join(',')})`;
export function createDecoratorBundle(config){
 const {iconSet,materialUi,workspaceBackground,...menu}=config;
 const entries=[['workspace',installWorkspaceBackground,workspaceBackground],['icons',installCharacterIcons,iconSet],['switcher',installCharacterSwitcher,menu],['materials',installMaterialUi,materialUi]];
 const expected={},payloads={};
 for(const [key,install,value]of entries){
  const source=expression(install,value),revision=createHash('sha256').update(source).digest('hex');
  expected[key]=revision;payloads[key]=source+';'+expression(stampDecorator,key,revision);
 }
 return {expected,payloads,probe:expression(probeDecorators,expected),revision:createHash('sha256').update(JSON.stringify(expected)).digest('hex')};
}
export async function decorateSession(session,bundle,{force=false}={}){
 const missing=force?Object.keys(bundle.expected):await session.evaluate(bundle.probe);
 if(!Array.isArray(missing)||missing.some(key=>!Object.hasOwn(bundle.payloads,key)))throw Error('Invalid decorator health response');
 for(const key of missing)await session.evaluate(bundle.payloads[key]);
 return {installed:missing,bytes:missing.reduce((total,key)=>total+Buffer.byteLength(bundle.payloads[key]),Buffer.byteLength(bundle.probe))};
}
