// Read-only production asset verification. Does not launch or connect to Codex.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadCatalog,verifyPack} from '../integration/selection.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'evidence/release-qa');
await fs.mkdir(out,{recursive:true});
const expected=['columbina','ayaka','hutao','nahida','furina','citlali','mitya','istaroth','sandrone'];
const ffmpeg=process.env.FFMPEG_EXE||'ffmpeg';
const digest=b=>createHash('sha256').update(b).digest('hex');
const read=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
function decode(file,{frames=1,fps=1}={}){
 const filter=(frames>1?'fps='+fps+',':'')+'scale=160:90:flags=area';
 const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-threads','1','-i',file,'-vf',filter,'-frames:v',String(frames),'-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,encoding:null,maxBuffer:8*1024*1024,timeout:45000});
 assert.equal(r.status,0,'FFmpeg decodes '+path.basename(file)+': '+r.stderr?.toString());
 const size=160*90*3;assert.ok(r.stdout.length>=size,'Decoded frame present');
 return Array.from({length:Math.floor(r.stdout.length/size)},(_,i)=>r.stdout.subarray(i*size,(i+1)*size));
}
function mad(a,b){assert.equal(a.length,b.length);let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/a.length;}
const catalog=await loadCatalog(root),results=[];
assert.deepEqual(catalog.characters.map(c=>c.id).sort(),[...expected].sort(),'Exactly the requested nine; no Durin');
assert.equal(catalog.version,(await read(path.join(root,'package.json'))).version,'Production catalog matches authoritative package version');
let failure;
try{
 for(const c of catalog.characters){
  const {pack}=await verifyPack(root,c.id);
  const {openingAssets}=await import(pathToFileURL(path.join(pack,'engine/assets.mjs')).href+'?releaseqa='+Date.now());
  const assets=await openingAssets();
  const ledger=await read(path.join(pack,'assets/motion/derived.json'));
  const video=path.join(pack,'assets/motion',ledger.file),poster=path.join(pack,'assets/motion/sandrone-first-frame.jpg');
  const bytes=await fs.readFile(video),posterBytes=await fs.readFile(poster);
  assert.ok(bytes.length<=12*1024*1024,c.id+' video fits validated budget');
  assert.ok(['sandrone-loop-1080p.mp4','sandrone-loop-720p.mp4'].includes(ledger.file),c.id+' fixed allowed movie filename');
  assert.equal(bytes.subarray(4,8).toString(),'ftyp',c.id+' MP4 signature');
  assert.equal(digest(bytes),ledger.sha256,c.id+' movie digest');
  assert.equal(digest(posterBytes),ledger.posterSha256,c.id+' poster digest');
  assert.ok(posterBytes.length<1024*1024,c.id+' poster fits validated budget');
  assert.ok(Number.isFinite(ledger.seconds)&&ledger.seconds>=6&&ledger.seconds<=15,c.id+' bounded movie length');
  assert.equal(assets.durationMs,ledger.seconds*1000,c.id+' validated movie duration reaches the renderer');
  assert.equal(assets.fullScene,ledger.fullScene===true,c.id+' validated scene-layout metadata reaches the renderer');
  assert.ok(assets.video?.startsWith('data:video/mp4;base64,'),c.id+' openingAssets loads validated video instead of silently falling back');
  assert.ok(assets.videoPoster?.startsWith('data:image/jpeg;base64,'),c.id+' openingAssets loads matching poster');
  assert.ok(assets.signature?.paths?.length>=1&&assets.signature.paths.length<=12,c.id+' validated cursive outline');
  const frames=decode(video,{frames:Math.floor(ledger.seconds),fps:1});
  assert.ok(frames.length>=Math.floor(ledger.seconds)-1,c.id+' enough distinct decode timestamps');
  const frameMAD=frames.slice(1).map((f,i)=>mad(frames[i],f));
  assert.ok(Math.max(...frameMAD)>.15,c.id+' movie contains actual frame change rather than a repeated still');
  const first=decode(video)[0],posterMAD=mad(first,decode(poster)[0]);
  assert.ok(posterMAD<8,c.id+' poster depicts actual first video frame');
  const daily=path.join(pack,'themes/sandrone/background.png'),dailyMAD=mad(first,decode(daily)[0]);
  assert.ok(dailyMAD>3,c.id+' opening and daily composition are visibly independent');
  let localAnimation;
  if(c.id!=='sandrone'){
   assert.equal(ledger.fullScene,true,c.id+' uses the approved full-scene opening');
   assert.equal(ledger.animationKind,'illustrated-local-motion',c.id+' honestly classified animation');
   assert.equal(assets.animationKind,ledger.animationKind,c.id+' validated classification reaches renderer');
   assert.equal(ledger.globalCameraMotion,false,c.id+' no global pan/zoom substitute');
   assert.equal(ledger.faceProtected,true,c.id+' protected face geometry');
   assert.equal(ledger.handJointProtected,true,c.id+' protected hand/joint geometry');
   assert.ok(Array.isArray(ledger.motionRegions)&&ledger.motionRegions.length>0,c.id+' local character motion specification');
   assert.ok(Array.isArray(ledger.protectionRegions)&&ledger.protectionRegions.length>0,c.id+' protection specification');
   const metrics=await read(path.join(pack,'assets/motion/metrics.json'));
   assert.equal(metrics.rawFaceMAD,0,c.id+' pre-encoding face is held unchanged');
   assert.ok(Number.isFinite(metrics.rawProtectedMapMaxPx)&&metrics.rawProtectedMapMaxPx<1e-5,c.id+' protected-region mesh displacement stays below 1e-5 px (float32 sampling tolerance)');
   assert.ok(metrics.localWarpPixelMAD>0,c.id+' local motion exists even before environment effects');
   localAnimation={kind:ledger.animationKind,regions:ledger.motionRegions.length,faceProtected:true,protectedMapMaxPx:metrics.rawProtectedMapMaxPx,localWarpPixelMAD:metrics.localWarpPixelMAD};
  }
  results.push({id:c.id,seconds:ledger.seconds,bytes:bytes.length,sha256:ledger.sha256,signaturePaths:assets.signature.paths.length,decodedFrames:frames.length,consecutiveFrameMAD:frameMAD,posterFirstFrameMAD:posterMAD,dailyOpeningMAD:dailyMAD,...(localAnimation?{localAnimation}:{retainedOriginalVideo:true})});
  console.log('PASS production assets '+c.id);
 }
 const source=await fs.readFile(path.join(root,'integration/package.py'),'utf8');
 for(const excluded of ['profile','state','logs','evidence','backups','machine.json'])assert.ok(source.includes(excluded),'Share packaging explicitly excludes '+excluded);
 const setup=await fs.readFile(path.join(root,'Setup.ps1'),'utf8');
 assert.match(setup,/Join-Path \$desktop 'codexui'/,'Desktop output folder');
 assert.match(setup,/CodexUI\.exe/,'Shortcuts target integrated launcher');
 assert.match(setup,/--restore/,'Official appearance restore entry');
 assert.match(setup,/--character /,'Direct character entries');
 const archiveAt=process.argv.indexOf('--archive');
 if(archiveAt>=0){
  const archive=process.argv[archiveAt+1];assert.ok(archive,'Archive path required');
  const code=`import sys,json,zipfile\nfrom pathlib import PurePosixPath\nwith zipfile.ZipFile(sys.argv[1]) as z:\n names=z.namelist()\n bad=[n for n in names if set(PurePosixPath(n).parts)&{'profile','state','logs','evidence','backups','.git','.codex','__pycache__'} or PurePosixPath(n).name=='machine.json' or any(p.startswith('.env') for p in PurePosixPath(n).parts)]\n assert not bad,'Private/session files present: '+repr(bad)\n assert not any('durin' in n.lower() for n in names),'Excluded character is packaged'\n assert z.testzip() is None,'Archive CRC failure'\n assert 'Windows-Portable/integrity.json' in names,'Missing root integrity'\n print(json.dumps({'pass':True,'files':len(names),'personalStateIncluded':False}))`;
  const r=spawnSync(process.env.PYTHON_EXE||'python',['-c',code,archive],{windowsHide:true,encoding:'utf8',timeout:60000});
  assert.equal(r.status,0,'Release archive privacy/CRC: '+r.stderr);console.log('PASS archive '+r.stdout.trim());
 }
}catch(error){failure={message:error.message,stack:error.stack};process.exitCode=1;}
const report={pass:!failure,scope:'read-only-real-production-assets-and-decode',characters:results,privacyFilesRead:false,clientStarted:false,...(failure?{failure}:{})};
await fs.writeFile(path.join(out,'production-assets.json'),JSON.stringify(report,null,2));
if(failure)throw Error(failure.message);
console.log(JSON.stringify({pass:true,characters:results.length,realDecode:true,localMotionVerified:true,posterVerified:true,cursive:true}));
