import assert from 'node:assert/strict';
import {PORT,debuggerUrl} from '../engine/cdp.mjs';
import {openingAssets} from '../engine/assets.mjs';
for(const bad of [`ws://0.0.0.0:${PORT}/devtools/browser/x`,`ws://192.168.1.2:${PORT}/devtools/browser/x`,`ws://127.0.0.1:${PORT===19337?19338:19337}/devtools/browser/x`,`wss://127.0.0.1:${PORT}/devtools/browser/x`,`ws://127.0.0.1:${PORT}/devtools/browser/x?token=x`])assert.throws(()=>debuggerUrl(bad));
assert.throws(()=>debuggerUrl(`ws://127.0.0.1:${PORT}/devtools/browser/a`,'b'));
assert.equal(debuggerUrl(`ws://127.0.0.1:${PORT}/devtools/browser/a`,'a'),`ws://127.0.0.1:${PORT}/devtools/browser/a`);
const l=hex=>{const c=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const contrast=(a,b)=>{const x=l(a),y=l(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const [fg,bg]of [['f4eddd','101721'],['c2c8cf','151e2a'],['131b26','ddbb79'],['eee8da','202b3a']])assert.ok(contrast(fg,bg)>=7,`${fg}/${bg} contrast`);
for(const glyph of ['1a1c1f','ffffff'])assert.ok(contrast(glyph,'897350')>=3,'native caption glyph contrast');
assert.ok(contrast('1f1f1f','c8c4b7')>=7);assert.ok(contrast('ffffff','19232f')>=7);
const a=await openingAssets();for(const key of ['avatar','background','cryo','skill','burst'])assert.ok(a[key]?.startsWith('data:image/'));
const edition=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../asset-edition.json',import.meta.url),'utf8'));
if(['columbina-artwork','character-integrated'].includes(edition.edition)){assert.ok(a.video);assert.ok(a.traceFallback||a.traceVideo);assert.ok(a.signature);}else if(edition.edition==='user-artwork'){assert.ok(a.video);assert.ok(a.traceVideo);}else{assert.equal(a.videoFallback,true);assert.equal(a.signatureFallback,true);}
console.log(JSON.stringify({pass:true,checks:['loopback-only','browser-identity','foreground-background-contrast-at-least-7','asset-signatures']}));
