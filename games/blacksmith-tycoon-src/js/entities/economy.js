let coins = [];

function getCoinById(id) { return coins.find(c => c.id === id); }

function spawnCoin(x, y, value, tip) {
  const id = 'coin' + (nextEntityId++);
  const el = document.createElement('div');
  el.className = 'coin-drop';
  el.innerHTML = '<img src="../assets/blacksmith/coin.png" alt="">';
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  // ต่อเข้า standStageView โดยตรง (ไม่ใช่ customerLane) เพราะ customerLane เป็น stacking context ของตัวเอง
  // (z-index:3) ถ้าเหรียญอยู่ในนั้น z-index:4 ของมันจะมีผลแค่ภายใน ไม่สามารถชนะ .shop-counter (z-index:4 ระดับบนสุด) ได้จริง
  document.getElementById('standStageView').appendChild(el);
  const coin = { id, x, y, value, tip, el, age: 0 };
  // แตะกองเหรียญเก็บทันทีได้ (แบบคลิป) — ไม่แตะก็บินเข้ากระเป๋าเองหลัง COIN_AUTO_COLLECT_DELAY_MS
  el.addEventListener('click', () => { if (!coin.flying) pickupCoin(coin); });
  coins.push(coin);
  return coin;
}
function deliverOrder(cust, worker) {
  hideOrderBubble(cust);
  cust.state = 'PAID_LEAVING';
  reindexQueue();
  spawnCoin(cust.x, cust.y - 6, cust.orderRevenue, cust.orderTip);
  // ยิง event แทนเรียก addFeverProgress() ข้ามไฟล์ตรงๆ — fever.js subscribe เอง (ดู features/fever.js)
  GameEvents.emit(EVENTS.ORDER_DELIVERED, { cust, worker });
}


// ===== Coin Arc Physics =====
// worker แตะเหรียญ (pickupCoin) ไม่ได้เข้า Gold ทันที — เหรียญจะบินเป็นวิถีโค้งไปหา UI กล่อง Gold ก่อน
// แล้วค่อยบวกเข้า player.gold ตอนบินไปถึงจริงๆ เท่านั้น (finishCoinFlight) ตามที่ระบุ
const COIN_FLIGHT_DURATION_MS = 550;
const COIN_ARC_HEIGHT_PX = 46;

function pickupCoin(coin) {
  if (coin.flying) return; // กันเก็บซ้ำ (แตะรัวๆ ระหว่างกำลังบิน)
  playSfxCashRegister();
  // Smart Floating Text: เก็บหลายเหรียญติดๆ กัน (ลูกมือ 5 คนส่งพร้อมกัน) จะรวมเป็นตัวเลขเดียว
  // ที่อัปเดตยอดสะสม แทนตัวเลข 5 อันซ้อนทับกันอ่านไม่ออก (ดู ui/floating-text.js)
  spawnCoinFloatText(coin.x, coin.y, Math.round(coin.value), coin.tip);
  player.stats.totalCustomersServed += 1;
  // ยิง event แทนให้ไฟล์นี้ต้องรู้จัก Order Missions/Combo เอง — systems/missions.js + features/combo.js subscribe เอง
  GameEvents.emit(EVENTS.ORDER_SERVED, {}); // registerServe() รันตรงนี้ คอมโบอัปเดตก่อน snapshot ด้านล่าง
  coin.comboMult = getComboMult(); // ล็อกตัวคูณคอมโบ ณ ตอนเสิร์ฟ ไว้ใช้ตอนเหรียญบินถึงกระเป๋า
  startCoinFlight(coin);
}

// คำนวณพิกัดเป้าหมาย (กล่อง Gold) เป็นระบบพิกัดเดียวกับตำแหน่งเหรียญ (สัมพัทธ์ standStageView)
function goldTargetPos() {
  const goldRect = document.getElementById('goldValue').getBoundingClientRect();
  const stageRect = document.getElementById('standStageView').getBoundingClientRect();
  return {
    x: goldRect.left - stageRect.left + goldRect.width / 2 - 13,
    y: goldRect.top - stageRect.top + goldRect.height / 2 - 13,
  };
}
function startCoinFlight(coin) {
  const target = goldTargetPos();
  coin.flying = true;
  coin.flightElapsed = 0;
  coin.startX = coin.x;
  coin.startY = coin.y;
  coin.targetX = target.x;
  coin.targetY = target.y;
  coin.el.classList.add('coin-flying');
}

// Responsive: กล่อง Gold เลื่อนตำแหน่งหลัง resize — เล็งเหรียญที่บินอยู่ไปเป้าใหม่ (ดู main.js's resize handler)
function retargetFlyingCoins() {
  const target = goldTargetPos();
  coins.forEach(coin => {
    if (!coin.flying) return;
    // รักษาความคืบหน้าเดิม: ตั้ง start เป็นตำแหน่งปัจจุบันแล้วเริ่มช่วงบินที่เหลือไปเป้าใหม่
    coin.startX = coin.x;
    coin.startY = coin.y;
    coin.flightElapsed = 0;
    coin.targetX = target.x;
    coin.targetY = target.y;
  });
}

function tickFlyingCoins(dt) {
  coins.forEach(coin => {
    if (!coin.flying) {
      // กองเหรียญหน้าเคาน์เตอร์: นับอายุแบบ dt (deterministic ในเทสต์) ครบกำหนดแล้วบินเข้ากระเป๋าเอง
      coin.age += dt;
      if (coin.age >= COIN_AUTO_COLLECT_DELAY_MS) pickupCoin(coin);
      return;
    }
    coin.flightElapsed += dt;
    const p = Math.min(1, coin.flightElapsed / COIN_FLIGHT_DURATION_MS);
    const x = coin.startX + (coin.targetX - coin.startX) * p; // แกน X วิ่งแบบ linear ตามที่ระบุ
    const easeY = 1 - Math.pow(1 - p, 3); // easeOutCubic แกน Y ให้ชะลอตอนใกล้ถึงเป้า ดูมีน้ำหนักโค้ง
    const arc = Math.sin(p * Math.PI) * COIN_ARC_HEIGHT_PX; // โป่งขึ้นกลางทางจำลองวิถีโค้ง (parabola)
    const y = coin.startY + (coin.targetY - coin.startY) * easeY - arc;
    coin.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) scale(${(1 - p * 0.45).toFixed(3)})`;
    if (p >= 1) finishCoinFlight(coin);
  });
}

function finishCoinFlight(coin) {
  // ตัวคูณคอมโบที่ล็อกไว้ตอนเสิร์ฟ (Active Rush) — คอมโบ 1 = x1 พอดี ไม่กระทบออเดอร์เดี่ยว
  const total = Math.round((coin.value + coin.tip) * (coin.comboMult || 1));
  player.gold += total;
  player.stats.totalGoldEarned += total;
  coin.el.remove();
  coins = coins.filter(c => c.id !== coin.id);
  // ยิง event แทนเรียก render*() 5-6 ฟังก์ชันข้ามไฟล์ตรงๆ — render.js subscribe เอง (ดู render.js ท้ายไฟล์)
  GameEvents.emit(EVENTS.COIN_COLLECTED, { amount: total });
}

function clearAllCustomers() {
  customers.forEach(c => c.el.remove());
  customers = [];
  coins.forEach(c => c.el.remove());
  coins = [];
}

