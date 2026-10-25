import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {loadCatalog} from './selection.mjs';
import {getMaterialUiConfig} from './material-ui.mjs';
import {getWorkspaceBackgroundConfig} from './workspace-background.mjs';

export async function embeddedConfig(root){
 const catalog=await loadCatalog(root);let selectedId=catalog.defaultId,notice;
 try{selectedId=JSON.parse(await fs.readFile(path.join(root,'state/selection.json'),'utf8')).id;}catch{}
 if(!catalog.characters.some(c=>c.id===selectedId))selectedId=catalog.defaultId;
 const presentation=JSON.parse(await fs.readFile(path.join(root,'characters',selectedId,'presentation.json'),'utf8'));
 try{const result=JSON.parse(await fs.readFile(path.join(root,'state/last-switch-result.json'),'utf8'));if(result.status==='error'&&Date.now()-Date.parse(result.finishedAt)<300000)notice=result.message;}catch{}
 const characters=await Promise.all(catalog.characters.map(async({id,name,themeName})=>({id,name,themeName,avatar:'data:image/png;base64,'+(await fs.readFile(path.join(root,'characters',id,'assets/characters/sandrone/round-icon.png'))).toString('base64')})));
 const palette={};for(const key of ['background','panel','panelAlt','accent','text','muted','line']){const value=presentation.palette[key];if(!/^#[a-f0-9]{6}$/i.test(value))throw new Error('Invalid integration palette');palette[key]=value;}
 const iconSet=JSON.parse(await fs.readFile(path.join(root,'characters',selectedId,'assets/icons/ui/icon-set.json'),'utf8'));
 const contract=JSON.parse(await fs.readFile(path.join(root,'integration/icon-contract.json'),'utf8'));
 if(iconSet.schemaVersion!==1||iconSet.id!==selectedId||!Array.isArray(iconSet.roles))throw new Error('Invalid character icon set');
 const rendererRevision=createHash('sha256').update(await fs.readFile(path.join(root,'integration/character-icons.mjs'))).digest('hex');
 const materialUi=await getMaterialUiConfig(root,selectedId);
 const workspaceBackground=await getWorkspaceBackgroundConfig(root,selectedId);
 return {selectedId,palette,characters,materialUi,workspaceBackground,iconSet:{...iconSet,contract,rendererRevision},...(notice?{notice}:{})};
}
export function parseSwitchRequest(payload,ids){
 if(typeof payload!=='string'||payload.length>200)throw new Error('Invalid character request');
 const value=JSON.parse(payload);
 if(!value||Object.keys(value).sort().join(',')!=='id,requestId'||!ids.has(value.id)||typeof value.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(value.requestId))throw new Error('Invalid character request');
 return value;
}
export function spawnSwitchWorker(root,request,spawnProcess=spawn){
 const child=spawnProcess(process.execPath,[path.join(root,'integration/switch.mjs'),'--select',request.id,'--request-id',request.requestId],{cwd:root,windowsHide:true,detached:true,stdio:'ignore'});
 return new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',()=>{child.unref();resolve(child);});});
}
