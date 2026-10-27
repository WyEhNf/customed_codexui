# Real filesystem/ACL/version/validator tests, with no live client operations.
$ErrorActionPreference='Stop'
$sourceRoot=Split-Path $PSScriptRoot -Parent
. (Join-Path $sourceRoot 'engine\runtime-policy.ps1')
function Check([bool]$Condition,[string]$Message){if(!$Condition){throw $Message}}
function ExpectThrow([scriptblock]$Operation,[string]$Message){$thrown=$false;try{& $Operation|Out-Null}catch{$thrown=$true};Check $thrown $Message}
$temporary=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$fixture=Join-Path $temporary ('CodexUI-policy-test-'+[Guid]::NewGuid().ToString('N'))
$node=Join-Path $sourceRoot 'runtime\node.exe'
$checks=@()
try{
 $null=[IO.Directory]::CreateDirectory($fixture)
 Check (TestPathWithin (Join-Path $fixture 'child') $fixture) 'Descendant rejected'
 Check (!(TestPathWithin ($fixture+'-sibling') $fixture)) 'Sibling prefix accepted'
 ExpectThrow {AssertSafeInstallPath '\\server\share\theme'} 'UNC accepted'
 ExpectThrow {AssertSafeInstallPath (Join-Path $env:ProgramFiles 'CodexUI')} 'Program Files accepted'
 ExpectThrow {AssertSafeInstallPath (Join-Path $env:WINDIR 'CodexUI')} 'Windows directory accepted'
 ExpectThrow {AssertSafeInstallPath (Join-Path $fixture 'OneDrive - Test\CodexUI')} 'OneDrive account folder accepted'
 AssertSafeInstallPath (Join-Path $fixture 'OneDrive-backups\CodexUI')
 function Get-ChildItem {param($LiteralPath,$ErrorAction) return [pscustomobject]@{PSPath='fixture-one-drive-account'}}
 function Get-ItemProperty {param($LiteralPath,$Name,$ErrorAction) return [pscustomobject]@{UserFolder=(Join-Path $fixture 'Custom Cloud Root')}}
 ExpectThrow {AssertSafeInstallPath (Join-Path $fixture 'Custom Cloud Root\CodexUI')} 'Registered OneDrive root with a custom folder name accepted'
 Remove-Item -LiteralPath Function:\Get-ChildItem,Function:\Get-ItemProperty
 $checks+='local-system-sync-and-sibling-boundaries'

 $private=Join-Path $fixture 'codex-home'
 ProtectPrivateDirectory $private $fixture
 $acl=Get-Acl -LiteralPath $private
 Check $acl.AreAccessRulesProtected 'Sensitive directory still inherits broad parent permissions'
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $allowed=@($sid,'S-1-5-18','S-1-5-32-544')
 foreach($rule in $acl.Access){Check ($rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -in $allowed) 'Unexpected principal can access private directory'}
 $beforeHome=[Environment]::GetEnvironmentVariable('CODEX_HOME','Process')
 $beforeSqlite=[Environment]::GetEnvironmentVariable('CODEX_SQLITE_HOME','Process')
 $start=NewCodexStartInfo -Exe 'fixture.exe' -Arguments @('--user-data-dir="C:\Fixture Data\profile"') -Root $fixture -Isolated
 Check (!$start.UseShellExecute -and $start.EnvironmentVariables['CODEX_HOME'] -eq $private -and $start.EnvironmentVariables['CODEX_SQLITE_HOME'] -eq $private) 'Child agent state is not isolated'
 Check ($start.Arguments -ceq '--user-data-dir="C:\Fixture Data\profile"') 'Profile argument quoting changed'
 Check ([Environment]::GetEnvironmentVariable('CODEX_HOME','Process') -ceq $beforeHome -and [Environment]::GetEnvironmentVariable('CODEX_SQLITE_HOME','Process') -ceq $beforeSqlite) 'Launcher changed parent environment'
 $checks+='private-windows-acl-and-child-only-home-environment'

 # An explicit, persistent storage selection must survive launches and caller
 # environment changes. A missing selection target must fail, never look empty.
 $selectedHome=Join-Path $fixture 'Existing history 对话'
 $selectedSqlite=Join-Path $fixture 'Existing databases'
 $null=[IO.Directory]::CreateDirectory($selectedHome)
 $null=[IO.Directory]::CreateDirectory($selectedSqlite)
 $selectionState=Join-Path $fixture 'state';$null=[IO.Directory]::CreateDirectory($selectionState)
 $selectionFile=Join-Path $selectionState 'agent-storage.json'
 $sentinel=Join-Path $selectedSqlite 'state_5.sqlite'
 [IO.File]::WriteAllText($sentinel,'existing-history-must-survive')
 $storageConfig=@{schemaVersion=1;agentHome=$selectedHome;sqliteHome=$selectedSqlite}
 $storageConfig|ConvertTo-Json|Set-Content -LiteralPath $selectionFile -Encoding UTF8
 try{
  for($launch=0;$launch -lt 2;$launch++){
   $otherHome=Join-Path $fixture ('Unrelated caller home '+$launch)
   [Environment]::SetEnvironmentVariable('CODEX_HOME',$otherHome,'Process')
   [Environment]::SetEnvironmentVariable('CODEX_SQLITE_HOME',$otherHome,'Process')
   $selectedStart=NewCodexStartInfo -Exe 'fixture.exe' -Root $fixture -Isolated
   Check ($selectedStart.EnvironmentVariables['CODEX_HOME'] -ceq $selectedHome -and $selectedStart.EnvironmentVariables['CODEX_SQLITE_HOME'] -ceq $selectedSqlite) 'Saved history selection changed between launches'
   Check ([Environment]::GetEnvironmentVariable('CODEX_HOME','Process') -ceq $otherHome) 'Saved selection changed the caller environment'
   Check ([IO.File]::ReadAllText($sentinel) -ceq 'existing-history-must-survive') 'Launch modified existing history'
  }
 }finally{
  [Environment]::SetEnvironmentVariable('CODEX_HOME',$beforeHome,'Process')
  [Environment]::SetEnvironmentVariable('CODEX_SQLITE_HOME',$beforeSqlite,'Process')
 }
 $storageConfig.agentHome=Join-Path $fixture 'Unavailable history'
 $storageConfig|ConvertTo-Json|Set-Content -LiteralPath $selectionFile -Encoding UTF8
 ExpectThrow {NewCodexStartInfo -Exe 'fixture.exe' -Root $fixture -Isolated} 'Missing history silently fell back to empty portable storage'
 Check (!(Test-Path -LiteralPath $storageConfig.agentHome)) 'Missing selected history was recreated empty'
 $storageConfig.agentHome='relative-history'
 $storageConfig|ConvertTo-Json|Set-Content -LiteralPath $selectionFile -Encoding UTF8
 ExpectThrow {NewCodexStartInfo -Exe 'fixture.exe' -Root $fixture -Isolated} 'Relative history selection depends on launch working directory'
 $storageConfig.agentHome=$selectedHome;$storageConfig.schemaVersion=99
 $storageConfig|ConvertTo-Json|Set-Content -LiteralPath $selectionFile -Encoding UTF8
 ExpectThrow {NewCodexStartInfo -Exe 'fixture.exe' -Root $fixture -Isolated} 'Unsupported storage configuration accepted'
 Remove-Item -LiteralPath $selectionFile
 $checks+='saved-history-repeated-launch-and-missing-path-no-empty-fallback'
 $script:freeBytes=1GB;$script:spaceQueries=0
 function GetStorageAvailableBytes {param($Path) $script:spaceQueries++;return $script:freeBytes}
 AssertRuntimeStorageSpace $fixture ([pscustomobject]@{agentHome=$fixture;sqliteHome=$fixture})
 Check ($script:spaceQueries -eq 1) 'Storage check repeatedly queried the same volume'
 $script:freeBytes=0
 ExpectThrow {AssertRuntimeStorageSpace $fixture ([pscustomobject]@{agentHome=$fixture;sqliteHome=$fixture})} 'Full data volume accepted'
 Remove-Item -LiteralPath Function:\GetStorageAvailableBytes
 $checks+='full-storage-volume-preflight-without-moving-history'

 $app=Join-Path $fixture 'app';$null=[IO.Directory]::CreateDirectory($app)
 $executable=Join-Path $app 'ChatGPT.exe'
 Copy-Item -LiteralPath (Join-Path $PSHOME 'powershell.exe') -Destination $executable -ErrorAction SilentlyContinue
 if(!(Test-Path -LiteralPath $executable)){Copy-Item -LiteralPath (Join-Path $PSHOME 'pwsh.exe') -Destination $executable}
 $manifest=Join-Path $fixture 'AppxManifest.xml'
 [IO.File]::WriteAllText($manifest,'<Package xmlns="urn:test"><Identity Name="OpenAI.Codex" Version="26.1021.2667.0" /></Package>')
 $info=GetCodexClientInfo $executable
 Check ($info.appVersion -eq '26.1021.2667.0' -and $info.electronVersion) 'Real Appx/PE versions were not read separately'
 $null=AssertClientCompatibility $info $sourceRoot
 $info.appVersion='99.1.2.3'
 ExpectThrow {AssertClientCompatibility $info $sourceRoot} 'Unverified upstream update accepted'
 [IO.File]::WriteAllText($manifest,'<!DOCTYPE Package [<!ENTITY local SYSTEM "file:///not-read">]><Package><Identity Name="OpenAI.Codex" Version="26.1021.2667.0"/></Package>')
 ExpectThrow {GetCodexClientInfo $executable} 'DTD accepted in Appx metadata'
 Remove-Item -LiteralPath $manifest
 ExpectThrow {GetCodexClientInfo $executable} 'Missing metadata silently accepted for a cold launch'
 $retiredApp=Join-Path $fixture 'OpenAI.Codex_26.1021.2667.0_x64__2p2nqsd0c76g0\app'
 $null=[IO.Directory]::CreateDirectory($retiredApp)
 $retiredExe=Join-Path $retiredApp 'ChatGPT.exe';Copy-Item -LiteralPath $executable -Destination $retiredExe
 $retired=GetCodexClientInfo $retiredExe -RetiredSession
 Check ($retired.appVersion -ceq '26.1021.2667.0' -and $retired.metadataSource -ceq 'verified-retired-package-path') 'Verified retired session cannot recover its package version after Store cleanup'
 ExpectThrow {GetCodexClientInfo $retiredExe} 'Retired package accepted for a new cold launch'
 $checks+='actual-package-and-pe-version-detection-unknown-update-and-dtd-refusal'

 $state=Join-Path $fixture 'state';$null=[IO.Directory]::CreateDirectory($state)
 $scripts=Join-Path $fixture 'vendor\dream-skin\runtime';$null=[IO.Directory]::CreateDirectory($scripts)
 $validator=Join-Path $scripts 'theme-package-validator.mjs'
 $code="import fs from 'node:fs';import path from 'node:path';const args=process.argv;const stage=args[args.indexOf('--stage')+1];fs.writeFileSync(path.join(stage,'background.png'),Buffer.alloc(1822600));process.exit(args[args.indexOf('--source')+1]==='good'?0:9);"
 [IO.File]::WriteAllText($validator,$code)
 foreach($outcome in @('good','bad')){
  $token=[Guid]::NewGuid().ToString('N')
  if($outcome -eq 'good'){InvokeThemeValidation $node $outcome $fixture $state $token '1.5.21'}
  else{ExpectThrow {InvokeThemeValidation $node $outcome $fixture $state $token '1.5.21'} 'Failed native validator did not fail the caller'}
  Check (!(Test-Path -LiteralPath (Join-Path $state ('validate-'+$token)))) 'Validation stage retained large image after success/failure'
 }
 ExpectThrow {RemoveValidationStage $state $state} 'Cleanup accepted state root'
 ExpectThrow {RemoveValidationStage (Join-Path $fixture ('validate-'+('a'*32))) $state} 'Cleanup accepted sibling outside state'
 $stage=Join-Path $state ('validate-'+('b'*32));$null=[IO.Directory]::CreateDirectory($stage)
 $outside=Join-Path $fixture 'preserved';$null=[IO.Directory]::CreateDirectory($outside);[IO.File]::WriteAllText((Join-Path $outside 'keep.txt'),'keep')
 $link=Join-Path $stage 'junction'
 $null=New-Item -ItemType Junction -Path $link -Target $outside
 ExpectThrow {RemoveValidationStage $stage $state} 'Recursive cleanup accepted a junction'
 Check (Test-Path -LiteralPath (Join-Path $outside 'keep.txt')) 'Cleanup touched unrelated files'
 [IO.Directory]::Delete($link);RemoveValidationStage $stage $state
 $checks+='real-1.8mb-validation-finally-success-failure-and-junction-safe-cleanup'
 Write-Output ('PASS: '+($checks -join '; '))
}finally{
 $checked=[IO.Path]::GetFullPath($fixture).TrimEnd('\')
 if((Split-Path $checked -Parent) -ieq $temporary -and (Split-Path $checked -Leaf) -match '^CodexUI-policy-test-[a-f0-9]{32}$'){
  $junction=Join-Path $checked ('state\validate-'+('b'*32)+'\junction')
  if(Test-Path -LiteralPath $junction){[IO.Directory]::Delete($junction)}
  Remove-Item -LiteralPath $checked -Recurse -Force
 }
}
