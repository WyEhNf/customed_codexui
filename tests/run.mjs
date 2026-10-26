// All automatic tests use isolated fixtures. Explicit *.live.mjs tests are excluded.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const kind=process.argv[2]||'unit';
if(!['unit','browser','powershell'].includes(kind))throw Error('Expected unit, browser or powershell');
const env={...process.env,PLAYWRIGHT_CHANNEL:process.env.PLAYWRIGHT_CHANNEL||'chromium'};
if(!env.FFMPEG_EXE){
 const result=spawnSync(env.PYTHON_EXE||'python',['-c','import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8',windowsHide:true});
 if(result.status===0)env.FFMPEG_EXE=result.stdout.trim();
}
const pattern={unit:/\.test\.mjs$/,browser:/\.browser\.mjs$/,powershell:/\.test\.ps1$/}[kind];
const tests=(await fs.readdir(path.join(root,'tests'))).filter(name=>pattern.test(name)).sort();
if(!tests.length)throw Error('No '+kind+' tests found');
if(kind==='powershell')delete env.PSModulePath;
for(const name of tests){
 console.log('\nRUN '+name);
 const file=path.join(root,'tests',name);
 const executable=kind==='powershell'?(env.POWERSHELL_EXE||'powershell.exe'):process.execPath;
 const args=kind==='powershell'?['-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',file]:[file];
 const result=spawnSync(executable,args,{cwd:root,env,stdio:'inherit',windowsHide:true,timeout:10*60*1000});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error(name+' failed with exit '+result.status);
}
console.log(JSON.stringify({pass:true,suite:kind,tests:tests.length,liveClientTestsIncluded:false}));
