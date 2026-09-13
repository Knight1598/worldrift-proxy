/* =====================================================================
   Rewards Modal — รวมรางวัลรายวัน + ความสำเร็จ (เปิดจากปุ่ม 🏆 บน HUD)
   จุดแดงบนปุ่ม 🏆 = มีอะไรให้กดรับ (daily พร้อม หรือ achievement ถึงเป้าแต่ยังไม่รับ)
   ===================================================================== */
function renderDailyPanel() {
  const panel = document.getElementById('dailyPanel');
  const available = isDailyAvailable();
  const streak = available ? nextDailyStreak() : player.daily.streak;
  const reward = dailyRewardForStreak(available ? streak : Math.max(1, player.daily.streak));
  panel.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'daily-card' + (available ? ' daily-card--ready' : '');
  card.innerHTML =
    `<div class="daily-info"><div class="daily-title">🎁 วันที่ ${streak} ติดต่อกัน</div>` +
    `<div class="daily-sub">${available ? `กดรับ ${reward} 💎 วันนี้!` : 'รับไปแล้ววันนี้ — กลับมาพรุ่งนี้เพื่อ streak ที่มากขึ้น'}</div></div>`;
  const btn = document.createElement('button');
  btn.className = 'buy-btn ' + (available ? 'buy-btn--affordable' : 'buy-btn--disabled');
  btn.textContent = available ? `รับ ${reward} 💎` : 'รับแล้ว ✓';
  btn.disabled = !available;
  btn.addEventListener('click', () => { const r = claimDaily(); if (r) { renderDailyPanel(); showDailyToast(r); } });
  card.appendChild(btn);
  panel.appendChild(card);
}

function renderAchievementList() {
  const list = document.getElementById('achievementList');
  list.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const done = isAchievementComplete(a);
    const claimed = isAchievementClaimed(a.key);
    const claimable = done && !claimed;
    const progress = Math.min(a.goal(), a.target);

    const card = document.createElement('div');
    card.className = 'upgrade-card achievement-card' + (claimed ? ' achievement-card--claimed' : '');
    const icon = document.createElement('div');
    icon.className = 'upgrade-icon';
    icon.textContent = a.icon;
    const info = document.createElement('div');
    info.className = 'upgrade-info';
    const rewardText = a.reward.gems ? `${a.reward.gems} 💎` : `${a.reward.renown} 🏅`;
    info.innerHTML =
      `<div class="upgrade-name">${a.name}</div>` +
      `<div class="upgrade-desc">${a.desc} · รางวัล ${rewardText}</div>` +
      `<div class="achievement-bar"><div class="achievement-bar-fill" style="width:${(progress / a.target) * 100}%"></div></div>` +
      `<div class="upgrade-level">${formatCompact(progress)}/${formatCompact(a.target)}</div>`;
    const btn = document.createElement('button');
    btn.className = 'buy-btn ' + (claimed ? 'buy-btn--maxed' : claimable ? 'buy-btn--affordable' : 'buy-btn--disabled');
    btn.textContent = claimed ? 'รับแล้ว ✓' : claimable ? 'รับรางวัล' : 'ยังไม่ถึง';
    btn.disabled = !claimable;
    btn.addEventListener('click', () => { if (claimAchievement(a.key)) { renderAchievementList(); } });
    card.append(icon, info, btn);
    list.appendChild(card);
  });
}

function showDailyToast(r) {
  const el = document.createElement('div');
  el.className = 'milestone-toast';
  el.innerHTML = `🎁 รางวัลรายวัน วันที่ ${r.streak}!<br>ได้รับ <b>${r.reward} 💎</b> เพชร`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// จุดแดงบนปุ่ม 🏆 — โชว์เมื่อมี daily พร้อมรับ หรือ achievement รอรับ
function refreshRewardsBadge() {
  const has = isDailyAvailable() || hasClaimableAchievement();
  document.getElementById('rewardsBadge').classList.toggle('show', has);
}

function openRewardsModal() {
  renderDailyPanel();
  renderAchievementList();
  document.getElementById('rewardsModal').classList.add('show');
}

document.getElementById('btnOpenRewards').addEventListener('click', () => openRewardsModal());
document.getElementById('btnCloseRewards').addEventListener('click', () => {
  document.getElementById('rewardsModal').classList.remove('show');
});

// รีเฟรช badge + HUD เพชร/ชื่อเสียงหลังกดรับ + เมื่อ progress อาจถึงเป้า (หลังเก็บเหรียญ/จบภารกิจ/เกิดใหม่)
GameEvents.on(EVENTS.ACHIEVEMENT_CLAIMED, () => { renderGems(); renderRenown(); refreshRewardsBadge(); });
GameEvents.on(EVENTS.DAILY_CLAIMED, () => { renderGems(); refreshRewardsBadge(); });
GameEvents.on(EVENTS.COIN_COLLECTED, () => refreshRewardsBadge());
GameEvents.on(EVENTS.MISSION_COMPLETED, () => refreshRewardsBadge());
GameEvents.on(EVENTS.PRESTIGE_DONE, () => refreshRewardsBadge());
