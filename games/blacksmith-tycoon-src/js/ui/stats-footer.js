/* =====================================================================
   Stats Footer — สรุปยอดเสิร์ฟลูกค้า/รายได้สะสมทั้งหมด
   ===================================================================== */
function renderStatsFooter() {
  document.getElementById('statsFooter').textContent =
    `เสิร์ฟลูกค้าไปแล้ว ${formatCompact(player.stats.totalCustomersServed)} คน | รายได้สะสมทั้งหมด ${formatCompact(player.stats.totalGoldEarned)} Gold`;
}
