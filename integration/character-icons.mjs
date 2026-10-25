// Replace only the paint of recognised native UI icons. Never replace React's
// nodes, paths, accessible names, listeners, sizes, transforms or hit targets.
export function installCharacterIcons(config){
 const key='__CODEX_CHARACTER_ICONS__',version='1.0.0';
 const fingerprint=version+':'+(config.rendererRevision||'')+':'+config.id+':'+config.revision+':'+config.contract.revision;
 if(window[key]?.fingerprint===fingerprint&&document.adoptedStyleSheets.includes(window[key].sheet)){window[key].sync();return {installed:true,reused:true,count:window[key].owned.size};}
 window[key]?.dispose?.();
 const roleAttr='data-codex-character-icon',smallAttr='data-codex-character-icon-small',selectedAttr='data-codex-character-icon-selected';
 const owned=new Set(),queue=new Set(),nativeRules=new Map();let raf=0,disposed=false,nativeDirty=false;
 const nativeKeyAttr='data-codex-settings-icon',nativeSlugAttr='data-codex-settings-slug';
 const settingsSlugs=new Set(config.contract.settingsNavigation?.slugs||['general-settings','appearance','notifications','personalization','keyboard-shortcuts','account','profile','agent','git-settings','code-review','usage','analytics','browser-use','computer-use','local-environments','worktrees','mcp-settings','gateways','hooks-settings','connections','plugins-settings','file-type-handlers','skills-settings','security','data-controls','pets','codex-cloud','cloud-environments','cloud-settings','teams']);
 const escapeXml=value=>String(value).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
 // Reuse approved metal/enamel and the complete character motif, while keeping
 // each native Settings glyph (keyboard, bell, shield, etc.) recognisable.
 function nativeSettingsSkin(svg,key){
  if(nativeRules.has(key))return true;if(nativeRules.size>=128)return false;
  const view=(svg.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);if(view.length!==4||view[0]!==0||view[1]!==0||!view[2]||!view[3])return false;
  const allowed=['d','points','x','y','width','height','rx','ry','cx','cy','r','x1','x2','y1','y2','transform','fill','fill-rule','clip-rule','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity'];
  const shapes=[...svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')];if(!shapes.length||shapes.length>32)return false;
  const attr=(name,value)=>' '+name+'="'+escapeXml((name==='fill'||name==='stroke')&&value==='currentColor'?'url(#metal)':value)+'"';
  const rootPaint=['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin'].map(name=>svg.hasAttribute(name)?attr(name,svg.getAttribute(name)):'').join('');
  const geometry=shapes.map(shape=>{let parents='';for(let p=shape.parentElement;p&&p!==svg;p=p.parentElement)if(p.hasAttribute('transform'))parents=p.getAttribute('transform')+' '+parents;const body='<'+shape.tagName.toLowerCase()+allowed.filter(name=>shape.hasAttribute(name)).map(name=>attr(name,shape.getAttribute(name))).join('')+'/>';return parents?'<g transform="'+escapeXml(parents)+'">'+body+'</g>':body;}).join('');
  const make=data=>{if(!data?.startsWith('data:image/svg+xml;base64,'))return null;let doc;try{doc=new DOMParser().parseFromString(atob(data.split(',')[1]),'image/svg+xml');}catch{return null;}const defs=doc.querySelector('defs'),motif=doc.querySelector('g[color]');if(!defs||!motif||doc.querySelector('parsererror,script,foreignObject,image,use,a'))return null;const motifCopy=motif.cloneNode(true);motifCopy.setAttribute('transform','translate(13.1 13.1) scale(.4)');const xml='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'+defs.outerHTML+'<g'+(svg.hasAttribute('fill')?'':' fill="url(#metal)"')+rootPaint+' transform="scale('+(24/view[2])+','+(24/view[3])+')">'+geometry+'</g>'+motifCopy.outerHTML+'</svg>';return 'data:image/svg+xml;base64,'+btoa(xml);};
  const normal=make(config.icons.settings?.normal),selected=make(config.icons.settings?.selected);if(!normal||!selected)return false;
  const selector='html[data-dream-skin="active"] svg['+nativeKeyAttr+'="'+key+'"]';nativeRules.set(key,selector+'{background-image:url("'+normal+'")!important}'+selector+'['+selectedAttr+'="true"],html[data-dream-skin="active"] :is(button,a,[role="button"],[role="tab"]):hover svg['+nativeKeyAttr+'="'+key+'"]{background-image:url("'+selected+'")!important}');nativeDirty=true;return true;
 }
 const keyFor=svg=>{
  const geometry=[...svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon')].map(n=>[n.tagName,...['d','points','x','y','width','height','rx','ry','cx','cy','r','x1','x2','y1','y2','transform'].map(k=>n.getAttribute(k)||'')]);
  const value=JSON.stringify([svg.getAttribute('viewBox')||'',geometry]);let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');
 };
 const labels=[
  ['new-chat',/^(?:新聊天|新建聊天|新建会话|New chat|New conversation|在 .+ 中开始新聊天)$/i],
  ['search',/^(?:搜索|搜索聊天|Search|Search chats|Find files|搜索文件)$/i],
  ['settings',/^(?:设置|打开设置|Settings|Open settings)$/i],
  ['terminal',/^(?:终端|打开终端|显示终端|切换终端|Terminal|Open terminal|Show terminal|Toggle terminal)$/i],
  ['folder',/^(?:文件夹|Folder|Open folder|打开文件夹)$/i],
  ['projects',/^(?:项目|Projects)$/i],
  ['home',/^(?:首页|Home)$/i],
  ['artifacts',/^(?:资料空间|Library|Artifacts)$/i],
  ['history',/^(?:定时任务|Schedules|Automations)$/i],
  ['plugins',/^(?:插件|Plugins)$/i],
  ['explore',/^(?:探索|Explore)$/i],
  ['review',/^(?:代码审查|Code review|变更|Changes)$/i],
  ['sites',/^(?:站点|Sites)$/i],
  ['agents',/^(?:子智能体|子代理|Agents|Subagents)$/i],
  ['sidebar',/^(?:隐藏侧边栏|显示侧边栏|切换侧边栏|Hide sidebar|Show sidebar|Toggle sidebar)$/i],
  ['activity',/^(?:查看活动|View activity)$/i]
 ];
 const excluded='[data-ds-part="message"],[data-ds-part="composer"],pre,code,[data-markdown],.markdown,[class*="markdown"],#sandrone-opening,#codex-character-switcher,[data-character-icon-exclude],[role="progressbar"],[class*="animate-spin"],[class*="spinner"],[class*="Spinner"]';
 const forget=svg=>{svg.removeAttribute(roleAttr);svg.removeAttribute(smallAttr);svg.removeAttribute(selectedAttr);svg.removeAttribute(nativeKeyAttr);svg.removeAttribute(nativeSlugAttr);owned.delete(svg);};
 const update=svg=>{
  if(!svg?.isConnected||svg.closest(excluded)){if(owned.has(svg))forget(svg);return;}
  const box=(svg.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);
  if(box.length!==4||box[2]>32||box[3]>32||svg.classList.contains('icon-disclosure')||/favicon/i.test(svg.parentElement?.className||'')){if(owned.has(svg))forget(svg);return;}
  if(svg.matches('[data-file-type],[data-file-icon]')||[svg,...svg.querySelectorAll('[fill],[stroke]')].some(n=>['fill','stroke'].some(a=>{const value=n.getAttribute(a);return value&&!['none','currentColor','inherit'].includes(value);}))) {if(owned.has(svg))forget(svg);return;}
  const owner=svg.closest('button,a,[role="button"],[role="treeitem"],[role="tab"],[data-character-ui-icon]');
  if(!owner){if(owned.has(svg))forget(svg);return;}
  if(owner.closest('[data-danger="true"],[data-variant="danger"],[data-variant="destructive"]')||/(?:删除|移除|停止|取消运行|\bDelete\b|\bRemove\b|\bStop\b|Cancel run)/i.test(owner.getAttribute('aria-label')||'')){if(owned.has(svg))forget(svg);return;}
  const settingsItem=owner.closest('[data-settings-panel-slug]'),settingsSlug=settingsItem?.getAttribute('data-settings-panel-slug');
  if(settingsItem&&settingsItem.closest('nav')&&settingsSlugs.has(settingsSlug)){
   const stamp=keyFor(svg);if(!nativeSettingsSkin(svg,stamp)){if(owned.has(svg))forget(svg);return;}
   const set=(name,value)=>{if(svg.getAttribute(name)!==value)svg.setAttribute(name,value);};set(roleAttr,'settings-native');set(nativeKeyAttr,stamp);set(nativeSlugAttr,settingsSlug);set(selectedAttr,String(Boolean(owner.closest('[aria-current="page"],[aria-current="true"],[aria-selected="true"],[data-state="active"]'))));owned.add(svg);return;
  }
  svg.removeAttribute(nativeKeyAttr);svg.removeAttribute(nativeSlugAttr);
  const stamp=keyFor(svg);let role=config.contract.match[stamp];
  if(!role&&!config.contract.ignore.includes(stamp)){
   const explicit=svg.getAttribute('data-character-ui-icon');
   if(config.roles.includes(explicit))role=explicit;
   else{
    const label=(owner.getAttribute('aria-label')||owner.getAttribute('title')||owner.textContent||'').trim().replace(/\s+/g,' ');
    role=labels.find(([,pattern])=>pattern.test(label))?.[0];
    if(!role){const name=svg.getAttribute('data-lucide')||svg.getAttribute('data-icon')||'';role=({folder:'folder','folder-open':'folder-open',files:'file',file:'file','file-text':'file',terminal:'terminal',search:'search',settings:'settings','message-square':'chat','message-circle':'chat','square-pen':'new-chat','layout-grid':'projects'})[name];}
   }
  }
  if(role==='folder'&&owner.closest('[aria-expanded="true"]'))role='folder-open';
  if(!config.roles.includes(role)){if(owned.has(svg))forget(svg);return;}
  const width=svg.getBoundingClientRect().width||parseFloat(svg.getAttribute('width'))||box[2];
  const small=width<=16.5,selected=Boolean(owner.closest('[aria-current="page"],[aria-current="true"],[aria-selected="true"],[data-state="active"]'));
  const set=(name,value)=>{if(svg.getAttribute(name)!==value)svg.setAttribute(name,value);};
  set(roleAttr,role);set(smallAttr,String(small));set(selectedAttr,String(selected));owned.add(svg);
 };
 const scan=node=>{if(node?.nodeType!==1)return;if(node.tagName?.toLowerCase()==='svg')queue.add(node);else if(node.ownerSVGElement)queue.add(node.ownerSVGElement);for(const svg of node.querySelectorAll?.('svg')||[])queue.add(svg);};
 const flush=()=>{raf=0;if(disposed)return;for(const svg of queue)update(svg);queue.clear();for(const svg of owned)if(!svg.isConnected)forget(svg);if(nativeDirty){sheet.replaceSync(css+[...nativeRules.values()].join(''));nativeDirty=false;}};
 const schedule=()=>{if(!raf&&!disposed)raf=requestAnimationFrame(flush);};
 const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='childList'){for(const n of r.addedNodes)scan(n);if(r.target.ownerSVGElement||r.target.tagName?.toLowerCase()==='svg')scan(r.target);}else scan(r.target);}schedule();});
 const root='html[data-dream-skin="active"]';let css=`${root} svg[${roleAttr}]{background-repeat:no-repeat!important;background-position:center!important;background-size:100% 100%!important}${root} svg[${roleAttr}]>:not(title):not(desc){visibility:hidden!important}`;
 for(const role of config.roles){
  const data=config.icons[role],selector=`${root} svg[${roleAttr}="${role}"]`;
  css+=`${selector}{background-image:url("${data.normal}")!important}${selector}[${smallAttr}="true"]{background-image:url("${data.compact}")!important}`;
  css+=`${selector}[${selectedAttr}="true"],${root} :is(button,a,[role="button"],[role="treeitem"]):hover svg[${roleAttr}="${role}"]{background-image:url("${data.selected}")!important}`;
  css+=`${selector}[${selectedAttr}="true"][${smallAttr}="true"],${root} :is(button,a,[role="button"],[role="treeitem"]):hover svg[${roleAttr}="${role}"][${smallAttr}="true"]{background-image:url("${data.compactSelected}")!important}`;
 }
 const sheet=new CSSStyleSheet();sheet.replaceSync(css);document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet];
 const sync=()=>{scan(document.documentElement);flush();};
 window.addEventListener('resize',sync);sync();
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-label','title','aria-expanded','aria-selected','aria-current','data-state','data-settings-panel-slug','d','viewBox','width','height']});
 window[key]={version,fingerprint,id:config.id,sheet,owned,sync,dispose(){disposed=true;observer.disconnect();cancelAnimationFrame(raf);window.removeEventListener('resize',sync);for(const svg of [...owned])forget(svg);document.adoptedStyleSheets=document.adoptedStyleSheets.filter(s=>s!==sheet);delete window[key];}};
 return {installed:true,id:config.id,count:owned.size};
}
export function removeCharacterIcons(){window.__CODEX_CHARACTER_ICONS__?.dispose?.();return {removed:true};}
