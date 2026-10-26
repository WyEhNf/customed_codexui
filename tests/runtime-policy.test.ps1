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
