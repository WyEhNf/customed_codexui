# Runs real controller functions extracted from its AST. Never executes the
# controller entry point, launches a client, or reads profile/account state.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$source=Join-Path $root 'engine\control.ps1'
$parseTokens=$null;$parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$parseTokens,[ref]$parseErrors)
if($parseErrors.Count){throw 'Controller parse failed'}
foreach($name in @('TestDebugPort','SelectDebugPort','GetProcessProfile','FindThemeOwner','VerifyManaged')){
 $definition=$ast.Find({param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] -and $item.Name -eq $name},$true)
 if(!$definition){throw ('Required real controller function is missing: '+$name)}
 . ([scriptblock]::Create($definition.Extent.Text))
}
$script:checks=@();$script:unsafeCalls=0
function Check([bool]$condition,[string]$message){if(!$condition){throw $message}}
function Record([string]$message){$script:checks+=$message}
function ExpectThrow([scriptblock]$action,[string]$message){$thrown=$false;try{& $action|Out-Null}catch{$thrown=$true};Check $thrown $message}
function Stop-Process { $script:unsafeCalls++;throw 'Process stop is forbidden in this fixture' }
function Start-Process { $script:unsafeCalls++;throw 'Process launch is forbidden in this fixture' }

foreach($good in @([int]1024,[int]19337,[long]54821,[int]65535)){Check (TestDebugPort $good) ('Valid integer port rejected: '+$good)}
foreach($bad in @($null,[int]0,[int]80,[int]1023,[int]-1,[int]65536,'19337',[double]19337,[decimal]19337,[bool]$true,[uint32]19337)){
 Check (!(TestDebugPort $bad)) 'Noninteger/missing/out-of-range port accepted'

}
Check (!(TestDebugPort)) 'Missing port accepted by validation'
Record 'strict-int-or-long-1024-to-65535-port-validation'

# Every launch requests an OS-selected ephemeral loopback port.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
namespace StartupRecoveryFixture {
 public sealed class Listener {
  public static readonly List<Listener> Created=new List<Listener>();
  public static bool Busy;
  public IPAddress Address; public int RequestedPort,StopCalls; public bool ExclusiveAddressUse;
  public IPEndPoint LocalEndpoint {get;private set;}
  public Listener(IPAddress address,int port){Address=address;RequestedPort=port;LocalEndpoint=new IPEndPoint(address,54821);Created.Add(this);}
  public void Start(){if(!ExclusiveAddressUse)throw new InvalidOperationException();if(Busy)throw new SocketException(10048);}
  public void Stop(){StopCalls++;}
 }
}
'@
function New-Object {
 param([string]$TypeName,[object[]]$ArgumentList)
 Check ($TypeName -eq 'Net.Sockets.TcpListener') 'Unexpected object construction'
 return [StartupRecoveryFixture.Listener]::new([Net.IPAddress]$ArgumentList[0],[int]$ArgumentList[1])
}
Check ((SelectDebugPort) -eq 54821) 'Ephemeral allocator returned wrong port'
$state=[pscustomobject]@{ownerPid=987654;port=19337}
Check ((SelectDebugPort) -eq 54821) 'Stale state changed allocator'
$created=@([StartupRecoveryFixture.Listener]::Created)
Check ($created.Count -eq 2) 'Unexpected extra port probes'
Check (@($created|Where-Object {$_.RequestedPort -ne 0 -or !$_.Address.Equals([Net.IPAddress]::Loopback) -or !$_.ExclusiveAddressUse -or $_.StopCalls -ne 1}).Count -eq 0) 'Allocator must request port zero, bind exclusively to loopback and release the reservation'
[StartupRecoveryFixture.Listener]::Busy=$true
ExpectThrow {SelectDebugPort} 'Allocation failure did not fail closed'
Check ([StartupRecoveryFixture.Listener]::Created[2].StopCalls -eq 1) 'Failed allocation leaked a reservation'
Remove-Item -LiteralPath Function:\New-Object
Record 'ephemeral-only-exclusive-loopback-and-failed-reservation-cleanup'
$held=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$probe=$null
try{
 $held.ExclusiveAddressUse=$true;$held.Start();$busyPort=[int]$held.LocalEndpoint.Port
 $selected=SelectDebugPort
 Check ((TestDebugPort $selected) -and $selected -ne $busyPort) 'Real allocator returned occupied fixture port'
 $probe=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$selected);$probe.ExclusiveAddressUse=$true;$probe.Start()
 Check $probe.LocalEndpoint.Address.Equals([Net.IPAddress]::Loopback) 'Real reservation is not loopback'
}finally{if($probe){$probe.Stop()};$held.Stop()}
Record 'real-ephemeral-allocation-without-disturbing-held-listener'

