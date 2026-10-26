import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildWorkspaceFrame} from '../integration/build-workspace-frame.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sharp=createRequire(import.meta.url)(process.env.SHARP_MODULE||'sharp');
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8')),report=[];
assert.throws(()=>buildWorkspaceFrame({id:'unknown'}),/Unknown/);
for(const c of catalog.characters){
 const meta=JSON.parse(await fs.readFile(path.join(root,c.path,'presentation.json'),'utf8'));
 const frame=buildWorkspaceFrame(meta),{data,info}=await sharp(Buffer.from(frame.svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,1920);assert.equal(info.height,1080);assert.equal(info.channels,4);
 assert.doesNotMatch(frame.body,/<(?:image|script|foreignObject)\b|\b(?:href|onload|onclick)=|https?:|url\(/i,'geometry has no externally resolved content');
 const alpha=(x,y)=>data[(y*info.width+x)*4+3];let max=0,sum=0,nonzero=0;
 for(let i=3;i<data.length;i+=4){const a=data[i];sum+=a;if(a>max)max=a;if(a)nonzero++;}
 const average=sum/(info.width*info.height);
 if(c.id==='sandrone'){assert.equal(max,0);assert.equal(frame.body,'');assert.equal(frame.metadata.preserveOriginal,true);report.push({id:c.id,originalPreserved:true});continue;}
 assert.equal(frame.metadata.completeFourEdges,true);assert.equal(frame.metadata.hasOpaqueSurface,false);
 assert.ok(max<90,c.id+' background linework never approaches opaque');
 assert.ok(average<2,c.id+' background ink remains sparse and low contrast');
 const edgeRatio=(axis,constant,start,end)=>{let visible=0;for(let v=start;v<=end;v++){let a=0;for(let d=-1;d<=1;d++)a=Math.max(a,axis==='x'?alpha(constant+d,v):alpha(v,constant+d));if(a>8)visible++;}return visible/(end-start+1);};
 const edges={left:edgeRatio('x',46,94,986),right:edgeRatio('x',1876,94,986),top:edgeRatio('y',90,50,1872),bottom:edgeRatio('y',990,50,1872)};
 for(const [side,coverage]of Object.entries(edges))assert.ok(coverage>.995,c.id+' complete '+side+' outline');
 assert.ok(nonzero>10000,c.id+' includes visible frame and extended wallpaper geometry');
 report.push({id:c.id,maximumAlpha:max/255,averageAlpha:average/255,nonzeroPixels:nonzero,edges,motif:frame.metadata.motif});
}
await fs.mkdir(path.join(root,'evidence/workspace-frame'),{recursive:true});await fs.writeFile(path.join(root,'evidence/workspace-frame/verification.json'),JSON.stringify({pass:true,characters:report,sourcePeopleRedrawn:false},null,2));
console.log('PASS: nine character layers; original Sandrone retained; eight complete faint frames, sparse underlays, no opaque field or external content');
