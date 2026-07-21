/* =====================================================================
   ข้อมูลเกม (Stages / Upgrades)
   ===================================================================== */
const STAGES = [
  { key: 'stall',   name: 'แผงขายของริมทาง',    product: 'ของกินของใช้ทั่วไป', stationImg: '../assets/blacksmith/station_stall.png',
    customerImgs: ['../assets/blacksmith/rogue.png', '../assets/blacksmith/villager_woman.png', '../assets/blacksmith/farmer_man.png'],
    color: '#f3e3c9', baseRevenue: 5,
    recipe: [{ material: 'ore', qty: 1 }] },
  { key: 'forge',   name: 'โรงตีดาบ',           product: 'ดาบ',               stationImg: '../assets/blacksmith/station_forge.png',
    customerImgs: ['../assets/blacksmith/knight.png'],
    color: '#dcdbe0', baseRevenue: 25,
    recipe: [{ material: 'ore', qty: 2 }, { material: 'coal', qty: 1 }] },
  { key: 'alchemy', name: 'ห้องเล่นแร่แปรธาตุ',  product: 'โพชั่นวิเศษ',        stationImg: '../assets/blacksmith/station_alchemy.png',
    customerImgs: ['../assets/blacksmith/wizard.png'],
    color: '#e3d9f3', baseRevenue: 125,
    recipe: [{ material: 'herb', qty: 2 }] },
];
// ด่านไม่รู้จบ: หลังด่านสุดท้ายวนกลับไปธีมเดิม แต่คูณ baseRevenue ต่อ "รอบ" (cycle) ที่วนครบ 3 ด่าน
// stageIndex เดินต่อได้เรื่อยๆ ไม่มีเพดาน — getStage() (formulas.js) จัดการ mod + scale ให้เอง
// เลข 6 = รอบถัดไปรายได้ x6 (ด่าน 4 = stall x6, ด่าน 7 = stall x36, ...) โตชันพอให้ตัวเลขไต่ไม่รู้จบ
const STAGE_LOOP_REVENUE_MULT = 6;
function getRandomCustomerImg() {
  const imgs = getStage().customerImgs;
  return imgs[Math.floor(Math.random() * imgs.length)];
}

// ไอคอนสินค้าที่ขาย เปลี่ยนดีไซน์ (tier) ตามระดับอัปเกรด "คุณภาพสินค้า" ที่ซื้อไปแล้ว — ให้เห็นภาพว่าซื้ออัปเกรด
// แล้วของที่ขายเปลี่ยนจริง ไม่ใช่แค่ตัวเลขขยับ (จับต้องได้ตามที่ตั้งใจออกแบบไว้)
const PRODUCT_TIERS = {
  stall:   [{ minLevel: 0, icon: '../assets/blacksmith/coin.png' }],
  forge:   [{ minLevel: 0, icon: '../assets/blacksmith/sword_bronze.png' }, { minLevel: 2, icon: '../assets/blacksmith/sword_silver.png' }, { minLevel: 4, icon: '../assets/blacksmith/sword_blue.png' }],
  alchemy: [{ minLevel: 0, icon: '../assets/blacksmith/potion_red.png' }, { minLevel: 3, icon: '../assets/blacksmith/potion_blue.png' }],
};
function getProductIcon() {
  const tiers = PRODUCT_TIERS[getStage().key];
  const level = player.upgradeLevels.portion;
  let icon = tiers[0].icon;
  tiers.forEach(t => { if (level >= t.minLevel) icon = t.icon; });
  return icon;
}

const UPGRADE_TYPES = [
  // baseCostMult ลดจาก 8 -> 6 (speed) และ 10 -> 6 (portion) เพื่อเร่ง pacing ด่านแรกให้ผู้เล่นใหม่:
  // portion ถูกลงทำให้ (1) ไต่ถึง Renovate Gate เร็วขึ้น ~40% (2) รายได้ต่อออเดอร์พุ่งเร็วขึ้น = snowball ไว
  // ทั้งคู่ยังโตด้วย UPGRADE_COST_GROWTH 1.05 ต่อเลเวลเหมือนเดิม จึงกระทบแค่ช่วงต้น ไม่ทำ mid/late game พัง
  { key: 'speed',   name: 'ความเร็วในการทำงาน', icon: '⚡', desc: 'พนักงานเดินไวขึ้นและทำของเสร็จเร็วขึ้น', maxLevel: 50, baseCostMult: 6  },
  // "คุณภาพสินค้า" ไม่โชว์ในลิสต์ทั่วไป — ย้ายไปเป็นป๊อปอัพแยกที่แตะตัวสินค้าโดยตรงแทน (ตามแพทเทิร์นเกมต้นแบบ
  // ที่ผู้ใช้ส่งวิดีโอมา ซึ่งแยก "อัปเกรดร้านทั่วไป" กับ "เลเวลอัปสินค้า" ออกจากกันเป็นคนละกลไก)
  { key: 'portion', name: 'คุณภาพสินค้า',     icon: '📈', desc: 'ได้เงินต่อออเดอร์มากขึ้น (และของที่ขายอัปเกรดหน้าตาด้วย)', maxLevel: 50, baseCostMult: 6, hiddenFromList: true },
  { key: 'signage', name: 'ป้ายร้าน',         icon: '📣', desc: 'ลูกค้ามาบ่อยขึ้น และรับคิวรอได้มากขึ้น',  maxLevel: 50, baseCostMult: 12 },
  { key: 'decor',   name: 'ตกแต่งร้าน',        icon: '✨', desc: 'ลูกค้ามีโอกาสให้ทิป',     maxLevel: 50, baseCostMult: 14 },
];

