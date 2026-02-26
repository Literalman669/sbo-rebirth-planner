# Deploy SBO DPO Space to Hugging Face
# Run this from the sbo-dpo-space folder or project root
# You need: Git installed, HF token with write access at https://huggingface.co/settings/tokens

$SPACE = "Bigtreeman669/SBORebirth"
$REPO = "https://huggingface.co/spaces/$SPACE"
$TEMP_DIR = "$env:TEMP\hf-sbo-deploy"

Write-Host "Deploying to Hugging Face Space: $SPACE" -ForegroundColor Cyan

# Find script location and sbo-dpo-space folder
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceDir = $scriptDir
if (-not (Test-Path "$sourceDir\Dockerfile")) {
    Write-Host "Error: Dockerfile not found in $sourceDir" -ForegroundColor Red
    exit 1
}

# Clone or update
if (Test-Path $TEMP_DIR) { Remove-Item -Recurse -Force $TEMP_DIR }
Write-Host "Cloning Space repo..." -ForegroundColor Yellow
$cloneResult = git clone $REPO $TEMP_DIR 2>&1
if (-not (Test-Path "$TEMP_DIR\.git")) {
    Write-Host "Clone failed: $cloneResult" -ForegroundColor Red
    exit 1
}

Set-Location $TEMP_DIR

# Remove any default files HF may have added
Remove-Item -Path "app.py" -ErrorAction SilentlyContinue
Remove-Item -Path "Dockerfile" -ErrorAction SilentlyContinue
Remove-Item -Path "requirements.txt" -ErrorAction SilentlyContinue

# Copy our files
Copy-Item "$sourceDir\Dockerfile" -Destination "."
Copy-Item "$sourceDir\app.py" -Destination "."
Copy-Item "$sourceDir\sbo_dataset.json" -Destination "."
Copy-Item "$sourceDir\README.md" -Destination "." -ErrorAction SilentlyContinue

Write-Host "Files copied. Committing and pushing..." -ForegroundColor Yellow
git add Dockerfile app.py sbo_dataset.json README.md
git status
git commit -m "Add SBO:Rebirth DPO training (Dockerfile, app.py, dataset)"
git push

Set-Location $scriptDir
Remove-Item -Recurse -Force $TEMP_DIR -ErrorAction SilentlyContinue

Write-Host "`nDone. Check https://huggingface.co/spaces/$SPACE" -ForegroundColor Green
