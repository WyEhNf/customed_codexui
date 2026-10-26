[CmdletBinding(SupportsShouldProcess=$true)]
param([Parameter(Mandatory=$true)][ValidateSet('Apply','Restore','Reapply')][string]$Action)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
if($WhatIfPreference){Write-Output ('Dry run only: '+$Action+' in '+$root+'; no files, processes or clients changed.');return}
try{
 # Every entry uses the same identity checks, dynamic port and recovery path.
 # This also works when either graphical launcher is unavailable.
 $token=[Guid]::NewGuid().ToString('N')
 $verb=if($Action -eq 'Restore'){'restore'}else{'launch'}
 & (Join-Path $root 'engine\control.ps1') -Action $verb -Token $token
 $file=Join-Path $root ('state\result-'+$token+'.json')
 if(!(Test-Path -LiteralPath $file)){throw '控制器没有返回结果。请查看安装路径与 state 目录权限。'}
 $result=Get-Content -LiteralPath $file -Raw -Encoding UTF8|ConvertFrom-Json
 if($result.status -notin @('ready','waiting')){throw ($result.message+[Environment]::NewLine+$result.detail)}
 Write-Output ($result.message+[Environment]::NewLine+$result.detail)
}catch{
 Write-Error $_.Exception.Message -ErrorAction Continue
 Write-Output '应急恢复：手动退出主题客户端，再从原来的官方快捷方式打开。'
 exit 1
}
