/* =====================================================================
   Forge Frenzy UI — overlay เต็มจอของโหมดเตาเดือด (ตรรกะอยู่ที่ features/frenzy.js)
   โชว์คะแนน/ไฮสกอร์/หัวใจ + ออเดอร์ปัจจุบัน(ไอคอน+หลอดเวลา+หลอดตีเหล็ก) + ปุ่มทั่งตัวโต + หน้าจบเกม
   ===================================================================== */
function openFrenzyMode() {
  document.getElementById('frenzyOverlay').classList.add('show');
  document.getElementById('frenzyGameover').classList.remove('show');
  ensureAudioCtx();
  startFrenzy();
  renderFrenzy();
}
function closeFrenzyMode() {
  quitFrenzy();
  document.getElementById('frenzyOverlay').classList.remove('show');
}

// วาดเต็ม (ตอนเริ่ม/เสิร์ฟ/พลาด) — หัวใจ + คะแนน + ออเดอร์ใหม่
function renderFrenzy() {
  document.getElementById('frenzyScore').textContent = formatCompact(frenzyState.score);
  document.getElementById('frenzyBest').textContent = formatCompact(player.frenzyBest || 0);
  const livesEl = document.getElementById('frenzyLives');
  let hearts = '';
  for (let i = 0; i < FRENZY_LIVES; i++) hearts += (i < frenzyState.lives ? '❤️' : '🖤');
  livesEl.textContent = hearts;
  const comboEl = document.getElementById('frenzyCombo');
  if (frenzyState.combo >= 2) { comboEl.textContent = 'x' + frenzyState.combo + ' COMBO!'; comboEl.classList.add('show'); }
  else comboEl.classList.remove('show');
  const o = frenzyState.order;
  if (o) {
    document.getElementById('frenzyOrderIcon').src = o.icon;
    document.getElementById('frenzyForgeLabel').textContent = o.forgeHave + '/' + o.forgeNeeded;
  }
  renderFrenzyLive();
}

// วาดเฉพาะหลอด (เรียกทุกเฟรมจาก gameTick ตอน active) — ลื่นไหลไม่ rebuild ทั้ง overlay
function renderFrenzyLive() {
  const o = frenzyState.order;
  if (!o) return;
  const tPct = Math.max(0, o.timeLeft / o.timeMax);
  const tf = document.getElementById('frenzyTimerFill');
  tf.style.width = (tPct * 100) + '%';
  tf.classList.toggle('frenzy-timer-danger', tPct <= 0.4); // แดง+กะพริบตอนใกล้หมด
  document.getElementById('frenzyForgeFill').style.width = Math.min(100, o.forgeHave / o.forgeNeeded * 100) + '%';
}

function frenzyShake() {
  const s = document.getElementById('frenzyScene');
  s.classList.remove('frenzy-shake'); void s.offsetWidth; s.classList.add('frenzy-shake');
}

// ===== ปุ่มทั่ง: แตะ = ตีเหล็ก + ประกายไฟ + เด้ง =====
function frenzyAnvilHit() {
  if (!frenzyState.active) return;
  frenzyTap();
  const anvil = document.getElementById('frenzyAnvil');
  anvil.classList.remove('frenzy-anvil-hit'); void anvil.offsetWidth; anvil.classList.add('frenzy-anvil-hit');
  playSfxTap();
  renderFrenzyLive();
  document.getElementById('frenzyForgeLabel').textContent = frenzyState.order ? (frenzyState.order.forgeHave + '/' + frenzyState.order.forgeNeeded) : '';
}

// ===== mount: ปุ่ม + อีเวนต์ =====
document.getElementById('frenzyAnvil').addEventListener('pointerdown', (e) => { e.preventDefault(); frenzyAnvilHit(); });
document.getElementById('frenzyQuit').addEventListener('click', closeFrenzyMode);
document.getElementById('frenzyExit').addEventListener('click', closeFrenzyMode);
document.getElementById('frenzyRetry').addEventListener('click', () => {
  document.getElementById('frenzyGameover').classList.remove('show');
  startFrenzy(); renderFrenzy();
});
document.getElementById('btnOpenFrenzy').addEventListener('click', openFrenzyMode);

GameEvents.on(EVENTS.FRENZY_SERVED, () => {
  renderFrenzy();
  const anvil = document.getElementById('frenzyAnvil');
  anvil.classList.remove('frenzy-anvil-serve'); void anvil.offsetWidth; anvil.classList.add('frenzy-anvil-serve');
  playSfxCashRegister();
});
GameEvents.on(EVENTS.FRENZY_MISS, () => {
  frenzyShake();
  const scene = document.getElementById('frenzyScene');
  scene.classList.remove('frenzy-flash'); void scene.offsetWidth; scene.classList.add('frenzy-flash');
  playSfxError();
  renderFrenzy();
});
GameEvents.on(EVENTS.FRENZY_OVER, (e) => {
  const go = document.getElementById('frenzyGameover');
  document.getElementById('frenzyGoTitle').textContent = e.isNewBest ? '🏆 สถิติใหม่!' : 'จบเกม!';
  document.getElementById('frenzyGoTitle').classList.toggle('frenzy-newbest', e.isNewBest);
  document.getElementById('frenzyGoScore').textContent = formatCompact(e.score);
  document.getElementById('frenzyGoBest').textContent = formatCompact(e.best);
  go.classList.add('show');
  playSfxStageComplete();
});
