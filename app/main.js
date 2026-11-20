const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const L = require('../shared/license');
require('../shared/edit');
const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, '..', 'config', 'public.pem'), 'utf8'); // chỉ kiểm tra, không tạo được key

if (process.env.NDA_USERDATA) app.setPath('userData', process.env.NDA_USERDATA); // dùng cho test
const file = (n) => path.join(app.getPath('userData'), n);
const readJSON = (n, d) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return d; } };
const writeJSON = (n, v) => fs.writeFileSync(file(n), JSON.stringify(v, null, 2));

let win, machineId = null, idError = null;

const DAY = 86400000;
const fmtDate = (d) => d.split('-').reverse().join('/');

// Mỗi lần mở app đều kiểm tra lại key đã lưu với mã máy + ngày hiện tại -> sang ổ cứng khác / hết hạn là khóa.
// -> { ok, exp, reason: 'noid' | 'none' | 'invalid' | 'expired' | 'clock' }
function status() {
  if (!machineId) return { ok: false, reason: 'noid' };
  const saved = readJSON('license.json', null);
  if (!saved) return { ok: false, reason: 'none' };
  // ponytail: chống chỉnh lùi đồng hồ bằng mốc lastSeen trong license.json; xóa file là reset mốc nhưng cũng mất key.
  if (saved.lastSeen && Date.now() < saved.lastSeen - DAY) return { ok: false, reason: 'clock' };
  return L.verifyKey(PUBLIC_KEY, machineId, saved.key);
}
const licensed = () => status().ok;

function tryActivate(key) {
  if (!machineId) return { ok: false, error: idError || 'Chưa đọc được mã máy.' };
  const r = L.verifyKey(PUBLIC_KEY, machineId, key);
  if (r.reason === 'expired') return { ok: false, error: `Key này đã hết hạn từ ngày ${fmtDate(r.exp)}. Liên hệ NDaudio để gia hạn.` };
  if (!r.ok) return { ok: false, error: 'Key không đúng cho máy này. Kiểm tra lại hoặc liên hệ NDaudio để được cấp key.' };
  writeJSON('license.json', { key: String(key).toUpperCase().replace(/[^A-Z2-7]/g, '').match(/.{1,5}/g).join('-'), machineId, exp: r.exp, at: new Date().toISOString(), lastSeen: Date.now() });
  return { ok: true };
}

ipcMain.handle('lic:info', () => {
  const st = status();
  return { machineId, error: idError, reason: st.reason, exp: st.exp && fmtDate(st.exp) };
});
ipcMain.handle('lic:status', () => { const st = status(); return { exp: st.exp && fmtDate(st.exp) }; });
ipcMain.handle('lic:activate', (_e, key) => {
  const r = tryActivate(key);
  if (r.ok) win.loadFile(path.join(__dirname, 'player.html'));
  return r;
});

// Các API dưới đây chỉ chạy khi đã có bản quyền.
const guard = (fn) => (...a) => { if (!licensed()) throw new Error('Chưa kích hoạt'); return fn(...a); };
ipcMain.handle('tracks:load', guard(() => readJSON('tracks.json', [])));
ipcMain.handle('tracks:save', guard((_e, list) => writeJSON('tracks.json', list)));
ipcMain.handle('file:read', guard((_e, p) => fs.promises.readFile(p)));
ipcMain.handle('file:pick', guard(async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Nhạc', extensions: ['mp3', 'wav'] }] });
  return r.canceled ? [] : r.filePaths;
}));

// Test tự động: SMOKE=1 -> renderer chạy kịch bản, báo kết quả rồi thoát.
ipcMain.handle('smoke:get', () => process.env.SMOKE ? { files: (process.env.SMOKE_FILES || '').split(';').filter(Boolean) } : null);
ipcMain.on('smoke:log', (_e, m) => console.log('[smoke]', m));
ipcMain.on('smoke:done', (_e, ok) => { console.log(ok ? '[smoke] PASS' : '[smoke] FAIL'); app.exit(ok ? 0 : 1); });

app.whenReady().then(async () => {
  try { machineId = L.machineIdFromSerial(await L.readDiskSerial()); } catch (e) { idError = e.message; }

  if (process.env.SMOKE_KEY !== undefined) { // test luồng kích hoạt không cần bấm tay
    console.log('[smoke] activate', JSON.stringify(process.env.SMOKE_KEY), '->', JSON.stringify(tryActivate(process.env.SMOKE_KEY)), 'licensed=', licensed());
    if (!process.env.SMOKE) return app.exit(0);
  }

  const saved = readJSON('license.json', null);
  if (licensed()) writeJSON('license.json', { ...saved, lastSeen: Math.max(saved.lastSeen || 0, Date.now()) });

  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1100, minHeight: 700, backgroundColor: '#0b0f17',
    title: 'NDaudio Player', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, licensed() ? 'player.html' : 'activate.html'));
});
app.on('window-all-closed', () => app.quit());
