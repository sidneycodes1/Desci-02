const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const packageRoot = path.resolve(__dirname, '..');
const isWindows = os.platform() === 'win32';
const forgeBinary = isWindows ? 'forge.exe' : 'forge';
const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();
const forgePath = path.join(homeDir, '.foundry', 'bin', forgeBinary);
const tempRoot = path.join(os.tmpdir(), 'sciagent-contracts');
const outDir = path.join(tempRoot, 'out');
const cacheDir = path.join(tempRoot, 'cache');
const forgeHome = path.join(os.tmpdir(), 'forge-home');
const localAppData = path.join(forgeHome, 'AppData', 'Local');
const roamingAppData = path.join(forgeHome, 'AppData', 'Roaming');

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const command = process.argv[2];
  const extraArgs = process.argv.slice(3);

  if (!command) {
    console.error('Usage: node scripts/forge-runner.cjs <build|test|coverage|fmt> [...args]');
    process.exit(1);
  }

  ensureDirectory(outDir);
  ensureDirectory(cacheDir);
  ensureDirectory(localAppData);
  ensureDirectory(roamingAppData);

  // Fixed: do not override HOME/USERPROFILE — that isolated forge from its
  // solc cache at %USERPROFILE%/.foundry and caused network timeout on test.
  // Pass through real env; only add temp dirs for out/cache.
  const env = {
    ...process.env
  };

  const args = [command, '--root', packageRoot];

  if (command === 'build' || command === 'test' || command === 'coverage') {
    args.push('--out', outDir, '--cache-path', cacheDir);
  }

  if (command === 'coverage') {
    args.push('--report', 'lcov');
  }

  const forwardedArgs = extraArgs[0] === '--' ? extraArgs.slice(1) : extraArgs;

  if (command === 'fmt') {
    args.push(...forwardedArgs);
  } else if (forwardedArgs.length > 0) {
    args.push(...forwardedArgs);
  }

  const result = spawnSync(forgePath, args, {
    cwd: packageRoot,
    env,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
