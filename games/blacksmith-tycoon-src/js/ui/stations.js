/* =====================================================================
   Side Stations + Upgrade Arrows — Multi-Station แบบเกมต้นแบบ
   - โต๊ะสถานีเสริม 2 ตัว (ซ้าย/ขวาของสถานีหลัก): ล็อกอยู่ = โชว์ 🔒 + ราคาปลดล็อก แตะเพื่อซื้อ
     ปลดล็อกแล้ว = โชว์ไอคอนสินค้า + เลเวล แตะเพื่อเปิดป๊อปอัพเลเวลของสถานีนั้น
   - ลูกศร ⬆️ เด้งบนสถานี (รวมสถานีหลัก) เมื่อ "ซื้อไหว" (ปลดล็อก/อัปเลเวลถัดไป) — แบบ frame ในคลิป
   ตำแหน่งอิง STATION_XS (scene.js) เป็น % เดียวกับจุดที่ worker เดินไปยืนคราฟต์จริง
   ===================================================================== */
function renderSideStations() {
  const wrap = document.getElementById('sideStations');
  wrap.innerHTML = '';
  [1, 2].forEach(i => {
    const def = getStationDef(i);
    const unlocked = isStationUnlocked(i);
    const el = document.createElement('div');
    el.className = 'station-side' + (unlocked ? '' : ' station-side--locked');
    el.style.left = (STATION_XS[i] * 100) + '%';
    if (unlocked) {
      el.innerHTML =
        `<img class="station-side-icon" src="${getStationIcon(i)}" alt="">` +
        `<span class="station-side-level pixel-num">Lv ${getStationLevel(i)}</span>` +
        `<div class="station-side-table"></div>`;
      el.title = `${def.name} — แตะเพื่ออัปเกรด`;
      el.addEventListener('click', () => openProductLevelModal(i));
    } else {
      const cost = getStationUnlockCost(i);
      const affordable = player.gold >= cost;
      el.innerHTML =
        `<span class="station-side-lock">🔒</span>` +
        `<span class="station-side-cost ${affordable ? 'ok' : ''}">${cost.toLocaleString()} 🪙</span>` +
        `<div class="station-side-table station-side-table--ghost"></div>`;
      el.title = `ปลดล็อก ${def.name} (${cost.toLocaleString()} Gold)`;
      el.addEventListener('click', () => buyStationUnlock(i));
    }
    wrap.appendChild(el);
  });
}

// ลูกศรอัปเกรดลอยบนสถานี (แบบวงกลมลูกศรแดงในคลิป) — โชว์เฉพาะตอนซื้อไหว แตะแล้วทำ action ของสถานีนั้นเลย
function renderStationArrows() {
  const wrap = document.getElementById('stationArrows');
  wrap.innerHTML = '';
  [0, 1, 2].forEach(i => {
    let affordable, onTap;
    if (!isStationUnlocked(i)) {
      affordable = player.gold >= getStationUnlockCost(i);
      onTap = () => buyStationUnlock(i);
    } else {
      const maxed = getStationLevel(i) >= getUpgradeType('portion').maxLevel;
      affordable = !maxed && player.gold >= getStationUpgradeCost(i);
      onTap = () => openProductLevelModal(i);
    }
    if (!affordable) return;
    const arrow = document.createElement('button');
    arrow.className = 'station-arrow';
    arrow.textContent = '⬆️';
    arrow.style.left = (STATION_XS[i] * 100) + '%';
    arrow.addEventListener('click', onTap);
    wrap.appendChild(arrow);
  });
}

function refreshStationsUi() {
  renderSideStations();
  renderStationArrows();
}

GameEvents.on(EVENTS.COIN_COLLECTED, () => renderStationArrows());
GameEvents.on(EVENTS.UPGRADE_PURCHASED, () => refreshStationsUi());
GameEvents.on(EVENTS.STATION_UNLOCKED, () => refreshStationsUi());
GameEvents.on(EVENTS.STATION_UPGRADED, () => refreshStationsUi());
GameEvents.on(EVENTS.STAGE_ADVANCED, () => refreshStationsUi());
GameEvents.on(EVENTS.BUFF_ROLLED, () => refreshStationsUi());  // discount เปลี่ยนราคาปลดล็อก/อัปเลเวล
GameEvents.on(EVENTS.BUFF_ENDED, () => refreshStationsUi());
GameEvents.on(EVENTS.GOBLIN_CAUGHT, () => renderStationArrows());
