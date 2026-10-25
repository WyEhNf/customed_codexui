$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Add-Type -Path (Join-Path $root 'engine\Sandrone.Windowing.dll')
$listener=New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Loopback,0)
try{
 $listener.Start();$port=$listener.LocalEndpoint.Port
 if(![SandroneCodex.NativeWindow]::HasListener($port)){throw 'Loopback listener missing'}
 if(![SandroneCodex.NativeWindow]::OwnsLoopbackListener($port,[uint32]$PID)){throw 'Own local listener rejected'}
 if([SandroneCodex.NativeWindow]::OwnsLoopbackListener($port,[uint32]($PID+1))){throw 'Foreign owner accepted'}
}finally{$listener.Stop()}
if([SandroneCodex.NativeWindow]::HasListener($port)){throw 'Closed listener still present'}
Write-Output 'PASS: native OS table recognizes local owner, rejects foreign PID, recognizes closed listener'
