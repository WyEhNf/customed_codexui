$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$framework=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
& (Join-Path $framework 'csc.exe') /nologo /target:winexe /platform:x64 /optimize+ ('/win32icon:'+(Join-Path $root 'assets\workshop.ico')) ('/out:'+(Join-Path $root 'SandroneCodex.exe')) /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll (Join-Path $root 'launcher\Launcher.cs')
if($LASTEXITCODE -ne 0){throw 'Launcher compilation failed'}
& (Join-Path $framework 'csc.exe') /nologo /target:library /platform:x64 /optimize+ ('/out:'+(Join-Path $root 'engine\Sandrone.Windowing.dll')) (Join-Path $root 'launcher\NativeWindow.cs')
if($LASTEXITCODE -ne 0){throw 'Native component compilation failed'}