$exe='C:\Program Files\WindowsApps\OpenAI.Codex_fixture\app\ChatGPT.exe'
$profile='G:\Fixture Themes\CodexUI\profile'
$script:processes=@();$script:cimCalls=0
function Get-CimInstance {
 param($ClassName,$Filter,$ErrorAction)
 Check ($ClassName -eq 'Win32_Process' -and $Filter -eq "Name='ChatGPT.exe'") 'FindThemeOwner must inspect only the intended process class'
 $script:cimCalls++;return $script:processes
}
function FakeProcess([int]$identifier,[string]$commandLine,[string]$executable=$exe){return [pscustomobject]@{ProcessId=$identifier;ExecutablePath=$executable;CommandLine=$commandLine}}
function ExpectConflicts([object[]]$records,[string[]]$expected,[string]$message){
 $script:processes=$records
 $actual=@(FindThemeOwner $exe $profile|ForEach-Object {"$($_.Id):$($_.Kind)"}|Sort-Object)
 Check (($actual -join '|') -eq (($expected|Sort-Object) -join '|')) ($message+'; actual='+($actual -join '|'))
}
ExpectConflicts @((FakeProcess 101 ('"'+$exe+'"'))) @() 'Ordinary default-profile Codex must not block isolated launch'
ExpectConflicts @((FakeProcess 102 ('"'+$exe+'" --user-data-dir="C:\Users\Fixture\AppData\Roaming\Codex"'))) @() 'Clearly different ordinary profile must not block isolated launch'
ExpectConflicts @((FakeProcess 103 ('"'+$exe+'" --user-data-dir="'+$profile+'-other"'))) @() 'A sibling prefix must not be mistaken for the theme profile'
Record 'ordinary-default-different-and-prefix-sibling-profiles-do-not-block'

$profileForms=@(
 ('--user-data-dir="'+$profile+'"'),
 ('"--user-data-dir='+$profile+'"'),
 ('--user-data-dir "'+$profile+'"'),
 '--user-data-dir="g:\fixture themes\codexui\PROFILE\"',
 '--user-data-dir="G:\Fixture Themes\CodexUI\archive\..\profile"'
)
foreach($form in $profileForms){ExpectConflicts @((FakeProcess 201 ('"'+$exe+'" '+$form))) @('201:theme') 'Same theme profile must conflict without trusted state'}
ExpectConflicts @((FakeProcess 202 ('"'+$exe+'" --user-data-dir="'+$profile+'"') $exe.ToLowerInvariant())) @('202:theme') 'Windows case-equivalent executable paths must not bypass same-profile conflict detection'
ExpectConflicts @((FakeProcess 203 ('"'+$exe+'" --type=renderer --user-data-dir="'+$profile+'"')),(FakeProcess 204 ('"'+$exe+'" --type gpu-process --user-data-dir="'+$profile+'"'))) @() 'Child renderer/GPU processes are not browser owners'
ExpectConflicts @((FakeProcess 205 ('"C:\Other\ChatGPT.exe" --user-data-dir="'+$profile+'"') 'C:\Other\ChatGPT.exe')) @() 'A known different executable is not the theme owner'
Record 'same-profile-normalized-quotes-casing-and-child-process-boundaries'

ExpectConflicts @((FakeProcess 301 ''),(FakeProcess 302 ('"'+$exe+'"') '')) @('301:unknown','302:unknown') 'Unreadable identity must fail closed'
foreach($malformed in @('--user-data-dir','--user-data-dir=""','--user-data-dir=relative-profile')){ExpectConflicts @((FakeProcess 303 ('"'+$exe+'" '+$malformed))) @('303:unknown') 'Malformed/relative profile must not count as a clearly ordinary client'}
ExpectConflicts @((FakeProcess 304 ('"'+$exe+'" --user-data-dir="C:\Ordinary" --user-data-dir="'+$profile+'"'))) @('304:unknown') 'Conflicting repeated profile switches must fail closed'
ExpectConflicts @((FakeProcess 305 ('"'+$exe+'" --user-data-dir="'+$profile+'" --user-data-dir="C:\Ordinary"'))) @('305:unknown') 'Repeated profile switches cannot be classified from just the first match'
Record 'unreadable-malformed-relative-or-ambiguous-profile-identities-block-safely'

