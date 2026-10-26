import assert from 'node:assert/strict';
import {createNativeViewportReset} from '../engine/native-viewport.mjs';

const reset=createNativeViewportReset(),commands=[];
const session={async send(method,params){commands.push([method,params]);}};
assert.equal(await reset.prepare('main',session),true);
assert.deepEqual(commands,[['Page.stopScreencast',undefined],['Emulation.clearDeviceMetricsOverride',undefined],['Emulation.setFocusEmulationEnabled',{enabled:false}]]);
for(let i=0;i<30;i++)assert.equal(await reset.prepare('main',session),false);
assert.equal(commands.length,3,'idle/reconnect passes must not repeatedly change rendering state');
assert.equal(await reset.prepare('settings',session),true,'separate WebContents gets its own reset');
reset.forget('main');assert.equal(await reset.prepare('main',session),true);

let release;const delayed=createNativeViewportReset(),seen=[];
const slow={async send(method){seen.push(method);if(method==='Page.stopScreencast')await new Promise(resolve=>release=resolve);}};
const a=delayed.prepare('main',slow),b=delayed.prepare('main',slow);release();
assert.deepEqual(await Promise.all([a,b]),[true,false]);assert.equal(seen.length,3,'concurrent ownership shares one reset');
const retry=createNativeViewportReset();let attempts=0;
const changing={async send(){if(++attempts===1)throw Object.assign(Error('target reloaded'),{code:'CDP_CONTEXT'});}};
await assert.rejects(retry.prepare('main',changing),{code:'CDP_CONTEXT'});
assert.equal(await retry.prepare('main',changing),true,'interrupted reset is retried rather than marked complete');
console.log('PASS: stale capture/emulation reset once per target, concurrent coalescing, retry and no idle resize loop');
