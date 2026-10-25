// Reload/target events wake the idle watcher immediately. Coalesce event bursts
// and retain wakeups arriving while apply is still in flight.
export function watchSignal(){
 let pending=false,release=null,timer=null;
 return {
  wake(){pending=true;if(release){const done=release;release=null;clearTimeout(timer);done();}},
  async wait(ms){if(pending){pending=false;return;}await new Promise(resolve=>{release=resolve;timer=setTimeout(()=>{release=null;resolve();},ms);});pending=false;},
  dispose(){clearTimeout(timer);release?.();release=null;}
 };
}
