param(
    [string]$Target = 'netcup-server',
    [string]$PublicUrl = 'http://152.53.199.71:8321/',
    [switch]$SkipBuild
)

# Builds the site and puts it on the relay server, keeping the previous builds for a one-line
# rollback. nginx serves the files and proxies /api/ to the relay; nothing here touches the relay.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$archive = $null
Push-Location $root
try {
    if (-not $SkipBuild) {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'build failed' }
    }
    if (-not (Test-Path 'dist/index.html')) { throw 'dist/index.html is missing' }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $archive = Join-Path $env:TEMP ('slag-site-{0}.tar.gz' -f $stamp)
    $remote = '/tmp/slag-site-{0}.tar.gz' -f $stamp
    $release = '/var/www/slag-site/releases/{0}' -f $stamp

    tar -czf $archive -C dist .
    if ($LASTEXITCODE -ne 0) { throw 'tar failed' }

    scp -q $archive ('{0}:{1}' -f $Target, $remote)
    if ($LASTEXITCODE -ne 0) { throw 'upload failed' }

    # One ssh call, so a half-applied release cannot happen: the symlink switch is the only
    # moment the public site changes, and that switch is atomic.
    $steps = 'set -eu; mkdir -p {0}; tar -xzf {1} -C {0}; rm -f {1}; chown -R www-data:www-data {0}; ln -sfn {0} /var/www/slag-site/current; ls -1dt /var/www/slag-site/releases/* | tail -n +6 | xargs -r rm -rf; echo release: {0}'
    ssh $Target ($steps -f $release, $remote)
    if ($LASTEXITCODE -ne 0) { throw 'remote step failed' }

    $response = Invoke-WebRequest -Uri $PublicUrl -UseBasicParsing -TimeoutSec 20
    Write-Output ('site: {0} -> {1} ({2} bytes)' -f $PublicUrl, $response.StatusCode, $response.RawContentLength)

    # Report, do not gate: a dead relay must not block a deploy of the static site.
    try {
        $health = Invoke-WebRequest -Uri ($PublicUrl.TrimEnd('/') + '/health') -UseBasicParsing -TimeoutSec 20
        Write-Output ('relay: /health -> {0} {1}' -f $health.StatusCode, $health.Content)
    }
    catch {
        Write-Output ('relay: /health did not answer - {0}' -f $_.Exception.Message)
    }

    Write-Output ('release: {0}' -f $stamp)
}
finally {
    Pop-Location
    if ($archive -and (Test-Path $archive)) { Remove-Item $archive -Force }
}
