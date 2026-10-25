// Authoring tool: creates art-only variants of the original Sandrone slots.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=process.env.SANDRONE_SOURCE||path.resolve(root,'../../SandroneCodex-0.6.1/Windows-Portable');
const artRoot=process.env.CHARACTER_ART_ROOT||path.resolve(root,'../../theme-art');
const require=createRequire(import.meta.url),sharp=require(process.env.SHARP_MODULE||'sharp');
const ffmpeg=process.env.FFMPEG_EXE;if(!ffmpeg)throw new Error('Set FFMPEG_EXE for artwork preparation.');
const sha=b=>createHash('sha256').update(b).digest('hex');
const utf=async p=>(await fs.readFile(p,'utf8')).replace(/^\uFEFF/,'');
const originalRenderer=await utf(path.join(source,'engine/renderer.mjs')),originalCss=await utf(path.join(source,'engine/native-ui.css')),themeCss=await utf(path.join(source,'themes/sandrone/theme.css'));
await fs.mkdir(path.join(root,'integration/templates'),{recursive:true});
for(const [name,content]of [['renderer.mjs',originalRenderer],['native-ui.css',originalCss],['theme.css',themeCss]])await fs.writeFile(path.join(root,'integration/templates',name),content);
const ids=['columbina','ayaka','hutao','nahida','furina','citlali','mitya','istaroth','sandrone'];
const onlyAt=process.argv.indexOf('--only'),only=onlyAt<0?null:process.argv[onlyAt+1]?.split(',');
if(only&&(!only.length||only.some(id=>!ids.includes(id))))throw new Error('Unknown artwork selection');
const paletteKeys=['background','panel','panelAlt','accent','accentAlt','secondary','highlight','text','muted','line'];
const motifs={ayaka:'sakura',hutao:'butterfly',nahida:'leaf',furina:'drop',citlali:'star',mitya:'orbit',istaroth:'hourglass',columbina:'moon'};
const shapes={
 moon:'M570 180a335 335 0 1 0 0 670 280 335 0 0 1 0-670z',
 orbit:'M512 190L590 435L835 512L590 590L512 835L435 590L190 512L435 435z M160 700C40 440 890 150 910 350C990 580 240 950 160 700z',
 leaf:'M240 760Q140 250 770 190Q850 710 240 760z M250 750L660 320 M380 610L330 400 M500 490L700 490',
 drop:'M512 150C440 320 235 420 245 610C260 890 765 890 779 610C790 420 585 320 512 150z',
 star:'M512 160L600 420L864 512L600 600L512 864L425 600L160 512L425 420z',
 hourglass:'M300 200L724 200Q720 420 512 512Q300 610 300 820L724 820Q724 610 512 512Q300 420 300 200z M330 240L694 240 M330 780L694 780',
 snow:'M512 170L512 854 M170 512L854 512 M270 270L754 754 M270 754L754 270 M440 230L512 300L584 230 M440 794L512 724L584 794 M230 440L300 512L230 584 M794 440L724 512L794 584',
 butterfly:'M512 470C230 150 110 260 230 500Q145 800 480 620L512 470 M512 470C794 150 914 260 794 500Q879 800 544 620L512 470 M512 390L512 710 M512 390L460 300 M512 390L564 300',
 sakura:'M512 200Q660 70 675 340Q955 275 790 510Q980 735 690 690Q675 960 512 770Q350 960 335 690Q45 735 235 510Q70 275 350 340Q365 70 512 200z'
};
const png=async(input,output)=>{await fs.mkdir(path.dirname(output),{recursive:true});await sharp(input).png().toFile(output);};
const run=params=>{const r=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-y',...params],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error(r.stderr||'FFmpeg failed');};
const record=[];
for(const id of ids){
 if(only&&!only.includes(id))continue;
 const pack=path.join(root,'characters',id);await fs.mkdir(pack,{recursive:true});
 for(const dir of ['engine','assets/backgrounds','assets/characters/sandrone','assets/ornaments','assets/branding','assets/motion','themes/sandrone'])await fs.mkdir(path.join(pack,dir),{recursive:true});
 let meta;
 if(id==='sandrone'){
  const t=JSON.parse(await utf(path.join(source,'themes/sandrone/theme.json')));
  meta={name:'桑多涅',brandName:'Sandrone',themeName:'人偶工坊',subtitle:'FATUI / NO. 007',palette:t.colors,loadingStates:['解算开始。','填入变量。','进程良好。','析构万理！啊哈哈哈...'],provenance:'Original local Sandrone 0.6.1 assets; third-party art rights not independently authenticated.'};
  await fs.cp(path.join(source,'assets'),path.join(pack,'assets'),{recursive:true});await fs.copyFile(path.join(source,'themes/sandrone/background.png'),path.join(pack,'themes/sandrone/background.png'));
 }else{
  const dir=path.join(artRoot,id),a=JSON.parse(await utf(path.join(dir,'art.json')));
  meta={...a,name:a.name||a.characterNameZh,brandName:a.brandName||a.characterNameEn,themeName:a.themeName||a.themeNameZh,subtitle:a.subtitle||a.subtitleZh,loadingStates:a.loadingStates||a.splashStatuses};
  for(const key of paletteKeys)if(!/^#[a-f0-9]{6}$/i.test(meta.palette[key]||''))throw new Error(id+' invalid '+key);
  for(const value of [meta.name,meta.brandName,meta.themeName,meta.subtitle,...meta.loadingStates])if(typeof value!=='string'||/[<>"'\\]/.test(value)||value.length>160)throw new Error('Unsafe presentation text');
  await png(path.join(dir,'background.png'),path.join(pack,'themes/sandrone/background.png'));
  await png(path.join(dir,'avatar.png'),path.join(pack,'assets/characters/sandrone/round-icon.png'));
  await png(path.join(dir,'portrait.png'),path.join(pack,'assets/characters/sandrone/portrait.png'));
  for(const [key,name]of [['element','cryo.png'],['skill','skill.png'],['burst','burst.png']]){
   const file=path.join(dir,meta.assets?.[key]||key+'.png');
   try{await fs.access(file);}catch(e){if(e.code==='ENOENT')continue;throw e;}
   await png(file,path.join(pack,'assets/ornaments',name));
  }
  for(const f of ['prompt.txt','avatar-prompt.txt','sources.json'])try{await fs.copyFile(path.join(dir,f),path.join(pack,f));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(meta.selection?.referenceFile){
   const reference=path.join(dir,meta.selection.referenceFile);await fs.mkdir(path.join(pack,'assets/references'),{recursive:true});
   await fs.copyFile(reference,path.join(pack,'assets/references',meta.selection.referenceFile));
   await fs.writeFile(path.join(pack,'assets/references/selection.json'),JSON.stringify(meta.selection,null,2)+'\n');
  }
 }
 const p=meta.palette;
 // Colour/value substitutions only; native dimensions, selectors and flow stay intact.
 const groups={background:['#0c1016','#0b111b','#0b111a'],panel:['#17191f','#151e2a','#151d29','#192330'],panelAlt:['#202027','#202d3e','#263345','#273443','#2c394a','#384252','#34465e','#202833'],text:['#f3eee3','#f4eddd','#eee9dc','#eee8da','#ebe3d1'],muted:['#b8afa2','#c2c8cf','#aeb9c5','#9da7b4','#8c98a7'],accent:['#c7a86e','#d3b77e','#ddbb79','#cfb476','#c8a16a','#b9a172','#e9aa63'],accentAlt:['#e3d4b1','#efd29a','#ecd399','#ffd19a','#e8d4ae'],secondary:['#a8ddea','#a9cbd5','#b1ddeb','#85d9e6','#c5edf2'],highlight:['#993e50'],line:['#766246','#9e8256','#344153','#526176','#71839a','#687b91','#8e7953']};
 const changes={};for(const [key,list]of Object.entries(groups))for(const c of list)changes[c]=p[key];
 changes['#101721']=p.background;changes['#121923']=p.background;changes['#131b26']=p.background;changes['#19232f']=p.panel;changes['#c8c4b7']='#c6d0e4';changes['#897350']='#7a8090';changes['#946641']=p.accent;
 let renderer=originalRenderer,css=originalCss,safeCss=themeCss;
 const paint=s=>{for(const [a,b]of Object.entries(changes))s=s.replaceAll(a,b);const rgb=p.accent.match(/\w\w/g).map(x=>parseInt(x,16)).join(',');return s.replaceAll('rgba(199,168,110','rgba('+rgb).replaceAll('rgba(218,185,119','rgba('+rgb).replaceAll('rgba(221,187,121','rgba('+rgb);};
 renderer=paint(renderer);css=paint(css);safeCss=paint(safeCss);
 const replacements={'桑多涅':meta.name,'THE MARIONETTE WORKSHOP':meta.themeName.toUpperCase()+' · '+meta.brandName.toUpperCase(),'FATUI / NO. 007':meta.subtitle,'SANDRONE</h1>':meta.brandName.toUpperCase()+'</h1>','>MARIONETTE<':'>'+meta.themeName+'<','OFFICIAL CODEX · SANDRONE EDITION':'CODEX · '+meta.brandName.toUpperCase()+' EDITION',"'Sandrone'":"'"+meta.brandName+"'",'解算开始。':meta.loadingStates[0],'填入变量。':meta.loadingStates[1],'进程良好。':meta.loadingStates[2],'析构万理！啊哈哈哈...':meta.loadingStates[3]};
 for(const [a,b]of Object.entries(replacements))renderer=renderer.replaceAll(a,b);
 await fs.writeFile(path.join(pack,'engine/renderer.mjs'),renderer);await fs.writeFile(path.join(pack,'engine/native-ui.css'),css);await fs.writeFile(path.join(pack,'themes/sandrone/theme.css'),safeCss);
 // Preserve the original geometry-only signature loader, using true cursive outlines.
 const sig=path.join(artRoot,'signatures',id);
 await fs.copyFile(path.join(sig,'signature.json'),path.join(pack,'assets/branding/sandrone-signature.json'));
 await fs.copyFile(path.join(sig,'reference.jpg'),path.join(pack,'assets/branding/signature-reference.jpg'));
 await fs.copyFile(path.join(sig,'preview.svg'),path.join(pack,'signature-preview.svg'));
 const bg=path.join(pack,'themes/sandrone/background.png');
 if(id!=='sandrone'){
  await sharp(bg).jpeg({quality:93}).toFile(path.join(pack,'assets/backgrounds/dark-mechanical.jpg'));
  const motif=shapes[motifs[id]]||shapes.star;
  const svg=(body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><g fill="none" stroke="${p.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  const vectors={
   '01_ornate_gear.png':svg('<circle cx="512" cy="512" r="450" stroke-width="3" opacity=".6"/><circle cx="512" cy="512" r="410" stroke-width="2" stroke-dasharray="4 28" opacity=".5"/><path transform="translate(154 154) scale(.7)" d="'+motif+'"/>'),
   '02_mechanical_iris.png':svg('<path d="'+motif+'" opacity=".65"/>'),
   '04_marionette_strings.png':svg('<path transform="translate(154 154) scale(.7)" d="'+motif+'"/><path d="M512 0L512 170" stroke-width="2" opacity=".5"/>')
  };
  for(const [name,sourceSvg]of Object.entries(vectors)){await fs.writeFile(path.join(pack,'assets/ornaments',name.replace('.png','.svg')),sourceSvg);await png(Buffer.from(sourceSvg),path.join(pack,'assets/ornaments',name));}
  for(const name of ['cryo.png','skill.png','burst.png'])try{await fs.access(path.join(pack,'assets/ornaments',name));}catch{await png(Buffer.from(svg('<path d="'+motif+'"/>')),path.join(pack,'assets/ornaments',name));}
  const video=path.join(pack,'assets/motion/sandrone-loop-1080p.mp4'),poster=path.join(pack,'assets/motion/sandrone-first-frame.jpg');
  run(['-loop','1','-framerate','30','-i',bg,'-t','9','-vf','scale=1920:1080','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-an',video]);run(['-i',video,'-frames:v','1','-q:v','2',poster]);
  await fs.writeFile(path.join(pack,'assets/motion/derived.json'),JSON.stringify({file:path.basename(video),source:'generated-background.png',sourceSha256:sha(await fs.readFile(bg)),sha256:sha(await fs.readFile(video)),bytes:(await fs.stat(video)).size,seconds:9,width:1920,height:1080,posterFile:path.basename(poster),posterSha256:sha(await fs.readFile(poster)),note:'Static replacement carrier, original playback mechanism unchanged; no character-motion footage claimed.'},null,2));
 }
 const avatar=await sharp(path.join(pack,'assets/characters/sandrone/round-icon.png')).resize(256,256,{fit:'contain',background:'#00000000'}).png().toBuffer();
 const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(avatar.length,14);ico.writeUInt32LE(22,18);
 await fs.writeFile(path.join(pack,'assets/workshop.ico'),Buffer.concat([ico,avatar]));
 const theme={schemaVersion:1,id:id+'-codex-ui',name:meta.name+'·'+meta.themeName,brandSubtitle:meta.brandName,tagline:'让灵感在这里继续。',projectPrefix:'项目 · ',projectLabel:'选择项目',statusText:meta.brandName.toUpperCase()+' ONLINE',quote:'A PERSONAL PLACE FOR THOUGHTS',image:'background.png',appearance:'dark',art:{focusX:.76,focusY:.46,safeArea:'left',taskMode:'ambient'},colors:p};
 await fs.writeFile(path.join(pack,'themes/sandrone/theme.json'),JSON.stringify(theme,null,2)+'\n');
 const license='Unofficial personal character theme. Code MIT excludes character and derivative artwork. Character rights remain with their owners. Cursive wordmark is font-derived, not an official signature. See presentation.json and PROVENANCE.json.\n';
 await fs.writeFile(path.join(pack,'themes/sandrone/LICENSE.txt'),license);await fs.writeFile(path.join(pack,'assets/LICENSE.txt'),license);
 await fs.writeFile(path.join(pack,'presentation.json'),JSON.stringify({...meta,id,motif:motifs[id]||'original',signature:{kind:'Segoe Script font outline',official:false},baseSkeleton:'Sandrone Codex 0.6.1',codeChanges:'displayed prose and literal colors only'},null,2));
 const provenance=[];for(const directory of ['assets','themes','engine']){
  const walk=async d=>{for(const e of await fs.readdir(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())await walk(f);else if(e.isFile()&&!['PROVENANCE.json','manifest.json'].includes(e.name)){const b=await fs.readFile(f);provenance.push({file:path.relative(pack,f).split(path.sep).join('/'),bytes:b.length,sha256:sha(b)});}}};await walk(path.join(pack,directory));
 }
 await fs.writeFile(path.join(pack,'assets/PROVENANCE.json'),JSON.stringify({id,source:'See presentation.json and research sources.json',rights:'All character and derivative artwork excluded from code MIT; no additional redistribution rights established',signature:'True cursive font outline, not an official signature',files:provenance},null,2));
 // Original package validator format.
 const names=['theme.json','theme.css','background.png','LICENSE.txt'],types=['application/json','text/css','image/png','text/plain'],files=[];
 for(let i=0;i<names.length;i++){const b=await fs.readFile(path.join(pack,'themes/sandrone',names[i]));files.push({path:names[i],bytes:b.length,sha256:sha(b),mediaType:types[i]});}
 await fs.writeFile(path.join(pack,'themes/sandrone/manifest.json'),JSON.stringify({packageVersion:1,themeId:theme.id,version:'1.0.0',skinApiVersion:1,minClientVersion:'1.5.21',platforms:['windows'],capabilities:['background','tokens','safe-css'],publisher:{id:'codexui-local',displayName:'Codex UI Characters'},license:'LicenseRef-Character-Artwork',provenance:{aiGenerated:id!=='sandrone',summary:'Original Sandrone skeleton with character reference artwork, generated derivative backgrounds and font-outline wordmarks. Art excluded from code license.'},createdAt:'2026-10-25T00:00:00+08:00',files},null,2));
 record.push({id,name:meta.name,themeName:meta.themeName,path:'characters/'+id});console.log('Prepared '+id);
}
if(only){
 const previous=JSON.parse(await fs.readFile(path.join(root,'integration/characters-build.json'),'utf8')).characters;
 const changed=new Map(record.map(c=>[c.id,c]));
 await fs.writeFile(path.join(root,'integration/characters-build.json'),JSON.stringify({characters:ids.map(id=>changed.get(id)||previous.find(c=>c.id===id))},null,2));
}else await fs.writeFile(path.join(root,'integration/characters-build.json'),JSON.stringify({characters:record},null,2));
