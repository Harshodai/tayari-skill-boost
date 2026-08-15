import { cp, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const staging = path.join(root, 'release', 'job-tayari-chrome-extension');
const output = path.join(root, 'release', 'Job-Tayari-Chrome-Extension.zip');
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
await cp(path.join(root, 'extension'), staging, { recursive: true });
await rm(path.join(staging, 'store'), { recursive: true, force: true });
await rm(path.join(staging, 'auth', 'tests'), { recursive: true, force: true });
await rm(output, { force: true });
await execFileAsync('zip', ['-qr', output, 'job-tayari-chrome-extension'], { cwd: path.join(root, 'release') });
await rm(staging, { recursive: true, force: true });
console.log(`[extension-package] ${output}`);
