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
// เสียงอัปเกรดอุปกรณ์ (buyEquipmentUpgrade) — ทำนองไต่ขึ้น 4 โน้ตแบบ sine ให้ความรู้สึก "วิบวับ/ตีเหล็กเสร็จ"
// แยกจาก playSfxUpgrade (triangle 3 โน้ต) — คงชื่อ playSfxBuffRoll ไว้เพื่อไม่ต้องแก้จุดเรียกหลายที่
function playSfxBuffRoll() { [880, 1108, 1318, 1760].forEach((f, i) => playTone(f, 0.09, 'sine', 0.09, i * 0.04)); }

/* =====================================================================
   Background Music — ทำนองลูปเบาๆ สร้างจาก Web Audio ล้วน (ไม่โหลดไฟล์เสียง)
   วนโน้ตเพนทาโทนิก C major (คอร์ด/เมโลดี้อบอุ่น ไม่กวน) พร้อมเบสไลน์ต่ำ
   เริ่มเล่นหลัง user gesture แรก (AudioContext ต้องมี interaction ก่อน) เคารพ settings.musicEnabled
   ===================================================================== */
const MUSIC_MELODY = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 440.00,
                      523.25, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33, 523.25]; // C D E G ... เพนทาโทนิก
const MUSIC_BASS = [130.81, 130.81, 174.61, 174.61, 196.00, 196.00, 130.81, 130.81]; // C C F F G G C C
const MUSIC_STEP_MS = 420;
let musicTimer = null;
let musicStep = 0;
function startMusic() {
  if (musicTimer || !player.settings.musicEnabled) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (!player.settings.musicEnabled) { stopMusic(); return; }
    const c = ensureAudioCtx();
    if (!c) return;
    // เมโลดี้ (triangle นุ่ม เบามาก) — volume ต่ำกว่า SFX มากเพื่อไม่กลบเสียงเอฟเฟกต์
    playMusicNote(MUSIC_MELODY[musicStep % MUSIC_MELODY.length], MUSIC_STEP_MS / 1000 * 0.9, 'triangle', 0.028);
    // เบสทุก 2 ส텝
    if (musicStep % 2 === 0) playMusicNote(MUSIC_BASS[(musicStep / 2) % MUSIC_BASS.length], MUSIC_STEP_MS / 1000 * 1.8, 'sine', 0.045);
    musicStep++;
  }, MUSIC_STEP_MS);
}
function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
function playMusicNote(freq, duration, type, volume) {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.04); // fade-in นุ่มๆ กันเสียงคลิก
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}
