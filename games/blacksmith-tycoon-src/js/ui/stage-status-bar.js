/* =====================================================================
   Stage Status — ชื่อด่าน/สินค้าปัจจุบัน + progress dots ของอัปเกรด + ภาพ Station ในฉาก
   ===================================================================== */
function renderStageView() {
  const stage = getStage();
  document.getElementById('stageName').textContent = stage.name;
  document.getElementById('stageProduct').textContent = `ขาย ${stage.product}`;
  document.getElementById('standTintOverlay').style.background = stage.color;
  document.getElementById('standBooth').src = stage.stationImg;
  document.getElementById('standBoothFront').src = stage.stationImg;
}

function renderStageProgress() {
  const total = UPGRADE_TYPES.length;
  const done = getStageProgressCount();
  document.getElementById('stageProgressCount').textContent = done;
  document.getElementById('stageProgressTotal').textContent = total;
  const dotsEl = document.getElementById('stageProgressDots');
  dotsEl.innerHTML = '';
  UPGRADE_TYPES.forEach(u => {
    const dot = document.createElement('div');
    dot.className = 'stage-progress-dot' + (player.upgradeLevels[u.key] >= u.maxLevel ? ' done' : '');
    dotsEl.appendChild(dot);
  });
}

// STAGE_ADVANCED ไม่ต้อง subscribe ที่นี่ซ้ำ -- render.js's renderAll() (subscribe STAGE_ADVANCED)
// เรียก renderStageView()/renderStageProgress() อยู่แล้ว กันรีเฟรชซ้ำสองรอบ
GameEvents.on(EVENTS.UPGRADE_PURCHASED, () => renderStageProgress());
