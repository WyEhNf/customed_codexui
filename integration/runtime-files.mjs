import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function readRuntimeContract(root){return JSON.parse(await fs.readFile(path.join(root,'integration/runtime-files.json'),'utf8'));}

// The same explicit file contract is read by the Python ZIP packager.
export async function runtimePackFiles(root,pack){
 const contract=await readRuntimeContract(root),files={};
 for(const name of [...contract.packFiles,...contract.optionalPackFiles]){
  const file=path.join(pack,name);
  let stat;try{stat=await fs.lstat(file);}catch(error){if(error.code==='ENOENT'&&contract.optionalPackFiles.includes(name))continue;throw error;}
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Runtime input is not a regular file: '+name);
  files[name]=sha256(await fs.readFile(file));
 }
 const ledger=JSON.parse(await fs.readFile(path.join(pack,'assets/motion/derived.json'),'utf8'));
 if(!files['assets/motion/'+ledger.file])throw Error('Runtime movie is missing from the file contract');
 return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b,'en')));
}
