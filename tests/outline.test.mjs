import assert from 'node:assert/strict';
import {openingAssets,validateOutline,validateSignature} from '../engine/assets.mjs';
const assets=await openingAssets();
assert.equal(assets.outlineFallback,true,'no Sandrone contour is used for new artwork');
const valid={version:3,style:'character-features-water',width:1280,height:720,sourceSha256:'known',paths:['M1,2 L100,200'],facePaths:['M1000,400 L1010,410'],waterPaths:['M500,500 Q600,520 700,500']};
assert.equal(validateOutline(valid,'known').paths.length,1);
for(const bad of [
 {...valid,sourceSha256:'other'},
 {...valid,paths:['<script>alert(1)</script>']},
 {...valid,paths:['M1,2 L100,200" onload="x']},
 {...valid,paths:['M1,2 L1281,720']},
 {...valid,paths:['M1,2 L100,721']},
 {...valid,paths:['M1,2 L-1,2']},
 {...valid,paths:Array(97).fill('M1,2 L2,3')},
 {...valid,facePaths:Array(33).fill('M1,2 L2,3')},
 {...valid,facePaths:['M1,2 L100,800']},
 {...valid,waterPaths:Array(2).fill('M1,2 L2,3')},
 {...valid,waterPaths:['M1,2 L100,800']},
 {...valid,width:1920}
])assert.throws(()=>validateOutline(bad,'known'));
assert.ok(assets.signature.paths.length>=1&&assets.signature.paths.length<=12);
const signature={version:1,origin:'user-reference-vector-retrace',width:1080,height:330,sourceSha256:'known',paths:['M50,100 Q100,40 200,100']};
assert.ok(validateSignature(signature,'known'));
for(const s of [{...signature,sourceSha256:'different'},{...signature,paths:['M0,0 L200,331']},{...signature,paths:['<svg onload="x">']},{...signature,paths:Array(13).fill('M0,0 L1,1')}])assert.throws(()=>validateSignature(s,'known'));
console.log(JSON.stringify({pass:true,body:0,face:0,signature:assets.signature.paths.length,checks:['matching-source-digests','no-reflection-detail','geometry-only','markup-rejected','bounds-and-size-limits']}));
