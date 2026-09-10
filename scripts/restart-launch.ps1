param(
    [Parameter(Mandatory = $true)]
    [string]$BatPath
)

$ErrorActionPreference = 'SilentlyContinue'

$projectDir = Split-Path -Parent $BatPath
$projectDirNorm = $projectDir.TrimEnd('\')
$ports = 4000..4010
$lockFile = Join-Path $projectDir '.next\dev\lock'

function Stop-OldDevWindows {
    Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" | ForEach-Object {
        $commandLine = $_.CommandLine
        if (-not $commandLine) { return }

        $inProject = $commandLine -like "*$projectDirNorm*"
        $isWorker = $inProject -and $commandLine -like '*restart.bat*' -and $commandLine -like '*_run_*'
        $isNpmDev = $inProject -and (
            $commandLine -like '*npm run dev*' -or
            $commandLine -like '*next dev*' -or
            $commandLine -like '*Asset Dev Server*'
        )

        if ($isWorker -or $isNpmDev) {
            Stop-Process -Id $_.ProcessId -Force
        }
    }

    if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
        return
    }

    foreach ($port in $ports) {
        Get-NetTCPConnection -LocalPort $port -State Listen | ForEach-Object {
            $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"

            while ($current) {
                Stop-Process -Id $current.ProcessId -Force
                if ($current.Name -eq 'cmd.exe') { break }
                if (-not $current.ParentProcessId) { break }
                $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($current.ParentProcessId)"
            }
        }
    }
}

function Remove-DevLock {
    if (-not (Test-Path $lockFile)) { return }

    try {
        $lock = Get-Content $lockFile -Raw | ConvertFrom-Json
        if ($lock.pid) {
            Stop-Process -Id $lock.pid -Force
        }
    } catch {}

    Remove-Item $lockFile -Force
}

Stop-OldDevWindows
Remove-DevLock
Start-Sleep -Milliseconds 500

$cmdArgs = @(
    '/k',
    "title Asset Dev Server & cd /d `"$projectDirNorm`" & call `"$BatPath`" _run_"
)

Start-Process -FilePath 'cmd.exe' -ArgumentList $cmdArgs -WorkingDirectory $projectDirNorm

function Close-LauncherWindow {
    $parentId = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
    if (-not $parentId) { return }

    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$parentId"
    if (-not $parent -or $parent.Name -ne 'cmd.exe') { return }

    $parentLine = $parent.CommandLine
    if (-not $parentLine) { return }
    if ($parentLine -like '*restart.bat*' -and $parentLine -notlike '*_run_*') {
        Stop-Process -Id $parentId -Force
    }
}

Close-LauncherWindow
