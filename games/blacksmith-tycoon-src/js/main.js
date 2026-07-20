/* =====================================================================
   Game loop — worker/customer state machines อัปเดตทุกเฟรมผ่าน requestAnimationFrame
   ===================================================================== */
function findAssignableCustomer() {
  const activeSlots = workers.length; // จำนวนออเดอร์ที่รับพร้อมกันได้ = จำนวน worker (มีพนักงานช่วยแบ่งงานคิวจริง)
  const queue = getQueueCustomers();
  for (const c of queue) {
    if (c.slotIndex >= activeSlots) break;
    if (c.state === 'QUEUED') return c;
  }
  return null;
}


let rafId = null;
let lastTickTime = null;
function gameTick(ts) {
  if (lastTickTime == null) lastTickTime = ts;
  let dt = ts - lastTickTime;
  lastTickTime = ts;
  dt = Math.min(dt, 100); // กันดีเลย์กระโดดยาวตอนสลับแท็บ/lag spike
  tickFever();
  tickWorkers(dt);
  tickCustomers(dt);
  tickFlyingCoins(dt);
  rafId = requestAnimationFrame(gameTick);
}

let spawnTimerId = null;
function scheduleNextCustomer() {
  if (spawnTimerId) clearTimeout(spawnTimerId);
  spawnTimerId = setTimeout(() => {
    if (getQueueCustomers().length < getMaxQueueSize()) spawnCustomerEntity();
    scheduleNextCustomer();
  }, getSpawnIntervalMs());
}


/* =====================================================================
   Event listeners
   ===================================================================== */
document.getElementById('standBooth').addEventListener('click', (e) => {
  e.currentTarget.classList.remove('tap-bump');
  void e.currentTarget.offsetWidth;
  e.currentTarget.classList.add('tap-bump');
  playSfxTap();
});

document.getElementById('productBadge').addEventListener('click', () => openProductLevelModal());
document.getElementById('btnCloseProductLevel').addEventListener('click', () => closeProductLevelModal());
document.getElementById('btnBuyProductLevel').addEventListener('click', () => buyUpgrade('portion'));

document.getElementById('btnAdvanceStage').addEventListener('click', () => advanceStage());
document.getElementById('feverBarWrap').addEventListener('click', () => activateFever());
document.getElementById('btnCloseWelcomeBack').addEventListener('click', () => {
  document.getElementById('welcomeBackModal').classList.remove('show');
  renderGold();
});
document.getElementById('btnCloseGameComplete').addEventListener('click', () => {
  document.getElementById('gameCompleteModal').classList.remove('show');
});

document.getElementById('btnOpenSettings').addEventListener('click', () => {
  document.getElementById('btnToggleSound').textContent = player.settings.soundEnabled ? 'เปิดอยู่' : 'ปิดอยู่';
  document.getElementById('settingsModal').classList.add('show');
});
document.getElementById('btnCloseSettings').addEventListener('click', () => {
  document.getElementById('settingsModal').classList.remove('show');
});
document.getElementById('btnToggleSound').addEventListener('click', () => {
  player.settings.soundEnabled = !player.settings.soundEnabled;
  document.getElementById('btnToggleSound').textContent = player.settings.soundEnabled ? 'เปิดอยู่' : 'ปิดอยู่';
  saveGame();
});
document.getElementById('btnResetGame').addEventListener('click', () => {
  if (!confirm('ยืนยันรีเซ็ตเกม? ความคืบหน้าทั้งหมดจะหายไป')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  try { localStorage.removeItem(SAVE_KEY_V1); } catch (e) {} // กันเซฟ v1 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  location.reload();
});

/* =====================================================================
   Autosave + Init
   ===================================================================== */
setInterval(saveGame, 10000);
window.addEventListener('beforeunload', saveGame);
window.addEventListener('resize', updateSceneMetrics);

loadGame();
updateSceneMetrics();
applyOfflineEarnings();
renderAll();
initWorkers();
scheduleNextCustomer();
scheduleGoblin();
rafId = requestAnimationFrame(gameTick);
