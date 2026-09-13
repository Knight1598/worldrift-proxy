/* =====================================================================
   Prestige Modal + Renown HUD chip
   - เปิดจากปุ่ม "เกิดใหม่" ในหน้าต่างอัปเกรด (⬆️) หรือหน้าจบเกม
   - โชว์ชื่อเสียง/ตัวคูณปัจจุบัน + พรีวิวว่าเกิดใหม่ตอนนี้จะได้ renown เท่าไหร่ (ตัวคูณใหม่เท่าไหร่)
   - ปุ่มยืนยันปิดถ้ายังได้ 0 renown (ยังหาเงินรอบนี้ไม่พอ)
   ===================================================================== */
function renderRenown() {
  const chip = document.getElementById('renownCounter');
  // โชว์ชิปเฉพาะเมื่อเคยเกิดใหม่แล้ว (มี renown) — ช่วงต้นเกมยังไม่มี ไม่ต้องรก HUD
  if (player.prestige.renown > 0) {
    chip.classList.add('show');
    document.getElementById('renownValue').textContent = formatCompact(player.prestige.renown);
  } else {
    chip.classList.remove('show');
  }
}

function renderPrestigeModal() {
  const gain = getRenownGain();
  const curMult = getPrestigeMultiplier();
  const nextMult = 1 + (player.prestige.renown + gain) * PRESTIGE_MULT_PER_RENOWN;
  document.getElementById('prestigeCurrentRenown').textContent = `${formatCompact(player.prestige.renown)} 🏅`;
  document.getElementById('prestigeCurrentMult').textContent = `x${curMult.toFixed(2)}`;
  document.getElementById('prestigeGain').textContent = `+${formatCompact(gain)} 🏅`;
  document.getElementById('prestigeNextMult').textContent = `x${nextMult.toFixed(2)}`;

  const btn = document.getElementById('btnConfirmPrestige');
  const ready = gain >= 1;
  btn.disabled = !ready;
  document.getElementById('prestigeGateText').textContent = ready
    ? ''
    : `หาเงินให้ได้มากกว่านี้ก่อน แล้วค่อยเกิดใหม่ให้คุ้ม (ยิ่งรวยรอบนี้ ยิ่งได้ชื่อเสียงเยอะ)`;
}

function openPrestigeModal() {
  renderPrestigeModal();
  document.getElementById('prestigeModal').classList.add('show');
}
function closePrestigeModal() {
  document.getElementById('prestigeModal').classList.remove('show');
}

document.getElementById('btnClosePrestige').addEventListener('click', () => closePrestigeModal());
document.getElementById('btnConfirmPrestige').addEventListener('click', () => {
  const gained = doPrestige();
  if (gained == null) return; // ยังไม่ถึงเกณฑ์ (ปุ่มควร disabled อยู่แล้ว กันไว้อีกชั้น)
  closePrestigeModal();
  document.getElementById('upgradesModal').classList.remove('show'); // เผื่อเปิดจากในหน้าอัปเกรด
  const el = document.createElement('div');
  el.className = 'milestone-toast';
  el.innerHTML = `🏅 เกิดใหม่สำเร็จ! ได้ <b>${formatCompact(gained)}</b> ชื่อเสียง<br>ตัวคูณรายได้ x${getPrestigeMultiplier().toFixed(2)} ถาวร!`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
});

// หน้าจบเกม: ปุ่ม "เกิดใหม่เลย!" เปิดหน้าต่าง prestige แทนแค่ปิดเฉยๆ
document.getElementById('btnGameCompletePrestige').addEventListener('click', () => {
  document.getElementById('gameCompleteModal').classList.remove('show');
  openPrestigeModal();
});

GameEvents.on(EVENTS.PRESTIGE_DONE, () => { renderRenown(); renderAll(); });
