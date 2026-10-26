import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRuntimeCache,sourceStamp} from '../engine/runtime-cache.mjs';

const directory=await fs.mkdtemp(path.join(os.tmpdir(),'codex-runtime-cache-'));
try{
 const file=path.join(directory,'approved.json');await fs.writeFile(file,'{"revision":1}');
 let time=0,reads=0,rejections=0;
 const cache=createRuntimeCache({sources:()=>[file],now:()=>time,load:async()=>{reads++;return JSON.parse(await fs.readFile(file,'utf8'));},onReject(){rejections++;}});
 assert.deepEqual(await cache.get(),{revision:1});
 for(time=1000;time<30000;time+=1000)assert.equal((await cache.get()).revision,1);
 assert.equal(reads,1,'unchanged idle checks stat sources without reading asset/config bytes');
 await cache.get();assert.equal(reads,2,'30-second strong audit refreshes validated bytes');
 await fs.writeFile(file,'{"revision":22}');time+=1000;
 assert.equal((await cache.get()).revision,22,'approved file metadata changes refresh without restarting the watcher');
 await fs.writeFile(file,'broken config');time+=1000;
 assert.equal((await cache.get()).revision,22,'invalid refresh keeps the previous valid snapshot');assert.equal(rejections,1);
 await fs.writeFile(file,'{"revision":333}');cache.invalidate();
 assert.equal((await cache.get()).revision,333,'a later valid revision recovers after rejection');
 const before=reads;await Promise.all([cache.get({force:true}),cache.get({force:true}),cache.get()]);
 assert.equal(reads,before+1,'concurrent readers share one reload');
 const original=await sourceStamp([file]);await fs.writeFile(file,'{"revision":4444}');assert.notEqual(await sourceStamp([file]),original);
 let race=false;
 const racing=createRuntimeCache({sources:()=>[file],load:async()=>{const value=JSON.parse(await fs.readFile(file,'utf8'));if(race)await fs.writeFile(file,'{"revision":55555}');return value;}});
 assert.equal((await racing.get()).revision,4444);race=true;
 assert.equal((await racing.get({force:true})).revision,4444,'source changes during validation cannot publish a mixed snapshot');
 console.log('PASS: bounded idle source reads, strong audit, validated refresh, last-good fallback and concurrent reload isolation');
}finally{await fs.rm(directory,{recursive:true,force:true});}
