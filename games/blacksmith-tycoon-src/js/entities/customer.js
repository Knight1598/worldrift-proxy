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
  const isVIP = Math.random() < VIP_CHANCE; // Juicy Feature: ลูกค้า VIP — โอกาส 5%
  el.className = 'customer' + (isVIP ? ' vip' : '');
  el.innerHTML =
    '<div class="customer-patience-bg"><div class="customer-patience-fill"></div></div>' +
    '<div class="customer-bubble"><img alt=""></div>' +
    '<div class="customer-body"><img class="customer-img" alt=""></div>';
  el.querySelector('.customer-img').src = getRandomCustomerImg();
  document.getElementById('customerLane').appendChild(el);
  // จุดที่ 1: เกิดจากขอบล่างสุดของ Game Area (นอกจอ) แล้วเดินขึ้น — spawn ตรง X ของคิวที่จะไปยืนไว้เลย
  // เพื่อให้การเดินเข้าคิวเป็นแนวดิ่งตรงๆ ขึ้นมาหาเคาน์เตอร์ ไม่ใช่เดินเฉียงจากขอบขวาแบบเดิม
  const spawnX = queueSlotPos(slotIndex).x;
  const cust = {
    id, el, slotIndex, state: 'QUEUED', facing: 1,
    x: spawnX, y: scene.height + 40,
    orderIcon: null, orderRevenue: 0, orderTip: 0, patienceStartAt: 0,
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
  cust.el.style.transform = `translate(${cust.x}px, ${cust.y}px)`;
  cust.el.classList.toggle('facing-left', cust.facing === -1);
  cust.el.classList.toggle('moving', !!moving);
}
function showOrderBubble(cust) {
  const bubble = cust.el.querySelector('.customer-bubble');
  bubble.querySelector('img').src = cust.orderIcon;
  bubble.classList.add('show');
  cust.el.querySelector('.customer-patience-bg').classList.add('show');
}
function hideOrderBubble(cust) {
  cust.el.querySelector('.customer-bubble').classList.remove('show');
  cust.el.querySelector('.customer-patience-bg').classList.remove('show');
}
function updatePatienceBar(cust) {
  const elapsed = performance.now() - cust.patienceStartAt;
  const pct = Math.max(0, 1 - elapsed / PATIENCE_DURATION_MS);
  const fill = cust.el.querySelector('.customer-patience-fill');
  if (fill) fill.style.width = (pct * 100) + '%';
}
function removeCustomerEl(cust) {
  cust.el.remove();
  cust.state = 'REMOVED';
}


function tickCustomers(dt) {
  customers.forEach(cust => {
    if (cust.state === 'PAID_LEAVING') {
      // เดินกลับลงขอบล่างสุด (จุดเดียวกับที่เกิดขึ้นมา) แทนการเดินออกขอบขวาแบบเดิม
      const target = { x: cust.x, y: scene.height + 40 };
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

