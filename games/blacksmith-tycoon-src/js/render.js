/* =====================================================================
   Rendering orchestrator — renderAll() คือจุดเดียวที่ compose การรีเฟรชทั้งจอ
   (ตอนโหลดเกม/ขึ้นด่านใหม่) ฟังก์ชัน render ย่อยแต่ละตัวถูกย้ายไปอยู่ใน ui/*.js
   ตามหน้าที่ของมันแล้ว (hud.js, stage-status-bar.js, upgrade-list.js, ...) —
   แต่ละไฟล์ "mount ตัวเอง" ผ่าน GameEvents.on(...) ที่ระดับบนสุดของไฟล์ตอนโหลด
   จึงไม่ต้องมี mountAllComponents() แยกมาเรียกจาก main.js
   ===================================================================== */
function renderAll() {
  renderGold();
  renderGems();
  renderStageView();
  renderStageProgress();
  renderUpgradeList();
  renderPermUpgradeList();
  renderProductBadge();
  renderStatsFooter();
  renderFeverBar();
  renderMaterialStockPanel();
  renderBuffPanel();
  renderActiveBuffChip();
  refreshUpgradesFab();
  refreshRenovateFab();
  refreshStationsUi();
}

GameEvents.on(EVENTS.STAGE_ADVANCED, () => renderAll());
