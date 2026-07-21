/* =====================================================================
   Worker (ผู้เล่น + พนักงาน) — State Machine:
   IDLE -> WALK_TO_STATION -> [WAITING_FOR_STOCK ถ้าวัตถุดิบไม่พอ] -> CRAFTING -> DELIVER -> IDLE
   (ขา COLLECT ถูกตัดออก — เหรียญกองที่เคาน์เตอร์แล้วเก็บอัตโนมัติ/แตะเก็บ ดู entities/economy.js)
   แอนิเมชันเดิน: sprite-sheet จริง 4 เฟรม สลับด้วย background-position ตามทิศทางที่กำลังเดิน
   (หันหลังตอนเดินขึ้นไป Station, หันหน้าตอนเดินลงมาเคาน์เตอร์)
   ===================================================================== */
let workers = [];
let nextEntityId = 1;

const WALK_FRAME_COUNT = 4;
const WALK_SPRITE_URL = {
  front: '../assets/blacksmith/farmer_walk_front.png',
  back: '../assets/blacksmith/farmer_walk_back.png',
  left: '../assets/blacksmith/farmer_walk_left.png',
  right: '../assets/blacksmith/farmer_walk_right.png',
};
const IDLE_SPRITE_URL = '../assets/blacksmith/farmer_idle.png';
const WALK_FRAME_MS_AT_BASE_SPEED = 140; // ระยะเวลาต่อเฟรมตอนไม่มีอัปเกรด speed — เดินเร็วขึ้นแล้วขาก็สลับเฟรมไวขึ้นตาม

// ===== Sparks (ตอน Crafting) — ใช้ Particle Pool (core/particles.js) แทนสร้าง/ทำลาย node ทุกดอก =====
const SPARK_INTERVAL_MS = 220; // ยิงประกายไฟทุกๆ ช่วงนี้ระหว่าง craft (จังหวะใกล้เคียงกับ craftSwing 0.42s ต่อรอบ)
const SPARK_LIFETIME_MS = 480; // ตรงกับความยาวแอนิเมชัน sparkFly ใน CSS พอดี — จบปุ๊บคืน pool ปั๊บ
function spawnSpark(x, y) {
  spawnParticle('spark-particle', document.getElementById('standStageView'), SPARK_LIFETIME_MS, el => {
    const angle = (Math.random() - 0.5) * 2.6; // เรเดียน กระจายเฉียงซ้าย-ขวาแบบสุ่ม
    const dist = 12 + Math.random() * 16;
    const smx = Math.sin(angle) * dist * 0.6;
    const smy = -(8 + Math.random() * 8); // พุ่งขึ้นก่อนช่วงแรก (จำลองแรงกระเด็นจากค้อนกระทบ)
    const sx = Math.sin(angle) * dist;
    const sy = 8 + Math.random() * 10; // แล้วตกลงมาตาม gravity เสมือนช่วงหลัง
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.setProperty('--smx', smx.toFixed(1) + 'px');
    el.style.setProperty('--smy', smy.toFixed(1) + 'px');
    el.style.setProperty('--sx', sx.toFixed(1) + 'px');
    el.style.setProperty('--sy', sy.toFixed(1) + 'px');
  });
}

// แตะพื้นที่ว่างในฉาก = "โหมไฟเตา" — ดัน craftElapsed ของทุก worker ที่กำลังคราฟต์ให้เสร็จไวขึ้น
// พร้อมประกายไฟกระเด็นจากจุดที่แตะ (Active-tap ให้มีอะไรทำด้วยมือช่วงต้นเกม) — ถ้าไม่มีใครคราฟต์อยู่
// ก็ยังมีประกายไฟ + เสียงเป็นฟีดแบ็ก แต่ไม่มีผลเร่ง (กัน spam ให้ประโยชน์เฉพาะตอนมีงานคราฟต์จริง)
function stokeForge(e) {
  const stage = document.getElementById('standStageView');
  const rect = stage.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  workers.forEach(w => { if (w.state === 'CRAFTING') w.craftElapsed += STOKE_CRAFT_MS; });
  for (let i = 0; i < STOKE_SPARK_COUNT; i++) {
    spawnSpark(x + (Math.random() * 16 - 8), y + (Math.random() * 10 - 5));
  }
  playSfxTap();
}

