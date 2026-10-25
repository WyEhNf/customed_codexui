$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'engine\control.ps1'),[ref]$null,[ref]$null)
$definition=$ast.Find({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq 'ActivateManaged'},$true)
. ([scriptblock]::Create($definition.Extent.Text))
$projectRoot=Join-Path $root 'evidence\activation-guards'
$null=New-Item -ItemType Directory -Path (Join-Path $projectRoot 'engine') -Force
[IO.File]::WriteAllText((Join-Path $projectRoot 'engine\Sandrone.Windowing.dll'),'inert test fixture')
[IO.File]::WriteAllText((Join-Path $projectRoot 'integrity.json'),'{"engine/Sandrone.Windowing.dll":"0000000000000000000000000000000000000000000000000000000000000000"}')
$date=[datetime]::UtcNow;$owner=[pscustomobject]@{Path='verified-app.exe';StartTime=$date}
$state=[pscustomobject]@{ownerPid=42;ownerStarted=$date.Ticks.ToString()}
$script:loaded=$false
function Get-Process {param($Id) return $owner}
function Add-Type {param($Path) $script:loaded=$true;throw 'Unexpected module load'}
$blocked=$false;try{ActivateManaged $state 'other-app.exe'}catch{$blocked=$true}
if(!$blocked -or $script:loaded){throw 'Owner mismatch did not block component load'}
$blocked=$false;try{ActivateManaged $state 'verified-app.exe'}catch{$blocked=$true}
if(!$blocked -or $script:loaded){throw 'Tampered component reached native load'}
Write-Output 'PASS: mismatched owner and component digest reject before native assembly load'
