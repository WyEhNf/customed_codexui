// Technical exports of the user-approved material artwork. No character art is redrawn here.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_MODULE||'sharp');
const ids=['columbina','sandrone','hutao','ayaka','nahida','furina','citlali','mitya','istaroth'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const uri=(mime,b)=>`data:${mime};base64,${Buffer.from(b).toString('base64')}`;
const materials={columbina:['霜银与珠母','#edf4ff','#95a7d4','#5e638c'],sandrone:['象牙瓷与黄铜','#fff0cb','#c7a05e','#6e472e'],hutao:['琥珀漆与鎏金','#ffe9a0','#eaa14b','#8f252e'],ayaka:['霜银冰晶','#f0faff','#aac9e6','#687aa8'],nahida:['透光玉叶','#edffd5','#a8d59b','#477b65'],furina:['蓝珐琅与晶金','#e4f8ff','#81bbe6','#3a5a9c'],citlali:['紫晶与编绳','#f8e5ff','#bd95e6','#6c438e'],mitya:['冷银与星轨','#f4f2ff','#b6addb','#666c9a'],istaroth:['旧金与烟晶','#fff0c7','#cdb478','#726044']};
// At 16–24px the full silhouettes stay legible; highlights and internal seams add material.
const motifs={
 columbina:'<path d="M7.3.6A4.7 4.7 0 1 0 9.3 7.6C5.5 8.5 3.5 3.3 7.3.6Z" fill="url(#enamel)"/><path d="M5.8 1.7C1.4 3.2 2.4 8.2 6.2 8.5" fill="none" stroke="url(#metal)" stroke-width=".45"/>',
 sandrone:'<path d="M.8 1H9.2M2 1V5M8 1V5M5 1V2.3" fill="none" stroke="url(#metal)" stroke-width=".6"/><circle cx="5" cy="3.4" r="1.05" fill="url(#enamel)"/><path d="M4.1 4.7Q5 4.3 5.9 4.7L5.6 6.8H4.4Z" fill="url(#enamel)"/><path d="M4.1 4.9 2.6 5.4 1.5 6.4M5.9 4.9 7.4 5.4 8.5 6.4M4.5 6.8 3.9 8 3.8 9.4M5.5 6.8 6.1 8 6.2 9.4" fill="none" stroke="url(#enamel)" stroke-width=".85"/><g fill="url(#metal)"><circle cx="4.1" cy="4.9" r=".28"/><circle cx="5.9" cy="4.9" r=".28"/><circle cx="2.6" cy="5.4" r=".25"/><circle cx="7.4" cy="5.4" r=".25"/><circle cx="3.9" cy="8" r=".25"/><circle cx="6.1" cy="8" r=".25"/></g>',
 hutao:'<path d="M4.6 4.5C3.4 1.3.4.1.5 2.8.6 4.2 2 5 4.4 5.2 1.7 4.4.4 6 1.4 7.8 2.5 9.7 4.1 8 4.7 5.8M5.4 4.5C6.6 1.3 9.6.1 9.5 2.8 9.4 4.2 8 5 5.6 5.2 8.3 4.4 9.6 6 8.6 7.8 7.5 9.7 5.9 8 5.3 5.8" fill="url(#enamel)" stroke="url(#metal)" stroke-width=".35"/><path d="M5 3.8V8M4.8 4 3.8 2.5M5.2 4 6.2 2.5M4.6 5 1.4 2.4M5.4 5 8.6 2.4M4.5 5.4 2.1 7.5M5.5 5.4 7.9 7.5" fill="none" stroke="url(#metal)" stroke-width=".4"/>',
 ayaka:'<path d="M5 1.4C3.1-1 1.7.7 3.1 3.4.2 2.3-.6 4.5 2.3 5.7-.5 7 1.2 9.1 3.7 7.6 3.4 10.4 6.3 10.4 6.4 7.5 8.9 9.1 10.5 6.9 7.7 5.7 10.6 4.4 9.7 2.3 6.9 3.4 8.2.7 6.8-1 5 1.4Z" fill="url(#enamel)" stroke="url(#metal)" stroke-width=".35"/><path d="M5 5.5V2M5 5.5 8 4.5M5 5.5 7 8M5 5.5 3 8M5 5.5 2 4.5" fill="none" stroke="url(#metal)" stroke-width=".35"/><circle cx="5" cy="5.5" r=".6" fill="url(#metal)"/>',
 nahida:'<path d="M1.1 8.6C.1 2 3.5.3 9.3.6 10 6.4 7.2 9.3 1.1 8.6Z" fill="url(#enamel)" stroke="url(#metal)" stroke-width=".4"/><path d="M.7 9.2 7.9 2M2.6 7.3 2.7 4.3M4.6 5.3 4.7 2.7M2.6 7.3 5.7 7.2M4.6 5.3 7.2 5.2" fill="none" stroke="url(#metal)" stroke-width=".4"/>',
 furina:'<path d="M5 .4C3.3 3 1.1 4.5 1.1 6.4a3.9 3.9 0 0 0 7.8 0C8.9 4.5 6.7 3 5 .4Z" fill="url(#enamel)" stroke="url(#metal)" stroke-width=".4"/><path d="M2.8 7.9V6.1C2.8 4.8 5 4.8 5 6.1 5 4.8 7.2 4.8 7.2 6.1V7.9M5 6.1V8.6" fill="none" stroke="url(#metal)" stroke-width=".5"/><path d="M3 4.9 4.1 3.4" stroke="#fff" opacity=".8" stroke-width=".5"/>',
 citlali:'<path d="M5 .3 6.4 3.6 9.7 5 6.4 6.4 5 9.7 3.6 6.4.3 5 3.6 3.6Z" fill="url(#enamel)" stroke="url(#metal)" stroke-width=".45"/><path d="M5 .9V9.1M.9 5H9.1M5 2.5 7.5 5 5 7.5 2.5 5Z" fill="none" stroke="url(#metal)" stroke-width=".35"/><path d="M7.1 6.7 8 8 7.2 9.6M8.2 6.1 9 7.6 8.5 9" fill="none" stroke="url(#metal)" stroke-width=".45"/>',
 mitya:'<ellipse cx="5" cy="5" rx="4.8" ry="2.25" transform="rotate(-34 5 5)" fill="none" stroke="url(#metal)" stroke-width=".75"/><path d="M5 .8 6.2 3.8 9.2 5 6.2 6.2 5 9.2 3.8 6.2.8 5 3.8 3.8Z" fill="url(#enamel)" stroke="url(#metal)" stroke-width=".35"/><circle cx="8.8" cy="2.5" r=".55" fill="url(#metal)"/>',
 istaroth:'<path d="M1.5.6H8.5V1.4H1.5ZM1.5 8.6H8.5V9.4H1.5Z" fill="url(#metal)"/><path d="M2.2 1.4C2.2 3.9 4.1 4.1 5 5 5.9 5.9 7.8 6.1 7.8 8.6M7.8 1.4C7.8 3.9 5.9 4.1 5 5 4.1 5.9 2.2 6.1 2.2 8.6" fill="url(#enamel)" fill-opacity=".4" stroke="url(#metal)" stroke-width=".5"/><path d="M3.2 2.2H6.8L5 4.5ZM3 8 5 6.2 7 8Z" fill="url(#metal)"/><path d="M5 5V6.2" stroke="url(#metal)" stroke-width=".35"/>'
};
function defs(id){const [,light,mid,dark]=materials[id];return `<defs><linearGradient id="metal" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="${light}"/><stop offset=".25" stop-color="${mid}"/><stop offset=".48" stop-color="${light}"/><stop offset=".7" stop-color="${dark}"/><stop offset="1" stop-color="${mid}"/></linearGradient><linearGradient id="enamel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".3" stop-color="${mid}"/><stop offset=".75" stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs>`;}
function replaceMark(svg,mark){const start=svg.indexOf('<g color=');if(start<0)throw new Error('No symbol group');const inner=svg.indexOf('<g transform=',start),openEnd=svg.indexOf('>',inner);let depth=1,end=-1;const tokens=/<\/?g\b[^>]*>/g;tokens.lastIndex=openEnd+1;let m;while((m=tokens.exec(svg))){if(m[0].startsWith('</'))depth--;else depth++;if(depth===0){end=m.index;break;}}if(end<0)throw new Error('Unbalanced symbol group');return svg.slice(0,openEnd+1)+mark+svg.slice(end);}
function materialIcon(svg,id,p,selected){let s=replaceMark(svg,motifs[id]);s=s.replace(/(<svg\b[^>]*>)/,'$1'+defs(id));s=s.replaceAll(`stroke="${p.muted}"`,`stroke="${selected?p.accent:'url(#metal)'}"`);if(selected)s=s.replace('<svg ','<svg opacity="1" ');return s;}
function frame(id,ornament){const [,light,mid,dark]=materials[id];return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".3" stop-color="${mid}"/><stop offset=".55" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><circle cx="50" cy="50" r="42.5" fill="none" stroke="${dark}" stroke-width="2.5"/><circle cx="50" cy="50" r="43" fill="none" stroke="url(#rim)" stroke-width="1.8"/><path d="M14 73A43 43 0 0 0 73 86M27 14A43 43 0 0 1 86 27" fill="none" stroke="url(#rim)" stroke-width=".6"/><image href="${ornament}" x="73" y="68" width="26" height="29"/></svg>`;}
export async function buildMaterialUiAssets(root,options={}){
 root=path.resolve(root);const review=options.reviewRoot||'G:/sandrone/design-review/2026-10-25';
 const dest=options.outputDir||path.join(root,'integration/materials/output');
 const specPath=options.specPath||path.join(review,'full-scene-v7/design-spec.json');
 const specs=JSON.parse(await fs.readFile(specPath,'utf8')).characters;
 const contract=JSON.parse(await fs.readFile(path.join(root,'integration/material-contract.json'),'utf8'));
 const atlas=path.join(review,'design-complete-v5/references/approved-materials.png');
 const sources=path.join(root,'integration/materials/sources');await fs.mkdir(sources,{recursive:true});
 const ornaments={},frames={},provenance={};
 for(const [i,id]of ids.entries()){
  const source=i<3?atlas:path.join(review,`design-complete-v5/materials/${id}.png`);const data=await fs.readFile(source);const sourceName=i<3?'approved-materials.png':`${id}.png`;await fs.writeFile(path.join(sources,sourceName),data);
  let bitmap=sharp(data);if(i<3)bitmap=bitmap.extract({left:i*724,top:0,width:724,height:724});
  const cropped=await bitmap.png().toBuffer();const trimmed=await sharp(cropped).trim({threshold:3}).png().toBuffer();
  const large=await sharp(trimmed).resize(160,160,{fit:'contain',background:'#00000000'}).png().toBuffer();
  const small=await sharp(trimmed).resize(64,64,{fit:'contain',background:'#00000000'}).png().toBuffer();
  const out=path.join(dest,id);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'ornament.png'),large);await fs.writeFile(path.join(out,'ornament-small.png'),small);
  ornaments[id]=uri('image/png',large);frames[id]=uri('image/svg+xml',frame(id,uri('image/png',small)));await fs.writeFile(path.join(out,'avatar-frame.svg'),frame(id,uri('image/png',small)));
  provenance[id]={source:path.relative(review,source).replaceAll('\\','/'),sha256:sha(data),atlasCell:i<3?i:null,operations:['atlas crop when applicable','transparent-edge trim','Lanczos downsample; preserved original pixels and alpha'],approval:'full-scene-v7 retains design-complete-v5 approved material motifs'};
 }
 for(const id of ids){
  const c=specs.find(c=>c.id===id);if(!c)throw new Error('Missing approved character '+id);
  const out=path.join(dest,id),p=c.palette;
  const config={schemaVersion:1,id,name:c.name,material:materials[id][0],palette:{light:materials[id][1],metal:materials[id][2],shadow:materials[id][3],accent:p.accent,line:p.line},ornament:ornaments[id],avatarFrame:frames[id],galleryFrames:frames,contract,provenance:provenance[id]};
  config.revision=sha(JSON.stringify(config));await fs.writeFile(path.join(out,'personality.json'),JSON.stringify(config,null,2)+'\n');
  const original=JSON.parse(await fs.readFile(path.join(root,`characters/${id}/assets/icons/ui/icon-set.json`),'utf8'));const icons={};
  for(const role of original.roles){const svg=await fs.readFile(path.join(root,`characters/${id}/assets/icons/ui/${role}.normal.svg`),'utf8');const normal=materialIcon(svg,id,p,false),selected=materialIcon(svg,id,p,true);icons[role]={normal:uri('image/svg+xml',normal),selected:uri('image/svg+xml',selected),compact:uri('image/svg+xml',normal),compactSelected:uri('image/svg+xml',selected)};}
  const iconSet={schemaVersion:1,id,roles:original.roles,icons,materialRevision:config.revision};iconSet.revision=sha(JSON.stringify(iconSet));await fs.writeFile(path.join(out,'material-icon-set.json'),JSON.stringify(iconSet,null,2)+'\n');
  await fs.writeFile(path.join(out,'PROVENANCE.json'),JSON.stringify(provenance[id],null,2)+'\n');
 }
 return {ids,outputDir:dest,filesPerCharacter:['personality.json','material-icon-set.json','ornament.png','ornament-small.png','avatar-frame.svg','PROVENANCE.json']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');console.log(JSON.stringify(await buildMaterialUiAssets(root)));}
