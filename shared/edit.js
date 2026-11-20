const { app, Menu, ipcMain, clipboard } = require('electron');

ipcMain.handle('copy', (_e, t) => clipboard.writeText(String(t)));

// Cửa sổ ẩn menu bar nên phím tắt Ctrl+V/C/X/A/Z không chạy: tự bắt phím + thêm menu chuột phải.
const KEYS = { v: 'paste', c: 'copy', x: 'cut', a: 'selectAll', z: 'undo' };
const menu = Menu.buildFromTemplate([
  { role: 'cut', label: 'Cắt' }, { role: 'copy', label: 'Sao chép' }, { role: 'paste', label: 'Dán' },
  { type: 'separator' }, { role: 'selectAll', label: 'Chọn tất cả' },
]);

app.on('web-contents-created', (_e, wc) => {
  wc.on('before-input-event', (e, i) => {
    const act = i.type === 'keyDown' && i.control && !i.alt && !i.shift && KEYS[i.key.toLowerCase()];
    if (act) { e.preventDefault(); wc[act](); }
  });
  wc.on('context-menu', () => menu.popup());
});
