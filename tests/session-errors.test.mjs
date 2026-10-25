import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Invalid identity is rejected before any network access or renderer operation.
const result=spawnSync(process.execPath,[fileURLToPath(new URL('../engine/session.mjs',import.meta.url)),'--watch','--browser-id','invalid identity'],{encoding:'utf8'});
assert.equal(result.status,1);
assert.equal(result.stdout,'');
const error=JSON.parse(result.stderr.trim());
assert.equal(error.pass,false);
assert.equal(error.message,'Invalid browser ID');
console.log('PASS: watcher failures retain their cause on the redirected error stream');
