/* =====================================================================
   Renovate Modal — ขึ้นด่านแบบเกมต้นแบบ: ปุ่ม 🔨 ซ้ายล่างเปิดหน้าต่าง Before/After
   เงื่อนไข: อัปเกรด "สินค้า" (สถานี) ถึง RENOVATE_GATE_LEVEL ก่อน ("level 25 first!")
   ผ่านเงื่อนไขแล้วกด Renovate ได้เลย ไม่ต้องรออัปเกรดชนิดอื่นครบอีกต่อไป
   ===================================================================== */
function isRenovateReady() {
  return player.upgradeLevels.portion >= RENOVATE_GATE_LEVEL;
}

// พรีวิวด่านถัดไป (ด่านไม่รู้จบ) — คำนวณชื่อ/ภาพของด่าน index+1 ผ่านการวน STAGES + suffix ★รอบ
function nextStagePreview() {
  const nextIndex = player.stageIndex + 1;
  const cycle = Math.floor(nextIndex / STAGES.length);
  const base = STAGES[nextIndex % STAGES.length];
  return { img: base.stationImg, name: cycle === 0 ? base.name : base.name + ' ★' + (cycle + 1) };
}

function renderRenovateModal() {
  const stage = getStage();
  const next = nextStagePreview();
  const enteringNewLoop = (player.stageIndex + 1) % STAGES.length === 0;
  document.getElementById('renovateBeforeImg').src = stage.stationImg;
  document.getElementById('renovateBeforeName').textContent = stage.name;
  document.getElementById('renovateAfterImg').src = next.img;
  document.getElementById('renovateAfterName').textContent = next.name;
  document.getElementById('renovateRewards').textContent = enteringNewLoop
    ? `🎁 จบรอบ! รางวัลใหญ่ +${RENOVATE_REWARD_GEMS + FINAL_STAGE_REWARD_GEMS} 💎 | รายได้รอบใหม่สูงขึ้นมาก`
    : `🎁 รางวัล: +${RENOVATE_REWARD_GEMS} 💎 เพชร | Gold ที่มีอยู่ไม่หายไปไหน`;

  const ready = isRenovateReady();
  const btn = document.getElementById('btnConfirmRenovate');
  btn.disabled = !ready;
  btn.textContent = `Renovate เป็น "${next.name}"!`;
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
