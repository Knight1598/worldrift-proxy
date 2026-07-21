/* =====================================================================
   Forge Frenzy (โหมดเตาเดือด) — score-attack โหดๆ ตายง่าย เก็บไฮสกอร์ เล่นเอาชนะตัวเอง
   ออเดอร์โผล่ทีละอันพร้อมหลอดเวลานับถอยหลัง — แตะทั่งตีเหล็กรัวๆ ให้ครบก่อนหมดเวลา = เสิร์ฟ +คะแนน
   พลาด (หมดเวลา) = เสีย 1 หัวใจ | หมดหัวใจ = จบเกม | ยิ่งเสิร์ฟยิ่งเวลาน้อยลง+ต้องตีเยอะขึ้น (เร่งจนตายแน่ๆ)
   frenzyState เป็น session state ล้วนๆ ไม่ persist (ยกเว้นไฮสกอร์ player.frenzyBest ที่เก็บใน save)
   ตรรกะอยู่ที่นี่ ส่วน DOM/overlay อยู่ที่ ui/frenzy-ui.js (subscribe อีเวนต์ด้านล่าง)
   ===================================================================== */
let frenzyState = { active: false, lives: 0, score: 0, combo: 0, orderCount: 0, order: null };

function frenzyOrderTimeMs() {
  return Math.max(FRENZY_ORDER_TIME_MIN_MS, FRENZY_ORDER_TIME_START_MS - frenzyState.orderCount * FRENZY_TIME_DECAY_MS);
}
function frenzyForgeNeeded() {
  return Math.min(FRENZY_FORGE_TAPS_MAX, FRENZY_FORGE_TAPS_START + Math.floor(frenzyState.orderCount / FRENZY_TAPS_PER_STEP));
}
function frenzyComboMult() { return 1 + frenzyState.combo * FRENZY_COMBO_STEP; }

// สร้างออเดอร์ถัดไป (ไอคอนสุ่ม + หลอดเวลาที่สั้นลงเรื่อยๆ + จำนวนแตะที่มากขึ้นเรื่อยๆ)
function frenzyNextOrder() {
  const icon = FRENZY_ITEM_ICONS[Math.floor(Math.random() * FRENZY_ITEM_ICONS.length)];
  frenzyState.order = {
    icon,
    forgeHave: 0,
    forgeNeeded: frenzyForgeNeeded(),
    timeMax: frenzyOrderTimeMs(),
    timeLeft: frenzyOrderTimeMs(),
  };
}

function startFrenzy() {
  frenzyState.active = true;
  frenzyState.lives = FRENZY_LIVES;
  frenzyState.score = 0;
  frenzyState.combo = 0;
  frenzyState.orderCount = 0;
  frenzyNextOrder();
  GameEvents.emit(EVENTS.FRENZY_STARTED, {});
}

// แตะทั่ง 1 ครั้ง — ตีเหล็ก +1 ถ้าครบตามที่ต้องการ = เสิร์ฟสำเร็จ
function frenzyTap() {
  if (!frenzyState.active || !frenzyState.order) return;
  frenzyState.order.forgeHave += 1;
  if (frenzyState.order.forgeHave >= frenzyState.order.forgeNeeded) serveFrenzyOrder();
}

function serveFrenzyOrder() {
  const gain = Math.round(FRENZY_SCORE_BASE * frenzyComboMult());
  frenzyState.score += gain;
  frenzyState.combo += 1;
  frenzyState.orderCount += 1;
  GameEvents.emit(EVENTS.FRENZY_SERVED, { score: frenzyState.score, combo: frenzyState.combo, gain });
  frenzyNextOrder();
}

function frenzyMiss() {
  frenzyState.lives -= 1;
  frenzyState.combo = 0;
  GameEvents.emit(EVENTS.FRENZY_MISS, { lives: frenzyState.lives });
  if (frenzyState.lives <= 0) { frenzyGameOver(); return; }
  frenzyNextOrder(); // ยังไม่ตาย — ออเดอร์ใหม่ (ความยากเท่าเดิม ไม่รีเซ็ต orderCount)
}

function frenzyGameOver() {
  frenzyState.active = false;
  const isNewBest = frenzyState.score > (player.frenzyBest || 0);
  if (isNewBest) { player.frenzyBest = frenzyState.score; saveGame(); }
  frenzyState.order = null;
  GameEvents.emit(EVENTS.FRENZY_OVER, { score: frenzyState.score, best: player.frenzyBest || 0, isNewBest });
}

function quitFrenzy() {
  // ออกจากโหมดกลางคัน (ไม่บันทึกเป็นตาย — แค่ปิด) ให้ ui ซ่อน overlay
  frenzyState.active = false;
  frenzyState.order = null;
}

// เรียกทุกเฟรมจาก gameTick เฉพาะตอน active — นับเวลาถอยหลังด้วย dt (deterministic ในเทสต์)
function tickFrenzy(dt) {
  if (!frenzyState.active || !frenzyState.order) return;
  frenzyState.order.timeLeft -= dt;
  if (frenzyState.order.timeLeft <= 0) frenzyMiss();
}
