/* =====================================================================
   Number formatting — กันตัวเลขยาวทะลุ UI ตอนเงินโตระดับล้านล้าน (Extreme Value Safety)
   ต่ำกว่า 100,000 โชว์เต็มพร้อม comma (อ่านง่ายช่วงต้นเกม) เกินนั้นย่อเป็น K/M/B/T/Q
   ===================================================================== */
const COMPACT_UNITS = [
  { value: 1e15, suffix: 'Q' },
  { value: 1e12, suffix: 'T' },
  { value: 1e9,  suffix: 'B' },
  { value: 1e6,  suffix: 'M' },
  { value: 1e3,  suffix: 'K' },
];
function formatCompact(n) {
  if (!isFinite(n)) return '∞';
  const neg = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs < 100000) return neg + Math.floor(abs).toLocaleString();
  for (const u of COMPACT_UNITS) {
    if (abs >= u.value) {
      const scaled = abs / u.value;
      // 1 ตำแหน่งทศนิยมพอ (24.3B) ตัด .0 ทิ้งให้สั้น (24B)
      const txt = scaled >= 100 ? Math.floor(scaled).toString() : (Math.floor(scaled * 10) / 10).toString();
      return neg + txt.replace(/\.0$/, '') + u.suffix;
    }
  }
  return neg + Math.floor(abs).toLocaleString();
}
