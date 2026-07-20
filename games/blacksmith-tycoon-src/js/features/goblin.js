/* =====================================================================
   Golden Goblin — ทุกๆ 2-3 นาที มี NPC วิ่งผ่านฉากอย่างรวดเร็ว แตะทันได้รางวัลก้อนใหญ่
   (ใช้อิโมจิแทน sprite ใหม่ เพื่อไม่ต้องตัด asset เพิ่มในสโคปนี้)
   ===================================================================== */
function estimateIncomePerMinute() {
  // อิงสูตร throughput เดียวกับที่ใช้คำนวณ Offline Earnings (deterministic ไม่พึ่ง DOM)
  return getThroughputPerMs() * getRevenuePerSale() * 60000;
}
let goblinTimerId = null;
function scheduleGoblin() {
  if (goblinTimerId) clearTimeout(goblinTimerId);
  const delay = GOBLIN_MIN_INTERVAL_MS + Math.random() * (GOBLIN_MAX_INTERVAL_MS - GOBLIN_MIN_INTERVAL_MS);
  goblinTimerId = setTimeout(spawnGoblin, delay);
}
function spawnGoblin() {
  updateSceneMetrics();
  const el = document.createElement('div');
  el.className = 'golden-goblin';
  el.textContent = '👺';
  const y = scene.height * (0.3 + Math.random() * 0.3);
  el.style.top = y + 'px';
  const dir = Math.random() < 0.5 ? 1 : -1; // 1 = วิ่งจากซ้ายไปขวา, -1 = ขวาไปซ้าย
  const startX = dir === 1 ? -60 : scene.width + 60;
  const endX = dir === 1 ? scene.width + 60 : -60;
  el.style.left = startX + 'px';
  if (dir === -1) el.style.transform = 'scaleX(-1)';
  document.getElementById('standStageView').appendChild(el);
  const state = { caught: false };
  el.addEventListener('click', () => {
    if (state.caught) return;
    state.caught = true;
    catchGoblin(el);
  });
  // ปล่อยให้ browser วาดตำแหน่งเริ่มต้นก่อน 1 เฟรม แล้วค่อยสั่งเปลี่ยน left เพื่อให้ CSS transition วิ่งจริง
  requestAnimationFrame(() => {
    el.style.transitionDuration = GOBLIN_CROSS_MS + 'ms';
    el.style.left = endX + 'px';
  });
  setTimeout(() => {
    if (!state.caught && el.parentNode) el.remove();
    scheduleGoblin();
  }, GOBLIN_CROSS_MS + 80);
}
function catchGoblin(el) {
  el.style.transitionDuration = '0s';
  el.classList.add('caught');
  const reward = Math.max(10, Math.round(estimateIncomePerMinute()));
  player.gold += reward;
  player.stats.totalGoldEarned += reward;
  const rect = el.getBoundingClientRect();
  const stageRect = document.getElementById('standStageView').getBoundingClientRect();
  spawnFloatText(rect.left - stageRect.left, rect.top - stageRect.top, `👺 +${reward.toLocaleString()} 🪙`, 'gold');
  playSfxCashRegister();
  renderGold();
  bumpGoldCounter();
  setTimeout(() => { if (el.parentNode) el.remove(); }, 500);
}

