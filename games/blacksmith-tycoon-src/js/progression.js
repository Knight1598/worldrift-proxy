/* =====================================================================
   Upgrades / Stage progression
   ===================================================================== */
function buyUpgrade(key) {
  const type = getUpgradeType(key);
  const level = player.upgradeLevels[key];
  if (level >= type.maxLevel) return;
  const cost = getUpgradeCost(key);
  if (player.gold < cost) return;
  player.gold -= cost;
  const newLevel = level + 1;
  player.upgradeLevels[key] = newLevel;
  playSfxUpgrade();
  checkMilestone(key, newLevel, type.name);
  // ยิง event แทนเรียก render*() 5-6 ฟังก์ชันข้ามไฟล์ตรงๆ — render.js subscribe เอง (ดู render.js ท้ายไฟล์)
  GameEvents.emit(EVENTS.UPGRADE_PURCHASED, { key, level: newLevel });
  saveGame();
  if (isStageMaxed()) showStageCompleteModal();
}

// Milestone Boosts: เลเวล 10/25/50 ของอัปเกรดไหนก็ตาม โชว์ป๊อปอัพฉลอง 1 ครั้งต่อเลเวล (กันเด้งซ้ำตอนโหลดเซฟ
// ด้วย player.milestonesShown ที่ persist ผ่าน save)
function checkMilestone(key, level, displayName) {
  if (!MILESTONE_LEVELS.includes(level)) return;
  if (!player.milestonesShown[key]) player.milestonesShown[key] = [];
  if (player.milestonesShown[key].includes(level)) return;
  player.milestonesShown[key].push(level);
  const mult = getMilestoneMultiplier(level);
  showMilestoneToast(displayName, level, mult); // ui/floating-text.js
  GameEvents.emit(EVENTS.MILESTONE_REACHED, { key, level, mult, displayName });
}

/* =====================================================================
   Multi-Staff System — จ้างลูกมือเพิ่ม (สูงสุด MAX_STAFF_COUNT คน) + Offline Vault — อัปเกรดถาวร
   ทั้งสองอย่างไม่อยู่ใน UPGRADE_TYPES/upgradeLevels เพราะไม่ถูกรีเซ็ตตอนขึ้นด่านใหม่ (ดู advanceStage)
   ===================================================================== */
function hireHelper() {
  if (player.staffCount >= MAX_STAFF_COUNT) return;
  const cost = getHireHelperCost();
  if (player.gold < cost) return;
  player.gold -= cost;
  player.staffCount += 1;
  addWorker('staff');
  playSfxUpgrade();
  GameEvents.emit(EVENTS.STAFF_HIRED, { staffCount: player.staffCount });
  saveGame();
}

function buyVaultLevel() {
  if (player.vaultLevel >= MAX_VAULT_LEVEL) return;
  const cost = getVaultUpgradeCost();
  if (player.gold < cost) return;
  player.gold -= cost;
  player.vaultLevel += 1;
  playSfxUpgrade();
  GameEvents.emit(EVENTS.VAULT_UPGRADED, { vaultLevel: player.vaultLevel });
  saveGame();
}

function advanceStage() {
  document.getElementById('stageCompleteModal').classList.remove('show');
  const wasFirstStage = player.stageIndex === 0;
  if (player.stageIndex >= STAGES.length - 1) {
    document.getElementById('gameCompleteModal').classList.add('show');
    return;
  }
  player.stageIndex += 1;
  player.upgradeLevels = { speed: 0, portion: 0, signage: 0, decor: 0 };
  // staffCount/vaultLevel เป็นอัปเกรดถาวร ไม่ถูกรีเซ็ตตรงนี้ — คงค่าจากด่านก่อนหน้าไว้ทั้งหมด
  if (wasFirstStage && player.staffCount === 0) {
    player.staffCount = 1; // ปลดล็อกลูกมือคนแรกฟรี + รายได้ตอนไม่อยู่หน้าจอ หลังผ่านร้านแรกสำเร็จ (ตามดีไซน์เดิม)
  }
  clearAllCustomers();
  initWorkers();
  // ยิง event แทนเรียก renderAll() ข้ามไฟล์ตรงๆ — render.js subscribe เอง
  GameEvents.emit(EVENTS.STAGE_ADVANCED, { stageIndex: player.stageIndex });
  // Visual Workstation Upgrade: เด้ง pop ให้เห็นชัดว่า Station เปลี่ยนหน้าตาแล้วตอนขึ้นด่านใหม่
  const boothEl = document.getElementById('standBooth');
  const boothFrontEl = document.getElementById('standBoothFront');
  boothEl.classList.remove('stage-swap'); void boothEl.offsetWidth; boothEl.classList.add('stage-swap');
  boothFrontEl.classList.remove('stage-swap'); void boothFrontEl.offsetWidth; boothFrontEl.classList.add('stage-swap');
  scheduleNextCustomer();
  saveGame();
}

/* =====================================================================
   Offline Earnings (ปลดล็อกหลังจ้างพนักงานร้านแรกสำเร็จ) — อิงอัตรารายได้ปัจจุบันคูณเวลาที่ออฟไลน์
   ใช้ estimateIncomePerMinute() ตัวเดียวกับ Golden Goblin (systems/income-tracker.js) แทนสูตรที่
   เคยคำนวณแยกกันคนละที่ — ในทางปฏิบัติจุดนี้ยังได้ค่าทฤษฎีเหมือนเดิมเสมอ เพราะฟังก์ชันนี้ถูกเรียกตอน
   บูตเกม (ก่อนมี COIN_COLLECTED sample ใดๆ สะสมเลย) จึง fallback เข้าสูตรทฤษฎีทุกครั้งโดยธรรมชาติ
   ===================================================================== */
function applyOfflineEarnings() {
  if (player.staffCount === 0) return; // ปลดล็อกหลังจ้างลูกมือคนแรก เหมือนดีไซน์เดิม
  const elapsedMs = Math.min(Date.now() - player.lastSeenAt, getOfflineMaxHours() * 3600 * 1000);
  if (elapsedMs < 30000) return; // น้อยกว่า 30 วินาทีไม่ต้องโชว์ ป้องกันรีเฟรชถี่ๆ แล้วเจอ modal ทุกครั้ง
  const earned = Math.floor((elapsedMs / 60000) * estimateIncomePerMinute() * OFFLINE_EFFICIENCY);
  if (earned <= 0) return;
  player.gold += earned;
  player.stats.totalGoldEarned += earned;
  const hours = (elapsedMs / 3600000).toFixed(1);
  document.getElementById('welcomeBackText').textContent = `ระหว่างที่คุณไม่อยู่ (${hours} ชม.) ร้านขายได้ Gold +${earned}!`;
  document.getElementById('welcomeBackModal').classList.add('show');
}