// Deep Progression: maxLevel ขยายจาก 5 -> 50 ทุกอัปเกรด เลยต้องลดความชันของ cost growth ลงมาก
// (เดิม 1.6 ต่อเลเวล กับแค่ 5 เลเวล, 1.13 ต่อเลเวล กับ 50 เลเวลยังชันเกินไป — จำลองแบบ optimal-play ต่อเนื่อง
// ไม่มีพักพบว่าด่านแรก (worker เดียว) กว่าจะซื้อครบ 4 อัปเกรดจนสุดทั้งหมดใช้เวลาเกือบ 2.5 ชม. และ 20 เลเวลสุดท้าย
// กิน 45% ของเวลาทั้งหมด (cost โต 1.13^level เร็วกว่ารายได้ที่โตแบบเกือบเชิงเส้นมาก) รู้สึกยืดเยื้อเกินไปสำหรับด่านแรก
// ลดเหลือ 1.05 ให้ด่านแรกอยู่ที่ ~25 นาที (ด่านถัดไปเร็วกว่านั้นเพราะมี worker เพิ่ม) ยังคงมีเนื้อให้ไต่ระดับ
// แต่ไม่ลากยาวจนน่าเบื่อ ดู pacing_sim.js ที่ใช้ประกอบการตัดสินใจ)
const UPGRADE_COST_GROWTH = 1.05;
const PORTION_LEVEL_BONUS = 0.08;
const DECOR_LEVEL_TIP_CHANCE = 0.012;
const MAX_TIP_CHANCE = 0.75; // เพดานกันโอกาสทิปพุ่งเกินจริงตอนเลเวลสูงๆ รวมกับ Milestone multiplier

// ===== Milestone Boosts — เลเวล 10/25/50 ของอัปเกรดไหนก็ตาม จะได้ตัวคูณโบนัสก้อนใหญ่ทันที (พร้อมป๊อปอัพฉลอง) =====
// ตัวคูณนี้คูณเข้ากับ "โบนัสต่อเลเวล" ของอัปเกรดนั้นๆ เท่านั้น (ไม่คูณราคาซื้อ/ไม่ผูกกับ maxLevel check)
const MILESTONE_LEVELS = [10, 25, 50];
const MILESTONE_MULTIPLIERS = [2, 4, 8]; // สะสม: ถึง 10 = x2, ถึง 25 = x4 รวม, ถึง 50 = x8 รวม
function getMilestoneMultiplier(level) {
  let mult = 1;
  for (let i = MILESTONE_LEVELS.length - 1; i >= 0; i--) {
    if (level >= MILESTONE_LEVELS[i]) { mult = MILESTONE_MULTIPLIERS[i]; break; }
  }
  return mult;
}

// ผู้เล่น/พนักงานเดิน+ทำของ — ควบคุมโดยอัปเกรด "ความเร็วในการทำงาน"
const BASE_CRAFT_MS = 2600; // ลดจาก 3200 ตามคำขอเดินเกมเร็วขึ้น
const MIN_CRAFT_MS = 900;
const SPEED_CRAFT_MS_REDUCTION = 46; // ต่อเลเวล (50 เลเวลไม่มี milestone พอดีแตะพื้น MIN_CRAFT_MS)
const BASE_MOVE_SPEED_PX = 90;   // px/วินาที
const SPEED_MOVE_BONUS_PX = 4;   // px/วินาที ต่อเลเวล
const MAX_MOVE_SPEED_PX = 400;   // เพดานกันความเร็วพุ่งเกินจริงตอนรวม Milestone x8 เข้าไปด้วย

// อัตราการเกิดลูกค้า + ความจุคิว — ควบคุมโดยอัปเกรด "ป้ายร้าน"
const BASE_SPAWN_INTERVAL_MS = 3000; // ลดจาก 3400 ตามคำขอเดินเกมเร็วขึ้น
const MIN_SPAWN_INTERVAL_MS = 1100;
const SIGNAGE_SPAWN_MS_REDUCTION = 46; // ต่อเลเวล
const BASE_MAX_QUEUE = 3;
const SIGNAGE_QUEUE_BONUS = 0.2; // ต่อเลเวล (ปัดเศษตอนคำนวณ)
const MAX_QUEUE_SIZE = 20; // เพดานกันคิวยาวจนล้นจอ

