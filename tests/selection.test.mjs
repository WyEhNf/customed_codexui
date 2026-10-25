import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inside,atomicJson,loadCatalog,verifyPack,stageCharacter,commitCharacter,finishCharacter,recoverPending} from '../integration/selection.mjs';
import {switchCharacter} from '../integration/coordinator.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'codexui-selection-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
async function put(name,text){const p=path.join(root,name);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,text);}
try{
 const characters=[];
 for(const id of ['alpha','beta']){
  const contents={'assets/avatar.png':id+'-avatar','themes/sandrone/theme.json':JSON.stringify({id}), 'themes/sandrone/background.png':id+'-background','engine/renderer.mjs':id+'-renderer','engine/native-ui.css':id+'-css','assets/branding/sandrone-signature.json':'signature-'+id};
  const files={};for(const [name,value]of Object.entries(contents)){await put('characters/'+id+'/'+name,value);files[name]=sha(value);}
  const bytes=JSON.stringify({id,files});await put('characters/'+id+'/active-files.json',bytes);characters.push({id,name:id,themeName:id,path:'characters/'+id,manifestSha256:sha(bytes)});
 }
 await atomicJson(path.join(root,'catalog.json'),{schemaVersion:1,defaultId:'alpha',characters});await put('integration/integrity-base.json','{}');
 assert.equal((await loadCatalog(root)).characters.length,2);
 for(const bad of ['../escape','/outside','a\\b','a/../b','C:/outside'])assert.throws(()=>inside(root,bad));
 await assert.rejects(verifyPack(root,'durin'),/Unknown/);
 await switchCharacter({root,id:'alpha',offline:true});assert.equal(await fs.readFile(path.join(root,'assets/avatar.png'),'utf8'),'alpha-avatar');
 const events=[];
 const result=await switchCharacter({root,id:'beta',managedAlive:async()=>true,control:async(action,replay)=>{events.push([action,replay]);return {status:'ready'};}});
 assert.equal(result.status,'ready');assert.deepEqual(events,[['prepare-switch',false],['launch',true]],'retain old skin and request one opening, without upstream pause/remove');
 assert.equal(await fs.readFile(path.join(root,'assets/avatar.png'),'utf8'),'beta-avatar');
 const oldIntegrity=await fs.readFile(path.join(root,'integrity.json'),'utf8');let tx=await stageCharacter(root,'alpha');
 await assert.rejects(commitCharacter(root,tx,{afterStep:n=>{if(n==='themes')throw new Error('simulated disk failure');}}),/disk failure/);
 assert.equal(await fs.readFile(path.join(root,'assets/avatar.png'),'utf8'),'beta-avatar');assert.equal(await fs.readFile(path.join(root,'integrity.json'),'utf8'),oldIntegrity);
 await atomicJson(path.join(root,'state/pending-switch.json'),{token:tx.journal.token});assert.equal(await recoverPending(root),false,'a completed rollback is not replayed');assert.equal(await fs.readFile(path.join(root,'assets/avatar.png'),'utf8'),'beta-avatar');
 const failures=[];await assert.rejects(switchCharacter({root,id:'alpha',managedAlive:async()=>true,control:async(a,replay)=>{failures.push([a,replay]);return a==='prepare-switch'?{status:'ready'}:replay?{status:'error',detail:'renderer failed'}:{status:'ready'};}}),/renderer failed/);
 assert.deepEqual(failures,[['prepare-switch',false],['launch',true],['launch',false]],'rollback reapplies old theme without another switch intro or a pause UI');
 const blocked=[];await assert.rejects(switchCharacter({root,id:'alpha',managedAlive:async()=>true,control:async(a,replay)=>{blocked.push([a,replay]);return {status:'blocked',detail:'watcher identity mismatch'};}}),/identity mismatch/);
 assert.deepEqual(blocked,[['prepare-switch',false]]);assert.equal(await fs.readFile(path.join(root,'assets/avatar.png'),'utf8'),'beta-avatar','failed preparation leaves current pack in place');
 assert.equal(await fs.readFile(path.join(root,'assets/avatar.png'),'utf8'),'beta-avatar');
 tx=await stageCharacter(root,'alpha');await commitCharacter(root,tx);assert.equal(await recoverPending(root),true);assert.equal(await fs.readFile(path.join(root,'assets/avatar.png'),'utf8'),'beta-avatar');
 // Simulate the narrower crash window before the first journal checkpoint.
 tx=await stageCharacter(root,'alpha');await atomicJson(path.join(root,'state/pending-switch.json'),{token:tx.journal.token});
 await fs.mkdir(path.join(tx.directory,'backup'),{recursive:true});await fs.rename(path.join(root,'assets'),path.join(tx.directory,'backup/assets'));await fs.rename(path.join(tx.staged,'assets'),path.join(root,'assets'));
 assert.equal(await recoverPending(root),true);assert.equal(await fs.readFile(path.join(root,'assets/avatar.png'),'utf8'),'beta-avatar');
 const saved=JSON.parse(await fs.readFile(path.join(root,'characters/alpha/active-files.json'),'utf8'));
 await put('characters/alpha/assets/avatar.png','tampered');await assert.rejects(stageCharacter(root,'alpha'),/changed/);assert.equal(await fs.readFile(path.join(root,'assets/avatar.png'),'utf8'),'beta-avatar');
 console.log('PASS: allowlist, pack digests, one replay, atomic deployment, rollback, interrupted-switch recovery');
}finally{
 const resolved=path.resolve(root),tmp=path.resolve(os.tmpdir());if(resolved.startsWith(tmp+path.sep)&&path.basename(resolved).startsWith('codexui-selection-'))await fs.rm(resolved,{recursive:true,force:true});
}
