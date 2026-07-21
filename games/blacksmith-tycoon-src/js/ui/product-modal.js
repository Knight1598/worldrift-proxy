/* =====================================================================
   Station Level Popup — แตะโต๊ะสถานี (หรือป้ายสินค้า) เพื่อเปิด ตามหน้าต่าง "Level N" ในเกมต้นแบบ:
   ชื่อระดับ+สินค้า / ดาว milestone (10/25/50) / แถบความคืบหน้าสู่ดาวถัดไป /
   แถวสถิติ (🪙 เงินต่อออเดอร์ + ⏱️ เวลาคราฟต์) / ปุ่มซื้อใหญ่กดรัวได้
   ===================================================================== */
function renderProductBadge() {
  const type = getUpgradeType('portion');
  const level = player.upgradeLevels.portion;
  const maxed = level >= type.maxLevel;
  const cost = maxed ? null : getUpgradeCost('portion');
  const affordable = !maxed && player.gold >= cost;
  document.getElementById('productBadgeIcon').src = getProductIcon();
  document.getElementById('productBadgeLevel').textContent = level;
  document.getElementById('productBadge').classList.toggle('affordable', affordable);
}

function renderProductLevelModal() {
  const type = getUpgradeType('portion');
  const level = player.upgradeLevels.portion;
  const maxed = level >= type.maxLevel;
  const cost = maxed ? null : getUpgradeCost('portion');
  const affordable = !maxed && player.gold >= cost;

  document.getElementById('productLevelTitle').textContent = `ระดับ ${level} — ${getStage().product}`;
  document.getElementById('productLevelIcon').src = getProductIcon();

  // ดาว = milestone 10/25/50 (แบบดาวในหน้าต่าง Level ของเกมต้นแบบ) ไม่ใช่ดาวละเลเวลจนล้นจอแบบเดิม
  const starsEl = document.getElementById('productLevelStars');
  starsEl.innerHTML = '';
  MILESTONE_LEVELS.forEach(ms => {
    const star = document.createElement('span');
    star.textContent = '★';
    star.className = level >= ms ? 'star-filled' : '';
    star.title = `เลเวล ${ms}`;
    starsEl.appendChild(star);
  });

  // แถบความคืบหน้า: ช่วงระหว่าง milestone ก่อนหน้า -> milestone ถัดไป
  const prevMs = MILESTONE_LEVELS.filter(ms => level >= ms).pop() || 0;
  const nextMs = MILESTONE_LEVELS.find(ms => level < ms) || type.maxLevel;
  const pct = nextMs > prevMs ? ((level - prevMs) / (nextMs - prevMs)) * 100 : 100;
  document.getElementById('productLevelProgressFill').style.width = `${Math.min(100, pct)}%`;

  // แถวสถิติแบบคลิป: เงินต่อออเดอร์ (คุมโดยเลเวลสินค้า) + เวลาคราฟต์ (คุมโดยอัปเกรดความเร็ว)
  document.getElementById('productStatRevenue').textContent = Math.round(getRevenuePerSale()).toLocaleString();
  document.getElementById('productStatCraft').textContent = (getCraftDurationMs() / 1000).toFixed(1) + 's';

  const btn = document.getElementById('btnBuyProductLevel');
  btn.textContent = maxed ? 'เต็มขั้นแล้ว ✓' : `อัปเกรด (${cost.toLocaleString()})`;
  btn.disabled = maxed || !affordable;
  btn.className = 'btn-cta-mega' + (maxed ? ' btn-cta-mega--maxed' : '');
}

function openProductLevelModal() {
  renderProductLevelModal();
  document.getElementById('productLevelModal').classList.add('show');
}
function closeProductLevelModal() {
  document.getElementById('productLevelModal').classList.remove('show');
}

document.getElementById('productBadge').addEventListener('click', () => openProductLevelModal());
document.getElementById('btnCloseProductLevel').addEventListener('click', () => closeProductLevelModal());
document.getElementById('btnBuyProductLevel').addEventListener('click', () => buyUpgrade('portion'));

function refreshProductLevelModalIfOpen() {
  if (document.getElementById('productLevelModal').classList.contains('show')) renderProductLevelModal();
}
GameEvents.on(EVENTS.COIN_COLLECTED, () => { renderProductBadge(); refreshProductLevelModalIfOpen(); });
GameEvents.on(EVENTS.UPGRADE_PURCHASED, () => { renderProductBadge(); refreshProductLevelModalIfOpen(); });
// บัพ "ลดกระหน่ำ" เปลี่ยนราคาที่ getUpgradeCost('portion') คืนค่าเหมือนกัน -- รีเฟรชตอนเริ่ม/หมดบัพ (ดู upgrade-list.js)
GameEvents.on(EVENTS.BUFF_ROLLED, () => { renderProductBadge(); refreshProductLevelModalIfOpen(); });
GameEvents.on(EVENTS.BUFF_ENDED, () => { renderProductBadge(); refreshProductLevelModalIfOpen(); });
