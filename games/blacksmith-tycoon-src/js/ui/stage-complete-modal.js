/* =====================================================================
   Confetti — ใช้ตอน Renovate สำเร็จ (หน้าต่าง stage-complete เดิมถูกแทนด้วย
   Renovate flow ใน ui/renovate-modal.js ตามแบบเกมต้นแบบแล้ว เหลือไว้แค่คอนเฟตตี้
   ที่ยังยิงฉลองตอนขึ้นด่านเหมือนเดิม)
   ===================================================================== */
const CONFETTI_COLORS = ['#ff9f45', '#6bbf6b', '#5aa9e6', '#e35d5d', '#ffd76a', '#c77dff'];
function spawnConfetti(count) {
  const n = count || 40;
  for (let i = 0; i < n; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}
