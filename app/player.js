import { PitchShifter } from '../node_modules/soundtouchjs/dist/soundtouch.js';

const N = 20;
const DEFAULTS = { vol: 80, low: 0, mid: 0, high: 0, tone: 0, tempo: 100 };
const $ = (s) => document.querySelector(s);

const ctx = new AudioContext();
const master = ctx.createGain();
master.connect(ctx.destination);

let slots = Array(N).fill(null);           // dữ liệu lưu: {path, name, vol, low, mid, high, tone, tempo}
const rt = Array.from({ length: N }, () => ({})); // runtime: buffer, nodes, shifter, pct
let sel = -1;

// ---------- lưu / tải ----------
let saveT;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => api.saveTracks(slots), 300); };

// ---------- audio ----------
function chain(i) {
  const r = rt[i];
  if (r.nodes) return r.nodes;
  const low = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: 250 });
  const mid = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 1000, Q: 0.9 });
  const high = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 4000 });
  const gain = ctx.createGain();
  low.connect(mid).connect(high).connect(gain).connect(master);
  return (r.nodes = { low, mid, high, gain });
}

function applyParams(i) {
  const s = slots[i]; if (!s) return;
  const n = chain(i);
  n.low.gain.value = s.low; n.mid.gain.value = s.mid; n.high.gain.value = s.high;
  n.gain.gain.value = s.vol / 100;
  const sh = rt[i].shifter;
  if (sh) { sh.pitchSemitones = s.tone; sh.tempo = s.tempo / 100; }
}

async function start(i) {
  const s = slots[i]; if (!s) return;
  if (ctx.state !== 'running') await ctx.resume();
  const r = rt[i];
  try {
    r.buffer ??= await ctx.decodeAudioData((await api.readFile(s.path)).buffer);
  } catch (e) {
    alert(`Không mở được file:\n${s.path}\n\n${e.message}`);
    return;
  }
  stop(i);
  r.shifter = new PitchShifter(ctx, r.buffer, 4096, () => setTimeout(() => stop(i)));
  r.shifter.on('play', (d) => { r.pct = d.percentagePlayed; r.t = d.timePlayed; tick(i); });
  r.pct = 0; r.t = 0;
  applyParams(i);
  r.shifter.connect(chain(i).low);
  update(i);
}

function stop(i) {
  const r = rt[i];
  if (!r.shifter) return;
  r.shifter.off(); r.shifter.disconnect(); r.shifter = null;
  r.pct = 0; r.t = 0;
  update(i);
}

const toggle = (i) => (rt[i].shifter ? stop(i) : start(i));

// ---------- giao diện ----------
const fmt = (sec = 0) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const isFx = (s) => s.low || s.mid || s.high || s.tone || s.tempo !== 100;

function renderGrid() {
  $('#grid').innerHTML = slots.map((s, i) => s ? `
    <div class="slot" data-i="${i}" tabindex="0">
      <div class="top"><span class="num">${i + 1}</span><span class="fx"></span>
        <button class="x" data-act="remove" title="Xóa bài khỏi slot" aria-label="Xóa bài">×</button></div>
      <div class="name" title="${esc(s.path)}">${esc(s.name)}</div>
      <div><div class="bar"><i></i></div><div class="time"><span class="cur">0:00</span><span class="dur">–:––</span></div></div>
      <div class="ctl"><button class="play" data-act="play">Start</button>
        <input type="range" min="0" max="100" value="${s.vol}" data-act="vol" aria-label="Âm lượng slot ${i + 1}"></div>
    </div>` : `
    <div class="slot empty" data-i="${i}" data-act="pick" tabindex="0"><div><b>Slot ${i + 1}</b>Bấm hoặc kéo file vào</div></div>`).join('');
  slots.forEach((_, i) => update(i));
}

function update(i) {
  const el = document.querySelector(`.slot[data-i="${i}"]`); if (!el) return;
  el.classList.toggle('sel', i === sel);
  const s = slots[i]; if (!s) return;
  const on = !!rt[i].shifter;
  el.classList.toggle('playing', on);
  const b = el.querySelector('.play'); b.textContent = on ? 'Stop' : 'Start'; b.classList.toggle('on', on);
  el.querySelector('.fx').textContent = isFx(s) ? `${s.tone ? (s.tone > 0 ? '+' : '') + s.tone + 'st ' : ''}${s.tempo !== 100 ? s.tempo + '% ' : ''}${s.low || s.mid || s.high ? 'EQ' : ''}` : '';
  if (rt[i].buffer) el.querySelector('.dur').textContent = fmt(rt[i].buffer.duration);
  tick(i);
}