const CUSTOMER_WALK_SPEED_PX = 70; // ความเร็วเดินของลูกค้า คงที่ ไม่ผูกกับอัปเกรด (สเปกระบุให้อัปเกรดความเร็วมีผลแค่ผู้เล่น/พนักงาน)
const PATIENCE_DURATION_MS = 9000; // หลอดความอดทนเชิงภาพล้วนๆ ไม่มีผลลงโทษถ้าหมด (ไม่ได้ระบุ fail-state ไว้ในสเปก)
const APPROX_ORDER_TRAVEL_PX = 240; // ลดลงหลังตัดขาเดินเก็บเหรียญ (COLLECT) ออกจากรอบงาน // ระยะทางเดินโดยประมาณต่อ 1 ออเดอร์ (ไป station + ไปส่งที่คิว + ไปเก็บเหรียญ) ใช้คำนวณ throughput แบบไม่พึ่ง DOM เพื่อให้ deterministic

// ===== Renovate (ขึ้นด่านแบบ Eatventure) =====
// เดิมต้องอัปเกรดครบ 4 ชนิด x50 เลเวล (200 ครั้ง) ถึงขึ้นด่านใหม่ได้ — ยืดเกินไปมาก
// เปลี่ยนเป็นแบบเกมต้นแบบในคลิป: อัปเกรด "สินค้า" (สถานีหลัก) ถึงเลเวลที่กำหนดก็กดปุ่ม 🔨 Renovate ได้เลย
// อัปเกรดตัวอื่นๆ (ความเร็ว/ป้าย/ตกแต่ง/สถานีเสริม) กลายเป็นตัวเสริมให้ฟาร์มเร็วขึ้น ไม่ใช่กำแพงบังคับ
const RENOVATE_GATE_LEVEL = 15;   // ลดจาก 25 -> 15 ตามคำขอ "เดินเกมเร็วขึ้น" (ยังคงคอนเซ็ปต์ gate เดียวแบบคลิป)
const RENOVATE_REWARD_GEMS = 10;  // รางวัลเพชรตอน Renovate สำเร็จ (คลิปมีช่อง Rewards ในหน้าต่าง Renovate)

// ===== Prestige / เกิดใหม่ (ชื่อเสียงช่างตีเหล็ก 🏅) =====
// รีเซ็ตความคืบหน้ารอบนี้ (gold/ด่าน/อัปเกรด/สถานี/ภารกิจ/ลูกมือ/คลัง) เพื่อแลก "ชื่อเสียง" (renown)
// ที่ให้ตัวคูณรายได้ถาวรข้ามรอบ — ทำให้เกมเล่นได้ไม่รู้จบ (เก็บ gems/renown/identity/settings/สถิติสะสมไว้)
// renown ที่ได้ = floor(sqrt(goldThisCycle / RENOWN_DIVISOR)) — รากที่สองให้ผลตอบแทนค่อยๆ ลด (โค้ง prestige คลาสสิก)
// goldThisCycle คำนวณจาก player.stats.totalGoldEarned (สะสมทุกแหล่งอยู่แล้ว) ลบ snapshot ตอนเริ่มรอบ
const RENOWN_DIVISOR = 800;             // ปรับด้วย sim: เล่นจบเกม 1 รอบ (~119K gold) = ~12 renown (+24% รายได้)
const PRESTIGE_MULT_PER_RENOWN = 0.02;  // renown 1 หน่วย = +2% รายได้ทุกสถานี (50 renown = x2)
const PRESTIGE_MIN_GEMS_REWARD = 5;     // โบนัสเพชรก้อนเล็กตอน prestige (ให้รู้สึกคุ้มทุกรอบ ไม่ใช่แค่ตัวคูณ)

// ===== ร้านชื่อเสียง (Renown Shop) — อัปเกรดถาวรซื้อด้วย renown อยู่ข้ามทุก prestige =====
// เป็น meta-progression: renown ไม่ได้ให้แค่ตัวคูณ passive แต่เอาไปลงทุนต่อยอดได้ด้วย
// effectPerLevel = ค่าผลต่อเลเวล (ความหมายต่างกันตาม key ดูที่ formulas.js) | cost = baseCost * costGrowth^level
const RENOWN_UPGRADES = [
  { key: 'income',     icon: '💰', name: 'สายเลือดพ่อค้า', desc: 'รายได้ทุกสถานี +6% ต่อเลเวล',
    maxLevel: 25, baseCost: 3, costGrowth: 1.5, effectPerLevel: 0.06 },
  { key: 'craft',      icon: '⚡', name: 'มือเทวดา',       desc: 'เวลาคราฟต์ -2% ต่อเลเวล (ถาวร)',
    maxLevel: 20, baseCost: 4, costGrowth: 1.55, effectPerLevel: 0.02 },
  { key: 'startStaff', icon: '🧑‍🔧', name: 'ทีมประจำร้าน',   desc: 'เริ่มแต่ละรอบพร้อมลูกมือ +1 คนต่อเลเวล',
    maxLevel: 4,  baseCost: 8, costGrowth: 2.2,  effectPerLevel: 1 },
  { key: 'gemBonus',   icon: '💎', name: 'สายบุญเพชร',     desc: 'ได้เพชรจากภารกิจ/ดาว +10% ต่อเลเวล',
    maxLevel: 15, baseCost: 5, costGrowth: 1.6,  effectPerLevel: 0.10 },
];