# Real VerifyManaged guard, with only its process/OS-table/HTTP boundaries
# mocked. No requests go to existing or unknown debugger endpoints.
$projectRoot='';$script:ownerDate=[datetime]::SpecifyKind([datetime]'2026-01-02T03:04:05',[DateTimeKind]::Utc)
$script:owner=[pscustomobject]@{Path=$exe;StartTime=$script:ownerDate}
$script:deadOwner=$false;$script:processQueries=0;$script:portQueries=@();$script:httpQueries=@()
$script:listeners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=123})
function Get-Process {param($Id,$ErrorAction) $script:processQueries++;if($script:deadOwner){throw 'fixture owner no longer exists'};Check ($Id -eq 123) 'Unexpected process lookup';return $script:owner}
function Get-NetTCPConnection {param($State,$LocalPort,$ErrorAction) $script:portQueries+=$LocalPort;return $script:listeners}
function Invoke-RestMethod {param($Uri,$TimeoutSec) $script:httpQueries+=[string]$Uri;return [pscustomobject]@{webSocketDebuggerUrl=$script:browser}}
$state=[pscustomobject]@{port=54821;exe=$exe;ownerPid=123;ownerStarted=$script:ownerDate.Ticks.ToString();browserId='owned-browser'}
foreach($invalid in @($null,0,1023,65536,'54821',[double]54821)){
 $state.port=$invalid;$script:processQueries=0;$script:portQueries=@();$script:httpQueries=@()
 Check (!(VerifyManaged $state $exe)) 'Invalid state port accepted by live ownership guard'
 Check ($script:processQueries -eq 0 -and $script:portQueries.Count -eq 0 -and $script:httpQueries.Count -eq 0) 'Invalid port must be rejected before any process/network probe'
}
$state.port=54821;$script:browser='ws://127.0.0.1:54821/devtools/browser/owned-browser'
Check (VerifyManaged $state $exe) 'Valid dynamically allocated owned port rejected'
Check (($script:portQueries -join ',') -eq '54821' -and ($script:httpQueries -join ',') -eq 'http://127.0.0.1:54821/json/version') 'Guard queried a stale hardcoded port instead of the supplied owned port'
$script:deadOwner=$true;$script:httpQueries=@()
Check (!(VerifyManaged $state $exe)) 'Dead owner accepted';Check ($script:httpQueries.Count -eq 0) 'Dead owner must not trigger requests to an occupied old endpoint'
$script:deadOwner=$false
foreach($listener in @([pscustomobject]@{LocalAddress='0.0.0.0';OwningProcess=123},[pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=999})){
 $script:listeners=@($listener);$script:httpQueries=@();Check (!(VerifyManaged $state $exe)) 'Public binding or foreign listener owner accepted';Check ($script:httpQueries.Count -eq 0) 'Foreign/public listener must be rejected before HTTP'
}
$script:listeners=@([pscustomobject]@{LocalAddress='127.0.0.1';OwningProcess=123})
foreach($badWs in @('ws://127.0.0.1:19337/devtools/browser/owned-browser','ws://127.0.0.1:54821/devtools/browser/other-browser','ws://user@127.0.0.1:54821/devtools/browser/owned-browser','ws://127.0.0.1:54821/devtools/browser/owned-browser?x=1','ws://127.0.0.1:54821/devtools/browser/owned-browser#x')){
 $script:browser=$badWs;Check (!(VerifyManaged $state $exe)) 'Stale port/browser or decorated debugger identity accepted'
}
Record 'dynamic-state-port-ownership-browser-identity-and-no-unknown-endpoint-requests'
Check ($script:unsafeCalls -eq 0) 'A helper attempted to launch or stop a process'
Record 'no-process-start-stop-or-profile-access'

$out=Join-Path $root 'evidence\startup-recovery'
[IO.Directory]::CreateDirectory($out)|Out-Null
$report=@{pass=$true;scope='AST-extracted real controller functions with isolated OS boundaries and fresh loopback sockets';checks=$script:checks;profileRead=$false;activeClientOperated=$false;processesStarted=0;processesStopped=0}
[IO.File]::WriteAllText((Join-Path $out 'startup-recovery.json'),($report|ConvertTo-Json -Depth 6),(New-Object Text.UTF8Encoding($false)))
Write-Output ('PASS: startup recovery '+$script:checks.Count+' groups; real function AST, dynamic loopback ports, exact profile isolation, no client actions')
