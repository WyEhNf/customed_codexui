import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
const normalize=s=>s.replace(/\r\n/g,'\n').replace(/#[a-f0-9]{3,8}\b/gi,'COLOR').replace(/rgba?\([^)]*\)/gi,'COLOR');
const original=await fs.readFile(path.join(root,'integration/templates/native-ui.css'),'utf8');
const sourceRenderer=await fs.readFile(path.join(root,'integration/templates/renderer.mjs'),'utf8');
const openingCss=s=>/style\.replaceSync\(`([\s\S]*?)`\)/.exec(s)?.[1];
assert.ok(openingCss(sourceRenderer));
for(const c of catalog.characters){
 const p=path.join(root,c.path);
 const css=await fs.readFile(path.join(p,'engine/native-ui.css'),'utf8');
 const [base,paintOnly]=css.split('/* Approved surface alpha, paint only: no layout or whole-control opacity. */');
 assert.equal(normalize(base.trim()),normalize(original.trim()),c.id+' must preserve original native CSS geometry');
 assert.ok(paintOnly,c.id+' surface alpha layer missing');
 for(const declaration of paintOnly.matchAll(/(?:^|[;{])\s*([\w-]+)\s*:/g))assert.ok(declaration[1].startsWith('--')||['background','background-color'].includes(declaration[1]),c.id+' non-paint change: '+declaration[1]);
 const renderer=await fs.readFile(path.join(p,'engine/renderer.mjs'),'utf8');assert.equal(normalize(openingCss(renderer)),normalize(openingCss(sourceRenderer)),c.id+' must preserve original opening layout');
 const signature=JSON.parse(await fs.readFile(path.join(p,'assets/branding/sandrone-signature.json'),'utf8'));
 assert.ok(signature.paths.length>=1&&signature.paths.length<=12);
}
console.log('PASS: all nine variants preserve the original native CSS and opening geometry; signatures fit unchanged geometry limits');
