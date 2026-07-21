/* =====================================================================
   Product Badge + Level-up Modal — ป้ายสินค้าแตะเพื่อเลเวลอัพแยกจากลิสต์อัปเกรดทั่วไป
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

  const starsEl = document.getElementById('productLevelStars');
  starsEl.innerHTML = '';
  for (let i = 0; i < type.maxLevel; i++) {
    const star = document.createElement('span');
    star.textContent = '★';
    star.className = i < level ? 'star-filled' : '';
    starsEl.appendChild(star);
  }
  document.getElementById('productLevelProgressFill').style.width = `${(level / type.maxLevel) * 100}%`;

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
