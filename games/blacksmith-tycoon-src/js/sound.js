/* =====================================================================
   Sound (Web Audio API, self-contained — ไม่โหลดไฟล์เสียงภายนอก)
   ===================================================================== */
function ensureAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function playTone(freq, duration, type, volume, startDelay) {
  if (!player.settings.soundEnabled) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + (startDelay || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(volume || 0.1, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}
function playSfxCashRegister() { playTone(1200, 0.05, 'square', 0.08); playTone(1600, 0.06, 'square', 0.06, 0.04); }
function playSfxUpgrade() { [523, 659, 784].forEach((f, i) => playTone(f, 0.1, 'triangle', 0.09, i * 0.05)); }
function playSfxStageComplete() { [523, 659, 784, 1047, 1319].forEach((f, i) => playTone(f, 0.16, 'triangle', 0.11, i * 0.09)); }
function playSfxTap() { playTone(700, 0.03, 'square', 0.05); }
// เสียงสุ่มบัพ (rollBuff) — เดิมไม่มีเสียงเลย ทั้งที่ทุก action อื่นในเกมมีเสียงตอบรับหมด (ซื้อของ/แตะ/จบด่าน)
// ใช้ทำนองไต่ขึ้น 4 โน้ตแบบ sine ให้ความรู้สึก "กาชา/วิบวับ" แยกจาก playSfxUpgrade (triangle 3 โน้ต)
function playSfxBuffRoll() { [880, 1108, 1318, 1760].forEach((f, i) => playTone(f, 0.09, 'sine', 0.09, i * 0.04)); }
