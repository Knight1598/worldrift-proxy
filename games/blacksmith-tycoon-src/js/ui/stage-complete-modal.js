/* =====================================================================
   Confetti — ใช้ตอน Renovate สำเร็จ (หน้าต่าง stage-complete เดิมถูกแทนด้วย
   Renovate flow ใน ui/renovate-modal.js ตามแบบเกมต้นแบบแล้ว เหลือไว้แค่คอนเฟตตี้
   ที่ยังยิงฉลองตอนขึ้นด่านเหมือนเดิม)
   ===================================================================== */
const CONFETTI_COLORS = ['#ff9f45', '#6bbf6b', '#5aa9e6', '#e35d5d', '#ffd76a', '#c77dff'];
const CONFETTI_LIFETIME_MS = 3200; // ยาวพอให้ชิ้นที่มี animation-delay สูงสุด (0.4s) + duration (2.8s) จบก่อนคืน pool
// ใช้ Particle Pool (core/particles.js) — คอนเฟตตี้ยิงทีละ 40 ชิ้น รีไซเคิล node แทนสร้าง/ทำลายทุกครั้ง
function spawnConfetti(count) {
  const n = count || 40;
  for (let i = 0; i < n; i++) {
    spawnParticle('confetti-piece', document.body, CONFETTI_LIFETIME_MS, piece => {
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      piece.style.animationDelay = (Math.random() * 0.4) + 's';
    });
  }
}
