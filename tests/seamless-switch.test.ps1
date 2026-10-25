$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'engine\control.ps1'),[ref]$null,[ref]$null)
$definition=$ast.Find({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq 'PrepareCharacterSwitch'},$true)
. ([scriptblock]::Create($definition.Extent.Text))
$projectRoot=Join-Path ([IO.Path]::GetTempPath()) ('CodexUI-seamless-test-'+[Guid]::NewGuid().ToString('N'))
$stateRoot=Join-Path $projectRoot 'state'
$null=New-Item -ItemType Directory -Path $stateRoot -Force
$utf8=New-Object Text.UTF8Encoding($false)
$node='verified-node.exe';$date=[datetime]::UtcNow
$state=[pscustomobject]@{watcherPid=42;watcherStarted=$date.Ticks.ToString()}
$script:verified=$true;$script:stops=@();$script:foreign=$false;$script:stopFailure=$false
function VerifyManaged {param($record,$exe) return $script:verified}
function Get-CimInstance {param($ClassName,$Filter,$ErrorAction) return [pscustomobject]@{ExecutablePath=if($script:foreign){'foreign.exe'}else{$node};CommandLine=(Join-Path $projectRoot 'engine\session.mjs')+' --watch --browser-id fixture'}}
function Get-Process {param($Id,$ErrorAction) return [pscustomobject]@{Id=$Id;StartTime=$date}}
function Stop-Process {param($Id,$ErrorAction) if($script:stopFailure){throw 'fixture stop failed'};$script:stops+=@($Id)}
function NativeUi {throw 'Seamless switch must not remove or mutate renderer'}
function Inject {throw 'Seamless switch must not invoke upstream pause/remove'}
try{
 PrepareCharacterSwitch $node $state 'verified-app.exe'
 if($script:stops.Count -ne 1 -or $script:stops[0] -ne 42){throw 'Only the verified watcher may be stopped'}
 if((Get-Content -LiteralPath (Join-Path $stateRoot 'paused') -Raw) -ne 'character-switch'){throw 'Watcher suspension marker missing'}
 Remove-Item -LiteralPath (Join-Path $stateRoot 'paused')
 $script:verified=$false;$blocked=$false
 try{PrepareCharacterSwitch $node $state 'verified-app.exe'}catch{$blocked=$true}
 if(!$blocked -or $script:stops.Count -ne 1 -or (Test-Path -LiteralPath (Join-Path $stateRoot 'paused'))){throw 'Session identity guard failed'}
 $script:verified=$true;$script:foreign=$true;$blocked=$false
 try{PrepareCharacterSwitch $node $state 'verified-app.exe'}catch{$blocked=$true}
 if(!$blocked -or $script:stops.Count -ne 1 -or (Test-Path -LiteralPath (Join-Path $stateRoot 'paused'))){throw 'Watcher identity guard failed'}
 $script:foreign=$false;$script:stopFailure=$true;$blocked=$false
 try{PrepareCharacterSwitch $node $state 'verified-app.exe'}catch{$blocked=$true}
 if(!$blocked -or (Test-Path -LiteralPath (Join-Path $stateRoot 'paused'))){throw 'Failed stop left the watcher paused'}
 Write-Output 'PASS: character switch keeps live styles, never invokes pause/remove, stops verified watcher only, validates identities, cleans up failed stop'
}finally{
 $checked=[IO.Path]::GetFullPath($projectRoot);$temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
 if($checked.StartsWith($temp,[StringComparison]::OrdinalIgnoreCase) -and (Split-Path $checked -Leaf) -like 'CodexUI-seamless-test-*'){Remove-Item -LiteralPath $checked -Recurse -Force}
}
