/* =====================================================================
   Active Rush HUD — ตัวเลขคอมโบตัวโต + แบนเนอร์ Rush (ตรรกะอยู่ที่ features/combo.js + features/rush.js)
   คอมโบโชว์เมื่อ >= 2, เด้งทุกครั้งที่ต่อคอมโบ, สั่น+จางตอนคอมโบขาด | Rush banner สไลด์เข้า/ออกตามอีเวนต์
   ===================================================================== */
function renderCombo() {
  const el = document.getElementById('comboIndicator');
  if (!el) return;
  const combo = getComboCount();
  if (combo < 2) { el.classList.remove('show'); return; }
  const bonusPct = Math.round((getComboMult() - 1) * 100);
  el.innerHTML = '<span class="combo-x">COMBO</span> <span class="combo-num">x' + combo + '</span>'
    + '<span class="combo-bonus">+' + bonusPct + '% 🪙</span>';
  el.classList.add('show');
  el.classList.remove('combo-pop'); void el.offsetWidth; el.classList.add('combo-pop'); // เด้งทุกครั้งที่ขึ้น
}

GameEvents.on(EVENTS.COMBO_CHANGED, (e) => {
  const el = document.getElementById('comboIndicator');
  if (e.combo === 0 && el && el.classList.contains('show')) {
    // คอมโบขาด — สะบัดสั้นๆ ให้รู้สึก "หลุด" ก่อนซ่อน
    el.classList.remove('combo-pop'); el.classList.add('combo-break');
    setTimeout(() => { el.classList.remove('combo-break'); renderCombo(); }, 260);
    return;
  }
  renderCombo();
});

GameEvents.on(EVENTS.RUSH_STARTED, () => {
  const b = document.getElementById('rushBanner');
  if (b) { b.classList.add('show'); }
  playSfxStageComplete(); // ยืมเสียงรัวเดิมประกาศ Rush
});
GameEvents.on(EVENTS.RUSH_ENDED, () => {
  const b = document.getElementById('rushBanner');
  if (b) b.classList.remove('show');
});
