import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readRuntimeContract,runtimePackFiles} from '../integration/runtime-files.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const contract=await readRuntimeContract(root);
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
assert.equal(catalog.version,version);
assert.equal(catalog.defaultId,'columbina');
assert.equal(catalog.characters.length,9);
for(const entry of catalog.characters){
 const pack=path.join(root,entry.path),manifest=JSON.parse(await fs.readFile(path.join(pack,'active-files.json'),'utf8'));
 assert.deepEqual(manifest.files,await runtimePackFiles(root,pack));
 for(const name of Object.keys(manifest.files))assert.doesNotMatch(name,/references\/|workspace-source|composition|metrics|PROVENANCE|preview\.html|icons\/ui\/[^/]+\.svg$/);
}
assert.ok(contract.integrationFiles.includes('decorators.mjs'));
console.log(JSON.stringify({pass:true,characters:catalog.characters.length,version,runtimeOnly:true}));
