/* =====================================================================
   Rush Hour (Active Rush) — ลูกค้ารุมเข้ามาเป็นระลอกเป็นช่วงๆ: มาถี่ขึ้น + รับคิวได้มากขึ้น +
   หลอดความอดทนหมดไวขึ้น → บีบให้ผู้เล่นกดผลิตรัวๆ เพื่อเสิร์ฟให้ทัน (คอมโบพุ่ง / พลาดคอมโบขาด)
   rushState เป็น session state ล้วนๆ (ประกาศที่ state.js) ไม่ persist ผ่าน save
   ===================================================================== */
function isRushActive() { return rushState.active; }

// เวลาหลอดความอดทน (ms) — คงที่ ไม่บีบให้กดดัน (idle ชิลล์) — Rush แค่ทำให้ลูกค้ามาเยอะขึ้น = รายได้พุ่ง ไม่ใช่ความเครียด
function getPatienceDurationMs() {
  return PATIENCE_DURATION_MS;
}

let rushTimerId = null;
function scheduleNextRush() {
  if (rushTimerId) clearTimeout(rushTimerId);
  const delay = RUSH_INTERVAL_MIN_MS + Math.random() * (RUSH_INTERVAL_MAX_MS - RUSH_INTERVAL_MIN_MS);
  rushTimerId = setTimeout(startRush, delay);
}

function startRush() {
  rushState.active = true;
  rushState.endsAt = performance.now() + RUSH_DURATION_MS;
  GameEvents.emit(EVENTS.RUSH_STARTED, {});
  scheduleNextCustomer(); // รีสตาร์ตตัวจับเวลา spawn ให้ใช้ interval สั้นของ Rush ทันที (ดู getSpawnIntervalMs)
}

function endRush() {
  rushState.active = false;
  GameEvents.emit(EVENTS.RUSH_ENDED, {});
  scheduleNextCustomer(); // กลับไปใช้ interval ปกติ
  scheduleNextRush();
}

// เรียกทุกเฟรมจาก gameTick — จบ Rush เมื่อหมดเวลา
function tickRush() {
  if (rushState.active && performance.now() >= rushState.endsAt) endRush();
}
