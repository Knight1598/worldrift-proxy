/* =====================================================================
   Guided Objective Chain — เควสนำทางแบบสคริปต์เรียงลำดับ (ดู OBJECTIVE_CHAIN ใน data.js)
   เป้าหมายทีละอันค้างบนจอ จบแล้วให้รางวัล+ขยับไปอันถัดไปทันที เพื่อลากมือผู้เล่นใหม่ผ่าน core loop
   ในช่วง 10 นาทีแรก (กันช่วง "แล้วไงต่อ?" ที่ทำให้หลุด) — ตรรกะ/รางวัลอยู่ที่นี่ ส่วน UI อยู่ที่ ui/objective-banner.js
   ===================================================================== */
function getObjectiveDef(i) { return OBJECTIVE_CHAIN[i]; }
function isObjectiveChainComplete() { return player.objectiveIndex >= OBJECTIVE_CHAIN.length; }
function currentObjective() { return isObjectiveChainComplete() ? null : OBJECTIVE_CHAIN[player.objectiveIndex]; }

// ค่าความคืบหน้าปัจจุบันของเป้า (ตัดไม่ให้เกิน target เพื่อให้แถบเต็มพอดี 100%)
function objectiveProgressValue(obj) { return Math.min(obj.target, Math.floor(obj.progress())); }
function isObjectiveMet(obj) { return obj.progress() >= obj.target; }

// จำนวนเพชรจริงที่จะได้ (คูณ x บุญเพชรเหมือนแหล่งเพชรอื่นๆ) — ใช้ทั้งตอนให้รางวัลจริงและตอนโชว์บนป้าย
function objectiveRewardGems(obj) { return obj.reward.gems ? Math.round(obj.reward.gems * getGemGainMult()) : 0; }
function grantObjectiveReward(obj) {
  if (obj.reward.gems) player.gems += objectiveRewardGems(obj);
  if (obj.reward.renown) player.prestige.renown += obj.reward.renown;
}

// เรียกเมื่อ event ที่เกี่ยวข้องเกิด — เช็คว่าเป้าปัจจุบันสำเร็จหรือยัง ถ้าใช่ให้รางวัล+ขยับไปเป้าถัดไป
// (while loop เผื่อสำเร็จหลายเป้ารวดเดียว เช่นอัปเกรดทีเดียวข้ามหลาย threshold) แล้ว emit ให้ UI ฉลอง
function checkObjectives() {
  let advanced = false;
  while (!isObjectiveChainComplete() && isObjectiveMet(currentObjective())) {
    const obj = currentObjective();
    grantObjectiveReward(obj);
    player.objectiveIndex += 1;
    advanced = true;
    GameEvents.emit(EVENTS.OBJECTIVE_COMPLETED, { key: obj.key, reward: obj.reward });
  }
  if (advanced) saveGame();
}

// catch-up ตอนโหลด: ผู้เล่นเก่าที่ค่าสถิติเลยเป้าต้นๆ ไปแล้ว (เพิ่งมาเจอระบบนี้กลางคัน) — ขยับ index
// ข้ามเป้าที่สำเร็จไปแล้วแบบเงียบๆ ไม่ให้รางวัล/ไม่เด้ง ceremony ให้ป้ายโชว์เป้าจริงถัดไปทันทีตอนบูต
function catchUpObjectives() {
  while (!isObjectiveChainComplete() && isObjectiveMet(currentObjective())) {
    player.objectiveIndex += 1;
  }
}

// เป้าแต่ละอันผูกกับ event คนละชนิด — subscribe รวมไว้ที่เดียว (systems/ โหลดก่อน ui/ ใน index.html
// จึงมั่นใจว่า index ขยับก่อน ui/objective-banner.js อ่านค่าไปวาดในเฟรมเดียวกัน)
GameEvents.on(EVENTS.ORDER_SERVED, checkObjectives);
GameEvents.on(EVENTS.UPGRADE_PURCHASED, checkObjectives);
GameEvents.on(EVENTS.STAFF_HIRED, checkObjectives);
GameEvents.on(EVENTS.STAGE_ADVANCED, checkObjectives);
GameEvents.on(EVENTS.FEVER_ACTIVATED, checkObjectives);
