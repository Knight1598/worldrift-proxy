/* =====================================================================
   Upgrades Modal — ลิสต์อัปเกรดทั้งหมด (สุ่มบัพ/อัปเกรดด่าน/อัปเกรดถาวร/สถิติ) ย้ายมา
   อยู่ใน modal ที่เปิดจากปุ่มลอย ⬆️ ขวาล่าง แบบเกมต้นแบบ — ฉากเกมได้พื้นที่เต็มจอ
   ปุ่ม ⬆️ เด้งเรียกความสนใจเมื่อมีอะไรที่ซื้อไหวอย่างน้อย 1 อย่าง
   ===================================================================== */
function openUpgradesModal() {
  renderUpgradeList();
  renderPermUpgradeList();
  renderBuffPanel();
  renderPrestigeRow();
  renderStatsFooter();
  document.getElementById('upgradesModal').classList.add('show');
}

// แถวเกิดใหม่ในหน้าอัปเกรด — โชว์ตัวคูณปัจจุบัน + renown ที่จะได้ถ้ากดตอนนี้ (เด้งเมื่อคุ้มค่า)
function renderPrestigeRow() {
  const row = document.getElementById('prestigeRow');
  const gain = getRenownGain();
  document.getElementById('prestigeRowMult').textContent = `x${getPrestigeMultiplier().toFixed(2)}`;
  document.getElementById('prestigeRowGain').textContent = `+${formatCompact(gain)} 🏅`;
  document.getElementById('prestigeRowSub').textContent = gain >= 1
    ? 'พร้อมเกิดใหม่! แตะเพื่อดูรายละเอียด'
    : 'เริ่มร้านใหม่ แลกชื่อเสียงเพิ่มรายได้ถาวร';
  row.classList.toggle('prestige-row--ready', gain >= 1);
}
document.getElementById('prestigeRow').addEventListener('click', () => openPrestigeModal());

function anyUpgradeAffordable() {
  const stageUpgradeOk = UPGRADE_TYPES.some(u =>
    !u.hiddenFromList && player.upgradeLevels[u.key] < u.maxLevel && player.gold >= getUpgradeCost(u.key));
  const hireOk = player.staffCount < MAX_STAFF_COUNT && player.gold >= getHireHelperCost();
  const vaultOk = player.vaultLevel < MAX_VAULT_LEVEL && player.gold >= getVaultUpgradeCost();
  const rollOk = player.gems >= BUFF_ROLL_COST_GEMS;
  return stageUpgradeOk || hireOk || vaultOk || rollOk;
}

function refreshUpgradesFab() {
  document.getElementById('btnOpenUpgrades').classList.toggle('fab--attention', anyUpgradeAffordable());
}

document.getElementById('btnOpenUpgrades').addEventListener('click', () => openUpgradesModal());
document.getElementById('btnCloseUpgrades').addEventListener('click', () => {
  document.getElementById('upgradesModal').classList.remove('show');
});

GameEvents.on(EVENTS.COIN_COLLECTED, () => refreshUpgradesFab());
GameEvents.on(EVENTS.UPGRADE_PURCHASED, () => refreshUpgradesFab());
GameEvents.on(EVENTS.STAFF_HIRED, () => refreshUpgradesFab());
GameEvents.on(EVENTS.VAULT_UPGRADED, () => refreshUpgradesFab());
GameEvents.on(EVENTS.MISSION_COMPLETED, () => refreshUpgradesFab());
GameEvents.on(EVENTS.BUFF_ROLLED, () => refreshUpgradesFab());
GameEvents.on(EVENTS.GOBLIN_CAUGHT, () => refreshUpgradesFab());
