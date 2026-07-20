/* =====================================================================
   Rendering
   ===================================================================== */
function renderGold() {
  document.getElementById('goldValue').textContent = Math.floor(player.gold).toLocaleString();
}

function renderStageView() {
  const stage = getStage();
  document.getElementById('stageName').textContent = stage.name;
  document.getElementById('stageProduct').textContent = `ขาย ${stage.product}`;
  document.getElementById('standTintOverlay').style.background = stage.color;
  document.getElementById('standBooth').src = stage.stationImg;
  document.getElementById('standBoothFront').src = stage.stationImg;
}

function renderStageProgress() {
  const total = UPGRADE_TYPES.length;
  const done = getStageProgressCount();
  document.getElementById('stageProgressCount').textContent = done;
  document.getElementById('stageProgressTotal').textContent = total;
  const dotsEl = document.getElementById('stageProgressDots');
  dotsEl.innerHTML = '';
  UPGRADE_TYPES.forEach(u => {
    const dot = document.createElement('div');
    dot.className = 'stage-progress-dot' + (player.upgradeLevels[u.key] >= u.maxLevel ? ' done' : '');
    dotsEl.appendChild(dot);
  });
}

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
    btn.textContent = maxed ? 'เต็มขั้น ✓' : `ซื้อ (${cost.toLocaleString()})`;
    btn.disabled = maxed || !affordable;
    btn.addEventListener('click', () => buyUpgrade(type.key));

    card.append(icon, info, btn);
    listEl.appendChild(card);
  });
}

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
  btn.textContent = maxed ? 'ครบแล้ว ✓' : `จ้าง (${cost.toLocaleString()})`;
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
  btn.textContent = maxed ? 'เต็มขั้น ✓' : `ซื้อ (${cost.toLocaleString()})`;
  btn.disabled = maxed || !affordable;
  btn.addEventListener('click', buyVaultLevel);

  card.append(icon, info, btn);
  return card;
}

function renderStatsFooter() {
  document.getElementById('statsFooter').textContent =
    `เสิร์ฟลูกค้าไปแล้ว ${player.stats.totalCustomersServed.toLocaleString()} คน | รายได้สะสมทั้งหมด ${Math.floor(player.stats.totalGoldEarned).toLocaleString()} Gold`;
}

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

function renderAll() {
  renderGold();
  renderStageView();
  renderStageProgress();
  renderUpgradeList();
  renderPermUpgradeList();
  renderProductBadge();
  renderStatsFooter();
  renderFeverBar();
}
