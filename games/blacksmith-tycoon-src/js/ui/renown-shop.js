/* =====================================================================
   Renown Shop — ใช้ชื่อเสียง (renown 🏅) ซื้ออัปเกรดถาวรที่อยู่ข้ามทุก prestige
   เปิดจาก: ชิป 🏅 ใน HUD (แตะได้เมื่อมี renown) หรือปุ่มในหน้าต่าง Prestige
   การ์ดแต่ละใบ = 1 อัปเกรดใน RENOWN_UPGRADES: ไอคอน/ชื่อ/คำอธิบาย/เลเวล + ปุ่มซื้อ (ราคาเป็น renown)
   ===================================================================== */
function renderRenownShop() {
  document.getElementById('renownShopBalance').textContent = `${formatCompact(player.prestige.renown)} 🏅`;
  const list = document.getElementById('renownShopList');
  list.innerHTML = '';
  RENOWN_UPGRADES.forEach(def => {
    const level = getRenownUpgradeLevel(def.key);
    const maxed = level >= def.maxLevel;
    const cost = maxed ? null : getRenownUpgradeCost(def.key);
    const affordable = !maxed && player.prestige.renown >= cost;

    const card = document.createElement('div');
    card.className = 'upgrade-card renown-card';

    const icon = document.createElement('div');
    icon.className = 'upgrade-icon';
    icon.textContent = def.icon;

    const info = document.createElement('div');
    info.className = 'upgrade-info';
    const name = document.createElement('div');
    name.className = 'upgrade-name';
    name.textContent = def.name;
    const desc = document.createElement('div');
    desc.className = 'upgrade-desc';
    desc.textContent = def.desc;
    const lvl = document.createElement('div');
    lvl.className = 'upgrade-level';
    lvl.textContent = `เลเวล ${level}/${def.maxLevel}`;
    info.append(name, desc, lvl);

    const btn = document.createElement('button');
    btn.className = 'buy-btn ' + (maxed ? 'buy-btn--maxed' : affordable ? 'buy-btn--affordable' : 'buy-btn--disabled');
    btn.textContent = maxed ? 'สุดแล้ว ✓' : `${formatCompact(cost)} 🏅`;
    btn.disabled = maxed || !affordable;
    btn.addEventListener('click', () => { if (buyRenownUpgrade(def.key)) renderRenownShop(); });

    card.append(icon, info, btn);
    list.appendChild(card);
  });
}

function openRenownShop() {
  renderRenownShop();
  document.getElementById('renownShopModal').classList.add('show');
}
function closeRenownShop() {
  document.getElementById('renownShopModal').classList.remove('show');
}

document.getElementById('btnCloseRenownShop').addEventListener('click', () => closeRenownShop());
document.getElementById('btnOpenRenownShop').addEventListener('click', () => openRenownShop());
// แตะชิป 🏅 ใน HUD เปิดร้านชื่อเสียงได้เลย (ทางลัด)
document.getElementById('renownCounter').addEventListener('click', () => { if (player.prestige.renown > 0) openRenownShop(); });

// ซื้ออัปเกรดแล้วรีเฟรช HUD (renown ลด) + ร้าน + ราคา/สถิติที่อาจเปลี่ยน
GameEvents.on(EVENTS.RENOWN_UPGRADE_BOUGHT, () => { renderRenown(); renderRenownShop(); });
