import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = process.cwd();
const out = path.join(root, 'native-host', 'bin');
await mkdir(out, { recursive: true });
const targets = [['darwin','arm64','com.jobtayari.browser'],['linux','amd64','com.jobtayari.browser'],['windows','amd64','com.jobtayari.browser.exe']];
for (const [goos, goarch, name] of targets) {
  const result = spawnSync('go', ['build','-trimpath','-ldflags','-s -w','-o',path.join(out, `${goos}-${goarch}`, name), '.'], { cwd: path.join(root,'native-host'), env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: '0' }, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