// ===== หลายสถานีในด่านเดียว (Multi-Station แบบ Eatventure) =====
// แต่ละด่านมี 3 สถานี: สถานีหลัก (ปลดล็อกอยู่แล้ว ใช้ระบบเลเวลสินค้าเดิม) + สถานีเสริม 2 ตัว
// ปลดล็อกด้วย Gold แล้วอัปเลเวลแยกของใครของมัน สินค้าแพงขึ้นตาม revenueMult — จังหวะ "เก็บเงินก้อนปลดล็อกโต๊ะใหม่"
// แบบเกมต้นแบบ สถานีเสริมรีเซ็ตตอน Renovate (ร้านใหม่ เริ่มปลดล็อกใหม่) เหมือน upgradeLevels
// icon: null = ใช้ PRODUCT_TIERS ของด่าน (สถานีหลักเปลี่ยนหน้าตาสินค้าตามเลเวลเหมือนเดิม)
const STATION_SETS = {
  stall: [
    { name: 'ของชำ',    icon: null,                                      revenueMult: 1, unlockCostMult: 0 },
    { name: 'โล่ไม้',    icon: '../assets/blacksmith/shield_wood.png',    revenueMult: 2, unlockCostMult: 80 },
    { name: 'ดาบสำริด', icon: '../assets/blacksmith/sword_bronze.png',   revenueMult: 4, unlockCostMult: 400 },
  ],
  forge: [
    { name: 'ดาบเหล็ก', icon: null,                                      revenueMult: 1, unlockCostMult: 0 },
    { name: 'โล่นักรบ',  icon: '../assets/blacksmith/shield_wood.png',    revenueMult: 2, unlockCostMult: 80 },
    { name: 'ดาบอัศวิน', icon: '../assets/blacksmith/sword_blue.png',     revenueMult: 4, unlockCostMult: 400 },
  ],
  alchemy: [
    { name: 'ยาแดง',    icon: null,                                      revenueMult: 1, unlockCostMult: 0 },
    { name: 'ยาฟ้า',     icon: '../assets/blacksmith/potion_blue.png',    revenueMult: 2, unlockCostMult: 80 },
    { name: 'ถุงทองเวท', icon: '../assets/blacksmith/coin.png',           revenueMult: 4, unlockCostMult: 400 },
  ],
};
const STATION_STAR_REWARD_GEMS = 3; // รางวัลเพชรตอนเลเวลสถานี/อัปเกรดแตะดาว milestone (💎 ท้ายแถบในคลิป)

// ===== กองเหรียญหน้าเคาน์เตอร์ (แบบคลิป) =====
// ส่งของเสร็จเหรียญกองอยู่หน้าเคาน์เตอร์ แตะเก็บเองได้ทันที หรือปล่อยให้บินเข้ากระเป๋าเองหลังหน่วงสั้นๆ
// (worker ไม่ต้องเดินไปเก็บเหรียญอีกแล้ว — ตัดขา COLLECT ทิ้ง ทำให้รอบงานเร็วขึ้น ~1/3 ด้วย)
const COIN_AUTO_COLLECT_DELAY_MS = 900;

// ===== กล่องของขวัญปริศนา (Mystery Gift Box แบบ Eatventure) =====
const GIFTBOX_MIN_INTERVAL_MS = 75000;
const GIFTBOX_MAX_INTERVAL_MS = 130000;
const GIFTBOX_LINGER_MS = 12000; // อยู่บนจอนานเท่านี้ก่อนหายไปเองถ้าไม่แตะ

// ===== ออเดอร์หลายชิ้น (ตัวเลขในบับเบิลแบบคลิป) =====
// ลูกค้าบางคนสั่งมากกว่า 1 ชิ้น — บับเบิลโชว์ x2/x3 และจ่ายเงินคูณตามจำนวน (คราฟต์รอบเดียวได้ทั้งชุด)
const ORDER_QTY_2_CHANCE = 0.18;
const ORDER_QTY_3_CHANCE = 0.06;

