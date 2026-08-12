param(
  [switch]$ReproducibilityCheck
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$contract = Get-Content -Raw -LiteralPath (Join-Path $root "config\production\release_build_contract.json") | ConvertFrom-Json
$defaultJavaHome = "C:\Program Files\Android\jdk\jdk-17.0.10"
$javaHome = if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) { $env:JAVA_HOME } else { $defaultJavaHome }
if (-not (Test-Path (Join-Path $javaHome "bin\java.exe"))) { throw "JDK 17 not found. Set JAVA_HOME before building." }
if (-not $ReproducibilityCheck) { throw "Formal release builds require -ReproducibilityCheck." }
$env:JAVA_HOME = $javaHome
$env:Path = "$(Join-Path $javaHome 'bin');$env:Path"

function Invoke-Checked([string]$FilePath, [string[]]$Arguments) {
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($Arguments -join ' ')" }
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Resolve-ApkSigner {
  $candidates = @()
  foreach ($sdk in @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $env:LOCALAPPDATA "Android\Sdk"))) {
    if (-not $sdk -or -not (Test-Path -LiteralPath $sdk)) { continue }
    $candidates += Get-ChildItem -LiteralPath (Join-Path $sdk "build-tools") -Directory -ErrorAction SilentlyContinue |
      Sort-Object Name -Descending |
      ForEach-Object { Join-Path $_.FullName "apksigner.bat" } |
      Where-Object { Test-Path -LiteralPath $_ }
  }
  if ($candidates.Count -eq 0) { throw "Android apksigner was not found in ANDROID_HOME, ANDROID_SDK_ROOT or the local Android SDK." }
  return $candidates[0]
}

function Invoke-ReleaseBuild([string]$Label) {
  Write-Host "Running clean signed release build: $Label"
  Invoke-Checked $gradle @("-p", $androidRoot, $contract.androidBuild.cleanTask, $contract.androidBuild.apkTask, $contract.androidBuild.aabTask, "--no-daemon", "--console=plain")
  $rows = @{}
  foreach ($artifact in $contract.androidBuild.artifacts) {
    $source = Join-Path $root $artifact.sourcePath
    if (-not (Test-Path -LiteralPath $source)) { throw "Expected release artifact missing: $($artifact.sourcePath)" }
    $rows[$artifact.kind] = [ordered]@{ path = $artifact.sourcePath; bytes = (Get-Item -LiteralPath $source).Length; sha256 = Get-Sha256 $source }
  }
  return $rows
}

