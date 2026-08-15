/**
 * ระบบติดตามสถานะการกระตุ้นแบตเตอรี่ (ฉบับแยกโปรเจกต์)
 *
 * ใช้คู่กับไฟล์ Battery.html — มีแค่ 2 ไฟล์เท่านั้น
 * ระบบนี้แยกขาดจากระบบบันทึกส่งอะไหล่ ใช้ไฟล์ชีตของตัวเอง
 * ลิงก์ที่ส่งให้สาขาจึงแตะข้อมูลการส่งของไม่ได้เลย
 *
 * ดูขั้นตอนติดตั้งใน README.md
 */

var SHEETS = {
  BRANCHES: 'Branches',
  BATTERIES: 'Batteries',
  REPAIRS: 'Repairs',
  REPAIR_EVIDENCE: 'RepairEvidence'
};

var HEADERS = {
  Branches: ['branchCode', 'branchName', 'zone', 'active'],
  Batteries: [
    'batteryId', 'receivedDate', 'alNo', 'branch', 'zone', 'serial', 'model', 'qty',
    'status', 'note', 'updatedAt', 'updatedBy',
    'deliveredAt', 'receiver', 'deliveryNote', 'deliveryPhotoId'
  ],
  /**
   * คอลัมน์ชุดหลังของ Repairs (BranchCode ถึง ReceivedAt) เพิ่มมาเพื่อรับรถจากสาขาอื่น
   * โปรเจกต์ฟอร์มสาขาอื่นใช้ชื่อคอลัมน์ชุดเดียวกันนี้ ห้ามเปลี่ยนชื่อข้างเดียว
   *
   * JobOpenedDate / DispatchedAt มาจากฟอร์มสาขาอื่นเช่นกัน (วันที่เปิดจ๊อบ + เวลาที่กดส่ง)
   * ส่วน RepairDoneAt ระบบนี้ประทับเองตอนสถานะเพิ่งเปลี่ยนเป็น "ซ่อมเสร็จแล้ว"
   * ทั้งสามใช้คำนวณระยะเวลาแต่ละขั้นบนการ์ด (ดู repairTimelineLines ใน Battery.html)
   *
   * ต่อท้ายไว้ด้านขวาโดยเจตนา ลำดับคอลัมน์เดิมจึงไม่ขยับ
   */
  Repairs: [
    'repairId', 'receivedDate', 'jobNo', 'contractNo', 'vehicleModel', 'branch', 'zone',
    'status', 'note', 'updatedAt', 'updatedBy',
    'BranchCode', 'PlateNo', 'Source', 'EvidenceImage', 'ReceivedBy', 'ReceivedAt',
    'JobOpenedDate', 'DispatchedAt', 'RepairDoneAt'
  ],
  /**
   * รูปหลักฐานทุกขั้นตอนของงานซ่อม — หนึ่งแถวต่อหนึ่งรูป หนึ่งรายการซ่อมมีได้หลายแถว
   * (ต่างจาก EvidenceImage ในชีต Repairs ที่เก็บได้แค่รูปเดียวตอนสาขาส่งมา)
   * label คือชื่อขั้นตอนตอนถ่ายรูปนั้น เช่น "รับรถเข้า", "รออะไหล่", "ซ่อมเสร็จแล้ว"
   * photoId คือ Drive file id ไม่ใช่ URL ตรง ๆ — ไฟล์เก็บเป็นส่วนตัว เปิดผ่าน ?revimg= เท่านั้น
   */
  RepairEvidence: ['evidenceId', 'repairId', 'at', 'label', 'photoId', 'updatedBy']
};

/** คอลัมน์ที่ต้องบังคับให้ชีตเก็บเป็นข้อความ ไม่งั้น Sheets จะแปลงเป็นวันที่/ตัวเลขให้เอง */
var TEXT_COLUMNS = {
  Branches: ['branchCode'],
  Batteries: ['receivedDate', 'alNo', 'serial', 'updatedAt', 'deliveredAt'],
  Repairs: ['receivedDate', 'jobNo', 'contractNo', 'updatedAt', 'BranchCode', 'PlateNo', 'ReceivedAt',
            'JobOpenedDate', 'DispatchedAt', 'RepairDoneAt'],
  RepairEvidence: ['evidenceId', 'repairId', 'at', 'photoId']
};

/** ขั้นตอนการกระตุ้นแบตเตอรี่ เรียงตามลำดับงานจริง */
var BATTERY_STATUSES = [
  'รอต่อคิวกระตุ้น',
  'กำลังกระตุ้น',
  'กระตุ้นเสร็จแล้ว',
  'รอจัดส่ง',
  'จัดส่งแล้ว'
];

/** ชื่อสถานะเดิมที่เลิกใช้แล้ว → ชื่อใหม่ (setupSheets จะไล่แก้ข้อมูลเก่าให้) */
var STATUS_RENAMES = { 'กำลังจัดส่ง': 'จัดส่งแล้ว' };

/** สถานะที่ต้องมีใบบันทึกการจัดส่งกำกับ */
var DELIVERED_STATUS = 'จัดส่งแล้ว';

var DELIVERY_FOLDER_NAME = 'หลักฐานการจัดส่งแบตเตอรี่';

/** โฟลเดอร์เก็บรูปหลักฐานทุกขั้นตอนของงานซ่อม (รับรถ/เปลี่ยนสถานะ/สร้างรายการใหม่) */
var REPAIR_EVIDENCE_FOLDER_NAME = 'หลักฐานขั้นตอนรถส่งซ่อม';

/**
 * ขั้นตอนการซ่อมรถ เรียงจากยังไม่ได้ลงมือ → ติดของ (อะไหล่/แบต) → กำลังทำ → เสร็จ
 * ตัวแรกเป็นสถานะตั้งต้นของรายการที่คีย์ในระบบนี้ จึงต้องเป็น 'รอซ่อม' เสมอ
 *
 * 'รอกระตุ้นแบต' คือรถที่ต้องกระตุ้นแบต 12V ก่อนถึงจะซ่อมต่อได้ — เหตุติดขัดคนละแบบกับ
 * 'รออะไหล่' จึงแยกสถานะไว้ต่างหาก (ไม่เกี่ยวกับระบบติดตามแบตเตอรี่แยกก้อนในแท็บ "แบตเตอรี่")
 *
 * 'รอรับรถ (กำลังจัดส่ง)' ต่อไว้ท้ายสุด — เป็นสถานะของรถที่สาขาอื่นกดส่งมาแล้ว
 * แต่สาขาหลักยังไม่กดรับเข้า ตั้งได้จากฟอร์มสาขาอื่นเท่านั้น
 * ชื่อสถานะนี้ต้องตรงกับในโปรเจกต์ฟอร์มสาขาอื่นเป๊ะ ๆ ห้ามแก้ข้างเดียว
 */
var REPAIR_STATUSES = [
  'รอซ่อม',
  'รออะไหล่',
  'รอกระตุ้นแบต',
  'กำลังซ่อม',
  'ซ่อมเสร็จแล้ว',
  'รอรับรถ (กำลังจัดส่ง)'
];

/** สถานะของรถที่สาขาอื่นส่งมาแล้วรอสาขาหลักกดรับ */
var INCOMING_STATUS = 'รอรับรถ (กำลังจัดส่ง)';

/** สถานะหลังกดรับรถเข้าซ่อมแล้ว */
var RECEIVED_STATUS = 'รอซ่อม';

/** สถานะซ่อมเสร็จ — ใช้ประทับ/ล้าง RepairDoneAt ตอนสถานะเปลี่ยนเข้า-ออกจากขั้นนี้ */
var REPAIR_DONE_STATUS = 'ซ่อมเสร็จแล้ว';

/**
 * รหัสเข้าโหมดแอดมิน — แก้ได้ที่บรรทัดนี้บรรทัดเดียว
 * เปลี่ยนแล้วต้อง Deploy เวอร์ชันใหม่ รหัสเดิมจะใช้ไม่ได้ทันที
 *
 * รหัสสั้นแบบนี้เดาได้ไม่ยาก ถ้าวันไหนอยากให้แน่นขึ้น
 * ตั้งเป็นรหัสที่ยาวกว่านี้ หรือปล่อยว่าง ('') แล้วระบบจะออกกุญแจสุ่มให้เอง
 * (ดูกุญแจที่ออกให้ได้จาก showBatteryLinks)
 */
var ADMIN_CODE = '907907';

var TZ = 'Asia/Bangkok';

/* =======================================================================
 * ส่วนที่ 1 — ตัวช่วยพื้นฐาน
 * ===================================================================== */

function props_() {
  return PropertiesService.getScriptProperties();
}

function prop_(key) {
  var v = props_().getProperty(key);
  return (v === null) ? '' : v;
}

function getSpreadsheet_() {
  var id = prop_('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error('หาไฟล์ชีตไม่เจอ — ถ้าสคริปต์ไม่ได้ผูกกับชีต ให้ตั้งค่า SPREADSHEET_ID ใน Script Properties');
  }
  return ss;
}

function getSheet_(name) {
  var sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีต "' + name + '" — ให้รันฟังก์ชัน setupSheets() ก่อน');
  return sh;
}

function todayIso_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * อ่านลำดับคอลัมน์จาก "หัวตารางจริงในชีต" ไม่ใช่เดาจากลำดับใน HEADERS
 *
 * ถ้าเดาจากลำดับ พอเพิ่มคอลัมน์ใหม่แล้วยังไม่ได้รัน setupSheets ข้อมูลทุกช่อง
 * จะเลื่อนไปหนึ่งตำแหน่ง (ชื่อสาขาไปโผล่ช่องรุ่นรถ เขตไปโผล่ช่องสาขา ฯลฯ)
 * ยึดตามชื่อหัวตารางแทน ต่อให้คอลัมน์สลับที่หรือยังไม่มี ก็ไม่หยิบข้อมูลผิดช่อง
 *
 * คอลัมน์ที่หัวตารางยังไม่มี จะได้ -1 = ถือว่าไม่มีข้อมูล ไม่ไปแอบอ่านช่องข้าง ๆ
 */
function sheetLayout_(sh, sheetName) {
  var index = {};
  var lastCol = sh.getLastColumn();
  if (lastCol > 0) {
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < head.length; c++) {
      var name = String(head[c] == null ? '' : head[c]).trim();
      if (name && index[name] === undefined) index[name] = c;
    }
  }
  HEADERS[sheetName].forEach(function (f) {
    if (index[f] === undefined) index[f] = -1;
  });
  return { index: index, lastCol: lastCol };
}

/** เลขคอลัมน์ (เริ่มที่ 1) ของฟิลด์หนึ่งตามหัวตารางจริง */
function fieldCol_(sh, sheetName, field) {
  var at = sheetLayout_(sh, sheetName).index[field];
  if (at < 0) {
    throw new Error('ชีต ' + sheetName + ' ยังไม่มีคอลัมน์ ' + field + ' — ให้รัน setupSheets() ก่อน');
  }
  return at + 1;
}

