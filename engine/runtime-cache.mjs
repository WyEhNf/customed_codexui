import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

export async function sourceStamp(files){
 const records=await Promise.all([...new Set(files)].sort().map(async file=>{
  try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Runtime source must be a regular file');return [file,stat.size,stat.mtimeMs,stat.ctimeMs];}
  catch(error){if(error.code==='ENOENT')return [file,'missing'];throw error;}
 }));
 return createHash('sha256').update(JSON.stringify(records)).digest('hex');
}
export function createRuntimeCache({sources,load,now=Date.now,checkMs=1000,auditMs=30000,onReject=()=>{}}){
 let current=null,stamp=null,checkedAt=-Infinity,auditedAt=-Infinity,pending=null;
 async function refresh(force){
  const at=now();if(current&&!force&&at-checkedAt<checkMs)return current;
  checkedAt=at;
  try{
   const before=await sourceStamp(sources(current));
   if(current&&!force&&before===stamp&&at-auditedAt<auditMs)return current;
   const next=await load(current),after=await sourceStamp(sources(next));
   if(before!==after)throw Error('Runtime sources changed while loading');
   current=next;stamp=after;auditedAt=at;return current;
  }catch(error){if(!current)throw error;onReject(error);return current;}
 }
 return {
  get({force=false}={}){if(!pending)pending=refresh(force).finally(()=>{pending=null;});return pending;},
  invalidate(){checkedAt=-Infinity;},
  peek(){return current;},
 };
}
