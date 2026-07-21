/* =====================================================================
   Event Bus — pub/sub กลาง กัน tight coupling ระหว่างไฟล์ (เช่น เดิม economy.js
   ต้องเรียก addFeverProgress()/render*() ข้ามไฟล์ตรงๆ ทุกจุดที่มีผลกระทบใหม่)
   ต้องโหลดก่อนไฟล์อื่นทั้งหมด (ดูลำดับ <script> ใน index.html) เพราะไฟล์อื่นๆ
   หลายไฟล์ subscribe ผ่าน GameEvents.on(...) ที่ระดับบนสุดของไฟล์ (ทำงานทันทีตอนโหลด)

   ใช้เฉพาะเหตุการณ์ที่เป็น "จุดๆ" ที่ระบบอื่นอยากรู้ (ซื้ออัปเกรด, ส่งออเดอร์สำเร็จ, ฯลฯ)
   ไม่ใช้แทน game loop ต่อเฟรม (tickWorkers/tickCustomers ยังเรียกตรงๆ เหมือนเดิม)
   ===================================================================== */
const GameEvents = (() => {
  const listeners = {};
  function on(event, handler) {
    (listeners[event] ||= []).push(handler);
    return () => off(event, handler); // คืนฟังก์ชัน unsubscribe ให้เผื่ออนาคตต้องใช้
  }
  function off(event, handler) {
    if (listeners[event]) listeners[event] = listeners[event].filter(h => h !== handler);
  }
  function emit(event, payload) {
    (listeners[event] || []).slice().forEach(h => h(payload));
  }
  return { on, off, emit };
})();
