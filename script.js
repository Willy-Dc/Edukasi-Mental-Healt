'use strict';

const BREATH_MODES = {
  cepat:  [3, 1, 4],
  normal: [4, 4, 6],
  lambat: [5, 5, 8],
};

const AFFIRMATIONS = [
  "Kamu sudah melakukan yang terbaik hari ini, dan itu cukup.",
  "Perasaanmu valid. Tidak apa-apa merasa seperti ini.",
  "Setiap hari kecil yang kamu lalui adalah pencapaian.",
  "Kamu lebih kuat dari yang kamu kira.",
  "Satu langkah kecil pun tetap langkah ke depan.",
  "Kamu berhak merasa aman dan tenang.",
  "Ini hanya sementara. Kamu bisa melewatinya.",
  "Ada orang yang peduli padamu, bahkan saat kamu tidak menyadarinya.",
  "Mengakui bahwa kamu butuh bantuan adalah tanda kekuatan.",
  "Napas satu kali cukup untuk memulai. Lanjutkan.",
  "Kamu tidak harus menyelesaikan segalanya hari ini.",
  "Tubuhmu sudah bekerja keras untukmu. Beristirahatlah.",
  "Kamu layak mendapatkan ketenangan.",
  "Emosi yang kamu rasakan bukan kelemahan.",
  "Besok adalah kesempatan baru yang masih kosong.",
];

const BOT_RESPONSES = [
  "Aku dengar kamu. Terima kasih sudah berbagi.",
  "Itu pasti terasa berat. Kamu tidak harus menanggungnya sendiri.",
  "Perasaanmu valid. Tidak apa-apa merasa begitu.",
  "Aku di sini. Cerita lebih banyak jika kamu mau.",
  "Kamu sudah berani menuliskan ini, dan itu hal yang luar biasa.",
  "Hmm, aku mengerti. Apa yang paling membebanimu sekarang?",
  "Kamu aman di sini. Tidak ada yang menghakimi.",
  "Terima kasih sudah percaya padaku. Aku selalu di sini.",
];

const GROUNDING_ITEMS = {
  5: ["Sebuah benda di depanmu", "Warna di sekitarmu", "Sesuatu yang bergerak", "Bayangan atau cahaya", "Tulisan yang bisa kamu baca"],
  4: ["Permukaan meja atau lantai", "Tekstur pakaianmu", "Udara di kulitmu", "Sesuatu yang kamu pegang"],
  3: ["Suara dari dalam ruangan", "Suara dari luar", "Suara napasmu sendiri"],
  2: ["Aroma ruangan ini", "Aroma tubuhmu sendiri"],
  1: ["Rasa di mulutmu sekarang"],
};

const SAFE_MESSAGES = [
  "Tarik napas perlahan...",
  "Tahan sebentar...",
  "Hembuskan perlahan...",
  "Kamu aman di sini.",
  "Satu napas lagi...",
  "Biarkan semua tenang.",
];

// =============================================
// SOUND DEFINITIONS
// =============================================
const SOUND_LIBRARY = [
  { id: 'lofi_1',     emoji: '🎹',  label: 'Cozy Piano',      desc: 'Lofi piano yang hangat' },
  { id: 'lofi_2',     emoji: '🎸',  label: 'Study Vibes',     desc: 'Gitar santai untuk fokus' },
  { id: 'lofi_3',     emoji: '🌧',  label: 'Rainy Night',     desc: 'Piano di malam hujan' },
  { id: 'lofi_4',     emoji: '☀️',  label: 'Morning Sun',     desc: 'Pagi yang cerah & fresh' },
  { id: 'lofi_5',     emoji: '☕',  label: 'Midnight Coffee', desc: 'Lofi jazz di kafe' },
  { id: 'lofi_6',     emoji: '🌲',  label: 'Forest Path',     desc: 'Kalimba di hutan' },
  { id: 'lofi_7',     emoji: '☁️',  label: 'Dreamy Clouds',   desc: 'Synth ethereal' },
  { id: 'lofi_8',     emoji: '🌆',  label: 'Urban Sunset',    desc: 'Funky lofi kota' },
];

let currentPage      = 'home';
let currentTab       = 'breathing';
let breathInterval   = null;
let breathRunning    = false;
let breathMode       = 'normal';
let breathCycles     = 0;
let safeModeInterval = null;
let stressCount      = 0;
let audioCtx         = null;
let gainNode         = null;
let soundNodes       = [];
let soundActive      = false;
let currentSoundType = 'lofi_1';

