// Code-native background geometry. Runtime positions this independent paint
// layer inside the native main area, below the uniformly scaled character.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ids=['columbina','sandrone','hutao','ayaka','nahida','furina','citlali','mitya','istaroth'];
const motifs={
 columbina:'<path d="M43 6A26 26 0 1 0 43 58A25 27 0 0 1 43 6Z"/><path d="M41 13A20 22 0 0 0 41 51"/><path d="m49 25 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>',
 sandrone:'<path d="M6 8Q32 3 58 8M32 8V17M15 8V28M49 8V28"/><circle cx="32" cy="23" r="5"/><path d="M28 30h8l4 13-8 6-8-6ZM28 32l-13-4-5 12M36 32l13-4 5 12M28 47l-8 12M36 47l8 12"/><circle cx="15" cy="28" r="1.5"/><circle cx="49" cy="28" r="1.5"/>',
 hutao:'<path d="M31 30C14 8 2 12 8 30Q2 53 29 42M33 30C50 8 62 12 56 30Q62 53 35 42M32 23V49M32 25l-6-9M32 25l6-9M29 32L13 22M28 37l-12 7M35 32l16-10M36 37l12 7"/><path d="M8 30q10-4 21 4M56 30q-10-4-21 4"/>',
 ayaka:'<path d="M32 12Q41 4 42 21Q60 17 49 32Q61 46 43 43Q42 60 32 48Q22 60 21 43Q3 46 15 32Q4 17 22 21Q23 4 32 12Z"/><path d="M32 20V43M20 28l23 8M23 40l17-18M20 36l23-8M24 22l16 18"/><circle cx="32" cy="32" r="4"/>',
 nahida:'<path d="M13 51Q6 15 53 9Q58 46 13 51ZM14 50l30-30M24 40l-4-15M32 32l17 1M39 25l-1-9"/><path d="M9 57q25-3 44-26"/>',
 furina:'<path d="M32 7C26 20 12 29 14 42C17 61 48 61 50 42C52 29 38 20 32 7Z"/><path d="M23 47V33q4-7 9 0q5-7 9 0v14M20 48q12 8 24 0M27 20l5-4 5 4"/>',
 citlali:'<path d="m32 7 6 19 19 6-19 6-6 19-6-19L7 32l19-6ZM32 19l3 10 10 3-10 3-3 10-3-10-10-3 10-3Z"/><path d="M17 11q-8 3-6 10M47 53q8-3 6-10M8 17l7-3M49 50l7-3"/>',
 mitya:'<ellipse cx="32" cy="32" rx="29" ry="14" transform="rotate(-28 32 32)"/><path d="m32 12 5 15 15 5-15 5-5 15-5-15-15-5 15-5Z"/><circle cx="52" cy="15" r="2"/>',
 istaroth:'<path d="M17 9h30M17 55h30M20 12h24q0 13-12 20Q20 40 20 52h24q0-12-12-20Q20 25 20 12ZM24 17h16M25 47h14M27 21l5 6 5-6M24 46l8-8 8 8"/><path d="M14 12v40M50 12v40"/>'
};
const roleNames={columbina:'crescent-and-lunar-arc',sandrone:'original-preserved',hutao:'butterfly-and-petal-vein',ayaka:'five-petal-frost',nahida:'leaf-and-growth-vein',furina:'drop-and-double-arch',citlali:'hollow-four-point-and-braid',mitya:'restrained-orbit-and-four-point',istaroth:'hourglass-and-dial'};
const circle=(r,attrs='')=>`<circle cx="1458" cy="540" r="${r}" ${attrs}/>`;
function dial(ticks=48,r=413){return Array.from({length:ticks},(_,i)=>{const a=i/ticks*Math.PI*2,x=1458+Math.cos(a)*r,y=540+Math.sin(a)*r,l=i%4===0?13:5;return `<path d="M${x.toFixed(2)} ${y.toFixed(2)}l${(-Math.cos(a)*l).toFixed(2)} ${(-Math.sin(a)*l).toFixed(2)}"/>`;}).join('');}
function largePattern(id,motif){
 if(id==='mitya')return '<g opacity=".075"><ellipse cx="1458" cy="540" rx="406" ry="188" transform="rotate(-27 1458 540)"/><ellipse cx="1458" cy="540" rx="349" ry="142" transform="rotate(28 1458 540)"/><path d="m1458 342 42 156 156 42-156 42-42 156-42-156-156-42 156-42Z"/></g>';
 if(id==='hutao')return `<g opacity=".072">${circle(407)}<g transform="translate(1090 172) scale(11.5)">${motif}</g></g>`;
 if(id==='nahida')return `<g opacity=".07">${circle(412)}<g transform="translate(1090 172) scale(11.5)">${motif}</g><path d="M1130 846Q1360 750 1585 248M1100 756Q1240 746 1309 649M1365 557Q1550 583 1672 485"/></g>`;
 if(id==='citlali')return `<g opacity=".07">${circle(409)}${circle(383,'stroke-dasharray="4 13"')}<g transform="translate(1140 222) scale(9.95)">${motif}</g></g>`;
 if(id==='ayaka')return `<g opacity=".072">${circle(413)}${circle(378)}<g transform="translate(1110 192) scale(10.9)">${motif}</g>${dial(40)}</g>`;
 if(id==='furina')return `<g opacity=".07">${circle(413)}${circle(382)}<g transform="translate(1125 207) scale(10.4)">${motif}</g><path d="M1018 815Q1240 737 1458 815T1870 815M1047 843Q1250 773 1458 843T1840 843"/></g>`;
 if(id==='istaroth')return `<g opacity=".07">${circle(413)}${circle(376)}<g transform="translate(1165 247) scale(9.15)">${motif}</g>${dial(48)}</g>`;
 return `<g opacity=".07">${circle(413)}${circle(380)}<g transform="translate(1120 202) scale(10.56)">${motif}</g>${dial(36)}</g>`;
}
export function buildWorkspaceFrame(c){
 if(!c||!ids.includes(c.id))throw new Error('Unknown workspace frame character');
 const color=c.palette?.accent,secondary=c.palette?.secondary||color;
 if(!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(secondary))throw new Error('Invalid workspace frame palette');
 const motif=motifs[c.id];
 const metadata={schemaVersion:1,id:c.id,width:1920,height:1080,kind:'complete-low-contrast-character-background-frame',placement:'native-main-only',bounds:{left:46,top:90,right:1876,bottom:990},completeFourEdges:true,motif:roleNames[c.id],maximumDeclaredOpacity:.18,hasOpaqueSurface:false,sourcePersonRedrawn:false,preserveOriginal:c.id==='sandrone'};
 if(c.id==='sandrone')return {svg:'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="none"/>',body:'',metadata};
 const corners=[[66,110,0],[1854,110,90],[1854,970,180],[66,970,270]].map(([x,y,a])=>`<g transform="translate(${x} ${y}) rotate(${a})" opacity=".18"><path d="M0 93V23Q0 0 23 0H93M14 74V27Q14 14 27 14H74"/><g transform="translate(8 8) scale(.68)">${motif}</g><path d="M59 0h36M0 59v36" stroke-width="1.6"/></g>`).join('');
 // Sparse, broad wallpaper texture; no dense grid or high-contrast field.
 const texture=Array.from({length:7},(_,row)=>Array.from({length:12},(_,col)=>{const x=115+col*151+(row%2?37:0),y=177+row*118;return `<path d="m${x} ${y-3} 3 3-3 3-3-3Z"/>`;}).join('')).join('');
 const leftEcho=`<g transform="translate(242 746) scale(1.22)" opacity=".075">${motif}</g><path d="M128 835H214M346 835H444M174 849H222M338 849H392" opacity=".045"/>`;
 const body=`<g id="workspace-frame-${c.id}" fill="none" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">
 <rect x="46" y="90" width="1830" height="900" rx="2" opacity=".135"/>
 <rect x="63" y="107" width="1796" height="866" rx="1" opacity=".05"/>
 <g stroke="${secondary}" opacity=".025" stroke-width=".8">${texture}</g>
 ${largePattern(c.id,motif)}${leftEcho}${corners}
 <g opacity=".09"><path d="M900 90h120M900 990h120M46 492v96M1876 492v96"/><path d="m954 90 6-6 6 6-6 6ZM954 990l6-6 6 6-6 6Z"/></g>
 </g>`;
 return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="none">${body}</svg>`,body,metadata};
}
export async function writeWorkspaceFrames(characters,output=path.join(root,'integration/workspace-frames/output')){
 const records=[];for(const c of characters){const frame=buildWorkspaceFrame(c),dir=path.join(output,c.id);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'frame.svg'),frame.svg);const svgSha256=createHash('sha256').update(frame.svg).digest('hex');const metadata={...frame.metadata,svgSha256};await fs.writeFile(path.join(dir,'frame.json'),JSON.stringify(metadata,null,2)+'\n');records.push(metadata);}return records;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const spec=JSON.parse(await fs.readFile(process.env.CHARACTER_DESIGN_SPEC||'G:/sandrone/design-review/2026-10-25/full-scene-v7/design-spec.json','utf8'));
 const characters=await writeWorkspaceFrames(spec.characters);console.log(JSON.stringify({pass:true,characters:characters.length,geometryOnly:true,hasOpaqueSurface:false}));
}