// ===== Achievements (ความสำเร็จ) — เป้าหมายระยะยาว ให้รางวัลเพชร/ชื่อเสียงตอนกดรับ =====
// check() อ่านจากค่าที่ track อยู่แล้ว (stats/prestige) ไม่ต้องเพิ่ม counter ใหม่ | reward = {gems} หรือ {renown}
const ACHIEVEMENTS = [
  { key: 'serve50',    icon: '🍽️', name: 'พ่อค้ามือใหม่',   desc: 'เสิร์ฟลูกค้าครบ 50 คน',        reward: { gems: 5 },     goal: () => player.stats.totalCustomersServed, target: 50 },
  { key: 'serve1k',    icon: '🧑‍🍳', name: 'เจ้าของร้านตัวจริง', desc: 'เสิร์ฟลูกค้าครบ 1,000 คน',     reward: { gems: 20 },    goal: () => player.stats.totalCustomersServed, target: 1000 },
  { key: 'serve10k',   icon: '👑', name: 'ตำนานร้านค้า',    desc: 'เสิร์ฟลูกค้าครบ 10,000 คน',   reward: { gems: 60 },    goal: () => player.stats.totalCustomersServed, target: 10000 },
  { key: 'gold100k',   icon: '💰', name: 'เงินแสน',        desc: 'หาเงินรวม 100,000 Gold',      reward: { gems: 10 },    goal: () => player.stats.totalGoldEarned, target: 100000 },
  { key: 'gold10m',    icon: '💎', name: 'เศรษฐีพันล้าน',   desc: 'หาเงินรวม 10,000,000 Gold',   reward: { gems: 40 },    goal: () => player.stats.totalGoldEarned, target: 10000000 },
  { key: 'prestige1',  icon: '🏅', name: 'ชาติใหม่',        desc: 'เกิดใหม่ครั้งแรก',             reward: { gems: 15 },    goal: () => player.prestige.count, target: 1 },
  { key: 'prestige10', icon: '🌟', name: 'วนเวียนไม่รู้จบ',  desc: 'เกิดใหม่ครบ 10 ครั้ง',        reward: { renown: 10 },  goal: () => player.prestige.count, target: 10 },
  { key: 'renown100',  icon: '🎖️', name: 'ผู้มากบารมี',     desc: 'สะสมชื่อเสียงถึง 100 🏅',     reward: { gems: 50 },    goal: () => player.prestige.renown, target: 100 },
];

// ===== Daily Reward (รางวัลล็อกอินรายวัน) — เปิดเกมวันใหม่ได้เพชร ยิ่งต่อเนื่องยิ่งเยอะ (streak) =====
const DAILY_REWARDS = [3, 4, 5, 6, 8, 10, 15]; // เพชรของ streak วันที่ 1..7 (วันที่ 7+ วนกลับสูงสุด)

// ===== Tutorial (สอนเล่นครั้งแรก) — ป๊อปอัพต้อนรับอธิบาย core loop สั้นๆ =====
const TUTORIAL_STEPS = [
  { icon: '👋', title: 'ยินดีต้อนรับสู่ร้านตีเหล็ก!', body: 'ลูกค้าจะเดินเข้ามาสั่งของ พนักงานจะไปคราฟต์ที่สถานีแล้วนำมาส่ง ได้เงินเป็น Gold 🪙' },
  { icon: '⬆️', title: 'อัปเกรดร้าน', body: 'แตะปุ่ม ⬆️ ขวาล่างเพื่ออัปเกรด (เร็วขึ้น/ลูกค้าเยอะขึ้น/จ้างลูกมือ) และแตะโต๊ะสถานีเพื่ออัปคุณภาพสินค้า' },
  { icon: '🔨', title: 'ขยับขยาย (Renovate)', body: 'อัปคุณภาพสินค้าถึง Lv 15 แล้วกดปุ่ม 🔨 ซ้ายล่างเพื่อเปิดร้านใหม่ที่ใหญ่ขึ้น รายได้สูงขึ้น' },
  { icon: '🏅', title: 'เกิดใหม่ (Prestige)', body: 'เมื่อรวยพอ กด "เกิดใหม่" เริ่มร้านใหม่แลกชื่อเสียงที่เพิ่มรายได้ถาวร — เล่นได้ไม่รู้จบ!' },
];

// ===== Guided Objective Chain (เควสนำทาง 10 นาทีแรก) =====
// เป้าหมายแบบสคริปต์เรียงลำดับ ค้างบนจอทีละอัน จบแล้วเด้งรางวัล+เปิดอันถัดไปทันที — ลากมือผู้เล่นใหม่
// ผ่าน core loop ทีละสเต็ป (เสิร์ฟ→อัปสินค้า→อัปสปีด→จ้างลูกมือ→Renovate→Fever→...) เพื่อกันช่วง "แล้วไงต่อ?"
// ที่ทำให้คนเล่นครั้งแรกหลุดก่อนครบ 10 นาที | progress()/target อ่านจากค่าที่ track อยู่แล้ว (เหมือน ACHIEVEMENTS)
// ไม่ต้องเพิ่ม counter ใหม่ | focus = id ปุ่ม/องค์ประกอบที่จะเรืองแสงชี้นำ (null = ไม่ต้องชี้ที่ไหน)
const OBJECTIVE_CHAIN = [
  { key: 'serve3',     icon: '🍽️',  title: 'เสิร์ฟลูกค้า 3 คนแรก',         target: 3,                   progress: () => player.stats.totalCustomersServed, reward: { gems: 2 }, focus: null },
  { key: 'product5',   icon: '📈',  title: 'แตะสินค้า อัปคุณภาพถึง Lv 5',  target: 5,                   progress: () => player.upgradeLevels.portion,      reward: { gems: 2 }, focus: 'productBadge' },
  { key: 'speed5',     icon: '⚡',  title: 'กด ⬆️ อัปความเร็วถึง Lv 5',    target: 5,                   progress: () => player.upgradeLevels.speed,        reward: { gems: 2 }, focus: 'btnOpenUpgrades' },
  { key: 'hire1',      icon: '🧑‍🔧', title: 'จ้างลูกมือคนแรกมาช่วยงาน',      target: 1,                   progress: () => player.staffCount,                 reward: { gems: 3 }, focus: 'btnOpenUpgrades' },
  { key: 'productGate', icon: '🔨', title: 'อัปสินค้าถึง Lv ' + RENOVATE_GATE_LEVEL + ' เพื่อ Renovate', target: RENOVATE_GATE_LEVEL, progress: () => player.upgradeLevels.portion, reward: { gems: 3 }, focus: 'productBadge' },
  { key: 'renovate1',  icon: '🏪',  title: 'กด 🔨 Renovate เปิดร้านใหม่!',  target: 1,                   progress: () => player.stageIndex,                 reward: { gems: 5 }, focus: 'btnOpenRenovate' },
  { key: 'fever1',     icon: '🔥',  title: 'เต็มหลอดแล้วแตะเข้าสู่ Fever!', target: 1,                   progress: () => player.stats.feverCount,           reward: { gems: 3 }, focus: 'feverBarWrap' },
  { key: 'serve60',    icon: '📦',  title: 'เสิร์ฟลูกค้าครบ 60 คน',        target: 60,                  progress: () => player.stats.totalCustomersServed, reward: { gems: 4 }, focus: null },
  { key: 'renovate2',  icon: '👑',  title: 'Renovate อีกครั้งสู่ร้านที่ 3',  target: 2,                   progress: () => player.stageIndex,                 reward: { gems: 6 }, focus: 'btnOpenRenovate' },
];

