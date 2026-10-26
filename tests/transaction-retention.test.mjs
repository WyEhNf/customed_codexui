import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pruneCompletedTransactions} from '../integration/transaction-gc.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'codexui-retention-')),base=path.join(root,'state/transactions');
const targets=['assets','themes','engine/renderer.mjs','engine/native-ui.css','integrity.json','state/selection.json'];
const exists=async f=>fs.access(f).then(()=>true,()=>false);
async function record(index,extra={}){const token=randomUUID(),dir=path.join(base,token);await fs.mkdir(path.join(dir,'backup'),{recursive:true});await fs.writeFile(path.join(dir,'backup/retained.txt'),'recovery');await fs.writeFile(path.join(dir,'journal.json'),JSON.stringify({schemaVersion:1,token,id:'alpha',committed:true,completedAt:new Date(1700000000000+index*1000).toISOString(),steps:targets.map(target=>({target,installed:true})),...extra}));return {token,dir};}
try{
 const completed=[];for(let i=0;i<6;i++)completed.push(await record(i));
 const pending=await record(-1);await fs.writeFile(path.join(root,'state/pending-switch.json'),JSON.stringify({token:pending.token}));
 const failed=await record(-2,{committed:false,rolledBack:true});await fs.mkdir(path.join(failed.dir,'failed'));
 const unknown=await record(-3,{steps:[{target:'profile',installed:true}]});
 const linked=await record(-4),outside=path.join(root,'outside');await fs.mkdir(outside);await fs.writeFile(path.join(outside,'sentinel.txt'),'must survive');await fs.symlink(outside,path.join(linked.dir,'backup/linked'),process.platform==='win32'?'junction':'dir');
 const result=await pruneCompletedTransactions(root,{keep:3});assert.equal(result.removed,3);
 for(const item of completed.slice(0,3))assert.equal(await exists(item.dir),false,'old successful snapshots pruned');
 for(const item of [...completed.slice(3),pending,failed,unknown,linked])assert.equal(await exists(item.dir),true,'recovery or uncertain records preserved');
 assert.equal(await fs.readFile(path.join(outside,'sentinel.txt'),'utf8'),'must survive','recursive cleanup never follows junctions');
 assert.equal((await pruneCompletedTransactions(root,{keep:3})).removed,0,'cleanup idempotent');
 await assert.rejects(pruneCompletedTransactions(root,{keep:0}),/retention/);
 await fs.writeFile(path.join(root,'state/pending-switch.json'),'bad json');assert.equal((await pruneCompletedTransactions(root,{keep:3})).removed,0,'malformed pending pointer fails closed');
 for(const invalid of [{},{token:null},{token:'unknown'},[],null]){await fs.writeFile(path.join(root,'state/pending-switch.json'),JSON.stringify(invalid));assert.deepEqual(await pruneCompletedTransactions(root,{keep:1}),{removed:0,retained:0,skipped:1},'uncertain pending pointer shape preserves all recovery history');}
 console.log('PASS: bounded completed history; pending/failed/unknown/junction targets preserved; idempotent cleanup');
}finally{const resolved=path.resolve(root);if(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('codexui-retention-'))await fs.rm(resolved,{recursive:true,force:true});}
