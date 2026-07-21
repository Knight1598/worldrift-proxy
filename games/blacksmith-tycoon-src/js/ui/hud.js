/* =====================================================================
   HUD — กล่อง Gold + Gem บนสุด + แถบ Combo/Fever Mode
   ===================================================================== */
function renderGold() {
  document.getElementById('goldValue').textContent = Math.floor(player.gold).toLocaleString();
}
function renderGems() {
  document.getElementById('gemValue').textContent = player.gems.toLocaleString();
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
GameEvents.on(EVENTS.MISSION_COMPLETED, () => renderGems());
GameEvents.on(EVENTS.BUFF_ROLLED, () => renderGems());
