/* =====================================================================
   Equipment (อุปกรณ์สวมใส่ถาวร) — แทนที่ระบบสุ่มบัพชั่วคราวเดิม (ดู EQUIPMENT_SLOTS ใน data.js)
   แต่ละช่องสวมใส่มี tier ปัจจุบัน (player.equipment[slot], 0 = ว่าง) อัปเป็น tier สูงขึ้นด้วยเพชร
   โบนัสถาวร ไม่หมดเวลา เก็บใน save — ตรรกะ/รางวัลอยู่ที่นี่ ส่วน UI อยู่ที่ ui/equipment-panel.js
   applyInstantEffect() = ผลครั้งเดียวของกล่องของขวัญ (ดู INSTANT_EFFECTS ใน data.js) แยกคนละเรื่องกับของสวมใส่
   ===================================================================== */
function getEquipSlotDef(slotKey) { return EQUIPMENT_SLOTS.find(s => s.key === slotKey); }
function getEquipTier(slotKey) { return player.equipment[slotKey] || 0; }
function getEquipMaxTier(slotKey) { return getEquipSlotDef(slotKey).tiers.length - 1; }
function getEquipTierDef(slotKey) { return getEquipSlotDef(slotKey).tiers[getEquipTier(slotKey)]; }
function getEquipCurrentEffect(slotKey) { return getEquipTierDef(slotKey).effect; }
function getEquipRarity(slotKey) { return EQUIPMENT_RARITIES[getEquipTier(slotKey)]; }
function isEquipMaxed(slotKey) { return getEquipTier(slotKey) >= getEquipMaxTier(slotKey); }

// ราคาอัป tier ถัดไป (เพชร) — โตแบบ base * growth^tier ปัจจุบัน | maxed แล้วคืน Infinity
function getEquipUpgradeCost(slotKey) {
  if (isEquipMaxed(slotKey)) return Infinity;
  return Math.ceil(EQUIP_UPGRADE_BASE_GEMS * Math.pow(EQUIP_UPGRADE_COST_GROWTH, getEquipTier(slotKey)));
}
function canUpgradeEquip(slotKey) {
  return !isEquipMaxed(slotKey) && player.gems >= getEquipUpgradeCost(slotKey);
}
function hasAnyEquipUpgradeAffordable() {
  return EQUIPMENT_SLOTS.some(s => canUpgradeEquip(s.key));
}

function buyEquipmentUpgrade(slotKey) {
  if (isEquipMaxed(slotKey)) return false;
  const cost = getEquipUpgradeCost(slotKey);
  if (player.gems < cost) return false;
  player.gems -= cost;
  player.equipment[slotKey] = getEquipTier(slotKey) + 1;
  playSfxBuffRoll(); // ยืมเสียงตอบรับเดิม (ยังอยู่ใน sound.js) มาใช้ตอนอัปอุปกรณ์
  GameEvents.emit(EVENTS.EQUIPMENT_UPGRADED, { slot: slotKey, tier: player.equipment[slotKey] });
  saveGame(); // เพชร/อุปกรณ์เปลี่ยน เก็บทันทีเหมือน progression อื่นๆ
  return true;
}

// ผลทันทีของกล่องของขวัญ (ไม่ใช่ของสวมใส่) — คืน def เพื่อให้ผู้เรียกโชว์ไอคอน/ชื่อได้
function applyInstantEffect(key) {
  const e = INSTANT_EFFECTS[key];
  if (e) e.apply();
  return e;
}
