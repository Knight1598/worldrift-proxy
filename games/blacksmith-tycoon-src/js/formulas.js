/* =====================================================================
   Formulas
   ===================================================================== */
// ด่านไม่รู้จบ: index >= จำนวนธีม -> วนกลับธีมเดิม + คูณ baseRevenue ตามจำนวนรอบที่วนครบ (cycle)
// คืน object ใหม่ (ไม่แก้ STAGES เดิม) โดย copy ธีมแล้ว override baseRevenue/name ให้ต่างกันแต่ละรอบ
// cache ไว้ต่อ stageIndex เพื่อไม่สร้าง object ใหม่ทุกครั้งที่เรียก (getStage ถูกเรียกบ่อยมากต่อเฟรม)
let _stageCache = { index: -1, stage: null };
function getStageCycle() { return Math.floor(player.stageIndex / STAGES.length); }
function getStage() {
  if (_stageCache.index === player.stageIndex) return _stageCache.stage;
  const cycle = getStageCycle();
  const base = STAGES[player.stageIndex % STAGES.length];
  let stage;
  if (cycle === 0) {
    stage = base; // 3 ด่านแรกใช้ของเดิมตรงๆ (ไม่ต้อง copy)
  } else {
    stage = Object.assign({}, base, {
      baseRevenue: base.baseRevenue * Math.pow(STAGE_LOOP_REVENUE_MULT, cycle),
      name: base.name + ' ★' + (cycle + 1), // ต่อท้าย ★2/★3... บอกว่าเป็นรอบที่เท่าไหร่
    });
  }
  _stageCache = { index: player.stageIndex, stage };
  return stage;
}
function getUpgradeType(key) { return UPGRADE_TYPES.find(u => u.key === key); }

/* ===== ร้านชื่อเสียง (Renown Shop) — อัปเกรดถาวรซื้อด้วย renown (ดู data.js RENOWN_UPGRADES) ===== */
function getRenownUpgradeDef(key) { return RENOWN_UPGRADES.find(u => u.key === key); }
function getRenownUpgradeLevel(key) { return (player.prestige.upgrades && player.prestige.upgrades[key]) || 0; }
function getRenownUpgradeCost(key) {
  const def = getRenownUpgradeDef(key);
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, getRenownUpgradeLevel(key)));
}
function getRenownIncomeMult() { return 1 + getRenownUpgradeLevel('income') * getRenownUpgradeDef('income').effectPerLevel; }
function getRenownCraftMult() { return 1 - getRenownUpgradeLevel('craft') * getRenownUpgradeDef('craft').effectPerLevel; }
function getStartStaffCount() { return Math.min(MAX_STAFF_COUNT, getRenownUpgradeLevel('startStaff')); }
function getGemGainMult() { return 1 + getRenownUpgradeLevel('gemBonus') * getRenownUpgradeDef('gemBonus').effectPerLevel; }

function getUpgradeCost(key) {
  const type = getUpgradeType(key);
  const level = player.upgradeLevels[key];
  const base = getStage().baseRevenue * type.baseCostMult * Math.pow(UPGRADE_COST_GROWTH, level);
  return Math.ceil(base);
}

function getRevenuePerSale() {
  const level = player.upgradeLevels.portion;
  const bonus = level * PORTION_LEVEL_BONUS * getMilestoneMultiplier(level);
  // คูณ prestige ด้วย — ฟังก์ชันนี้ป้อน income tracker (offline earnings / Golden Goblin) ให้สเกลตามชื่อเสียง
  // คูณโบนัสเงินจากอุปกรณ์ "ชุดช่าง" ด้วย (ถาวร)
  return getStage().baseRevenue * (1 + bonus) * getPrestigeMultiplier() * getEquipGoldMult();
}

/* ===== Multi-Station (3 สถานีต่อด่าน ดู STATION_SETS ใน data.js) =====
   สถานี 0 = สถานีหลัก ใช้ player.upgradeLevels.portion เป็นเลเวล (ระบบเดิม milestone/mission ทำงานต่อได้หมด)
   สถานี 1-2 = สถานีเสริม เก็บใน player.stationsExtra ปลดล็อกด้วย Gold แล้วอัปเลเวลแยก */
function getStationDef(i) { return STATION_SETS[getStage().key][i]; }
function getStationLevel(i) {
  return i === 0 ? player.upgradeLevels.portion : player.stationsExtra['s' + i].level;
}
function isStationUnlocked(i) {
  return i === 0 ? true : player.stationsExtra['s' + i].unlocked;
}
function getUnlockedStationIndices() {
  return [0, 1, 2].filter(i => isStationUnlocked(i));
}
function getStationRevenue(i) {
  const level = getStationLevel(i);
  const bonus = level * PORTION_LEVEL_BONUS * getMilestoneMultiplier(level);
  return getStage().baseRevenue * getStationDef(i).revenueMult * (1 + bonus) * getPrestigeMultiplier() * getEquipGoldMult();
}

