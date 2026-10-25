[CmdletBinding(SupportsShouldProcess=$true)]
param([Parameter(Mandatory=$true)][ValidateSet('Apply','Restore','Reapply')][string]$Action)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
if($WhatIfPreference){Write-Output ('Dry run only: '+$Action+' in '+$projectRoot+'; no files, processes or clients changed.');return}
function FindOfficial {
 $candidates=@(Get-Process ChatGPT -ErrorAction SilentlyContinue|ForEach-Object {try{$_.Path}catch{}}|Select-Object -Unique)
 $candidates+=@(Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue|ForEach-Object {Join-Path $_.InstallLocation 'app\ChatGPT.exe'})
 $config=Join-Path $projectRoot 'machine.json'
 if(Test-Path -LiteralPath $config){$candidates+=((Get-Content -LiteralPath $config -Raw|ConvertFrom-Json).officialExe)}
 foreach($candidate in $candidates){
  if($candidate -and $candidate -match '^[A-Za-z]:\\(?:Program Files\\)?WindowsApps\\OpenAI\.Codex_[^\\]+\\app\\ChatGPT\.exe$' -and (Test-Path -LiteralPath $candidate)){
   $signature=Get-AuthenticodeSignature -LiteralPath $candidate
   if($signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -match 'OpenAI'){return $candidate}
  }
 }
 throw '未找到签名有效的官方客户端。请从官方入口打开一次，然后重试。'
}
function VerifyManaged($state,$official){
 if($null -eq $state -or $state.exe -cne $official -or $state.port -ne 19337 -or $state.browserId -notmatch '^[A-Za-z0-9._-]{1,200}$'){return $null}
 try{
  $owner=Get-Process -Id $state.ownerPid -ErrorAction Stop
  if($owner.Path -cne $official -or $owner.StartTime.ToUniversalTime().Ticks.ToString() -cne $state.ownerStarted){return $null}
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 19337 -ErrorAction Stop)
  if(!$listeners.Count -or @($listeners|Where-Object {$_.OwningProcess -ne $state.ownerPid -or $_.LocalAddress -notin @('127.0.0.1','::1')}).Count){return $null}
  $version=Invoke-RestMethod 'http://127.0.0.1:19337/json/version' -TimeoutSec 2
  if($version.webSocketDebuggerUrl -cne ('ws://127.0.0.1:19337/devtools/browser/'+$state.browserId)){return $null}
  return $owner
 }catch{return $null}
}
try{
 $official=FindOfficial
 $node=Join-Path $projectRoot 'runtime\node.exe'
 if($Action -eq 'Reapply'){
  $file=Join-Path $projectRoot 'state\managed.json'
  if(!(Test-Path -LiteralPath $file)){throw '没有本项目管理的主题会话，请先运行主题入口。'}
  $managed=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
  if($null -eq (VerifyManaged $managed $official)){throw '当前会话身份不匹配，未操作任何客户端。'}
  $token=[Guid]::NewGuid().ToString('N')
  & (Join-Path $projectRoot 'engine\control.ps1') -Action launch -Token $token
  $result=Get-Content -LiteralPath (Join-Path $projectRoot ('state\result-'+$token+'.json')) -Raw -Encoding UTF8|ConvertFrom-Json
  if($result.status -eq 'waiting'){Write-Host $result.detail;return}
  if($result.status -ne 'ready'){throw $result.detail}
  Write-Host '当前主题界面已更新，没有重启客户端。';return
 }
 if($Action -eq 'Apply'){
  $running=@(Get-Process ChatGPT -ErrorAction SilentlyContinue|Where-Object {try{$_.Path -ceq $official}catch{$false}})
  if($running.Count){
   Write-Host '请先完全退出官方 Codex / ChatGPT，再运行本文件。不会自动关闭你的聊天。' -ForegroundColor Yellow
   exit 4
  }
  & $node (Join-Path $projectRoot 'verify-integrity.mjs')
  if($LASTEXITCODE -ne 0){throw '运行文件校验失败，已停止应用。可运行“一键恢复官方原版.cmd”。'}
  Start-Process -FilePath (Join-Path $projectRoot 'SandroneCodex.exe') -WorkingDirectory $projectRoot -WindowStyle Normal|Out-Null
  Write-Host '已打开哥伦比娅 Codex；以后使用独立的“哥伦比娅 Codex”入口。原来的官方入口保持原版。首次隔离会话可能需要你手动登录同一账号。'
  return
 }
 # Recovery intentionally does not depend on the graphical launcher being usable.
 $stateRoot=Join-Path $projectRoot 'state'
 $stateFile=Join-Path $stateRoot 'managed.json'
 $state=$null
 if(Test-Path -LiteralPath $stateFile){
  if((Get-Item -LiteralPath $stateFile).Length -gt 16384){throw '受管会话记录异常，未操作任何进程。请手动退出主题版，然后打开官方客户端。'}
  $state=Get-Content -LiteralPath $stateFile -Raw|ConvertFrom-Json
 }
 $owner=VerifyManaged $state $official
 if($null -ne $owner){
  $token=[Guid]::NewGuid().ToString('N')
  & (Join-Path $projectRoot 'engine\control.ps1') -Action restore -Token $token
  $resultFile=Join-Path $stateRoot ('result-'+$token+'.json')
  $result=Get-Content -LiteralPath $resultFile -Raw -Encoding UTF8|ConvertFrom-Json
  if($result.status -ne 'ready'){throw ('主题移除未获验证：'+$result.detail)}
  # Browser.close is a graceful quit request to this exact verified browser session.
  & $node (Join-Path $projectRoot 'engine\close-managed.mjs') --browser-id $state.browserId
  $deadline=(Get-Date).AddSeconds(10)
  do{
   $open=@(Get-NetTCPConnection -State Listen -LocalPort 19337 -ErrorAction SilentlyContinue|Where-Object {$_.OwningProcess -eq $state.ownerPid})
   if(!$open.Count){break};Start-Sleep -Milliseconds 300
  }while((Get-Date) -lt $deadline)
  if($open.Count){throw '官方外观已恢复，但主题进程未正常退出。请从托盘退出主题版，再打开原来的官方快捷方式；不会强制结束进程。'}
 }elseif($null -ne $state){
  Write-Warning '旧会话身份无法确认，未连接或结束该进程。将打开普通官方入口；仍在运行的主题窗口请手动退出。'
 }
 Start-Process -FilePath $official -WindowStyle Normal|Out-Null
 Write-Host '已请求打开官方原版（不传入主题或远程调试参数）。原始配置和账号数据未迁移或覆盖。'
}catch{
 Write-Host $_.Exception.Message -ForegroundColor Red
 Write-Host '应急恢复：手动退出主题客户端，从原来的官方快捷方式打开。官方安装文件未被改动。'
 exit 1
}