// เลือกทิศเดิน (หน้า/หลัง/ซ้าย/ขวา) จากทิศทางรวมของการเดินทั้งช่วง (ไม่คำนวณใหม่ทุกเฟรม กันภาพสั่นตอน dx/dy ใกล้เคียงกัน)
function pickWalkDirection(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 'back' : 'front';
  return dx < 0 ? 'left' : 'right';
}

function addWorker(kind) {
  const idx = workers.length;
  const el = document.createElement('div');
  el.className = 'worker' + (kind === 'staff' ? ' staff' : '');
  el.innerHTML =
    '<div class="worker-craft-bar-bg"><div class="worker-craft-bar-fill"></div></div>' +
    '<div class="worker-wait-bubble">📦</div>' +
    '<div class="worker-swing"><div class="worker-body"><div class="worker-sprite"></div></div></div>';
  document.getElementById('workerLayer').appendChild(el);
  const pos = idlePos(idx);
  const w = {
    id: kind + '_' + idx, kind, el, workerIndex: idx,
    x: pos.x, y: pos.y, facing: 1,
    state: 'IDLE', orderId: null, pendingCoinId: null, craftElapsed: 0, sparkElapsed: 0,
    walkDir: 'front', animFrame: 0, animElapsed: 0,
    spriteEl: el.querySelector('.worker-sprite'),
  };
  workers.push(w);
  renderWorkerTransform(w, false, 0);
}

function initWorkers() {
  document.getElementById('workerLayer').innerHTML = '';
  workers = [];
  addWorker('player');
  for (let i = 0; i < player.staffCount; i++) addWorker('staff');
}

function renderWorkerTransform(w, moving, dt) {
  // ปัดพิกัดเป็นจำนวนเต็มเฉพาะตอน "วาด" (ตำแหน่งจริงในซิมยังเป็นทศนิยม) — กัน sub-pixel blur/สั่นของ sprite
  w.el.style.transform = `translate(${Math.round(w.x)}px, ${Math.round(w.y)}px)`;
  // Y-sort: ตัวที่อยู่ต่ำกว่าบนจอ (ใกล้กล้องกว่า) ทับตัวที่อยู่สูงกว่าเสมอ ภายในเลเยอร์ worker ด้วยกัน
  w.el.style.zIndex = Math.max(1, Math.round(w.y));
  w.el.classList.toggle('moving', !!moving);
  if (moving) {
    const frameMs = WALK_FRAME_MS_AT_BASE_SPEED * (BASE_MOVE_SPEED_PX / getMoveSpeedPxPerSec());
    w.animElapsed += dt || 0;
    if (w.animElapsed >= frameMs) {
      w.animElapsed = 0;
      w.animFrame = (w.animFrame + 1) % WALK_FRAME_COUNT;
    }
    w.spriteEl.style.backgroundImage = `url('${WALK_SPRITE_URL[w.walkDir]}')`;
    w.spriteEl.style.backgroundSize = `${WALK_FRAME_COUNT * 100}% 100%`;
    w.spriteEl.style.backgroundPosition = `${(w.animFrame / (WALK_FRAME_COUNT - 1)) * 100}% 0%`;
  } else {
    w.animFrame = 0;
    w.animElapsed = 0;
    w.spriteEl.style.backgroundImage = `url('${IDLE_SPRITE_URL}')`;
    w.spriteEl.style.backgroundSize = '100% 100%';
    w.spriteEl.style.backgroundPosition = '0 0';
  }
}
function showCraftBar(w) { w.el.querySelector('.worker-craft-bar-bg').classList.add('show'); }
function hideCraftBar(w) { w.el.querySelector('.worker-craft-bar-bg').classList.remove('show'); }
// วงกลม pie เหนือหัวแบบเกมต้นแบบ (conic-gradient คุมด้วยตัวแปร --craft-pct ดู CSS .worker-craft-bar-fill)
function updateCraftBar(w, pct) { w.el.querySelector('.worker-craft-bar-fill').style.setProperty('--craft-pct', (pct * 100).toFixed(1)); }

