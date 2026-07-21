/* =====================================================================
   Buff Roll panel — การ์ดเดียวใน ui-area: สุ่มบัพด้วยเพชร + โชว์บัพที่กำลัง active อยู่ (ถ้ามี)
   ใช้โครง .upgrade-card เดิมซ้ำ (เหมือน Hire Helper/Vault card) ไม่ต้องคิด style ใหม่
   ===================================================================== */
function renderBuffPanel() {
  const panel = document.getElementById('buffPanel');
  panel.innerHTML = '';

  const card = document.createElement('div');
  const active = !!activeBuff;
  card.className = 'upgrade-card' + (active ? ' upgrade-card--buff-active' : '');

  const icon = document.createElement('div');
  icon.className = 'upgrade-icon';
  icon.textContent = active ? getBuffDef(activeBuff.key).icon : '💎';

  const info = document.createElement('div');
  info.className = 'upgrade-info';
  const name = document.createElement('div');
  name.className = 'upgrade-name';
  name.textContent = active ? getBuffDef(activeBuff.key).name : 'สุ่มบัพติดตัว';
  const desc = document.createElement('div');
  desc.className = 'upgrade-desc';
  desc.textContent = active ? getBuffDef(activeBuff.key).desc : `มีเพชร ${player.gems.toLocaleString()} เม็ด`;
  const countdown = document.createElement('div');
  countdown.className = 'upgrade-level';
  countdown.id = 'buffCountdownText';
  countdown.textContent = active ? formatBuffCountdown() : '';
  info.append(name, desc, countdown);

  const btn = document.createElement('button');
  const affordable = player.gems >= BUFF_ROLL_COST_GEMS;
  btn.className = 'buy-btn ' + (affordable ? 'buy-btn--affordable' : 'buy-btn--disabled');
  btn.textContent = `สุ่ม (${BUFF_ROLL_COST_GEMS}💎)`;
  btn.disabled = !affordable;
  btn.addEventListener('click', () => {
    const buff = rollBuff();
    if (buff) showBuffResultToast(buff);
  });

  card.append(icon, info, btn);
  panel.appendChild(card);
}

function formatBuffCountdown() {
  if (!activeBuff) return '';
  const secLeft = Math.max(0, Math.round((activeBuff.endsAt - performance.now()) / 1000));
  return `เหลือ ${secLeft} วินาที`;
}

// เรียกทุกเฟรมจาก gameTick แค่ตอนมีบัพ active เท่านั้น -- อัปเดตแค่ textContent ของตัวนับถอยหลัง
// ไม่ rebuild การ์ดทั้งใบทุกเฟรม (ประหยัดกว่า renderBuffPanel() เต็มรูปแบบมาก)
function tickBuffCountdownDisplay() {
  if (!activeBuff) return;
  const el = document.getElementById('buffCountdownText');
  if (el) el.textContent = formatBuffCountdown();
}

function showBuffResultToast(buff) {
  const el = document.createElement('div');
  el.className = 'milestone-toast'; // ยืมสไตล์ป๊อปอัพเดิมจาก Milestone Boosts มาใช้ซ้ำ
  el.innerHTML = `${buff.icon} ได้บัพ <b>${buff.name}</b>!<br>${buff.desc}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

GameEvents.on(EVENTS.MISSION_COMPLETED, () => renderBuffPanel()); // เพชรเพิ่ม อาจพอสุ่มได้แล้ว
GameEvents.on(EVENTS.BUFF_ROLLED, () => renderBuffPanel());
GameEvents.on(EVENTS.BUFF_ENDED, () => renderBuffPanel());
