// Chạy toàn bộ hệ thống ở chế độ phát triển: 2 service + API Gateway + frontend (Vite).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));

const procs = [
  ['location', 'services/location', ['tsx', 'watch', 'src/index.ts'], { PORT: '4002' }],
  ['content', 'services/content', ['tsx', 'watch', 'src/index.ts'], { PORT: '4003' }],
  ['gateway', 'services/gateway', ['tsx', 'watch', 'src/index.ts'], {}],
  ['web', 'apps/web', ['vite'], {}],
];
const colors = ['\x1b[36m', '\x1b[33m', '\x1b[35m', '\x1b[32m', '\x1b[34m', '\x1b[31m'];
const children = procs.map(([name, cwd, args, env], i) => {
  const child = spawn('npx.cmd', args, {
    cwd: join(root, cwd),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });
  const prefix = `${colors[i]}[${name}]\x1b[0m `;
  const out = (d) => process.stdout.write(d.toString().split('\n').filter(Boolean).map((l) => prefix + l).join('\n') + '\n');
  child.stdout.on('data', out);
  child.stderr.on('data', out);
  return child;
});
const shutdown = () => {
  children.forEach((c) => c.kill('SIGTERM'));
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