// ===== แตะฉากช่วย "โหมไฟเตา" (Active-tap) — แตะพื้นที่ว่างในฉากตอนพนักงานกำลังคราฟต์ เร่ง craft ให้เร็วขึ้น =====
// ให้มี "อะไรให้ทำด้วยมือ" ในช่วงต้นก่อนเกมจะกลายเป็น idle เต็มตัว + สอนกลายๆ ว่าการมีส่วนร่วมมันคุ้ม
const STOKE_CRAFT_MS = 150;   // แตะ 1 ครั้ง = ดัน craftElapsed ของทุก worker ที่กำลังคราฟต์ไปข้างหน้าเท่านี้
const STOKE_SPARK_COUNT = 4;  // จำนวนประกายไฟที่กระเด็นออกจากจุดที่แตะ (ฟีดแบ็กภาพ)

// ===== Multi-Staff System =====
const MAX_STAFF_COUNT = 4; // จ้างลูกมือได้สูงสุด 4 คน (รวมผู้เล่นเอง = 5 คนพร้อมกันในร้าน)
// ลดจาก 200 -> 40: ลูกมือคนแรก (คนที่ปลดล็อก throughput เกือบ 2 เท่า) เคยแพงถึง ~1000 gold ในด่านแรก
// ทำให้ผู้เล่นใหม่ต้องฟาร์ม ~12 นาทีกว่าจะจ้างได้ (จาก sim: ทำเงิน ~1.3 gold/วินาที) — หลุดก่อนถึงจุดนั้น
// 40 = ลูกมือคนแรก ~200 gold (จ้างได้ใน ~2-3 นาที) จุดพลิกเกมที่ทำให้ snowball ต่อไปถึง Renovate ทันใน 10 นาที
// คนถัดๆ ไปยังแพงขึ้นตาม 1.8^n (คนที่ 2 ~360, 3 ~648, 4 ~1166) คงความรู้สึกลงทุนของ mid-game ไว้
const HIRE_HELPER_BASE_COST_MULT = 40;
const HIRE_HELPER_COST_GROWTH = 1.8; // ต่อจำนวนลูกมือที่มีอยู่แล้ว

// ===== Offline Vault — อัปเกรดถาวรแยกต่างหาก ขยายเพดานเวลารายได้ตอนออฟไลน์ =====
const OFFLINE_MAX_HOURS_BASE = 8;
const OFFLINE_VAULT_HOURS_PER_LEVEL = 1;
const MAX_VAULT_LEVEL = 16; // 8 + 16 = 24 ชม. เต็มเพดาน 1 วันพอดี
const VAULT_BASE_COST = 300;
const VAULT_COST_GROWTH = 1.4;
const OFFLINE_EFFICIENCY = 0.5; // รายได้ตอนไม่อยู่หน้าจอ = ครึ่งหนึ่งของอัตราปกติ (มาตรฐานเกม idle ทั่วไป)

// ===== VIP Customers =====
const VIP_CHANCE = 0.05; // 5% ของลูกค้าที่เกิดใหม่
const VIP_REVENUE_MULT = 10; // จ่าย 10 เท่าของราคาปกติ
const VIP_TIP_RATIO = 1.0;   // ทิปการันตี 100% ของยอดออเดอร์ (รวมแล้วได้ 20 เท่าของปกติ)
const VIP_WALK_SPEED_MULT = 1.5; // เดินไวกว่าลูกค้าทั่วไป

