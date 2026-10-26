import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validateSceneIntro} from '../engine/assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ids=['columbina','hutao','mitya','ayaka','nahida','furina','citlali','istaroth'];
const report=[];let fixture;
for(const id of ids){
 const folder=path.join(root,'characters',id,'assets/motion');
 const raw=await fs.readFile(path.join(folder,'scene-intro.json'));
 const poster=await fs.readFile(path.join(folder,'sandrone-first-frame.jpg'));
 const sha=createHash('sha256').update(poster).digest('hex');
 assert.ok(raw.length<512*1024);const value=JSON.parse(raw),validated=validateSceneIntro(value,id,sha);
 assert.ok(validated.environment.length>0&&validated.character.length>=8&&validated.details.length>0,id+' recognisable source groups');
 assert.ok(validated.character.every(p=>p.delayMs>=500),id+' environment appears before person');
 report.push({id,paths:validated.environment.length+validated.character.length+validated.details.length,bytes:raw.length,posterSha256:sha,kind:validated.scene.kind});
 fixture??={value,id,sha};
}
for(const change of [v=>v.posterSha256='0'.repeat(64),v=>v.scene.kind='time-sand',v=>v.character[0].d='M0,0 L1921,0',v=>v.character[0].d='M0,0 L0,1081',v=>v.character[0].d='M0,0 L1,1<script>',v=>v.character[0].delayMs=-1,v=>v.character[0].durationMs=100000,v=>v.scene.anchors.person=[Infinity,0],v=>v.character=Array(129).fill(v.character[0])]){
 const value=structuredClone(fixture.value);change(value);assert.throws(()=>validateSceneIntro(value,fixture.id,fixture.sha));
}
await fs.mkdir(path.join(root,'evidence/scene-entrance'),{recursive:true});await fs.writeFile(path.join(root,'evidence/scene-entrance/assets.json'),JSON.stringify({pass:true,characters:report},null,2));
console.log(JSON.stringify({pass:true,sourceBoundCharacters:8,rejectedMutations:9}));
