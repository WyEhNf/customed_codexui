$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'engine\control.ps1'),[ref]$null,[ref]$null)
foreach($name in @('TestDebugPort','VerifyManaged','WaitManaged')){
 $definition=$ast.Find({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq $name},$true)
 . ([scriptblock]::Create($definition.Extent.Text))
}
$exe='C:\Program Files\WindowsApps\OpenAI.Codex_test\app\ChatGPT.exe'
$date=[datetime]::UtcNow
$owner=[pscustomobject]@{Path=$exe;StartTime=$date}
$state=[pscustomobject]@{port=19337;exe=$exe;ownerPid=123;ownerStarted=$date.Ticks.ToString();browserId='browser-test'}
$script:listeners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=123})
$script:browser='ws://127.0.0.1:19337/devtools/browser/browser-test'
function Get-Process {param($Id) return $owner}
function Get-NetTCPConnection {param($State,$LocalPort) return $script:listeners}
function Invoke-RestMethod {param($Uri,$TimeoutSec) return [pscustomobject]@{webSocketDebuggerUrl=$script:browser}}
if(!(VerifyManaged $state $exe)){throw 'Valid local session rejected'}
$script:listeners[0].LocalAddress='0.0.0.0'
if(VerifyManaged $state $exe){throw 'Public binding accepted'}
$script:listeners[0].LocalAddress='127.0.0.1';$script:listeners[0].OwningProcess=999
if(VerifyManaged $state $exe){throw 'Different owner accepted'}
$script:listeners[0].OwningProcess=123;$script:browser='ws://127.0.0.1:19337/devtools/browser/changed'
if(VerifyManaged $state $exe){throw 'Different browser accepted'}
$script:attempts=0
function VerifyManaged {param($State,$Exe) $script:attempts++;return $script:attempts -ge 3}
$savedTicks=$state.ownerStarted;$state.ownerStarted='stale'
if((WaitManaged $state $exe 2000) -or $script:attempts -ne 0){throw 'Stale process record was unnecessarily retried'}
$state.ownerStarted=$savedTicks
if(!(WaitManaged $state $exe 2000) -or $script:attempts -ne 3){throw 'Startup identity race not retried'}
Write-Output 'PASS: public binding, PID mismatch, browser mismatch rejected; initial binding race retried'
