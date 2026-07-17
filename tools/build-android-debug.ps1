$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$defaultJavaHome = "C:\Program Files\Android\jdk\jdk-17.0.10"
$javaHome = if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  $env:JAVA_HOME
} else {
  $defaultJavaHome
}

if (-not (Test-Path (Join-Path $javaHome "bin\java.exe"))) {
  throw "JDK 17 not found. Set JAVA_HOME before building."
}

$env:JAVA_HOME = $javaHome
$env:Path = "$(Join-Path $javaHome "bin");$env:Path"

Push-Location $root
try {
  & npm.cmd run android:sync
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  # A traceable APK must be produced after the current web bundle manifest.
  # Gradle's normal UP-TO-DATE result can leave an older APK in place, so this
  # evidence build intentionally reruns packaging tasks.
  & (Join-Path $root "android\gradlew.bat") -p (Join-Path $root "android") :app:assembleDebug --rerun-tasks --console=plain
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $outputDir = Join-Path $root "outputs"
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk") -Destination (Join-Path $outputDir "idlewuxia-debug.apk") -Force

  & node (Join-Path $root "tools\audit-android-debug.mjs")
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