// ===== Fever Mode / Rush Hour =====
const FEVER_FILL_PER_ORDER = 0.15; // ต่อการส่งออเดอร์สำเร็จ 1 ครั้ง (~7 ออเดอร์เต็มหลอด)
const FEVER_DURATION_MS = 15000;
const FEVER_SPEED_MULT = 2;
const FEVER_CRAFT_MS = 1; // ใกล้เคียง 0 วินาทีที่สุดโดยไม่หารด้วยศูนย์ตอนคิด progress bar

// ===== Golden Goblin =====
const GOBLIN_MIN_INTERVAL_MS = 120000; // 2 นาที
const GOBLIN_MAX_INTERVAL_MS = 180000; // 3 นาที
const GOBLIN_CROSS_MS = 2600; // เวลาที่โกบลินวิ่งข้ามจอ

// ===== Materials / Stock Flow — วัตถุดิบที่ต้องเบิกจากคลังก่อนคราฟต์ได้ (ดู entities/materials.js) =====
// ไม่มี sprite ภาพกองวัตถุดิบให้ (เช็ค games/assets/blacksmith/ แล้วไม่มี) เลยใช้อิโมจิแทน sprite ใหม่
// ตามแพทเทิร์นเดียวกับ Golden Goblin ที่ทำไว้ก่อนหน้า
const MATERIALS = [
  { key: 'ore',  name: 'แร่เหล็ก', icon: '🪨' },
  { key: 'coal', name: 'ถ่านหิน',  icon: '⚫' },
  { key: 'herb', name: 'สมุนไพร',  icon: '🌿' },
];
const MATERIAL_CAPACITY = 20;
// อัตราเติมคลัง "ต่อ worker 1 คน" (ดู entities/materials.js's tickMaterialRegen ที่คูณด้วย getWorkerCount())
// เดิมเป็นค่าคงที่ไม่ผูกกับจำนวน worker เลย -- ทดสอบตอนทำฟีเจอร์นี้ครั้งแรกใช้แค่ worker เดียว เลยไม่เจอปัญหา
// แต่พอเทียบกับ Multi-Staff (สูงสุด 5 คน) + อัปเกรดความเร็วเต็มเลเวล คำนวณแล้วโรงตีดาบต้องการวัตถุดิบสูงสุด
// ~5.88/วินาที ในขณะที่คลังเติมแค่ 0.5/วินาทีคงที่ -- ช้ากว่ากันเกิน 11 เท่า ทำให้ worker ติดสถานะ
// WAITING_FOR_STOCK เกือบตลอดเวลาช่วงปลายเกม จนอัปเกรด speed/signage/จ้างลูกมือที่ลงทุนไปแทบไม่มีผลจริง
// ปรับให้ scale ตามจำนวน worker (แต่ยังตั้งใจให้ไม่พอ 100% ที่ระดับสูงสุด เพื่อให้ระบบนี้ยังมีความหมายอยู่บ้าง)
const MATERIAL_REGEN_PER_SEC = 0.9;

// ===== Order Missions — ภารกิจสะสมจำนวนออเดอร์ที่ "เสิร์ฟสำเร็จ" (นับตั้งแต่ภารกิจก่อนหน้าจบ ไม่ใช่สะสมทั้งเกม)
// ให้รางวัลเป็นเพชร ใช้สูตร growth แบบเดียวกับที่ใช้ทั่วทั้งเกม (cost/milestone) แทนการลิสต์ค่าคงที่ตายตัว =====
const ORDER_MISSION_BASE_TARGET = 8;      // ภารกิจแรกต้องเสิร์ฟ 8 ออเดอร์
const ORDER_MISSION_TARGET_GROWTH = 1.28; // แต่ละภารกิจถัดไปต้องเสิร์ฟมากขึ้น (ลดจาก 1.35 ให้เพชรไหลเร็วขึ้น)
const ORDER_MISSION_BASE_REWARD = 3;      // เพชรรางวัลภารกิจแรก
const ORDER_MISSION_REWARD_GROWTH = 1.15;

// ด่านสุดท้าย (alchemy) เต็มขั้นแล้วไม่มี "ด่านถัดไป" ให้ขยับไป แต่ stage-complete-modal.js เขียนไว้ว่า
// "กดเพื่อรับรางวัลปิดท้าย" -- เดิม advanceStage() แค่โชว์ gameCompleteModal เฉยๆ ไม่ได้ให้รางวัลจริงตามที่พูดไว้
// เลยเพิ่มเพชรก้อนใหญ่ให้จริงตอนจบเกม (คิดเป็น ~16 ครั้งสุ่มบัพ ให้รู้สึกคุ้มค่าที่เล่นจบ)
const FINAL_STAGE_REWARD_GEMS = 50;

