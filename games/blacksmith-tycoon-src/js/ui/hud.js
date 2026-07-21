/* =====================================================================
   HUD — กล่อง Gold + Gem บนสุด + แถบ Combo/Fever Mode
   ===================================================================== */
function renderGold() {
  // formatCompact กันตัวเลขยาวทะลุ HUD ตอนเงินโตระดับล้านล้าน (1.5M / 24.3B — ดู core/format.js)
  document.getElementById('goldValue').textContent = formatCompact(player.gold);
}
function renderGems() {
  document.getElementById('gemValue').textContent = formatCompact(player.gems);
}
function bumpGoldCounter() {
  const el = document.querySelector('.gold-counter');
  el.classList.remove('bump');
  void el.offsetWidth; // force reflow กัน class เดิมค้าง เล่นแอนิเมชันซ้ำไม่ได้ถ้ากดรัวๆ
  el.classList.add('bump');
}
function renderFeverBar() {
  const wrap = document.getElementById('feverBarWrap');
  const fill = document.getElementById('feverBarFill');
  const label = document.getElementById('feverBarLabel');
  const ready = feverState.progress >= 1 && !feverState.active;
  fill.style.width = (feverState.progress * 100) + '%';
  wrap.classList.toggle('ready', ready);
  wrap.classList.toggle('active', feverState.active);
  label.textContent = feverState.active ? 'FEVER!!' : ready ? 'แตะเลย!' : 'FEVER';
}

document.getElementById('feverBarWrap').addEventListener('click', () => activateFever());

// "mount ตัวเอง" ผ่าน GameEvents.on(...) ตอนโหลด แทนที่จะรอ orchestrator เรียก mount แยก —
// ไฟล์อื่น (economy.js/progression.js/goblin.js/fever.js) แค่ emit event โดยไม่ต้องรู้จัก HUD เลย
GameEvents.on(EVENTS.COIN_COLLECTED, () => { renderGold(); bumpGoldCounter(); });
GameEvents.on(EVENTS.GOBLIN_CAUGHT, () => { renderGold(); bumpGoldCounter(); });
GameEvents.on(EVENTS.UPGRADE_PURCHASED, () => renderGold());
GameEvents.on(EVENTS.STAFF_HIRED, () => renderGold());
GameEvents.on(EVENTS.VAULT_UPGRADED, () => renderGold());
GameEvents.on(EVENTS.FEVER_ACTIVATED, () => renderFeverBar());
GameEvents.on(EVENTS.FEVER_ENDED, () => renderFeverBar());
GameEvents.on(EVENTS.FEVER_PROGRESS, () => renderFeverBar()); // สะสมหลอด Fever (แทน features/fever.js เรียก DOM ตรงๆ)
GameEvents.on(EVENTS.MISSION_COMPLETED, () => renderGems());
GameEvents.on(EVENTS.OBJECTIVE_COMPLETED, () => { renderGems(); renderRenown(); }); // รางวัลเควสนำทาง = เพชร/ชื่อเสียง
GameEvents.on(EVENTS.BUFF_ROLLED, () => renderGems());
GameEvents.on(EVENTS.MILESTONE_REACHED, () => renderGems()); // รางวัลดาว milestone = เพชร
GameEvents.on(EVENTS.GIFT_OPENED, () => { renderGold(); renderGems(); });
GameEvents.on(EVENTS.STATION_UNLOCKED, () => renderGold()); // จ่าย Gold ปลดล็อกสถานี
GameEvents.on(EVENTS.STATION_UPGRADED, () => renderGold());
