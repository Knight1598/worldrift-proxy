/* =====================================================================
   Event Type registry — ชื่อ event ทั้งหมดที่ใช้ผ่าน GameEvents รวมไว้จุดเดียว
   กันพิมพ์ผิด/สะกดต่างกันระหว่างไฟล์ที่ emit กับไฟล์ที่ subscribe
   ===================================================================== */
const EVENTS = {
  ORDER_DELIVERED:   'order:delivered',    // deliverOrder() — { cust, worker }
  COIN_COLLECTED:    'coin:collected',     // finishCoinFlight() — { amount }
  UPGRADE_PURCHASED: 'upgrade:purchased',  // buyUpgrade() — { key, level }
  MILESTONE_REACHED: 'upgrade:milestone',  // checkMilestone() — { key, level, mult, displayName }
  STAGE_ADVANCED:    'stage:advanced',     // advanceStage()
  STAFF_HIRED:       'staff:hired',        // hireHelper() — { staffCount }
  VAULT_UPGRADED:    'vault:upgraded',     // buyVaultLevel() — { vaultLevel }
  GOBLIN_CAUGHT:     'goblin:caught',      // catchGoblin() — { reward }
  FEVER_ACTIVATED:   'fever:activated',    // activateFever()
  FEVER_ENDED:       'fever:ended',        // tickFever() เมื่อหมดเวลา
  FEVER_PROGRESS:    'fever:progress',     // addFeverProgress()/บัพ fever_now — { progress } (ui/hud.js วาดแถบเอง)
  MATERIAL_CONSUMED:  'material:consumed',  // consumeMaterials() — { material, qty, remaining }
  MATERIAL_RESTOCKED: 'material:restocked', // tickMaterialRegen() — { material, stock }
  ORDER_SERVED:       'order:served',       // pickupCoin() — {} (นับ order ที่เสิร์ฟจบสมบูรณ์ ใช้กับ Order Missions)
  MISSION_COMPLETED:  'mission:completed',  // tickMissionProgress() — { missionIndex, reward }
  BUFF_ROLLED:        'buff:rolled',        // rollBuff() — { buff }
  BUFF_ENDED:         'buff:ended',         // tickBuffs() เมื่อ buff แบบ duration หมดเวลา
  STATION_UNLOCKED:   'station:unlocked',   // buyStationUnlock() — { stationIndex }
  STATION_UPGRADED:   'station:upgraded',   // buyStationLevel() — { stationIndex, level }
  GIFT_OPENED:        'gift:opened',        // openGiftBox() — { kind }
};
