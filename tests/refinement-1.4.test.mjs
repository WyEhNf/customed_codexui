// Independent read-only verification of the real assembled 1.4 character packs.
// Does not open a client, inspect profile state, or regenerate artwork.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadCatalog,verifyPack} from '../integration/selection.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sharp=createRequire(import.meta.url)(process.env.SHARP_MODULE||'C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ffmpeg=process.env.FFMPEG_EXE||'C:/Users/admin/miniconda3/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=async f=>JSON.parse((await fs.readFile(f,'utf8')).replace(/^\uFEFF/,''));
const expected=['columbina','ayaka','hutao','nahida','furina','citlali','mitya','istaroth','sandrone'];
const catalog=await loadCatalog(root),report={pass:false,version:catalog.version,scope:'real assembled packs; no profile or client interaction',characters:[]};
const meanAbs=(a,b)=>{assert.equal(a.length,b.length);let total=0;for(let i=0;i<a.length;i++)total+=Math.abs(a[i]-b[i]);return total/a.length;};
const raster=async file=>sharp(file).resize(160,90,{fit:'fill'}).removeAlpha().raw().toBuffer();
let failure;
try{
 assert.match(catalog.version,/^1\.[456]\.\d+$/);assert.deepEqual(catalog.characters.map(c=>c.id).sort(),[...expected].sort());
 for(const c of catalog.characters){
  const {pack}=await verifyPack(root,c.id),meta=await json(path.join(pack,'presentation.json'));
  assert.equal(meta.releaseVersion,'1.4.0',c.id+' production version');
  const assetsModule=await import(pathToFileURL(path.join(pack,'engine/assets.mjs')).href+'?refinement='+Date.now());
  const assets=await assetsModule.openingAssets();
  assert.ok(assets.signature?.paths?.length,c.id+' original role signature preserved');
  assert.ok(assets.lettering&&!assets.letteringFallback,c.id+' actual engine loads new lettering');
  assert.equal(assets.lettering.id,c.id,c.id+' lettering identity');
  const letteringFile=path.join(pack,'assets/branding/opening-lettering.json'),lettering=await json(letteringFile);
  assert.ok((await fs.stat(letteringFile)).size<512*1024,c.id+' bounded lettering payload');
  assert.equal(lettering.fontsEmbedded,false,c.id+' no redistributed font files needed');
  assert.equal(lettering.origin,'local-font-outline');
  assert.equal(lettering.entries.cn.text,'CodeX',c.id+' correct CodeX case');
  assert.equal(lettering.entries.cn.font,'Segoe Script',c.id+' CodeX has actual script geometry');
  assert.equal(lettering.entries.sub.text,meta.themeName,c.id+' Chinese theme label is exact');
  for(const [key,glyph]of Object.entries(lettering.entries)){
   assert.ok(glyph.path.startsWith('M')&&glyph.path.length>50,c.id+' '+key+' actual outline geometry');
   if(/\p{Script=Han}/u.test(glyph.text))assert.equal(glyph.font,'华文行楷',c.id+' '+key+' Chinese art font');
   assert.doesNotMatch(glyph.path,/[<>]|\b(?:url|script|href|style)\b/i,c.id+' '+key+' geometry only');
   assert.equal(assets.lettering.entries[key].text,glyph.text,c.id+' '+key+' accessible copy preserved');
  }
  // Recompute the valid digest before injecting an out-of-bounds command:
  // rejection must be caused by geometry validation, not merely its hash.
  const bad=structuredClone(lettering);bad.entries.cn.path+='L999999,0';bad.geometrySha256=sha(JSON.stringify(bad.entries));
  assert.throws(()=>assetsModule.validateLettering(bad),/outside|Invalid/,'out-of-canvas lettering cannot reach renderer');
  const composition=await json(path.join(pack,'assets/ui/composition.json')),frame=await json(path.join(pack,'assets/ui/workspace-frame.json'));
  assert.equal(composition.refinementVersion,'1.4.0');assert.deepEqual(composition.workspaceFrame,frame);
  assert.equal(frame.id,c.id);assert.equal(frame.completeFourEdges,true);assert.equal(frame.hasOpaqueSurface,false);assert.equal(frame.sourcePersonRedrawn,false);
  assert.deepEqual(frame.bounds,{left:46,top:90,right:1876,bottom:990},c.id+' broad complete frame bounds');
  assert.ok(frame.maximumDeclaredOpacity<=.18,c.id+' faint background layer');
  const source=await fs.readFile(path.join(pack,'assets/ui',composition.sourceFile));assert.equal(sha(source),composition.sourceSha256,c.id+' unchanged daily source pixels');
  assert.equal(sha(await fs.readFile(path.join(pack,'themes/sandrone/background.png'))),composition.outputSha256,c.id+' deployed daily composition digest');
  const master=await fs.readFile(path.join(pack,'assets/ui/workspace-composition.svg'),'utf8'),frameSvg=await fs.readFile(path.join(pack,'assets/ui/workspace-frame.svg'),'utf8');
  const background=await json(path.join(pack,'assets/ui/workspace-background.json'));
  assert.equal(composition.framePlacement,'native-main-only',c.id+' frame placement follows native main');
  assert.equal(background.id,c.id);assert.equal(background.width,1920);assert.equal(background.height,1080);
  assert.equal(background.foreground,'workspace-foreground.png');assert.equal(background.frame,'workspace-frame.svg');
  assert.match(frameSvg,/preserveAspectRatio="none"/,c.id+' frame plane fits native main without letterbox');
  let frameStats;
  if(c.id==='sandrone'){
   assert.equal(background.mode,'original-in-main');
   assert.equal(frame.preserveOriginal,true);assert.doesNotMatch(master,/workspace-frame-sandrone/,'original Sandrone is not double-framed');
  }else{
   const personPosition=master.indexOf('<image');
   assert.equal(background.mode,'layered');assert.ok(personPosition>=0);
   assert.doesNotMatch(master,/id="workspace-frame-/,c.id+' daily bitmap has no baked viewport-wide frame');
   assert.match(frameSvg,new RegExp('id="workspace-frame-'+c.id+'"'),c.id+' frame remains a separate geometry layer');
   assert.match(master,/<g\s+mask="url\(#quiet\)">\s*<image/,c.id+' quiet fade belongs to source layer');
   assert.doesNotMatch(master.slice(personPosition),/<rect[^>]+fill="url\(#quiet(?:Alpha)?\)"/,c.id+' no late overlay erases left frame');
   assert.doesNotMatch(frameSvg.replace(/xmlns="[^"]+"/,''),/<(?:image|script|foreignObject)\b|\b(?:href|onload|onclick)=|https?:/i,c.id+' frame is self-contained geometry');
   const {data,info}=await sharp(Buffer.from(frameSvg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   assert.equal(info.width,1920);assert.equal(info.height,1080);let max=0,sum=0;
   const alpha=(x,y)=>data[(y*info.width+x)*4+3];for(let n=3;n<data.length;n+=4){max=Math.max(max,data[n]);sum+=data[n];}
   const edgeRatio=(axis,at,start,end)=>{let visible=0;for(let v=start;v<=end;v++){let a=0;for(let d=-1;d<=1;d++)a=Math.max(a,axis==='x'?alpha(at+d,v):alpha(v,at+d));if(a>8)visible++;}return visible/(end-start+1);};
   const edges={left:edgeRatio('x',46,94,986),right:edgeRatio('x',1876,94,986),top:edgeRatio('y',90,50,1872),bottom:edgeRatio('y',990,50,1872)};
   for(const [side,coverage]of Object.entries(edges))assert.ok(coverage>.995,c.id+' real '+side+' frame edge is complete');
   assert.ok(max<90,c.id+' no bright opaque frame pixels');assert.ok(sum/(info.width*info.height)<2,c.id+' sparse low-contrast wallpaper');
   frameStats={maximumAlpha:max/255,averageAlpha:sum/(info.width*info.height*255),edges};
  }
  let mitya;
  if(c.id==='mitya'){
   assert.equal(composition.source,'originals/mitya-M1.jpg','M1 original daily selection retained');
   assert.equal(composition.openingSource,'integration/art-revisions/v14/mitya-opening-quiet.png','independent quiet opening selected');
   const openingSource=path.join(root,composition.openingSource),openingBytes=await fs.readFile(openingSource);
   assert.equal(sha(openingBytes),composition.openingSourceSha256);assert.notEqual(composition.openingSourceSha256,composition.sourceSha256);
   assert.notEqual(composition.openingSourceSha256,'1320898899a3f43799111f52c39f29a6486d292696791c265c5f1b34be99fd98','old busy observatory art is replaced');
   const sourceDifference=meanAbs(await raster(openingBytes),await raster(source));assert.ok(sourceDifference>6,'opening is visibly independent from M1 interior art');
   const ledger=await json(path.join(pack,'assets/motion/derived.json')),metrics=await json(path.join(pack,'assets/motion/metrics.json'));
   assert.equal(ledger.sourceSha256,composition.openingSourceSha256,'new movie derives from the new quiet art');
   assert.deepEqual(ledger.environmentEffects.slice().sort(),['soft-lamplight','sparse-snow-beyond-window'],'restrained environment FX only');
   assert.doesNotMatch(JSON.stringify(ledger.environmentEffects),/orbital-highlights|palm-star-glow|starburst|magic-ring/i);
   assert.equal(ledger.globalCameraMotion,false);assert.equal(ledger.faceProtected,true);assert.equal(ledger.handJointProtected,true);
   assert.equal(metrics.rawFaceMAD,0,'quiet movie does not alter raw face pixels');assert.equal(metrics.rawProtectedMapMaxPx,0,'new hand/joint guards use exact fixed coordinates');
   assert.ok(metrics.localWarpPixelMAD>0,'new movie has actual local animation');assert.ok(metrics.encodedFaceMAD<4,'face differences are bounded encoding noise');
   assert.ok(ledger.motionRegions.every(r=>r.requestedDisplacementPx<=2.5),'quiet character motion stays restrained');
   const video=path.join(pack,'assets/motion',ledger.file),videoBytes=await fs.readFile(video);assert.equal(sha(videoBytes),ledger.sha256);assert.equal(videoBytes.subarray(4,8).toString(),'ftyp');
   const decoded=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-threads','1','-i',video,'-vf','fps=1,scale=160:90:flags=area','-frames:v','9','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,maxBuffer:2*1024*1024,encoding:null,timeout:30000});
   assert.equal(decoded.status,0,'actual quiet MP4 decodes');const size=160*90*3,frames=[];for(let offset=0;offset+size<=decoded.stdout.length;offset+=size)frames.push(decoded.stdout.subarray(offset,offset+size));assert.ok(frames.length>=8,'complete multi-second quiet clip');
   const consecutiveMAD=frames.slice(1).map((f,i)=>meanAbs(frames[i],f)),brightness=frames.map(f=>f.reduce((n,v)=>n+v,0)/f.length),brightnessRange=Math.max(...brightness)-Math.min(...brightness);
   assert.ok(Math.max(...consecutiveMAD)>.03,'actual decoded quiet clip is not a still carrier');assert.ok(brightnessRange<8,'no broad flash/pulse is introduced');
   mitya={sourceDifference,sourceSha256:composition.openingSourceSha256,environmentEffects:ledger.environmentEffects,rawFaceMAD:metrics.rawFaceMAD,rawProtectedMapMaxPx:metrics.rawProtectedMapMaxPx,decodedFrames:frames.length,consecutiveMAD,brightnessRange};
  }
  report.characters.push({id:c.id,letteringEntries:Object.keys(lettering.entries).length,letteringGeometrySha256:lettering.geometrySha256,frame:frameStats||{originalPreserved:true},...(mitya?{quietMitya:mitya}:{})});
  console.log('PASS refinement 1.4 '+c.id);
 }
 report.pass=true;
}catch(error){failure=error;report.failure={message:error.message};process.exitCode=1;}
await fs.mkdir(path.join(root,'evidence/refinement'),{recursive:true});await fs.writeFile(path.join(root,'evidence/refinement/refinement-1.4.json'),JSON.stringify(report,null,2));
if(failure)throw failure;console.log(JSON.stringify({pass:true,characters:report.characters.length,lettering:true,completeBackgroundFrames:true,quietIndependentMitya:true,profileRead:false,clientOperated:false}));
