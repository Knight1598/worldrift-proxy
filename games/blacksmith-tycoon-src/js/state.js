/* =====================================================================
   Player State
   ===================================================================== */
let player = {
  gold: 0,
  stageIndex: 0,
  upgradeLevels: { speed: 0, portion: 0, signage: 0, decor: 0 },
  staffCount: 0,     // แทนที่ staffHired (bool) เดิม — จำนวนลูกมือที่จ้างแล้ว (0..MAX_STAFF_COUNT)
  vaultLevel: 0,     // อัปเกรดถาวร "คลังเก็บของตอนออฟไลน์" ไม่ถูกรีเซ็ตตอนขึ้นด่านใหม่
  milestonesShown: {}, // { speed: [10, 25], signage: [10], ... } กันป๊อปอัพ Milestone เด้งซ้ำตอนโหลดเซฟ
  lastSeenAt: Date.now(),
  settings: { soundEnabled: true },
  stats: { totalCustomersServed: 0, totalGoldEarned: 0 },
};

// Fever Mode เป็น session state ล้วนๆ (ไม่ persist ผ่าน save — รีเซ็ตทุกครั้งที่โหลดหน้าใหม่ เหมือน workers/customers/coins)
let feverState = { progress: 0, active: false, endsAt: 0 };

let audioCtx = null;

/* =====================================================================
   Save / Load — SAVE_KEY เป็น v2 (staffCount/vaultLevel/milestonesShown ใหม่)
   ถ้าไม่เจอเซฟ v2 จะลองดึงเซฟ v1 เดิม (staffHired) มาแปลงให้อัตโนมัติ (Migration) กันผู้เล่นเก่าความคืบหน้าหาย
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
    lastSeenAt: Date.now(),
    settings: player.settings,
    stats: player.stats,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* localStorage อาจไม่พร้อมใช้งาน */ }
}

// แปลงเซฟรูปแบบเก่า (v1: staffHired เป็น true/false) ให้เป็นรูปแบบ v2 (staffCount เป็นตัวเลข) — เรียกเฉพาะตอน
// หาเซฟ v2 ไม่เจอเท่านั้น ฟิลด์ใหม่ที่ v1 ไม่มี (vaultLevel/milestonesShown) ใส่ค่าเริ่มต้นให้ครบ
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

function loadGame() {
  let raw;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch (e) { data = null; /* เซฟ v2 เสีย ลอง fallback ไป v1 ต่อ */ }
  }
  let migratedFromV1 = false;
  if (!data) {
    let rawV1;
    try { rawV1 = localStorage.getItem(SAVE_KEY_V1); } catch (e) { rawV1 = null; }
    if (rawV1) {
      try { data = migrateFromV1(rawV1); migratedFromV1 = true; } catch (e) { data = null; }
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
    lastSeenAt: data.lastSeenAt || Date.now(),
    settings: Object.assign({ soundEnabled: true }, data.settings || {}),
    stats: Object.assign({ totalCustomersServed: 0, totalGoldEarned: 0 }, data.stats || {}),
  });
  if (migratedFromV1) {
    saveGame(); // เขียนเป็น v2 ทันทีหลัง migrate สำเร็จ
    try { localStorage.removeItem(SAVE_KEY_V1); } catch (e) { /* ไม่เป็นไรถ้าลบไม่ได้ */ }
  }
}
