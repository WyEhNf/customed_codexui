[CmdletBinding()]
param([switch]$RefreshArt)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$node=Join-Path $root 'runtime\node.exe'
$signature=Get-AuthenticodeSignature -LiteralPath $node
if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'OpenJS Foundation'){throw 'Node signature check failed.'}
& (Join-Path $root 'build.ps1')
if($LASTEXITCODE -ne 0){throw 'Base compilation failed.'}
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /optimize+ ('/win32icon:'+(Join-Path $root 'characters\columbina\assets\workshop.ico')) ('/out:'+(Join-Path $root 'CodexUI.exe')) /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll (Join-Path $root 'launcher\CharacterLauncher.cs')
if($LASTEXITCODE -ne 0){throw 'Character launcher compilation failed.'}
if($RefreshArt){& $node (Join-Path $root 'integration\build-production-art.mjs');if($LASTEXITCODE -ne 0){throw 'Approved art preparation failed.'}}
& $node (Join-Path $root 'integration\build.mjs')
if($LASTEXITCODE -ne 0){throw 'Catalog build failed.'}
& $node (Join-Path $root 'verify-integrity.mjs')
if($LASTEXITCODE -ne 0){throw 'Integrated integrity check failed.'}
Write-Output 'Integrated build completed. No Codex client was started or stopped.'
