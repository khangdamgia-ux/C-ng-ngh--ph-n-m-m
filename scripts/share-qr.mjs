import { networkInterfaces } from 'node:os';
import { writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

function lanIp() {
  const cands = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const n of list ?? []) {
      if (n.family !== 'IPv4' || n.internal) continue;
      if (/vethernet|wsl|docker|virtual|vmware|vbox|hyper-v/i.test(name)) continue;
      cands.push({ name, ip: n.address });
    }
  }
  cands.sort((a, b) => Number(/^(192\.168|10\.)/.test(b.ip)) - Number(/^(192\.168|10\.)/.test(a.ip)));
  return cands[0]?.ip;
}

let base = arg('url');
if (!base) {
  const ip = lanIp();
  if (!ip) {
    console.error('Không tìm thấy IP mạng. Hãy dùng --url <link>.');
    process.exit(1);
  }
  const port = arg('port') ?? '80';
  base = `http://${ip}${port === '80' ? '' : `:${port}`}`;
}
const target = `${base.replace(/\/$/, '')}/?src=qr`;

const file = 'qr-trang-chu.png';
writeFileSync(file, await QRCode.toBuffer(target, { margin: 2, width: 1024 }));
console.log(await QRCode.toString(target, { type: 'terminal', small: true }));
console.log(`\nLink: ${target}\nĐã lưu ảnh QR: ${file}`);