// ===== Equipment (อุปกรณ์สวมใส่ถาวร) — แทนที่ระบบสุ่มบัพชั่วคราวเดิม =====
// ตัวละครมี 3 ช่องสวมใส่ แต่ละช่องอัปเกรดเป็น tier ที่สูงขึ้นด้วยเพชร (ถาวร ไม่หมดเวลา เก็บใน save)
// tier 0 = ช่องว่าง (ไม่มีโบนัส), tier 1-4 = common/rare/epic/legendary ให้ effect มากขึ้นเรื่อยๆ
// effect ของแต่ละช่องความหมายต่างกัน (ดู getEquip*Mult ใน formulas.js): tool=ลดเวลาคราฟต์,
// outfit=เงินต่อออเดอร์+%, charm=โอกาสทิป(+absolute)+ตัวคูณโอกาส VIP
const EQUIPMENT_RARITIES = ['empty', 'common', 'rare', 'epic', 'legendary']; // index = tier
const EQUIP_UPGRADE_BASE_GEMS = 6;      // ราคาอัปจาก tier0->1 (เพชร)
const EQUIP_UPGRADE_COST_GROWTH = 2.3;  // แต่ละ tier ถัดไปแพงขึ้น (6, 14, 32, 73)
const EQUIPMENT_SLOTS = [
  { key: 'tool', icon: '🔨', name: 'เครื่องมือช่าง', effectLabel: 'ลดเวลาคราฟต์', unit: 'pct',
    tiers: [
      { name: 'มือเปล่า',   effect: 0 },
      { name: 'ค้อนไม้',    effect: 0.06 },
      { name: 'ค้อนเหล็ก',  effect: 0.12 },
      { name: 'ค้อนรูน',    effect: 0.20 },
      { name: 'ค้อนมังกร',  effect: 0.30 },
    ] },
  { key: 'outfit', icon: '🦺', name: 'ชุดช่าง', effectLabel: 'เงินต่อออเดอร์', unit: 'pct',
    tiers: [
      { name: 'เสื้อเก่า',    effect: 0 },
      { name: 'ผ้ากันเปื้อน', effect: 0.08 },
      { name: 'ชุดหนัง',      effect: 0.18 },
      { name: 'ชุดเกราะเบา',  effect: 0.30 },
      { name: 'ชุดตำนาน',     effect: 0.50 },
    ] },
  { key: 'charm', icon: '🧿', name: 'เครื่องราง', effectLabel: 'โอกาสทิป + ลูกค้า VIP', unit: 'charm',
    tiers: [
      { name: 'ไม่มี',       effect: 0 },
      { name: 'ปิ่นทองแดง',  effect: 0.05 },
      { name: 'หยกนำโชค',    effect: 0.12 },
      { name: 'ดวงตาเวท',    effect: 0.22 },
      { name: 'ดาวนำทาง',    effect: 0.35 },
    ] },
];

// ===== ผลทันทีของกล่องของขวัญ (Mystery Gift Box) — ผลครั้งเดียวจบ ไม่ใช่บัพติดตัว (ดู features/giftbox.js) =====
// แยกออกจากระบบ Equipment ชัดเจน: อันนี้คือ "เซอร์ไพรส์ครั้งเดียว" ที่กล่องสุ่มแจก ไม่เกี่ยวกับของสวมใส่
const INSTANT_EFFECTS = {
  instant_restock: { icon: '📦', name: 'เติมเต็มคลัง',
    apply() { MATERIALS.forEach(m => { player.inventory[m.key].stock = player.inventory[m.key].capacity; }); } },
  fever_now: { icon: '🌟', name: 'ฟีเวอร์ทันใจ',
    apply() { feverState.progress = 1; GameEvents.emit(EVENTS.FEVER_PROGRESS, { progress: 1 }); } },
  goblin_now: { icon: '👺', name: 'เรียกโกบลิน',
    apply() { if (goblinTimerId) clearTimeout(goblinTimerId); spawnGoblin(); } },
  gold_burst: { icon: '💎', name: 'กระเป๋าตุง',
    apply() { const r = Math.max(20, Math.round(estimateIncomePerMinute() * 0.5)); player.gold += r; player.stats.totalGoldEarned += r; GameEvents.emit(EVENTS.COIN_COLLECTED, { amount: r }); } },
};

const SAVE_KEY = 'blacksmithTycoonSave_v6';
const SAVE_KEY_V5 = 'blacksmithTycoonSave_v5'; // เก็บไว้เป็นแหล่งข้อมูล migrate เท่านั้น ไม่เขียนทับอีก
const SAVE_KEY_V4 = 'blacksmithTycoonSave_v4'; // เก็บไว้เป็นแหล่งข้อมูล migrate เท่านั้น ไม่เขียนทับอีก
const SAVE_KEY_V3 = 'blacksmithTycoonSave_v3'; // เก็บไว้เป็นแหล่งข้อมูล migrate เท่านั้น ไม่เขียนทับอีก
const SAVE_KEY_V2 = 'blacksmithTycoonSave_v2'; // เก็บไว้เป็นแหล่งข้อมูล migrate เท่านั้น ไม่เขียนทับอีก
const SAVE_KEY_V1 = 'blacksmithTycoonSave_v1'; // เก็บไว้เป็นแหล่งข้อมูล migrate เท่านั้น ไม่เขียนทับอีก

