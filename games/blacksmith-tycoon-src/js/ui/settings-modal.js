/* =====================================================================
   Settings Modal — เปิด/ปิดเสียง, รีเซ็ตเกม
   ===================================================================== */
document.getElementById('btnOpenSettings').addEventListener('click', () => {
  document.getElementById('btnToggleSound').textContent = player.settings.soundEnabled ? 'เปิดอยู่' : 'ปิดอยู่';
  document.getElementById('settingsModal').classList.add('show');
});
document.getElementById('btnCloseSettings').addEventListener('click', () => {
  document.getElementById('settingsModal').classList.remove('show');
});
document.getElementById('btnToggleSound').addEventListener('click', () => {
  player.settings.soundEnabled = !player.settings.soundEnabled;
  document.getElementById('btnToggleSound').textContent = player.settings.soundEnabled ? 'เปิดอยู่' : 'ปิดอยู่';
  saveGame();
});
document.getElementById('btnResetGame').addEventListener('click', () => {
  if (!confirm('ยืนยันรีเซ็ตเกม? ความคืบหน้าทั้งหมดจะหายไป')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  try { localStorage.removeItem(SAVE_KEY_V4); } catch (e) {} // กันเซฟ v4 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  try { localStorage.removeItem(SAVE_KEY_V3); } catch (e) {} // กันเซฟ v3 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  try { localStorage.removeItem(SAVE_KEY_V2); } catch (e) {} // กันเซฟ v2 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  try { localStorage.removeItem(SAVE_KEY_V1); } catch (e) {} // กันเซฟ v1 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  location.reload();
});
