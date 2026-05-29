import os from 'os';
import crypto from 'crypto';
import { networkInterfaces } from 'os';

function getFirstMAC(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    const net = nets[name];
    if (net) {
      for (const iface of net) {
        if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
          return iface.mac;
        }
      }
    }
  }
  return 'unknown';
}

export function getDeviceFingerprint(): string {
  const data = {
    cpuModel: os.cpus()[0]?.model || 'unknown',
    cpuCount: os.cpus().length,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    totalMemory: os.totalmem(),
    mac: getFirstMAC(),
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}
