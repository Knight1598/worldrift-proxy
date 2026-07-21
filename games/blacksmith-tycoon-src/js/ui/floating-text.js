/* =====================================================================
   Floating Text overlays — ตัวเลขลอยตอนเก็บเหรียญ + ป๊อปอัพฉลอง Milestone
   ทั้งคู่เป็น "overlay ชั่วคราว" เหมือนกัน: append เข้า DOM แล้วลบตัวเองทิ้งผ่าน setTimeout
   ===================================================================== */
function spawnFloatText(x, y, text, variant) {
  const el = document.createElement('div');
  el.className = 'float-text float-text--' + variant;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.getElementById('standStageView').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function showMilestoneToast(displayName, level, mult) {
  const el = document.createElement('div');
  el.className = 'milestone-toast';
  el.innerHTML = `🌟 <b>${displayName}</b> ถึงเลเวล ${level}!<br>โบนัสพลังคูณ x${mult} ทันที!`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}
