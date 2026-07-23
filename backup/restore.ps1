<#
.SYNOPSIS
    Hospital Management System — Restore MySQL from Backup
.DESCRIPTION
    Lists backups from Google Drive, downloads one, decompresses, and restores to MySQL.
.USAGE
    .\restore.ps1              # Interactive — lists backups and asks which to restore
    .\restore.ps1 -Local       # Restore from a local .sql.gz file
    .\restore.ps1 -ListOnly    # Just list available backups on Drive
#>

param(
    [switch]$Local,
    [switch]$ListOnly,
    [string]$FilePath
)

$ErrorActionPreference = "Stop"

# ─── CONFIG ─────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile   = Join-Path $ScriptDir ".env"
$DumpDir   = Join-Path $ScriptDir "dumps"

if (-not (Test-Path $DumpDir)) { New-Item -ItemType Directory -Path $DumpDir -Force | Out-Null }

# Parse .env
$Config = @{}
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#')) {
            $parts = $line -split '=', 2
            if ($parts.Length -eq 2) { $Config[$parts[0]] = $parts[1] }
        }
    }
}

$MySqlHost = if ($Config['MYSQL_HOST'])     { $Config['MYSQL_HOST'] }     else { 'localhost' }
$MySqlPort = if ($Config['MYSQL_PORT'])     { $Config['MYSQL_PORT'] }     else { '3306' }
$MySqlUser = if ($Config['MYSQL_USER'])     { $Config['MYSQL_USER'] }     else { 'root' }
$MySqlPass = if ($Config['MYSQL_PASSWORD']) { $Config['MYSQL_PASSWORD'] } else { '' }
$MySqlDB   = if ($Config['MYSQL_DATABASE']) { $Config['MYSQL_DATABASE'] } else { 'hospital_db' }

function Write-Step {
    param([string]$Msg)
    Write-Host "`n  >> $Msg" -ForegroundColor Cyan
}

# ─── LIST DRIVE BACKUPS ─────────────────────────────────
Write-Step "Listing backups on Google Drive..."
$nodeScript = Join-Path $ScriptDir "upload-to-drive.js"
& node $nodeScript list

if ($ListOnly) { exit 0 }

# ─── SELECT BACKUP ──────────────────────────────────────
$gzFile = $null

if ($Local) {
    if ($FilePath) {
        $gzFile = $FilePath
    } else {
        # List local backups
        $localFiles = Get-ChildItem -Path $DumpDir -Filter "*.sql.gz" | Sort-Object LastWriteTime -Descending
        if ($localFiles.Count -eq 0) {
            Write-Host "`n  No local backups found in $DumpDir" -ForegroundColor Red
            exit 1
        }
        Write-Host "`n  Local backups:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $localFiles.Count; $i++) {
            $sizeMB = [math]::Round($localFiles[$i].Length / 1MB, 2)
            Write-Host "    $($i+1). $($localFiles[$i].Name) ($sizeMB MB)"
        }
        $choice = Read-Host "`n  Enter number to restore (or 'q' to quit)"
        if ($choice -eq 'q') { exit 0 }
        $idx = [int]$choice - 1
        if ($idx -lt 0 -or $idx -ge $localFiles.Count) {
            Write-Host "  Invalid selection." -ForegroundColor Red
            exit 1
        }
        $gzFile = $localFiles[$idx].FullName
    }
} else {
    # Download from Drive
    $choice = Read-Host "`n  Enter backup NUMBER to download and restore (or 'q' to quit)"
    if ($choice -eq 'q') { exit 0 }

    Write-Step "Downloading backup #$choice from Google Drive..."
    & node $nodeScript download $choice
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  Download failed." -ForegroundColor Red
        exit 1
    }

    # Find the most recently downloaded file
    $gzFile = Get-ChildItem -Path $ScriptDir -Filter "*.sql.gz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($gzFile) {
        # Move to dumps dir
        $dest = Join-Path $DumpDir $gzFile.Name
        Move-Item $gzFile.FullName $dest -Force
        $gzFile = $dest
    }
}

if (-not $gzFile -or -not (Test-Path $gzFile)) {
    Write-Host "  Backup file not found." -ForegroundColor Red
    exit 1
}

Write-Host "`n  Selected: $gzFile" -ForegroundColor Green

# ─── CONFIRM ────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Red
Write-Host "  ║  WARNING: This will OVERWRITE the current    ║" -ForegroundColor Red
Write-Host "  ║  database '$MySqlDB'.                        ║" -ForegroundColor Red
Write-Host "  ║  All current data will be REPLACED.          ║" -ForegroundColor Red
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "  Type 'RESTORE' to confirm"
if ($confirm -ne 'RESTORE') {
    Write-Host "  Aborted." -ForegroundColor Yellow
    exit 0
}

# ─── DECOMPRESS ─────────────────────────────────────────
Write-Step "Decompressing backup..."
$sqlFile = $gzFile -replace '\.gz$', ''

$inputStream  = [System.IO.File]::OpenRead($gzFile)
$outputStream = [System.IO.File]::Create($sqlFile)
$gzipStream   = New-Object System.IO.Compression.GZipStream($inputStream, [System.IO.Compression.CompressionMode]::Decompress)

$gzipStream.CopyTo($outputStream)
$gzipStream.Close()
$outputStream.Close()
$inputStream.Close()

$sqlSize = [math]::Round((Get-Item $sqlFile).Length / 1MB, 2)
Write-Host "  Decompressed: $sqlFile ($sqlSize MB)"

# ─── RESTORE ────────────────────────────────────────────
Write-Step "Restoring to MySQL database '$MySqlDB'..."

$mysqlArgs = @(
    "--host=$MySqlHost",
    "--port=$MySqlPort",
    "--user=$MySqlUser",
    $MySqlDB
)
if ($MySqlPass) {
    $mysqlArgs = @("--password=$MySqlPass") + $mysqlArgs
}

# Pipe the SQL file into mysql
$restoreProcess = Start-Process -FilePath "mysql" -ArgumentList $mysqlArgs `
    -RedirectStandardInput $sqlFile -RedirectStandardError "$DumpDir\restore_err.tmp" `
    -NoNewWindow -Wait -PassThru

# Clean up decompressed SQL
Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue

if ($restoreProcess.ExitCode -ne 0) {
    $errMsg = Get-Content "$DumpDir\restore_err.tmp" -Raw -ErrorAction SilentlyContinue
    Write-Host "`n  RESTORE FAILED: $errMsg" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  ✅ RESTORE COMPLETE!" -ForegroundColor Green
Write-Host "  Database '$MySqlDB' has been restored successfully." -ForegroundColor Green
Write-Host "  You may need to restart the application server." -ForegroundColor Yellow
Write-Host ""
