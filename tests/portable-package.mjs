// Exercise the actual ZIP, including every role switch, without a client/profile.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const archive=process.argv[2];
if(!archive)throw Error('Usage: node tests/portable-package.mjs <portable.zip>');
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'codexui-portable-'));
try{
 const extraction=spawnSync(process.env.PYTHON_EXE||'python',['-c',`import sys,zipfile\nfrom pathlib import PurePosixPath\nwith zipfile.ZipFile(sys.argv[1]) as z:\n for name in z.namelist():\n  p=PurePosixPath(name)\n  assert not p.is_absolute() and '..' not in p.parts and p.parts[0]=='Windows-Portable'\n assert z.testzip() is None\n z.extractall(sys.argv[2])`,path.resolve(archive),temporary],{encoding:'utf8',windowsHide:true,timeout:120000});
 assert.equal(extraction.status,0,extraction.stderr);
 const root=path.join(temporary,'Windows-Portable');
 const {loadCatalog,stageCharacter,commitCharacter,finishCharacter}=await import(pathToFileURL(path.join(root,'integration/selection.mjs')).href);
 const {getMaterialUiConfig}=await import(pathToFileURL(path.join(root,'integration/material-ui.mjs')).href);
 const {getWorkspaceBackgroundConfig}=await import(pathToFileURL(path.join(root,'integration/workspace-background.mjs')).href);
 const {openingAssets}=await import(pathToFileURL(path.join(root,'engine/assets.mjs')).href);
 const catalog=await loadCatalog(root);
 assert.equal(catalog.defaultId,'columbina');assert.equal(catalog.characters.length,9);
 const verify=()=>{const result=spawnSync(process.execPath,[path.join(root,'verify-integrity.mjs')],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000});assert.equal(result.status,0,result.stderr);};
 verify();
 for(const {id}of catalog.characters){
  const transaction=await stageCharacter(root,id);await commitCharacter(root,transaction);await finishCharacter(root,transaction);
  verify();
  const opening=await openingAssets();
  assert.equal(opening.lettering.id,id);assert.ok(opening.video&&opening.signature);
  if(id!=='sandrone')assert.ok(opening.sceneIntro&&!opening.sceneIntroFallback);
  assert.equal((await getMaterialUiConfig(root,id)).id,id);
  assert.equal((await getWorkspaceBackgroundConfig(root,id)).id,id);
  console.log('PASS portable activation '+id);
 }
 console.log(JSON.stringify({pass:true,characters:9,packagedFilesOnly:true,integrityAfterEverySwitch:true,liveClientContacted:false}));
}finally{
 const absolute=path.resolve(temporary),base=path.resolve(os.tmpdir());
 if(!absolute.startsWith(base+path.sep)||!path.basename(absolute).startsWith('codexui-portable-'))throw Error('Unsafe temporary cleanup path');
 await fs.rm(absolute,{recursive:true,force:true});
}
