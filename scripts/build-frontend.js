import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.join(__dirname, '..', 'fronthend');

const npmExecPath = process.env.npm_execpath || 'npm';
const nodeExecPath = process.execPath;

const run = (args) => {
  const commandArgs = process.env.npm_execpath
    ? [npmExecPath, ...args]
    : args;

  const result = process.env.npm_execpath
    ? spawnSync(nodeExecPath, commandArgs, {
        cwd: frontendDir,
        stdio: 'inherit',
      })
    : spawnSync(npmExecPath, commandArgs, {
        cwd: frontendDir,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

  
  if (result.error) {
    console.error(`Failed to run ${args.join(' ')}:`, result.error.message);
    process.exit(1);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
};

console.log('Building frontend from', frontendDir);
run(['install']);
run(['run', 'build']);
