// Injected fixed code: use the app's own sidebar control once per document.
// Native layout owns the sidebar width; later manual collapse is respected.
export function installDefaultSidebar(){
 const KEY='__CODEX_SIDEBAR_DEFAULT__';
 if(window[KEY])return window[KEY].status;
 let frame=0,timer=0,stopped=false;
 const state={status:'waiting',dispose};
 const observer=new MutationObserver(schedule);
 function stop(){if(stopped)return;stopped=true;observer.disconnect();clearTimeout(timer);if(frame)cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',schedule);}
 function dispose(){stop();if(window[KEY]===state)delete window[KEY];}
 function visible(node){const r=node.getBoundingClientRect(),s=getComputedStyle(node);return !node.disabled&&node.getAttribute('aria-disabled')!=='true'&&!node.closest('[hidden],[inert],[data-app-shell-active-page="false"]')&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;}
 function sync(){
  frame=0;if(stopped||document.visibilityState!=='visible'||document.documentElement.getAttribute('data-dream-skin')!=='active')return;
  const native=[...document.querySelectorAll('button[aria-controls="app-shell-sidebar"]')].filter(visible);
  const buttons=native.length?native:[...document.querySelectorAll('button[aria-label]')].filter(node=>/^(?:显示侧边栏|展开侧边栏|Show sidebar|Expand sidebar|隐藏侧边栏|收起侧边栏|Hide sidebar|Collapse sidebar)$/i.test(node.getAttribute('aria-label'))&&visible(node));
  if(buttons.length!==1)return;
  const button=buttons[0],expanded=button.getAttribute('aria-expanded'),label=button.getAttribute('aria-label')||'';
  if(expanded==='true'||expanded!=='false'&&/^(?:隐藏|收起|Hide|Collapse)/i.test(label)){state.status='already-open';stop();return;}
  if(expanded!=='false'&&!/^(?:显示|展开|Show|Expand)/i.test(label))return;
  state.status='opened';stop();button.click();
 }
 function schedule(){if(!stopped&&!frame)frame=requestAnimationFrame(sync);}
 window[KEY]=state;
 observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-label','aria-expanded','aria-controls','aria-disabled','disabled','hidden','data-dream-skin']});
 document.addEventListener('visibilitychange',schedule);
 timer=setTimeout(()=>{state.status='unavailable';stop();},15000);
 sync();return state.status;
}

export function removeDefaultSidebar(){window.__CODEX_SIDEBAR_DEFAULT__?.dispose();}