// =============================================
// PAGE / TAB NAVIGATION
// =============================================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-page="${pageId}"]`).classList.add('active');
  currentPage = pageId;
  if (pageId === 'history') renderHistory();
}

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
  currentTab = tabId;
}

// =============================================
// MOOD
// =============================================
const MOOD_MESSAGES = {
  baik:  { cls: 'baik',  text: '😊 Senang mendengarnya! Semoga harimu terus menyenangkan. Ingat, jaga dirimu dengan baik ya.' },
  biasa: { cls: 'biasa', text: '😐 Tidak apa-apa kalau hari ini terasa biasa saja. Kadang tidak semua harus luar biasa. Kamu baik-baik saja.' },
  stres: { cls: 'stres', text: '😔 Terima kasih sudah jujur. Aku tahu ini terasa berat. Kamu tidak harus melewatinya sendirian — yuk kita coba tenangkan diri bersama.' },
};

function handleMoodSelect(mood) {
  saveMoodHistory(mood);
  document.querySelectorAll('.mood-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.mood === mood);
  });
  const resp = document.getElementById('mood-response');
  const data = MOOD_MESSAGES[mood];
  resp.textContent = data.text;
  resp.className = 'mood-response show ' + data.cls;
  if (mood === 'stres') {
    stressCount++;
    setTimeout(() => { showPage('emergency'); showTab('breathing'); }, 1800);
    if (stressCount >= 2) showEmergencyPrompt();
  }
}

function saveMoodHistory(mood) {
  const history = getMoodHistory();
  history.unshift({ mood, time: new Date().toISOString() });
  localStorage.setItem('tenang_mood_history', JSON.stringify(history.slice(0, 30)));
}

function getMoodHistory() {
  try { return JSON.parse(localStorage.getItem('tenang_mood_history') || '[]'); }
  catch { return []; }
}

function renderHistory() {
  const history = getMoodHistory();
  const list    = document.getElementById('history-list');
  const insight = document.getElementById('history-insight');
  list.innerHTML = '';
  if (!history.length) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px 0">Belum ada riwayat mood. Mulai check-in dari beranda!</p>';
    insight.textContent = '';
    return;
  }
  const EMOJI = { baik: '😊', biasa: '😐', stres: '😔' };
  const LABEL = { baik: 'Baik', biasa: 'Biasa Aja', stres: 'Stres / Sedih' };
  history.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    const date  = new Date(item.time);
    const label = date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    el.innerHTML = `
      <span class="history-emoji">${EMOJI[item.mood] || '😶'}</span>
      <div class="history-info">
        <div class="history-mood">${LABEL[item.mood] || item.mood}</div>
        <div class="history-date">${label}</div>
      </div>`;
    list.appendChild(el);
  });
  const total    = history.length;
  const stresArr = history.filter(h => h.mood === 'stres');
  const baikArr  = history.filter(h => h.mood === 'baik');
  let insightText = '';
  if (stresArr.length > total * 0.5)      insightText = `Dari ${total} check-in terakhir, kamu cukup sering merasa berat. Tidak apa-apa — tapi pertimbangkan untuk berbicara dengan seseorang yang kamu percaya. 💙`;
  else if (baikArr.length > total * 0.6)  insightText = `Dari ${total} check-in terakhir, kamu lebih sering merasa baik! Teruskan hal-hal positif yang sudah kamu lakukan. 🌿`;
  else                                     insightText = `Kamu sudah melacak ${total} check-in. Mengenali perasaanmu sendiri adalah langkah yang keren. 🌟`;
  insight.textContent = insightText;
}

// =============================================
// AFFIRMATION
// =============================================
let lastAffirmIdx = -1;
function showNewAffirmation() {
  const el = document.getElementById('affirmation-text');
  el.classList.add('affirmation-fade-out');
  setTimeout(() => {
    let idx;
    do { idx = Math.floor(Math.random() * AFFIRMATIONS.length); } while (idx === lastAffirmIdx);
    lastAffirmIdx = idx;
    el.textContent = `"${AFFIRMATIONS[idx]}"`;
    el.classList.remove('affirmation-fade-out');
  }, 350);
}

