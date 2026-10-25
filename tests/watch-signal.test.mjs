import assert from 'node:assert/strict';
import {watchSignal} from '../engine/watch-signal.mjs';
const signal=watchSignal();
signal.wake();signal.wake();let then=Date.now();await signal.wait(15000);assert.ok(Date.now()-then<100,'events while applying are retained');
then=Date.now();const wait=signal.wait(15000);setTimeout(()=>signal.wake(),20);await wait;assert.ok(Date.now()-then<500,'reload wakes idle watcher');
signal.wake();await signal.wait(15000);signal.dispose();
console.log('PASS: reload wakeups coalesce and survive in-flight application');
