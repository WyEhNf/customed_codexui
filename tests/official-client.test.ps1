# Execute real selection functions against simulated Store/process snapshots.
$ErrorActionPreference='Stop'
$sourceRoot=Split-Path $PSScriptRoot -Parent
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $sourceRoot 'engine\control.ps1'),[ref]$null,[ref]$null)
foreach($name in @('TestOfficialExecutable','OfficialExe')){
 $definition=$ast.Find({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq $name},$true)
 . ([scriptblock]::Create($definition.Extent.Text))
}
$projectRoot='G:\fixture'
$oldRoot='C:\Program Files\WindowsApps\OpenAI.Codex_26.1021.2667.0_x64__2p2nqsd0c76g0'
$newRoot='C:\Program Files\WindowsApps\OpenAI.Codex_26.1021.3705.0_x64__2p2nqsd0c76g0'
$old=Join-Path $oldRoot 'app\ChatGPT.exe';$new=Join-Path $newRoot 'app\ChatGPT.exe'
$script:packages=@([pscustomobject]@{Version='26.1021.3705.0';InstallLocation=$newRoot})
$script:files=@($old,$new,(Join-Path $newRoot 'AppxManifest.xml'))
$script:validSignature=$true
function Get-AppxPackage {param($Name,$ErrorAction) return $script:packages}
function Get-Process {param($Name,$ErrorAction) return @([pscustomobject]@{Path=$old},[pscustomobject]@{Path=$new})}
function Test-Path {param($LiteralPath,$PathType) return $LiteralPath -in $script:files}
function Get-AuthenticodeSignature {param($LiteralPath) return [pscustomobject]@{Status=if($script:validSignature){'Valid'}else{'HashMismatch'};SignerCertificate=[pscustomobject]@{Subject='CN=OpenAI OpCo, LLC'}}}
function Check([bool]$Condition,[string]$Message){if(!$Condition){throw $Message}}
Check ((OfficialExe) -ceq $new) 'Running retired executable outranked current registered package'
$script:packages=@();Check ((OfficialExe) -ceq $new) 'Fallback selected retired process with missing manifest'
$script:files=@($old,$new);$blocked=$false
try{OfficialExe|Out-Null}catch{$blocked=$true}
Check $blocked 'Missing manifests must produce actionable failure rather than stale launch'
$script:files+=@((Join-Path $newRoot 'AppxManifest.xml'));$script:validSignature=$false;$blocked=$false
try{OfficialExe|Out-Null}catch{$blocked=$true}
Check $blocked 'Invalid signature accepted'
Check (!(TestOfficialExecutable 'C:\Other\ChatGPT.exe')) 'Non-Store path accepted'
Write-Output 'PASS: registered Store preference, retired process exclusion, manifest guards and signature boundaries'
