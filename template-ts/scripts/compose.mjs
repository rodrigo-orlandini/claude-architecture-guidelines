// Portable `docker compose` wrapper: uses native Docker when available,
// falls back to Docker Engine inside WSL on Windows without Docker Desktop.
// Usage: node scripts/compose.mjs -f docker-compose.test.yml up -d --wait
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)

function works(cmd, cmdArgs) {
  const probe = spawnSync(cmd, [...cmdArgs, 'compose', 'version'], { stdio: 'ignore', shell: false })
  return probe.status === 0
}

let cmd = 'docker'
let prefix = []
if (!works('docker', [])) {
  if (process.platform === 'win32' && works('wsl', ['docker'])) {
    cmd = 'wsl'
    prefix = ['docker']
  } else {
    console.error('docker compose not found (native or via WSL). See _architecture/SETUP.md section 1.')
    process.exit(1)
  }
}

const result = spawnSync(cmd, [...prefix, 'compose', ...args], { stdio: 'inherit', shell: false })
process.exit(result.status ?? 1)