/** อ่านทุกแถวของชีตออกมาเป็นออบเจ็กต์ ตามชื่อคอลัมน์ในหัวตาราง */
function readRows_(sheetName) {
  var sh = getSheet_(sheetName);
  var last = sh.getLastRow();
  if (last < 2) return [];

  var layout = sheetLayout_(sh, sheetName);
  var width = Math.max(1, sh.getLastColumn());
  var values = sh.getRange(2, 1, last - 1, width).getValues();

  var out = [];
  for (var i = 0; i < values.length; i++) {
    var rec = { _row: i + 2 };
    HEADERS[sheetName].forEach(function (f) {
      var c = layout.index[f];
      rec[f] = c >= 0 ? cellText_(values[i][c]) : '';
    });
    out.push(rec);
  }
  return out;
}

/**
 * เติมคอลัมน์ที่หัวตารางยังไม่มีให้ครบ โดย "ต่อท้ายด้านขวา" ไม่ขยับข้อมูลเดิมแม้แต่ช่องเดียว
 *
 * จำเป็นเพราะเวลาเพิ่มฟิลด์ใหม่ในระบบ (เช่น รุ่นรถ) แต่ชีตของจริงยังไม่มีคอลัมน์นั้น
 * ตัวเขียนข้อมูลจะข้ามฟิลด์นั้นไปเงียบ ๆ — บันทึกผ่าน แต่ค่าหายไปเลย
 * คืนรายชื่อคอลัมน์ที่เพิ่งเติม (ไม่มีอะไรต้องเติมก็คืนอาร์เรย์ว่าง)
 */
function ensureColumns_(sh, sheetName) {
  var layout = sheetLayout_(sh, sheetName);
  var missing = HEADERS[sheetName].filter(function (f) { return layout.index[f] < 0; });
  if (!missing.length) return [];

  var start = Math.max(layout.lastCol, 0) + 1;
  var need = start + missing.length - 1;
  var maxCols = sh.getMaxColumns();
  if (maxCols < need) sh.insertColumnsAfter(Math.max(maxCols, 1), need - maxCols);

  sh.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold');
  console.warn('เติมคอลัมน์ที่ขาดในชีต ' + sheetName + ': ' + missing.join(', '));
  return missing;
}

/** ชีตที่พร้อมเขียน — เติมคอลัมน์ที่ขาดให้ก่อน ค่าที่กรอกมาจะได้ไม่หายกลางทาง */
function getWritableSheet_(name) {
  var sh = getSheet_(name);
  ensureColumns_(sh, name);
  return sh;
}

/** เรียงค่าลงแถวตามหัวตารางจริงของชีต */
function toRowValues_(sh, sheetName, rec) {
  var layout = sheetLayout_(sh, sheetName);
  var width = Math.max(layout.lastCol, HEADERS[sheetName].length);
  var row = [];
  for (var i = 0; i < width; i++) row.push('');
  HEADERS[sheetName].forEach(function (f) {
    var c = layout.index[f];
    if (c >= 0 && c < width) row[c] = rec[f] === undefined ? '' : rec[f];
  });
  return row;
}

/**
 * อ่านค่าจากช่องในชีตให้ออกมาเป็นข้อความเสมอ
 * Sheets ชอบแปลง "2026-08-01" เป็นวันที่ และ "12" เป็นตัวเลขให้เอง
 * ถ้าเอา String() ครอบตรง ๆ วันที่จะกลายเป็น "Sat Aug 01 2026 00:00:00 GMT+0700"
 */
function cellText_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
    return Utilities.formatDate(v, TZ, hasTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
  }
  return String(v).trim();
}

/** ถือว่า active เว้นแต่จะระบุชัดว่าไม่ใช้ */
function isActive_(v) {
  if (v === '' || v === null || v === undefined) return true;
  var s = String(v).trim().toUpperCase();
  return s !== 'FALSE' && s !== 'NO' && s !== '0' && s !== 'ไม่' && s !== 'ปิด';
}

/**
 * ทำรหัสสาขาให้เป็นเลข 4 หลักเสมอ (1 -> 0001, 12 -> 0012)
 * Google Sheets มองค่าอย่าง "0132" เป็นตัวเลขแล้วตัด 0 นำหน้าทิ้ง
 */
function padBranchCode_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (!/^\d+$/.test(s)) return s;
  while (s.length < 4) s = '0' + s;
  return s;
}

/* =======================================================================
 * ส่วนที่ 2 — รายชื่อสาขา
 * ===================================================================== */

var BRANCH_CACHE_KEY = 'branches_v1';

function getBranches_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(BRANCH_CACHE_KEY);
  if (hit) {
    try {
      return JSON.parse(hit);
    } catch (err) {
      // แคชเสีย อ่านใหม่จากชีต
    }
  }

  var sh = getSheet_(SHEETS.BRANCHES);
  var last = sh.getLastRow();
  var out = [];
  if (last > 1) {
    var values = sh.getRange(2, 1, last - 1, HEADERS.Branches.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var name = String(values[i][1] == null ? '' : values[i][1]).trim();
      if (!name || !isActive_(values[i][3])) continue;
      out.push({
        code: padBranchCode_(values[i][0]),
        name: name,
        zone: String(values[i][2] == null ? '' : values[i][2]).trim()
      });
    }
  }

  try {
    cache.put(BRANCH_CACHE_KEY, JSON.stringify(out), 300);
  } catch (err) {
    // ข้อมูลใหญ่เกินโควตาแคช ก็อ่านจากชีตทุกครั้งแทน
  }
  return out;
}

function clearBranchCache_() {
  try {
    CacheService.getScriptCache().remove(BRANCH_CACHE_KEY);
  } catch (err) {
    // ไม่เป็นไร
  }
}

function findBranch_(name) {
  var key = String(name || '').trim();
  var list = getBranches_();
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === key) return list[i];
  }
  return null;
}

/* =======================================================================
 * ส่วนที่ 3 — สิทธิ์แอดมิน
 *
 * ลิงก์ที่ส่งให้สาขาไม่มี key จึงแก้ข้อมูลไม่ได้
 * การตรวจทำที่ฝั่งเซิร์ฟเวอร์ เพราะการซ่อนปุ่มบนหน้าเว็บอย่างเดียวกันไม่ได้ —
 * ใครก็เรียกฟังก์ชันจากคอนโซลเบราว์เซอร์ได้
 * ===================================================================== */

function getBatteryAdminKey_() {
  // ตั้งรหัสไว้ในโค้ด ใช้ได้ทันทีที่วางโค้ดใหม่ ไม่ต้องไปยุ่งกับ Script Properties
  if (ADMIN_CODE) return String(ADMIN_CODE);

  // ถ้าลบ ADMIN_CODE ให้ว่าง ระบบจะกลับไปใช้กุญแจสุ่มที่เก็บไว้ใน Script Properties แทน
  var key = prop_('BATTERY_ADMIN_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
    props_().setProperty('BATTERY_ADMIN_KEY', key);
  }
  return key;
}

function requireBatteryAdmin_(key) {
  if (String(key || '') !== getBatteryAdminKey_()) {
    throw new Error('ลิงก์นี้ดูได้อย่างเดียว ไม่มีสิทธิ์แก้ข้อมูล');
  }
}

/**
 * ตรวจกุญแจที่กรอกจากหน้าเว็บ ใช้ตอนเปิดลิงก์ธรรมดาแล้วอยากเข้าโหมดแอดมิน
 * ไม่ได้ให้สิทธิ์อะไรเพิ่ม — ทุกครั้งที่เขียนข้อมูลยังต้องส่งกุญแจมาให้ตรวจซ้ำอยู่ดี
 * ฟังก์ชันนี้แค่บอกหน้าเว็บว่าจะโชว์ปุ่มให้หรือเปล่า
 */
