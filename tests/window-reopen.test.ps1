# Real recovery function with process/window adapters, never a live client.
$ErrorActionPreference='Stop'
$sourceRoot=Split-Path $PSScriptRoot -Parent
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $sourceRoot 'engine\control.ps1'),[ref]$null,[ref]$null)
$definition=$ast.Find({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq 'ShowManagedClient'},$true)
. ([scriptblock]::Create($definition.Extent.Text))
$projectRoot=Join-Path ([IO.Path]::GetTempPath()) 'CodexUI fixture theme'
$state=[pscustomobject]@{ownerPid=42;port=54821;browserId='verified-browser'}
$script:verified=$true;$script:visible=$true;$script:activations=0;$script:requests=@();$script:openAfter=3;$script:manifestPresent=$true
function VerifyManaged {param($Record,$Exe) return $script:verified}
function ActivateManaged {param($Record,$Exe) $script:activations++;return $script:visible -or ($script:openAfter -gt 0 -and $script:activations -ge $script:openAfter)}
function StartCodexClient {param($Exe,$Arguments,$Root,[switch]$Isolated) $script:requests+=@([pscustomobject]@{Exe=$Exe;Arguments=$Arguments;Root=$Root;Isolated=[bool]$Isolated})}
function Start-Sleep {param($Milliseconds)}
function Test-Path {param($LiteralPath,$PathType) return $script:manifestPresent}
function NodeExe {return 'fixture-node.exe'}
function NativeUi {param($Node,$Verb,$Record) if($Verb -eq '--show-main'){return $false};return $script:visible -or ($script:openAfter -gt 0 -and $script:activations -ge $script:openAfter)}
function Check([bool]$Condition,[string]$Message){if(!$Condition){throw $Message}}
ShowManagedClient $state 'verified-app.exe'
Check ($script:requests.Count -eq 0 -and $script:activations -eq 1) 'Existing native window must activate without relaunch'
$script:visible=$false;$script:activations=0
ShowManagedClient $state 'verified-app.exe'
Check ($script:requests.Count -eq 1 -and $script:activations -eq 3) 'Missing native window must reopen once and await actual activation'
$request=$script:requests[0]
Check ($request.Exe -ceq 'verified-app.exe' -and $request.Root -ceq $projectRoot -and $request.Isolated) 'Recovery changed executable/root/storage mode'
$expectedArguments='--remote-debugging-address=127.0.0.1|--remote-debugging-port=54821|--user-data-dir="'+(Join-Path $projectRoot 'profile')+'"'
Check (($request.Arguments -join '|') -ceq $expectedArguments) 'Recovery did not preserve exact loopback port and profile'
$script:verified=$false;$blocked=$false
try{ShowManagedClient $state 'verified-app.exe'}catch{$blocked=$true}
Check ($blocked -and $script:requests.Count -eq 1) 'Changed browser ownership must block before reopen'
$script:verified=$true;$script:activations=0;$script:openAfter=0;$blocked=$false
try{ShowManagedClient $state 'verified-app.exe' 0}catch{$blocked=$true}
Check ($blocked -and $script:requests.Count -eq 2) 'No visible window must fail instead of reporting ready'
$script:activations=0;$script:openAfter=0
function ActivateManaged {param($Record,$Exe) $script:activations++;return $true}
$blocked=$false;try{ShowManagedClient $state 'verified-app.exe' 0}catch{$blocked=$true}
Check ($blocked -and $script:requests.Count -eq 3) 'Visible detached window cannot conceal a hidden main renderer'
$script:manifestPresent=$false;$beforeRequests=$script:requests.Count;$blocked=$false
try{ShowManagedClient $state 'verified-app.exe' 0}catch{$blocked=$true}
Check ($blocked -and $script:requests.Count -eq $beforeRequests) 'Retired executable with removed manifest must not be respawned'
$script:visible=$false;$beforeRequests=$script:requests.Count
function NativeUi {param($Node,$Verb,$Record) if($Verb -eq '--show-main'){$script:visible=$true;return $true};return $script:visible}
ShowManagedClient $state 'verified-app.exe'
Check ($script:visible -and $script:requests.Count -eq $beforeRequests) 'Native host restoration should not relaunch or restart an existing client'
Write-Output 'PASS: native window reuse, same-session reopen, actual activation wait, identity guards and failure propagation'
