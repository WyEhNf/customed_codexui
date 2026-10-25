import fs from 'node:fs/promises';
export const DEFAULT_PORT=19337;
export function managedPort(state){
 if(state===undefined)return DEFAULT_PORT;
 if(!state||typeof state!=='object'||Array.isArray(state))throw new Error('Invalid managed debugger state');
 if(state.port===undefined)return DEFAULT_PORT;
 if(!Number.isInteger(state.port)||state.port<1024||state.port>65535)throw new Error('Invalid managed debugger port');
 return state.port;
}
async function recordedPort(){
 let text;try{text=await fs.readFile(new URL('../state/managed.json',import.meta.url),'utf8');}catch(error){if(error.code==='ENOENT')return DEFAULT_PORT;throw error;}
 return managedPort(JSON.parse(text.replace(/^\uFEFF/,'')));
}
// A session process uses one verified local endpoint for its whole lifetime.
// The controller writes the new record before starting a fresh watcher.
export const PORT=await recordedPort();
const failure=(message,code)=>Object.assign(new Error(message),{code});
export const protocolFailure=error=>Object.assign(failure(error.message,/context|target|session|frame|navigat/i.test(error.message)?'CDP_CONTEXT':'CDP_COMMAND'),{cdpCode:error.code});
export function debuggerUrl(value,browserId=null){
 if(typeof value!=='string'||value!==value.trim()||!new RegExp('^ws://127\\.0\\.0\\.1:'+PORT+'/devtools/(page|browser)/[A-Za-z0-9._-]{1,200}$').test(value))throw new Error('Rejected non-loopback debugger identity');
 const u=new URL(value);
 if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||u.port!==String(PORT)||u.username||u.password||u.search||u.hash||!/^\/devtools\/(page|browser)\/[A-Za-z0-9._-]{1,200}$/.test(u.pathname))throw new Error('Rejected non-loopback debugger identity');
 if(browserId!==null&&(typeof browserId!=='string'||!/^[A-Za-z0-9._-]{1,200}$/.test(browserId)||u.pathname!==`/devtools/browser/${browserId}`))throw failure('Browser identity changed','IDENTITY_MISMATCH');
 return u.href;
}
async function json(resource){
 let r;try{r=await fetch(`http://127.0.0.1:${PORT}${resource}`,{signal:AbortSignal.timeout(1500),redirect:'error'});}catch{throw failure('Local debugger unavailable','CDP_UNAVAILABLE');}
 if(!r.ok)throw failure('Local debugger unavailable','CDP_UNAVAILABLE');
 const text=await r.text();if(text.length>1024*1024)throw new Error('Debugger metadata too large');return JSON.parse(text);
}
export async function identity(browserId){
 if(typeof browserId!=='string'||browserId!==browserId.trim()||!/^[A-Za-z0-9._-]{1,200}$/.test(browserId))throw new Error('Invalid browser ID');
 const v=await json('/json/version');return debuggerUrl(v.webSocketDebuggerUrl,browserId);
}
export async function appPages(browserId){
 await identity(browserId);const list=await json('/json/list');
 if(!Array.isArray(list))throw new Error('Invalid target list');
 return list.filter(p=>{
  try{return p.type==='page'&&typeof p.id==='string'&&/^[A-Za-z0-9._-]{1,200}$/.test(p.id)&&p.url.startsWith('app:')&&!/avatar-overlay|pet-overlay/.test(p.url)&&new URL(debuggerUrl(p.webSocketDebuggerUrl)).pathname===`/devtools/page/${p.id}`;}catch{return false;}
 });
}
export class Session{
 constructor(url){this.url=debuggerUrl(url);this.seq=0;this.waiting=new Map();this.events=new Set();this.closed=false;}
 async open(){
  this.socket=new WebSocket(this.url);
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>{this.socket.close();reject(failure('Debugger connection timed out','CDP_TIMEOUT'));},2000);this.socket.onopen=()=>{clearTimeout(t);resolve();};this.socket.onerror=()=>{clearTimeout(t);reject(failure('Debugger connection failed','CDP_CLOSED'));};this.socket.onclose=()=>{clearTimeout(t);this.closed=true;reject(failure('Debugger closed before connection','CDP_CLOSED'));};});
  this.socket.onmessage=e=>{try{const v=JSON.parse(e.data);if(v.method){for(const listener of this.events)listener(v.method,v.params);return;}const job=this.waiting.get(v.id);if(!job)return;this.waiting.delete(v.id);clearTimeout(job.timer);v.error?job.reject(protocolFailure(v.error)):job.resolve(v.result);}catch{}};
  this.socket.onclose=()=>{this.closed=true;for(const job of this.waiting.values()){clearTimeout(job.timer);job.reject(failure('Debugger session closed','CDP_CLOSED'));}this.waiting.clear();};return this;
 }
 async send(method,params={}){
  if(this.closed)throw failure('Debugger session is closed','CDP_CLOSED');const id=++this.seq;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.waiting.delete(id);reject(failure('Debugger command timed out','CDP_TIMEOUT'));},3000);this.waiting.set(id,{resolve,reject,timer});try{this.socket.send(JSON.stringify({id,method,params}));}catch{clearTimeout(timer);this.waiting.delete(id);reject(failure('Debugger session is closed','CDP_CLOSED'));}});
 }
 async evaluate(expression){const r=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('Fixed renderer component failed: '+(r.exceptionDetails.exception?.description?.split('\n')[0]||r.exceptionDetails.text));return r.result?.value;}
 onEvent(listener){this.events.add(listener);return ()=>this.events.delete(listener);}
 close(){
  if(this.closingPromise)return this.closingPromise;
  const socket=this.socket;if(!socket||socket.readyState===3)return Promise.resolve();
  this.closingPromise=new Promise(resolve=>{const timer=setTimeout(resolve,500);socket.addEventListener('close',()=>{clearTimeout(timer);resolve();},{once:true});if(socket.readyState<2)socket.close();});
  return this.closingPromise;
 }
}