// =============================================
// BREATHING
// =============================================
let breathPhaseIdx = 0;
let breathPhaseTimer = 0;
let breathTotalCycleTime = 0;
const PHASE_NAMES = ['Tarik Napas', 'Tahan', 'Hembuskan'];
const PHASE_SCALE = [1.25, 1.25, 0.85];

function startBreathing() {
  if (breathRunning) return;
  breathRunning   = true;
  breathCycles    = 0;
  breathPhaseIdx  = 0;
  const [inhale, hold, exhale] = BREATH_MODES[breathMode];
  breathTotalCycleTime = inhale + hold + exhale;
  breathPhaseTimer = inhale;
  document.getElementById('breath-start').style.display = 'none';
  document.getElementById('breath-stop').style.display  = 'inline-flex';
  document.getElementById('breath-cycle-info').textContent = `Siklus: 0 / 5`;
  updateBreathUI();
  breathInterval = setInterval(() => {
    breathPhaseTimer--;
    updateBreathProgress();
    if (breathPhaseTimer <= 0) {
      breathPhaseIdx = (breathPhaseIdx + 1) % 3;
      if (breathPhaseIdx === 0) {
        breathCycles++;
        document.getElementById('breath-cycle-info').textContent = `Siklus: ${breathCycles} / 5`;
        if (breathCycles >= 5) { stopBreathing(true); return; }
      }
      breathPhaseTimer = BREATH_MODES[breathMode][breathPhaseIdx];
      updateBreathUI();
    }
    document.getElementById('breath-timer').textContent = breathPhaseTimer;
  }, 1000);
}

function updateBreathUI() {
  const circle = document.getElementById('breath-circle');
  const phase  = document.getElementById('breath-phase');
  const timer  = document.getElementById('breath-timer');
  const [inhale, hold, exhale] = BREATH_MODES[breathMode];
  const durations = [inhale, hold, exhale];
  phase.textContent = PHASE_NAMES[breathPhaseIdx];
  timer.textContent = durations[breathPhaseIdx];
  const scale = PHASE_SCALE[breathPhaseIdx];
  const dur   = durations[breathPhaseIdx];
  circle.style.transition = `transform ${dur}s ease-in-out`;
  circle.style.transform  = `scale(${scale})`;
  if      (breathPhaseIdx === 0) circle.style.boxShadow = `0 0 0 0 rgba(76,175,120,0)`;
  else if (breathPhaseIdx === 1) circle.style.boxShadow = `0 0 0 20px rgba(76,175,120,0.2)`;
  else                           circle.style.boxShadow = `0 0 0 0 rgba(76,175,120,0)`;
}

function updateBreathProgress() {
  const [inhale, hold, exhale] = BREATH_MODES[breathMode];
  const total = inhale + hold + exhale;
  let elapsed = 0;
  if (breathPhaseIdx === 0) elapsed = inhale - breathPhaseTimer;
  if (breathPhaseIdx === 1) elapsed = inhale + (hold - breathPhaseTimer);
  if (breathPhaseIdx === 2) elapsed = inhale + hold + (exhale - breathPhaseTimer);
  document.getElementById('breath-progress').style.width = (elapsed / total * 100) + '%';
}

function stopBreathing(completed = false) {
  clearInterval(breathInterval);
  breathRunning = false;
  const circle = document.getElementById('breath-circle');
  circle.style.transform  = 'scale(1)';
  circle.style.transition = 'transform 1s ease';
  document.getElementById('breath-start').style.display = 'inline-flex';
  document.getElementById('breath-stop').style.display  = 'none';
  document.getElementById('breath-phase').textContent   = completed ? 'Hebat! 🌟' : 'Siap?';
  document.getElementById('breath-timer').textContent   = '';
  document.getElementById('breath-progress').style.width = completed ? '100%' : '0%';
  if (completed) {
    setTimeout(() => {
      document.getElementById('breath-phase').textContent  = 'Siap?';
      document.getElementById('breath-progress').style.width = '0%';
    }, 2000);
  }
}

// =============================================
// GROUNDING
// =============================================
function buildGrounding() {
  [5, 4, 3, 2, 1].forEach(n => {
    const container = document.getElementById('ground-' + n);
    container.innerHTML = '';
    GROUNDING_ITEMS[n].forEach(label => {
      const el = document.createElement('div');
      el.className = 'ground-item';
      el.innerHTML = `<div class="ground-check"></div><span>${label}</span>`;
      el.addEventListener('click', () => toggleGroundItem(el, n));
      container.appendChild(el);
    });
  });
}

