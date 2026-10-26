[CmdletBinding(SupportsShouldProcess=$true)]
param([switch]$ValidateOnly,[switch]$NoShortcuts)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
. (Join-Path $root 'engine\runtime-policy.ps1')
AssertSafeInstallPath $root
if($WhatIfPreference){Write-Output 'Dry run: no shortcuts, configuration or clients changed.';return}
if(!(Test-Path -LiteralPath (Join-Path $root 'SandroneCodex.exe'))){throw '源码版请先运行 Build-From-Source.ps1；试用版请完整解压 ZIP。'}
$node=Join-Path $root 'runtime\node.exe'
$manifestPath=Join-Path $root 'integrity.json'
if(!(Test-Path -LiteralPath $manifestPath)){throw '缺少完整性清单。源码版请先完成构建。'}
$manifest=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8|ConvertFrom-Json
$expected=$manifest.PSObject.Properties['runtime/node.exe'].Value
if(!$expected -or !(Test-Path -LiteralPath $node) -or (Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash -ine $expected){throw 'Node 运行文件不完整；未执行。'}
$sig=Get-AuthenticodeSignature -LiteralPath $node
if($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'OpenJS Foundation'){throw 'Node 签名未通过；请使用官方 Node.js Windows x64 运行时。'}
& $node (Join-Path $root 'verify-integrity.mjs')
if($LASTEXITCODE -ne 0){throw '包完整性校验失败。'}
$official=$null
foreach($package in @(Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue)){
 $candidate=Join-Path $package.InstallLocation 'app\ChatGPT.exe'
 if(!(Test-Path -LiteralPath $candidate)){continue}
 $signature=Get-AuthenticodeSignature -LiteralPath $candidate
 if($signature.Status -eq 'Valid' -and $signature.SignerCertificate.Subject -match 'OpenAI'){$official=$candidate;break}
}
if(!$official){throw '请先安装官方 Windows Codex，并从官方入口正常打开一次。此包不包含 Codex 或账号。'}
if($ValidateOnly){Write-Output '{"pass":true,"portableRoot":true,"runtimeSignature":true,"officialDetected":true,"clientStarted":false,"filesWritten":false}';return}
$config=@{officialExe=$official}|ConvertTo-Json
if($PSCmdlet.ShouldProcess($root,'保存本机安装信息并创建本项目快捷方式')){
 foreach($name in @('state','profile','codex-home')){ProtectPrivateDirectory (Join-Path $root $name) $root}
 [IO.File]::WriteAllText((Join-Path $root 'machine.json'),$config,(New-Object Text.UTF8Encoding($false)))
 if(!$NoShortcuts){
  $catalog=Get-Content -LiteralPath (Join-Path $root 'catalog.json') -Raw -Encoding UTF8|ConvertFrom-Json
  $shell=New-Object -ComObject WScript.Shell
  $desktop=[Environment]::GetFolderPath('Desktop')
  $shortcutRoot=[IO.Path]::GetFullPath((Join-Path $desktop 'codexui'))
  if(!$shortcutRoot.StartsWith([IO.Path]::GetFullPath($desktop).TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid shortcut folder.'}
  if(Test-Path -LiteralPath $shortcutRoot){if((Get-Item -LiteralPath $shortcutRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Shortcut directory is redirected.'}}else{$null=New-Item -ItemType Directory -Path $shortcutRoot}
  # Retire only the obsolete shortcut owned by this exact installation.
  $oldSelector=Join-Path $shortcutRoot '00 角色选择器.lnk'
  if(Test-Path -LiteralPath $oldSelector){$oldLink=$shell.CreateShortcut($oldSelector);if($oldLink.TargetPath -ieq (Join-Path $root 'CodexUI.exe') -and !$oldLink.Arguments){Remove-Item -LiteralPath $oldSelector}}
  $entries=@(@{name='00 启动 Codex UI';arguments='';icon='assets\workshop.ico'},@{name='99 恢复原版外观';arguments='--restore';icon='assets\workshop.ico'})
  foreach($character in $catalog.characters){
   if($character.id -notmatch '^[a-z][a-z0-9-]{1,31}$' -or $character.name -match '[\\/:*?"<>|]'){throw 'Invalid character shortcut.'}
   $entries+=@{name=($character.name+' · '+$character.themeName);arguments=('--character '+$character.id);icon=('characters\'+$character.id+'\assets\workshop.ico')}
  }
  foreach($entry in $entries){
   $shortcut=$shell.CreateShortcut((Join-Path $shortcutRoot ($entry.name+'.lnk')))
   $shortcut.TargetPath=Join-Path $root 'CodexUI.exe';$shortcut.Arguments=$entry.arguments;$shortcut.WorkingDirectory=$root;$shortcut.IconLocation=Join-Path $root $entry.icon;$shortcut.Description='Codex UI character theme';$shortcut.Save()
  }
 }
 Write-Output '角色入口已输出到桌面 codexui 文件夹。从任意主题标题栏的“切换角色”选择其他角色；无独立选择器。未启动或关闭任何客户端。'
}
