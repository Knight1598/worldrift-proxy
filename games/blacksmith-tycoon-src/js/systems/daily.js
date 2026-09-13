/* =====================================================================
   Daily Reward — เปิดเกมวันใหม่ได้เพชร ยิ่งต่อเนื่อง (streak) ยิ่งเยอะ (ดู DAILY_REWARDS)
   วันคิดจากปฏิทินท้องถิ่น (YYYY-M-D) ต่อเนื่อง = เล่นวันติดกัน / ขาดวัน = streak รีเซ็ต
   ===================================================================== */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function dayKeyOffset(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function isDailyAvailable() {
  return player.daily.lastClaimDay !== todayKey();
}
// streak ที่ "จะเป็น" ถ้ากดรับวันนี้ (ต่อเนื่องถ้าเมื่อวานเพิ่งรับ ไม่งั้นเริ่มนับ 1 ใหม่)
function nextDailyStreak() {
  if (player.daily.lastClaimDay === dayKeyOffset(-1)) return player.daily.streak + 1;
  return 1;
}
function dailyRewardForStreak(streak) {
  const idx = Math.min(streak - 1, DAILY_REWARDS.length - 1);
  return DAILY_REWARDS[Math.max(0, idx)];
}
function claimDaily() {
  if (!isDailyAvailable()) return null;
  const streak = nextDailyStreak();
  const reward = dailyRewardForStreak(streak);
  player.daily.streak = streak;
  player.daily.lastClaimDay = todayKey();
  player.gems += reward;
  playSfxStageComplete();
  GameEvents.emit(EVENTS.DAILY_CLAIMED, { streak, reward });
  saveGame();
  return { streak, reward };
}
