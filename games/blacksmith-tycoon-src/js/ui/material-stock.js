/* =====================================================================
   Material Stock Panel — Visual Mapping ของคลังวัตถุดิบ แสดงเฉพาะชนิดที่สูตรของด่าน
   ปัจจุบันใช้ (getStage().recipe) อัปเดตแบบเรียลไทม์ตามที่เบิก/เติมจริง
   ===================================================================== */
function renderMaterialStockPanel() {
  const panel = document.getElementById('materialStockPanel');
  panel.innerHTML = '';
  getStage().recipe.forEach(r => {
    const def = MATERIALS.find(m => m.key === r.material);
    const inv = player.inventory[r.material];
    const chip = document.createElement('div');
    const low = inv.stock < inv.capacity * 0.25;
    chip.className = 'material-chip' + (low ? ' material-chip--low' : '');
    chip.textContent = `${def.icon} ${Math.floor(inv.stock)}/${inv.capacity}`;
    panel.appendChild(chip);
  });
}

GameEvents.on(EVENTS.MATERIAL_CONSUMED, () => renderMaterialStockPanel());
GameEvents.on(EVENTS.MATERIAL_RESTOCKED, () => renderMaterialStockPanel());
GameEvents.on(EVENTS.STAGE_ADVANCED, () => renderMaterialStockPanel());
