# dev-clean.ps1
# Kill any old processes on Vite ports (5173-5179) before starting a new dev server.
# Also kills node processes that might be lingering.

$currentPid = $PID
$ports = 5173..5179
$killedCount = 0

foreach ($port in $ports) {
    # 1. Try Get-NetTCPConnection (PowerShell native)
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        $targetPid = $conn.OwningProcess
        if ($targetPid -and $targetPid -ne 0 -and $targetPid -ne $currentPid) {
            try {
                $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "[dev-clean] Killing process on port ${port}: PID=$targetPid ($($proc.Name))" -ForegroundColor Yellow
                    Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
                    $killedCount++
                }
            } catch {}
        }
    }

    # 2. Fallback: Use netstat -ano to find PIDs that Get-NetTCPConnection might have missed
    $netstatLines = netstat -ano | Select-String ":$port\s"
    foreach ($line in $netstatLines) {
        if ($line -match '(\d+)$') {
            $targetPid = $matches[1]
            if ($targetPid -and $targetPid -ne 0 -and $targetPid -ne $currentPid) {
                try {
                    $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
                    if ($proc) {
                        Write-Host "[dev-clean] Killing process found via netstat on port ${port}: PID=$targetPid ($($proc.Name))" -ForegroundColor Yellow
                        Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
                        $killedCount++
                    }
                } catch {}
            }
        }
    }
}

if ($killedCount -eq 0) {
    Write-Host "[dev-clean] No old processes found. Ready to start." -ForegroundColor Green
} else {
    Write-Host "[dev-clean] Cleaned up $killedCount process(es). Waiting for ports to release..." -ForegroundColor Green
    Start-Sleep -Seconds 1
}

Write-Host "[dev-clean] Starting vite dev server..." -ForegroundColor Cyan
npx vite
