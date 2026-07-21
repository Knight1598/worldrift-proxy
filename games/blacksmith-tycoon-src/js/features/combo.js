/* =====================================================================
   Combo (Active Rush) — เสิร์ฟออเดอร์ต่อเนื่องให้ทันเวลาเพื่อสะสมคอมโบ ตัวคูณเงิน + เติม Fever ไวขึ้น
   คอมโบขาดเมื่อ (1) เว้นช่วงเกิน COMBO_WINDOW_MS หรือ (2) ปล่อยหลอดความอดทนลูกค้าหมดขณะกำลังเสิร์ฟ
   comboState เป็น session state ล้วนๆ (ประกาศที่ state.js เหมือน feverState) ไม่ persist ผ่าน save
   ===================================================================== */
function getComboCount() { return comboState.count; }

// ตัวคูณเงินจากคอมโบ — คอมโบแรก (1) = x1 พอดี (กันกระทบเทสต์ที่เช็คเงินออเดอร์เดียวเป๊ะ) แล้วไต่ขึ้นทีละ 5%
function getComboMult() {
  return 1 + Math.min(COMBO_MAX_BONUS, Math.max(0, comboState.count - 1) * COMBO_GOLD_BONUS);
}
// ตัวคูณอัตราเติมหลอด Fever จากคอมโบ (ยิ่งคอมโบสูง Fever มาไวขึ้น — รางวัลของการเล่นแอคทีฟ)
function getComboFeverMult() {
  return 1 + Math.min(COMBO_MAX_FEVER_BONUS, Math.max(0, comboState.count - 1) * COMBO_FEVER_BONUS);
}

// เรียกทุกครั้งที่เสิร์ฟออเดอร์สำเร็จ (ORDER_SERVED) — ต่อคอมโบถ้ายังอยู่ในหน้าต่างเวลา ไม่งั้นเริ่มนับใหม่ที่ 1
function registerServe() {
  const now = performance.now();
  comboState.count = (now <= comboState.expiresAt) ? comboState.count + 1 : 1;
  comboState.expiresAt = now + COMBO_WINDOW_MS;
  if (comboState.count > (player.stats.bestCombo || 0)) player.stats.bestCombo = comboState.count;
  GameEvents.emit(EVENTS.COMBO_CHANGED, { combo: comboState.count });
}

function breakCombo() {
  if (comboState.count === 0) return;
  comboState.count = 0;
  comboState.expiresAt = 0;
  GameEvents.emit(EVENTS.COMBO_CHANGED, { combo: 0 });
}

// เรียกทุกเฟรมจาก gameTick — คอมโบหมดอายุเองถ้าเว้นช่วงนานเกิน (ไม่ได้เสิร์ฟต่อเนื่อง)
function tickCombo() {
  if (comboState.count > 0 && performance.now() > comboState.expiresAt) breakCombo();
}

GameEvents.on(EVENTS.ORDER_SERVED, () => registerServe());
GameEvents.on(EVENTS.ORDER_MISSED, () => breakCombo()); // ปล่อยหลอดหมด = คอมโบขาดทันที
