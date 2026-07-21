/* =====================================================================
   Player State
   ===================================================================== */
// สร้างจาก MATERIALS (data.js) แทนที่จะ hardcode คีย์ซ้ำสองที่ — เพิ่มวัตถุดิบชนิดใหม่ในอนาคต
// แค่แก้ MATERIALS แล้ว default inventory ตามมาเองอัตโนมัติ
function defaultInventory() {
  const inv = {};
  MATERIALS.forEach(m => { inv[m.key] = { stock: MATERIAL_CAPACITY, capacity: MATERIAL_CAPACITY }; });
  return inv;
}
function defaultIdentity() {
  return { playerId: null, displayName: null }; // เตรียมไว้สำหรับ Leaderboard (ดู systems/leaderboard.js)
}

let player = {
  gold: 0,
  stageIndex: 0,
  upgradeLevels: { speed: 0, portion: 0, signage: 0, decor: 0 },
  staffCount: 0,     // แทนที่ staffHired (bool) เดิม — จำนวนลูกมือที่จ้างแล้ว (0..MAX_STAFF_COUNT)
  vaultLevel: 0,     // อัปเกรดถาวร "คลังเก็บของตอนออฟไลน์" ไม่ถูกรีเซ็ตตอนขึ้นด่านใหม่
  milestonesShown: {}, // { speed: [10, 25], signage: [10], ... } กันป๊อปอัพ Milestone เด้งซ้ำตอนโหลดเซฟ
  inventory: defaultInventory(), // วัตถุดิบที่ต้องเบิกก่อนคราฟต์ (ดู entities/materials.js)
  identity: defaultIdentity(),
  lastSeenAt: Date.now(),
  settings: { soundEnabled: true },
  stats: { totalCustomersServed: 0, totalGoldEarned: 0 },
};

// Fever Mode เป็น session state ล้วนๆ (ไม่ persist ผ่าน save — รีเซ็ตทุกครั้งที่โหลดหน้าใหม่ เหมือน workers/customers/coins)
let feverState = { progress: 0, active: false, endsAt: 0 };

let audioCtx = null;

/* =====================================================================
   Save / Load — SAVE_KEY เป็น v3 (inventory/identity ใหม่ สำหรับ Materials + Leaderboard)
   chain การ migrate: v3 (ตรงๆ) -> v2 (ตรงๆ + เติม default ของ v3) -> v1 (แปลงเป็น v2 ก่อน แล้วเติม default
   ของ v3 อีกที) กันผู้เล่นเก่าทุกรุ่นความคืบหน้าไม่หาย
   worker/customer/coin/feverState เป็น transient state ล้วนๆ ไม่ persist เหมือนเดิม
   ===================================================================== */
function saveGame() {
  const data = {
    gold: player.gold,
    stageIndex: player.stageIndex,
    upgradeLevels: player.upgradeLevels,
    staffCount: player.staffCount,
    vaultLevel: player.vaultLevel,
    milestonesShown: player.milestonesShown,
    inventory: player.inventory,
    identity: player.identity,
    lastSeenAt: Date.now(),
    settings: player.settings,
    stats: player.stats,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* localStorage อาจไม่พร้อมใช้งาน */ }
}

// แปลงเซฟรูปแบบเก่า (v1: staffHired เป็น true/false) ให้เป็นรูปแบบ v2 (staffCount เป็นตัวเลข) — เรียกเฉพาะตอน
// หาเซฟ v2/v3 ไม่เจอเท่านั้น ฟิลด์ใหม่ที่ v1 ไม่มี (vaultLevel/milestonesShown) ใส่ค่าเริ่มต้นให้ครบ
// (inventory/identity ของ v3 ยังไม่ต้องเติมตรงนี้ -- fillV3Defaults ด้านล่างจะเติมให้อีกทีไม่ว่าจะมาจาก v1 หรือ v2)
function migrateFromV1(rawV1) {
  const data = JSON.parse(rawV1);
  return {
    gold: data.gold || 0,
    stageIndex: data.stageIndex || 0,
    upgradeLevels: Object.assign({ speed: 0, portion: 0, signage: 0, decor: 0 }, data.upgradeLevels || {}),
    staffCount: data.staffHired ? 1 : 0,
    vaultLevel: 0,
    milestonesShown: {},
    lastSeenAt: data.lastSeenAt || Date.now(),
    settings: Object.assign({ soundEnabled: true }, data.settings || {}),
    stats: Object.assign({ totalCustomersServed: 0, totalGoldEarned: 0 }, data.stats || {}),
  };
}

// เติมฟิลด์ใหม่ของ v3 (inventory/identity) ให้ข้อมูลที่เป็นทรง v2 อยู่แล้ว ไม่ว่าจะมาจาก key v2 ตรงๆ
// หรือเพิ่ง migrateFromV1() มา — รวมจุดเติม default ไว้ที่เดียวกันทั้งสองเส้นทาง
function fillV3Defaults(v2Data) {
  return Object.assign({}, v2Data, {
    inventory: defaultInventory(),
    identity: defaultIdentity(),
  });
}

function loadGame() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch (e) { data = null; /* เซฟ v3 เสีย ลอง fallback ลงไปต่อ */ }
  }
  let needsResave = false;
  const keysToClean = [];
  if (!data) {
    let rawV2;
    try { rawV2 = localStorage.getItem(SAVE_KEY_V2); } catch (e) { rawV2 = null; }
    let v2Data = null;
    if (rawV2) {
      try { v2Data = JSON.parse(rawV2); keysToClean.push(SAVE_KEY_V2); } catch (e) { v2Data = null; }
    }
    if (!v2Data) {
      let rawV1;
      try { rawV1 = localStorage.getItem(SAVE_KEY_V1); } catch (e) { rawV1 = null; }
      if (rawV1) {
        try { v2Data = migrateFromV1(rawV1); keysToClean.push(SAVE_KEY_V1); } catch (e) { v2Data = null; }
      }
    }
    if (v2Data) {
      data = fillV3Defaults(v2Data);
      needsResave = true;
    }
  }
  if (!data) return;
  Object.assign(player, {
    gold: data.gold || 0,
    stageIndex: data.stageIndex || 0,
    upgradeLevels: Object.assign({ speed: 0, portion: 0, signage: 0, decor: 0 }, data.upgradeLevels || {}),
    staffCount: Math.max(0, Math.min(MAX_STAFF_COUNT, data.staffCount || 0)),
    vaultLevel: Math.max(0, Math.min(MAX_VAULT_LEVEL, data.vaultLevel || 0)),
    milestonesShown: data.milestonesShown || {},
    inventory: data.inventory || defaultInventory(),
    identity: Object.assign(defaultIdentity(), data.identity || {}),
    lastSeenAt: data.lastSeenAt || Date.now(),
    settings: Object.assign({ soundEnabled: true }, data.settings || {}),
    stats: Object.assign({ totalCustomersServed: 0, totalGoldEarned: 0 }, data.stats || {}),
  });
  if (needsResave) {
    saveGame(); // เขียนเป็น v3 ทันทีหลัง migrate สำเร็จ
    keysToClean.forEach(key => { try { localStorage.removeItem(key); } catch (e) { /* ไม่เป็นไรถ้าลบไม่ได้ */ } });
  }
}
