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

// idle ชิลล์: คอมโบเป็นโบนัสเบาๆ ไม่มีดราม่าตอนหลุด — แค่ค่อยๆ หายไปเงียบๆ
GameEvents.on(EVENTS.COMBO_CHANGED, () => renderCombo());

GameEvents.on(EVENTS.RUSH_STARTED, () => {
  const b = document.getElementById('rushBanner');
  if (b) { b.classList.add('show'); }
  playSfxCashRegister(); // เสียงเบาๆ แบบดีใจ(ขายดี) ไม่ใช่เสียงเตือนภัย
});
GameEvents.on(EVENTS.RUSH_ENDED, () => {
  const b = document.getElementById('rushBanner');
  if (b) b.classList.remove('show');
});
