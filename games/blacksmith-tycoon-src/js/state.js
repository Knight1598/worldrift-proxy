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
// สถานีเสริม 2 ตัวของด่านปัจจุบัน (Multi-Station) — รีเซ็ตตอน Renovate เหมือน upgradeLevels
// (สถานีหลักใช้ player.upgradeLevels.portion เป็นเลเวลอยู่แล้ว ไม่ต้องเก็บเพิ่ม)
function defaultStationsExtra() {
  return { s1: { unlocked: false, level: 0 }, s2: { unlocked: false, level: 0 } };
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
  gems: 0,             // เพชร ได้จาก Order Missions ใช้สุ่มบัพ (ดู systems/missions.js, systems/buffs.js)
  missionIndex: 0,     // ภารกิจลำดับที่กำลังทำอยู่ (ยิ่งสูงยิ่งต้องเสิร์ฟออเดอร์เยอะขึ้น)
  missionProgress: 0,  // จำนวนออเดอร์ที่เสิร์ฟแล้วนับตั้งแต่ภารกิจก่อนหน้าจบ (ไม่ใช่สะสมทั้งเกม)
  stationsExtra: defaultStationsExtra(), // สถานีเสริมของด่านปัจจุบัน (Multi-Station ดู ui/stations.js)
  lastSeenAt: Date.now(),
  settings: { soundEnabled: true },
  stats: { totalCustomersServed: 0, totalGoldEarned: 0 },
};

// Fever Mode เป็น session state ล้วนๆ (ไม่ persist ผ่าน save — รีเซ็ตทุกครั้งที่โหลดหน้าใหม่ เหมือน workers/customers/coins)
let feverState = { progress: 0, active: false, endsAt: 0 };

// Active Buff ก็เป็น session state ล้วนๆ เหมือนกัน (ตั้งใจไม่ persist — สุ่มใหม่ได้ทุกครั้งที่เข้าเกม ไม่ต้องมี
// กรณี edge-case บัพค้างข้ามเซสชันให้ดูแล)
let activeBuff = null; // null หรือ { key, endsAt } (ดู systems/buffs.js)

let audioCtx = null;

/* =====================================================================
   Save / Load — SAVE_KEY เป็น v4 (gems/missionIndex/missionProgress ใหม่ สำหรับ Order Missions + Buff Roll)
   chain การ migrate: v4 (ตรงๆ) -> v3 (ตรงๆ + เติม default v4) -> v2 (ตรงๆ + เติม default v3 แล้วต่อ v4)
   -> v1 (แปลงเป็น v2 ก่อน แล้วเติม default v3 ต่อด้วย v4) กันผู้เล่นเก่าทุกรุ่นความคืบหน้าไม่หาย
   worker/customer/coin/feverState/activeBuff เป็น transient state ล้วนๆ ไม่ persist เหมือนเดิม
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
    gems: player.gems,
    missionIndex: player.missionIndex,
    missionProgress: player.missionProgress,
    stationsExtra: player.stationsExtra,
    lastSeenAt: Date.now(),
    settings: player.settings,
    stats: player.stats,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* localStorage อาจไม่พร้อมใช้งาน */ }
}

// แปลงเซฟรูปแบบเก่า (v1: staffHired เป็น true/false) ให้เป็นรูปแบบ v2 (staffCount เป็นตัวเลข) — เรียกเฉพาะตอน
// หาเซฟ v2/v3/v4 ไม่เจอเท่านั้น ฟิลด์ใหม่ที่ v1 ไม่มี (vaultLevel/milestonesShown) ใส่ค่าเริ่มต้นให้ครบ
// (ฟิลด์ใหม่ของ v3/v4 ยังไม่ต้องเติมตรงนี้ -- fillV3Defaults/fillV4Defaults ด้านล่างจะเติมให้อีกทีไม่ว่าจะมาจาก v1 หรือ v2)
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

