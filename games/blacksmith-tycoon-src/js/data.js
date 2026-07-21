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
  { key: 'speed',   name: 'ความเร็วในการทำงาน', icon: '⚡', desc: 'พนักงานเดินไวขึ้นและทำของเสร็จเร็วขึ้น', maxLevel: 50, baseCostMult: 8  },
  // "คุณภาพสินค้า" ไม่โชว์ในลิสต์ทั่วไป — ย้ายไปเป็นป๊อปอัพแยกที่แตะตัวสินค้าโดยตรงแทน (ตามแพทเทิร์นเกมต้นแบบ
  // ที่ผู้ใช้ส่งวิดีโอมา ซึ่งแยก "อัปเกรดร้านทั่วไป" กับ "เลเวลอัปสินค้า" ออกจากกันเป็นคนละกลไก)
  { key: 'portion', name: 'คุณภาพสินค้า',     icon: '📈', desc: 'ได้เงินต่อออเดอร์มากขึ้น (และของที่ขายอัปเกรดหน้าตาด้วย)', maxLevel: 50, baseCostMult: 10, hiddenFromList: true },
  { key: 'signage', name: 'ป้ายร้าน',         icon: '📣', desc: 'ลูกค้ามาบ่อยขึ้น และรับคิวรอได้มากขึ้น',  maxLevel: 50, baseCostMult: 12 },
  { key: 'decor',   name: 'ตกแต่งร้าน',        icon: '✨', desc: 'ลูกค้ามีโอกาสให้ทิป',     maxLevel: 50, baseCostMult: 14 },
];

// Deep Progression: maxLevel ขยายจาก 5 -> 50 ทุกอัปเกรด เลยต้องลดความชันของ cost growth ลงมาก
// (เดิม 1.6 ต่อเลเวล กับแค่ 5 เลเวล, ตอนนี้ 1.13 ต่อเลเวล กับ 50 เลเวล ให้ราคาค่อยๆ ไต่ขึ้นแบบนุ่มนวล
// กดซื้อได้บ่อยตลอดเกม ไม่ใช่กระโดดแพงทีละก้อนใหญ่เหมือนเดิม)
const UPGRADE_COST_GROWTH = 1.13;
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
const BASE_CRAFT_MS = 3200;
const MIN_CRAFT_MS = 900;
const SPEED_CRAFT_MS_REDUCTION = 46; // ต่อเลเวล (50 เลเวลไม่มี milestone พอดีแตะพื้น MIN_CRAFT_MS)
const BASE_MOVE_SPEED_PX = 90;   // px/วินาที
const SPEED_MOVE_BONUS_PX = 4;   // px/วินาที ต่อเลเวล
const MAX_MOVE_SPEED_PX = 400;   // เพดานกันความเร็วพุ่งเกินจริงตอนรวม Milestone x8 เข้าไปด้วย

// อัตราการเกิดลูกค้า + ความจุคิว — ควบคุมโดยอัปเกรด "ป้ายร้าน"
const BASE_SPAWN_INTERVAL_MS = 3400;
const MIN_SPAWN_INTERVAL_MS = 1100;
const SIGNAGE_SPAWN_MS_REDUCTION = 46; // ต่อเลเวล
const BASE_MAX_QUEUE = 3;
const SIGNAGE_QUEUE_BONUS = 0.2; // ต่อเลเวล (ปัดเศษตอนคำนวณ)
const MAX_QUEUE_SIZE = 20; // เพดานกันคิวยาวจนล้นจอ

const CUSTOMER_WALK_SPEED_PX = 70; // ความเร็วเดินของลูกค้า คงที่ ไม่ผูกกับอัปเกรด (สเปกระบุให้อัปเกรดความเร็วมีผลแค่ผู้เล่น/พนักงาน)
const PATIENCE_DURATION_MS = 9000; // หลอดความอดทนเชิงภาพล้วนๆ ไม่มีผลลงโทษถ้าหมด (ไม่ได้ระบุ fail-state ไว้ในสเปก)
const APPROX_ORDER_TRAVEL_PX = 320; // ระยะทางเดินโดยประมาณต่อ 1 ออเดอร์ (ไป station + ไปส่งที่คิว + ไปเก็บเหรียญ) ใช้คำนวณ throughput แบบไม่พึ่ง DOM เพื่อให้ deterministic

// ===== Multi-Staff System =====
const MAX_STAFF_COUNT = 4; // จ้างลูกมือได้สูงสุด 4 คน (รวมผู้เล่นเอง = 5 คนพร้อมกันในร้าน)
const HIRE_HELPER_BASE_COST_MULT = 200;
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
const MATERIAL_REGEN_PER_SEC = 0.5; // เติมคลังอัตโนมัติแบบพาสซีฟ ไม่ต้องมีปุ่มซื้อเพิ่มในสโคปนี้

const SAVE_KEY = 'blacksmithTycoonSave_v3';
const SAVE_KEY_V2 = 'blacksmithTycoonSave_v2'; // เก็บไว้เป็นแหล่งข้อมูล migrate เท่านั้น ไม่เขียนทับอีก
const SAVE_KEY_V1 = 'blacksmithTycoonSave_v1'; // เก็บไว้เป็นแหล่งข้อมูล migrate เท่านั้น ไม่เขียนทับอีก

