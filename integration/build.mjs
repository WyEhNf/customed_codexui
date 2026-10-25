import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {stageCharacter,commitCharacter,finishCharacter} from './selection.mjs';
import {writeCharacterRenderers} from './build-renderers.mjs';
if(process.argv.includes('--refresh-icons'))throw new Error('Production rebuild retains approved material icons. Use the material authoring builder with its original inputs for artwork changes.');
await writeCharacterRenderers();
await import('./assemble-production.mjs');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const build=JSON.parse(await fs.readFile(path.join(root,'integration/characters-build.json'),'utf8'));
const entries=[];
for(const c of build.characters){
 const pack=path.join(root,c.path);
 const stage=await fs.mkdtemp(path.join(os.tmpdir(),'codexui-validate-'));
 try{
  const result=spawnSync(process.execPath,[path.join(root,'vendor/dream-skin/runtime/theme-package-validator.mjs'),'--source',path.join(pack,'themes/sandrone'),'--stage',stage,'--platform','windows','--client-version','1.5.21'],{encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw new Error(c.id+' failed original package validation: '+(result.stderr||result.stdout));
 }finally{if(path.resolve(stage).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(stage).startsWith('codexui-validate-'))await fs.rm(stage,{recursive:true,force:true});}
 // This byte-identical original helper resolves resources relative to this pack for previews.
 await fs.copyFile(path.join(root,'engine/assets.mjs'),path.join(pack,'engine/assets.mjs'));
 const {openingAssets}=await import(pathToFileURL(path.join(pack,'engine/assets.mjs')).href+'?build='+Date.now());
 const {showOpening}=await import(pathToFileURL(path.join(pack,'engine/renderer.mjs')).href+'?build='+Date.now());
 const assets=await openingAssets();if(!assets.signature)throw new Error(c.id+' has no valid cursive signature');
 const art=assets.background;
 const html=`<!doctype html><html lang="zh-CN" data-dream-skin="active"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.name} · 开屏预览</title><style>body{margin:0;background:#0d1020 center/cover fixed no-repeat;color:#eef2ff;font:14px "Segoe UI","Microsoft YaHei",sans-serif}main{position:fixed;left:24px;bottom:24px;padding:20px;background:#101426eb;border:1px solid #52678e;border-radius:12px;max-width:420px}button{font:inherit;padding:9px 14px;color:#eef2ff;background:#212943;border:1px solid #7086ac;border-radius:6px;cursor:pointer}p{line-height:1.6}</style><main><strong>${c.name} · ${c.themeName}</strong><p>这是原渲染组件的离线开屏预览，不是 Codex 实机界面。</p><button id="replay">重播开屏</button></main><script>document.body.style.backgroundImage='url('+JSON.stringify(${JSON.stringify(art)})+')';const assets=${JSON.stringify(assets)};const replay=()=>(${showOpening.toString()})(assets,{preview:true});document.getElementById('replay').onclick=replay;replay();</script></html>`;
 await fs.writeFile(path.join(pack,'preview.html'),html);
 const hashes={};
 async function walk(directory){for(const e of await fs.readdir(directory,{withFileTypes:true})){const f=path.join(directory,e.name);if(e.isSymbolicLink())throw new Error('Links not supported');if(e.isDirectory())await walk(f);else if(e.isFile())hashes[path.relative(pack,f).split(path.sep).join('/')]=sha(await fs.readFile(f));}}
 await walk(path.join(pack,'assets'));await walk(path.join(pack,'themes'));
 for(const name of ['engine/renderer.mjs','engine/native-ui.css'])hashes[name]=sha(await fs.readFile(path.join(pack,name)));
 const manifest=Buffer.from(JSON.stringify({id:c.id,files:hashes},null,2)+'\n');
 await fs.writeFile(path.join(pack,'active-files.json'),manifest);entries.push({...c,manifestSha256:sha(manifest)});
 console.log('Verified signature and preview: '+c.id);
}
await fs.writeFile(path.join(root,'catalog.json'),JSON.stringify({schemaVersion:1,version:'1.5.0',defaultId:'columbina',characters:entries},null,2)+'\n');
const base={};
async function immutable(directory){for(const e of await fs.readdir(directory,{withFileTypes:true})){
 const f=path.join(directory,e.name),rel=path.relative(root,f).split(path.sep).join('/');
 if(e.isSymbolicLink())throw new Error('Links are not package inputs');
 if(['state','profile','logs','evidence','backups','.git'].includes(rel.split('/')[0])||['.build-deps','__pycache__'].some(p=>rel.split('/').includes(p))||/^integration\/(motion|materials)\/output(?:\/|$)/.test(rel)||['assets','themes'].includes(rel.split('/')[0])||['engine/renderer.mjs','engine/native-ui.css','integrity.json','machine.json','integration/integrity-base.json'].includes(rel)||e.name.startsWith('.env'))continue;
 if(e.isDirectory())await immutable(f);else if(e.isFile())base[rel]=sha(await fs.readFile(f));
}}
await immutable(root);const baseBytes=Buffer.from(JSON.stringify(base,null,2)+'\n');await fs.writeFile(path.join(root,'integration/integrity-base.json'),baseBytes);
let selected='columbina';try{const v=JSON.parse(await fs.readFile(path.join(root,'state/selection.json'),'utf8'));if(entries.some(c=>c.id===v.id))selected=v.id;}catch{}
const transaction=await stageCharacter(root,selected);await commitCharacter(root,transaction);await finishCharacter(root,transaction);
console.log(JSON.stringify({pass:true,characters:entries.length,selected,immutableFiles:Object.keys(base).length}));
