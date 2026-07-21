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
  EQUIPMENT_UPGRADED: 'equipment:upgraded', // buyEquipmentUpgrade() — { slot, tier }
  STATION_UNLOCKED:   'station:unlocked',   // buyStationUnlock() — { stationIndex }
  STATION_UPGRADED:   'station:upgraded',   // buyStationLevel() — { stationIndex, level }
  GIFT_OPENED:        'gift:opened',        // openGiftBox() — { kind }
  PRESTIGE_DONE:      'prestige:done',      // doPrestige() — { renownGained, totalRenown }
  RENOWN_UPGRADE_BOUGHT: 'renown:upgraded', // buyRenownUpgrade() — { key, level }
  ACHIEVEMENT_CLAIMED: 'achievement:claimed', // claimAchievement() — { key }
  DAILY_CLAIMED:       'daily:claimed',       // claimDaily() — { streak, reward }
  OBJECTIVE_COMPLETED: 'objective:completed', // checkObjectives() — { key, reward } (เควสนำทาง ดู systems/objectives.js)
  COMBO_CHANGED:      'combo:changed',       // registerServe()/breakCombo() — { combo } (Active Rush ดู features/combo.js)
  RUSH_STARTED:       'rush:started',        // startRush() — {}
  RUSH_ENDED:         'rush:ended',          // endRush() — {}
  ORDER_MISSED:       'order:missed',        // ลูกค้าหมดความอดทนขณะกำลังเสิร์ฟ — { cust } (คอมโบขาด+เสียทิป)
};
