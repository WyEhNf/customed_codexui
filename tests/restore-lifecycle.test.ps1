# Execute the real close helper against fixture OS results and a fake Node worker.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'engine\control.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parse failed'}
$definition=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'CloseManagedClient'},$true)
. ([scriptblock]::Create($definition.Extent.Text))
function Check([bool]$Condition,[string]$Message){if(!$Condition){throw $Message}}
$temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$projectRoot=Join-Path $temp ('CodexUI-close-test-'+[Guid]::NewGuid().ToString('N'))
$state=[pscustomobject]@{port=54821;browserId='fixture-browser';ownerPid=123;ownerStarted='fixture-ticks'}
$script:verified=$true;$script:ports=@();$script:unsafe=0
function VerifyManaged {param($State,$Exe) return $script:verified}
function Get-Process {param($Id,$ErrorAction) Check ($Id -eq 123) 'Wrong process queried';return $null}
function Get-NetTCPConnection {param($State,$LocalPort,$ErrorAction) $script:ports+=$LocalPort;return @()}
function Stop-Process {$script:unsafe++;throw 'Forced process termination is forbidden'}
function Start-Process {$script:unsafe++;throw 'Live process launch is forbidden'}
try{
 $null=[IO.Directory]::CreateDirectory((Join-Path $projectRoot 'engine'))
 $worker=Join-Path $projectRoot 'engine\close-managed.mjs'
 $marker=Join-Path $projectRoot 'requested.txt'
 $code="import fs from 'node:fs';if(process.argv.slice(2).join(' ')!=='--browser-id fixture-browser')process.exit(9);fs.writeFileSync(new URL('../requested.txt',import.meta.url),'close');"
 [IO.File]::WriteAllText($worker,$code)
 CloseManagedClient (Join-Path $root 'runtime\node.exe') $state 'fixture.exe'
 Check (Test-Path -LiteralPath $marker) 'Graceful close not requested'
 Check (($script:ports -join ',') -eq '54821') 'Close helper polled a hardcoded endpoint'
 Remove-Item -LiteralPath $marker
 $script:verified=$false;$thrown=$false
 try{CloseManagedClient (Join-Path $root 'runtime\node.exe') $state 'fixture.exe'}catch{$thrown=$true}
 Check ($thrown -and !(Test-Path -LiteralPath $marker)) 'Foreign/changed owner received a close request'
 Check ($script:unsafe -eq 0) 'Helper attempted a forceful process action'
 # The actual restore branch must close before deleting state or opening official.
 $branch=$ast.Find({param($n) $n -is [Management.Automation.Language.IfStatementAst] -and $n.Clauses[0].Item1.Extent.Text -eq "`$Action -eq 'restore'"},$true).Extent.Text
 Check ($branch -and $branch.IndexOf('CloseManagedClient') -lt $branch.LastIndexOf('StartCodexClient')) 'Restore reports success/opens official before verified close'
 Write-Output 'PASS: dynamic-port graceful close; changed owner refused; restore ordering; no active clients touched'
}finally{
 $checked=[IO.Path]::GetFullPath($projectRoot)
 if((Split-Path $checked -Parent) -ieq $temp -and (Split-Path $checked -Leaf) -match '^CodexUI-close-test-[a-f0-9]{32}$'){Remove-Item -LiteralPath $checked -Recurse -Force}
}
