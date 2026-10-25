import path from 'node:path';
import {stageCharacter,commitCharacter,finishCharacter,rollback,atomicJson} from './selection.mjs';
// Reuse Sandrone's process/session controller; integration adds explicit replay and an in-window binding.
export async function switchCharacter({root,id,offline=false,managedAlive,control}){
 const transaction=await stageCharacter(root,id);let prepared=false;
 try{
  if(!offline&&await managedAlive()){
   // Keep the current stylesheet alive. Upstream removal displays its pause UI
   // and exposes the unthemed app between the two character packs.
   const r=await control('prepare-switch',false);if(r.status!=='ready')throw new Error(r.detail||r.message);prepared=true;
  }
  await commitCharacter(root,transaction);
  if(offline){await finishCharacter(root,transaction);return {status:'selected',id,message:'角色已选择（离线模式，未连接客户端）。'};}
  const result=await control('launch',true);
  if(['ready','waiting'].includes(result.status)){
   await atomicJson(path.join(root,'state/selection.json'),{id,name:transaction.entry.name,selectedAt:new Date().toISOString(),status:result.status==='ready'?'applied':'waiting'});
   await finishCharacter(root,transaction);
   return {...result,id,message:transaction.entry.name+(result.status==='ready'?'主题已应用，并播放一次开屏。':'已选择，等待客户端主界面。')};
  }
  if(result.status==='blocked'&&!prepared){
   await finishCharacter(root,transaction);return {status:'selected',id,message:'角色已保存，主题客户端暂未连接。',detail:[result.message,result.detail].filter(Boolean).join('\n')};
  }
  throw new Error(result.detail||result.message||'角色应用失败。');
 }catch(error){
  if(!transaction.journal.committed&&!transaction.journal.rolledBack)await rollback(root,transaction);
  if(prepared)await control('launch',false).catch(()=>{});
  throw error;
 }
}