function tick(i) {
  const el = document.querySelector(`.slot[data-i="${i}"]`); if (!el || !slots[i]) return;
  el.querySelector('.bar i').style.width = `${Math.min(100, rt[i].pct || 0)}%`;
  el.querySelector('.cur').textContent = fmt(rt[i].t);
}

function renderPanel() {
  const s = slots[sel];
  if (!s) { $('#panel').innerHTML = '<h2>Hiệu chỉnh</h2><p class="none">Chọn 1 slot có nhạc để chỉnh EQ, Tone, Tempo.</p>'; return; }
  const p = (k, label, min, max, unit) => `<div class="p"><span>${label}</span>
    <input type="range" min="${min}" max="${max}" step="1" value="${s[k]}" data-k="${k}" aria-label="${label}">
    <span class="val" data-v="${k}">${s[k] > 0 && unit === ' dB' ? '+' : ''}${s[k]}${unit}</span></div>`;
  $('#panel').innerHTML = `
    <h2>Slot ${sel + 1}</h2><div class="title">${esc(s.name)}</div>
    <div class="group"><h3>EQ 3 dải</h3>${p('low', 'Low', -12, 12, ' dB')}${p('mid', 'Mid', -12, 12, ' dB')}${p('high', 'High', -12, 12, ' dB')}</div>
    <div class="group"><h3>Tone <span>nửa cung</span></h3>
      <div class="step"><button class="btn" data-tone="-1" aria-label="Giảm tone">−</button>
        <b data-v="tone">${s.tone > 0 ? '+' : ''}${s.tone}</b>
        <button class="btn" data-tone="1" aria-label="Tăng tone">+</button></div>
      <input type="range" min="-6" max="6" step="1" value="${s.tone}" data-k="tone" aria-label="Tone"></div>
    <div class="group"><h3>Tempo</h3>${p('tempo', 'Tốc độ', 50, 150, '%')}</div>
    <div class="group"><h3>Âm lượng slot</h3>${p('vol', 'Vol', 0, 100, '')}</div>
    <button id="reset" class="btn wide">Reset EQ / Tone / Tempo</button>`;
}

function setParam(k, v) {
  const s = slots[sel]; if (!s) return;
  s[k] = Math.max(k === 'tone' ? -6 : -Infinity, Math.min(k === 'tone' ? 6 : Infinity, Number(v)));
  applyParams(sel); save(); update(sel);
  const grid = document.querySelector(`.slot[data-i="${sel}"] [data-act="vol"]`);
  if (k === 'vol' && grid) grid.value = s.vol;
  syncPanel();
}

// Chỉ cập nhật giá trị, không render lại (render lại giữa lúc kéo slider sẽ làm đứt thao tác kéo).
function syncPanel() {
  const s = slots[sel]; if (!s) return;
  for (const k of ['low', 'mid', 'high', 'tone', 'tempo', 'vol']) {
    $('#panel').querySelectorAll(`[data-k="${k}"]`).forEach((el) => { if (el !== document.activeElement) el.value = s[k]; });
    const v = $('#panel').querySelector(`[data-v="${k}"]`);
    if (v) v.textContent = `${s[k] > 0 && k !== 'tempo' && k !== 'vol' ? '+' : ''}${s[k]}${k === 'tempo' ? '%' : ['low', 'mid', 'high'].includes(k) ? ' dB' : ''}`;
  }
}

function select(i) {
  const prev = sel; sel = i;
  update(prev); update(i); renderPanel();
}

function addFiles(paths, from = 0) {
  const ok = paths.filter((p) => /\.(mp3|wav)$/i.test(p));
  if (ok.length < paths.length) alert('Chỉ nhận file .mp3 hoặc .wav');
  for (const p of ok) {
    let i = slots.findIndex((s, j) => j >= from && !s);
    if (i < 0) i = slots.findIndex((s) => !s);
    if (i < 0) { alert('Đã đủ 20 slot. Xóa bớt bài để thêm mới.'); break; }
    slots[i] = { ...DEFAULTS, path: p, name: p.split(/[\\/]/).pop().replace(/\.(mp3|wav)$/i, '') };
    rt[i] = {};
    from = i + 1;
  }
  save(); renderGrid(); renderPanel();
}

