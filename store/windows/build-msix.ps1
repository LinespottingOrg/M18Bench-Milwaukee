# Build the M18 Bench Microsoft Store package on Windows.
# Partner Center must already have the app name reserved.
# Set M18_STORE_PUBLISHER to the exact publisher from Partner Center, Account settings.
# Example: CN=12345678-1234-1234-1234-1234567890AB

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$publisher = if ($env:M18_STORE_PUBLISHER) { $env:M18_STORE_PUBLISHER } else { "CN=LineSpotting AB" }
Set-Location $root
npm run build
python store\windows\assemble_app.py
npx --yes @electron/packager store\windows\app "M18 Bench" --platform=win32 --arch=x64 --out=store\windows\build --overwrite --asar=false --executable-name=M18Bench --electron-version=33.4.11
$layout = Get-ChildItem store\windows\build -Directory | Select-Object -First 1
Copy-Item store\windows\Assets $layout.FullName\Assets -Recurse -Force
$manifest = Get-Content store\windows\AppxManifest.xml -Raw
$manifest = $manifest.Replace("CN=LineSpotting AB", $publisher)
$manifestPath = Join-Path $layout.FullName "AppxManifest.xml"
Set-Content -Path $manifestPath -Value $manifest -Encoding utf8
New-Item -ItemType Directory -Force store\windows\out | Out-Null
$msix = Join-Path $root "store\windows\out\M18Bench-1.0.0.0-x64.msix"
if (Get-Command makeappx -ErrorAction SilentlyContinue) {
  makeappx pack /d $layout.FullName /p $msix /o
} else {
  python store\windows\pack_msix.py $layout.FullName $manifestPath $msix
}
Write-Host "Package: $msix"
Write-Host "Sign it with the Partner Center publisher, then upload. Do not upload an unsigned package."
if ($env:M18_STORE_PFX) {
  signtool sign /fd SHA256 /a /f $env:M18_STORE_PFX /p $env:M18_STORE_PFX_PASSWORD $msix
}
