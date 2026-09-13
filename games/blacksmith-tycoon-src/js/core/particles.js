/* =====================================================================
   Particle Pool — ระบบพาร์ทิเคิล DOM แบบ pool (VFX Pooling)
   เดิม: spark/confetti สร้าง element ใหม่ทุกครั้งแล้ว remove ทิ้ง — ตอน craft พร้อมกัน 5 คน
   สร้าง/ทำลาย node ~45 ตัว/วินาที กดดัน GC โดยไม่จำเป็น
   ใหม่: node ที่แอนิเมชันจบแล้วถูก "คืน pool" (display:none ค้างใน DOM) แล้วหยิบกลับมาใช้ซ้ำ
   — จำนวน node สูงสุดเท่ากับจำนวนพาร์ทิเคิลที่เคยโชว์พร้อมกันมากที่สุด ไม่โตไปเรื่อยๆ
   การคืนใช้ setTimeout ตามอายุพาร์ทิเคิลเป๊ะๆ (แอนิเมชันจบ = หายจากจอทันที ไม่มี node ผีค้าง)
   ===================================================================== */
const particlePool = { free: {}, created: 0, reused: 0 };

function acquireParticle(className, parent) {
  const bucket = particlePool.free[className] || (particlePool.free[className] = []);
  let el = bucket.pop();
  if (el) {
    particlePool.reused++;
    // รีสตาร์ทแอนิเมชัน CSS: ถอด class แล้ว force reflow ก่อนใส่กลับ (แพทเทิร์นเดียวกับ tap-bump)
    el.className = '';
    el.removeAttribute('style');
    void el.offsetWidth;
  } else {
    particlePool.created++;
    el = document.createElement('div');
  }
  el.className = className;
  if (el.parentNode !== parent) parent.appendChild(el);
  el.style.display = '';
  return el;
}

function releaseParticle(el, className) {
  el.style.display = 'none'; // ซ่อนแทน remove — node อยู่ใน DOM ต่อแต่ไม่ render/ไม่กิน layout
  (particlePool.free[className] || (particlePool.free[className] = [])).push(el);
}

// helper ยิงพาร์ทิเคิลอายุสั้น: หยิบจาก pool, ให้ผู้เรียกแต่งสไตล์, คืนอัตโนมัติเมื่อครบอายุ
function spawnParticle(className, parent, lifetimeMs, decorate) {
  const el = acquireParticle(className, parent);
  decorate(el);
  setTimeout(() => releaseParticle(el, className), lifetimeMs);
  return el;
}
