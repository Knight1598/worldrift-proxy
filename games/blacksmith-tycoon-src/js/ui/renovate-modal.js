/* =====================================================================
   Renovate Modal — ขึ้นด่านแบบเกมต้นแบบ: ปุ่ม 🔨 ซ้ายล่างเปิดหน้าต่าง Before/After
   เงื่อนไข: อัปเกรด "สินค้า" (สถานี) ถึง RENOVATE_GATE_LEVEL ก่อน ("level 25 first!")
   ผ่านเงื่อนไขแล้วกด Renovate ได้เลย ไม่ต้องรออัปเกรดชนิดอื่นครบอีกต่อไป
   ===================================================================== */
function isRenovateReady() {
  return player.upgradeLevels.portion >= RENOVATE_GATE_LEVEL;
}

function renderRenovateModal() {
  const stage = getStage();
  const isLast = player.stageIndex >= STAGES.length - 1;
  const next = isLast ? null : STAGES[player.stageIndex + 1];
  document.getElementById('renovateBeforeImg').src = stage.stationImg;
  document.getElementById('renovateBeforeName').textContent = stage.name;
  document.getElementById('renovateAfterImg').src = isLast ? stage.stationImg : next.stationImg;
  document.getElementById('renovateAfterName').textContent = isLast ? 'จบเกม 👑' : next.name;
  document.getElementById('renovateRewards').textContent = isLast
    ? `🎁 รางวัล: +${FINAL_STAGE_REWARD_GEMS} 💎 เพชร (รางวัลปิดท้าย)`
    : `🎁 รางวัล: +${RENOVATE_REWARD_GEMS} 💎 เพชร | Gold ที่มีอยู่ไม่หายไปไหน`;

  const ready = isRenovateReady();
  const btn = document.getElementById('btnConfirmRenovate');
  btn.disabled = !ready;
  btn.textContent = isLast ? 'รับรางวัลปิดท้าย!' : `Renovate เป็น "${next.name}"!`;
  document.getElementById('renovateGateText').textContent = ready
    ? ''
    : `อัปเกรดสินค้า (แตะโต๊ะสถานี) ให้ถึงเลเวล ${RENOVATE_GATE_LEVEL} ก่อน! (ตอนนี้ ${player.upgradeLevels.portion})`;
}

function openRenovateModal() {
  renderRenovateModal();
  document.getElementById('renovateModal').classList.add('show');
}

// ปุ่ม 🔨 เด้งเรียกความสนใจเมื่อผ่านเงื่อนไขแล้ว (แบบลูกศรชี้ปุ่มในคลิป)
function refreshRenovateFab() {
  document.getElementById('btnOpenRenovate').classList.toggle('fab--attention', isRenovateReady());
}

document.getElementById('btnOpenRenovate').addEventListener('click', () => openRenovateModal());
document.getElementById('btnCloseRenovate').addEventListener('click', () => {
  document.getElementById('renovateModal').classList.remove('show');
});
document.getElementById('btnConfirmRenovate').addEventListener('click', () => {
  if (!isRenovateReady()) return;
  document.getElementById('renovateModal').classList.remove('show');
  advanceStage();
});

GameEvents.on(EVENTS.UPGRADE_PURCHASED, () => refreshRenovateFab());
GameEvents.on(EVENTS.STAGE_ADVANCED, () => refreshRenovateFab());
