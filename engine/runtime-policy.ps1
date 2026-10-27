# Shared installation, data-directory and client compatibility boundaries.
function TestPathWithin([string]$Path,[string]$Parent){
 if([string]::IsNullOrWhiteSpace($Path) -or [string]::IsNullOrWhiteSpace($Parent)){return $false}
 $full=[IO.Path]::GetFullPath($Path).TrimEnd('\')
 $base=[IO.Path]::GetFullPath($Parent).TrimEnd('\')
 return ($full.Equals($base,[StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase))
}
function AssertNoReparsePath([string]$Path){
 for($candidate=[IO.Path]::GetFullPath($Path);$candidate;$candidate=Split-Path $candidate -Parent){
  if((Test-Path -LiteralPath $candidate) -and ((Get-Item -LiteralPath $candidate -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw '路径含链接或目录重定向，请改用普通本机文件夹。'}
 }
}
function AssertSafeInstallPath([string]$Path){
 $full=[IO.Path]::GetFullPath($Path).TrimEnd('\')
 if($full -notmatch '^[A-Za-z]:\\' -or $full.StartsWith('\\')){throw '请解压到本机可写目录，不能使用网络或设备路径。'}
 $blocked=@($env:ProgramFiles,${env:ProgramFiles(x86)},$env:ProgramW6432,$env:WINDIR,$env:OneDrive,$env:OneDriveConsumer,$env:OneDriveCommercial)
 foreach($account in @(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\OneDrive\Accounts' -ErrorAction SilentlyContinue)){
  $blocked+=((Get-ItemProperty -LiteralPath $account.PSPath -Name UserFolder -ErrorAction SilentlyContinue).UserFolder)
 }
 foreach($directory in $blocked){if($directory -and (TestPathWithin $full $directory)){throw '主题不能安装在 OneDrive 同步目录、Program Files 或 Windows 系统目录中。'}}
 if($full -match '(?i)(?:^|\\)OneDrive(?: - [^\\]+)?(?:\\|$)'){throw '主题不能安装在 OneDrive 同步目录中。'}
 AssertNoReparsePath $full
}
function ProtectPrivateDirectory([string]$Path,[string]$Root){
 if(!(TestPathWithin $Path $Root) -or [IO.Path]::GetFullPath($Path).TrimEnd('\') -ieq [IO.Path]::GetFullPath($Root).TrimEnd('\')){throw '私有数据目录不在本项目目录内。'}
 AssertNoReparsePath $Path
 $null=[IO.Directory]::CreateDirectory($Path)
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 # Start with access/owner sections only; a new DirectorySecurity can make
 # Set-Acl request SACL privileges that a normal non-admin user does not have.
 $acl=Get-Acl -LiteralPath $Path
 $acl.SetAccessRuleProtection($true,$false)
 foreach($rule in @($acl.Access)){$null=$acl.RemoveAccessRuleSpecific($rule)}
 foreach($identity in @($sid,(New-Object Security.Principal.SecurityIdentifier('S-1-5-18')),(New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')))){
  $rule=New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  $acl.AddAccessRule($rule)
 }
 $directory=New-Object IO.DirectoryInfo($Path)
 if($PSVersionTable.PSEdition -eq 'Core'){[IO.FileSystemAclExtensions]::SetAccessControl($directory,$acl)}else{$directory.SetAccessControl($acl)}
}
function RemoveValidationStage([string]$Path,[string]$StateRoot){
 $full=[IO.Path]::GetFullPath($Path).TrimEnd('\');$base=[IO.Path]::GetFullPath($StateRoot).TrimEnd('\')
 if((Split-Path $full -Parent) -ine $base -or (Split-Path $full -Leaf) -notmatch '^validate-[a-f0-9]{32}$'){throw '拒绝清理非校验临时目录。'}
 if(!(Test-Path -LiteralPath $full)){return}
 AssertNoReparsePath $full
 $pending=New-Object 'Collections.Generic.Stack[string]';$pending.Push($full)
 while($pending.Count){
  foreach($item in @(Get-ChildItem -LiteralPath $pending.Pop() -Force -ErrorAction Stop)){
   if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw '校验临时目录含重定向，已拒绝递归删除。'}
   if($item.PSIsContainer){$pending.Push($item.FullName)}
  }
 }
 Remove-Item -LiteralPath $full -Recurse -Force -ErrorAction Stop
}
function InvokeThemeValidation([string]$Node,[string]$Theme,[string]$Root,[string]$StateRoot,[string]$Token,[string]$FrameworkVersion){
 if($Token -notmatch '^[a-f0-9]{32}$'){throw '校验任务标识无效。'}
 $stage=Join-Path $StateRoot ('validate-'+$Token)
 try{
  $null=New-Item -ItemType Directory -Path $stage -ErrorAction Stop
  & $Node (Join-Path $Root 'vendor\dream-skin\runtime\theme-package-validator.mjs') --source $Theme --stage $stage --platform windows --client-version $FrameworkVersion | Out-Null
  if($LASTEXITCODE -ne 0){throw '主题包未通过上游安全校验。'}
 }finally{RemoveValidationStage $stage $StateRoot}
}
function GetCodexClientInfo([string]$Exe,[switch]$RetiredSession){
 # Electron's PE version is diagnostic data, not the desktop application's version.
 $runtime=[Diagnostics.FileVersionInfo]::GetVersionInfo($Exe)
 $manifest=Join-Path (Split-Path (Split-Path $Exe -Parent) -Parent) 'AppxManifest.xml'
 if(!(Test-Path -LiteralPath $manifest -PathType Leaf)){
  # Only a caller that already verified the live PID/start time/browser may
  # recover a retired package. Never use saved JSON as a version assertion.
  if($RetiredSession -and $Exe -match '\\OpenAI\.Codex_(\d+\.\d+\.\d+\.\d+)_(?:x64|arm64)__2p2nqsd0c76g0\\app\\ChatGPT\.exe$'){
   return [pscustomobject]@{appVersion=$Matches[1];electronVersion=$runtime.FileVersion;metadataSource='verified-retired-package-path'}
  }
  throw 'Codex 安装包元数据已被更新移除，请重新选择当前注册的 Store 安装包。'
 }
 $settings=New-Object Xml.XmlReaderSettings;$settings.DtdProcessing=[Xml.DtdProcessing]::Prohibit;$settings.XmlResolver=$null
 $reader=[Xml.XmlReader]::Create($manifest,$settings)
 try{$document=New-Object Xml.XmlDocument;$document.XmlResolver=$null;$document.Load($reader)}finally{$reader.Dispose()}
 $identity=$document.SelectSingleNode('/*[local-name()="Package"]/*[local-name()="Identity"]')
 if(!$identity -or $identity.GetAttribute('Name') -cne 'OpenAI.Codex' -or $identity.GetAttribute('Version') -notmatch '^\d+\.\d+\.\d+\.\d+$'){throw '无法读取官方 Codex 安装包版本，已停止主题注入。'}
 return [pscustomobject]@{appVersion=$identity.GetAttribute('Version');electronVersion=$runtime.FileVersion;metadataSource='AppxManifest.xml'}
}
function AssertClientCompatibility($Info,[string]$Root){
 $policy=Get-Content -LiteralPath (Join-Path $Root 'engine\client-compatibility.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($policy.schemaVersion -ne 1 -or $Info.appVersion -cnotin $policy.testedAppxVersions){throw ('当前 Codex '+$Info.appVersion+' 尚未验证；支持版本：'+($policy.testedAppxVersions -join ', ')+'。未启动主题客户端；请等待兼容更新或打开官方版。')}
 return $policy
}
function GetCodexAgentStorage([string]$Root){
 $defaultHome=Join-Path $Root 'codex-home'
 $selection=Join-Path $Root 'state\agent-storage.json'
 if(!(Test-Path -LiteralPath $selection)){return [pscustomobject]@{agentHome=$defaultHome;sqliteHome=$defaultHome;portable=$true}}
 AssertNoReparsePath $selection
 if((Get-Item -LiteralPath $selection).Length -gt 16384){throw '保存的数据目录配置过大，未切换到空白目录。'}
 $config=Get-Content -LiteralPath $selection -Raw -Encoding UTF8|ConvertFrom-Json
 if($config.schemaVersion -ne 1){throw '不支持保存的数据目录配置，未切换到空白目录。'}
 $paths=@{}
 foreach($key in @('agentHome','sqliteHome')){
  $value=$config.$key
  if($value -isnot [string] -or $value -notmatch '^[A-Za-z]:\\' -or !(Test-Path -LiteralPath $value -PathType Container)){throw ('保存的数据目录不可用：'+$key+'。请恢复该目录；不会另建空白历史。')}
  AssertNoReparsePath $value
  $full=[IO.Path]::GetFullPath($value)
  $paths[$key]=if($full.Length -gt 3){$full.TrimEnd('\')}else{$full}
 }
 return [pscustomobject]@{agentHome=$paths.agentHome;sqliteHome=$paths.sqliteHome;portable=$false}
}
function GetStorageAvailableBytes([string]$Path){
 $drive=New-Object IO.DriveInfo([IO.Path]::GetPathRoot([IO.Path]::GetFullPath($Path)))
 if(!$drive.IsReady){throw ('数据盘尚未就绪：'+$drive.Name)}
 return $drive.AvailableFreeSpace
}
function AssertRuntimeStorageSpace([string]$Root,$Storage){
 $checked=@{}
 foreach($directory in @($Root,$Storage.agentHome,$Storage.sqliteHome)){
  $drive=[IO.Path]::GetPathRoot([IO.Path]::GetFullPath($directory))
  if($checked.ContainsKey($drive)){continue};$checked[$drive]=$true
  $available=GetStorageAvailableBytes $directory
  if($available -lt 64MB){throw ('DISK_SPACE_LOW: '+$drive+' 可用空间仅 '+[math]::Round($available/1MB,1)+' MB，无法可靠写入启动数据或对话数据库。请先释放至少 64 MB，建议预留 1 GB；现有对话与配置未被移动。')}
 }
}
function NewCodexStartInfo([string]$Exe,[string[]]$Arguments,[string]$Root,[switch]$Isolated){
 $start=New-Object Diagnostics.ProcessStartInfo
 $start.FileName=$Exe;$start.UseShellExecute=$false;$start.WorkingDirectory=$Root
 $start.Arguments=$Arguments -join ' ';$start.WindowStyle=[Diagnostics.ProcessWindowStyle]::Normal
 $agentHome=Join-Path $Root 'codex-home'
 if($Isolated){
  $storage=GetCodexAgentStorage $Root
  if($storage.portable){ProtectPrivateDirectory $storage.agentHome $Root}
  $start.EnvironmentVariables['CODEX_HOME']=$storage.agentHome
  $start.EnvironmentVariables['CODEX_SQLITE_HOME']=$storage.sqliteHome
  # Keep theme-owned transient files off the system volume. History remains
  # at its saved location; never change CODEX_HOME to work around a full disk.
  $temporary=Join-Path $Root 'state\temp';AssertNoReparsePath $temporary
  $null=[IO.Directory]::CreateDirectory($temporary)
  $start.EnvironmentVariables['TEMP']=$temporary;$start.EnvironmentVariables['TMP']=$temporary
 }else{
  # Preserve caller overrides except a home injected by this theme instance.
  foreach($name in @('CODEX_HOME','CODEX_SQLITE_HOME')){if($start.EnvironmentVariables[$name] -and (TestPathWithin $start.EnvironmentVariables[$name] $agentHome)){$start.EnvironmentVariables.Remove($name)}}
 }
 return $start
}
function StartCodexClient([string]$Exe,[string[]]$Arguments,[string]$Root,[switch]$Isolated){
 $start=NewCodexStartInfo -Exe $Exe -Arguments $Arguments -Root $Root -Isolated:$Isolated
 return [Diagnostics.Process]::Start($start)
}