// เติมฟิลด์ใหม่ของ v4 (gems/missionIndex/missionProgress) ให้ข้อมูลที่เป็นทรง v3 อยู่แล้ว ไม่ว่าจะมาจาก key v3
// ตรงๆ หรือเพิ่ง fillV3Defaults() มา (จาก v2/v1)
function fillV4Defaults(v3Data) {
  return Object.assign({}, v3Data, {
    gems: 0,
    missionIndex: 0,
    missionProgress: 0,
  });
}

// เติมฟิลด์ใหม่ของ v5 (stationsExtra — Multi-Station) ให้ข้อมูลทรง v4
function fillV5Defaults(v4Data) {
  return Object.assign({}, v4Data, {
    stationsExtra: defaultStationsExtra(),
  });
}

function loadGame() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch (e) { data = null; /* เซฟ v5 เสีย ลอง fallback ลงไปต่อ */ }
  }
  let needsResave = false;
  const keysToClean = [];
  if (!data) {
    // ไม่เจอ v5 -- ไล่ fallback ทีละรุ่น v4 -> v3 -> v2 -> v1 (แต่ละชั้นเติม default ของรุ่นถัดขึ้นมา)
    let v4Data = null;
    let rawV4;
    try { rawV4 = localStorage.getItem(SAVE_KEY_V4); } catch (e) { rawV4 = null; }
    if (rawV4) {
      try { v4Data = JSON.parse(rawV4); keysToClean.push(SAVE_KEY_V4); } catch (e) { v4Data = null; }
    }
    if (!v4Data) {
      let rawV3;
      try { rawV3 = localStorage.getItem(SAVE_KEY_V3); } catch (e) { rawV3 = null; }
      let v3Data = null;
      if (rawV3) {
        try { v3Data = JSON.parse(rawV3); keysToClean.push(SAVE_KEY_V3); } catch (e) { v3Data = null; }
      }
      if (!v3Data) {
        // ไม่เจอ v3 -- ลอง v2 ตรงๆ แล้วเติม default ของ v3 ก่อน
        let rawV2;
        try { rawV2 = localStorage.getItem(SAVE_KEY_V2); } catch (e) { rawV2 = null; }
        let v2Data = null;
        if (rawV2) {
          try { v2Data = JSON.parse(rawV2); keysToClean.push(SAVE_KEY_V2); } catch (e) { v2Data = null; }
        }
        if (!v2Data) {
          // ไม่เจอ v2 เหมือนกัน -- ลอง v1 แล้วแปลงเป็นทรง v2 ก่อน (migrateFromV1 เดิม)
          let rawV1;
          try { rawV1 = localStorage.getItem(SAVE_KEY_V1); } catch (e) { rawV1 = null; }
          if (rawV1) {
            try { v2Data = migrateFromV1(rawV1); keysToClean.push(SAVE_KEY_V1); } catch (e) { v2Data = null; }
          }
        }
        if (v2Data) v3Data = fillV3Defaults(v2Data);
      }
      if (v3Data) v4Data = fillV4Defaults(v3Data);
    }
    if (v4Data) {
      data = fillV5Defaults(v4Data);
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
    gems: Math.max(0, data.gems || 0),
    missionIndex: Math.max(0, data.missionIndex || 0),
    missionProgress: Math.max(0, data.missionProgress || 0),
    stationsExtra: Object.assign(defaultStationsExtra(), data.stationsExtra || {}),
    lastSeenAt: data.lastSeenAt || Date.now(),
    settings: Object.assign({ soundEnabled: true }, data.settings || {}),
    stats: Object.assign({ totalCustomersServed: 0, totalGoldEarned: 0 }, data.stats || {}),
  });
  if (needsResave) {
    saveGame(); // เขียนเป็น v4 ทันทีหลัง migrate สำเร็จ
    keysToClean.forEach(key => { try { localStorage.removeItem(key); } catch (e) { /* ไม่เป็นไรถ้าลบไม่ได้ */ } });
  }
}
