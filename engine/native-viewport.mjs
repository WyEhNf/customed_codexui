// A canceled CDP recording may leave emulation/capture state on WebContents.
// Restore the native viewport once when the theme takes ownership. Never poll,
// resize the OS window, reset the user's browser zoom, or interfere with a
// recording deliberately started after the watcher has attached.
export function createNativeViewportReset(){
 const prepared=new Set(),pending=new Map();
 return {
  async prepare(id,session){
   if(prepared.has(id))return false;
   if(pending.has(id)){await pending.get(id);return false;}
   const job=(async()=>{
    await session.send('Page.stopScreencast');
    await session.send('Emulation.clearDeviceMetricsOverride');
    await session.send('Emulation.setFocusEmulationEnabled',{enabled:false});
    prepared.add(id);
   })();
   pending.set(id,job);
   try{await job;return true;}finally{pending.delete(id);}
  },
  forget(id){prepared.delete(id);},
 };
}
