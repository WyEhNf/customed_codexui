$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$output=Join-Path $root 'evidence\launcher-feedback'
[IO.Directory]::CreateDirectory($output) | Out-Null
$source=Join-Path $output 'FeedbackFixture.cs';$exe=Join-Path $output 'feedback.exe'
$code=@'
using System;
using System.Collections.Generic;
using CodexUI;
public class LauncherFeedbackFixture {
 static Dictionary<string,object> R(string status,string message,string detail){return new Dictionary<string,object>{{"status",status},{"message",message},{"detail",detail}};}
 static void Check(bool condition,string label){if(!condition)throw new Exception(label);}
 public static int Main(){
  var error=R("error","Theme startup incomplete","Loopback port 19337 is already owned by another process");
  Check(CharacterLauncher.ResultNotice(error).Contains("19337"),"Specific controller detail must be visible");
  Check(CharacterLauncher.ResultNotice(error).Contains("Theme startup incomplete"),"Summary must be retained");
  Check(CharacterLauncher.ResultNotice(R("blocked","","The current session is preserved")).Contains("The current session is preserved"),"Detail survives missing summary");
  Check(CharacterLauncher.ResultNotice(R("error","same","same"))=="same","Duplicate text is not repeated");
  Check(CharacterLauncher.ResultExitCode(R("ready","",null))==0,"Ready remains successful");
  Check(CharacterLauncher.ResultExitCode(R("waiting","",null))==0,"Waiting remains successful");
  Check(CharacterLauncher.ResultExitCode(error)==1,"Error remains failure");
  Check(CharacterLauncher.ResultExitCode(R("selected","",null))==3,"Selection without launch is not success");
  Check(CharacterLauncher.ResultExitCode(R("blocked","",null))==4,"Blocked launch is not success");
  Check(CharacterLauncher.ResultExitCode(R("unknown","",null))==2,"Unknown status is not success");
  Console.WriteLine("PASS: compiled launcher preserves controller detail and returns explicit ready/waiting/selected/blocked/error outcomes");return 0;
 }
}
'@
[IO.File]::WriteAllText($source,$code,[Text.UTF8Encoding]::new($false))
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:exe /platform:x64 /main:LauncherFeedbackFixture ('/out:'+$exe) /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll (Join-Path $root 'launcher\CharacterLauncher.cs') $source
if($LASTEXITCODE -ne 0){throw 'Launcher feedback fixture compilation failed'}
& $exe
if($LASTEXITCODE -ne 0){throw 'Launcher feedback fixture failed'}
