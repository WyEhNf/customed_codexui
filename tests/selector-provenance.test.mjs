// Contract/fixture updates require an explicit reviewed provenance refresh.
// This is source evidence, never a claim that CI exercised an installed client.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const proof=JSON.parse(await fs.readFile(path.join(root,'integration/selector-provenance.json'),'utf8'));
assert.equal(proof.schemaVersion,1);
assert.equal(proof.evidenceScope,'sanitized native source fixtures; isolated DOM regressions');
const contract=JSON.parse(await fs.readFile(path.join(root,'integration/icon-contract.json'),'utf8'));
assert.equal(proof.client,contract.client);
for(const [name,digest]of Object.entries(proof.files)){
 assert.ok(!name.includes('..')&&!path.isAbsolute(name));
 const source=(await fs.readFile(path.join(root,name),'utf8')).replace(/\r\n/g,'\n');
 assert.equal(createHash('sha256').update(source).digest('hex'),digest,name+' changed without reviewed provenance');
}
assert.deepEqual(Object.keys(proof.files).sort(),['integration/icon-contract.json','tests/fixtures/native-ui-icons.json']);
const fixtures=JSON.parse(await fs.readFile(path.join(root,'tests/fixtures/native-ui-icons.json'),'utf8'));
assert.deepEqual(fixtures.icons.map(icon=>icon.role).sort(),['file','folder','folder-open','search']);
for(const icon of fixtures.icons){assert.ok(icon.role&&icon.shape&&icon.viewBox);assert.doesNotMatch(icon.shape,/<script|\bon\w+=|https?:/i);}
console.log(JSON.stringify({pass:true,client:proof.client,fixtures:fixtures.icons.length,liveClientCoverage:false}));
