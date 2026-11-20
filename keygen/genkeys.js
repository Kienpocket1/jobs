// Tạo cặp khóa Ed25519 MỘT LẦN DUY NHẤT.
// keygen/private.pem: chỉ ở máy NDaudio, KHÔNG gửi ai, nhớ sao lưu. Mất file này = không cấp được key cho app đã phát hành.
// config/public.pem: đóng gói vào app phát nhạc, lộ cũng không sao.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const priv = path.join(__dirname, 'private.pem');
const pub = path.join(__dirname, '..', 'config', 'public.pem');
if (fs.existsSync(priv)) {
  console.error('Đã có keygen/private.pem. Không tạo lại: tạo lại sẽ làm mọi key đã cấp mất hiệu lực.');
  process.exit(1);
}
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
fs.writeFileSync(pub, publicKey.export({ type: 'spki', format: 'pem' }));
console.log('Đã tạo keygen/private.pem (GIỮ BÍ MẬT, SAO LƯU) và config/public.pem');
