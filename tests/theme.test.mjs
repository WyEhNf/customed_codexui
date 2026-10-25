import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {decodeAndValidateSafeCss} from '../vendor/dream-skin/runtime/safe-css-validator.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'sandrone-theme-'));
const validator=path.join(root,'vendor/dream-skin/runtime/theme-package-validator.mjs');
function validate(source,stage){return spawnSync(process.execPath,[validator,'--source',source,'--stage',stage,'--platform','windows','--client-version','1.5.21'],{encoding:'utf8'});}
const good=path.join(temp,'good');await fs.mkdir(good);
assert.equal(validate(path.join(root,'themes/sandrone'),good).status,0,'manifest and hash format validates');
const corrupt=path.join(temp,'corrupt');await fs.cp(path.join(root,'themes/sandrone'),corrupt,{recursive:true});
await fs.appendFile(path.join(corrupt,'theme.css'),'\n');const bad=path.join(temp,'bad');await fs.mkdir(bad);
assert.notEqual(validate(corrupt,bad).status,0,'changed payload must fail SHA-256');
for(const css of ['[data-ds-part="root"] { position: fixed; }','body { color: #ffffff; }','[data-ds-part="root"] { background-color: url(https://example.com/x); }','@import "https://example.com/x.css";']){
 assert.throws(()=>decodeAndValidateSafeCss(Buffer.from(css)),undefined,'unsafe CSS rejected');
}
console.log(JSON.stringify({pass:true,checks:['manifest','payload-tamper','no-position-overlays','registered-parts-only','no-external-url','no-import']}));
