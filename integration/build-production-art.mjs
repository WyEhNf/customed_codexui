// Export the approved v7 CSS composition; never repaint or regenerate people.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {buildWorkspaceFrame} from './build-workspace-frame.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const design=process.env.CHARACTER_DESIGN_ROOT||'G:/sandrone/design-review/2026-10-25/full-scene-v7';
const sharp=createRequire(import.meta.url)(process.env.SHARP_MODULE||'sharp');
const spec=JSON.parse(await fs.readFile(path.join(design,'design-spec.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const template=await fs.readFile(path.join(root,'integration/templates/renderer.mjs'),'utf8');
const cssTemplate=await fs.readFile(path.join(root,'integration/templates/native-ui.css'),'utf8');
const groups={background:['#0c1016','#0b111b','#0b111a'],panel:['#17191f','#151e2a','#151d29','#192330'],panelAlt:['#202027','#202d3e','#263345','#273443','#2c394a','#384252','#34465e','#202833'],text:['#f3eee3','#f4eddd','#eee9dc','#eee8da','#ebe3d1'],muted:['#b8afa2','#c2c8cf','#aeb9c5','#9da7b4','#8c98a7'],accent:['#c7a86e','#d3b77e','#ddbb79','#cfb476','#c8a16a','#b9a172','#e9aa63'],accentAlt:['#e3d4b1','#efd29a','#ecd399','#ffd19a','#e8d4ae'],secondary:['#a8ddea','#a9cbd5','#b1ddeb','#85d9e6','#c5edf2'],highlight:['#993e50'],line:['#766246','#9e8256','#344153','#526176','#71839a','#687b91','#8e7953']};
const rgb=c=>c.match(/\w\w/g).map(x=>parseInt(x,16)).join(',');
function paint(text,p){const changes={};for(const [key,colors]of Object.entries(groups))for(const color of colors)changes[color]=p[key];Object.assign(changes,{'#101721':p.background,'#121923':p.background,'#131b26':p.background,'#19232f':p.panel,'#c8c4b7':'#c6d0e4','#897350':'#7a8090','#946641':p.accent});return text.replace(/#[0-9a-f]{6}\b/gi,m=>changes[m.toLowerCase()]||m).replaceAll('rgba(199,168,110','rgba('+rgb(p.accent)).replaceAll('rgba(218,185,119','rgba('+rgb(p.accent)).replaceAll('rgba(221,187,121','rgba('+rgb(p.accent));}
function surfaces(p){return `
/* Approved surface alpha, paint only: no layout or whole-control opacity. */
@layer dreamskin-accessibility {
html[data-dream-skin="active"],html[data-dream-skin="active"] [data-theme] {
 --character-panel-rgb:${rgb(p.panel)};--character-bg-rgb:${rgb(p.background)};
 --color-background-composer:rgba(${rgb(p.panel)},.72);--color-background-composer-action-bar:transparent;
 --color-background-panel:rgba(${rgb(p.background)},.64);--color-token-message-surface:rgba(${rgb(p.background)},.64);
 --color-token-dropdown-background:rgba(${rgb(p.panel)},.94);
 --color-background-user-message:rgba(${rgb(p.panelAlt)},.64);--color-background-other-user-message:rgba(${rgb(p.panelAlt)},.64);
}
html[data-dream-skin="active"] [data-ds-part="composer"] {background:rgba(var(--character-panel-rgb),.72)!important;}
html[data-dream-skin="active"] [data-ds-part="composer"]:focus-within {background:rgba(var(--character-panel-rgb),.80)!important;}
html[data-dream-skin="active"] [data-ds-part="composer"] :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="hidden"]):not([type="file"]),textarea,[contenteditable="true"],[class~="bg-token-composer"],[class~="bg-composer"],[class~="bg-composer-action-bar"]) {background:transparent!important;}
html[data-dream-skin="active"] [data-ds-part="message"] {background:rgba(var(--character-bg-rgb),.64)!important;}
html[data-dream-skin="active"] [data-ds-part="message"] :is(pre,code,[data-markdown-copy="code-block"]) {background:rgba(var(--character-bg-rgb),.88)!important;}
html[data-dream-skin="active"] :is([data-ds-part="dialog"],[role="dialog"],[role="menu"]) {background:rgba(var(--character-panel-rgb),.94)!important;}
html[data-dream-skin="active"] [data-ds-part="sidebar"] {background:rgba(var(--character-bg-rgb),.88)!important;}
}
`;}
const production=[];
for(const c of spec.characters){
 const pack=path.join(root,'characters',c.id),ui=path.join(pack,'assets/ui');await fs.mkdir(ui,{recursive:true});
 const bytes=await fs.readFile(path.join(design,c.daily));const ext=path.extname(c.daily).toLowerCase();
 const sourceFile='workspace-source'+ext;await fs.writeFile(path.join(ui,sourceFile),bytes);
 const frame=buildWorkspaceFrame(c);await fs.writeFile(path.join(ui,'workspace-frame.svg'),frame.svg);await fs.writeFile(path.join(ui,'workspace-frame.json'),JSON.stringify(frame.metadata,null,2)+'\n');
 let svg;
 if(c.id==='sandrone')svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><image href="SOURCE" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/></svg>`;
 else{
  let w=1920*c.scale,h=1080*c.scale,x=1920-w,y=(1080-h)/2,mask='url(#feather)';
  if(c.id==='mitya'){x=1920-w+1920*.14;mask='url(#mitya)';}
  if(c.id==='citlali'){w=h; x=1920-w+1920*.09;mask='url(#citlali)';}
  svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs>
  <linearGradient id="horizontal"><stop stop-color="white" stop-opacity="0"/><stop offset=".18" stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient>
  <linearGradient id="vertical" x1="0" y1="1" x2="0" y2="0"><stop stop-color="white" stop-opacity="0"/><stop offset=".14" stop-color="white"/><stop offset=".92" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient>
  <mask id="vfade"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#vertical)"/></mask><mask id="feather"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#horizontal)" mask="url(#vfade)"/></mask>
  <radialGradient id="radial" cx=".64" cy=".48" r=".58" gradientTransform="translate(.64 .48) scale(.69 1) translate(-.64 -.48)"><stop offset=".35" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
  <mask id="mitya"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#radial)"/></mask>
  <linearGradient id="starfade"><stop stop-color="white" stop-opacity="0"/><stop offset=".27" stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient>
  <mask id="citlali"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#starfade)"/></mask>
  <filter id="brightness" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="linear" slope="${c.brightness}"/><feFuncG type="linear" slope="${c.brightness}"/><feFuncB type="linear" slope="${c.brightness}"/></feComponentTransfer></filter>
  <linearGradient id="quietAlpha"><stop stop-color="black"/><stop offset=".57" stop-color="white"/></linearGradient><mask id="quiet"><rect width="1920" height="1080" fill="url(#quietAlpha)"/></mask>
  </defs><g mask="url(#quiet)"><image href="SOURCE" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" mask="${mask}" filter="url(#brightness)"/></g></svg>`;
 }
 const mime=ext==='.jpg'?'image/jpeg':'image/png';
 await fs.writeFile(path.join(ui,'workspace-composition.svg'),svg.replace('SOURCE',sourceFile));
 // Character pixels retain the approved geometry and masks. They are a
 // separate transparent plane, so the frame can follow the native main area
 // without stretching or moving the person with the sidebar.
 const foreground=await sharp(Buffer.from(svg.replace('SOURCE',`data:${mime};base64,${bytes.toString('base64')}`))).png().toBuffer();
 await fs.writeFile(path.join(ui,'workspace-foreground.png'),foreground);
 const workspaceBackground={schemaVersion:1,id:c.id,mode:c.id==='sandrone'?'original-in-main':'layered',canvasColor:c.canvasColor,focusX:.76,focusY:.46,foreground:'workspace-foreground.png',frame:'workspace-frame.svg',width:1920,height:1080};
 await fs.writeFile(path.join(ui,'workspace-background.json'),JSON.stringify(workspaceBackground,null,2)+'\n');
 // The fallback deliberately has no baked frame. Runtime paints the faint
 // independent vector frame only inside the measured main rectangle.
 await sharp(foreground).flatten({background:c.canvasColor}).png().toFile(path.join(pack,'themes/sandrone/background.png'));
 // Separate opening fallback retains its complete environment and its own source.
 const openingSource=c.id==='mitya'?'integration/art-revisions/v14/mitya-opening-quiet.png':c.opening;
 const opening=await fs.readFile(c.id==='mitya'?path.join(root,openingSource):path.join(design,c.opening));
 await sharp(opening).resize(1920,1080,{fit:'cover'}).jpeg({quality:92}).toFile(path.join(pack,'assets/backgrounds/dark-mechanical.jpg'));
 if(c.id!=='sandrone')await sharp(opening).resize(1920,1080,{fit:'cover'}).png().toFile(path.join(pack,'assets/characters/sandrone/portrait.png'));
 const avatar=await sharp(path.join(design,c.avatarFile),{density:96}).resize(256,256,{fit:'contain',background:'#00000000'}).png().toBuffer();
 await fs.writeFile(path.join(pack,'assets/characters/sandrone/round-icon.png'),avatar);
 const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(avatar.length,14);ico.writeUInt32LE(22,18);await fs.writeFile(path.join(pack,'assets/workshop.ico'),Buffer.concat([ico,avatar]));
 let renderer=paint(template,c.palette);
 const copy={'桑多涅':c.name,'THE MARIONETTE WORKSHOP':c.themeName.toUpperCase()+' · '+c.brandName.toUpperCase(),'FATUI / NO. 007':c.subtitle,'SANDRONE</h1>':c.brandName.toUpperCase()+'</h1>','>MARIONETTE<':'>'+c.themeName+'<','OFFICIAL CODEX · SANDRONE EDITION':'CODEX · '+c.brandName.toUpperCase()+' EDITION',"'Sandrone'":"'"+c.brandName+"'",'解算开始。':c.loadingStates[0],'填入变量。':c.loadingStates[1],'进程良好。':c.loadingStates[2],'析构万理！啊哈哈哈...':c.loadingStates[3]};
 for(const [a,b]of Object.entries(copy))renderer=renderer.replaceAll(a,b);
 await fs.writeFile(path.join(pack,'engine/renderer.mjs'),renderer);await fs.writeFile(path.join(pack,'engine/native-ui.css'),paint(cssTemplate,c.palette)+surfaces(c.palette));
 const composition={version:3,id:c.id,approvedDesignVersion:7,refinementVersion:'1.4.0',framePlacement:'native-main-only',source:c.daily,sourceFile,sourceSha256:sha(bytes),openingSource,openingSourceSha256:sha(opening),workspaceFrame:frame.metadata,workspaceBackground:'assets/ui/workspace-background.json',foregroundSha256:sha(foreground),scale:c.scale,brightness:c.brightness,canvasColor:c.canvasColor,originalPeople:c.originalPeople,method:'Approved source person retained with its original quiet masks in an independent foreground; faint frame follows native main bounds excluding sidebar; original Sandrone composition is contained in native main',outputSha256:sha(await fs.readFile(path.join(pack,'themes/sandrone/background.png')))};
 await fs.writeFile(path.join(ui,'composition.json'),JSON.stringify(composition,null,2)+'\n');
 const meta=JSON.parse(await fs.readFile(path.join(pack,'presentation.json'),'utf8'));meta.releaseVersion='1.4.0';meta.production={dailyComposition:'assets/ui/composition.json',workspaceFrame:'assets/ui/workspace-frame.json',workspaceBackground:'assets/ui/workspace-background.json',opening:'assets/motion/derived.json',lettering:'assets/branding/opening-lettering.json',material:'assets/ui/personality.json',layoutChanged:false};meta.limitations=(meta.limitations||[]).filter(s=>!s.includes('Static nine-second video'));await fs.writeFile(path.join(pack,'presentation.json'),JSON.stringify(meta,null,2)+'\n');
 const manifestFile=path.join(pack,'themes/sandrone/manifest.json');const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));manifest.version='1.4.0';manifest.provenance.summary='Retained daily character artwork with complete subtle frame; independent animated opening; original native layout retained.';for(const f of manifest.files){const data=await fs.readFile(path.join(pack,'themes/sandrone',f.path));f.bytes=data.length;f.sha256=sha(data);}await fs.writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');
 production.push(composition);console.log('Approved production composition: '+c.id);
}
await fs.writeFile(path.join(root,'integration/production-art.json'),JSON.stringify({version:'1.4.0',designVersion:7,layoutChanged:false,characters:production},null,2)+'\n');
