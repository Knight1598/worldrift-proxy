/* =====================================================================
   Scene zones — Station อยู่บน (หลังร้าน) / เคาน์เตอร์+คิวอยู่ล่าง (หน้าร้าน) ตามผัง Eatventure
   คำนวณจากขนาดจริงของ .game-area เพื่อรองรับ resize/responsive
   ===================================================================== */
const scene = { width: 300, height: 400 };
// จุดที่ 4 สถานีผลิต (บน) -> จุดที่ 3 พื้นที่ว่างให้เดินขึ้นลง (กลาง) -> จุดที่ 2 เคาน์เตอร์ (ล่าง ใกล้จุดเกิดลูกค้า)
// ทุกจุด center แนวนอนที่ 0.5 ของความกว้างเหมือนกันหมด ตามที่ระบุ
// stationYPct ขยับขึ้นจาก 0.22 -> 0.13 ให้เท้าตัวละครไปชนขอบล่างภาพ Station พอดี (แต่เดิมมีช่องว่างเยอะ
// ทำให้ขอบหน้าโต๊ะ (stand-booth-front) ไม่ได้ซ้อนทับขาตัวละครเลยตามที่ตั้งใจ)
const ZONES = { stationXPct: 0.5, stationYPct: 0.13, counterYPct: 0.80, idleYPct: 0.52 };

function updateSceneMetrics() {
  const view = document.getElementById('standStageView');
  if (!view) return;
  scene.width = view.clientWidth || scene.width;
  scene.height = view.clientHeight || scene.height;
}
// Multi-Staff: จนถึง 5 worker พร้อมกัน (ผู้เล่น + ลูกมือ 4 คน) ต้องจัดตำแหน่งยืนแบบสมมาตรรอบจุดกึ่งกลาง
// แทนการไล่ offset จาก workerIndex ตรงๆ แบบเดิม (ซึ่งพอมี worker เกิน 2 คนจะเบียดไปทางขวาจนล้นจอ)
// ใช้ getWorkerCount() (ไม่ใช่ workers.length ขณะนั้น) เป็นตัวตั้งจำนวนรวม กัน bug ตอน addWorker ที่ผลลัพธ์
// ของ workers.length ยังไม่รวมตัวที่กำลังจะถูก push เข้าไป
function workerOffsetX(workerIndex, spacing) {
  const total = Math.max(1, getWorkerCount());
  const centeredIndex = workerIndex - (total - 1) / 2;
  return centeredIndex * spacing;
}
const STATION_WORKER_SPACING_PX = 60;
const IDLE_WORKER_SPACING_PX = 50;
// Multi-Station: สถานีหลักอยู่กลาง สถานีเสริมซ้าย/ขวา (แนว X เป็น % ของความกว้างฉาก)
// สถานีเสริมใช้ระยะห่าง worker แคบกว่า + clamp กันหลุดขอบจอบนจอแคบ
const STATION_XS = [0.5, 0.2, 0.8];
function stationPos(workerIndex, stationIndex) {
  const si = stationIndex || 0;
  const spacing = si === 0 ? STATION_WORKER_SPACING_PX : 34;
  const x = scene.width * STATION_XS[si] + workerOffsetX(workerIndex, spacing);
  return { x: Math.max(24, Math.min(scene.width - 24, x)), y: scene.height * ZONES.stationYPct };
}
function counterLineY() {
  return scene.height * ZONES.counterYPct;
}
function idlePos(workerIndex) {
  return { x: scene.width * 0.5 + workerOffsetX(workerIndex, IDLE_WORKER_SPACING_PX), y: scene.height * ZONES.idleYPct };
}
// เดิมให้ลูกค้ายืน y=counterLineY() พอดี (จุด "บน"/หัวของสไปรต์) ทำให้ตัวลูกค้าเกือบทั้งตัวอยู่ใต้เส้นเคาน์เตอร์
// เห็นแค่หัวไปชนขอบเคาน์เตอร์นิดเดียว ไม่ใช่ขา — ขยับขึ้น (ลด y) ให้ขา/เท้า (ส่วนล่างสุดของสไปรต์สูง 101px)
// ไปตกอยู่ในช่วงความสูงจริงของเคาน์เตอร์ (26px) แทน ให้ .shop-counter (z-index สูงกว่า customer-lane) บังขาไว้จริงๆ
const CUSTOMER_LEG_OVERLAP_PX = 75;

// จุดที่ 1: คิวลูกค้าเรียงเป็นแถวแนวนอนหน้าเคาน์เตอร์ แต่จัดทั้งแถว "กึ่งกลางจอ" แทนการเริ่มจากขอบขวาแบบเดิม
// ตำแหน่งคงที่ตาม maxSlots (ไม่ใช่จำนวนคิวปัจจุบัน) กันไม่ให้ลูกค้าที่ยืนอยู่แล้วขยับตำแหน่งเมื่อคิวอื่นเข้า/ออก
function queueSlotPos(slotIndex) {
  const y = counterLineY() - CUSTOMER_LEG_OVERLAP_PX;
  const maxSlots = Math.max(1, getMaxQueueSize());
  const usableWidth = Math.max(60, scene.width - 40);
  const spacing = Math.min(56, usableWidth / maxSlots);
  const totalWidth = spacing * maxSlots;
  const startX = (scene.width - totalWidth) / 2 + spacing / 2;
  const x = Math.max(20, Math.min(scene.width - 20, startX + slotIndex * spacing));
  return { x, y };
}

function moveToward(entity, target, speedPxPerSec, dt) {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const dist = Math.hypot(dx, dy);
  const step = speedPxPerSec * (dt / 1000);
  if (dist <= step || dist < 0.5) {
    entity.x = target.x;
    entity.y = target.y;
    return true;
  }
  entity.x += (dx / dist) * step;
  entity.y += (dy / dist) * step;
  if (Math.abs(dx) > 0.5) entity.facing = dx < 0 ? -1 : 1;
  return false;
}
