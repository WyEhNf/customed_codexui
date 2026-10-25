// Authoring: bake approved vector templates into validated per-character data.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const templates=path.join(root,'integration/icon-templates');
const characters=JSON.parse(await fs.readFile(path.join(root,'integration/characters-build.json'),'utf8')).characters;
const roles=['folder','folder-open','projects','chat','new-chat','file','terminal','search','settings'];
const extra=['home','sidebar','history','artifacts','plugins','explore','review','sites','agents','activity'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const simplified={
 sandrone:'<path d="M1 1H9M5 1V3M5 6V9M3 7 5 6 7 7" stroke-width="1.25"/><circle cx="5" cy="4.5" r="1.5" stroke-width="1"/>',
 furina:'<path d="M5 .5C3.5 3 1 4.5 1 6.5a4 4 0 0 0 8 0C9 4.5 6.5 3 5 .5Z" stroke-width="1.2"/>',
 citlali:'<path d="m5 .4 1.3 3.3L9.6 5 6.3 6.3 5 9.6 3.7 6.3.4 5l3.3-1.3Z" stroke-width="1.1"/>',
 istaroth:'<path d="M1.6 1H8.4M1.6 9H8.4M2.5 1 7.5 9M7.5 1 2.5 9" stroke-width="1.2"/>'
};
const wrap=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${body}</svg>`;
function extraIcon(role,p,emblem){
 let body='',mark=[9,9,7];
 if(role==='home'){body='<path d="m2.5 10 9.5-8 9.5 8M5 8v13h14V8M9 21v-6h6v6"/>';mark=[8.8,6.8,6.5];}
 if(role==='sidebar'){body='<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M8 4V20"/>';mark=[11,8,8];}
 if(role==='history'){body='<circle cx="10.5" cy="12.5" r="8.5"/><path d="M10.5 7.5V12.5L7.5 15.5"/>';mark=[16,1.8,6.5];}
 if(role==='artifacts'){body='<path d="M8 3h11v15M5 6h11v15H3V6ZM7 10h5M7 14h3"/>';mark=[10,15,6.5];}
 if(role==='plugins'){body='<path d="M3 10V5h5c-1-3 5-4 5 0h5v5c4-1 5 5 0 5v5H13c1-4-5-4-5 0H3v-5c4 1 4-5 0-5Z"/>';mark=[8.3,8.3,6.5];}
 if(role==='explore'){body='<circle cx="12" cy="12" r="9.5"/><path d="m16.5 7.5-3 6-6 3 3-6Z"/>';mark=[14.2,14,5.5];}
 if(role==='review'){body='<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M6 8H12M9 5V11M6 16H12"/>';mark=[14,11,6];}
 if(role==='sites'){body='<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12H21.5M12 2.5C5 8 5 16 12 21.5M12 2.5C19 8 19 16 12 21.5"/>';mark=[13.8,13.4,6];}
 if(role==='agents'){body='<circle cx="8" cy="7" r="3"/><path d="M2.5 21V17a5.5 5.5 0 0 1 11 0v4M15 4a3 3 0 0 1 0 6M17 13c3 0 4.5 1.8 4.5 4v4"/>';mark=[5,14,6];}
 if(role==='activity'){body='<path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4ZM10 20h4"/>';mark=[9,8,6];}
 const symbol=emblem.replace(/transform="[^"]+"/,`transform="translate(${mark[0]} ${mark[1]}) scale(${mark[2]/10})"`);
 return wrap(`<g fill="none" stroke="${p.muted}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g><g color="${p.accent}">${symbol}</g>`);
}
function compact(svg,id){
 if(!simplified[id])return svg;
 return svg.replace(/(<g color="[^"]+"><g transform="[^"]+"[^>]*>)[\s\S]*(<\/g><\/g>(?:<\/g>)?<\/svg>)$/,(match,start,end)=>start+simplified[id]+end);
}
function selected(svg,p){return svg.replaceAll(`stroke="${p.muted}"`,`stroke="${p.accent}"`).replaceAll(`color="${p.accent}"`,`color="${p.secondary}"`);}
for(const c of characters){
 const p=JSON.parse(await fs.readFile(path.join(root,c.path,'presentation.json'),'utf8')).palette;
 const dest=path.join(root,c.path,'assets/icons/ui');await fs.mkdir(dest,{recursive:true});
 const rawFolder=await fs.readFile(path.join(templates,c.id,'folder.svg'),'utf8');
 const emblem=/<g color="[^"]+">(<g transform="[^"]+"[\s\S]*<\/g>)<\/g><\/g><\/svg>/.exec(rawFolder)?.[1];
 if(!emblem)throw new Error('Missing approved motif: '+c.id);
 const icons={};
 for(const role of [...roles,...extra]){
  const normal=roles.includes(role)?await fs.readFile(path.join(templates,c.id,role+'.svg'),'utf8'):extraIcon(role,p,emblem);
  const small=compact(normal,c.id);
  const values={normal,selected:selected(normal,p),compact:small,compactSelected:selected(small,p)};
  for(const [state,svg]of Object.entries(values)){
   if(/<(?:script|image|foreignObject)\b|\bon\w+=|https?:|url\(/i.test(svg.replace('http://www.w3.org/2000/svg','')))throw new Error('Unsafe vector template');
   await fs.writeFile(path.join(dest,role+'.'+state+'.svg'),svg);
  }
  icons[role]=Object.fromEntries(Object.entries(values).map(([state,s])=>[state,'data:image/svg+xml;base64,'+Buffer.from(s).toString('base64')]));
 }
 const payload={schemaVersion:1,id:c.id,roles:[...roles,...extra],icons};
 const revision=sha(JSON.stringify(payload));await fs.writeFile(path.join(dest,'icon-set.json'),JSON.stringify({...payload,revision},null,2)+'\n');
 await fs.writeFile(path.join(dest,'PROVENANCE.json'),JSON.stringify({source:'Approved 2026-10-25 character icon proposal A; nine original role templates plus matching native-navigation extensions',approved:true,originalRoles:roles,matchingNavigationRoles:extra,baseGrid:24,strokeWidth:1.5,geometryUnchanged:true,reactChildrenUnchanged:true,revision},null,2)+'\n');
 console.log('Built themed icons: '+c.id+' ('+payload.roles.length+' roles)');
}
