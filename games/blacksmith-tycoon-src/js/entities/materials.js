/* =====================================================================
   Materials / Stock Flow — วัตถุดิบที่ worker ต้องเบิกจากคลัง (player.inventory) ก่อนเริ่มคราฟต์
   ถ้าคลังไม่พอ worker จะเข้า state WAITING_FOR_STOCK (ดู entities/worker.js) จนกว่าจะเติมพอ
   คลังเติมเองอัตโนมัติแบบพาสซีฟผ่าน tickMaterialRegen() ไม่มีปุ่มซื้อเพิ่มในสโคปนี้
   ===================================================================== */
function hasEnoughMaterials(recipe) {
  return recipe.every(r => player.inventory[r.material].stock >= r.qty);
}

function consumeMaterials(recipe) {
  recipe.forEach(r => {
    const inv = player.inventory[r.material];
    inv.stock -= r.qty;
    GameEvents.emit(EVENTS.MATERIAL_CONSUMED, { material: r.material, qty: r.qty, remaining: inv.stock });
  });
}

function tickMaterialRegen(dt) {
  MATERIALS.forEach(m => {
    const inv = player.inventory[m.key];
    if (inv.stock >= inv.capacity) return; // เต็มแล้วไม่ต้องทำอะไร กัน emit event เปล่าๆ ทุกเฟรม
    inv.stock = Math.min(inv.capacity, inv.stock + MATERIAL_REGEN_PER_SEC * (dt / 1000));
    GameEvents.emit(EVENTS.MATERIAL_RESTOCKED, { material: m.key, stock: inv.stock });
  });
}
