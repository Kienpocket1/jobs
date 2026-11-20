const crypto = require('crypto');
const { execFile } = require('child_process');

// Serial ổ cứng chứa ổ C:, fallback sang ổ vật lý đầu tiên / Win32_PhysicalMedia.
const PS = `
$d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" |
  Get-CimAssociatedInstance -ResultClassName Win32_DiskPartition |
  Get-CimAssociatedInstance -ResultClassName Win32_DiskDrive | Select-Object -First 1
$s = $d.SerialNumber
if (-not $s) { $s = (Get-CimInstance Win32_DiskDrive | Sort-Object Index | Select-Object -First 1).SerialNumber }
if (-not $s) { $s = (Get-CimInstance Win32_PhysicalMedia | Where-Object { $_.SerialNumber } | Select-Object -First 1).SerialNumber }
Write-Output $s`;

function readDiskSerial() {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS], { windowsHide: true, timeout: 15000 },
      (err, out) => {
        const s = (out || '').trim();
        if (err || !s) return reject(new Error('Không đọc được serial ổ cứng'));
        resolve(s);
      });
  });
}

const group = (str, size) => str.match(new RegExp(`.{1,${size}}`, 'g')).join('-');

// Mã máy: SHA-256(serial) -> 16 ký tự hex -> XXXX-XXXX-XXXX-XXXX
function machineIdFromSerial(serial) {
  const h = crypto.createHash('sha256').update(serial.trim().toUpperCase()).digest('hex').toUpperCase();
  return group(h.slice(0, 16), 4);
}

const normId = (id) => String(id).toUpperCase().replace(/[^0-9A-F]/g, '');
const normKey = (k) => String(k).toUpperCase().replace(/[^A-Z2-7]/g, '');

// Base32 (RFC 4648, không padding): chỉ A-Z và 2-7, dễ đọc, dán không lỗi.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32encode(buf) {
  let bits = '', out = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}
function b32decode(str) {
  let bits = '';
  for (const c of str) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

// Key = Base32( 3 byte hạn dùng + 64 byte chữ ký Ed25519 của "mã máy|hạn" ), nhóm 5 ký tự.
// Tool cấp key ký bằng PRIVATE key (chỉ nằm ở máy NDaudio). App chỉ có PUBLIC key -> kiểm tra được, KHÔNG tạo được key.
// Hạn = số ngày tính từ 2026-01-01 (+1), 0 = vĩnh viễn. Sửa hạn trong key thì chữ ký sai -> bị chặn.
const EPOCH = Date.UTC(2026, 0, 1);
const DAY = 86400000;
const KEY_BYTES = 3 + 64;
const KEY_LEN = Math.ceil(KEY_BYTES * 8 / 5); // 108 ký tự
const expToDays = (exp) => {
  if (!exp) return 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) throw new Error('Ngày hết hạn không hợp lệ');
  const n = Math.round((Date.parse(exp + 'T00:00:00Z') - EPOCH) / DAY) + 1;
  if (n < 1 || n > 0xffffff) throw new Error('Ngày hết hạn ngoài phạm vi');
  return n;
};
const daysToExp = (n) => (n ? new Date(EPOCH + (n - 1) * DAY).toISOString().slice(0, 10) : null);
const message = (id, days) => Buffer.from(`NDAUDIO|${group(id, 4)}|${days}`);
const today = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// exp: 'YYYY-MM-DD' (dùng hết ngày đó) hoặc null = vĩnh viễn
function makeKey(privateKeyPem, machineId, exp = null) {
  const id = normId(machineId);
  if (id.length !== 16) throw new Error('Mã máy không hợp lệ (cần 16 ký tự dạng XXXX-XXXX-XXXX-XXXX)');
  const days = expToDays(exp);
  const head = Buffer.from([days >> 16, (days >> 8) & 255, days & 255]);
  const sig = crypto.sign(null, message(id, days), privateKeyPem);
  return group(b32encode(Buffer.concat([head, sig])), 5);
}

// -> { ok, exp, reason: 'invalid' | 'expired' }
function verifyKey(publicKeyPem, machineId, key, now = new Date()) {
  const k = normKey(key), id = normId(machineId);
  if (k.length !== KEY_LEN || id.length !== 16) return { ok: false, reason: 'invalid' };
  const buf = b32decode(k);
  const days = (buf[0] << 16) | (buf[1] << 8) | buf[2];
  let good = false;
  try { good = crypto.verify(null, message(id, days), publicKeyPem, buf.subarray(3, KEY_BYTES)); } catch { good = false; }
  if (!good) return { ok: false, reason: 'invalid' };
  const exp = daysToExp(days);
  if (exp && today(now) > exp) return { ok: false, exp, reason: 'expired' };
  return { ok: true, exp };
}

module.exports = { readDiskSerial, machineIdFromSerial, makeKey, verifyKey, today };
