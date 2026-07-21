/* =====================================================================
   Upgrades Modal — ลิสต์อัปเกรดทั้งหมด (สุ่มบัพ/อัปเกรดด่าน/อัปเกรดถาวร/สถิติ) ย้ายมา
   อยู่ใน modal ที่เปิดจากปุ่มลอย ⬆️ ขวาล่าง แบบเกมต้นแบบ — ฉากเกมได้พื้นที่เต็มจอ
   ปุ่ม ⬆️ เด้งเรียกความสนใจเมื่อมีอะไรที่ซื้อไหวอย่างน้อย 1 อย่าง
   ===================================================================== */
function openUpgradesModal() {
  renderUpgradeList();
  renderPermUpgradeList();
  renderBuffPanel();
  renderStatsFooter();
  document.getElementById('upgradesModal').classList.add('show');
}

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
