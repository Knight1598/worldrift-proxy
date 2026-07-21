/* =====================================================================
   Customer — เดินเข้าคิว / รอออเดอร์ / รับของ+จ่ายเงิน / เดินออก
   ===================================================================== */
let customers = [];

function getQueueCustomers() {
  return customers.filter(c => c.state !== 'PAID_LEAVING').sort((a, b) => a.slotIndex - b.slotIndex);
}
function reindexQueue() {
  getQueueCustomers().forEach((c, i) => { c.slotIndex = i; });
}
function getCustomerById(id) { return customers.find(c => c.id === id); }

function spawnCustomerEntity() {
  const slotIndex = getQueueCustomers().length;
  const id = 'cust' + (nextEntityId++);
  const el = document.createElement('div');
  const isVIP = Math.random() < getVipChance(); // Juicy Feature: ลูกค้า VIP — โอกาส 5% ปกติ (บัพ "แม่เหล็ก VIP" คูณ 3)
  el.className = 'customer' + (isVIP ? ' vip' : '');
  el.innerHTML =
    '<div class="customer-patience-bg"><div class="customer-patience-fill"></div></div>' +
    '<div class="customer-bubble"><img alt=""><span class="customer-bubble-qty"></span></div>' +
    '<div class="customer-body"><img class="customer-img" alt=""></div>';
  el.querySelector('.customer-img').src = getRandomCustomerImg();
  document.getElementById('customerLane').appendChild(el);
  // แก้บั๊กตัวละครทะลุพื้นผิว: เดิมลูกค้าเกิดใต้ขอบจอแล้วเดินขึ้น "ทะลุผ่าน" แท่งเคาน์เตอร์ (z-index สูงกว่า)
  // ให้เห็นตัวโผล่ทะลุโต๊ะชัดๆ ทุกครั้งที่เข้า/ออก — เปลี่ยนเป็นเดินเข้าจากขอบซ้าย/ขวาที่ "ระดับแถวคิวพอดี"
  // เดินแนวนอนเข้าช่องคิวของตัวเอง ไม่มีการข้ามผ่านผิวเคาน์เตอร์อีก (ออกก็เดินออกด้านข้างเช่นกัน)
  const targetSlot = queueSlotPos(slotIndex);
  const fromLeft = targetSlot.x < scene.width / 2;
  const cust = {
    id, el, slotIndex, state: 'QUEUED', facing: 1,
    x: fromLeft ? -50 : scene.width + 50, y: targetSlot.y,
    orderIcon: null, orderRevenue: 0, orderTip: 0, orderQty: 1, patienceStartAt: 0,
    isVIP,
  };
  customers.push(cust);
  renderCustomerTransform(cust, true);
  return cust;
}
function getCustomerWalkSpeed(cust) {
  return CUSTOMER_WALK_SPEED_PX * (cust.isVIP ? VIP_WALK_SPEED_MULT : 1);
}

function renderCustomerTransform(cust, moving) {
  // ปัดพิกัดตอนวาด (ซิมคงทศนิยมไว้) กัน sub-pixel blur + Y-sort ให้ตัวล่างทับตัวบนภายในเลนลูกค้า
  cust.el.style.transform = `translate(${Math.round(cust.x)}px, ${Math.round(cust.y)}px)`;
  cust.el.style.zIndex = Math.max(1, Math.round(cust.y));
  cust.el.classList.toggle('facing-left', cust.facing === -1);
  cust.el.classList.toggle('moving', !!moving);
}
function showOrderBubble(cust) {
  const bubble = cust.el.querySelector('.customer-bubble');
  bubble.querySelector('img').src = cust.orderIcon;
  // ป้าย x2/x3 ตอนสั่งมากกว่า 1 ชิ้น (แบบตัวเลขในบับเบิลของเกมต้นแบบ)
  const qtyEl = bubble.querySelector('.customer-bubble-qty');
  qtyEl.textContent = 'x' + (cust.orderQty || 1);
  qtyEl.classList.toggle('show', (cust.orderQty || 1) > 1);
  bubble.classList.add('show');
  cust.el.querySelector('.customer-patience-bg').classList.add('show');
}
function hideOrderBubble(cust) {
  cust.el.querySelector('.customer-bubble').classList.remove('show');
  cust.el.querySelector('.customer-patience-bg').classList.remove('show');
}
function updatePatienceBar(cust) {
  const duration = cust.patienceDurationMs || PATIENCE_DURATION_MS;
  const elapsed = performance.now() - cust.patienceStartAt;
  const pct = Math.max(0, 1 - elapsed / duration);
  const fill = cust.el.querySelector('.customer-patience-fill');
  if (fill) {
    fill.style.width = (pct * 100) + '%';
    fill.classList.toggle('patience-low', pct <= 0.35); // แดง+กะพริบตอนใกล้หมด (สื่อความเร่งด่วน)
  }
  // ปล่อยหลอดหมดขณะกำลังเสิร์ฟ = พลาด! คอมโบขาด + เสียทิป + ลูกค้าบึ้ง (ยิงครั้งเดียวต่อลูกค้า)
  if (pct <= 0 && !cust.patienceExpired) {
    cust.patienceExpired = true;
    cust.orderTip = 0;
    cust.el.classList.add('angry');
    GameEvents.emit(EVENTS.ORDER_MISSED, { cust });
  }
}
function removeCustomerEl(cust) {
  cust.el.remove();
  cust.state = 'REMOVED';
}


function tickCustomers(dt) {
  customers.forEach(cust => {
    if (cust.state === 'PAID_LEAVING') {
      // เดินออกขอบข้างที่ใกล้สุด ที่ระดับแถวคิวเดิม — ไม่เดินทะลุเคาน์เตอร์ (ดูคอมเมนต์ตอน spawn)
      const target = { x: cust.x < scene.width / 2 ? -60 : scene.width + 60, y: cust.y };
      const arrived = moveToward(cust, target, getCustomerWalkSpeed(cust) * 1.3, dt);
      renderCustomerTransform(cust, !arrived);
      if (arrived) removeCustomerEl(cust);
      return;
    }
    const target = queueSlotPos(cust.slotIndex);
    const arrived = moveToward(cust, target, getCustomerWalkSpeed(cust), dt);
    renderCustomerTransform(cust, !arrived);
    if (cust.state === 'ORDER_ACTIVE') updatePatienceBar(cust);
  });
  customers = customers.filter(c => c.state !== 'REMOVED');
}

