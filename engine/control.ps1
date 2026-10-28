param([ValidateSet('launch','restore','official','prepare-switch')][string]$Action='launch',[ValidatePattern('^[a-f0-9]{32}$')][string]$Token,[switch]$ActivateWindow,[switch]$PlayOpening)
$ErrorActionPreference='Stop'
$launchClock=[Diagnostics.Stopwatch]::StartNew()
$projectRoot=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'runtime-policy.ps1')
AssertSafeInstallPath $projectRoot
$stateRoot=Join-Path $projectRoot 'state'
ProtectPrivateDirectory $stateRoot $projectRoot
$resultPath=Join-Path $stateRoot ('result-'+$Token+'.json')
$utf8=New-Object System.Text.UTF8Encoding($false)
function Result($status,$message,$detail){
 $temp=$resultPath+'.tmp'
 [IO.File]::WriteAllText($temp,(@{status=$status;message=$message;detail=$detail;elapsedMs=$launchClock.ElapsedMilliseconds}|ConvertTo-Json -Compress),$utf8)
 Move-Item -LiteralPath $temp -Destination $resultPath -Force
}
function TestOfficialExecutable([string]$Path){
 if(!$Path -or $Path -notmatch '^[A-Za-z]:\\(?:Program Files\\)?WindowsApps\\OpenAI\.Codex_\d+\.\d+\.\d+\.\d+_(?:x64|arm64)__2p2nqsd0c76g0\\app\\ChatGPT\.exe$' -or !(Test-Path -LiteralPath $Path -PathType Leaf)){return $false}
 $sig=Get-AuthenticodeSignature -LiteralPath $Path
 return ($sig.Status -eq 'Valid' -and $sig.SignerCertificate.Subject -match 'OpenAI')
}
function OfficialExe {
 # The registered package wins over still-running binaries retired by Store.
 $candidates=@(Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Sort-Object {[version]$_.Version} -Descending | ForEach-Object {Join-Path $_.InstallLocation 'app\ChatGPT.exe'})
 $candidates+=@(Get-Process ChatGPT -ErrorAction SilentlyContinue | ForEach-Object {try{$_.Path}catch{}} | Select-Object -Unique)
 $machine=Join-Path $projectRoot 'machine.json'
 if(Test-Path -LiteralPath $machine){try{$candidates+=((Get-Content -LiteralPath $machine -Raw|ConvertFrom-Json).officialExe)}catch{}}
 foreach($p in $candidates){
  if(!(TestOfficialExecutable $p)){continue}
  $manifest=Join-Path (Split-Path (Split-Path $p -Parent) -Parent) 'AppxManifest.xml'
  if(Test-Path -LiteralPath $manifest -PathType Leaf){return $p}
 }
 throw '未找到完整且签名有效的官方 Store 安装包，请从 Microsoft Store 修复或更新 Codex。'
}
function NodeExe {
 $p=Join-Path $projectRoot 'runtime\node.exe'
 if(!(Test-Path -LiteralPath $p)){throw '缺少本机 Node 运行时，请重新部署。'}
 return $p
}
function TestDebugPort($port){
 return (($port -is [int] -or $port -is [long]) -and $port -ge 1024 -and $port -le 65535)
}
function SelectDebugPort {
 [CmdletBinding()]param()
 $listener=New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0)
 $listener.ExclusiveAddressUse=$true
 try{$listener.Start();return [int]$listener.LocalEndpoint.Port}
 catch [Net.Sockets.SocketException]{throw '无法分配本机随机调试端口。'}
 finally{$listener.Stop()}
}
function GetProcessProfile([string]$commandLine){
 $pattern='(?i)(?:^|\s)(?:"--user-data-dir=(?<whole>[^"]+)"|--user-data-dir(?:=|\s+)(?:"(?<quoted>[^"]+)"|(?<bare>[^\s"]+)))'
 $profileArguments=[regex]::Matches($commandLine,$pattern)
 if($profileArguments.Count -ne 1){return $null}
 $match=$profileArguments[0]
 foreach($name in @('whole','quoted','bare')){if($match.Groups[$name].Success){
  $value=$match.Groups[$name].Value
  if(![IO.Path]::IsPathRooted($value)){return $null}
  try{return [IO.Path]::GetFullPath($value).TrimEnd('\')}catch{return $null}
 }}
 return $null
}
function FindThemeOwner([string]$exe,[string]$profile){
 $expected=[IO.Path]::GetFullPath($profile).TrimEnd('\')
 $expectedExe=[IO.Path]::GetFullPath($exe)
 foreach($process in @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" -ErrorAction Stop)){
  # CIM can retain a process that exited during enumeration, with missing
  # identity fields. Only an OS-confirmed missing PID may be ignored.
  try{$null=Get-Process -Id $process.ProcessId -ErrorAction Stop}
  catch{if($_.CategoryInfo.Category -eq [Management.Automation.ErrorCategory]::ObjectNotFound){continue}}
  if(!$process.ExecutablePath -or [string]::IsNullOrWhiteSpace($process.CommandLine)){
   [pscustomobject]@{Id=$process.ProcessId;Kind='unknown'};continue
  }
  try{$actualExe=[IO.Path]::GetFullPath($process.ExecutablePath)}catch{[pscustomobject]@{Id=$process.ProcessId;Kind='unknown'};continue}
  $sameFamily=$actualExe -match '^[A-Za-z]:\\(?:Program Files\\)?WindowsApps\\OpenAI\.Codex_\d+\.\d+\.\d+\.\d+_(?:x64|arm64)__2p2nqsd0c76g0\\app\\ChatGPT\.exe$'
  if((![string]::Equals($actualExe,$expectedExe,[StringComparison]::OrdinalIgnoreCase) -and !$sameFamily) -or $process.CommandLine -match '(?i)(?:^|\s)--type(?:=|\s)'){continue}
  $actual=GetProcessProfile $process.CommandLine
  if($actual -and [string]::Equals($actual,$expected,[StringComparison]::OrdinalIgnoreCase)){
   [pscustomobject]@{Id=$process.ProcessId;Kind='theme'}
  }elseif(!$actual -and $process.CommandLine -match '(?i)--user-data-dir'){
   [pscustomobject]@{Id=$process.ProcessId;Kind='unknown'}
  }
 }
}
function GetManaged {
 $file=Join-Path $stateRoot 'managed.json'
 if(!(Test-Path $file)){return $null}
 return (Get-Content $file -Raw|ConvertFrom-Json)
}
function ImportWindowing {
 $dll=Join-Path $projectRoot 'engine\Sandrone.Windowing.dll'
 $hashes=Get-Content -LiteralPath (Join-Path $projectRoot 'integrity.json') -Raw|ConvertFrom-Json
 $expected=$hashes.PSObject.Properties['engine/Sandrone.Windowing.dll'].Value
 if(!$expected -or (Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash -ine $expected){throw '窗口组件校验失败，未加载组件。'}
 if(!('SandroneCodex.NativeWindow' -as [type])){Add-Type -Path $dll}
}
function VerifyManaged($state,$exe){
 if($null -eq $state -or !(TestDebugPort $state.port) -or $state.exe -cne $exe){return $false}
 try {
  $proc=Get-Process -Id $state.ownerPid -ErrorAction Stop
  if($proc.Path -cne $exe -or $proc.StartTime.ToUniversalTime().Ticks.ToString() -cne $state.ownerStarted){return $false}
  if($projectRoot -and (Test-Path -LiteralPath (Join-Path $projectRoot 'engine\Sandrone.Windowing.dll'))){
   ImportWindowing
   if(![SandroneCodex.NativeWindow]::OwnsLoopbackListener([int]$state.port,[uint32]$state.ownerPid)){return $false}
  }else{
   $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $state.port -ErrorAction Stop)
   if(!$listeners.Count -or @($listeners|Where-Object {$_.LocalAddress -notin @('127.0.0.1','::1') -or $_.OwningProcess -ne $state.ownerPid}).Count){return $false}
  }
  $version=Invoke-RestMethod ('http://127.0.0.1:{0}/json/version' -f $state.port) -TimeoutSec 2
  $u=[uri]$version.webSocketDebuggerUrl
  return ($u.Scheme -eq 'ws' -and $u.Host -eq '127.0.0.1' -and $u.Port -eq $state.port -and !$u.UserInfo -and !$u.Query -and !$u.Fragment -and $u.AbsolutePath -eq ('/devtools/browser/'+$state.browserId))
 }catch{return $false}
}
function Inject($node,$verb,$state){
 # Windows PowerShell 5 turns native stderr into a terminating error under Stop.
 # A renderer starting/reloading is expected: let the caller retry by exit code.
 $ErrorActionPreference='Continue'
 $injectArgs=@((Join-Path $projectRoot 'vendor\dream-skin\windows\scripts\injector.mjs'),$verb,'--port',[string]$state.port,'--browser-id',$state.browserId,'--theme-dir',(Join-Path $projectRoot 'themes\sandrone'),'--timeout-ms','8000')
 $output=& $node @injectArgs 2>&1
 $ok=$LASTEXITCODE -eq 0
 # Upstream output may contain local UI details; retain only exit status in this launcher log.
 return $ok
}
function WaitManaged($state,$exe,[int]$timeoutMs=4000){
 if($null -eq $state){return $false}
 # A stale process record is not a startup race; do not spend seconds retrying it.
 try{$owner=Get-Process -Id $state.ownerPid -ErrorAction Stop;if($state.exe -cne $exe -or $owner.Path -cne $exe -or $owner.StartTime.ToUniversalTime().Ticks.ToString() -cne $state.ownerStarted){return $false}}catch{return $false}
 $clock=[Diagnostics.Stopwatch]::StartNew()
 do{if(VerifyManaged $state $exe){return $true};Start-Sleep -Milliseconds 150}while($clock.ElapsedMilliseconds -lt $timeoutMs)
 return $false
}
function NativeUi($node,$verb,$state){
 $ErrorActionPreference='Continue'
 $nativeOutput=& $node (Join-Path $projectRoot 'engine\session.mjs') $verb --browser-id $state.browserId 2>&1
 $script:NativeExitCode=$LASTEXITCODE
 $script:NativeFailure=''
 if($script:NativeExitCode -ne 0 -and $script:NativeExitCode -ne 2){
  $script:NativeFailure=($nativeOutput|ForEach-Object {$_.ToString()}) -join [Environment]::NewLine
  $entry=('{0:o} {1} exit={2}' -f [DateTime]::UtcNow,$verb,$script:NativeExitCode)+[Environment]::NewLine+$script:NativeFailure+[Environment]::NewLine
  [IO.File]::AppendAllText((Join-Path $stateRoot 'native-error.log'),$entry,(New-Object Text.UTF8Encoding($false)))
 }
 return ($script:NativeExitCode -eq 0)
}
function ActivateManaged($state,$exe){
 $owner=Get-Process -Id $state.ownerPid -ErrorAction Stop
 if($owner.Path -cne $exe -or $owner.StartTime.ToUniversalTime().Ticks.ToString() -cne $state.ownerStarted){throw '窗口进程身份已变化，未操作窗口。'}
 $dll=Join-Path $projectRoot 'engine\Sandrone.Windowing.dll'
 $hashes=Get-Content -LiteralPath (Join-Path $projectRoot 'integrity.json') -Raw|ConvertFrom-Json
 $expected=$hashes.PSObject.Properties['engine/Sandrone.Windowing.dll'].Value
 if(!$expected -or (Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash -ine $expected){throw '窗口恢复组件校验失败，未加载组件。'}
 if(!('SandroneCodex.NativeWindow' -as [type])){Add-Type -Path $dll}
 return [SandroneCodex.NativeWindow]::Activate([uint32]$state.ownerPid,$true)
}
function ShowManagedClient($state,$exe,[int]$timeoutMs=8000){
 if(!(VerifyManaged $state $exe)){throw '窗口恢复前会话身份已变化，未操作其他客户端。'}
 $node=NodeExe
 if((ActivateManaged $state $exe) -and (NativeUi $node '--main-visible' $state)){return}
 if(NativeUi $node '--show-main' $state){
  $clock=[Diagnostics.Stopwatch]::StartNew()
  do{
   if(NativeUi $node '--main-visible' $state){return}
   Start-Sleep -Milliseconds 150
  }while($clock.ElapsedMilliseconds -lt [math]::Min($timeoutMs,2000))
 }
 # Closing the last native window can leave Electron and its renderer alive.
 # Re-send the exact profile to Electron's single-instance entry point so it
 # creates a new window in this session instead of reporting hidden readiness.
 $manifest=Join-Path ([IO.Directory]::GetParent([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($exe))).FullName) 'AppxManifest.xml'
 if(!(Test-Path -LiteralPath $manifest -PathType Leaf)){throw '旧版 Codex 后台仍占用主题配置，但安装组件已被 Store 更新移除，无法重新启动旧版。请先退出旧主题后台，再从桌面入口启动当前版本；对话与配置已保留。'}
 $profile=Join-Path $projectRoot 'profile'
 $arguments=@('--remote-debugging-address=127.0.0.1',('--remote-debugging-port='+$state.port),('--user-data-dir="'+$profile+'"'))
 $request=StartCodexClient -Exe $exe -Arguments $arguments -Root $projectRoot -Isolated
 try{
  $clock=[Diagnostics.Stopwatch]::StartNew()
  do{
   if((ActivateManaged $state $exe) -and (NativeUi $node '--main-visible' $state)){if(!(VerifyManaged $state $exe)){throw '恢复后的窗口会话身份不匹配。'};return}
   Start-Sleep -Milliseconds 150
  }while($clock.ElapsedMilliseconds -lt $timeoutMs)
 }finally{if($request -is [IDisposable]){$request.Dispose()}}
 throw '主题后台会话仍在运行，但主窗口未能恢复。请从任务栏退出主题客户端后重新打开；未关闭其他窗口。'
}
function EnsureWatcher($node,$state){
 # Window activation is performed only for explicit desktop launches, before waiting.
 $sessionScript=Join-Path $projectRoot 'engine\session.mjs'
 # The watcher caches the validated theme payload as well as fixed UI code.
 # Refresh it on theme edits so it cannot reapply yesterday's text/style.
 $revisionFiles=@('engine/renderer.mjs','engine/session.mjs','engine/native-viewport.mjs','engine/sidebar-default.mjs','engine/thread-tail.mjs','engine/assets.mjs','engine/cdp.mjs','engine/target-runner.mjs','engine/watch-signal.mjs','engine/runtime-cache.mjs','engine/watcher-targets.mjs','engine/native-ui.css','engine/control.ps1','themes/sandrone/theme.json','themes/sandrone/theme.css','themes/sandrone/manifest.json','themes/sandrone/background.png','assets/ui/personality.json','integration/embedded-ui.mjs','integration/embedded-bridge.mjs','integration/character-icons.mjs','integration/material-ui.mjs','integration/workspace-background.mjs','assets/ui/workspace-foreground.png','assets/ui/workspace-frame.svg','integration/icon-contract.json','integration/switch.mjs','integration/decorators.mjs','integration/selection.mjs','integration/coordinator.mjs','integration/transaction-gc.mjs','catalog.json')
 $revision=($revisionFiles|ForEach-Object {(Get-FileHash -LiteralPath (Join-Path $projectRoot $_) -Algorithm SHA256).Hash}) -join ''
 if($state.watcherPid){
  try{
   $processInfo=Get-CimInstance Win32_Process -Filter ('ProcessId='+$state.watcherPid)
   $watchProcess=Get-Process -Id $state.watcherPid
   if($processInfo.ExecutablePath -ceq $node -and $processInfo.CommandLine.Contains($sessionScript) -and $processInfo.CommandLine.Contains($state.browserId) -and $watchProcess.StartTime.ToUniversalTime().Ticks.ToString() -ceq $state.watcherStarted){
    if($state.watcherRevision -ceq $revision){return}
    # Reload our verified Node watcher when fixed engine code changes; never stop Codex.
    Stop-Process -Id $watchProcess.Id -ErrorAction Stop
   }
  }catch{}
 }
 $watchArgs=@(('"'+$sessionScript+'"'),'--watch','--browser-id',$state.browserId)
 # Redirect both streams: the long-lived watcher must not keep the launcher
 # worker's captured stdout pipe open after the control command has finished.
 $watchProcess=Start-Process -FilePath $node -ArgumentList $watchArgs -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $stateRoot 'watcher-error.log') -RedirectStandardOutput (Join-Path $stateRoot 'watcher-output.log')
 Start-Sleep -Milliseconds 300
 if($watchProcess.HasExited){
  $watchFailure=''
  $watchErrorFile=Join-Path $stateRoot 'watcher-error.log'
  if(Test-Path -LiteralPath $watchErrorFile){$watchFailure=Get-Content -LiteralPath $watchErrorFile -Raw -Encoding UTF8}
  throw ('主题监视进程提前结束。详情已保存到 state\watcher-error.log。'+[Environment]::NewLine+$watchFailure)
 }
 $state|Add-Member -NotePropertyName watcherPid -NotePropertyValue $watchProcess.Id -Force
 $state|Add-Member -NotePropertyName watcherStarted -NotePropertyValue $watchProcess.StartTime.ToUniversalTime().Ticks.ToString() -Force
 $state|Add-Member -NotePropertyName watcherRevision -NotePropertyValue $revision -Force
 $state|ConvertTo-Json|Set-Content (Join-Path $stateRoot 'managed.json') -Encoding UTF8
}
function PrepareCharacterSwitch($node,$state,$exe){
 if(!(VerifyManaged $state $exe)){throw '无法确认主题会话身份，已保留当前外观。'}
 $watcher=$null;$watchProcess=$null
 if($state.watcherPid){
  $watcher=Get-CimInstance Win32_Process -Filter ('ProcessId='+$state.watcherPid) -ErrorAction SilentlyContinue
  if($watcher){
   $watchProcess=Get-Process -Id $state.watcherPid -ErrorAction Stop
   $knownWatcher=$watcher.CommandLine -and ($watcher.CommandLine.Contains((Join-Path $projectRoot 'engine\session.mjs')) -or $watcher.CommandLine.Contains((Join-Path $projectRoot 'vendor\dream-skin\windows\scripts\injector.mjs')))
   if(!$knownWatcher -or $watcher.ExecutablePath -cne $node -or $watchProcess.StartTime.ToUniversalTime().Ticks.ToString() -cne $state.watcherStarted){throw '主题监视进程身份不匹配，已保留当前外观。'}
  }
 }
 $pausePath=Join-Path $stateRoot 'paused'
 [IO.File]::WriteAllText($pausePath,'character-switch',$utf8)
 try{if($watcher){Stop-Process -Id $watchProcess.Id -ErrorAction Stop}}
 catch{Remove-Item -LiteralPath $pausePath -ErrorAction SilentlyContinue;throw}
 # Stop only the verified background watcher. Leave the live renderer, styles,
 # menu and media intact; never invoke upstream --remove for a character switch.
}
function StopManagedWatcher($node,$state){
 if(!$state.watcherPid){return}
 $watcher=Get-CimInstance Win32_Process -Filter ('ProcessId='+$state.watcherPid) -ErrorAction SilentlyContinue
 if(!$watcher){return}
 $process=Get-Process -Id $state.watcherPid -ErrorAction Stop
 $known=$watcher.CommandLine -and ($watcher.CommandLine.Contains((Join-Path $projectRoot 'engine\session.mjs')) -or $watcher.CommandLine.Contains((Join-Path $projectRoot 'vendor\dream-skin\windows\scripts\injector.mjs')))
 if(!$known -or $watcher.ExecutablePath -cne $node -or $process.StartTime.ToUniversalTime().Ticks.ToString() -cne $state.watcherStarted){throw '主题监视进程身份不匹配，未结束进程。'}
 Stop-Process -Id $process.Id -ErrorAction Stop
}
function CloseManagedClient($node,$state,$exe){
 if(!(VerifyManaged $state $exe)){throw '退出前会话身份发生变化，未连接其他客户端。'}
 $ErrorActionPreference='Continue'
 $output=& $node (Join-Path $projectRoot 'engine\close-managed.mjs') --browser-id $state.browserId 2>&1
 $closeExitCode=$LASTEXITCODE
 # Chromium can drop its debugger socket while quitting. The verified owner
 # and listener disappearing prove shutdown even if the helper reports EOF.
 $deadline=[DateTime]::UtcNow.AddSeconds(10)
 do{
  $owner=Get-Process -Id $state.ownerPid -ErrorAction SilentlyContinue
  $alive=$owner -and $owner.StartTime.ToUniversalTime().Ticks.ToString() -ceq $state.ownerStarted
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort $state.port -ErrorAction SilentlyContinue|Where-Object {$_.OwningProcess -eq $state.ownerPid})
  if(!$alive -and !$listeners.Count){return}
  Start-Sleep -Milliseconds 200
 }while([DateTime]::UtcNow -lt $deadline)
 if($closeExitCode -ne 0){
  $cause=($output|ForEach-Object {$_.ToString()}|Select-Object -First 4) -join [Environment]::NewLine
  if($cause.Length -gt 800){$cause=$cause.Substring(0,800)}
  throw ('主题客户端尚未正常退出。退出组件返回 '+$closeExitCode+'；请关闭主题窗口后重试。'+[Environment]::NewLine+$cause)
 }
 throw '主题客户端尚未正常退出，调试端口可能仍在使用。请手动退出；未强制结束进程。'
}
$mutex=New-Object Threading.Mutex($false,'Local\SandroneCodex.Control')
$locked=$false
try {
 $locked=$mutex.WaitOne(0)
 if(!$locked){if($Action -eq 'launch'){Result 'ready' '启动正在进行' '已合并重复启动请求，请查看官方窗口。';exit 0};Result 'blocked' '另一项启动器操作正在运行' '请等待完成后重试。';exit 2}
 $exe=OfficialExe
 $state=GetManaged
 $managedExe=$null
 if($state -and (TestOfficialExecutable $state.exe)){$managedExe=$state.exe}
 if($Action -eq 'official'){
  StartCodexClient -Exe $exe -Root $projectRoot | Out-Null
  Result 'ready' '已请求打开官方原版' '使用原有登录与配置；未开启新的调试端口。';exit 0
 }
 if($Action -eq 'restore'){
  if($null -eq $state){StartCodexClient -Exe $exe -Root $projectRoot|Out-Null;Result 'ready' '已请求打开官方原版' '当前没有受管主题会话；未打开调试端口。';exit 0}
  # Stale state must never reconnect to a different process at a recycled port.
  $owner=Get-Process -Id $state.ownerPid -ErrorAction SilentlyContinue
  if(!$owner){Remove-Item -LiteralPath (Join-Path $stateRoot 'managed.json') -ErrorAction Stop;StartCodexClient -Exe $exe -Root $projectRoot|Out-Null;Result 'ready' '已请求打开官方原版' '旧主题进程已退出；清理了过期会话记录。';exit 0}
  if(!$managedExe -or !(VerifyManaged $state $managedExe)){Result 'blocked' '无法确认主题会话身份' '未操作任何进程。请关闭主题窗口后，从官方快捷方式重开。';exit 3}
  [IO.File]::WriteAllText((Join-Path $stateRoot 'paused'),'paused',$utf8)
  $node=NodeExe
  try{
   StopManagedWatcher $node $state
   # Closing the exact owned browser also removes the injected UI. A changed
   # upstream DOM must not prevent recovery from shutting its debugger down.
   CloseManagedClient $node $state $managedExe
  }catch{
   $closeFailure=$_
   # A refused/timed-out quit must not strand a living theme without its watcher.
   if(VerifyManaged $state $managedExe){
    Remove-Item -LiteralPath (Join-Path $stateRoot 'paused') -ErrorAction SilentlyContinue
    try{EnsureWatcher $node $state}catch{}
   }
   throw $closeFailure
  }
  Remove-Item -LiteralPath (Join-Path $stateRoot 'managed.json') -ErrorAction Stop
  Remove-Item -LiteralPath (Join-Path $stateRoot 'early-scripts.json') -ErrorAction SilentlyContinue
  StartCodexClient -Exe $exe -Root $projectRoot|Out-Null
  Result 'ready' '已退出主题会话并打开官方原版' '已验证主题进程退出及其调试端口释放；主题登录和 agent 数据仍保留在独立目录。';exit 0
 }
 $reusing=$managedExe -and (WaitManaged $state $managedExe 2500)
 $activeExe=if($reusing){$managedExe}else{$exe}
 $clientInfo=GetCodexClientInfo $activeExe -RetiredSession:$reusing
 $policy=AssertClientCompatibility $clientInfo $projectRoot
 $storage=GetCodexAgentStorage $projectRoot
 $node=NodeExe
 if($Action -eq 'prepare-switch'){
  if($state.storageVersion -ne 2 -or $state.agentHome -ine $storage.agentHome -or ($state.sqliteHome -and $state.sqliteHome -ine $storage.sqliteHome)){Result 'blocked' '数据目录变更需要重新启动' '请完全退出主题窗口后重新打开，以加载已保存的对话目录。';exit 4}
  PrepareCharacterSwitch $node $state $activeExe
  Result 'ready' '角色切换已准备' '旧主题保持显示，等待在开屏内接入新主题。';exit 0
 }
 if($reusing){
  if($state.storageVersion -ne 2 -or $state.agentHome -ine $storage.agentHome -or ($state.sqliteHome -and $state.sqliteHome -ine $storage.sqliteHome)){Result 'blocked' '数据目录变更需要重新启动' '请完全退出主题窗口后重新打开，以加载已保存的对话目录。';exit 4}
  if($ActivateWindow){ShowManagedClient $state $activeExe}
  AssertRuntimeStorageSpace $projectRoot $storage
  Remove-Item -LiteralPath (Join-Path $stateRoot 'paused') -ErrorAction SilentlyContinue
  $resumeVerb=if($PlayOpening){'--start'}elseif($ActivateWindow){'--ready'}else{'--resume'}
  if(NativeUi $node $resumeVerb $state){EnsureWatcher $node $state;Result 'ready' '已连接角色主题窗口' '已复用原会话并请求显示窗口；未重启客户端。';exit 0}
  if($script:NativeExitCode -eq 2){EnsureWatcher $node $state;Result 'waiting' 'Codex 已打开，正在等待可见主界面' '请完成登录或展开窗口，主题会在界面就绪后自动接入，不必重复启动。';exit 0}
  throw ('现有主题窗口未通过 renderer 验证。详情已保存到 state\native-error.log。'+[Environment]::NewLine+$script:NativeFailure)
 }
 AssertRuntimeStorageSpace $projectRoot $storage
 $themeProfile=Join-Path $projectRoot 'profile'
 ProtectPrivateDirectory $themeProfile $projectRoot
 $existing=@(FindThemeOwner $exe $themeProfile)
 if($existing.Count){
  $detail=if(@($existing|Where-Object {$_.Kind -eq 'unknown'}).Count){'无法确认现有客户端使用的配置目录；已保留现有会话。请退出该实例后重试。'}else{'主题配置目录已有客户端，但管理信息不匹配。请退出该主题窗口后重试；其他普通 Codex 无需退出。'}
  Result 'blocked' '现有主题实例需要重新连接' $detail;exit 4
 }
 ImportWindowing
 $debugPort=SelectDebugPort
 $theme=Join-Path $projectRoot 'themes\sandrone'
 & $node (Join-Path $projectRoot 'verify-integrity.mjs')
 if($LASTEXITCODE -ne 0){throw '运行文件完整性校验失败。'}
 foreach($old in @(Get-ChildItem -LiteralPath $stateRoot -Directory -Force|Where-Object {$_.Name -cmatch '^validate-[a-f0-9]{32}$'})){RemoveValidationStage $old.FullName $stateRoot}
 $framework=Get-Content -LiteralPath (Join-Path $projectRoot 'vendor\dream-skin\SOURCE.json') -Raw -Encoding UTF8|ConvertFrom-Json
 InvokeThemeValidation $node $theme $projectRoot $stateRoot $Token $framework.version
 Result 'loading' '正在启动主题会话…' '正在加载已保存的数据目录与对话记录。'
 $owner=StartCodexClient -Exe $exe -Arguments @('--remote-debugging-address=127.0.0.1',('--remote-debugging-port='+$debugPort),('--user-data-dir="'+$themeProfile+'"')) -Root $projectRoot -Isolated
 $deadline=(Get-Date).AddSeconds(25);$version=$null
 do {
  try{$version=Invoke-RestMethod ('http://127.0.0.1:{0}/json/version' -f $debugPort) -TimeoutSec 1}catch{}
  if(!$version){Start-Sleep -Milliseconds 350}
 }while(!$version -and (Get-Date) -lt $deadline -and !$owner.HasExited)
 if(!$version){if($owner.HasExited){throw '主题启动进程已退出，未连接其他客户端。请关闭占用同一主题配置的实例后重试。'};throw '主题客户端未提供本次启动的本机接口。请稍后重试；不会连接占用旧端口的其他进程。'}
 $u=[uri]$version.webSocketDebuggerUrl
 if($u.Scheme -ne 'ws' -or $u.Host -ne '127.0.0.1' -or $u.Port -ne $debugPort -or $u.UserInfo -or $u.Query -or $u.Fragment -or $u.AbsolutePath -notmatch '^/devtools/browser/([A-Za-z0-9._-]{1,200})$'){throw '调试接口身份无效。'}
 $state=[pscustomobject]@{port=$debugPort;browserId=$Matches[1];ownerPid=$owner.Id;ownerStarted=$owner.StartTime.ToUniversalTime().Ticks.ToString();exe=$exe;storageVersion=2;agentHome=$storage.agentHome;sqliteHome=$storage.sqliteHome;appVersion=$clientInfo.appVersion;electronVersion=$clientInfo.electronVersion}
 $state|ConvertTo-Json|Set-Content (Join-Path $stateRoot 'managed.json') -Encoding UTF8
 if(!(WaitManaged $state $exe 6000)){throw '调试端口未通过进程及回环绑定校验。请关闭本次主题窗口。'}
 Remove-Item -LiteralPath (Join-Path $stateRoot 'paused') -ErrorAction SilentlyContinue
 Result 'loading' '正在接入同窗动画与主题…' '请查看官方窗口；登录等待不会再重复启动检测进程。'
 $ready=NativeUi $node '--start' $state
 if(!$ready -and $script:NativeExitCode -ne 2){throw ('主题组件应用失败。详情已保存到 state\native-error.log。'+[Environment]::NewLine+$script:NativeFailure)}
 EnsureWatcher $node $state
 if(!$ready){Result 'waiting' 'Codex 已打开，正在等待主界面' '请完成登录或展开窗口；主题监视器会自动接入，无需反复打开启动器。';exit 0}
 Result 'ready' '哥伦比娅主题已就绪' '官方 renderer 已通过上游可见窗口验证。'
}catch{Result 'error' '主题启动未完成' $_.Exception.Message;exit 1}
finally{if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
