$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'Build-Integrated.ps1')
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
