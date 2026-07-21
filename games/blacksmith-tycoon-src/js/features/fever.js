/* =====================================================================
   Fever Mode / Rush Hour — สะสมคอมโบจากการส่งออเดอร์สำเร็จ เต็มหลอดแล้วแตะเพื่อเข้าสู่โหมด
   ความเร็ว 2 เท่า + ทำของแทบจะทันที เป็นเวลา 15 วินาที (ไม่ persist ผ่าน save — เป็น session state)
   ===================================================================== */
function isFeverActive() {
  return feverState.active;
}
function addFeverProgress(amount) {
  if (feverState.active) return; // ระหว่าง Fever ไม่ต้องสะสมซ้ำ (เต็มแล้วรอใช้ให้หมดก่อน)
  feverState.progress = Math.min(1, feverState.progress + amount * getComboFeverMult()); // คอมโบสูง = Fever มาไวขึ้น
  // ยิง event แทนเรียก renderFeverBar() (ui/hud.js) ข้ามโดเมนตรงๆ — features/ ไม่ควรรู้จัก DOM ของ HUD
  GameEvents.emit(EVENTS.FEVER_PROGRESS, { progress: feverState.progress });
}
function activateFever() {
  if (feverState.active || feverState.progress < 1) return;
  feverState.active = true;
  feverState.progress = 0;
  feverState.endsAt = performance.now() + FEVER_DURATION_MS;
  player.stats.feverCount = (player.stats.feverCount || 0) + 1; // นับจำนวนครั้งที่เข้า Fever (ใช้กับเควสนำทาง fever1)
  playSfxStageComplete(); // ยืมเสียงรัวเดิมมาใช้แทนเสียง Fever โดยเฉพาะ (ไม่ได้เพิ่มเสียงใหม่ในสโคปนี้)
  // ไม่เรียก renderFeverBar() ตรงๆ ที่นี่ -- ui/hud.js subscribe FEVER_ACTIVATED ไว้แล้ว กันรีเฟรชซ้ำ
  GameEvents.emit(EVENTS.FEVER_ACTIVATED, {});
}
function tickFever() {
  if (feverState.active && performance.now() >= feverState.endsAt) {
    feverState.active = false;
    // ไม่เรียก renderFeverBar() ตรงๆ ที่นี่ -- ui/hud.js subscribe FEVER_ENDED ไว้แล้ว กันรีเฟรชซ้ำ
    GameEvents.emit(EVENTS.FEVER_ENDED, {});
  }
}

// รับ event จาก economy.js (deliverOrder) แทนถูกเรียกตรงๆ ข้ามไฟล์ — decouple ให้ economy.js
// ไม่ต้องรู้จัก Fever Mode เลยด้วยซ้ำ
GameEvents.on(EVENTS.ORDER_DELIVERED, () => addFeverProgress(FEVER_FILL_PER_ORDER));

