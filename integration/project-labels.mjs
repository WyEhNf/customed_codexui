import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ids=['columbina','ayaka','hutao','nahida','furina','citlali','mitya','istaroth','sandrone'];
// Theme data feeds upstream's existing CSS pseudo-element. The project button,
// its live name, accessibility text, and React event owner remain native.
export async function ensureProjectLabels(root){
 const data=JSON.parse(await fs.readFile(path.join(root,'integration/project-labels.json'),'utf8'));
 if(data.schemaVersion!==1||JSON.stringify(Object.keys(data.characters||{}).sort())!==JSON.stringify([...ids].sort()))throw new Error('Invalid project label character set');
 for(const id of ids){
  const labels=data.characters[id];
  if(Object.keys(labels).sort().join(',')!=='projectLabel,projectPrefix'||!/^\p{Script=Han}{2,5} · $/u.test(labels.projectPrefix)||typeof labels.projectLabel!=='string'||labels.projectLabel.length<1||labels.projectLabel.length>24)throw new Error('Invalid project label: '+id);
 }
 const results=[];
 for(const id of ids){
  const folder=path.join(root,'characters',id,'themes/sandrone'),themeFile=path.join(folder,'theme.json'),manifestFile=path.join(folder,'manifest.json');
  const [themeRaw,manifestRaw]=await Promise.all([fs.readFile(themeFile,'utf8'),fs.readFile(manifestFile,'utf8')]);
  const theme=JSON.parse(themeRaw),manifest=JSON.parse(manifestRaw);
  if(theme.id!==id+'-codex-ui'||manifest.themeId!==theme.id)throw new Error('Project label theme identity mismatch: '+id);
  const entry=manifest.files?.find(file=>file.path==='theme.json');
  if(!entry)throw new Error('Project label theme manifest missing: '+id);
  const labels=data.characters[id],changed=Object.entries(labels).some(([key,value])=>theme[key]!==value);
  const bytes=changed?Buffer.from(JSON.stringify({...theme,...labels},null,2)+'\n'):Buffer.from(themeRaw);
  const digest=createHash('sha256').update(bytes).digest('hex');
  const manifestChanged=entry.bytes!==bytes.length||entry.sha256!==digest;
  if(changed)await fs.writeFile(themeFile,bytes);
  if(manifestChanged){entry.bytes=bytes.length;entry.sha256=digest;await fs.writeFile(manifestFile,JSON.stringify(manifest,null,2)+'\n');}
  results.push({id,...labels,changed,manifestChanged});
 }
 return results;
}
