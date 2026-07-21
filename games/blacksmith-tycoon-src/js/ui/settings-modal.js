/* =====================================================================
   Settings Modal — เปิด/ปิดเสียง, รีเซ็ตเกม
   ===================================================================== */
function syncSettingsLabels() {
  document.getElementById('btnToggleSound').textContent = player.settings.soundEnabled ? 'เปิดอยู่' : 'ปิดอยู่';
  document.getElementById('btnToggleMusic').textContent = player.settings.musicEnabled ? 'เปิดอยู่' : 'ปิดอยู่';
}
document.getElementById('btnOpenSettings').addEventListener('click', () => {
  syncSettingsLabels();
  document.getElementById('settingsModal').classList.add('show');
});
document.getElementById('btnCloseSettings').addEventListener('click', () => {
  document.getElementById('settingsModal').classList.remove('show');
});
document.getElementById('btnToggleSound').addEventListener('click', () => {
  player.settings.soundEnabled = !player.settings.soundEnabled;
  syncSettingsLabels();
  saveGame();
});
document.getElementById('btnToggleMusic').addEventListener('click', () => {
  player.settings.musicEnabled = !player.settings.musicEnabled;
  syncSettingsLabels();
  if (player.settings.musicEnabled) startMusic(); else stopMusic();
  saveGame();
});
document.getElementById('btnReplayTutorial').addEventListener('click', () => {
  document.getElementById('settingsModal').classList.remove('show');
  openTutorial();
});
document.getElementById('btnResetGame').addEventListener('click', () => {
  if (!confirm('ยืนยันรีเซ็ตเกม? ความคืบหน้าทั้งหมดจะหายไป')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  try { localStorage.removeItem(SAVE_KEY_V5); } catch (e) {} // กันเซฟ v5 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  try { localStorage.removeItem(SAVE_KEY_V4); } catch (e) {} // กันเซฟ v4 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  try { localStorage.removeItem(SAVE_KEY_V3); } catch (e) {} // กันเซฟ v3 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  try { localStorage.removeItem(SAVE_KEY_V2); } catch (e) {} // กันเซฟ v2 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  try { localStorage.removeItem(SAVE_KEY_V1); } catch (e) {} // กันเซฟ v1 เก่าฟื้นคืนชีพตอนโหลดครั้งถัดไป
  location.reload();
});