function apiCheckAdminKey(key) {
  try {
    return { ok: true, isAdmin: String(key || '') === getBatteryAdminKey_() };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/* =======================================================================
 * ส่วนที่ 4 — เว็บแอป
 * ===================================================================== */

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  // เปิดดูรูปหลักฐานการจัดส่ง: ?img=<fileId>
  // เสิร์ฟผ่านเว็บแอปแทนการเปิดลิงก์ Drive ตรง ๆ จะได้ไม่ต้องแชร์ไฟล์เป็นสาธารณะ
  var imgId = String(params.img || '').trim();
  if (imgId) return serveDeliveryImage_(imgId);

  // เปิดดูรูปหลักฐานขั้นตอนงานซ่อม: ?revimg=<fileId> (คนละโฟลเดอร์กับรูปจัดส่งแบต)
  var revImgId = String(params.revimg || '').trim();
  if (revImgId) return serveRepairEvidenceImage_(revImgId);

  var key = String(params.key || '');
  var isAdmin = (key === getBatteryAdminKey_());

  // ถ้าลิงก์ระบุสาขามาแล้วสะกดไม่ตรงกับในชีต ต้องบอกให้รู้
  // ไม่ใช่กรองเงียบ ๆ จนหน้าเว็บว่างเปล่าโดยไม่มีใครเข้าใจว่าทำไม
  var wantBranch = String(params.branch || '').trim();
  var lockBranch = (wantBranch && findBranch_(wantBranch)) ? wantBranch : '';
  var lockBranchInvalid = !!wantBranch && !lockBranch;

  var tpl = HtmlService.createTemplateFromFile('Battery');
  // ส่งค่าไปทาง data attribute ไม่ใช่แปะลงกลาง <script> โดยตรง
  // เพราะ <?= ?> จะ escape ให้ตามบริบท HTML เครื่องหมายคำพูดใน JSON
  // ที่แปะกลางโค้ด JS จะเพี้ยนจนค่าที่ได้ไม่ใช่ค่าที่ตั้งใจส่ง
  tpl.configJson = JSON.stringify({
    isAdmin: isAdmin,
    adminKey: isAdmin ? key : '',
    lockBranch: lockBranch,
    lockBranchInvalid: lockBranchInvalid,
    wantBranch: wantBranch
  });

  return tpl.evaluate()
    .setTitle('ติดตามสถานะแบตเตอรี่ / รถส่งซ่อม')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/* =======================================================================
 * ส่วนที่ 5 — ข้อมูลแบตเตอรี่
 * ===================================================================== */

function readBatteries_() {
  return readRows_(SHEETS.BATTERIES).filter(function (r) { return !!r.batteryId; });
}

function toBatteryDto_(b) {
  if (!b) return null;
  var dto = {};
  HEADERS.Batteries.forEach(function (h) { dto[h] = b[h] === undefined ? '' : b[h]; });
  return dto;
}

/** ค้นรายการแบต — เปิดให้ทุกคนเรียกได้ เพราะเป็นข้อมูลที่ให้สาขาติดตาม */
function apiListBatteries(payload) {
  try {
    payload = payload || {};
    var q = String(payload.q || '').trim().toLowerCase();
    var branch = String(payload.branch || '').trim();
    var status = String(payload.status || '').trim();

    var rows = readBatteries_();
    var results = [];
    for (var i = rows.length - 1; i >= 0 && results.length < 200; i--) {
      var b = rows[i];
      if (branch && b.branch !== branch) continue;
      if (status && b.status !== status) continue;
      if (q) {
        var hay = [b.batteryId, b.alNo, b.branch, b.zone, b.serial, b.model, b.status, b.note,
                   b.receiver, b.deliveryNote].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) continue;
      }
      results.push(toBatteryDto_(b));
    }

    var counts = {};
    BATTERY_STATUSES.forEach(function (s) { counts[s] = 0; });
    rows.forEach(function (b) {
      if (branch && b.branch !== branch) return;
      if (counts[b.status] !== undefined) counts[b.status]++;
    });

    // total ไว้ให้หน้าเว็บแยกออกว่า "ยังไม่มีข้อมูลเลย" กับ "มีข้อมูลแต่ตัวกรองไม่ตรง"
    return {
      ok: true, results: results, counts: counts,
      statuses: BATTERY_STATUSES, total: rows.length
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

function apiBatteryBootstrap() {
  try {
    // ส่งรหัสสาขาไปด้วย หน้าเว็บจะได้ให้พิมพ์รหัสเพื่อเลือกสาขาได้
    var branches = getBranches_().map(function (b) {
      return { code: b.code, name: b.name, zone: b.zone };
    });
    var appUrl = '';
    try { appUrl = ScriptApp.getService().getUrl() || ''; } catch (err) { appUrl = ''; }

    return {
      ok: true, branches: branches, today: todayIso_(),
      statuses: BATTERY_STATUSES,
      repairStatuses: REPAIR_STATUSES,
      deliveredStatus: DELIVERED_STATUS,
      incomingStatus: INCOMING_STATUS,
      repairDoneStatus: REPAIR_DONE_STATUS,
      appUrl: appUrl
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** เพิ่ม/แก้ไขรายการแบตทีละรายการ — ต้องมี key ของแอดมิน */
function apiSaveBattery(payload) {
  try {
    payload = payload || {};
    requireBatteryAdmin_(payload.key);
    var saved = saveBatteries_(payload, [payload]);
    return { ok: true, battery: saved[0], batteries: saved };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/**
 * บันทึกแบตหลายก้อนในครั้งเดียว — ต้องมี key ของแอดมิน
 * สาขา / วันที่ / อล. / สถานะ / ผู้บันทึก ใช้ร่วมกันทั้งชุด
 * ส่วน items คือแต่ละก้อน { serial, model, qty, note }
 */
function apiSaveBatteries(payload) {
  try {
    payload = payload || {};
    requireBatteryAdmin_(payload.key);
    var items = payload.items || [];
    if (!items.length) throw new Error('ยังไม่ได้ใส่รายการแบตสักก้อน');
    var saved = saveBatteries_(payload, items);
    return { ok: true, batteries: saved, count: saved.length };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** เปลี่ยนสถานะรายการเดียว — ต้องมี key ของแอดมิน */
function apiUpdateBatteryStatus(payload) {
  try {
    payload = payload || {};
    requireBatteryAdmin_(payload.key);

    var id = String(payload.batteryId || '').trim();
    var status = String(payload.status || '').trim();
    if (!id) throw new Error('ไม่ได้ระบุรายการ');
    if (BATTERY_STATUSES.indexOf(status) < 0) throw new Error('สถานะไม่ถูกต้อง: ' + status);

    var sh = getWritableSheet_(SHEETS.BATTERIES);
    var rows = readBatteries_();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].batteryId === id) {
        sh.getRange(rows[i]._row, fieldCol_(sh, 'Batteries', 'status')).setValue(status);
        sh.getRange(rows[i]._row, fieldCol_(sh, 'Batteries', 'updatedAt')).setValue(nowStamp_());
        sh.getRange(rows[i]._row, fieldCol_(sh, 'Batteries', 'updatedBy'))
          .setValue(String(payload.updatedBy || '').trim());
        return { ok: true, batteryId: id, status: status };
      }
    }
    throw new Error('ไม่พบรายการ ' + id);
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/**
 * บันทึกแบตทั้งชุดใต้ lock เดียว
 * base = ข้อมูลที่ใช้ร่วมกัน (สาขา วันที่ อล. สถานะ ผู้บันทึก)
 * items = แต่ละก้อน ถ้ามี batteryId แปลว่าแก้ของเดิม ไม่งั้นเพิ่มใหม่
 */
/** ลบรายการแบตทิ้งทั้งแถว — ต้องมี key ของแอดมิน */
function apiDeleteBattery(payload) {
  try {
    payload = payload || {};
    requireBatteryAdmin_(payload.key);

    var id = String(payload.batteryId || '').trim();
    if (!id) throw new Error('ไม่ได้ระบุรายการ');

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) throw new Error('ระบบกำลังทำรายการอื่นอยู่ กรุณาลองใหม่');
    try {
      var rows = readBatteries_();
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].batteryId === id) {
          getSheet_(SHEETS.BATTERIES).deleteRow(rows[i]._row);
          return { ok: true, batteryId: id };
        }
      }
    } finally {
      lock.releaseLock();
    }
    throw new Error('ไม่พบรายการ ' + id);
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** ลบรายการรถส่งซ่อมทิ้งทั้งแถว — ต้องมี key ของแอดมิน */
function apiDeleteRepair(payload) {
  try {
    payload = payload || {};
    requireBatteryAdmin_(payload.key);

    var id = String(payload.repairId || '').trim();
    if (!id) throw new Error('ไม่ได้ระบุรายการ');

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) throw new Error('ระบบกำลังทำรายการอื่นอยู่ กรุณาลองใหม่');
    try {
      var rows = readRepairs_();
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].repairId === id) {
          getSheet_(SHEETS.REPAIRS).deleteRow(rows[i]._row);
          return { ok: true, repairId: id };
        }
      }
    } finally {
      lock.releaseLock();
    }
    throw new Error('ไม่พบรายการ ' + id);
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

function saveBatteries_(base, items) {
  var branch = String(base.branch || '').trim();
  if (!branch) throw new Error('ยังไม่ได้เลือกสาขา');

  var status = String(base.status || '').trim() || BATTERY_STATUSES[0];
  if (BATTERY_STATUSES.indexOf(status) < 0) throw new Error('สถานะไม่ถูกต้อง: ' + status);

  var receivedDate = String(base.receivedDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) receivedDate = todayIso_();

  var branchInfo = findBranch_(branch);
  var stamp = nowStamp_();
  var updatedBy = String(base.updatedBy || '').trim();
  var alNo = String(base.alNo || '').trim();

  var rows = items.map(function (it) {
    it = it || {};
    return {
      batteryId: String(it.batteryId || '').trim(),
      receivedDate: receivedDate,
      alNo: it.alNo === undefined ? alNo : String(it.alNo || '').trim(),
      branch: branch,
      zone: branchInfo ? branchInfo.zone : '',
      serial: String(it.serial || '').trim(),
      model: String(it.model || '').trim(),
      qty: it.qty === '' || it.qty == null ? 1 : Number(it.qty),
      status: String(it.status || '').trim() || status,
      note: String(it.note || '').trim(),
      updatedAt: stamp,
      updatedBy: updatedBy
    };
  });

  rows.forEach(function (r) {
    if (BATTERY_STATUSES.indexOf(r.status) < 0) throw new Error('สถานะไม่ถูกต้อง: ' + r.status);
    if (!(r.qty > 0)) throw new Error('จำนวนต้องมากกว่า 0');
  });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณาลองใหม่');

  try {
    var sh = getWritableSheet_(SHEETS.BATTERIES);
    var existing = readBatteries_();
    var seq = nextBatterySeq_(existing);
    var appended = [];

    rows.forEach(function (r) {
      if (r.batteryId) {
        var target = null;
        for (var i = 0; i < existing.length; i++) {
          if (existing[i].batteryId === r.batteryId) { target = existing[i]; break; }
        }
        if (!target) throw new Error('ไม่พบรายการ ' + r.batteryId);
        var row = toRowValues_(sh, SHEETS.BATTERIES, r);
        sh.getRange(target._row, 1, 1, row.length).setValues([row]);
      } else {
        r.batteryId = seq.prefix + ('00' + (++seq.max)).slice(-3);
        appended.push(toRowValues_(sh, SHEETS.BATTERIES, r));
      }
    });

    if (appended.length) {
      sh.getRange(sh.getLastRow() + 1, 1, appended.length, appended[0].length)
        .setValues(appended);
    }
  } finally {
    lock.releaseLock();
  }

  return rows;
}



/** เลขที่รายการแบต รูปแบบ BT-YYYYMMDD-NNN (เรียกใต้ lock เท่านั้น) */
function nextBatterySeq_(existing) {
  var prefix = 'BT-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd') + '-';
  var max = 0;
  existing.forEach(function (b) {
    if (b.batteryId.indexOf(prefix) === 0) {
      var n = parseInt(b.batteryId.substring(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return { prefix: prefix, max: max };
}

/* =======================================================================
 * ส่วนที่ 5ก — ใบบันทึกการจัดส่ง
 *
 * ตอนแบตถึงมือคนรับ แอดมินถ่ายรูปหลักฐาน ใส่ชื่อคนที่มารับ แล้วบันทึก
 * ระบบเก็บรูปไว้ใน Drive (ไม่แชร์สาธารณะ) แล้วผูกกับรายการแบตก้อนนั้น
 * ฝั่งสาขาเปิดดูรูปกับรายละเอียดได้ แต่แก้อะไรไม่ได้ เพราะการเขียนต้องมีกุญแจแอดมิน
 * ===================================================================== */

function getDeliveryFolder_() {
  var id = prop_('DELIVERY_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (err) {
      // โฟลเดอร์ถูกลบไป สร้างใหม่ให้
    }
  }
  var folder = DriveApp.createFolder(DELIVERY_FOLDER_NAME);
  props_().setProperty('DELIVERY_FOLDER_ID', folder.getId());
  return folder;
}

/** ตั้งชื่อไฟล์เป็น วันที่_เลขที่รายการ_สาขา เพื่อให้ค้นในไดรฟ์ได้ง่าย */
function saveDeliveryImage_(base64, mimeType, batteryId, branch) {
  var type = String(mimeType || 'image/jpeg');
  var ext = type.indexOf('png') >= 0 ? '.png' : '.jpg';
  var name = [todayIso_(), batteryId, safeFileNamePart_(branch)].join('_') + ext;
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), type, name);
  return getDeliveryFolder_().createFile(blob).getId();
}

function safeFileNamePart_(v) {
  return String(v == null ? '' : v).trim().replace(/[\\\/:*?"<>|]+/g, '-');
}

/** เสิร์ฟรูปหลักฐานผ่านเว็บแอป จะได้ไม่ต้องแชร์ไฟล์ใน Drive เป็นสาธารณะ */
function serveDeliveryImage_(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var dataUri = 'data:' + blob.getContentType() + ';base64,' +
      Utilities.base64Encode(blob.getBytes());
    var html = '<div style="margin:0;background:#111;text-align:center">' +
      '<img src="' + dataUri + '" style="max-width:100%;height:auto">' +
      '</div>';
    return HtmlService.createHtmlOutput(html)
      .setTitle(file.getName())
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutput('<p>เปิดรูปไม่ได้: ' + String(err.message || err) + '</p>');
  }
}

/* =======================================================================
 * ส่วนที่ 5ข1 — รูปหลักฐานทุกขั้นตอนของงานซ่อม
 *
 * ทุกจุดที่เปลี่ยนสถานะงานซ่อม (รับรถเข้า / เปลี่ยนสถานะในคิว / สร้างรายการใหม่)
 * บังคับแนบรูป 1 รูปเสมอ เก็บเป็นประวัติสะสมในชีต RepairEvidence แยกจาก Repairs
 * เพื่อให้ดูย้อนหลังได้ครบทุกขั้นตอน ไม่ใช่แค่รูปล่าสุด
 * ===================================================================== */

function getRepairEvidenceFolder_() {
  var id = prop_('REPAIR_EVIDENCE_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (err) {
      // โฟลเดอร์ถูกลบไป สร้างใหม่ให้
    }
  }
  var folder = DriveApp.createFolder(REPAIR_EVIDENCE_FOLDER_NAME);
  props_().setProperty('REPAIR_EVIDENCE_FOLDER_ID', folder.getId());
  return folder;
}

/** ตั้งชื่อไฟล์เป็น วันที่_เลขที่รายการ_ขั้นตอน เพื่อให้ค้นในไดรฟ์ได้ง่าย */
function saveRepairEvidencePhoto_(base64, mimeType, repairId, label) {
  var type = String(mimeType || 'image/jpeg');
  var ext = type.indexOf('png') >= 0 ? '.png' : '.jpg';
  var name = [todayIso_(), repairId, safeFileNamePart_(label)].join('_') + ext;
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), type, name);
  return getRepairEvidenceFolder_().createFile(blob).getId();
}

/** เสิร์ฟรูปหลักฐานขั้นตอนงานซ่อมผ่านเว็บแอป — เหมือน serveDeliveryImage_ เป๊ะ ๆ คนละโฟลเดอร์ */
function serveRepairEvidenceImage_(fileId) {
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var dataUri = 'data:' + blob.getContentType() + ';base64,' +
      Utilities.base64Encode(blob.getBytes());
    var html = '<div style="margin:0;background:#111;text-align:center">' +
      '<img src="' + dataUri + '" style="max-width:100%;height:auto">' +
      '</div>';
    return HtmlService.createHtmlOutput(html)
      .setTitle(file.getName())
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    return HtmlService.createHtmlOutput('<p>เปิดรูปไม่ได้: ' + String(err.message || err) + '</p>');
  }
}

/** เลขที่หลักฐาน ใช้แค่อ้างอิง/ค้นหา ไม่ต้องเรียงต่อเนื่องเหมือนเลขที่รายการซ่อม */
function nextEvidenceId_() {
  return 'EV-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmmss') + '-' +
    Math.floor(1000 + Math.random() * 9000);
}

/**
 * บันทึกรูปหลักฐานหนึ่งขั้นตอนของงานซ่อม
 * เรียกใต้ lock ของฟังก์ชันที่เรียกเท่านั้น (apiReceiveRepair / apiUpdateRepairStatus /
 * saveRepair_ ถือ lock ของตัวเองอยู่แล้วตอนเรียกฟังก์ชันนี้ ฟังก์ชันนี้เองไม่ล็อกซ้ำ)
 */
function saveRepairEvidence_(repairId, label, base64, mimeType, updatedBy) {
  var photoId = saveRepairEvidencePhoto_(base64, mimeType, repairId, label);
  var sh = getWritableSheet_(SHEETS.REPAIR_EVIDENCE);
  var rec = {
    evidenceId: nextEvidenceId_(),
    repairId: repairId,
    at: nowStamp_(),
    label: label,
    photoId: photoId,
    updatedBy: String(updatedBy || '').trim()
  };
  var values = toRowValues_(sh, SHEETS.REPAIR_EVIDENCE, rec);
  sh.getRange(sh.getLastRow() + 1, 1, 1, values.length).setValues([values]);
  return rec;
}

/**
 * รูปหลักฐานทุกขั้นตอนของงานซ่อมหนึ่งรายการ เรียงเก่าสุดขึ้นก่อน — ใครก็ดูได้ (แก้ไม่ได้)
 * แถวแรกสุดสังเคราะห์จากรูปตอนสาขาอื่นส่งมา (EvidenceImage ในชีต Repairs) ถ้ามี
 */
function apiListRepairEvidence(payload) {
  try {
    payload = payload || {};
    var repairId = String(payload.repairId || '').trim();
    if (!repairId) throw new Error('ไม่ได้ระบุรายการ');

    var rows = readRows_(SHEETS.REPAIR_EVIDENCE)
      .filter(function (r) { return r.repairId === repairId; })
      .map(function (r) {
        return { evidenceId: r.evidenceId, at: r.at, label: r.label, photoId: r.photoId, updatedBy: r.updatedBy };
      });
    rows.sort(function (a, b) { return String(a.at) < String(b.at) ? -1 : (String(a.at) > String(b.at) ? 1 : 0); });

    var repairs = readRepairs_().filter(function (r) { return r.repairId === repairId; });
    if (repairs.length && repairs[0].EvidenceImage) {
      var r0 = repairs[0];
      rows.unshift({
        evidenceId: '',
        at: r0.DispatchedAt || r0.updatedAt || '',
        label: 'ส่งจากสาขา' + (r0.branch ? ' (' + r0.branch + ')' : ''),
        url: r0.EvidenceImage,   // มาจากระบบข้ามสาขา เป็นลิงก์ Drive เต็มอยู่แล้ว ไม่ต้องผ่าน ?revimg=
        updatedBy: r0.updatedBy
      });
    }

    return {
      ok: true,
      message: rows.length ? 'มีรูปหลักฐาน ' + rows.length + ' รายการ' : 'ยังไม่มีรูปหลักฐาน',
      data: rows
    };
  } catch (err) {
    return { ok: false, message: String(err.message || err) };
  }
}

/**
 * บันทึกใบจัดส่งของแบตก้อนหนึ่ง — ต้องมี key ของแอดมิน
 * บันทึกแล้วสถานะจะกลายเป็น "จัดส่งแล้ว" ให้เอง ไม่ต้องไปกดเปลี่ยนอีกที
 */
function apiSaveDelivery(payload) {
  try {
    payload = payload || {};
    requireBatteryAdmin_(payload.key);

    var id = String(payload.batteryId || '').trim();
    if (!id) throw new Error('ไม่ได้ระบุรายการแบต');

    var receiver = String(payload.receiver || '').trim();
    if (!receiver) throw new Error('ยังไม่ได้ใส่ชื่อคนที่มารับ');

    var rows = readBatteries_();
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].batteryId === id) { target = rows[i]; break; }
    }
    if (!target) throw new Error('ไม่พบรายการ ' + id);

    // อัปโหลดรูปก่อน ถ้าเก็บรูปไม่สำเร็จก็ไม่ควรไปแก้สถานะให้เข้าใจผิดว่ามีหลักฐานแล้ว
    var photoId = String(payload.photoId || '').trim() || target.deliveryPhotoId;
    if (payload.base64) {
      photoId = saveDeliveryImage_(payload.base64, payload.mimeType, id, target.branch);
    }

    var sh = getWritableSheet_(SHEETS.BATTERIES);
    var stamp = nowStamp_();
    var updates = {
      status: DELIVERED_STATUS,
      deliveredAt: stamp,
      receiver: receiver,
      deliveryNote: String(payload.deliveryNote || '').trim(),
      deliveryPhotoId: photoId,
      updatedAt: stamp,
      updatedBy: String(payload.updatedBy || '').trim()
    };
    Object.keys(updates).forEach(function (field) {
      sh.getRange(target._row, fieldCol_(sh, 'Batteries', field)).setValue(updates[field]);
    });

    return { ok: true, batteryId: id, delivery: updates, hasPhoto: !!photoId };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/* =======================================================================
 * ส่วนที่ 5ข — รถส่งซ่อม
 *
 * โครงเดียวกับแบตเตอรี่ ต่างกันที่ตัวระบุงานคือเลข JOB กับเลขที่สัญญา
 * สิทธิ์แก้ข้อมูลใช้กุญแจแอดมินตัวเดียวกัน ลิงก์ของสาขายังดูได้อย่างเดียวเหมือนเดิม
 * ===================================================================== */

function readRepairs_() {
  return readRows_(SHEETS.REPAIRS).filter(function (r) { return !!r.repairId; });
}

function toRepairDto_(r) {
  if (!r) return null;
  var dto = {};
  HEADERS.Repairs.forEach(function (h) { dto[h] = r[h] === undefined ? '' : r[h]; });
  return dto;
}

/**
 * เวลาที่ซ่อมเสร็จ ประทับให้เองตอนสถานะเพิ่งเปลี่ยน "เข้า" ขั้นซ่อมเสร็จแล้ว
 * และล้างทิ้งตอนสถานะเปลี่ยน "ออก" จากขั้นนั้น (เช่น กดผิดแล้วเปลี่ยนกลับไปกำลังซ่อม)
 * เปลี่ยนสถานะอื่นที่ไม่เกี่ยวกับขั้นนี้เลย ค่าเดิมยังอยู่เหมือนเดิม
 */
function repairDoneStamp_(prevStatus, newStatus, prevStamp) {
  if (newStatus === REPAIR_DONE_STATUS && prevStatus !== REPAIR_DONE_STATUS) return nowStamp_();
  if (newStatus !== REPAIR_DONE_STATUS && prevStatus === REPAIR_DONE_STATUS) return '';
  return prevStamp || '';
}

/** ค้นรายการรถส่งซ่อม — เปิดให้ทุกคนเรียกได้ เพราะเป็นข้อมูลที่ให้สาขาติดตาม */
function apiListRepairs(payload) {
  try {
    payload = payload || {};
    var q = String(payload.q || '').trim().toLowerCase();
    var branch = String(payload.branch || '').trim();
    var status = String(payload.status || '').trim();

    var rows = readRepairs_();
    var results = [];
    for (var i = rows.length - 1; i >= 0 && results.length < 200; i--) {
      var r = rows[i];
      if (branch && r.branch !== branch) continue;
      if (status && r.status !== status) continue;
      if (q) {
        var hay = [r.repairId, r.jobNo, r.contractNo, r.vehicleModel, r.branch, r.zone,
                   r.status, r.note].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) continue;
      }
      results.push(toRepairDto_(r));
    }

    var counts = {};
    REPAIR_STATUSES.forEach(function (s) { counts[s] = 0; });
    rows.forEach(function (r) {
      if (branch && r.branch !== branch) return;
      if (counts[r.status] !== undefined) counts[r.status]++;
    });

    return {
      ok: true, results: results, counts: counts,
      statuses: REPAIR_STATUSES, total: rows.length
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/* =======================================================================
 * ส่วนที่ 5.5 — รับรถที่สาขาอื่นส่งมา
 *
 * ฟอร์มของสาขาอื่นอยู่อีกโปรเจกต์ (แยก URL) แต่เขียนลงชีต Repairs ไฟล์เดียวกันนี้
 * แถวที่ส่งมาจะมีสถานะ 'รอรับรถ (กำลังจัดส่ง)' รอให้สาขาหลักกดรับ
 * พอกดรับแล้วสถานะเปลี่ยนเป็น 'รอซ่อม' และไหลเข้ากระบวนการเดิมทั้งหมด
 * ===================================================================== */

/** รายการรถที่กำลังส่งมา เรียงจากที่ส่งมาก่อน (เก่าสุดขึ้นก่อน) — ใครก็ดูได้ */
function apiListIncomingRepairs() {
  try {
    var rows = readRepairs_().filter(function (r) { return r.status === INCOMING_STATUS; });

    // เก่าสุดขึ้นก่อน อิงเวลาที่กดส่ง คันที่รออยู่นานที่สุดจะได้อยู่บนสุด
    rows.sort(function (a, b) {
      var x = String(a.updatedAt || '');
      var y = String(b.updatedAt || '');
      if (x && y && x !== y) return x < y ? -1 : 1;
      return String(a.repairId) < String(b.repairId) ? -1 : 1;
    });

    return {
      ok: true,
      message: rows.length ? 'มีรถรออยู่ ' + rows.length + ' คัน' : 'ยังไม่มีรถที่กำลังส่งมา',
      data: rows.map(toRepairDto_)
    };
  } catch (err) {
    return { ok: false, message: String(err.message || err) };
  }
}

/**
 * กดรับรถเข้าซ่อม — ต้องมี key ของแอดมิน เหมือนการเขียนอย่างอื่นในระบบนี้
 * ค้นแถวด้วย repairId เท่านั้น (ไม่ใช้เลขแถวจากหน้าเว็บ กันกรณีมีคนแทรกแถวในชีต)
 */
function apiReceiveRepair(payload) {
  try {
    payload = payload || {};
    requireBatteryAdmin_(payload.key);

    var id = String(payload.repairId || '').trim();
    var receivedBy = String(payload.receivedBy || '').trim();
    var base64 = String(payload.base64 || '');
    if (!id) throw new Error('ไม่ได้ระบุรายการที่จะรับ');
    if (!receivedBy) throw new Error('ยังไม่ได้กรอกชื่อผู้รับรถ');
    if (!base64) throw new Error('ยังไม่ได้แนบรูปหลักฐานตอนรับรถ');

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณากดอีกครั้ง');

    var dto, evidence;
    try {
      var sh = getWritableSheet_(SHEETS.REPAIRS);
      var rows = readRepairs_();
      var target = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].repairId === id) { target = rows[i]; break; }
      }
      if (!target) throw new Error('ไม่พบรายการ ' + id + ' — อาจถูกลบไปแล้ว');

      // กันสองเครื่องกดรับคันเดียวกันพร้อมกัน คนที่มาทีหลังจะเจอว่าสถานะเปลี่ยนไปแล้ว
      if (target.status !== INCOMING_STATUS) {
        throw new Error('รายการนี้ถูกรับเข้าไปแล้ว (สถานะปัจจุบัน "' + target.status + '")');
      }

      evidence = saveRepairEvidence_(id, 'รับรถเข้า', base64, payload.mimeType, receivedBy);

      var stamp = nowStamp_();
      var updates = {
        status: RECEIVED_STATUS,
        receivedDate: stamp.substring(0, 10),   // ช่องเดิมเก็บเป็นวันที่ ให้ฟอร์มเดิมใช้ต่อได้
        ReceivedAt: stamp,                      // เวลาที่รับจริง เก็บแยกไว้ครบวินาที
        ReceivedBy: receivedBy,
        updatedAt: stamp,
        updatedBy: receivedBy
      };
      Object.keys(updates).forEach(function (field) {
        sh.getRange(target._row, fieldCol_(sh, SHEETS.REPAIRS, field)).setValue(updates[field]);
      });

      Object.keys(updates).forEach(function (field) { target[field] = updates[field]; });
      dto = toRepairDto_(target);
    } finally {
      lock.releaseLock();
    }

    return {
      ok: true,
      message: 'รับรถ ' + (dto.PlateNo || dto.jobNo || id) + ' เข้าซ่อมแล้ว',
      data: dto,
      evidence: evidence
    };
  } catch (err) {
    return { ok: false, message: String(err.message || err) };
  }
}

/** เพิ่ม/แก้ไขรายการรถส่งซ่อม — ต้องมี key ของแอดมิน */
function apiSaveRepair(payload) {
  try {
    payload = payload || {};
    requireBatteryAdmin_(payload.key);
    var result = saveRepair_(payload);
    return { ok: true, repair: result.row, evidence: result.evidence };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** เปลี่ยนสถานะรายการเดียว — ต้องมี key ของแอดมิน */
function apiUpdateRepairStatus(payload) {
  try {
    payload = payload || {};
    requireBatteryAdmin_(payload.key);

    var id = String(payload.repairId || '').trim();
    var status = String(payload.status || '').trim();
    var base64 = String(payload.base64 || '');
    var updatedBy = String(payload.updatedBy || '').trim();
    if (!id) throw new Error('ไม่ได้ระบุรายการ');
    if (REPAIR_STATUSES.indexOf(status) < 0) throw new Error('สถานะไม่ถูกต้อง: ' + status);
    if (!base64) throw new Error('ต้องแนบรูปหลักฐานก่อนเปลี่ยนสถานะ');

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณากดอีกครั้ง');

    try {
      var sh = getWritableSheet_(SHEETS.REPAIRS);
      var rows = readRepairs_();
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].repairId === id) {
          var r = rows[i];
          var repairDoneAt = repairDoneStamp_(r.status, status, r.RepairDoneAt);
          var evidence = saveRepairEvidence_(id, status, base64, payload.mimeType, updatedBy);

          sh.getRange(r._row, fieldCol_(sh, 'Repairs', 'status')).setValue(status);
          sh.getRange(r._row, fieldCol_(sh, 'Repairs', 'updatedAt')).setValue(nowStamp_());
          sh.getRange(r._row, fieldCol_(sh, 'Repairs', 'updatedBy')).setValue(updatedBy);
          sh.getRange(r._row, fieldCol_(sh, 'Repairs', 'RepairDoneAt')).setValue(repairDoneAt);

          r.status = status;
          r.RepairDoneAt = repairDoneAt;
          return { ok: true, repairId: id, status: status, repair: toRepairDto_(r), evidence: evidence };
        }
      }
      throw new Error('ไม่พบรายการ ' + id);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

function saveRepair_(p) {
  var jobNo = String(p.jobNo || '').trim();   // ไม่บังคับ บางคันยังไม่ได้เปิด JOB ตอนรับเข้า

  var branch = String(p.branch || '').trim();
  if (!branch) throw new Error('ยังไม่ได้เลือกสาขา');

  var status = String(p.status || '').trim() || REPAIR_STATUSES[0];
  if (REPAIR_STATUSES.indexOf(status) < 0) throw new Error('สถานะไม่ถูกต้อง: ' + status);

  var receivedDate = String(p.receivedDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) receivedDate = todayIso_();

  var base64 = String(p.base64 || '');
  // แก้รายการเดิม (แผงแก้ไขในการ์ด) ไม่มีช่องแนบรูป จึงบังคับแค่ตอนสร้างรายการใหม่เท่านั้น
  var originalId = String(p.repairId || '').trim();
  if (!originalId && !base64) throw new Error('ยังไม่ได้แนบรูปหลักฐาน');

  var branchInfo = findBranch_(branch);
  var row = {
    repairId: originalId,
    receivedDate: receivedDate,
    jobNo: jobNo,
    contractNo: String(p.contractNo || '').trim(),
    vehicleModel: String(p.vehicleModel || '').trim(),
    branch: branch,
    zone: branchInfo ? branchInfo.zone : '',
    status: status,
    note: String(p.note || '').trim(),
    updatedAt: nowStamp_(),
    updatedBy: String(p.updatedBy || '').trim()
  };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณาลองใหม่');

  try {
    var sh = getWritableSheet_(SHEETS.REPAIRS);
    var rows = readRepairs_();

    // เลข JOB ต้องไม่ซ้ำ ไม่งั้นตามงานไม่ถูกคัน — แต่ถ้ายังไม่ได้ใส่ ก็ไม่ต้องตรวจ
    var key = jobNo.toUpperCase();
    for (var i = 0; jobNo && i < rows.length; i++) {
      if (rows[i].repairId === originalId) continue;
      if (rows[i].jobNo.toUpperCase() === key) {
        throw new Error('เลข JOB ' + jobNo + ' มีอยู่แล้วในรายการ ' + rows[i].repairId +
          ' (' + rows[i].branch + ' • ' + rows[i].status + ')');
      }
    }

    var target = null;
    if (originalId) {
      for (var j = 0; j < rows.length; j++) {
        if (rows[j].repairId === originalId) { target = rows[j]; break; }
      }
      if (!target) throw new Error('ไม่พบรายการ ' + originalId);
    }

    if (!target) row.repairId = nextRepairId_(rows);

    /* คอลัมน์ของงานรับรถข้ามสาขา ฟอร์มนี้ไม่มีช่องให้กรอก
     * ต้องยกค่าเดิมมาใส่ ไม่งั้นการกดแก้ไขรายการที่สาขาอื่นส่งมา
     * จะล้างทะเบียนรถ/รูปหลักฐาน/ชื่อผู้รับ/วันที่เปิดจ๊อบ/เวลาที่ส่งทิ้งทั้งหมด
     */
    ['BranchCode', 'PlateNo', 'Source', 'EvidenceImage', 'ReceivedBy', 'ReceivedAt',
     'JobOpenedDate', 'DispatchedAt']
      .forEach(function (field) {
        row[field] = target ? (target[field] || '') : (p[field] === undefined ? '' : p[field]);
      });

    // เวลาซ่อมเสร็จ ประทับ/ล้างเองตามการเปลี่ยนสถานะ ไม่ใช่ช่องที่ฟอร์มกรอกตรง ๆ
    row.RepairDoneAt = repairDoneStamp_(target ? target.status : '', status, target ? target.RepairDoneAt : '');

    // สร้างรายการใหม่ (ไม่ใช่แก้ไข) ถ่ายรูปหลักฐานตอนรับเข้าไว้ด้วย ป้ายกำกับเป็นสถานะที่เลือก
    var evidence = target ? null : saveRepairEvidence_(row.repairId, status, base64, p.mimeType, row.updatedBy);

    var values = toRowValues_(sh, SHEETS.REPAIRS, row);

    if (target) sh.getRange(target._row, 1, 1, values.length).setValues([values]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, values.length).setValues([values]);
  } finally {
    lock.releaseLock();
  }

  return { row: row, evidence: evidence };
}

/** เลขที่รายการซ่อม รูปแบบ RP-YYYYMMDD-NNN (เรียกใต้ lock เท่านั้น) */
function nextRepairId_(existing) {
  var prefix = 'RP-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd') + '-';
  var max = 0;
  existing.forEach(function (r) {
    if (r.repairId.indexOf(prefix) !== 0) return;
    var tail = r.repairId.substring(prefix.length);
    // ฟอร์มสาขาอื่นออกเลขแบบ RP-yyyyMMdd-HHmmss-### ซึ่งมีขีดคั่นอีกชั้น
    // ต้องไม่เอาส่วนเวลามานับ ไม่งั้นเลขของระบบนี้จะกระโดดไปเป็นหลักแสน
    if (!/^\d+$/.test(tail)) return;
    var n = parseInt(tail, 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return prefix + ('00' + (max + 1)).slice(-3);
}

/* =======================================================================
 * ส่วนที่ 6 — ติดตั้งและดูลิงก์
 * ===================================================================== */

/** รายชื่อสาขาจริง 166 สาขา ใส่ให้ตอนสร้างชีตครั้งแรก แก้ทีหลังได้ในชีต */
var SAMPLE_BRANCHES = [
    ['0001', 'สนญ.-ยามาฮ่า', '01:เยาว์'],
    ['0043', 'บ้านนางใย', '01:เยาว์'],
    ['0108', 'สนญ.-ฮอนด้า', '01:เยาว์'],
    ['0144', 'สนญ.ซูซูกิ', '01:เยาว์'],
    ['0048', 'หนองแปน', '02:ป๋อง'],
    ['0049', 'ร่องคำ', '02:ป๋อง'],
    ['0109', 'สนญ.-มดแดง', '02:ป๋อง'],
    ['0009', 'วาปี-ฮอนด้า', '03:แต๋ว'],
    ['0046', 'วาปี-ยามาฮ่า', '03:แต๋ว'],
    ['0802', 'อีฮงน้อยวาปีปทุม', '03:แต๋ว'],
    ['0011', 'บรบือ', '04:เปา'],
    ['0013', 'นาดูน', '04:เปา'],
    ['0005', 'โกสุมฯ-ฮอนด้า', '05:เก่ง'],
    ['0096', 'โกสุมฯ-มดแดง', '05:เก่ง'],
    ['0097', 'บ้านแพง', '05:เก่ง'],
    ['0083', 'กุดรัง', '06:เมธี'],
    ['0146', 'บ้านไผ่', '06:เมธี'],
    ['0152', 'โนนศิลา', '06:เมธี'],
    ['0029', 'ซับใหญ่', '07:แกะ'],
    ['0125', 'ภักดีชุมพล', '07:แกะ'],
    ['0133', 'เทพสถิตย์', '07:แกะ'],
    ['0016', 'แกดำ', '08:เจี๊ยบ'],
    ['0505', 'ย่อยแวงน่าง', '08:เจี๊ยบ'],
    ['0801', 'อีฮงน้อยมหาสารคาม', '08:เจี๊ยบ'],
    ['0006', 'เชียงยืน-มดแดง', '09:ถิน'],
    ['0070', 'เชียงยืน-ยามาฮ่า', '09:ถิน'],
    ['0094', 'ชื่นชม', '09:ถิน'],
    ['0031', 'ท่าคันโท', '10:บ๋อม'],
    ['0033', 'หนองกุงศรี', '10:บ๋อม'],
    ['0039', 'ห้วยเม็ก', '10:บ๋อม'],
    ['0045', 'นามน', '11:เปียว'],
    ['0047', 'ดอนจาน', '11:เปียว'],
    ['0067', 'สมเด็จ', '11:เปียว'],
    ['0136', 'กาฬสินธุ์-เวสป้า', '11:เปียว'],
    ['0032', 'สหัสขันธ์', '12:นิก'],
    ['0036', 'คำม่วง', '12:นิก'],
    ['0514', 'บ้านโพน', '12:นิก'],
    ['0024', 'โนนหัน', '13:พงษ์'],
    ['0071', 'ภูเขียว', '13:พงษ์'],
    ['0072', 'เกษตรสมบูรณ์', '13:พงษ์'],
    ['0077', 'ชุมแพ', '13:พงษ์'],
    ['0124', 'คอนสาร', '13:พงษ์'],
    ['0037', 'ภูกระดึง', '14:Kเอี้ยง'],
    ['0145', 'ภูผาม่าน', '14:Kเอี้ยง'],
    ['0149', 'น้ำหนาว', '14:Kเอี้ยง'],
    ['0088', 'โคกโพธิ์ชัย', '15:ดี'],
    ['0131', 'มัญจาคีรี', '15:ดี'],
    ['0135', 'แก้งคร้อ', '15:ดี'],
    ['0100', 'วังสะพุง', '16:สมรักษ์'],
    ['0101', 'เมืองเลย', '16:สมรักษ์'],
    ['0103', 'เอราวัณ', '16:สมรักษ์'],
    ['0054', 'บุรีรัมย์', '17:หนึ่ง'],
    ['0066', 'ลำปลายมาศ', '17:หนึ่ง'],
    ['0092', 'ชำนิ', '17:หนึ่ง'],
    ['0025', 'โนนแดง', '18:แก้ว'],
    ['0074', 'ชุมพวง', '18:แก้ว'],
    ['0085', 'ลำทะเมนชัย', '18:แก้ว'],
    ['0020', 'สตึก', '19:เปิ้ล'],
    ['0080', 'แคนดง', '19:เปิ้ล'],
    ['0148', 'คูเมือง', '19:เปิ้ล'],
    ['0075', 'นางรอง', '20:ธนิต'],
    ['0153', 'ละหานทราย', '20:ธนิต'],
    ['0164', 'โนนสุวรรณ', '20:ธนิต'],
    ['0053', 'ท่าตูม', '21:เอก'],
    ['0114', 'รัตนบุรี', '21:เอก'],
    ['0150', 'ชุมพลบุรี', '21:เอก'],
    ['0050', 'เฉลิมพระเกียรติ(ท่าช้าง)', '22:โทนี่'],
    ['0065', 'จักราช', '22:โทนี่'],
    ['0126', 'โนนสูง', '22:โทนี่'],
    ['0017', 'เมืองเก่าขอนแก่น', '23:วุฒิ(M)'],
    ['0058', 'ท่าพระ', '23:วุฒิ(M)'],
    ['0064', 'พระยืน', '23:วุฒิ(M)'],
    ['0041', 'ขามสะแกแสง', '24:หน่อย'],
    ['0090', 'พิมาย', '24:หน่อย'],
    ['0139', 'พระทองคำ', '24:หน่อย'],
    ['0044', 'เนินสง่า', '25:แต้ว'],
    ['0117', 'จัตุรัส', '25:แต้ว'],
    ['0162', 'บำเหน็จณรงค์', '25:แต้ว'],
    ['0111', 'ภูเรือ', '26:บุ๋มบิ๋ม'],
    ['0127', 'ด่านซ้าย', '26:บุ๋มบิ๋ม'],
    ['0128', 'ท่าลี่', '26:บุ๋มบิ๋ม'],
    ['0115', 'สำโรงทาบ', '27:ดรีม'],
    ['0118', 'สนม', '27:ดรีม'],
    ['0167', 'ศีขรภูมิ', '27:ดรีม'],
    ['0112', 'ปากชม', '28:เบิร์ด'],
    ['0119', 'บ้านธาตุ', '28:เบิร์ด'],
    ['0122', 'เชียงคาน', '28:เบิร์ด'],
    ['0068', 'สามเหลี่ยมขอนแก่น', '29:พวง'],
    ['0155', 'ดอนโมง', '29:พวง'],
    ['0165', 'พระธาตุขามแก่น', '29:พวง'],
    ['0504', 'สาขาหน้าร.8', '29:พวง'],
    ['0076', 'สีคิ้ว', '30:ป้อ'],
    ['0142', 'สูงเนิน', '30:ป้อ'],
    ['0163', 'ปักธงชัย', '30:ป้อ'],
    ['0026', 'จอมพระ', '31:เท่ห์'],
    ['0079', 'กระสัง', '31:เท่ห์'],
    ['0089', 'ปราสาท', '31:เท่ห์'],
    ['0154', 'ลำดวน', '31:เท่ห์'],
    ['0014', 'นาเชือก', '32:วุฒิ'],
    ['0015', 'ยางสีสุราช', '32:วุฒิ'],
    ['0056', 'หนองสองห้อง', '32:วุฒิ'],
    ['0055', 'ชัยภูมิ', '33:น้อย'],
    ['0073', 'หนองบัวแดง', '33:น้อย'],
    ['0120', 'ประโคนชัย', '34:ต๋อง'],
    ['0158', 'บ้านกรวด', '34:ต๋อง'],
    ['0171', 'พลับพลาชัย', '34:ต๋อง'],
    ['0051', 'หนองบัวระเหว', '35:ฝน'],
    ['0099', 'บ้านค่าย', '35:ฝน'],
    ['0513', 'บ้านเขว้า', '35:ฝน'],
    ['0062', 'แก้งสนามนาง', '36:ณัฐ'],
    ['0063', 'ชนบท', '36:ณัฐ'],
    ['0138', 'แวงน้อย', '36:ณัฐ'],
    ['0141', 'คอนสวรรค์', '36:ณัฐ'],
    ['0091', 'ผาขาว', '37:แป้ง'],
    ['0140', 'หนองหิน', '37:แป้ง'],
    ['0151', 'ภูหลวง', '37:แป้ง'],
    ['0038', 'คำใหญ่', '38:บ๋อม(ญ)'],
    ['0061', 'น้ำพอง', '38:บ๋อม(ญ)'],
    ['0084', 'กระนวน', '38:บ๋อม(ญ)'],
    ['0102', 'ซำสูง-มดแดง', '38:บ๋อม(ญ)'],
    ['0022', 'ครบุรี', '39:ปุ้ย'],
    ['0052', 'เสิงสาง', '39:ปุ้ย'],
    ['0121', 'ปะคำ', '39:ปุ้ย'],
    ['0007', 'ยางตลาด', '40:โฟร์'],
    ['0008', 'กาฬสินธุ์1', '40:โฟร์'],
    ['0035', 'กันทรวิชัย', '40:โฟร์'],
    ['0086', 'สีชมพู', '41:เบิร์ด'],
    ['0087', 'ศรีบุญเรือง', '41:เบิร์ด'],
    ['0095', 'ภูเวียง', '41:เบิร์ด'],
    ['0168', 'กุดดินจี่', '41:เบิร์ด'],
    ['0027', 'สีดา', '42:วิญญู'],
    ['0093', 'นาโพธิ์', '42:วิญญู'],
    ['0098', 'ประทาย', '42:วิญญู'],
    ['0137', 'พุทไธสง', '42:วิญญู'],
    ['0040', 'วังสามหมอ', '43:ต้อ'],
    ['0143', 'กุมภวาปี', '43:ต้อ'],
    ['0160', 'เขาสวนกวาง', '43:ต้อ'],
    ['0509', 'ศรีธาตุ', '43:ต้อ'],
    ['0159', 'บัวเชด', '44:ยุทธ'],
    ['0161', 'สังขะ', '44:ยุทธ'],
    ['0170', 'ศรีณรงค์', '44:ยุทธ'],
    ['0012', 'พยัคฆภูมิพิสัย', '45:บี'],
    ['0042', 'ปทุมรัตต์', '45:บี'],
    ['0803', 'อีฮงน้อยพยัคฆภูมิพิสัย', '45:บี'],
    ['0110', 'นากลาง', '46:บอย'],
    ['0129', 'นาด้วง', '46:บอย'],
    ['0157', 'นาวัง', '46:บอย'],
    ['0107', 'หนองบัวลำภู', '47:เอ๋'],
    ['0156', 'อุบลรัตน์', '47:เอ๋'],
    ['0169', 'โนนสัง', '47:เอ๋'],
    ['0123', 'หนองเรือ', '48:บ๊อบบี้'],
    ['0147', 'หนองแก', '48:บ๊อบบี้'],
    ['0166', 'บ้านแท่น', '48:บ๊อบบี้'],
    ['0057', 'หัวทะเล', '49:ป้อ'],
    ['0511', 'นิคมสุรนารี', '49:ป้อ'],
    ['0010', 'ร้อยเอ็ด1', '50:อั๋น'],
    ['0023', 'ร้อยเอ็ด2', '50:อั๋น'],
    ['0028', 'บ้านเหลื่อม', '51:ก้อย'],
    ['0130', 'บัวใหญ่', '51:ก้อย'],
    ['0132', 'คง', '51:ก้อย'],
    ['0060', 'ห้วยแถลง', '52:อาย'],
    ['0078', 'หนองหงส์', '52:อาย'],
    ['0081', 'หนองกี่', '52:อาย'],
    ['0106', 'สนญ.-เวสป้า', '55:คิงส์'],
    ['0113', 'สนญ.-คาวาซากิ', '55:คิงส์'],
    ['0134', 'ร้อยเอ็ด-เวสป้า', '55:คิงส์']
];

/** สร้างชีตทั้งหมดพร้อมหัวตาราง เรียกซ้ำได้ปลอดภัย (ไม่ลบข้อมูลเดิม) */
function setupSheets() {
  var ss = getSpreadsheet_();
  var created = [];

  var moved = [];
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      created.push(name);
    } else if (migrateColumns_(sh, HEADERS[name])) {
      // ต้องย้ายข้อมูลเดิมให้ตรงคอลัมน์ใหม่ก่อน ไม่งั้นเขียนหัวตารางทับแล้วข้อมูลจะเหลื่อม
      moved.push(name);
    }

    var headers = HEADERS[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold')
      .setBackground('#eef2ff');
    sh.setFrozenRows(1);

    // ล็อกคอลัมน์พวกวันที่/ซีเรียลเป็นข้อความ กัน Sheets แปลงเป็นวันที่หรือตัวเลขเอง
    (TEXT_COLUMNS[name] || []).forEach(function (field) {
      var col = headers.indexOf(field) + 1;
      if (col > 0) sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
    });

    sh.autoResizeColumns(1, headers.length);
  });

  // ใส่รายชื่อสาขาให้ตอนที่ชีตยังว่าง
  var br = ss.getSheetByName(SHEETS.BRANCHES);
  if (br.getLastRow() < 2) {
    var rows = SAMPLE_BRANCHES.map(function (b) { return [b[0], b[1], b[2], 'TRUE']; });
    br.getRange(2, 1, rows.length, HEADERS.Branches.length).setValues(rows);
  }
  normalizeBranchCodes_();

  var renamed = renameOldStatuses_();

  clearBranchCache_();
  var msg = created.length
    ? 'สร้างชีตใหม่: ' + created.join(', ')
    : 'ชีตครบอยู่แล้ว — อัปเดตหัวตารางให้เรียบร้อย';
  if (moved.length) msg += ' | ย้ายข้อมูลเดิมให้ตรงคอลัมน์ใหม่: ' + moved.join(', ');
  if (renamed) msg += ' | เปลี่ยนชื่อสถานะเดิมให้เป็นชื่อใหม่ ' + renamed + ' รายการ';
  msg += ' | สาขาในระบบ ' + Math.max(0, br.getLastRow() - 1) + ' สาขา';
  Logger.log(msg);
  return msg;
}

/**
 * ชีตเก่าที่หัวตารางไม่ตรงกับรุ่นปัจจุบัน (เช่นยังไม่มีคอลัมน์ อล.)
 * ให้จับคู่ข้อมูลตาม "ชื่อหัวตารางเดิม" แล้วเขียนกลับตามลำดับคอลัมน์ใหม่
 * คอลัมน์ที่ไม่มีในรุ่นใหม่จะถูกตัดทิ้ง คอลัมน์ที่เพิ่งเพิ่มจะได้ค่าว่าง
 */
function migrateColumns_(sh, want) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return false;

  var current = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h == null ? '' : h).trim();
  });

  var same = true;
  for (var i = 0; i < want.length; i++) {
    if (current[i] !== want[i]) { same = false; break; }
  }
  if (same) return false;

  var lastRow = sh.getLastRow();
  if (lastRow > 1) {
    var values = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var rebuilt = values.map(function (row) {
      return want.map(function (field) {
        var at = current.indexOf(field);
        return at < 0 ? '' : (row[at] === undefined ? '' : row[at]);
      });
    });
    sh.getRange(2, 1, rebuilt.length, want.length).setValues(rebuilt);
  }

  // ล้างคอลัมน์ส่วนเกินที่หลุดมาจากโครงเดิม
  if (lastCol > want.length) {
    sh.getRange(1, want.length + 1, Math.max(lastRow, 1), lastCol - want.length).clearContent();
  }
  return true;
}

