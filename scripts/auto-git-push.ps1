# ==============================================================================
# PALLET Diagnostik - PowerShell Background File-System Watcher & Git Auto-Push
# Memantau setiap perubahan file dan otomatis melakukan git add, commit, dan push
# ke https://github.com/nursyifaahmad/web-pallet-diagnostik.git
# ==============================================================================

$projectPath = (Get-Item -Path ".").FullName
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " PALLET Git Auto-Push File Watcher Aktif" -ForegroundColor Green
Write-Host " Direktori: $projectPath" -ForegroundColor Yellow
Write-Host " Target Repo: https://github.com/nursyifaahmad/web-pallet-diagnostik.git" -ForegroundColor Yellow
Write-Host " Tekan Ctrl+C untuk menghentikan pemantau." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $projectPath
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Filter ignored folders
$filterRegex = "(\.git|node_modules|data\\pallet\.db|scratch)"

$debounceTime = 5 # seconds
$lastChangeTime = [DateTime]::MinValue
$pendingPush = $false

$action = {
    $path = $Event.SourceEventArgs.FullPath
    $changeType = $Event.SourceEventArgs.ChangeType

    if ($path -match $filterRegex) { return }

    $script:lastChangeTime = [DateTime]::Now
    $script:pendingPush = $true
    Write-Host "[Change Detected] $changeType on $path" -ForegroundColor DarkGray
}

Register-ObjectEvent $watcher 'Changed' -Action $action | Out-Null
Register-ObjectEvent $watcher 'Created' -Action $action | Out-Null
Register-ObjectEvent $watcher 'Deleted' -Action $action | Out-Null
Register-ObjectEvent $watcher 'Renamed' -Action $action | Out-Null

try {
    while ($true) {
        Start-Sleep -Seconds 2
        if ($pendingPush -and (([DateTime]::Now - $lastChangeTime).TotalSeconds -ge $debounceTime)) {
            $script:pendingPush = $false
            $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            Write-Host "`n[Auto-Push] Menyinkronkan perubahan ke GitHub ($timestamp)..." -ForegroundColor Yellow

            git add .
            git commit -m "Auto-commit: Perubahan kode $timestamp"
            git push origin main

            Write-Host "[Auto-Push] Sukses ter-push ke GitHub main branch! ✓" -ForegroundColor Green
        }
    }
}
finally {
    Unregister-Event -SourceIdentifier * -ErrorAction SilentlyContinue
    $watcher.Dispose()
    Write-Host "`nWatcher dimatikan." -ForegroundColor Red
}
