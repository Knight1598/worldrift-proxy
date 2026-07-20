/* =====================================================================
   Formulas
   ===================================================================== */
function getStage() { return STAGES[player.stageIndex]; }
function getUpgradeType(key) { return UPGRADE_TYPES.find(u => u.key === key); }

function getUpgradeCost(key) {
  const type = getUpgradeType(key);
  const level = player.upgradeLevels[key];
  return Math.ceil(getStage().baseRevenue * type.baseCostMult * Math.pow(UPGRADE_COST_GROWTH, level));
}

function getRevenuePerSale() {
  const level = player.upgradeLevels.portion;
  const bonus = level * PORTION_LEVEL_BONUS * getMilestoneMultiplier(level);
  return getStage().baseRevenue * (1 + bonus);
}

function getCraftDurationMs() {
  if (isFeverActive()) return FEVER_CRAFT_MS; // Fever Mode: แทบจะทำเสร็จทันที
  const level = player.upgradeLevels.speed;
  const reduction = level * SPEED_CRAFT_MS_REDUCTION * getMilestoneMultiplier(level);
  return Math.max(MIN_CRAFT_MS, BASE_CRAFT_MS - reduction);
}

function getMoveSpeedPxPerSec() {
  const level = player.upgradeLevels.speed;
  const bonus = level * SPEED_MOVE_BONUS_PX * getMilestoneMultiplier(level);
  const base = Math.min(MAX_MOVE_SPEED_PX, BASE_MOVE_SPEED_PX + bonus);
  return isFeverActive() ? base * FEVER_SPEED_MULT : base; // Fever Mode: 2 เท่าความเร็วเดิน
}

function getSpawnIntervalMs() {
  const level = player.upgradeLevels.signage;
  const reduction = level * SIGNAGE_SPAWN_MS_REDUCTION * getMilestoneMultiplier(level);
  return Math.max(MIN_SPAWN_INTERVAL_MS, BASE_SPAWN_INTERVAL_MS - reduction);
}

function getMaxQueueSize() {
  const level = player.upgradeLevels.signage;
  const bonus = level * SIGNAGE_QUEUE_BONUS * getMilestoneMultiplier(level);
  return Math.min(MAX_QUEUE_SIZE, BASE_MAX_QUEUE + Math.round(bonus));
}

function getTipChance() {
  const level = player.upgradeLevels.decor;
  const chance = level * DECOR_LEVEL_TIP_CHANCE * getMilestoneMultiplier(level);
  return Math.min(MAX_TIP_CHANCE, chance);
}

function isStageMaxed() {
  return UPGRADE_TYPES.every(u => player.upgradeLevels[u.key] >= u.maxLevel);
}

function getStageProgressCount() {
  return UPGRADE_TYPES.filter(u => player.upgradeLevels[u.key] >= u.maxLevel).length;
}

// Game Logic Improvement: ตัดสินใจให้ Station "รองรับงานพร้อมกันได้" (ไม่มี Wait-state คั่นคิว) แทนการบังคับ
// worker คนที่ 2/3/4/5 ต้องรอสถานีว่าง — เพราะ workerIndex ของแต่ละคนถูกใช้คำนวณตำแหน่งยืนที่ station/idle
// แยกกันอยู่แล้ว (ดู workerOffsetX ด้านล่าง) ทำให้แต่ละคนมี "ช่องทำงานของตัวเอง" ในภาพ ไม่ทับกัน เล่นลื่นกว่า
// การใส่ Wait-state ซึ่งจะทำให้ลูกมือที่จ้างมาแพงๆ ยืนรอเฉยๆ บ่อยและรู้สึกไม่คุ้มค่าที่จ้าง
function getWorkerCount() { return 1 + player.staffCount; }

function getHireHelperCost() {
  return Math.ceil(getStage().baseRevenue * HIRE_HELPER_BASE_COST_MULT * Math.pow(HIRE_HELPER_COST_GROWTH, player.staffCount));
}

function getVaultUpgradeCost() {
  return Math.ceil(VAULT_BASE_COST * Math.pow(VAULT_COST_GROWTH, player.vaultLevel));
}

function getOfflineMaxHours() {
  return OFFLINE_MAX_HOURS_BASE + player.vaultLevel * OFFLINE_VAULT_HOURS_PER_LEVEL;
}

// เวลาเฉลี่ยที่ worker คนหนึ่งใช้ต่อ 1 ออเดอร์ (คราฟท์ + เดินไปมา) — ไม่พึ่งขนาดจอจริงเพื่อให้คำนวณ Offline Earnings ได้แน่นอน
function getOrderCycleMs() {
  return getCraftDurationMs() + (APPROX_ORDER_TRAVEL_PX / getMoveSpeedPxPerSec()) * 1000;
}

// อัตราออเดอร์/มิลลิวินาที ถูก bound ด้วยตัวที่ช้ากว่าระหว่าง "ลูกค้ามาไหว" กับ "worker ทำไหว"
function getThroughputPerMs() {
  const workerThroughputPerMs = getWorkerCount() / getOrderCycleMs();
  const spawnThroughputPerMs = 1 / getSpawnIntervalMs();
  return Math.min(workerThroughputPerMs, spawnThroughputPerMs);
}