/**
 * สถานะที่เปลี่ยนชื่อไปแล้ว ต้องไล่แก้ข้อมูลเก่าด้วย
 * ไม่งั้นแถวเดิมจะค้างอยู่ที่ชื่อที่ไม่มีในระบบแล้ว ไม่ถูกนับในแถบสรุปและกรองไม่เจอ
 */
function renameOldStatuses_() {
  var sh = getSpreadsheet_().getSheetByName(SHEETS.BATTERIES);
  if (!sh) return 0;
  var last = sh.getLastRow();
  if (last < 2) return 0;

  var range = sh.getRange(2, fieldCol_(sh, 'Batteries', 'status'), last - 1, 1);
  var values = range.getValues();
  var changed = 0;
  for (var i = 0; i < values.length; i++) {
    var cur = cellText_(values[i][0]);
    if (STATUS_RENAMES[cur]) {
      values[i][0] = STATUS_RENAMES[cur];
      changed++;
    }
  }
  if (changed) range.setValues(values);
  return changed;
}

/** ล็อกคอลัมน์รหัสสาขาเป็นข้อความ 4 หลัก กัน 0 นำหน้าหาย */
function normalizeBranchCodes_() {
  var sh = getSpreadsheet_().getSheetByName(SHEETS.BRANCHES);
  if (!sh) return 0;
  var last = sh.getLastRow();
  if (last < 2) return 0;

  var range = sh.getRange(2, 1, last - 1, 1);
  range.setNumberFormat('@');

  var values = range.getValues();
  var out = [];
  var changed = 0;
  for (var i = 0; i < values.length; i++) {
    var before = String(values[i][0] == null ? '' : values[i][0]).trim();
    var after = padBranchCode_(before);
    if (after !== before) changed++;
    out.push([after]);
  }
  if (changed) range.setValues(out);
  return changed;
}