function remove(i) {
  stop(i); rt[i].nodes?.gain.disconnect(); rt[i] = {}; slots[i] = null;
  if (sel === i) sel = -1;
  save(); renderGrid(); renderPanel();
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- sự kiện ----------
$('#grid').addEventListener('click', async (e) => {
  const el = e.target.closest('.slot'); if (!el) return;
  const i = +el.dataset.i, act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'pick') return addFiles(await api.pickFiles(), i);
  if (act === 'remove') return remove(i);
  if (act === 'vol') return;
  select(i);
  if (act === 'play') toggle(i);
});
$('#grid').addEventListener('input', (e) => {
  if (e.target.dataset.act !== 'vol') return;
  const i = +e.target.closest('.slot').dataset.i;
  slots[i].vol = +e.target.value; applyParams(i); save();
  if (i === sel) syncPanel();
});
$('#grid').addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('slot')) { e.preventDefault(); e.target.click(); }
});
$('#panel').addEventListener('input', (e) => e.target.dataset.k && setParam(e.target.dataset.k, e.target.value));
$('#panel').addEventListener('click', (e) => {
  if (e.target.dataset.tone) setParam('tone', slots[sel].tone + +e.target.dataset.tone);
  if (e.target.id === 'reset') { Object.assign(slots[sel], { low: 0, mid: 0, high: 0, tone: 0, tempo: 100 }); setParam('tempo', 100); }
});
$('#add').onclick = async () => addFiles(await api.pickFiles());
$('#stopAll').onclick = () => slots.forEach((_, i) => stop(i));
$('#master').oninput = (e) => { master.gain.value = e.target.value / 100; $('#masterVal').textContent = e.target.value; localStorage.master = e.target.value; };

// Kéo thả: thả vào slot nào thì điền từ slot đó.
document.addEventListener('dragover', (e) => { e.preventDefault(); $('#grid').classList.add('drop-hint'); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('#grid').classList.remove('drop-hint'); });
document.addEventListener('drop', (e) => {
  e.preventDefault(); $('#grid').classList.remove('drop-hint');
  const at = e.target.closest?.('.slot');
  addFiles([...e.dataTransfer.files].map(api.pathOf), at ? +at.dataset.i : 0);
});

// ---------- khởi động ----------
const mv = localStorage.master ?? 80;
$('#master').value = mv; $('#masterVal').textContent = mv; master.gain.value = mv / 100;
api.licStatus().then((l) => ($('#lic').textContent = l.exp ? `Bản quyền đến ${l.exp}` : 'Bản quyền vĩnh viễn'));
const saved = await api.loadTracks();
slots = Array.from({ length: N }, (_, i) => (saved[i] ? { ...DEFAULTS, ...saved[i] } : null));
renderGrid(); renderPanel();

// ---------- test tự động (chỉ khi chạy SMOKE=1) ----------
const smoke = await api.smoke();
if (smoke) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = api.smokeLog; let ok = true;
  const check = (c, m) => { log(`${c ? 'OK  ' : 'FAIL'} ${m}`); ok &&= c; };
  try {
    slots = Array(N).fill(null); rt.forEach((_, i) => (rt[i] = {}));
    addFiles(smoke.files);
    check(slots.filter(Boolean).length === smoke.files.length, `add ${smoke.files.length} file`);
    select(0); await start(0); await wait(1200);
    const p1 = rt[0].pct; check(rt[0].shifter && p1 > 0, `slot1 Start, tiến trình ${p1?.toFixed(1)}%`);
    setParam('low', 6); setParam('mid', -3); setParam('high', 4); setParam('tone', 3); setParam('tempo', 130);
    check(rt[0].nodes.low.gain.value === 6 && rt[0].nodes.high.gain.value === 4, 'EQ áp vào filter');
    const st = rt[0].shifter._soundtouch;
    check(st.virtualTempo === 1.3 && Math.abs(st.virtualPitch - 2 ** (3 / 12)) < 1e-6, 'tone +3, tempo 130% áp vào SoundTouch');
    await wait(1000); check(rt[0].pct > p1, `vẫn phát sau khi đổi tone/tempo (${rt[0].pct.toFixed(1)}%)`);
    setParam('tone', 99); check(slots[0].tone === 6, 'tone kẹp tối đa +6');
    select(1); await start(1); await wait(800); check(rt[1].pct > 0, 'slot2 phát song song');
    stop(0); check(!rt[0].shifter && rt[1].shifter, 'slot1 Stop, slot2 vẫn chạy');
    select(0); document.getElementById('reset').click();
    check(slots[0].tone === 0 && slots[0].tempo === 100 && slots[0].low === 0, 'Reset về mặc định');
    stop(1);
  } catch (e) { check(false, e.stack); }
  api.smokeDone(ok);
}
