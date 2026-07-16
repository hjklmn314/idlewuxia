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

  & (Join-Path $root "android\gradlew.bat") -p (Join-Path $root "android") :app:assembleDebug --console=plain
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  & node (Join-Path $root "tools\audit-android-debug.mjs")
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
