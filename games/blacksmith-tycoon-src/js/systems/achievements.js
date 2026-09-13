/* =====================================================================
   Achievements — เป้าหมายระยะยาว (ดู ACHIEVEMENTS ใน data.js)
   ความคืบหน้าอ่านจาก stats/prestige ที่ track อยู่แล้ว | กดรับรางวัลได้เมื่อถึงเป้า
   ===================================================================== */
function getAchievementDef(key) { return ACHIEVEMENTS.find(a => a.key === key); }
function isAchievementComplete(a) { return a.goal() >= a.target; }
function isAchievementClaimed(key) { return !!player.achievements.claimed[key]; }
function isAchievementClaimable(a) { return isAchievementComplete(a) && !isAchievementClaimed(a.key); }
// มีความสำเร็จที่ถึงเป้าแต่ยังไม่กดรับอย่างน้อย 1 อัน (ใช้โชว์จุดแดงบนปุ่มรางวัล)
function hasClaimableAchievement() { return ACHIEVEMENTS.some(isAchievementClaimable); }

function claimAchievement(key) {
  const a = getAchievementDef(key);
  if (!a || !isAchievementClaimable(a)) return false;
  player.achievements.claimed[key] = true;
  if (a.reward.gems) player.gems += a.reward.gems;
  if (a.reward.renown) player.prestige.renown += a.reward.renown;
  playSfxStageComplete();
  GameEvents.emit(EVENTS.ACHIEVEMENT_CLAIMED, { key });
  saveGame();
  return true;
}
