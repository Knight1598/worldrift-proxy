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
  // ผ่านเงื่อนไข Renovate (สินค้าถึงเลเวล 25) ครั้งแรกของด่านนี้ -- ฉลอง + ชี้ไปที่ปุ่ม 🔨
  // (แทน stage-complete modal เดิมที่เด้งเองตอนอัปเกรดครบทุกชนิด ซึ่งถูกแทนด้วย Renovate flow แล้ว)
  if (key === 'portion' && newLevel === RENOVATE_GATE_LEVEL) {
    playSfxStageComplete();
    const toast = document.createElement('div');
    toast.className = 'milestone-toast';
    toast.innerHTML = `🔨 <b>${getStage().name}</b> พร้อมขยับขยายแล้ว!<br>กดปุ่มค้อนซ้ายล่างเพื่อ Renovate!`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1900);
  }
}

// Milestone Boosts: เลเวล 10/25/50 ของอัปเกรดไหนก็ตาม โชว์ป๊อปอัพฉลอง 1 ครั้งต่อเลเวล (กันเด้งซ้ำตอนโหลดเซฟ
// ด้วย player.milestonesShown ที่ persist ผ่าน save) + รางวัลดาว: ได้เพชรทันที (💎 ท้ายแถบดาวในคลิป)
function checkMilestone(key, level, displayName) {
  if (!MILESTONE_LEVELS.includes(level)) return;
  if (!player.milestonesShown[key]) player.milestonesShown[key] = [];
  if (player.milestonesShown[key].includes(level)) return;
  player.milestonesShown[key].push(level);
  const mult = getMilestoneMultiplier(level);
  player.gems += Math.round(STATION_STAR_REWARD_GEMS * getGemGainMult()); // รางวัลดาว milestone (x บุญเพชร)
  renderGems();
  showMilestoneToast(displayName, level, mult); // ui/floating-text.js
  GameEvents.emit(EVENTS.MILESTONE_REACHED, { key, level, mult, displayName });
}

/* ===== Multi-Station: ปลดล็อก/อัปเลเวลสถานีเสริม (สถานีหลักใช้ buyUpgrade('portion') เดิม) ===== */
function buyStationUnlock(i) {
  if (isStationUnlocked(i)) return;
  const cost = getStationUnlockCost(i);
  if (player.gold < cost) return;
  player.gold -= cost;
  player.stationsExtra['s' + i] = { unlocked: true, level: 1 };
  playSfxStageComplete();
  spawnConfetti(18);
  GameEvents.emit(EVENTS.STATION_UNLOCKED, { stationIndex: i });
  saveGame();
}

function buyStationLevel(i) {
  const maxLevel = getUpgradeType('portion').maxLevel;
  const level = getStationLevel(i);
  if (level >= maxLevel) return;
  const cost = getStationUpgradeCost(i);
  if (player.gold < cost) return;
  player.gold -= cost;
  const newLevel = level + 1;
  player.stationsExtra['s' + i].level = newLevel;
  playSfxUpgrade();
  if (MILESTONE_LEVELS.includes(newLevel)) {
    // รางวัลดาวของสถานีเสริม — ไม่ต้องพึ่ง milestonesShown เพราะเลเวลขึ้นทีละ 1 แตะแต่ละ milestone ได้ครั้งเดียวโดยธรรมชาติ
    player.gems += Math.round(STATION_STAR_REWARD_GEMS * getGemGainMult());
    renderGems();
    showMilestoneToast(getStationDef(i).name, newLevel, getMilestoneMultiplier(newLevel));
  }
  GameEvents.emit(EVENTS.STATION_UPGRADED, { stationIndex: i, level: newLevel });
  saveGame();
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
  const wasFirstStage = player.stageIndex === 0;
  const enteringNewLoop = (player.stageIndex + 1) % STAGES.length === 0; // กำลังจะจบรอบ (เข้ารอบ ★ ถัดไป)
  // ด่านไม่รู้จบ: Renovate ขยับด่านต่อไปได้เสมอ (ไม่มีจุดจบเกมอีกแล้ว — จุดจบย้ายไปที่ Prestige)
  // รางวัล Renovate (ช่อง Rewards ในหน้าต่าง Renovate สัญญาไว้ ดู ui/renovate-modal.js)
  player.gems += RENOVATE_REWARD_GEMS;
  renderGems();
  spawnConfetti();
  playSfxStageComplete();
  player.stageIndex += 1;
  if (enteringNewLoop) {
    // จบครบ 1 รอบ (3 ธีม) — โบนัสก้อนใหญ่ + ป๊อปอัพฉลองว่าเข้าสู่รอบ ★ ที่ยากขึ้น/รวยขึ้น
    player.gems += FINAL_STAGE_REWARD_GEMS;
    const toast = document.createElement('div');
    toast.className = 'milestone-toast';
    toast.innerHTML = `👑 เข้าสู่รอบ ★${getStageCycle() + 1}!<br>รายได้ทุกอย่างสูงขึ้น +${FINAL_STAGE_REWARD_GEMS} 💎`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2100);
  }
  player.upgradeLevels = { speed: 0, portion: 0, signage: 0, decor: 0 };
  player.stationsExtra = defaultStationsExtra(); // ร้านใหม่ สถานีเสริมเริ่มล็อกใหม่ (แบบเกมต้นแบบ)
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

