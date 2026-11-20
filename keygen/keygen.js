const $ = (s) => document.querySelector(s);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const vn = (s) => s.split('-').reverse().join('/');
const normId = (s) => s.toUpperCase().replace(/[^0-9A-F]/g, '');
let hist = [], lastKey = null;

// Hạn dùng 'YYYY-MM-DD' (dùng hết ngày đó), null = vĩnh viễn, undefined = chưa chọn ngày
function expDate() {
  const v = $('#dur').value;
  if (v === 'custom') return $('#date').value || undefined;
  if (v === '0') return null;
  const d = new Date(); d.setMonth(d.getMonth() + Number(v));
  return iso(d);
}
function showExp() {
  $('#date').hidden = $('#dur').value !== 'custom';
  $('#date').min = iso(new Date());
  const e = expDate();
  $('#expText').textContent = e === null ? 'Key dùng vĩnh viễn.' : e ? `Dùng được đến hết ngày ${vn(e)}.` : 'Chọn ngày hết hạn.';
}

function badge(exp) {
  if (!exp) return '<span class="badge inf">Vĩnh viễn</span>';
  const left = Math.round((new Date(exp + 'T00:00:00') - new Date(iso(new Date()) + 'T00:00:00')) / 864e5);
  if (left < 0) return `<span class="badge dead">Hết hạn</span><div class="sub">${vn(exp)}</div>`;
  return `<span class="badge ${left <= 30 ? 'soon' : 'ok'}">Còn ${left} ngày</span><div class="sub">${vn(exp)}</div>`;
}

function render() {
  const q = $('#q').value.trim().toLowerCase();
  const list = [...hist].reverse()
    .filter((h) => !q || [h.name, h.phone, h.email, h.machineId, h.key].join(' ').toLowerCase().includes(q));
  $('#count').textContent = `${hist.length} key · ${new Set(hist.map((h) => h.machineId)).size} máy`;
  $('#empty').hidden = list.length > 0;
  $('#empty').textContent = hist.length ? 'Không tìm thấy.' : 'Chưa cấp key nào.';
  $('#rows').innerHTML = list.map((h) => `
    <tr class="${h.key === lastKey ? 'new' : ''}">
      <td>${vn(iso(new Date(h.at)))}<div class="sub">${new Date(h.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div></td>
      <td><b>${esc(h.name)}</b><div class="sub">${esc(h.phone)}${h.email ? ' · ' + esc(h.email) : ''}</div></td>
      <td class="mono">${esc(h.machineId)}</td>
      <td>${badge(h.exp)}</td>
      <td><span class="mono" title="${esc(h.key)}">${esc(h.key.slice(0, 11))}…${esc(h.key.slice(-5))}</span><button type="button" class="mini" data-copy="${esc(h.key)}">Copy</button></td>
    </tr>`).join('');
}

// Cảnh báo khi máy đã từng được cấp key (cấp trùng / khách chuyển nhượng)
function checkDup() {
  const id = normId($('#mid').value);
  const prior = id.length === 16 ? hist.filter((h) => normId(h.machineId) === id) : [];
  const last = prior.at(-1);
  $('#dup').textContent = last ? `Máy này đã được cấp ${prior.length} lần, gần nhất ngày ${vn(iso(new Date(last.at)))} cho ${last.name}.` : '';
}

$('#form').onsubmit = async (e) => {
  e.preventDefault();
  $('#err').textContent = '';
  const exp = expDate();
  if (exp === undefined) { $('#err').textContent = 'Chọn ngày hết hạn.'; return; }
  checkDup(); // cảnh báo dựa trên lịch sử trước lần cấp này
  const r = await keygen.make({ name: $('#name').value, phone: $('#phone').value, email: $('#email').value, machineId: $('#mid').value, exp });
  if (r.error) { $('#err').textContent = r.error; return; }
  lastKey = r.key; hist.push(r.entry);
  $('#key').textContent = r.key; $('#out').hidden = false;
  render();
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-copy], #copy'); if (!b) return;
  keygen.copy(b.dataset.copy || $('#key').textContent);
  const t = b.textContent; b.textContent = 'Đã copy'; setTimeout(() => (b.textContent = t), 1200);
});
$('#dur').onchange = showExp;
$('#date').oninput = showExp;
$('#mid').oninput = checkDup;
$('#q').oninput = render;
// Sửa thông tin thì ẩn key vừa tạo để tránh gửi nhầm key cho khách khác
['#name', '#phone', '#email', '#mid', '#dur', '#date'].forEach((s) => $(s).addEventListener('input', () => ($('#out').hidden = true)));

showExp();
keygen.history().then((h) => { hist = h; render(); });