/**
 * ดูลิงก์ของระบบ — รันฟังก์ชันนี้แล้วดูใน "บันทึกการดำเนินการ"
 */
function showBatteryLinks() {
  var url = '';
  try {
    url = ScriptApp.getService().getUrl() || '';
  } catch (err) {
    url = '';
  }
  if (!url) return 'ยังไม่ได้ Deploy เว็บแอป — Deploy ก่อนแล้วรันฟังก์ชันนี้อีกครั้ง';

  var key = getBatteryAdminKey_();
  var out = [
    'ลิงก์สำหรับสาขา (ดูอย่างเดียว แก้ไขอะไรไม่ได้):',
    url,
    '',
    'รหัสเข้าโหมดแอดมิน (กดปุ่มกุญแจมุมขวาบนของหน้าเว็บ แล้วกรอกรหัสนี้):',
    key,
    '',
    'หรือจะใช้ลิงก์ที่ใส่รหัสมาให้เลยก็ได้ (อย่าส่งให้สาขา):',
    url + '?key=' + key,
    '',
    'ลิงก์เจาะจงสาขาเดียว เช่นสาขาคง (ส่งให้สาขานั้นดูเฉพาะของตัวเอง):',
    url + '?branch=' + encodeURIComponent('คง')
  ].join('\n');
  Logger.log(out);
  return out;
}