function toggleGroundItem(el, groupNum) {
  el.classList.toggle('checked');
  el.querySelector('.ground-check').textContent = el.classList.contains('checked') ? '✓' : '';
  const group   = document.querySelector(`.ground-group[data-group="${groupNum}"]`);
  const items   = group.querySelectorAll('.ground-item');
  const allDone = [...items].every(i => i.classList.contains('checked'));
  group.classList.toggle('done', allDone);
  const allGroupsDone = document.querySelectorAll('.ground-group.done').length === 5;
  document.getElementById('grounding-complete').style.display = allGroupsDone ? 'block' : 'none';
}

function resetGrounding() {
  document.querySelectorAll('.ground-item').forEach(el => {
    el.classList.remove('checked');
    el.querySelector('.ground-check').textContent = '';
  });
  document.querySelectorAll('.ground-group').forEach(g => g.classList.remove('done'));
  document.getElementById('grounding-complete').style.display = 'none';
}

// =============================================
// CHAT
// =============================================
function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text  = input.value.trim();
  if (!text) return;
  const box = document.getElementById('chat-messages');
  const userBubble = document.createElement('div');
  userBubble.className  = 'chat-bubble user';
  userBubble.textContent = text;
  box.appendChild(userBubble);
  box.scrollTop = box.scrollHeight;
  input.value = '';
  setTimeout(() => {
    const botBubble = document.createElement('div');
    botBubble.className  = 'chat-bubble bot';
    botBubble.textContent = BOT_RESPONSES[Math.floor(Math.random() * BOT_RESPONSES.length)];
    box.appendChild(botBubble);
    box.scrollTop = box.scrollHeight;
  }, 800);
}

// =============================================
// SAFE MODE
// =============================================
let safeRemaining = 30;
let safeMsgIdx    = 0;

function enterSafeMode() {
  const overlay = document.getElementById('safemode-overlay');
  overlay.classList.add('active');
  safeRemaining = 30;
  safeMsgIdx    = 0;
  document.getElementById('safemode-timer').textContent = safeRemaining;
  document.getElementById('safemode-bar').style.width   = '100%';
  document.getElementById('safemode-text').textContent  = SAFE_MESSAGES[0];
  safeModeInterval = setInterval(() => {
    safeRemaining--;
    document.getElementById('safemode-timer').textContent = safeRemaining;
    document.getElementById('safemode-bar').style.width   = (safeRemaining / 30 * 100) + '%';
    if (safeRemaining % 5 === 0) {
      safeMsgIdx = (safeMsgIdx + 1) % SAFE_MESSAGES.length;
      document.getElementById('safemode-text').textContent = SAFE_MESSAGES[safeMsgIdx];
    }
    if (safeRemaining <= 0) exitSafeMode();
  }, 1000);
}

function exitSafeMode() {
  clearInterval(safeModeInterval);
  document.getElementById('safemode-overlay').classList.remove('active');
}

function showEmergencyPrompt() {
  document.getElementById('emergency-prompt').style.display = 'block';
}

function dismissEmergencyPrompt() {
  document.getElementById('emergency-prompt').style.display = 'none';
}

// =============================================
// DARK MODE
// =============================================
function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  document.getElementById('dark-toggle').textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('tenang_dark', isDark ? '1' : '0');
}

function loadDarkMode() {
  if (localStorage.getItem('tenang_dark') === '1') {
    document.body.classList.add('dark-mode');
    document.getElementById('dark-toggle').textContent = '☀️';
  }
}

// =============================================
// AUDIO ENGINE
// =============================================
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.connect(audioCtx.destination);
}

/* --- Noise buffer helper --- */
function makeNoiseBuffer(seconds = 2, sampleRate) {
  const sr  = sampleRate || audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, sr * seconds, sr);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function noiseSource(seconds = 2) {
  const src = audioCtx.createBufferSource();
  src.buffer = makeNoiseBuffer(seconds);
  src.loop   = true;
  return src;
}

/* ---------- SOUND CREATORS ---------- */

// Audio file cache
let audioBufferCache = {};

function loadAudioFile(soundId) {
  return new Promise((resolve, reject) => {
    if (audioBufferCache[soundId]) {
      resolve(audioBufferCache[soundId]);
      return;
    }
    
    const audioPath = `sounds/${soundId}.mp3`;
    fetch(audioPath)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioCtx.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        audioBufferCache[soundId] = audioBuffer;
        resolve(audioBuffer);
      })
      .catch(error => {
        console.error(`Failed to load ${audioPath}:`, error);
        reject(error);
      });
  });
}

