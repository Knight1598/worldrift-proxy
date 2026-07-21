/* =====================================================================
   Stats Footer — สรุปยอดเสิร์ฟลูกค้า/รายได้สะสมทั้งหมด
   ===================================================================== */
function renderStatsFooter() {
  document.getElementById('statsFooter').textContent =
    `เสิร์ฟลูกค้าไปแล้ว ${player.stats.totalCustomersServed.toLocaleString()} คน | รายได้สะสมทั้งหมด ${Math.floor(player.stats.totalGoldEarned).toLocaleString()} Gold`;
}
