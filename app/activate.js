const $ = (s) => document.querySelector(s);
api.licInfo().then((i) => {
  if (i.error) { $('#mid').textContent = '—'; $('#err').textContent = 'Lỗi: ' + i.error + '. App bị khóa.'; $('#go').disabled = true; return; }
  $('#mid').textContent = i.machineId; $('#copy').disabled = false;
  const msg = {
    invalid: 'Key đã lưu không khớp với ổ cứng máy này (đã đổi ổ hoặc chép sang máy khác). App bị khóa, cần key mới.',
    expired: `Key đã hết hạn từ ngày ${i.exp}. App bị khóa, liên hệ NDaudio để gia hạn.`,
    clock: 'Ngày giờ của máy bị chỉnh lùi. Hãy chỉnh lại ngày giờ đúng rồi mở lại app.',
  }[i.reason];
  if (msg) $('#err').textContent = msg;
});
$('#copy').onclick = () => { api.copy($('#mid').textContent); $('#copy').textContent = 'Đã copy'; setTimeout(() => $('#copy').textContent = 'Copy', 1200); };
async function go() {
  $('#err').textContent = '';
  const r = await api.activate($('#key').value);
  if (!r.ok) { $('#err').textContent = r.error; $('#key').select(); }
}
$('#go').onclick = go;
$('#key').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
