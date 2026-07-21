/* =====================================================================
   Income Tracker — เก็บ sample รายได้จริงแบบ rolling window (ป้อนจาก COIN_COLLECTED
   ผ่าน Event Bus) แทนการคำนวณอัตรารายได้แบบทฤษฎีล้วนๆ ทุกครั้งที่มีคนต้องใช้ค่านี้

   เดิม applyOfflineEarnings() (progression.js) และ catchGoblin() (goblin.js) ต่างคน
   ต่างคำนวณสูตรทฤษฎีเดียวกัน (getThroughputPerMs() * getRevenuePerSale()) แยกกันคนละที่
   — เสี่ยงเพี้ยนถ้าปรับที่หนึ่งแล้วลืมอีกที่ ตอนนี้รวมเป็นฟังก์ชันเดียว estimateIncomePerMinute()
   ที่ทั้งสองจุดเรียกใช้ร่วมกัน โดยสูตรทฤษฎียังคงไว้เป็น fallback ตอน cold-start
   (เพิ่งโหลดเกม ยังไม่มี sample จริงสะสมพอ)
   ===================================================================== */
const incomeTracker = { samples: [], windowMs: 5 * 60 * 1000 };
const MIN_SAMPLES_FOR_TRACKED_ESTIMATE = 3;

function recordIncome(amount) {
  incomeTracker.samples.push({ t: performance.now(), amount });
  pruneOldSamples();
}
function pruneOldSamples() {
  const cutoff = performance.now() - incomeTracker.windowMs;
  incomeTracker.samples = incomeTracker.samples.filter(s => s.t >= cutoff);
}
function getRecentIncomePerMinute() {
  pruneOldSamples();
  const total = incomeTracker.samples.reduce((sum, s) => sum + s.amount, 0);
  return total / (incomeTracker.windowMs / 60000);
}

// ฟังก์ชันเดียวที่เป็น "อัตรารายได้ปัจจุบัน" ตัวจริง — ใช้แทนสูตรทฤษฎีที่เคยก็อปสองที่
function estimateIncomePerMinute() {
  if (incomeTracker.samples.length >= MIN_SAMPLES_FOR_TRACKED_ESTIMATE) return getRecentIncomePerMinute();
  return getThroughputPerMs() * getRevenuePerSale() * 60000; // fallback ทฤษฎี ตอนข้อมูลจริงยังไม่พอ
}

GameEvents.on(EVENTS.COIN_COLLECTED, ({ amount }) => recordIncome(amount));
