const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { makeKey } = require('../shared/license');
require('../shared/edit');
// Private key chỉ nằm ở máy NDaudio (tạo bằng: npm run genkeys). Không đóng gói vào app khách.
const PRIV_FILE = path.join(__dirname, 'private.pem');
const readPriv = () => fs.readFileSync(PRIV_FILE, 'utf8');

if (process.env.NDA_USERDATA) app.setPath('userData', process.env.NDA_USERDATA); // dùng cho test
const histFile = () => path.join(app.getPath('userData'), 'history.json');
const readHist = () => { try { return JSON.parse(fs.readFileSync(histFile(), 'utf8')); } catch { return []; } };

const PHONE = /^[0-9+ .()-]{8,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

ipcMain.handle('history', readHist);
ipcMain.handle('make-key', (_e, f) => {
  const name = String(f.name || '').trim(), phone = String(f.phone || '').trim(), email = String(f.email || '').trim();
  if (!name) return { error: 'Nhập tên khách hàng.' };
  if (!PHONE.test(phone)) return { error: 'Số điện thoại không hợp lệ.' };
  if (email && !EMAIL.test(email)) return { error: 'Email không hợp lệ.' };
  let key;
  if (!fs.existsSync(PRIV_FILE)) return { error: 'Chưa có private key (keygen/private.pem). Chạy: npm run genkeys' };
  try { key = makeKey(readPriv(), f.machineId, f.exp || null); } catch (e) { return { error: e.message }; }
  const machineId = String(f.machineId).toUpperCase().replace(/[^0-9A-F]/g, '').match(/.{4}/g).join('-');
  const entry = { at: new Date().toISOString(), name, phone, email, machineId, exp: f.exp || null, key };
  const hist = readHist();
  hist.push(entry);
  fs.writeFileSync(histFile(), JSON.stringify(hist, null, 2));
  return { key, entry };
});

app.whenReady().then(() => {
  const w = new BrowserWindow({
    width: 1240, height: 780, minWidth: 1000, minHeight: 640, backgroundColor: '#0b0f17', title: 'NDaudio – Tool cấp key',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  w.loadFile(path.join(__dirname, 'index.html'));
});
app.on('window-all-closed', () => app.quit());
