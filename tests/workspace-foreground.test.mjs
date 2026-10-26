// Pixel baselines were derived independently from the approved 1.4.1 SVGs:
// retain defs + original quiet-masked image, remove only canvas and frame.
// This test needs no older installation or original design directory.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sharp=createRequire(import.meta.url)(process.env.SHARP_MODULE||'sharp');
const sha=b=>createHash('sha256').update(b).digest('hex');
const baselines={
 columbina:'a3e0a7871ba3120108c56179f9b302e4a181c87eb022cf31cd7e322199ffe15a',
 ayaka:'1fc80ba7a272951e8a9ee68c6b8b9dc73157a4da969a33987b13cad26724e952',
 hutao:'23792aa786155c391869a74c8952b268fb82e120b2877b4f5a1a435446c73b30',
 nahida:'f56e208e2b53eb217159952f22e644dc6bae62c96ece36060527fd2f8fe66a8c',
 furina:'4c4d1d18c41de9eca009c3a6c150afdfe0cfedd1548647d10ae0fb4b0eff9188',
 citlali:'6eceb39ea27fcd990323ca61b8d026947e6f11dcb4ed8067cac6c453b5ea6118',
 mitya:'10c80b42b38180c28d4d89f5df4836d50e40e82e9e7bcf8c319ffc3d17e4eaf4',
 istaroth:'f64a018984c0784ad0763269a80ec1026fd8a3b64d97cbf9c1ea9b956df8e055',
 sandrone:'7c2e710cd3487b6df70b29de038f843589e3139e539bac684cf0214c69d61f90'
};
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8')),report=[];
assert.deepEqual(catalog.characters.map(c=>c.id).sort(),Object.keys(baselines).sort());
for(const c of catalog.characters){
 const pack=path.join(root,c.path),ui=path.join(pack,'assets/ui');
 const composition=JSON.parse(await fs.readFile(path.join(ui,'composition.json'),'utf8'));
 const config=JSON.parse(await fs.readFile(path.join(ui,'workspace-background.json'),'utf8'));
 assert.equal(config.schemaVersion,1);assert.equal(config.id,c.id);
 assert.equal(config.mode,c.id==='sandrone'?'original-in-main':'layered');
 assert.deepEqual([config.width,config.height,config.focusX,config.focusY],[1920,1080,.76,.46]);
 assert.equal(config.foreground,'workspace-foreground.png');assert.equal(config.frame,'workspace-frame.svg');
 assert.equal(composition.framePlacement,'native-main-only');assert.equal(composition.workspaceFrame.placement,'native-main-only');
 const foreground=await fs.readFile(path.join(ui,config.foreground));
 assert.equal(sha(foreground),composition.foregroundSha256);
 const {data,info}=await sharp(foreground).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.deepEqual([info.width,info.height,info.channels],[1920,1080,4]);
 assert.equal(sha(data),baselines[c.id],c.id+' exact approved foreground pixels, including original feather and quiet masks');
 const master=await fs.readFile(path.join(ui,'workspace-composition.svg'),'utf8');
 assert.doesNotMatch(master,/id="workspace-frame-|<rect width="1920" height="1080" fill="#[a-f0-9]{6}"/i,c.id+' foreground has neither baked frame nor opaque canvas');
 const frame=await fs.readFile(path.join(ui,config.frame),'utf8');
 assert.match(frame,/<svg[^>]+preserveAspectRatio="none"/,c.id+' vector frame plane can fit actual main bounds');
 if(c.id!=='sandrone'){
  let transparent=0,opaque=0;
  for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;if(data[i]>=240)opaque++;}
  assert.ok(transparent>info.width*info.height*.1,c.id+' substantial transparent quiet area');
  assert.ok(opaque>1000,c.id+' original image remains present');
  assert.match(frame,new RegExp('id="workspace-frame-'+c.id+'"'));
 }
 const actualFallback=await sharp(path.join(pack,'themes/sandrone/background.png')).ensureAlpha().raw().toBuffer();
 const expectedFallback=await sharp(foreground).flatten({background:config.canvasColor}).ensureAlpha().raw().toBuffer();
 assert.ok(actualFallback.equals(expectedFallback),c.id+' fallback has only approved foreground and canvas; runtime owns frame placement');
 assert.equal(sha(await fs.readFile(path.join(ui,composition.sourceFile))),composition.sourceSha256,c.id+' original source preserved');
 report.push({id:c.id,mode:config.mode,approvedForegroundRawSha256:sha(data),exactPixelMatch:true,framePlacement:composition.framePlacement});
}
await fs.mkdir(path.join(root,'evidence/workspace-frame'),{recursive:true});
await fs.writeFile(path.join(root,'evidence/workspace-frame/foreground-verification.json'),JSON.stringify({pass:true,characters:report,personRedrawn:false,personReshaped:false},null,2)+'\n');
console.log('PASS: all nine approved character compositions retain exact RGBA pixels; eight transparent layers, independent native-main frames, original Sandrone retained');
