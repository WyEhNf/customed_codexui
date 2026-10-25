$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$output=Join-Path $root 'evidence\window-fixture'
$null=New-Item -ItemType Directory -Path $output -Force
$exe=Join-Path $output 'fixture.exe';$result=Join-Path $output 'result.txt'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /platform:x64 ('/out:'+$exe) /reference:System.Windows.Forms.dll /reference:System.Drawing.dll (Join-Path $root 'launcher\NativeWindow.cs') (Join-Path $root 'tests\WindowFixture.cs')
if($LASTEXITCODE -ne 0){throw 'Fixture compilation failed'}
$process=Start-Process -FilePath $exe -ArgumentList ('"'+$result+'"') -WindowStyle Hidden -PassThru
if(!$process.WaitForExit(7000)){throw 'Own window fixture timed out'}
if($process.ExitCode -ne 0){Get-Content -LiteralPath $result;throw 'Own main-window selection or minimized restore failed'}
Get-Content -LiteralPath $result
