/* =====================================================================
   Floating Text overlays — ตัวเลขลอยตอนเก็บเหรียญ + ป๊อปอัพฉลอง Milestone
   ใช้ Particle Pool (core/particles.js) — node ถูกรีไซเคิล ไม่สร้าง/ทำลายซ้ำๆ

   Smart Floating Text (ลด cognitive load): เก็บเหรียญหลายเหรียญภายในหน้าต่างเวลาสั้นๆ
   จะรวมยอดเป็นตัวเลขเดียวที่อัปเดตสด (+50 แทน +10 ห้าอันซ้อนกัน) ส่วน float text ทั่วไป
   ที่ไม่ใช่เหรียญได้ตำแหน่งสุ่มเยื้องเล็กน้อย (jitter) กันซ้อนทับพอดีจุด
   ===================================================================== */
const FLOAT_TEXT_LIFETIME_MS = 1000; // ตรงกับความยาวแอนิเมชัน floatTextUp ใน CSS
const COIN_TEXT_MERGE_WINDOW_MS = 420;
let coinFloatAggregate = null; // { el, total, tipTotal, expiresAt } — ตัวเลขรวมที่กำลังโชว์อยู่

function spawnFloatText(x, y, text, variant) {
  // jitter เล็กน้อยกันหลายข้อความเกิดตำแหน่งเดียวกันเป๊ะแล้วอ่านไม่ออก
  const jx = Math.round(x + (Math.random() - 0.5) * 14);
  const jy = Math.round(y + (Math.random() - 0.5) * 8);
  return spawnParticle('float-text float-text--' + variant, document.getElementById('standStageView'), FLOAT_TEXT_LIFETIME_MS, el => {
    el.textContent = text;
    el.style.left = jx + 'px';
    el.style.top = jy + 'px';
  });
}

// ตัวเลขเหรียญแบบรวมยอด — เรียกจาก pickupCoin (entities/economy.js)
function spawnCoinFloatText(x, y, value, tip) {
  const now = performance.now();
  if (coinFloatAggregate && now < coinFloatAggregate.expiresAt && coinFloatAggregate.el.style.display !== 'none') {
    // ยังอยู่ในหน้าต่างรวมยอด — บวกเพิ่มแล้วอัปเดตข้อความเดิม (ไม่เกิดชิ้นใหม่มาซ้อน)
    coinFloatAggregate.total += value;
    coinFloatAggregate.tipTotal += tip;
    coinFloatAggregate.el.textContent = formatCoinText(coinFloatAggregate.total, coinFloatAggregate.tipTotal);
    // ถ้ามีทิปเข้ามาระหว่างรวมยอด ยกระดับสีเป็นแบบทิป (เขียว) — ทิปเป็นอีเวนต์เด่นกว่า ไม่ให้จมหายในสีทอง
    if (coinFloatAggregate.tipTotal > 0) coinFloatAggregate.el.className = 'float-text float-text--tip';
    return;
  }
  const el = spawnFloatText(x, y, formatCoinText(value, tip), tip > 0 ? 'tip' : 'gold');
  coinFloatAggregate = { el, total: value, tipTotal: tip, expiresAt: now + COIN_TEXT_MERGE_WINDOW_MS };
}

function formatCoinText(total, tipTotal) {
  return tipTotal > 0 ? `+${formatCompact(total)} 🪙 (+${formatCompact(tipTotal)} ทิป!)` : `+${formatCompact(total)} 🪙`;
}

// แฟลช "+Lv N" ลอยขึ้นจากปุ่ม/ป้ายที่กดอัปเกรด — ฟีดแบ็กเลเวลอัปทันตาแบบเบาๆ (ส่วนหนึ่งของ Reward Ceremony)
// anchorEl = element ที่จะให้ข้อความลอยขึ้นจากตรงกลาง (คำนวณตำแหน่งเทียบกับ standStageView)
function spawnLevelUpFlash(anchorEl, text) {
  if (!anchorEl) return;
  const stage = document.getElementById('standStageView');
  const sr = stage.getBoundingClientRect();
  const ar = anchorEl.getBoundingClientRect();
  const x = ar.left - sr.left + ar.width / 2;
  const y = ar.top - sr.top;
  spawnFloatText(x, y, text, 'levelup');
}

function showMilestoneToast(displayName, level, mult) {
  const el = document.createElement('div');
  el.className = 'milestone-toast';
  el.innerHTML = `🌟 <b>${displayName}</b> ถึงเลเวล ${level}!<br>โบนัสพลังคูณ x${mult} +${STATION_STAR_REWARD_GEMS} 💎!`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}