/* ===== Equipment (อุปกรณ์สวมใส่ถาวร ดู systems/equipment.js) — ตัวคูณ/โบนัสถาวรตาม tier ที่สวมอยู่ ===== */
function getEquipCraftMult() { return 1 - getEquipCurrentEffect('tool'); }   // 🔨 ลดเวลาคราฟต์
function getEquipGoldMult() { return 1 + getEquipCurrentEffect('outfit'); }  // 🦺 เงินต่อออเดอร์ +%
function getEquipTipBonus() { return getEquipCurrentEffect('charm'); }       // 🧿 บวกโอกาสทิป (absolute)
function getEquipVipMult() { return 1 + getEquipTier('charm') * 0.4; }       // 🧿 ตัวคูณโอกาสเจอ VIP ตาม tier

/* ===== Prestige (systems/prestige.js) — ตัวคูณรายได้ถาวรจากชื่อเสียง + จำนวน renown ที่จะได้ถ้ากดตอนนี้ ===== */
// ตัวคูณ prestige รวม = (โบนัส renown แบบ passive) x (อัปเกรด "สายเลือดพ่อค้า" จากร้านชื่อเสียง)
function getPrestigeMultiplier() {
  return getRenownPassiveMult() * getRenownIncomeMult();
}
function getRenownPassiveMult() {
  return 1 + player.prestige.renown * PRESTIGE_MULT_PER_RENOWN;
}
function getGoldThisCycle() {
  return Math.max(0, player.stats.totalGoldEarned - player.prestige.goldAtCycleStart);
}
function getRenownGain() {
  return Math.floor(Math.sqrt(getGoldThisCycle() / RENOWN_DIVISOR));
}
function getStationUpgradeCost(i) {
  if (i === 0) return getUpgradeCost('portion');
  const base = getStage().baseRevenue * getStationDef(i).revenueMult * 10 * Math.pow(UPGRADE_COST_GROWTH, getStationLevel(i));
  return Math.ceil(base);
}
function getStationUnlockCost(i) {
  const base = getStage().baseRevenue * getStationDef(i).unlockCostMult;
  return Math.ceil(base);
}
function getStationIcon(i) {
  const def = getStationDef(i);
  return def.icon || getProductIcon(); // สถานีหลักใช้ไอคอนสินค้าตาม tier เดิม
}

function getCraftDurationMs() {
  if (isFeverActive()) return FEVER_CRAFT_MS; // Fever Mode: แทบจะทำเสร็จทันที
  const level = player.upgradeLevels.speed;
  const reduction = level * SPEED_CRAFT_MS_REDUCTION * getMilestoneMultiplier(level);
  // อัปเกรด "มือเทวดา" (ร้านชื่อเสียง) + อุปกรณ์ "เครื่องมือช่าง" ลดเวลาคราฟต์ถาวรเป็น % คูณทับหลังหักจากเลเวล speed
  return Math.max(MIN_CRAFT_MS, (BASE_CRAFT_MS - reduction) * getRenownCraftMult() * getEquipCraftMult());
}

function getMoveSpeedPxPerSec() {
  const level = player.upgradeLevels.speed;
  const bonus = level * SPEED_MOVE_BONUS_PX * getMilestoneMultiplier(level);
  let base = Math.min(MAX_MOVE_SPEED_PX, BASE_MOVE_SPEED_PX + bonus);
  return isFeverActive() ? base * FEVER_SPEED_MULT : base; // Fever Mode: 2 เท่าความเร็วเดิน
}

function getSpawnIntervalMs() {
  const level = player.upgradeLevels.signage;
  const reduction = level * SIGNAGE_SPAWN_MS_REDUCTION * getMilestoneMultiplier(level);
  let ms = Math.max(MIN_SPAWN_INTERVAL_MS, BASE_SPAWN_INTERVAL_MS - reduction);
  return ms;
}

function getMaxQueueSize() {
  const level = player.upgradeLevels.signage;
  const bonus = level * SIGNAGE_QUEUE_BONUS * getMilestoneMultiplier(level);
  let size = Math.min(MAX_QUEUE_SIZE, BASE_MAX_QUEUE + Math.round(bonus));
  return size;
}

function getTipChance() {
  const level = player.upgradeLevels.decor;
  let chance = level * DECOR_LEVEL_TIP_CHANCE * getMilestoneMultiplier(level);
  chance += getEquipTipBonus(); // อุปกรณ์ "เครื่องราง" บวกโอกาสทิปถาวร
  return Math.min(MAX_TIP_CHANCE, chance);
}

// โอกาสเจอลูกค้า VIP ตอนเกิดใหม่ — แยกเป็นฟังก์ชันแทนใช้ VIP_CHANCE คงที่ เพื่อให้อุปกรณ์ "เครื่องราง" มีผลได้
function getVipChance() {
  return VIP_CHANCE * getEquipVipMult();
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
  return Math.ceil(base);
}

function getVaultUpgradeCost() {
  const base = VAULT_BASE_COST * Math.pow(VAULT_COST_GROWTH, player.vaultLevel);
  return Math.ceil(base);
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
