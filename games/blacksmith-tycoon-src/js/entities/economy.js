let coins = [];

function getCoinById(id) { return coins.find(c => c.id === id); }

function spawnCoin(x, y, value, tip) {
  const id = 'coin' + (nextEntityId++);
  const el = document.createElement('div');
  el.className = 'coin-drop';
  el.innerHTML = '<img src="../assets/blacksmith/coin.png" alt="">';
  el.style.transform = `translate(${x}px, ${y}px)`;
  // ต่อเข้า standStageView โดยตรง (ไม่ใช่ customerLane) เพราะ customerLane เป็น stacking context ของตัวเอง
  // (z-index:3) ถ้าเหรียญอยู่ในนั้น z-index:4 ของมันจะมีผลแค่ภายใน ไม่สามารถชนะ .shop-counter (z-index:4 ระดับบนสุด) ได้จริง
  document.getElementById('standStageView').appendChild(el);
  const coin = { id, x, y, value, tip, el };
  coins.push(coin);
  return coin;
}
function spawnFloatText(x, y, text, variant) {
  const el = document.createElement('div');
  el.className = 'float-text float-text--' + variant;
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.getElementById('standStageView').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function deliverOrder(cust, worker) {
  hideOrderBubble(cust);
  cust.state = 'PAID_LEAVING';
  reindexQueue();
  const coin = spawnCoin(cust.x, cust.y - 6, cust.orderRevenue, cust.orderTip);
  worker.pendingCoinId = coin.id;
  // ยิง event แทนเรียก addFeverProgress() ข้ามไฟล์ตรงๆ — fever.js subscribe เอง (ดู features/fever.js)
  GameEvents.emit(EVENTS.ORDER_DELIVERED, { cust, worker });
}


// ===== Coin Arc Physics =====
// worker แตะเหรียญ (pickupCoin) ไม่ได้เข้า Gold ทันที — เหรียญจะบินเป็นวิถีโค้งไปหา UI กล่อง Gold ก่อน
// แล้วค่อยบวกเข้า player.gold ตอนบินไปถึงจริงๆ เท่านั้น (finishCoinFlight) ตามที่ระบุ
const COIN_FLIGHT_DURATION_MS = 550;
const COIN_ARC_HEIGHT_PX = 46;

function pickupCoin(coin, worker) {
  playSfxCashRegister();
  spawnFloatText(
    coin.x, coin.y,
    coin.tip > 0 ? `+${Math.round(coin.value)} 🪙 (+${coin.tip} ทิป!)` : `+${Math.round(coin.value)} 🪙`,
    coin.tip > 0 ? 'tip' : 'gold'
  );
  player.stats.totalCustomersServed += 1;
  startCoinFlight(coin);
}

function startCoinFlight(coin) {
  const goldEl = document.getElementById('goldValue');
  const stageEl = document.getElementById('standStageView');
  const goldRect = goldEl.getBoundingClientRect();
  const stageRect = stageEl.getBoundingClientRect();
  coin.flying = true;
  coin.flightElapsed = 0;
  coin.startX = coin.x;
  coin.startY = coin.y;
  // แปลงตำแหน่ง UI กล่อง Gold (fixed ใน viewport) ให้เป็นพิกัดเดียวกับที่ใช้ตำแหน่งเหรียญ (สัมพัทธ์กับ standStageView)
  coin.targetX = goldRect.left - stageRect.left + goldRect.width / 2 - 13;
  coin.targetY = goldRect.top - stageRect.top + goldRect.height / 2 - 13;
  coin.el.classList.add('coin-flying');
}

function tickFlyingCoins(dt) {
  coins.forEach(coin => {
    if (!coin.flying) return;
    coin.flightElapsed += dt;
    const p = Math.min(1, coin.flightElapsed / COIN_FLIGHT_DURATION_MS);
    const x = coin.startX + (coin.targetX - coin.startX) * p; // แกน X วิ่งแบบ linear ตามที่ระบุ
    const easeY = 1 - Math.pow(1 - p, 3); // easeOutCubic แกน Y ให้ชะลอตอนใกล้ถึงเป้า ดูมีน้ำหนักโค้ง
    const arc = Math.sin(p * Math.PI) * COIN_ARC_HEIGHT_PX; // โป่งขึ้นกลางทางจำลองวิถีโค้ง (parabola)
    const y = coin.startY + (coin.targetY - coin.startY) * easeY - arc;
    coin.el.style.transform = `translate(${x}px, ${y}px) scale(${1 - p * 0.45})`;
    if (p >= 1) finishCoinFlight(coin);
  });
}

function bumpGoldCounter() {
  const el = document.querySelector('.gold-counter');
  el.classList.remove('bump');
  void el.offsetWidth; // force reflow กัน class เดิมค้าง เล่นแอนิเมชันซ้ำไม่ได้ถ้ากดรัวๆ
  el.classList.add('bump');
}

function finishCoinFlight(coin) {
  const total = coin.value + coin.tip;
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

