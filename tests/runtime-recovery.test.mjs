import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createTargetLifecycle,earlyThemeSource,earlyScriptJournal,clearEarlyScripts,enableTargetBindings,closeTargetConnections} from '../engine/watcher-targets.mjs';
import {applyTargets} from '../engine/target-runner.mjs';

let time=0,sequence=0;const commands=[],evaluations=[],logs=[],scripts=[];
const session={closed:false,send:async(method,params)=>{commands.push([method,params]);return {identifier:String(++sequence)};},evaluate:async expression=>evaluations.push(expression)};
const lifecycle=createTargetLifecycle({now:()=>time,log:entry=>logs.push(entry),onScript:async(id,value)=>scripts.push([id,value])});
await lifecycle.ensure('main',session,'window.validatedSkin=1','revision-1');
await lifecycle.ensure('main',session,'window.validatedSkin=1','revision-1');
assert.equal(commands.filter(([name])=>name==='Page.addScriptToEvaluateOnNewDocument').length,1);
assert.equal(evaluations.length,1,'unchanged passes do not send an early payload again');
await lifecycle.ensure('main',session,'window.validatedSkin=2','revision-2');
assert.deepEqual(commands.map(([name])=>name),['Page.addScriptToEvaluateOnNewDocument','Page.removeScriptToEvaluateOnNewDocument','Page.addScriptToEvaluateOnNewDocument']);
assert.deepEqual(scripts,[['main','1'],['main',null],['main','3']]);
assert.ok(!commands[0][1].source.includes('showOpening'),'navigation bootstrap never replays an opening');
await lifecycle.forget('main',session);assert.equal(scripts.at(-1)[1],null);
for(let i=0;i<8;i++){
 lifecycle.failure('broken',{code:'CDP_CONTEXT',message:'private renderer text'});
 assert.equal(lifecycle.allowed('broken'),false);time+=30000;
}
assert.equal(logs.some(entry=>JSON.stringify(entry).includes('private')),false,'retry logs retain codes, not renderer text');
lifecycle.success('broken');assert.equal(lifecycle.allowed('broken'),true);
lifecycle.failure('retry',{code:'CDP_COMMAND'});assert.equal(lifecycle.waitMs(15000),1500,'a healthy sibling does not delay the first retry by 15 seconds');
const fallback=createTargetLifecycle();
await fallback.ensure('unsupported',{...session,send:async()=>{throw Object.assign(Error('Unsupported method'),{code:'CDP_COMMAND',cdpCode:-32601});}},'window.validatedSkin=1','revision-1');
assert.equal(fallback.fallback('unsupported'),true,'unsupported document-start registration retains immediate/load-event recovery');
await assert.rejects(createTargetLifecycle().ensure('loading',{...session,send:async()=>{throw Object.assign(Error('navigation'),{code:'CDP_CONTEXT'});}},'fixed','revision'),/navigation/);

// Execute the real upstream guarded bootstrap in an isolated document model.
let surface=false,domReady;const timers=new Map();
const context={window:{},location:{protocol:'app:'},document:{documentElement:{},querySelector:()=>surface?{}:null,addEventListener:(name,fn)=>{if(name==='DOMContentLoaded')domReady=fn;}},setInterval:fn=>{timers.set('interval',fn);return 1;},clearInterval:()=>timers.delete('interval'),setTimeout:fn=>{timers.set('timeout',fn);return 2;},clearTimeout:()=>timers.delete('timeout')};
vm.runInNewContext(earlyThemeSource('window.applied=(window.applied||0)+1','validated-revision'),context);
assert.equal(context.window.applied,undefined);surface=true;domReady();assert.equal(context.window.applied,1);assert.equal(timers.size,0,'late semantic surface installs and stops the bounded bootstrap');
context.location.protocol='https:';context.window.applied=0;vm.runInNewContext(earlyThemeSource('window.applied++','other'),context);assert.equal(context.window.applied,0,'a generic web page cannot receive the app-only payload');

