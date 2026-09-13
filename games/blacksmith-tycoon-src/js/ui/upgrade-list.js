/* =====================================================================
   Upgrade List — การ์ดอัปเกรดของด่านปัจจุบัน (Speed/Signage/Decor ฯลฯ)
   ===================================================================== */
function renderUpgradeList() {
  const listEl = document.getElementById('upgradeList');
  listEl.innerHTML = '';
  UPGRADE_TYPES.filter(type => !type.hiddenFromList).forEach(type => {
    const level = player.upgradeLevels[type.key];
    const maxed = level >= type.maxLevel;
    const cost = maxed ? null : getUpgradeCost(type.key);
    const affordable = !maxed && player.gold >= cost;

    const card = document.createElement('div');
    card.className = 'upgrade-card';

    const icon = document.createElement('div');
    icon.className = 'upgrade-icon';
    icon.textContent = type.icon;

    const info = document.createElement('div');
    info.className = 'upgrade-info';
    const name = document.createElement('div');
    name.className = 'upgrade-name';
    name.textContent = type.name;
    const desc = document.createElement('div');
    desc.className = 'upgrade-desc';
    desc.textContent = type.desc;
    const lvl = document.createElement('div');
    lvl.className = 'upgrade-level';
    lvl.textContent = `ระดับ ${level}/${type.maxLevel}`;
    info.append(name, desc, lvl);

    const btn = document.createElement('button');
    btn.className = 'buy-btn ' + (maxed ? 'buy-btn--maxed' : affordable ? 'buy-btn--affordable' : 'buy-btn--disabled');
    btn.textContent = maxed ? 'เต็มขั้น ✓' : `ซื้อ (${formatCompact(cost)})`;
    btn.disabled = maxed || !affordable;
    btn.addEventListener('click', () => buyUpgrade(type.key));

    card.append(icon, info, btn);
    listEl.appendChild(card);
  });
}

GameEvents.on(EVENTS.COIN_COLLECTED, () => renderUpgradeList());
GameEvents.on(EVENTS.UPGRADE_PURCHASED, () => renderUpgradeList());
// บัพ "ลดกระหน่ำ" (discount) เปลี่ยนราคาที่ getUpgradeCost() คืนค่า -- ต้องรีเฟรชราคาที่โชว์ทันทีตอนเริ่ม/หมดบัพ
// ไม่งั้นราคาที่เห็นค้างเป็นค่าก่อนหน้าจนกว่าจะบังเอิญมี COIN_COLLECTED/UPGRADE_PURCHASED มาเรียก re-render ให้
