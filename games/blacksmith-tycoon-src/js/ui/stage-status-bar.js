/* =====================================================================
   Stage Strip — ชื่อด่าน + ความคืบหน้าสู่ Renovate (Lv สินค้า X/25) ลอยล่างสุดของฉาก
   แทน stage-status-bar เดิมที่อยู่หัวลิสต์อัปเกรด (ลิสต์ย้ายเข้า modal แล้ว)
   + ภาพ Station ในฉาก (tint/รูปตามด่าน)
   ===================================================================== */
function renderStageView() {
  const stage = getStage();
  document.getElementById('stageName').textContent = stage.name;
  document.getElementById('standTintOverlay').style.background = stage.color;
  document.getElementById('standBooth').src = stage.stationImg;
  document.getElementById('standBoothFront').src = stage.stationImg;
}

function renderStageProgress() {
  const el = document.getElementById('stageRenovateProgress');
  const level = player.upgradeLevels.portion;
  const isLast = player.stageIndex >= STAGES.length - 1;
  if (isLast && level >= RENOVATE_GATE_LEVEL) {
    el.textContent = `Lv ${level} 👑`;
    el.classList.add('gate-met');
    return;
  }
  el.textContent = `🔨 Lv ${Math.min(level, RENOVATE_GATE_LEVEL)}/${RENOVATE_GATE_LEVEL}`;
  el.classList.toggle('gate-met', level >= RENOVATE_GATE_LEVEL);
}

GameEvents.on(EVENTS.UPGRADE_PURCHASED, () => renderStageProgress());
