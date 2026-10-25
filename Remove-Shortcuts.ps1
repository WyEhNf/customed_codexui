[CmdletBinding(SupportsShouldProcess=$true)]param()
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$desktop=[Environment]::GetFolderPath('Desktop')
$folder=[IO.Path]::GetFullPath((Join-Path $desktop 'codexui'))
if(!$folder.StartsWith([IO.Path]::GetFullPath($desktop).TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid shortcut folder.'}
if(!(Test-Path -LiteralPath $folder)){return}
if((Get-Item -LiteralPath $folder -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Shortcut folder is redirected.'}
$shell=New-Object -ComObject WScript.Shell
foreach($file in Get-ChildItem -LiteralPath $folder -Filter '*.lnk' -File){
 $shortcut=$shell.CreateShortcut($file.FullName)
 if($shortcut.TargetPath -ceq (Join-Path $root 'CodexUI.exe') -and $shortcut.WorkingDirectory -ceq $root){if($PSCmdlet.ShouldProcess($file.FullName,'移除本集成版快捷方式')){Remove-Item -LiteralPath $file.FullName}}
}
Write-Output '只移除指向本集成版的 codexui 快捷方式；未处理账号或其他程序。'
