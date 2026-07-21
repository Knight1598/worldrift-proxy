/* =====================================================================
   Fever Mode / Rush Hour — สะสมคอมโบจากการส่งออเดอร์สำเร็จ เต็มหลอดแล้วแตะเพื่อเข้าสู่โหมด
   ความเร็ว 2 เท่า + ทำของแทบจะทันที เป็นเวลา 15 วินาที (ไม่ persist ผ่าน save — เป็น session state)
   ===================================================================== */
function isFeverActive() {
  return feverState.active;
}
function addFeverProgress(amount) {
  if (feverState.active) return; // ระหว่าง Fever ไม่ต้องสะสมซ้ำ (เต็มแล้วรอใช้ให้หมดก่อน)
  feverState.progress = Math.min(1, feverState.progress + amount);
  renderFeverBar();
}
function activateFever() {
  if (feverState.active || feverState.progress < 1) return;
  feverState.active = true;
  feverState.progress = 0;
  feverState.endsAt = performance.now() + FEVER_DURATION_MS;
  renderFeverBar();
  playSfxStageComplete(); // ยืมเสียงรัวเดิมมาใช้แทนเสียง Fever โดยเฉพาะ (ไม่ได้เพิ่มเสียงใหม่ในสโคปนี้)
  GameEvents.emit(EVENTS.FEVER_ACTIVATED, {});
}
function tickFever() {
  if (feverState.active && performance.now() >= feverState.endsAt) {
    feverState.active = false;
    renderFeverBar();
    GameEvents.emit(EVENTS.FEVER_ENDED, {});
  }
}
function renderFeverBar() {
  const wrap = document.getElementById('feverBarWrap');
  const fill = document.getElementById('feverBarFill');
  const label = document.getElementById('feverBarLabel');
  const ready = feverState.progress >= 1 && !feverState.active;
  fill.style.width = (feverState.progress * 100) + '%';
  wrap.classList.toggle('ready', ready);
  wrap.classList.toggle('active', feverState.active);
  label.textContent = feverState.active ? 'FEVER!!' : ready ? 'แตะเลย!' : 'FEVER';
}

// รับ event จาก economy.js (deliverOrder) แทนถูกเรียกตรงๆ ข้ามไฟล์ — decouple ให้ economy.js
// ไม่ต้องรู้จัก Fever Mode เลยด้วยซ้ำ
GameEvents.on(EVENTS.ORDER_DELIVERED, () => addFeverProgress(FEVER_FILL_PER_ORDER));

