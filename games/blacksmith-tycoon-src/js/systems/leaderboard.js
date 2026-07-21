/* =====================================================================
   Leaderboard — เตรียม schema ฝั่ง client ไว้ล่วงหน้า ยังไม่มี backend/endpoint จริง
   LEADERBOARD_ENABLED เปิดเมื่อมี endpoint จริงเท่านั้น (ตอนนี้ปิดไว้ ไม่มีการยิง network ใดๆ)
   ===================================================================== */
const LEADERBOARD_ENABLED = false;

function generatePlayerId() {
  return 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// เรียกครั้งเดียวตอนบูตเกม (ดู main.js) — ผู้เล่นใหม่หรือผู้เล่นที่เพิ่ง migrate มาจากเซฟรุ่นเก่า
// จะได้ playerId คงที่ติดตัวไปตลอด (persist ผ่าน saveGame ปกติ เพราะอยู่ใน player.identity)
function ensurePlayerIdentity() {
  if (!player.identity.playerId) player.identity.playerId = generatePlayerId();
}

function buildLeaderboardPayload() {
  return {
    playerId: player.identity.playerId,
    displayName: player.identity.displayName || 'ผู้เล่นนิรนาม',
    netWorth: getNetWorth(),
    stageIndex: player.stageIndex,
    totalGoldEarned: player.stats.totalGoldEarned,
    clientVersion: SAVE_KEY,
    submittedAt: Date.now(),
  };
}

// อนาคต (ยังไม่ implement เพราะยังไม่มี backend):
// if (LEADERBOARD_ENABLED) fetch(LEADERBOARD_ENDPOINT, { method: 'POST', body: JSON.stringify(buildLeaderboardPayload()) });
