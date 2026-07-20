/* =====================================================================
   Upgrades / Stage progression
   ===================================================================== */
function buyUpgrade(key) {
  const type = getUpgradeType(key);
  const level = player.upgradeLevels[key];
  if (level >= type.maxLevel) return;
  const cost = getUpgradeCost(key);
  if (player.gold < cost) return;
  player.gold -= cost;
  const newLevel = level + 1;
  player.upgradeLevels[key] = newLevel;
  playSfxUpgrade();
  checkMilestone(key, newLevel, type.name);
  renderGold();
  renderUpgradeList();
  renderPermUpgradeList();
  renderStageProgress();
  renderProductBadge();
  if (document.getElementById('productLevelModal').classList.contains('show')) renderProductLevelModal();
  saveGame();
  if (isStageMaxed()) showStageCompleteModal();
}

// Milestone Boosts: เลเวล 10/25/50 ของอัปเกรดไหนก็ตาม โชว์ป๊อปอัพฉลอง 1 ครั้งต่อเลเวล (กันเด้งซ้ำตอนโหลดเซฟ
// ด้วย player.milestonesShown ที่ persist ผ่าน save)
function checkMilestone(key, level, displayName) {
  if (!MILESTONE_LEVELS.includes(level)) return;
  if (!player.milestonesShown[key]) player.milestonesShown[key] = [];
  if (player.milestonesShown[key].includes(level)) return;
  player.milestonesShown[key].push(level);
  showMilestoneToast(displayName, level, getMilestoneMultiplier(level));
}
function showMilestoneToast(displayName, level, mult) {
  const el = document.createElement('div');
  el.className = 'milestone-toast';
  el.innerHTML = `🌟 <b>${displayName}</b> ถึงเลเวล ${level}!<br>โบนัสพลังคูณ x${mult} ทันที!`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

/* =====================================================================
   Multi-Staff System — จ้างลูกมือเพิ่ม (สูงสุด MAX_STAFF_COUNT คน) + Offline Vault — อัปเกรดถาวร
   ทั้งสองอย่างไม่อยู่ใน UPGRADE_TYPES/upgradeLevels เพราะไม่ถูกรีเซ็ตตอนขึ้นด่านใหม่ (ดู advanceStage)
   ===================================================================== */
function hireHelper() {
  if (player.staffCount >= MAX_STAFF_COUNT) return;
  const cost = getHireHelperCost();
  if (player.gold < cost) return;
  player.gold -= cost;
  player.staffCount += 1;
  addWorker('staff');
  playSfxUpgrade();
  renderGold();
  renderPermUpgradeList();
  saveGame();
}

function buyVaultLevel() {
  if (player.vaultLevel >= MAX_VAULT_LEVEL) return;
  const cost = getVaultUpgradeCost();
  if (player.gold < cost) return;
  player.gold -= cost;
  player.vaultLevel += 1;
  playSfxUpgrade();
  renderGold();
  renderPermUpgradeList();
  saveGame();
}

function showStageCompleteModal() {
  const stage = getStage();
  const isLast = player.stageIndex >= STAGES.length - 1;
  document.getElementById('stageCompleteTitle').textContent = `${stage.name} เต็มขั้นแล้ว!`;
  if (isLast) {
    document.getElementById('stageCompleteText').textContent = 'คุณอัปเกรดร้านสุดท้ายจนเต็มขั้นแล้ว! กดเพื่อรับรางวัลปิดท้าย';
    document.getElementById('btnAdvanceStage').textContent = 'รับรางวัล!';
  } else {
    const next = STAGES[player.stageIndex + 1];
    document.getElementById('stageCompleteText').textContent = `พร้อมขยับไปเปิด "${next.name}" ขาย${next.product}แล้ว! Gold ที่มีอยู่ไม่หายไปไหน เอาไปต่อยอดร้านใหม่ได้เลย`;
    document.getElementById('btnAdvanceStage').textContent = `ไปกันเลย! (${next.name})`;
  }
  playSfxStageComplete();
  document.getElementById('stageCompleteModal').classList.add('show');
  spawnConfetti();
}

const CONFETTI_COLORS = ['#ff9f45', '#6bbf6b', '#5aa9e6', '#e35d5d', '#ffd76a', '#c77dff'];
function spawnConfetti(count) {
  const n = count || 40;
  for (let i = 0; i < n; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
    piece.style.animationDelay = (Math.random() * 0.4) + 's';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}

function advanceStage() {
  document.getElementById('stageCompleteModal').classList.remove('show');
  const wasFirstStage = player.stageIndex === 0;
  if (player.stageIndex >= STAGES.length - 1) {
    document.getElementById('gameCompleteModal').classList.add('show');
    return;
  }
  player.stageIndex += 1;
  player.upgradeLevels = { speed: 0, portion: 0, signage: 0, decor: 0 };
  // staffCount/vaultLevel เป็นอัปเกรดถาวร ไม่ถูกรีเซ็ตตรงนี้ — คงค่าจากด่านก่อนหน้าไว้ทั้งหมด
  if (wasFirstStage && player.staffCount === 0) {
    player.staffCount = 1; // ปลดล็อกลูกมือคนแรกฟรี + รายได้ตอนไม่อยู่หน้าจอ หลังผ่านร้านแรกสำเร็จ (ตามดีไซน์เดิม)
  }
  clearAllCustomers();
  initWorkers();
  renderAll();
  // Visual Workstation Upgrade: เด้ง pop ให้เห็นชัดว่า Station เปลี่ยนหน้าตาแล้วตอนขึ้นด่านใหม่
  const boothEl = document.getElementById('standBooth');
  const boothFrontEl = document.getElementById('standBoothFront');
  boothEl.classList.remove('stage-swap'); void boothEl.offsetWidth; boothEl.classList.add('stage-swap');
  boothFrontEl.classList.remove('stage-swap'); void boothFrontEl.offsetWidth; boothFrontEl.classList.add('stage-swap');
  scheduleNextCustomer();
  saveGame();
}

/* =====================================================================
   Offline Earnings (ปลดล็อกหลังจ้างพนักงานร้านแรกสำเร็จ) — อิงตามรอบการผลิตจริงของ worker คูณเวลาที่ออฟไลน์
   ===================================================================== */
function applyOfflineEarnings() {
  if (player.staffCount === 0) return; // ปลดล็อกหลังจ้างลูกมือคนแรก เหมือนดีไซน์เดิม
  const elapsedMs = Math.min(Date.now() - player.lastSeenAt, getOfflineMaxHours() * 3600 * 1000);
  if (elapsedMs < 30000) return; // น้อยกว่า 30 วินาทีไม่ต้องโชว์ ป้องกันรีเฟรชถี่ๆ แล้วเจอ modal ทุกครั้ง
  const earned = Math.floor(elapsedMs * getThroughputPerMs() * getRevenuePerSale() * OFFLINE_EFFICIENCY);
  if (earned <= 0) return;
  player.gold += earned;
  player.stats.totalGoldEarned += earned;
  const hours = (elapsedMs / 3600000).toFixed(1);
  document.getElementById('welcomeBackText').textContent = `ระหว่างที่คุณไม่อยู่ (${hours} ชม.) ร้านขายได้ Gold +${earned}!`;
  document.getElementById('welcomeBackModal').classList.add('show');
}

