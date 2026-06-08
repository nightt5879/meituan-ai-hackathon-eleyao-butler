param(
  [string]$Target = $env:OPENCLAW_SKILLS_DIR,
  [string]$RepoUrl = "https://github.com/nightt5879/meituan-ai-hackathon-eleyao-butler.git"
)

$ErrorActionPreference = "Stop"

if (-not $Target) {
  $Target = Join-Path $HOME ".openclaw\skills"
}

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("eleyao-skills-" + [System.Guid]::NewGuid().ToString("N"))
try {
  git clone --depth 1 $RepoUrl $workDir | Out-Null
  node (Join-Path $workDir "skills\install-eleyao-skills.mjs") --target $Target --force
} finally {
  if (Test-Path $workDir) {
    Remove-Item $workDir -Recurse -Force
  }
}
