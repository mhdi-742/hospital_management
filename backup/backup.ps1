<#
.SYNOPSIS
    Hospital Management System — Automated MySQL Backup
.DESCRIPTION
    1. Runs mysqldump to export hospital_db
    2. Compresses the dump with GZip
    3. Uploads to Google Drive via Service Account
    4. Prunes old backups (local + Drive)
    5. Logs everything
.USAGE
    .\backup.ps1              # Full backup (dump + compress + upload + prune)
    .\backup.ps1 -DumpOnly    # Only create local dump, don't upload
#>

param(
    [switch]$DumpOnly
)

$ErrorActionPreference = "Stop"

# ─── CONFIG ─────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile   = Join-Path $ScriptDir ".env"
$LogDir    = Join-Path $ScriptDir "logs"
$DumpDir   = Join-Path $ScriptDir "dumps"

# Create directories
if (-not (Test-Path $LogDir))  { New-Item -ItemType Directory -Path $LogDir  -Force | Out-Null }
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

$MySqlHost   = if ($Config['MYSQL_HOST'])     { $Config['MYSQL_HOST'] }     else { 'localhost' }
$MySqlPort   = if ($Config['MYSQL_PORT'])     { $Config['MYSQL_PORT'] }     else { '3306' }
$MySqlUser   = if ($Config['MYSQL_USER'])     { $Config['MYSQL_USER'] }     else { 'root' }
$MySqlPass   = if ($Config['MYSQL_PASSWORD']) { $Config['MYSQL_PASSWORD'] } else { '' }
$MySqlDB     = if ($Config['MYSQL_DATABASE']) { $Config['MYSQL_DATABASE'] } else { 'hospital_db' }
$RetainLocal = if ($Config['BACKUP_RETENTION_LOCAL']) { [int]$Config['BACKUP_RETENTION_LOCAL'] } else { 3 }
$RetainDrive = if ($Config['BACKUP_RETENTION_DRIVE']) { [int]$Config['BACKUP_RETENTION_DRIVE'] } else { 7 }

# Timestamp
$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$SqlFile   = Join-Path $DumpDir "${MySqlDB}_${Timestamp}.sql"
$GzFile    = "${SqlFile}.gz"
$LogFile   = Join-Path $LogDir "backup_${Timestamp}.log"

# ─── LOGGING ────────────────────────────────────────────
function Log {
    param([string]$Message, [string]$Level = "INFO")
    $entry = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$Level] $Message"
    Write-Host $entry
    Add-Content -Path $LogFile -Value $entry
}

# ─── MAIN ───────────────────────────────────────────────
try {
    Log "========== BACKUP STARTED =========="
    Log "Database: ${MySqlDB} @ ${MySqlHost}:${MySqlPort}"

    # Step 1: mysqldump
    Log "Step 1/4: Running mysqldump..."
    # Build mysqldump command string
    $passArg = ""
    if ($MySqlPass) { $passArg = "--password=$MySqlPass " }
    $dumpCmd = "mysqldump ${passArg}--host=$MySqlHost --port=$MySqlPort --user=$MySqlUser --single-transaction --routines --triggers --add-drop-table $MySqlDB"

    # Run via cmd /c and redirect output to file
    cmd /c "$dumpCmd > `"$SqlFile`" 2> `"$LogDir\mysqldump_err.tmp`""

    if ($LASTEXITCODE -ne 0) {
        $errMsg = Get-Content "$LogDir\mysqldump_err.tmp" -Raw -ErrorAction SilentlyContinue
        throw "mysqldump failed (exit code $LASTEXITCODE): $errMsg"
    }

    $sqlSize = [math]::Round((Get-Item $SqlFile).Length / 1MB, 2)
    Log "Dump created: $SqlFile ($sqlSize MB)"

    # Step 2: GZip compress
    Log "Step 2/4: Compressing with GZip..."
    $inputStream  = [System.IO.File]::OpenRead($SqlFile)
    $outputStream = [System.IO.File]::Create($GzFile)
    $gzipStream   = New-Object System.IO.Compression.GZipStream($outputStream, [System.IO.Compression.CompressionLevel]::Optimal)

    $inputStream.CopyTo($gzipStream)
    $gzipStream.Close()
    $outputStream.Close()
    $inputStream.Close()

    # Remove uncompressed .sql file
    Remove-Item $SqlFile -Force

    $gzSize = [math]::Round((Get-Item $GzFile).Length / 1MB, 2)
    $ratio  = if ($sqlSize -gt 0) { [math]::Round((1 - $gzSize / $sqlSize) * 100, 1) } else { 0 }
    Log "Compressed: $GzFile ($gzSize MB, ${ratio}% reduction)"

    # Step 3: Upload to Google Drive
    if (-not $DumpOnly) {
        Log "Step 3/4: Uploading to Google Drive..."
        $nodeScript = Join-Path $ScriptDir "upload-to-drive.js"
        $uploadResult = & node $nodeScript upload $GzFile 2>&1
        $uploadResult | ForEach-Object { $msg = "$_"; Log $msg }

        if ($LASTEXITCODE -ne 0) {
            Log "Drive upload FAILED - backup is saved locally at: $GzFile" "WARN"
        } else {
            Log "Upload complete."
        }

        # Step 4: Prune old backups
        Log "Step 4/4: Pruning old backups..."

        # Prune Drive
        $pruneResult = & node $nodeScript prune $RetainDrive 2>&1
        $pruneResult | ForEach-Object { $msg = "$_"; Log $msg }

        # Prune local dumps
        $localFiles = Get-ChildItem -Path $DumpDir -Filter "*.sql.gz" | Sort-Object LastWriteTime -Descending
        if ($localFiles.Count -gt $RetainLocal) {
            $toDelete = $localFiles | Select-Object -Skip $RetainLocal
            $toDelete | ForEach-Object {
                $fname = $_.Name
                Remove-Item $_.FullName -Force
                Log "Deleted local: $fname"
            }
        }
        Log "Local backups kept: $([math]::Min($localFiles.Count, $RetainLocal))"
    } else {
        Log "Step 3/4: SKIPPED (DumpOnly mode)"
        Log "Step 4/4: SKIPPED (DumpOnly mode)"
    }

    # Prune old log files (keep last 14)
    $logFiles = Get-ChildItem -Path $LogDir -Filter "backup_*.log" | Sort-Object LastWriteTime -Descending
    if ($logFiles.Count -gt 14) {
        $logFiles | Select-Object -Skip 14 | ForEach-Object { Remove-Item $_.FullName -Force }
    }

    Log "========== BACKUP COMPLETE =========="

} catch {
    $errMessage = $_.Exception.Message
    $errStack = $_.ScriptStackTrace
    Log "FATAL ERROR: $errMessage" "ERROR"
    Log "Stack: $errStack" "ERROR"
    exit 1
}
