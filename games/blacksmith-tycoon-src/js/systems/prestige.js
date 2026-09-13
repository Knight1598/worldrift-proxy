/* =====================================================================
   Prestige / เกิดใหม่ — รีเซ็ตความคืบหน้ารอบนี้เพื่อแลกชื่อเสียง (renown 🏅)
   ที่ให้ตัวคูณรายได้ถาวรข้ามรอบ (getPrestigeMultiplier ใน formulas.js)
   เก็บไว้ไม่รีเซ็ต: gems, prestige, identity, settings, stats (สะสมทั้งชีวิต)
   รีเซ็ต: gold, ด่าน, อัปเกรด, สถานีเสริม, ภารกิจ, ลูกมือ, คลัง Vault, milestone flags
   goldThisCycle คำนวณจาก totalGoldEarned (แหล่งเดียวที่ทุกรายได้บวกเข้าอยู่แล้ว) ลบ snapshot
   จึงไม่ต้องดัก event รายได้หลายจุด — decoupled โดยสมบูรณ์
   ===================================================================== */
function canPrestige() {
  return getRenownGain() >= 1;
}

function doPrestige() {
  const gain = getRenownGain();
  if (gain < 1) return null; // ยังไม่คุ้ม (goldThisCycle น้อยเกินจนได้ 0 renown)

  player.prestige.renown += gain;
  player.prestige.count += 1;
  player.prestige.goldAtCycleStart = player.stats.totalGoldEarned; // เริ่มนับ cycle ใหม่จากยอดสะสมปัจจุบัน
  player.gems += PRESTIGE_MIN_GEMS_REWARD; // โบนัสเพชรเล็กๆ ทุกครั้ง

  // ---- รีเซ็ตความคืบหน้ารอบนี้ (คงของถาวรไว้) ----
  player.gold = 0;
  player.stageIndex = 0;
  player.upgradeLevels = { speed: 0, portion: 0, signage: 0, decor: 0 };
  player.stationsExtra = defaultStationsExtra();
  player.staffCount = getStartStaffCount(); // อัปเกรด "ทีมประจำร้าน" — เริ่มพร้อมลูกมือติดตัว
  player.vaultLevel = 0;
  player.milestonesShown = {};
  player.missionIndex = 0;
  player.missionProgress = 0;
  player.inventory = defaultInventory();

  saveGame();

  // รีเซ็ตฉากเหมือน advanceStage: ล้างลูกค้า/เหรียญ + สร้าง worker ใหม่ + รีสตาร์ท spawn loop
  clearAllCustomers();
  initWorkers();
  GameEvents.emit(EVENTS.STAGE_ADVANCED, { stageIndex: 0 }); // ให้ทุก UI รีเฟรชเป็นด่าน 1
  GameEvents.emit(EVENTS.PRESTIGE_DONE, { renownGained: gain, totalRenown: player.prestige.renown });
  scheduleNextCustomer();
  playSfxStageComplete();
  spawnConfetti(60);
  return gain;
}

/* ===== ร้านชื่อเสียง (Renown Shop) — ซื้ออัปเกรดถาวรด้วย renown ===== */
function buyRenownUpgrade(key) {
  const def = getRenownUpgradeDef(key);
  if (!def) return false;
  const level = getRenownUpgradeLevel(key);
  if (level >= def.maxLevel) return false;
  const cost = getRenownUpgradeCost(key);
  if (player.prestige.renown < cost) return false;
  player.prestige.renown -= cost;
  player.prestige.upgrades[key] = level + 1;
  playSfxUpgrade();
  GameEvents.emit(EVENTS.RENOWN_UPGRADE_BOUGHT, { key, level: level + 1 });
  saveGame();
  return true;
}
