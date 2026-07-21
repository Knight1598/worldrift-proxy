/* =====================================================================
   Buff Roll (สุ่มบัพติดตัวด้วยเพชร) — ช่วยเร่งจบด่านเร็วขึ้น ไม่ใช่อัปเกรดถาวร
   บัพแบบ duration ใช้ได้ทีละ 1 ตัวเท่านั้น (สุ่มใหม่ทับของเดิม) ส่วนแบบ instant ใช้ผลทันทีครั้งเดียว
   activeBuff เป็น transient state ล้วนๆ (ประกาศไว้ที่ state.js เหมือน feverState) ไม่ persist ผ่าน save
   ===================================================================== */
function getBuffDef(key) {
  return BUFF_DEFS.find(b => b.key === key);
}

function isBuffActive(key) {
  return !!(activeBuff && activeBuff.key === key);
}

function pickWeightedBuff() {
  const totalWeight = BUFF_DEFS.reduce((sum, b) => sum + b.weight, 0);
  let r = Math.random() * totalWeight;
  for (const b of BUFF_DEFS) {
    r -= b.weight;
    if (r <= 0) return b;
  }
  return BUFF_DEFS[BUFF_DEFS.length - 1]; // กันพลาดจาก floating point เศษเล็กน้อย
}

function rollBuff() {
  if (player.gems < BUFF_ROLL_COST_GEMS) return null;
  player.gems -= BUFF_ROLL_COST_GEMS;
  const buff = pickWeightedBuff();
  if (buff.kind === 'instant') {
    applyInstantBuff(buff);
  } else {
    activeBuff = { key: buff.key, endsAt: performance.now() + BUFF_DURATION_MS };
  }
  playSfxBuffRoll();
  GameEvents.emit(EVENTS.BUFF_ROLLED, { buff });
  saveGame(); // เพชรเปลี่ยน เก็บทันที
  return buff;
}

function applyInstantBuff(buff) {
  if (buff.key === 'instant_restock') {
    MATERIALS.forEach(m => { player.inventory[m.key].stock = player.inventory[m.key].capacity; });
  } else if (buff.key === 'goblin_now') {
    if (goblinTimerId) clearTimeout(goblinTimerId);
    spawnGoblin();
  } else if (buff.key === 'fever_now') {
    feverState.progress = 1;
    renderFeverBar();
  } else if (buff.key === 'gold_burst') {
    const reward = Math.max(20, Math.round(estimateIncomePerMinute() * 0.5));
    player.gold += reward;
    player.stats.totalGoldEarned += reward;
    // ยิง COIN_COLLECTED เดียวกับที่เหรียญบินมาถึงจริงยิง -- ให้ income tracker/HUD/อัปเกรด list รับรู้เหมือนได้เงินจริง
    GameEvents.emit(EVENTS.COIN_COLLECTED, { amount: reward });
  }
}

function tickBuffs() {
  if (activeBuff && performance.now() >= activeBuff.endsAt) {
    activeBuff = null;
    GameEvents.emit(EVENTS.BUFF_ENDED, {});
  }
}
