import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import path from 'node:path';
import {parseSwitchRequest,spawnSwitchWorker} from '../integration/embedded-bridge.mjs';
import {windowsPowerShellEnv} from '../integration/control-env.mjs';
import {spawnSync} from 'node:child_process';
const inherited={Path:process.env.Path||process.env.PATH,PSModulePath:'C:\\Program Files\\PowerShell\\7\\Modules',pSmOdUlEpAtH:'incompatible',KEEP:'test'};
const clean=windowsPowerShellEnv(inherited);assert.equal(clean.KEEP,'test');assert.equal(Object.keys(clean).some(k=>k.toLowerCase()==='psmodulepath'),false);assert.ok(inherited.PSModulePath,'caller environment is unchanged');
if(process.platform==='win32'){
 const probe=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Import-Module Microsoft.PowerShell.Security -ErrorAction Stop; (Get-Command Get-AuthenticodeSignature).Name'],{windowsHide:true,encoding:'utf8',env:windowsPowerShellEnv({...process.env,PSModulePath:inherited.PSModulePath})});
 assert.equal(probe.status,0,probe.stderr);assert.match(probe.stdout,/Get-AuthenticodeSignature/);
}
const request={id:'ayaka',requestId:'31f12b06-4af3-4cb1-a315-0b5b1a1c5fa9'},ids=new Set(['ayaka','istaroth']);
assert.deepEqual(parseSwitchRequest(JSON.stringify(request),ids),request);
for(const payload of [JSON.stringify({...request,id:'durin'}),JSON.stringify({...request,id:'../ayaka'}),JSON.stringify({...request,requestId:'cmd.exe'}),JSON.stringify({...request,path:'any'}),'null','[]','bad',' '.repeat(201)])assert.throws(()=>parseSwitchRequest(payload,ids));
let args,options,command,unref=false;
const child=new EventEmitter();child.unref=()=>{unref=true;};
const root=path.resolve('integration-fixture');
const result=spawnSwitchWorker(root,request,(c,a,o)=>{command=c;args=a;options=o;queueMicrotask(()=>child.emit('spawn'));return child;});
assert.equal(await result,child);assert.equal(command,process.execPath);
assert.deepEqual(args,[path.join(root,'integration/switch.mjs'),'--select','ayaka','--request-id',request.requestId]);
assert.equal(options.detached,true,'worker must survive stopping the old watcher');assert.equal(options.windowsHide,true);assert.equal(options.stdio,'ignore');assert.equal(options.shell,undefined);assert.equal(unref,true);
const failed=new EventEmitter();await assert.rejects(spawnSwitchWorker(root,request,()=>{queueMicrotask(()=>failed.emit('error',new Error('spawn failed')));return failed;}),/spawn failed/);
console.log('PASS: embedded requests are allowlisted, workers are detached without shell commands, spawn failures are reported');
