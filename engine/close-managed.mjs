// No renderer scripts: request a graceful quit of one previously verified browser.
import fs from 'node:fs/promises';
import {PORT,managedPort,identity} from './cdp.mjs';
const i=process.argv.indexOf('--browser-id');
const browserId=i>=0?process.argv[i+1]:'';
if(!/^[A-Za-z0-9._-]{1,200}$/.test(browserId))throw new Error('Invalid browser identity');
const state=JSON.parse((await fs.readFile(new URL('../state/managed.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
if(state.browserId!==browserId||managedPort(state)!==PORT)throw new Error('Managed browser identity changed; refused close');
const expected=await identity(browserId);
await new Promise((resolve,reject)=>{
 const socket=new WebSocket(expected);
 const timer=setTimeout(()=>{socket.close();reject(new Error('Graceful close timed out; close the themed window manually'));},7000);
 let requested=false;
 socket.onopen=()=>{requested=true;socket.send(JSON.stringify({id:1,method:'Browser.close'}));};
 socket.onclose=()=>{clearTimeout(timer);requested?resolve():reject(new Error('Browser connection closed before the request'));};
 socket.onerror=()=>{clearTimeout(timer);reject(new Error('Browser close connection failed'));};
 socket.onmessage=e=>{try{const result=JSON.parse(e.data);if(result.id===1&&result.error){clearTimeout(timer);socket.close();reject(new Error('Browser refused graceful close'));}}catch{}};
});
console.log('Graceful close requested for the verified themed browser.');
