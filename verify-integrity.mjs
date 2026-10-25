import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
const hashes=JSON.parse(fs.readFileSync(path.join(root,'integrity.json'),'utf8'));
for(const [name,expected] of Object.entries(hashes)){
 const file=path.resolve(root,name);
 if(!file.startsWith(root+path.sep))throw new Error('Unsafe integrity path');
 const hash=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(hash!==expected)throw new Error('Integrity mismatch: '+name);
}
console.log(JSON.stringify({pass:true,files:Object.keys(hashes).length}));
