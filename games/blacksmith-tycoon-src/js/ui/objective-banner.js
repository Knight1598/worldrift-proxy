/* =====================================================================
   Objective Banner — ป้ายเป้าหมายค้างบนจอ (ตรรกะเควสอยู่ที่ systems/objectives.js)
   โชว์เป้าปัจจุบัน + แถบความคืบหน้า + รางวัล และเรืองแสงชี้ปุ่มที่เกี่ยวข้อง (focus)
   เมื่อเป้าสำเร็จ (OBJECTIVE_COMPLETED) เล่นพิธีฉลอง (หีบเด้ง + คอนเฟตติ + เสียง) ก่อนสลับเป้าถัดไป
   ===================================================================== */
let objectiveFocusEl = null; // element ที่กำลังเรืองแสงชี้นำอยู่ (จำไว้เพื่อถอด class ตอนเปลี่ยนเป้า)

function clearObjectiveFocus() {
  if (objectiveFocusEl) { objectiveFocusEl.classList.remove('objective-focus'); objectiveFocusEl = null; }
}

function applyObjectiveFocus(obj) {
  clearObjectiveFocus();
  if (!obj || !obj.focus) return;
  const el = document.getElementById(obj.focus);
  if (el) { el.classList.add('objective-focus'); objectiveFocusEl = el; }
}

function renderObjectiveBanner() {
  const banner = document.getElementById('objectiveBanner');
  if (!banner) return;
  const obj = currentObjective();
  if (!obj) {
    // จบเชนแล้ว — ซ่อนป้าย + เลิกชี้ปุ่ม (ผู้เล่นเข้าสู่ mid-game ปล่อยให้ระบบ Missions/Achievements นำต่อ)
    banner.classList.remove('show');
    clearObjectiveFocus();
    return;
  }
  const cur = objectiveProgressValue(obj);
  document.getElementById('objectiveIcon').textContent = obj.icon;
  document.getElementById('objectiveTitle').textContent = obj.title;
  document.getElementById('objectiveProgress').textContent = cur + '/' + obj.target;
  document.getElementById('objectiveBarFill').style.width = (cur / obj.target * 100) + '%';
  const gems = objectiveRewardGems(obj);
  document.getElementById('objectiveReward').textContent = gems ? '+' + gems + ' 💎' : '+' + obj.reward.renown + ' 🏅';
  banner.classList.add('show');
  applyObjectiveFocus(obj);
}

// พิธีฉลองเมื่อเป้าสำเร็จ (Reward Ceremony) — หีบเด้ง + คอนเฟตติ + เสียงรัว + ป้ายกระพริบ ก่อนเลื่อนเป้าถัดไป
function objectiveCeremony(obj) {
  playSfxStageComplete();
  spawnConfetti(20);
  const gems = objectiveRewardGems(obj);
  const rewardText = gems ? '+' + gems + ' 💎' : '+' + obj.reward.renown + ' 🏅';
  const toast = document.createElement('div');
  toast.className = 'milestone-toast objective-toast';
  toast.innerHTML = '🎁 <b>ภารกิจสำเร็จ!</b><br>' + obj.title + '<br><span class="objective-toast-reward">' + rewardText + '</span>';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1900);
  const banner = document.getElementById('objectiveBanner');
  if (banner) { banner.classList.remove('objective-complete'); void banner.offsetWidth; banner.classList.add('objective-complete'); }
}

// mount ตัวเอง: ฉลองตอนเป้าสำเร็จ + วาดป้ายใหม่เสมอ (systems/objectives.js ขยับ index ไปแล้ว ณ จุดนี้)
GameEvents.on(EVENTS.OBJECTIVE_COMPLETED, (e) => {
  const obj = OBJECTIVE_CHAIN.find(o => o.key === e.key);
  if (obj) objectiveCeremony(obj);
  renderObjectiveBanner();
});
// อัปเดตแถบความคืบหน้าสด ๆ ระหว่างเล่น (เป้าเดิมยังไม่ครบ) — subscribe event เดียวกับ systems/objectives.js
// แต่ ui โหลดทีหลัง จึงถูกเรียกหลัง checkObjectives() เสมอ (index/รางวัลถูกจัดการก่อนป้ายอ่านค่า)
[EVENTS.ORDER_SERVED, EVENTS.UPGRADE_PURCHASED, EVENTS.STAFF_HIRED, EVENTS.STATION_UPGRADED].forEach(ev => {
  GameEvents.on(ev, () => renderObjectiveBanner());
});
