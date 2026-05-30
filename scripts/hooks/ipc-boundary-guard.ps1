[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Get-MatchedPaths {
  param(
    [string]$Text,
    [string[]]$Paths
  )

  $matches = New-Object System.Collections.Generic.List[string]
  foreach ($path in $Paths) {
    $escaped = [Regex]::Escape($path).Replace("/", "[\\/]")
    if ($Text -match "(?i)$escaped") {
      $matches.Add($path)
    }
  }
  return $matches | Select-Object -Unique
}

$rawInput = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($rawInput)) {
  exit 0
}

# Allow intentional bypass for exceptional cases via prompt/tool input token.
if ($rawInput -match "(?i)\bIPC_GUARD_OK\b") {
  exit 0
}

# Guard only potentially mutating tool calls.
$writeToolPattern = "(?i)\b(apply_patch|create_file|delete|str_replace|insert|vscode_renamesymbol|edit_notebook_file|create_directory)\b"
if ($rawInput -notmatch $writeToolPattern) {
  exit 0
}

$boundaryPaths = @(
  "app/shared/contracts.ts",
  "app/main/main.ts",
  "app/main/preload.ts",
  "app/renderer/src/types.d.ts"
)

$testPaths = @(
  "app/renderer/src/__tests__/",
  "tests/"
)

$matchedBoundaries = Get-MatchedPaths -Text $rawInput -Paths $boundaryPaths
if ($matchedBoundaries.Count -eq 0) {
  exit 0
}

$matchedTests = Get-MatchedPaths -Text $rawInput -Paths $testPaths

$reasons = New-Object System.Collections.Generic.List[string]

# Ask when only one boundary file is being changed.
if ($matchedBoundaries.Count -eq 1) {
  $reasons.Add("Editing only one IPC boundary file ($($matchedBoundaries[0])).")
}

# Ask when no test-path change is detected alongside IPC boundary edits.
if ($matchedTests.Count -eq 0) {
  $reasons.Add("No test path update detected under app/renderer/src/__tests__/ or tests for this IPC boundary edit.")
}

if ($reasons.Count -eq 0) {
  exit 0
}

$reason = ($reasons -join " ") + " Confirm this is intentional, include companion updates across contracts/main/preload/types/tests, or include IPC_GUARD_OK to bypass this guard for an explicit exception."

$response = @{
  hookSpecificOutput = @{
    hookEventName = "PreToolUse"
    permissionDecision = "ask"
    permissionDecisionReason = $reason
  }
}

$response | ConvertTo-Json -Compress | Write-Output
exit 0