Push-Location $root
try {
  Invoke-Checked "node" @("tools\validate-release-build-contract.mjs", "--strict-release", "--phase=prebuild")
  Invoke-Checked "npm.cmd" @("run", "task:preflight")
  Invoke-Checked "npm.cmd" @("run", "android:sync")

  $outputDir = Join-Path $root "outputs\release"
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  $androidRoot = Join-Path $root $contract.androidBuild.workingDirectory
  $gradle = Join-Path $root $contract.androidBuild.gradleWrapper
  $gradleReport = Join-Path $root $contract.sbom.gradleDependencyReportPath
  $dependencyOutput = & $gradle -p $androidRoot :app:dependencies --configuration releaseRuntimeClasspath --no-daemon --console=plain 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Gradle releaseRuntimeClasspath resolution failed." }
  $dependencyOutput | Out-File -LiteralPath $gradleReport -Encoding utf8
  Invoke-Checked "npm.cmd" @("run", "release:sbom")

  $first = Invoke-ReleaseBuild "1 of 2"
  $second = Invoke-ReleaseBuild "2 of 2"
  $comparisons = @()
  $reproducible = $true
  foreach ($kind in $contract.reproducibility.compareKinds) {
    $match = $first[$kind].sha256 -eq $second[$kind].sha256
    if (-not $match) { $reproducible = $false }
    $comparisons += [ordered]@{ kind = $kind; firstSha256 = $first[$kind].sha256; secondSha256 = $second[$kind].sha256; match = $match }
  }
  $reproReport = [ordered]@{
    schema = "idlewuxia.release_reproducibility_report.v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    buildCount = 2
    pass = $reproducible
    comparisons = $comparisons
  }
  $reproReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $root $contract.reproducibility.reportPath) -Encoding utf8
  if (-not $reproducible) { throw "Release artifacts are not byte-for-byte reproducible across two clean builds." }

  foreach ($artifact in $contract.androidBuild.artifacts) {
    Copy-Item -LiteralPath (Join-Path $root $artifact.sourcePath) -Destination (Join-Path $root $artifact.publishedPath) -Force
  }
  $mappingSource = Join-Path $root $contract.androidBuild.mappingEvidence.sourcePath
  if (-not (Test-Path -LiteralPath $mappingSource)) { throw "R8 mapping.txt was not produced." }
  Copy-Item -LiteralPath $mappingSource -Destination (Join-Path $root $contract.androidBuild.mappingEvidence.publishedPath) -Force

  $apkSigner = Resolve-ApkSigner
  $apk = Join-Path $root (($contract.androidBuild.artifacts | Where-Object kind -eq "apk").publishedPath)
  $aab = Join-Path $root (($contract.androidBuild.artifacts | Where-Object kind -eq "aab").publishedPath)
  $apkVerification = & $apkSigner verify --verbose --print-certs $apk 2>&1
  if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed." }
  foreach ($scheme in @("v1", "v2", "v3")) {
    if (($apkVerification -join "`n") -notmatch "Verified using $scheme scheme.*true") { throw "APK $scheme signature verification did not pass." }
  }
  $certificateLine = $apkVerification | Where-Object { $_ -match "Signer #1 certificate SHA-256 digest:" } | Select-Object -First 1
  if (-not $certificateLine) { throw "APK signing certificate SHA-256 digest was not reported." }
  $actualCertificate = (($certificateLine -split ":", 2)[1] -replace ":", "").Trim().ToLowerInvariant()
  $expectedCertificate = ($env:IDLEWUXIA_RELEASE_CERT_SHA256 -replace ":", "").Trim().ToLowerInvariant()
  if ($actualCertificate -ne $expectedCertificate) { throw "APK signing certificate does not match IDLEWUXIA_RELEASE_CERT_SHA256." }
  Invoke-Checked (Join-Path $javaHome "bin\jarsigner.exe") @("-verify", "-strict", $aab)
  $aabCertificateOutput = & (Join-Path $javaHome "bin\keytool.exe") -printcert -jarfile $aab 2>&1
  if ($LASTEXITCODE -ne 0) { throw "AAB signing certificate inspection failed." }
  $aabCertificateLine = $aabCertificateOutput | Where-Object { $_ -match "SHA256:" } | Select-Object -First 1
  if (-not $aabCertificateLine) { throw "AAB signing certificate SHA-256 digest was not reported." }
  $aabCertificate = (($aabCertificateLine -split "SHA256:", 2)[1] -replace ":", "").Trim().ToLowerInvariant()
  if ($aabCertificate -ne $expectedCertificate) { throw "AAB signing certificate does not match IDLEWUXIA_RELEASE_CERT_SHA256." }

  $javaVersion = (& (Join-Path $javaHome "bin\java.exe") -version 2>&1 | Select-Object -First 1).ToString()
  $gradleVersionOutput = & $gradle -p $androidRoot --version
  $gradleVersion = (($gradleVersionOutput | Where-Object { $_ -match "^Gradle " } | Select-Object -First 1) -replace "^Gradle ", "").Trim()
  $androidBuildToolsVersion = Split-Path (Split-Path $apkSigner -Parent) -Leaf
  Invoke-Checked "node" @(
    "tools\generate-release-artifact-manifest.mjs",
    "--signing-certificate-sha256=$actualCertificate",
    "--java-version=$javaVersion",
    "--gradle-version=$gradleVersion",
    "--android-build-tools-version=$androidBuildToolsVersion"
  )
  Invoke-Checked "node" @("tools\validate-release-build-contract.mjs", "--strict-release", "--phase=postbuild")
}
finally {
  Pop-Location
}
