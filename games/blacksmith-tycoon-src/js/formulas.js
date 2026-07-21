/* =====================================================================
   Formulas
   ===================================================================== */
function getStage() { return STAGES[player.stageIndex]; }
function getUpgradeType(key) { return UPGRADE_TYPES.find(u => u.key === key); }

function getUpgradeCost(key) {
  const type = getUpgradeType(key);
  const level = player.upgradeLevels[key];
  const base = getStage().baseRevenue * type.baseCostMult * Math.pow(UPGRADE_COST_GROWTH, level);
  return Math.ceil(isBuffActive('discount') ? base * 0.8 : base);
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
  let base = Math.min(MAX_MOVE_SPEED_PX, BASE_MOVE_SPEED_PX + bonus);
  if (isBuffActive('speed_boost')) base *= 1.5; // บัพ "เท้าไฟ"
  return isFeverActive() ? base * FEVER_SPEED_MULT : base; // Fever Mode: 2 เท่าความเร็วเดิน
}

function getSpawnIntervalMs() {
  const level = player.upgradeLevels.signage;
  const reduction = level * SIGNAGE_SPAWN_MS_REDUCTION * getMilestoneMultiplier(level);
  let ms = Math.max(MIN_SPAWN_INTERVAL_MS, BASE_SPAWN_INTERVAL_MS - reduction);
  if (isBuffActive('signage_boost')) ms = Math.max(MIN_SPAWN_INTERVAL_MS, ms * 0.7); // บัพ "ป้ายเรืองแสง"
  return ms;
}

function getMaxQueueSize() {
  const level = player.upgradeLevels.signage;
  const bonus = level * SIGNAGE_QUEUE_BONUS * getMilestoneMultiplier(level);
  let size = Math.min(MAX_QUEUE_SIZE, BASE_MAX_QUEUE + Math.round(bonus));
  if (isBuffActive('signage_boost')) size += 2; // บัพ "ป้ายเรืองแสง"
  return size;
}

function getTipChance() {
  const level = player.upgradeLevels.decor;
  let chance = level * DECOR_LEVEL_TIP_CHANCE * getMilestoneMultiplier(level);
  if (isBuffActive('tip_boost')) chance *= 2; // บัพ "มือทิป"
  return Math.min(MAX_TIP_CHANCE, chance);
}

// โอกาสเจอลูกค้า VIP ตอนเกิดใหม่ — แยกเป็นฟังก์ชันแทนใช้ VIP_CHANCE คงที่ตรงๆ เพื่อให้บัพ "แม่เหล็ก VIP" มีผลได้
function getVipChance() {
  return VIP_CHANCE * (isBuffActive('vip_magnet') ? 3 : 1);
}

// เงื่อนไขขึ้นด่านย้ายไปอยู่ที่ isRenovateReady() (ui/renovate-modal.js) แบบเกมต้นแบบ:
// สินค้าถึงเลเวล RENOVATE_GATE_LEVEL ก็พอ ไม่ต้องอัปครบทุกชนิดจนเต็มขั้นอีกแล้ว

// Game Logic Improvement: ตัดสินใจให้ Station "รองรับงานพร้อมกันได้" (ไม่มี Wait-state คั่นคิว) แทนการบังคับ
// worker คนที่ 2/3/4/5 ต้องรอสถานีว่าง — เพราะ workerIndex ของแต่ละคนถูกใช้คำนวณตำแหน่งยืนที่ station/idle
// แยกกันอยู่แล้ว (ดู workerOffsetX ด้านล่าง) ทำให้แต่ละคนมี "ช่องทำงานของตัวเอง" ในภาพ ไม่ทับกัน เล่นลื่นกว่า
// การใส่ Wait-state ซึ่งจะทำให้ลูกมือที่จ้างมาแพงๆ ยืนรอเฉยๆ บ่อยและรู้สึกไม่คุ้มค่าที่จ้าง
function getWorkerCount() { return 1 + player.staffCount; }

function getHireHelperCost() {
  const base = getStage().baseRevenue * HIRE_HELPER_BASE_COST_MULT * Math.pow(HIRE_HELPER_COST_GROWTH, player.staffCount);
  return Math.ceil(isBuffActive('discount') ? base * 0.8 : base);
}

function getVaultUpgradeCost() {
  const base = VAULT_BASE_COST * Math.pow(VAULT_COST_GROWTH, player.vaultLevel);
  return Math.ceil(isBuffActive('discount') ? base * 0.8 : base);
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

// คะแนนรวม "มูลค่าผู้เล่น" ไว้ใช้เทียบอันดับ Leaderboard (ดู systems/leaderboard.js) — ยังไม่มี backend จริง
// ตอนนี้ แค่เตรียมสูตรกลางไว้ให้ผลลัพธ์เพิ่มขึ้นเสมอเมื่อ progression ใดๆ (gold/ด่าน/อัปเกรด/ลูกมือ/คลัง) เพิ่มขึ้น
function getNetWorth() {
  return Math.floor(
    player.gold +
    player.stats.totalGoldEarned * 0.1 +
    player.stageIndex * 5000 +
    Object.values(player.upgradeLevels).reduce((a, b) => a + b, 0) * 50 +
    player.staffCount * 2000 +
    player.vaultLevel * 500
  );
}