function playAudioFile(soundId) {
  loadAudioFile(soundId).then(audioBuffer => {
    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.loop = true;
    src.connect(gainNode);
    src.start();
    soundNodes.push(src);
  }).catch(error => console.error('Error playing audio:', error));
}

function createLofi1() { playAudioFile('lofi_1'); return []; }
function createLofi2() { playAudioFile('lofi_2'); return []; }
function createLofi3() { playAudioFile('lofi_3'); return []; }
function createLofi4() { playAudioFile('lofi_4'); return []; }
function createLofi5() { playAudioFile('lofi_5'); return []; }
function createLofi6() { playAudioFile('lofi_6'); return []; }
function createLofi7() { playAudioFile('lofi_7'); return []; }
function createLofi8() { playAudioFile('lofi_8'); return []; }

/* ---------- SOUND SWITCHER ---------- */
function stopAllSoundNodes() {
  soundNodes.forEach(n => {
    try { n.stop(); }    catch (_) {}
    try { n.disconnect(); } catch (_) {}
  });
  soundNodes = [];
}

function playSoundType(type) {
  stopAllSoundNodes();
  currentSoundType = type;
  if (!soundActive) return;
  const map = {
    lofi_1: createLofi1,
    lofi_2: createLofi2,
    lofi_3: createLofi3,
    lofi_4: createLofi4,
    lofi_5: createLofi5,
    lofi_6: createLofi6,
    lofi_7: createLofi7,
    lofi_8: createLofi8,
  };
  const fn = map[type];
  if (fn) soundNodes = fn();
}

function toggleSound() {
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  soundActive = !soundActive;
  const btn = document.getElementById('sound-toggle');
  if (soundActive) {
    btn.classList.add('active');
    const vol = parseFloat(document.getElementById('volume-slider').value);
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 1.2);
    playSoundType(currentSoundType);
    updateSoundToggleIcon();
  } else {
    btn.classList.remove('active');
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.0);
    setTimeout(() => stopAllSoundNodes(), 1100);
    updateSoundToggleIcon();
  }
}

function updateSoundToggleIcon() {
  const btn   = document.getElementById('sound-toggle');
  const sound = SOUND_LIBRARY.find(s => s.id === currentSoundType);
  btn.innerHTML = soundActive
    ? `<span class="sound-toggle-emoji">${sound ? sound.emoji : '🔊'}</span><span class="sound-toggle-label">ON</span>`
    : `<span class="sound-toggle-emoji">🔇</span><span class="sound-toggle-label">OFF</span>`;

  const playBtn = document.getElementById('panel-play-btn');
  if (playBtn) {
    if (soundActive) {
      playBtn.textContent = '⏹ Stop';
      playBtn.classList.add('playing');
    } else {
      playBtn.textContent = '▶ Putar';
      playBtn.classList.remove('playing');
    }
  }
}

function buildSoundPanel() {
  const grid = document.getElementById('sound-grid');
  if (!grid) return;
  grid.innerHTML = '';
  SOUND_LIBRARY.forEach(sound => {
    const btn = document.createElement('button');
    btn.className = 'sound-card-btn' + (sound.id === currentSoundType ? ' active' : '');
    btn.dataset.type = sound.id;
    btn.innerHTML = `
      <span class="sc-emoji">${sound.emoji}</span>
      <span class="sc-label">${sound.label}</span>
      <span class="sc-desc">${sound.desc}</span>
    `;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sound-card-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSoundType = sound.id;
      if (!soundActive) {
        // auto-start when user picks a sound
        toggleSound();
      } else {
        playSoundType(sound.id);
      }
      updateSoundToggleIcon();
    });
    grid.appendChild(btn);
  });
}