// จุดเดียวที่เริ่มสถานะ CRAFTING จริง -- เรียกได้ทั้งจาก WALK_TO_STATION (วัตถุดิบพอตั้งแต่มาถึง)
// และจาก WAITING_FOR_STOCK (เพิ่งเติมวัตถุดิบพอระหว่างรอ) กันโค้ดซ้ำสองที่
function startCrafting(w) {
  w.state = 'CRAFTING';
  w.craftElapsed = 0;
  w.sparkElapsed = 0;
  // บัพ "ช่างไว" — สุ่มโอกาสให้ออเดอร์นี้เสร็จทันทีในติ๊กถัดไป (ตั้ง craftElapsed ให้เกิน dur แน่นอนเลย)
  if (isBuffActive('instant_craft') && Math.random() < getBuffDef('instant_craft').chance) {
    w.craftElapsed = BASE_CRAFT_MS * 10;
  }
  showCraftBar(w);
  w.el.classList.add('crafting'); // เริ่มท่าตีค้อน (squash/rotate loop ดู CSS .worker.crafting)
}

function tickWorkers(dt) {
  const speed = getMoveSpeedPxPerSec();
  workers.forEach(w => {
    if (w.state === 'IDLE') {
      const cust = findAssignableCustomer();
      if (cust) {
        cust.state = 'ORDER_ACTIVE';
        // Multi-Station: ลูกค้าสุ่มสั่งจากสถานีที่ปลดล็อกแล้ว — worker คนนี้จะเดินไปคราฟต์ที่สถานีนั้น
        const unlocked = getUnlockedStationIndices();
        cust.stationIndex = unlocked[Math.floor(Math.random() * unlocked.length)];
        w.targetStation = cust.stationIndex;
        cust.orderIcon = getStationIcon(cust.stationIndex);
        // บัพ "เงินสองเท่า"/"โชคกาชา" — สุ่มโอกาสคูณเงินออเดอร์นี้เพิ่ม (มีได้ทีละบัพเดียวอยู่แล้ว เลยไม่มีทางชนกัน)
        let buffGoldMult = 1;
        if (isBuffActive('double_gold') && Math.random() < getBuffDef('double_gold').chance) buffGoldMult = getBuffDef('double_gold').mult;
        else if (isBuffActive('crit_gold') && Math.random() < getBuffDef('crit_gold').chance) buffGoldMult = getBuffDef('crit_gold').mult;
        // ออเดอร์หลายชิ้น (x2/x3) แบบตัวเลขในบับเบิลของเกมต้นแบบ — จ่ายคูณตามจำนวน คราฟต์รอบเดียวได้ทั้งชุด
        const qtyRoll = Math.random();
        cust.orderQty = qtyRoll < ORDER_QTY_3_CHANCE ? 3 : qtyRoll < ORDER_QTY_3_CHANCE + ORDER_QTY_2_CHANCE ? 2 : 1;
        // VIP: จ่าย 10 เท่าของราคาปกติ + ทิปการันตี 100% ของยอดออเดอร์ (ลูกค้าทั่วไปสุ่มทิปตามอัปเกรด "ตกแต่งร้าน")
        // ราคาอิงสถานีที่สั่ง (สถานีเสริมขายของแพงกว่าตาม revenueMult)
        cust.orderRevenue = getStationRevenue(cust.stationIndex) * (cust.isVIP ? VIP_REVENUE_MULT : 1) * buffGoldMult * cust.orderQty;
        cust.orderTip = cust.isVIP
          ? Math.round(cust.orderRevenue * VIP_TIP_RATIO)
          : (Math.random() < getTipChance() ? Math.round(cust.orderRevenue * (0.5 + Math.random())) : 0);
        cust.patienceStartAt = performance.now();
        showOrderBubble(cust);
        w.orderId = cust.id;
        w.state = 'WALK_TO_STATION';
        return;
      }
      const idleTarget = idlePos(w.workerIndex);
      w.walkDir = pickWalkDirection(w, idleTarget);
      const arrived = moveToward(w, idleTarget, speed, dt);
      renderWorkerTransform(w, !arrived, dt);
      return;
    }
    if (w.state === 'WALK_TO_STATION') {
      // เดินขึ้นไปหา Station ของออเดอร์นี้ (Multi-Station: กลาง/ซ้าย/ขวา) — dy<0 เด่นชัด จึงได้ walkDir='back'
      const stTarget = stationPos(w.workerIndex, w.targetStation);
      w.walkDir = pickWalkDirection(w, stTarget);
      const arrived = moveToward(w, stTarget, speed, dt);
      renderWorkerTransform(w, !arrived, dt);
      if (arrived) {
        if (hasEnoughMaterials(getStage().recipe)) {
          startCrafting(w);
        } else {
          w.state = 'WAITING_FOR_STOCK'; // วัตถุดิบไม่พอ -- ยืนรอที่ station จนกว่าคลังจะเติมพอ (ดู tickMaterialRegen)
        }
      }
      return;
    }
    if (w.state === 'WAITING_FOR_STOCK') {
      renderWorkerTransform(w, false, dt); // ยืนนิ่งรอเฉยๆ ที่ station (โชว์เฟรม idle)
      w.el.classList.add('waiting-stock'); // บับเบิล 📦 เด้งเหนือหัว — สื่อคอขวดวัตถุดิบโดยไม่ต้องอ่านตัวหนังสือ
      if (hasEnoughMaterials(getStage().recipe)) {
        w.el.classList.remove('waiting-stock');
        startCrafting(w);
      }
      return;
    }
    if (w.state === 'CRAFTING') {
      w.craftElapsed += dt;
      const dur = getCraftDurationMs();
      updateCraftBar(w, Math.min(1, w.craftElapsed / dur));
      renderWorkerTransform(w, false, dt); // ยืนนิ่งตอน craft — โชว์เฟรม idle พร้อม progress bar เขียว/ฟ้าด้านบน (ท่าตีค้อนคุมแยกผ่าน .crafting class)
      w.sparkElapsed += dt;
      if (w.sparkElapsed >= SPARK_INTERVAL_MS) {
        w.sparkElapsed = 0;
        // ยิงประกายไฟจากประมาณตำแหน่งมือ/ค้อนของตัวละคร (กลาง-บนของสไปรต์)
        spawnSpark(w.x + 41, w.y + 32);
        if (Math.random() < 0.5) spawnSpark(w.x + 41 + (Math.random() * 12 - 6), w.y + 30);
      }
      if (w.craftElapsed >= dur) {
        hideCraftBar(w);
        w.el.classList.remove('crafting');
        consumeMaterials(getStage().recipe); // เบิกวัตถุดิบตอนคราฟต์เสร็จจริง (ไม่ใช่ตอนเริ่ม)
        w.state = 'DELIVER';
      }
      return;
    }
    if (w.state === 'DELIVER') {
      const cust = getCustomerById(w.orderId);
      if (!cust) { w.state = 'IDLE'; w.orderId = null; return; }
      // เดินกลับลงมาส่งที่เคาน์เตอร์ (ล่าง) — dy>0 เด่นชัด จึงได้ walkDir='front' (หันหน้าเข้ากล้อง) ตามที่ระบุ
      const dTarget = queueSlotPos(cust.slotIndex);
      w.walkDir = pickWalkDirection(w, dTarget);
      const arrived = moveToward(w, dTarget, speed, dt);
      renderWorkerTransform(w, !arrived, dt);
      if (arrived) {
        deliverOrder(cust, w);
        // ไม่มีขา COLLECT อีกแล้ว — เหรียญกองที่เคาน์เตอร์แล้วบินเข้ากระเป๋าเอง (หรือผู้เล่นแตะเก็บ)
        // แบบเกมต้นแบบ worker กลับไปรับงานถัดไปได้ทันที รอบงานเร็วขึ้น ~1/3
        w.state = 'IDLE';
        w.orderId = null;
      }
      return;
    }
  });
}

