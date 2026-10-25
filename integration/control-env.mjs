// Windows PowerShell must initialize its own module path. A Node process started
// by PowerShell 7 otherwise forwards incompatible built-in module directories.
export function windowsPowerShellEnv(source=process.env){
 const env={...source};for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];return env;
}
