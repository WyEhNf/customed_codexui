// Build-time artwork only. The original runtime consumes the same asset slots.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require(process.env.SHARP_MODULE||'sharp');
const root=new URL('../',import.meta.url);
const svg=(body,w=1024,h=1024)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const ornaments={
 '01_ornate_gear.png':svg('<g fill="none" stroke="#a8c8ff"><circle cx="512" cy="512" r="390" stroke-width="6"/><circle cx="512" cy="512" r="355" stroke-width="2" opacity=".7"/><circle cx="512" cy="512" r="415" stroke-width="2" stroke-dasharray="3 28" opacity=".5"/></g><path d="M512 73l13 26-13 27-13-27zm0 825l13 26-13 27-13-27zM73 512l26-13 27 13-27 13zm825 0l26-13 27 13-27 13z" fill="#dce8ff"/>'),
 '02_mechanical_iris.png':svg('<g fill="none" stroke="#c1b5e8" stroke-width="5"><circle cx="512" cy="512" r="300" opacity=".6"/><path d="M595 221a300 300 0 1 0 0 582 250 300 0 0 1 0-582z"/><path d="M170 512h70m544 0h70M512 170v70m0 544v70" opacity=".5"/></g>'),
 '04_marionette_strings.png':svg('<g fill="#dce8ff" fill-opacity=".14" stroke="#c1d9ff" stroke-width="5" stroke-linecap="round"><path d="M530 110C290 240 255 570 454 856 695 600 720 270 530 110z"/><path d="M530 155L454 920M510 312l-145 83m137 1 139-74m-160 232-147 64m154 18 134-105m-158 186-95 9" fill="none"/></g>')
};
for(const [name,source]of Object.entries(ornaments)){
 await fs.writeFile(new URL('assets/ornaments/'+name.replace('.png','.svg'),root),source);
 await sharp(Buffer.from(source)).png().toFile(new URL('assets/ornaments/'+name,root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
}
await sharp(new URL('themes/sandrone/background.png',root).pathname.replace(/^\/([A-Za-z]:)/,'$1')).jpeg({quality:94}).toFile(new URL('assets/backgrounds/dark-mechanical.jpg',root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const paths=[
 'M145,90 Q45,50 38,160 Q32,265 145,225',
 'M212,85 Q160,85 160,160 Q160,240 212,235 Q260,232 260,160 Q260,85 212,85',
 'M285,85 L278,235 L360,235',
 'M382,85 L380,190 Q380,245 425,237 Q467,233 466,180 L466,85',
 'M493,235 L500,85 L551,180 L602,85 L606,235',
 'M636,235 L636,85 Q737,68 716,139 Q700,155 636,155 Q750,142 724,218 Q715,240 636,235',
 'M755,85 L800,85 M777,85 L777,235 M754,235 L801,235',
 'M830,235 L830,85 L916,235 L916,85',
 'M940,235 L994,85 L1047,235 L1030,183 L958,183'
];
// Original geometry validator requires one M followed by L/Q segments per path.
// Join the I letter with retraced connectors rather than introducing subpaths.
paths[6]='M755,85 L800,85 L777,85 L777,235 L754,235 L801,235';
const signature=svg('<rect width="1080" height="330" fill="#0d1020"/><g fill="none" stroke="#c5edf2" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">'+paths.map(d=>`<path d="${d}"/>`).join('')+'</g>',1080,330);
await sharp(Buffer.from(signature)).jpeg({quality:95}).toFile(new URL('assets/branding/signature-reference.jpg',root).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const {createHash}=await import('node:crypto');
const sourceSha256=createHash('sha256').update(await fs.readFile(new URL('assets/branding/signature-reference.jpg',root))).digest('hex');
await fs.writeFile(new URL('assets/branding/sandrone-signature.json',root),JSON.stringify({version:1,width:1080,height:330,sourceSha256,origin:'user-reference-vector-retrace',paths},null,2));
console.log('Prepared moon/feather PNG slots and original COLUMBINA vector wordmark; legacy slot names retained.');
