[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

# Read hook input JSON from stdin.
$rawInput = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($rawInput)) {
  exit 0
}

$ipcPattern = "(?i)\b(ipc|desktopapi|ipcmain|preload|contracts|channel|domain:action)\b"
if ($rawInput -notmatch $ipcPattern) {
  # Not IPC related. No extra system message.
  exit 0
}

$systemMessage = @"
IPC boundary reminder: for endpoint add/change work, keep these files in sync when applicable:
1) app/shared/contracts.ts
2) app/main/main.ts
3) app/main/preload.ts
4) app/renderer/src/types.d.ts
5) app/renderer/src/__tests__/ or tests
Also keep channel names in domain:action format.
"@

$response = @{
  continue = $true
  systemMessage = $systemMessage.Trim()
}

$response | ConvertTo-Json -Compress | Write-Output
exit 0
