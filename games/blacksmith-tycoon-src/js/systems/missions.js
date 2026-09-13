/* =====================================================================
   Order Missions — ภารกิจสะสมออเดอร์ที่เสิร์ฟสำเร็จ (นับใหม่ทุกครั้งที่ภารกิจก่อนหน้าจบ ไม่ใช่สะสมทั้งเกม)
   จบภารกิจแล้วได้เพชร เอาไปสุ่มบัพต่อที่ systems/buffs.js
   ===================================================================== */
function getMissionRequirement(index) {
  return Math.round(ORDER_MISSION_BASE_TARGET * Math.pow(ORDER_MISSION_TARGET_GROWTH, index));
}
function getMissionReward(index) {
  return Math.round(ORDER_MISSION_BASE_REWARD * Math.pow(ORDER_MISSION_REWARD_GROWTH, index));
}

function tickMissionProgress() {
  player.missionProgress += 1;
  const requirement = getMissionRequirement(player.missionIndex);
  if (player.missionProgress >= requirement) {
    // x บุญเพชร (อัปเกรดร้านชื่อเสียง) — จ่ายเพชรจริงมากกว่ารางวัลฐานตามเลเวล gemBonus
    const reward = Math.round(getMissionReward(player.missionIndex) * getGemGainMult());
    player.missionProgress = 0;
    player.missionIndex += 1;
    player.gems += reward;
    GameEvents.emit(EVENTS.MISSION_COMPLETED, { missionIndex: player.missionIndex, reward });
    saveGame(); // เพชร/ความคืบหน้าภารกิจเปลี่ยน เก็บทันทีเหมือน progression อื่นๆ
  }
}

GameEvents.on(EVENTS.ORDER_SERVED, () => tickMissionProgress());
