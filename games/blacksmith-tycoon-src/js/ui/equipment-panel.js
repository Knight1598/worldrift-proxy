/* =====================================================================
   Equipment panel — การ์ด 3 ช่องสวมใส่ในโมดัลอัปเกรด (ตรรกะอยู่ที่ systems/equipment.js)
   แต่ละช่องโชว์ไอคอน + ชื่อไอเทม tier ปัจจุบัน (สีตาม rarity) + ค่าโบนัส + ปุ่มอัป tier ถัดไปด้วยเพชร
   ===================================================================== */
// จัดรูปข้อความโบนัสตามความหมายของแต่ละช่อง (unit) — ช่อง charm มีสองผล (ทิป + ตัวคูณ VIP)
function formatEquipEffect(slotDef) {
  const effect = getEquipCurrentEffect(slotDef.key);
  if (slotDef.unit === 'charm') {
    const vip = getEquipVipMult();
    return effect > 0
      ? `ทิป +${Math.round(effect * 100)}% · VIP x${vip.toFixed(1)}`
      : 'ยังไม่มีโบนัส';
  }
  // 'pct' — tool = ลดเวลาคราฟต์, outfit = เงินต่อออเดอร์
  return effect > 0 ? `${slotDef.effectLabel} ${slotDef.key === 'tool' ? '-' : '+'}${Math.round(effect * 100)}%` : 'ยังไม่มีโบนัส';
}

function renderEquipmentPanel() {
  const panel = document.getElementById('equipmentPanel');
  if (!panel) return;
  panel.innerHTML = '';
  EQUIPMENT_SLOTS.forEach(slotDef => {
    const tier = getEquipTier(slotDef.key);
    const rarity = getEquipRarity(slotDef.key);
    const maxed = isEquipMaxed(slotDef.key);
    const affordable = canUpgradeEquip(slotDef.key);

    const card = document.createElement('div');
    card.className = 'equip-slot equip-slot--' + rarity;

    const icon = document.createElement('div');
    icon.className = 'equip-slot-icon';
    icon.textContent = slotDef.icon;

    const info = document.createElement('div');
    info.className = 'equip-slot-info';
    const name = document.createElement('div');
    name.className = 'equip-slot-name';
    name.innerHTML = slotDef.name + ' · <span class="equip-tier-name">' + getEquipTierDef(slotDef.key).name + '</span>';
    const effect = document.createElement('div');
    effect.className = 'equip-slot-effect';
    effect.textContent = formatEquipEffect(slotDef);
    const tierDots = document.createElement('div');
    tierDots.className = 'equip-tier-dots';
    for (let i = 1; i <= getEquipMaxTier(slotDef.key); i++) {
      const dot = document.createElement('span');
      dot.className = 'equip-tier-dot' + (i <= tier ? ' filled' : '');
      tierDots.appendChild(dot);
    }
    info.append(name, effect, tierDots);

    const btn = document.createElement('button');
    if (maxed) {
      btn.className = 'buy-btn buy-btn--disabled';
      btn.textContent = 'สูงสุด';
      btn.disabled = true;
    } else {
      btn.className = 'buy-btn ' + (affordable ? 'buy-btn--affordable' : 'buy-btn--disabled');
      btn.textContent = 'อัป (' + getEquipUpgradeCost(slotDef.key) + '💎)';
      btn.disabled = !affordable;
      btn.addEventListener('click', () => {
        if (buyEquipmentUpgrade(slotDef.key)) showEquipUpgradeToast(slotDef);
      });
    }

    card.append(icon, info, btn);
    panel.appendChild(card);
  });
}

function showEquipUpgradeToast(slotDef) {
  const el = document.createElement('div');
  el.className = 'milestone-toast'; // ยืมสไตล์ป๊อปอัพเดิมมาใช้ซ้ำ
  el.innerHTML = `${slotDef.icon} สวมใส่ <b>${getEquipTierDef(slotDef.key).name}</b>!<br>${formatEquipEffect(slotDef)}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

// mount ตัวเอง: เพชรเพิ่ม (อาจพออัปได้แล้ว) หรืออัปอุปกรณ์ไปแล้ว — วาดการ์ดใหม่
GameEvents.on(EVENTS.MISSION_COMPLETED, () => renderEquipmentPanel());
GameEvents.on(EVENTS.OBJECTIVE_COMPLETED, () => renderEquipmentPanel());
GameEvents.on(EVENTS.EQUIPMENT_UPGRADED, () => renderEquipmentPanel());
