/* =====================================================================
   Mystery Gift Box — กล่องของขวัญเด้งดึ๋งโผล่บนพื้นร้านเป็นระยะ (แบบกล่อง/หีบใน Eatventure)
   แตะเปิดได้รางวัลสุ่ม: เงินก้อน (อิงรายได้จริง) / เพชร / เติมของ-เติม Fever ทันที
   ไม่แตะภายใน GIFTBOX_LINGER_MS ก็หายไปเอง — แพทเทิร์นเดียวกับ Golden Goblin (ใช้อิโมจิ ไม่มี asset ใหม่)
   ===================================================================== */
let giftboxTimerId = null;
function scheduleGiftBox() {
  if (giftboxTimerId) clearTimeout(giftboxTimerId);
  const delay = GIFTBOX_MIN_INTERVAL_MS + Math.random() * (GIFTBOX_MAX_INTERVAL_MS - GIFTBOX_MIN_INTERVAL_MS);
  giftboxTimerId = setTimeout(spawnGiftBox, delay);
}
function spawnGiftBox() {
  updateSceneMetrics();
  const el = document.createElement('div');
  el.className = 'gift-box';
  el.textContent = '🎁';
  // สุ่มตำแหน่งบนพื้นโซนกลาง (ไม่ทับ station แถวบน / เคาน์เตอร์แถวล่าง)
  el.style.left = (scene.width * (0.15 + Math.random() * 0.7)) + 'px';
  el.style.top = (scene.height * (0.42 + Math.random() * 0.25)) + 'px';
  document.getElementById('standStageView').appendChild(el);
  const state = { opened: false };
  el.addEventListener('click', () => {
    if (state.opened) return;
    state.opened = true;
    openGiftBox(el);
  });
  setTimeout(() => {
    if (!state.opened && el.parentNode) el.remove();
    scheduleGiftBox();
  }, GIFTBOX_LINGER_MS);
}
function openGiftBox(el) {
  const rect = el.getBoundingClientRect();
  const stageRect = document.getElementById('standStageView').getBoundingClientRect();
  const x = rect.left - stageRect.left, y = rect.top - stageRect.top;
  el.classList.add('opened');
  setTimeout(() => { if (el.parentNode) el.remove(); }, 400);
  playSfxUpgrade();
  const roll = Math.random();
  let kind;
  if (roll < 0.5) {
    kind = 'gold';
    const reward = Math.max(30, Math.round(estimateIncomePerMinute() * 0.7));
    player.gold += reward;
    player.stats.totalGoldEarned += reward;
    spawnFloatText(x, y, `🎁 +${reward.toLocaleString()} 🪙`, 'gold');
    GameEvents.emit(EVENTS.COIN_COLLECTED, { amount: reward });
  } else if (roll < 0.8) {
    kind = 'gems';
    player.gems += 2;
    renderGems();
    spawnFloatText(x, y, '🎁 +2 💎', 'tip');
    saveGame();
  } else {
    kind = 'instant';
    // แจกผลบัพแบบ instant ฟรี 1 ครั้ง (เติมคลังเต็ม หรือเติมหลอด Fever เต็ม)
    const instant = Math.random() < 0.5 ? 'instant_restock' : 'fever_now';
    applyInstantBuff(getBuffDef(instant));
    spawnFloatText(x, y, `🎁 ${getBuffDef(instant).name}!`, 'tip');
  }
  GameEvents.emit(EVENTS.GIFT_OPENED, { kind });
}
