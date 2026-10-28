// Fixed app code, injected once. Only newly activated native thread scrollers
// receive a bounded initial tail restore; user navigation cancels it immediately.
export function installThreadTail(){
 const KEY='__CODEX_THREAD_TAIL__',version=1;
 if(window[KEY]?.version===version)return true;
 window[KEY]?.dispose?.();
 const threadSelector='.thread-scroll-container,[data-ds-part="thread"]';
 const pageSelector='[data-app-shell-active-page]',mainSelector='[data-ds-part="main"],main[data-app-shell-main-surface],main[class*="_MainContentSurface_"],main.main-surface';
 let current=null,job=null,frame=0,dead=false,resumePending=false;
 const state={version,phase:'idle',activations:0,scrolls:0,reason:null,dispose};
 const visible=node=>{
  if(!node?.isConnected||!node.closest(mainSelector)||node.closest('[hidden],[inert],[data-app-shell-active-page="false"]'))return false;
  const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
  return rect.width>100&&rect.height>80&&rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight&&style.visibility!=='hidden'&&style.display!=='none';
 };
 function finish(reason){
  if(!job)return;
  clearTimeout(job.attempt);clearTimeout(job.first);clearTimeout(job.quiet);clearTimeout(job.limit);
  job.mutations.disconnect();job.resize?.disconnect();job.thread.removeEventListener('load',changed,true);
  job=null;state.phase=reason==='user'?'cancelled':'done';state.reason=reason;
 }
 function begin(thread){
  finish('route');current=thread;resumePending=false;state.activations++;state.phase='waiting';state.reason=null;
  const now=performance.now();
  job={thread,page:thread.closest(pageSelector),started:now,changed:now,attempt:0,first:0,quiet:0,limit:0,native:false,children:new Set(),mutations:new MutationObserver(()=>{watchChildren();changed();}),resize:typeof ResizeObserver==='function'?new ResizeObserver(changed):null};
  job.mutations.observe(thread,{childList:true,subtree:true});
  job.resize?.observe(thread,{box:'border-box'});watchChildren();
  thread.addEventListener('load',changed,true);
  job.first=setTimeout(restore,400);job.limit=setTimeout(()=>finish('timeout'),10000);
  changed();
 }
 function changed(){
  if(!job)return;job.changed=performance.now();clearTimeout(job.attempt);job.attempt=setTimeout(restore,120);
 }
 function watchChildren(){
  if(!job?.resize)return;
  for(const child of job.children)if(child.parentElement!==job.thread){job.resize.unobserve(child);job.children.delete(child);}
  for(const child of [...job.thread.children].slice(0,24))if(!job.children.has(child)){job.children.add(child);job.resize.observe(child,{box:'border-box'});}
 }
 function settle(){
  if(!job)return;
  const now=performance.now(),remaining=Math.max(1200-(now-job.started),350-(now-job.changed));
  if(remaining<=0){finish('ready');return;}
  clearTimeout(job.quiet);job.quiet=setTimeout(settle,remaining+1);
 }
 function restore(){
  if(!job)return;
  const thread=job.thread;
  if(document.hidden){resumePending=true;finish('inactive');return;}
  if(document.documentElement.getAttribute('data-dream-skin')!=='active'||!visible(thread)){finish('inactive');return;}
  const hasContent=thread.scrollHeight>thread.clientHeight+1||thread.querySelector('[data-message-author-role],[data-local-conversation-user-anchor],[data-local-conversation-final-assistant]');
  if(!hasContent)return;
  state.phase='settling';
  if(!job.native&&thread.scrollHeight-thread.clientHeight-thread.scrollTop>2){
   const root=thread.closest('[data-request-input-activity-root]')||thread.parentElement||thread;
   const button=[...root.querySelectorAll('button[aria-label],button[title]')].find(node=>{
    const label=(node.getAttribute('aria-label')||node.getAttribute('title')||'').trim();
    return /^(?:Scroll to bottom|Jump to bottom|Jump to latest|Scroll to latest|滚动(?:到|至)底部|跳(?:转)?(?:到|至)(?:底部|最新(?:消息)?)|回到(?:底部|最新消息))$/i.test(label)&&!node.disabled&&node.getAttribute('aria-disabled')!=='true'&&node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden';
   });
   if(button){job.native=true;button.click();}
   else thread.scrollTo({top:thread.scrollHeight,left:thread.scrollLeft,behavior:'instant'});
   state.scrolls++;
  }
  settle();
 }
 function sweep(){
  frame=0;if(dead)return;
  if(document.hidden){if(job){resumePending=true;finish('inactive');}return;}
  if(document.documentElement.getAttribute('data-dream-skin')!=='active'){finish('inactive');resumePending=false;return;}
  const thread=[...document.querySelectorAll(threadSelector)].find(visible)||null;
  if(thread!==current){if(thread)begin(thread);else{finish('route');current=null;}}
  else if(thread&&resumePending)begin(thread);
 }
 function schedule(){if(!dead&&!frame)frame=requestAnimationFrame(sweep);}
 const routes=new MutationObserver(records=>{
  let relevant=false;
  for(const record of records){
   if(record.type==='attributes'){
    if(record.oldValue===record.target.getAttribute(record.attributeName))continue;
    if(record.attributeName==='data-app-shell-active-page'){
     if(current?.closest(pageSelector)===record.target){finish('route');current=null;}
     relevant=true;
    }else if(record.target===document.documentElement||record.target.matches?.(threadSelector))relevant=true;
    continue;
   }
   // Token streaming cannot trigger whole-document rescans after restoration.
   if(record.target.closest?.(threadSelector))continue;
   for(const node of [...record.addedNodes,...record.removedNodes])if(node.nodeType===1&&(node.matches(threadSelector+','+pageSelector)||node.querySelector(threadSelector))){relevant=true;break;}
  }
  if(relevant)schedule();
 });
 routes.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['data-app-shell-active-page','data-dream-skin','data-ds-part']});
 function interaction(event){
  if(!job)return;
  const target=event.target;
  if(event.type==='keydown'){
   if(!['PageUp','PageDown','Home','End','ArrowUp','ArrowDown',' '].includes(event.key)||target.closest?.('input,textarea,[contenteditable="true"]'))return;
   if(target!==document.body&&target!==document.documentElement&&!job.thread.contains(target))return;
  }else if(!job.thread.contains(target)&&target!==job.thread)return;
  finish('user');
 }
 const events=['wheel','pointerdown','touchstart','keydown'];for(const event of events)document.addEventListener(event,interaction,{capture:true,passive:true});
 function visibility(){if(document.hidden&&job){resumePending=true;finish('inactive');}schedule();}
 document.addEventListener('visibilitychange',visibility);window.addEventListener('pageshow',schedule);
 function dispose(){
  if(dead)return;dead=true;finish('disposed');if(frame)cancelAnimationFrame(frame);routes.disconnect();
  for(const event of events)document.removeEventListener(event,interaction,true);
  document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pageshow',schedule);
  current=null;if(window[KEY]===state)delete window[KEY];
 }
 window[KEY]=state;sweep();return true;
}

export function removeThreadTail(){window.__CODEX_THREAD_TAIL__?.dispose();}
