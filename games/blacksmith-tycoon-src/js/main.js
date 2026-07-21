/* =====================================================================
   Game loop — worker/customer state machines อัปเดตทุกเฟรมผ่าน requestAnimationFrame
   ===================================================================== */
function findAssignableCustomer() {
  const activeSlots = workers.length; // จำนวนออเดอร์ที่รับพร้อมกันได้ = จำนวน worker (มีพนักงานช่วยแบ่งงานคิวจริง)
  const queue = getQueueCustomers();
  for (const c of queue) {
    if (c.slotIndex >= activeSlots) break;
    if (c.state === 'QUEUED') return c;
  }
  return null;
}


let rafId = null;
let lastTickTime = null;
function gameTick(ts) {
  if (lastTickTime == null) lastTickTime = ts;
  let dt = ts - lastTickTime;
  lastTickTime = ts;
  dt = Math.min(dt, 100); // กันดีเลย์กระโดดยาวตอนสลับแท็บ/lag spike
  tickFever();
  tickBuffs();
  tickBuffCountdownDisplay();
  tickMaterialRegen(dt);
  tickWorkers(dt);
  tickCustomers(dt);
  tickFlyingCoins(dt);
  rafId = requestAnimationFrame(gameTick);
}

let spawnTimerId = null;
function scheduleNextCustomer() {
  if (spawnTimerId) clearTimeout(spawnTimerId);
  spawnTimerId = setTimeout(() => {
    if (getQueueCustomers().length < getMaxQueueSize()) spawnCustomerEntity();
    scheduleNextCustomer();
  }, getSpawnIntervalMs());
}


/* =====================================================================
   Event listeners
   ===================================================================== */
// แตะโต๊ะสถานีเปิดป๊อปอัพเลเวลสินค้าโดยตรง (แบบแตะสถานีในเกมต้นแบบ) — ป้ายสินค้าวงกลมก็ยังเปิดได้เหมือนเดิม
document.getElementById('standBooth').addEventListener('click', (e) => {
  e.currentTarget.classList.remove('tap-bump');
  void e.currentTarget.offsetWidth;
  e.currentTarget.classList.add('tap-bump');
  playSfxTap();
  openProductLevelModal();
});

// หมายเหตุ: listener ของ productBadge/btnAdvanceStage/feverBarWrap/settings ทั้งหมดถูกย้ายไปอยู่
// ในไฟล์ ui/*.js ที่เป็นเจ้าของ component นั้นๆ แล้ว (product-modal.js, stage-complete-modal.js, hud.js,
// settings-modal.js) เหลือแค่ตัวที่ไม่มีไฟล์ ui/ เฉพาะของตัวเอง (welcome-back/game-complete โมดัลเล็กๆ) ไว้ที่นี่
document.getElementById('btnCloseWelcomeBack').addEventListener('click', () => {
  document.getElementById('welcomeBackModal').classList.remove('show');
  renderGold();
});
document.getElementById('btnCloseGameComplete').addEventListener('click', () => {
  document.getElementById('gameCompleteModal').classList.remove('show');
});

/* =====================================================================
   Autosave + Init
   ===================================================================== */
setInterval(saveGame, 10000);
window.addEventListener('beforeunload', saveGame);

// Responsive geometry: ย่อ/ขยายจอระหว่างเล่นแล้ว waypoint (stationPos/queueSlotPos/idlePos) คำนวณสดจาก
// scene ทุกเฟรมอยู่แล้ว จึงปรับตามเอง — แต่ต้อง (1) อัปเดต scene ก่อน (2) รีทาร์เก็ตเหรียญที่กำลังบิน
// เพราะมัน cache targetX/Y ของกล่อง Gold ไว้ (ตำแหน่งเลื่อนหลัง resize) (3) รีเฟรช UI ที่อิงตำแหน่ง
// debounce กันยิงรัวๆ ตอนลากขอบจอ
let resizeTimer = null;
window.addEventListener('resize', () => {
  updateSceneMetrics(); // อัปเดตทันทีให้ waypoint ถูกต้องในเฟรมถัดไป
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    retargetFlyingCoins(); // เหรียญที่บินอยู่เล็งกล่อง Gold ตำแหน่งใหม่
    refreshStationsUi();
  }, 120);
});

loadGame();
ensurePlayerIdentity(); // ให้ผู้เล่นทุกคน (ใหม่หรือ migrate มาจากเซฟรุ่นเก่า) มี playerId คงที่ (ดู systems/leaderboard.js)
updateSceneMetrics();
applyOfflineEarnings();
renderAll();
initWorkers();
scheduleNextCustomer();
scheduleGoblin();
scheduleGiftBox();
rafId = requestAnimationFrame(gameTick);