// =============================================
// MOOD CHART
// =============================================
function renderMoodChart() {
  const canvas = document.getElementById('mood-chart');
  if (!canvas) return;
  const history = getMoodHistory();
  if (!history.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  const ctx2 = canvas.getContext('2d');
  const dpr  = window.devicePixelRatio || 1;
  const W    = canvas.parentElement.clientWidth - 48;
  const H    = 120;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx2.scale(dpr, dpr);
  ctx2.clearRect(0, 0, W, H);

  const last14 = history.slice(0, 14).reverse();
  const SCORE  = { baik: 2, biasa: 1, stres: 0 };
  const scores = last14.map(h => SCORE[h.mood] ?? 1);

  const isDark     = document.body.classList.contains('dark-mode');
  const lineColor  = isDark ? '#4caf78' : '#38875c';
  const fillColor  = isDark ? 'rgba(76,175,120,0.15)' : 'rgba(76,175,120,0.12)';
  const dotColor   = isDark ? '#5ec98a' : '#4caf78';
  const gridColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const labelColor = isDark ? '#4f7057' : '#8faa96';

  const padL = 28, padR = 16, padT = 16, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  ctx2.strokeStyle = gridColor; ctx2.lineWidth = 1;
  [0, 1, 2].forEach(v => {
    const y = padT + chartH - (v / 2) * chartH;
    ctx2.beginPath(); ctx2.moveTo(padL, y); ctx2.lineTo(padL + chartW, y); ctx2.stroke();
  });

  ctx2.fillStyle = labelColor; ctx2.font = '10px Nunito, sans-serif'; ctx2.textAlign = 'right';
  ['😔','😐','😊'].forEach((lbl, i) => {
    const y = padT + chartH - (i / 2) * chartH + 4;
    ctx2.fillText(lbl, padL - 4, y);
  });

  if (scores.length < 2) return;
  const xStep = chartW / (scores.length - 1);

  ctx2.beginPath();
  scores.forEach((s, i) => {
    const x = padL + i * xStep;
    const y = padT + chartH - (s / 2) * chartH;
    i === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
  });
  ctx2.lineTo(padL + (scores.length - 1) * xStep, padT + chartH);
  ctx2.lineTo(padL, padT + chartH);
  ctx2.closePath();
  ctx2.fillStyle = fillColor; ctx2.fill();

  ctx2.beginPath();
  scores.forEach((s, i) => {
    const x = padL + i * xStep;
    const y = padT + chartH - (s / 2) * chartH;
    i === 0 ? ctx2.moveTo(x, y) : ctx2.lineTo(x, y);
  });
  ctx2.strokeStyle = lineColor; ctx2.lineWidth = 2.5; ctx2.lineJoin = 'round'; ctx2.stroke();

  scores.forEach((s, i) => {
    const x = padL + i * xStep;
    const y = padT + chartH - (s / 2) * chartH;
    ctx2.beginPath(); ctx2.arc(x, y, 4, 0, Math.PI * 2);
    ctx2.fillStyle = dotColor; ctx2.fill();
    ctx2.strokeStyle = isDark ? '#1e2d21' : '#fff'; ctx2.lineWidth = 2; ctx2.stroke();
  });
}

// =============================================
// DOM READY
// =============================================
document.addEventListener('DOMContentLoaded', () => {

  loadDarkMode();
  buildGrounding();
  buildSoundPanel();
  updateSoundToggleIcon();

  /* --- Nav --- */
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  document.getElementById('btn-main-help').addEventListener('click', () => {
    showPage('emergency'); showTab('breathing');
  });

  document.getElementById('btn-check-mood').addEventListener('click', () => {
    document.getElementById('mood-section').scrollIntoView({ behavior: 'smooth' });
  });

  /* --- Mood --- */
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => handleMoodSelect(btn.dataset.mood));
  });

  /* --- Affirmation --- */
  document.getElementById('btn-affirmation').addEventListener('click', showNewAffirmation);
  showNewAffirmation();

  /* --- Tabs --- */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  /* --- Breathing --- */
  document.getElementById('breath-start').addEventListener('click', startBreathing);
  document.getElementById('breath-stop').addEventListener('click', () => stopBreathing(false));
  document.querySelectorAll('.breath-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.breath-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      breathMode = btn.dataset.mode;
      if (breathRunning) stopBreathing(false);
    });
  });

  /* --- Grounding --- */
  document.getElementById('ground-reset').addEventListener('click', resetGrounding);

  /* --- Chat --- */
  document.getElementById('chat-send').addEventListener('click', sendChatMessage);
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChatMessage();
  });

  /* --- Safe Mode --- */
  document.getElementById('safemode-start').addEventListener('click', enterSafeMode);
  document.getElementById('safemode-exit').addEventListener('click', exitSafeMode);

  /* --- Emergency prompt --- */
  document.getElementById('ep-dismiss').addEventListener('click', dismissEmergencyPrompt);

  /* --- Dark mode --- */
  document.getElementById('dark-toggle').addEventListener('click', () => {
    toggleDarkMode();
    setTimeout(renderMoodChart, 350);
  });

  /* --- Sound toggle (panel open/close) --- */
  const soundToggleBtn = document.getElementById('sound-toggle');
  soundToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = document.getElementById('sound-panel');
    panel.classList.toggle('open');
  });

  /* Close panel on outside click */
  document.addEventListener('click', (e) => {
    if (!document.getElementById('sound-widget').contains(e.target)) {
      document.getElementById('sound-panel').classList.remove('open');
    }
  });

  /* Volume slider */
  document.getElementById('volume-slider').addEventListener('input', (e) => {
    if (gainNode && soundActive) {
      gainNode.gain.setTargetAtTime(parseFloat(e.target.value), audioCtx.currentTime, 0.1);
    }
  });

  /* Play / Stop button inside panel */
  document.getElementById('panel-play-btn').addEventListener('click', () => {
    toggleSound();
  });

  /* --- History --- */
  document.getElementById('btn-clear-history').addEventListener('click', () => {
    if (confirm('Hapus semua riwayat mood?')) {
      localStorage.removeItem('tenang_mood_history');
      stressCount = 0;
      renderHistory();
    }
  });

  /* --- Feature Cards --- */
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('click', () => {
      const page = card.dataset.page;
      const tab  = card.dataset.tab;
      if (page) showPage(page);
      if (tab)  showTab(tab);
    });
  });

  /* --- Mobile Hamburger --- */
  const hamburger = document.getElementById('nav-hamburger');
  const navLinks  = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        hamburger.classList.remove('open');
        navLinks.classList.remove('open');
      });
    });
  }

  /* --- Scroll progress & back to top --- */
  const scrollBar = document.getElementById('scroll-progress-bar');
  const backToTop = document.getElementById('back-to-top');
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    if (scrollBar) scrollBar.style.width = pct + '%';
    if (backToTop) backToTop.classList.toggle('visible', scrollTop > 300);
  });
  if (backToTop) {
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* --- Floating particles --- */
  const particlesBg = document.getElementById('particles-bg');
  if (particlesBg) {
    const colors = ['#4caf78','#6fbcdc','#f7c97e','#b8e8c8','#d4ecf7'];
    for (let i = 0; i < 18; i++) {
      const p    = document.createElement('div');
      p.className = 'particle';
      const size  = 4 + Math.random() * 10;
      p.style.cssText = `
        width:${size}px; height:${size}px;
        left:${Math.random()*100}%;
        background:${colors[Math.floor(Math.random()*colors.length)]};
        animation-duration:${12 + Math.random()*20}s;
        animation-delay:${Math.random()*15}s;
      `;
      particlesBg.appendChild(p);
    }
  }

  /* --- Button press micro-anim --- */
  document.addEventListener('click', (e) => {
    const target = e.target.closest('.btn-primary, .btn-ghost, .btn-outline, .btn-call, .mood-btn, .tab-btn');
    if (!target) return;
    target.style.transform = 'scale(0.97)';
    setTimeout(() => { target.style.transform = ''; }, 120);
  });

  /* --- Toast helper --- */
  window.showToast = function(msg, emoji = '✅') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${emoji}</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  /* --- Override renderHistory to also render chart --- */
  const origRenderHistory = renderHistory;
  window.renderHistory = function() {
    origRenderHistory();
    renderMoodChart();
  };

});

// =============================================
// TYPING EFFECT (About page)
// =============================================
const texts = ["Orang-orang di Balik Layar "];
let textIndex = 0, charIndex = 0, isDeleting = false;
const typingElement = document.getElementById("typing-text");

function typingEffect() {
  const currentText = texts[textIndex];
  if (isDeleting) typingElement.textContent = currentText.substring(0, charIndex--);
  else            typingElement.textContent = currentText.substring(0, charIndex++);
  let speed = isDeleting ? 40 : 100;
  if (!isDeleting && charIndex === currentText.length) { speed = 2000; isDeleting = true; }
  else if (isDeleting && charIndex === 0) { isDeleting = false; textIndex = (textIndex + 1) % texts.length; speed = 500; }
  setTimeout(typingEffect, speed);
}
typingEffect();