/* =======================================================================
 * กู้แถวที่ข้อมูลเลื่อนคอลัมน์
 *
 * เกิดกับแถวที่บันทึกไว้ตอนที่โค้ดมีฟิลด์ใหม่แล้ว (รุ่นรถ / อล.)
 * แต่หัวตารางในชีตยังไม่มีคอลัมน์นั้น ค่าจึงถูกเขียนเลื่อนไปทางขวาหนึ่งช่อง
 * อาการที่เห็นคือ "ชื่อรุ่นรถไปโผล่ในช่องสาขา" และ "ชื่อสาขาไปโผล่ในช่องเขต"
 *
 * ตัวจับคือรายชื่อสาขา — แถวที่ช่องสาขาไม่ใช่ชื่อสาขาจริง แต่ช่องเขตเป็นชื่อสาขาจริง
 * คือแถวที่เลื่อน แถวที่ปกติจะไม่เข้าเงื่อนไขนี้เลย จึงไม่ถูกแตะ
 * ต้องสั่งรันเอง ไม่ทำอัตโนมัติ เพราะเป็นการเขียนทับข้อมูลเดิม
 * ===================================================================== */

function fixShiftedRows() {
  var lines = ['ผลการกู้แถวที่ข้อมูลเลื่อนคอลัมน์', ''];

  try {
    var rp = fixShiftedRepairs_();
    lines.push('รถส่งซ่อม: ' + (rp.length ? 'แก้ ' + rp.length + ' แถว' : 'ไม่พบแถวที่เลื่อน'));
    rp.forEach(function (t) { lines.push('  • ' + t); });
  } catch (err) {
    lines.push('รถส่งซ่อม: ❌ ' + (err.message || err));
  }

  lines.push('');
  try {
    var bt = fixShiftedBatteries_();
    lines.push('แบตเตอรี่: ' + (bt.length ? 'แก้ ' + bt.length + ' แถว' : 'ไม่พบแถวที่เลื่อน'));
    bt.forEach(function (t) { lines.push('  • ' + t); });
  } catch (err) {
    lines.push('แบตเตอรี่: ❌ ' + (err.message || err));
  }

  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

/** ชื่อสาขา → ข้อมูลสาขา ใช้เป็นตัวชี้ว่าแถวไหนเลื่อน */
function branchesByName_() {
  var map = {};
  getBranches_().forEach(function (b) { map[b.name] = b; });
  return map;
}

function fixShiftedRepairs_() {
  var sh = getWritableSheet_(SHEETS.REPAIRS);
  var byName = branchesByName_();
  var fixed = [];

  readRows_(SHEETS.REPAIRS).forEach(function (r) {
    // ช่องสาขาไม่ใช่สาขาจริง แต่ช่องเขตเป็นสาขาจริง = เลื่อนไปหนึ่งช่อง
    if (!r.branch || byName[r.branch] || !byName[r.zone]) return;

    var rec = {
      repairId: r.repairId,
      receivedDate: r.receivedDate,
      jobNo: r.jobNo,
      contractNo: r.contractNo,
      vehicleModel: r.vehicleModel || r.branch,   // ค่าที่เลื่อนมาอยู่ในช่องสาขา
      branch: r.zone,
      zone: byName[r.zone].zone,
      status: r.status,
      note: r.note,
      updatedAt: r.updatedAt,
      updatedBy: r.updatedBy
    };

    // สถานะกับหมายเหตุเลื่อนตามกันมาด้วย ในแถวที่ยังไม่เคยกดเปลี่ยนสถานะ
    if (REPAIR_STATUSES.indexOf(rec.status) < 0 && REPAIR_STATUSES.indexOf(rec.note) >= 0) {
      rec.status = rec.note;
      rec.note = '';
    } else if (REPAIR_STATUSES.indexOf(rec.note) >= 0) {
      rec.note = '';                              // สถานะเก่าที่ค้างอยู่ในช่องหมายเหตุ
    }
    if (REPAIR_STATUSES.indexOf(rec.status) < 0) rec.status = REPAIR_STATUSES[0];

    var values = toRowValues_(sh, SHEETS.REPAIRS, rec);
    sh.getRange(r._row, 1, 1, values.length).setValues([values]);
    fixed.push(rec.repairId + ' → รุ่น "' + rec.vehicleModel + '" สาขา "' + rec.branch +
      '" เขต "' + rec.zone + '" สถานะ "' + rec.status + '"');
  });

  return fixed;
}

function fixShiftedBatteries_() {
  var sh = getWritableSheet_(SHEETS.BATTERIES);
  var byName = branchesByName_();
  var fixed = [];

  readRows_(SHEETS.BATTERIES).forEach(function (b) {
    if (!b.branch || byName[b.branch] || !byName[b.zone]) return;

    var rec = {
      batteryId: b.batteryId,
      receivedDate: b.receivedDate,
      alNo: b.alNo || b.branch,        // อล. ที่เลื่อนไปอยู่ในช่องสาขา
      branch: b.zone,
      zone: byName[b.zone].zone,
      serial: b.model,
      model: b.qty,
      qty: b.status,
      status: b.note,
      note: b.updatedAt,
      updatedAt: b.updatedBy,
      updatedBy: '',
      deliveredAt: b.deliveredAt,
      receiver: b.receiver,
      deliveryNote: b.deliveryNote,
      deliveryPhotoId: b.deliveryPhotoId
    };

    // ถ้าเคยกดเปลี่ยนสถานะไปแล้ว ช่องสถานะจะถูกเขียนทับด้วยสถานะจริง (จำนวนหายไปด้วย)
    if (BATTERY_STATUSES.indexOf(b.status) >= 0) {
      rec.status = b.status;
      rec.qty = '';
      rec.note = b.note;
      rec.updatedAt = b.updatedAt;
      rec.updatedBy = b.updatedBy;
    }
    if (BATTERY_STATUSES.indexOf(rec.status) < 0) rec.status = BATTERY_STATUSES[0];
    if (!(Number(rec.qty) > 0)) rec.qty = 1;       // จำนวนกู้ไม่ได้ ตั้งเป็น 1 ไว้ให้มาแก้เอง

    var values = toRowValues_(sh, SHEETS.BATTERIES, rec);
    sh.getRange(b._row, 1, 1, values.length).setValues([values]);
    fixed.push(rec.batteryId + ' → อล. "' + rec.alNo + '" สาขา "' + rec.branch +
      '" รุ่น "' + rec.model + '" จำนวน ' + rec.qty + ' สถานะ "' + rec.status + '"');
  });

  return fixed;
}

/**
 * ตรวจว่าเซิร์ฟเวอร์อ่านอะไรได้จากชีตบ้าง — ใช้ตอนข้อมูลอยู่ในชีตแต่หน้าเว็บไม่ขึ้น
 * รันแล้วดูที่ "บันทึกการดำเนินการ"
 */
function debugBatteries() {
  var lines = [];
  try {
    var sh = getWritableSheet_(SHEETS.BATTERIES);
    lines.push('ชีต Batteries: ' + sh.getLastRow() + ' แถว × ' + sh.getLastColumn() + ' คอลัมน์');
    lines.push('หัวตารางที่โค้ดคาดไว้ : ' + HEADERS.Batteries.join(' | '));
    if (sh.getLastColumn() > 0) {
      lines.push('หัวตารางที่อยู่ในชีต  : ' +
        sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].join(' | '));
    }

    var rows = readBatteries_();
    lines.push('อ่านได้ ' + rows.length + ' รายการ');
    rows.slice(-3).forEach(function (b) {
      lines.push('  • ' + b.batteryId + ' | สาขา "' + b.branch + '" | สถานะ "' + b.status +
        '" | อล. "' + b.alNo + '" | รับเข้า ' + b.receivedDate);
    });

    var listed = apiListBatteries({});
    lines.push('apiListBatteries({}) → ' +
      (listed.ok ? listed.results.length + ' รายการ (ทั้งหมด ' + listed.total + ')'
                 : 'ผิดพลาด: ' + listed.error));

    var rp = getWritableSheet_(SHEETS.REPAIRS);
    lines.push('');
    lines.push('ชีต Repairs: ' + rp.getLastRow() + ' แถว × ' + rp.getLastColumn() + ' คอลัมน์');
    var repairs = readRepairs_();
    lines.push('อ่านได้ ' + repairs.length + ' รายการ');
    repairs.slice(-3).forEach(function (r) {
      lines.push('  • ' + r.repairId + ' | JOB ' + r.jobNo + ' | สัญญา ' + r.contractNo +
        ' | รุ่นรถ ' + r.vehicleModel + ' | สาขา "' + r.branch + '" | สถานะ "' + r.status + '"');
    });
    var listedRp = apiListRepairs({});
    lines.push('apiListRepairs({}) → ' +
      (listedRp.ok ? listedRp.results.length + ' รายการ (ทั้งหมด ' + listedRp.total + ')'
                   : 'ผิดพลาด: ' + listedRp.error));
  } catch (err) {
    lines.push('❌ ' + (err.message || err));
  }
  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

/** ตรวจว่าตั้งค่าครบหรือยัง */
function checkSetup() {
  var lines = [];
  Object.keys(HEADERS).forEach(function (name) {
    var sh = getSpreadsheet_().getSheetByName(name);
    if (!sh) {
      lines.push('❌ ชีต ' + name);
      return;
    }
    // คอลัมน์ที่หัวตารางยังไม่มี = ค่าที่กรอกในช่องนั้นจะหายไปตอนบันทึก
    var index = sheetLayout_(sh, name).index;
    var missing = HEADERS[name].filter(function (f) { return index[f] < 0; });
    lines.push((missing.length ? '⚠️' : '✅') + ' ชีต ' + name +
      ' (' + Math.max(0, sh.getLastRow() - 1) + ' แถว)' +
      (missing.length ? ' — ยังไม่มีคอลัมน์ ' + missing.join(', ') + ' ให้รัน setupSheets()' : ''));
  });

  // แถวที่ข้อมูลเลื่อนคอลัมน์ ดูจากช่องสาขาที่ไม่ใช่ชื่อสาขาจริง
  try {
    var byName = branchesByName_();
    var bad = 0;
    readRows_(SHEETS.REPAIRS).forEach(function (r) {
      if (r.branch && !byName[r.branch] && byName[r.zone]) bad++;
    });
    readRows_(SHEETS.BATTERIES).forEach(function (b) {
      if (b.branch && !byName[b.branch] && byName[b.zone]) bad++;
    });
    if (bad) {
      lines.push('⚠️ มี ' + bad + ' แถวที่ข้อมูลเลื่อนคอลัมน์ (ชื่อรุ่น/อล. ไปโผล่ในช่องสาขา) — ' +
        'สั่งเมนู "กู้แถวที่ข้อมูลเลื่อนคอลัมน์" เพื่อจัดกลับให้');
    } else {
      lines.push('✅ ไม่มีแถวที่ข้อมูลเลื่อนคอลัมน์');
    }
  } catch (err) {
    lines.push('➖ ตรวจแถวที่เลื่อนคอลัมน์ไม่ได้: ' + (err.message || err));
  }

  lines.push('🔑 รหัสเข้าโหมดแอดมิน: ' + getBatteryAdminKey_());
  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

/** เมนูลัดบนชีต */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ระบบติดตามสถานะ')
    .addItem('ติดตั้ง/ซ่อมโครงสร้างชีต', 'setupSheets')
    .addItem('ดูลิงก์สำหรับแจก', 'showBatteryLinksDialog')
    .addItem('ตรวจการตั้งค่า', 'checkSetupDialog')
    .addItem('ตรวจข้อมูล (ตอนหน้าเว็บไม่ขึ้น)', 'debugBatteriesDialog')
    .addItem('กู้แถวที่ข้อมูลเลื่อนคอลัมน์', 'fixShiftedRowsDialog')
    .addToUi();
}

function checkSetupDialog() { SpreadsheetApp.getUi().alert(checkSetup()); }
function showBatteryLinksDialog() { SpreadsheetApp.getUi().alert(showBatteryLinks()); }
function debugBatteriesDialog() { SpreadsheetApp.getUi().alert(debugBatteries()); }
function fixShiftedRowsDialog() { SpreadsheetApp.getUi().alert(fixShiftedRows()); }
