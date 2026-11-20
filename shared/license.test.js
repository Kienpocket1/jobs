const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const L = require('./license');

const PUB = fs.readFileSync(path.join(__dirname, '..', 'config', 'public.pem'), 'utf8');
const PRIV = fs.readFileSync(path.join(__dirname, '..', 'keygen', 'private.pem'), 'utf8');

const id = L.machineIdFromSerial('WD-TEST-123');
assert.match(id, /^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);

// vĩnh viễn
const key = L.makeKey(PRIV, id);
assert.match(key, /^[A-Z2-7]{5}(-[A-Z2-7]{1,5})+$/);
assert.strictEqual(key.replace(/-/g, '').length, 108);
assert.deepStrictEqual(L.verifyKey(PUB, id, key), { ok: true, exp: null });
assert.ok(L.verifyKey(PUB, id, ' ' + key.toLowerCase().replace(/-/g, ' ') + '\n').ok, 'không phân biệt hoa thường/khoảng trắng/xuống dòng');
const flip = (k, i) => k.slice(0, i) + (k[i] === 'A' ? 'B' : 'A') + k.slice(i + 1);
assert.ok(!L.verifyKey(PUB, id, flip(key, 40)).ok, 'sai 1 ký tự phải bị chặn');
assert.ok(!L.verifyKey(PUB, L.machineIdFromSerial('OTHER-DISK'), key).ok, 'ổ cứng khác phải bị chặn');
assert.ok(!L.verifyKey(PUB, id, 'abc').ok, 'key rác phải bị chặn');

// key ký bằng private key khác (kẻ gian tự làm tool) phải bị chặn
const fake = crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
assert.ok(!L.verifyKey(PUB, id, L.makeKey(fake, id)).ok, 'private key giả phải bị chặn');
// app chỉ có public key: không dùng để tạo key được
assert.throws(() => L.makeKey(PUB, id));

// có hạn: dùng được hết ngày hết hạn, sang ngày sau bị chặn
const k2 = L.makeKey(PRIV, id, '2027-03-15');
const at = (d) => new Date(d + 'T12:00:00');
assert.deepStrictEqual(L.verifyKey(PUB, id, k2, at('2027-03-15')), { ok: true, exp: '2027-03-15' });
assert.deepStrictEqual(L.verifyKey(PUB, id, k2, at('2027-03-16')), { ok: false, exp: '2027-03-15', reason: 'expired' });
// sửa phần hạn trong key (gia hạn trái phép) phải bị chặn
const forged = L.makeKey(PRIV, id, '2099-01-01').slice(0, 5) + k2.slice(5);
assert.strictEqual(L.verifyKey(PUB, id, forged, at('2027-03-16')).reason, 'invalid');
assert.throws(() => L.makeKey(PRIV, id, '15/03/2027'));

L.readDiskSerial().then(s => {
  console.log('Serial máy này OK, mã máy:', L.machineIdFromSerial(s));
  console.log('Ví dụ key:', key);
  console.log('Tất cả test license PASS');
}).catch(e => { console.error('FAIL đọc serial:', e.message); process.exit(1); });
