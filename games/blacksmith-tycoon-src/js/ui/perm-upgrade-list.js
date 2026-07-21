/* =====================================================================
   Permanent Upgrades — การ์ด "จ้างลูกมือ" / "คลังเก็บของออฟไลน์" ไม่รีเซ็ตตอนขึ้นด่านใหม่
   ===================================================================== */
function renderPermUpgradeList() {
  const listEl = document.getElementById('permUpgradeList');
  listEl.innerHTML = '';
  listEl.appendChild(buildHireHelperCard());
  listEl.appendChild(buildVaultCard());
}

function buildHireHelperCard() {
  const maxed = player.staffCount >= MAX_STAFF_COUNT;
  const cost = maxed ? null : getHireHelperCost();
  const affordable = !maxed && player.gold >= cost;

  const card = document.createElement('div');
  card.className = 'upgrade-card';

  const icon = document.createElement('div');
  icon.className = 'upgrade-icon';
  icon.textContent = '🧑‍🔧';

  const info = document.createElement('div');
  info.className = 'upgrade-info';
  const name = document.createElement('div');
  name.className = 'upgrade-name';
  name.textContent = 'จ้างลูกมือ';
  const desc = document.createElement('div');
  desc.className = 'upgrade-desc';
  desc.textContent = 'ลูกมืออีกคนรับออเดอร์พร้อมกันได้จริง ไม่แย่งงานกัน';
  const lvl = document.createElement('div');
  lvl.className = 'upgrade-level';
  lvl.textContent = `มีอยู่ ${player.staffCount}/${MAX_STAFF_COUNT} คน`;
  info.append(name, desc, lvl);

  const btn = document.createElement('button');
  btn.className = 'buy-btn ' + (maxed ? 'buy-btn--maxed' : affordable ? 'buy-btn--affordable' : 'buy-btn--disabled');
  btn.textContent = maxed ? 'ครบแล้ว ✓' : `จ้าง (${formatCompact(cost)})`;
  btn.disabled = maxed || !affordable;
  btn.addEventListener('click', hireHelper);

  card.append(icon, info, btn);
  return card;
}

function buildVaultCard() {
  const maxed = player.vaultLevel >= MAX_VAULT_LEVEL;
  const cost = maxed ? null : getVaultUpgradeCost();
  const affordable = !maxed && player.gold >= cost;

  const card = document.createElement('div');
  card.className = 'upgrade-card';

  const icon = document.createElement('div');
  icon.className = 'upgrade-icon';
  icon.textContent = '🏦';

  const info = document.createElement('div');
  info.className = 'upgrade-info';
  const name = document.createElement('div');
  name.className = 'upgrade-name';
  name.textContent = 'คลังเก็บของออฟไลน์';
  const desc = document.createElement('div');
  desc.className = 'upgrade-desc';
  desc.textContent = 'ขยายเพดานเวลาที่รายได้ตอนไม่อยู่หน้าจอสะสมได้';
  const lvl = document.createElement('div');
  lvl.className = 'upgrade-level';
  lvl.textContent = `เพดานตอนนี้ ${getOfflineMaxHours()} ชม. (เลเวล ${player.vaultLevel}/${MAX_VAULT_LEVEL})`;
  info.append(name, desc, lvl);

  const btn = document.createElement('button');
  btn.className = 'buy-btn ' + (maxed ? 'buy-btn--maxed' : affordable ? 'buy-btn--affordable' : 'buy-btn--disabled');
  btn.textContent = maxed ? 'เต็มขั้น ✓' : `ซื้อ (${formatCompact(cost)})`;
  btn.disabled = maxed || !affordable;
  btn.addEventListener('click', buyVaultLevel);

  card.append(icon, info, btn);
  return card;
}

GameEvents.on(EVENTS.COIN_COLLECTED, () => renderPermUpgradeList());
GameEvents.on(EVENTS.UPGRADE_PURCHASED, () => renderPermUpgradeList());
GameEvents.on(EVENTS.STAFF_HIRED, () => renderPermUpgradeList());
GameEvents.on(EVENTS.VAULT_UPGRADED, () => renderPermUpgradeList());
// บัพ "ลดกระหน่ำ" เปลี่ยนราคาจ้างลูกมือ/อัปคลังออฟไลน์ -- รีเฟรชราคาที่โชว์ทันทีตอนเริ่ม/หมดบัพ (ดู upgrade-list.js)
GameEvents.on(EVENTS.BUFF_ROLLED, () => renderPermUpgradeList());
GameEvents.on(EVENTS.BUFF_ENDED, () => renderPermUpgradeList());