let listener;const bindingCommands=[],bound={onEvent(fn){listener=fn;return ()=>{listener=null;};},send:async method=>{bindingCommands.push(method);}};
let wakes=0;assert.equal(await enableTargetBindings(bound,()=>wakes++),true);
listener('Runtime.executionContextsCleared',{});listener('Page.loadEventFired',{});
assert.equal(await enableTargetBindings(bound,()=>{throw Error('double listener');}),false);
assert.equal(bindingCommands.filter(name=>name==='Runtime.addBinding').length,2,'two fixed bindings are added once per connection, including after reload');assert.equal(wakes,2);
let connected=0;await applyTargets({pages:[{id:'broken'}],eligible:()=>false,connect:async()=>{connected++;},resources:async()=>{throw Error('must not read');}});assert.equal(connected,0,'backoff skips connection and asset work');
const shared=async()=>({loaded:{payload:'fixed',revision:'r',theme:{id:'fixed'}},css:'fixed'}),outcomes=[];
const mixed={pages:[{id:'broken'},{id:'healthy'}],resources:shared,connect:async page=>{if(page.id==='broken')throw Object.assign(Error('component failure'),{code:'CDP_COMMAND'});return {evaluate:async()=>true,close(){}};},onOutcome:(page,result)=>outcomes.push([page.id,result.status])};
assert.equal((await applyTargets({...mixed,tolerateTargetErrors:true})).ready,true,'watcher keeps a healthy sibling when another renderer has a command/component failure');
assert.deepEqual(outcomes,[['broken','rejected'],['healthy','fulfilled']]);
await assert.rejects(applyTargets(mixed),/component failure/,'explicit startup/apply still fail verification');
await assert.rejects(applyTargets({...mixed,tolerateTargetErrors:true,connect:async()=>{throw Object.assign(Error('identity changed'),{code:'IDENTITY_MISMATCH'});}}),/identity changed/);
let closed=0;const cleanLogs=[];
await closeTargetConnections(new Map([['one',{send:async()=>{},close:async()=>{closed++;}}],['two',{send:async()=>{},close:async()=>{closed++;}}]]),{forget:async()=>{throw Error('journal unavailable');}},entry=>cleanLogs.push(entry));
assert.equal(closed,2,'journal failure cannot retain either target connection');assert.deepEqual(cleanLogs,[{code:'WATCHER_CLEANUP_DEFERRED',targets:2}]);

const directory=await fs.mkdtemp(path.join(os.tmpdir(),'codex-early-script-'));
try{
 const file=path.join(directory,'early-scripts.json'),journal=await earlyScriptJournal(file,'browser-1');
 await journal.set('main','123');await journal.set('gone','456');
 const recovered=await earlyScriptJournal(file,'browser-1');assert.deepEqual(recovered.entries(),[['main','123'],['gone','456']]);
 const removal=[];await clearEarlyScripts(recovered,[{id:'main'}],async()=>({send:async(method,params)=>removal.push([method,params]),evaluate:async expression=>removal.push(['evaluate',expression]),close:async()=>{}}));
 assert.equal(removal[0][1].identifier,'123');assert.match(removal[1][1],/EARLY_GENERATION__=null/);assert.deepEqual((await earlyScriptJournal(file,'browser-1')).entries(),[],'replacement/restore clears both live and disappeared registrations');
 await journal.set('other','789');assert.deepEqual((await earlyScriptJournal(file,'different-browser')).entries(),[],'journal cannot cross browser ownership');
 await fs.writeFile(file,'{"schemaVersion":1,"browserId":"browser-1","scripts":[["main","x; arbitraryCode()"]]}');
 await assert.rejects(earlyScriptJournal(file,'browser-1'),/Invalid early-script journal/);
}finally{await fs.rm(directory,{recursive:true,force:true});}
console.log('PASS: early install and load fallback, refresh/removal journal, guarded navigation, retry isolation and reload binding ownership');
