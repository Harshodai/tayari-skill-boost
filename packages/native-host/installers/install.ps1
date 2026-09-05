param([Parameter(Mandatory=$true)][string]$ExtensionId)
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Dest = Join-Path $env:LOCALAPPDATA 'JobTayari'
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$Exe = Join-Path $Dest 'com.jobtayari.browser.exe'
Copy-Item (Join-Path $Root 'bin\win-x64\com.jobtayari.browser.exe') $Exe -Force
$Manifest = (Get-Content (Join-Path $Root 'installers\com.jobtayari.browser.json') -Raw).Replace('__HOST_PATH__',$Exe).Replace('__EXTENSION_ID__',$ExtensionId)
$ManifestPath = Join-Path $Dest 'com.jobtayari.browser.json'
Set-Content $ManifestPath $Manifest -Encoding UTF8
New-Item 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.jobtayari.browser' -Force | Out-Null
Set-ItemProperty 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.jobtayari.browser' '(default)' $ManifestPath
