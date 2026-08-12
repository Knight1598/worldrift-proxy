/**
 * ฟอร์มส่งรถซ่อมข้ามสาขา — ฝั่งสาขาที่ส่งรถ (โปรเจกต์ A)
 *
 * เป็นโปรเจกต์แยก มี URL ของตัวเอง แต่เขียนลง "ไฟล์ชีตเดียวกัน" กับระบบแบต/รถส่งซ่อมเดิม
 * สาขาอื่นได้ลิงก์นี้ไปกรอกฟอร์มเท่านั้น เห็นรายการของสาขาอื่นหรือแก้ข้อมูลไม่ได้เลย
 *
 * ใช้คู่กับไฟล์ Form.html — มีแค่ 2 ไฟล์
 * ดูขั้นตอนติดตั้งใน README.md
 *
 * ข้อตกลงกับระบบเดิมที่ห้ามแก้ข้างเดียว
 *   - ชื่อชีต Repairs / Branches
 *   - ชื่อคอลัมน์ทุกตัวใน REPAIR_FIELDS
 *   - ข้อความสถานะ INCOMING_STATUS
 */

var SHEETS = {
  BRANCHES: 'Branches',
  REPAIRS: 'Repairs'
};

/**
 * คอลัมน์ของชีต Repairs ที่ระบบนี้ต้องใช้ (ชุดเดียวกับระบบเดิม)
 * ลำดับในลิสต์นี้ใช้แค่ตอนต้องสร้างคอลัมน์ที่ยังไม่มี — การอ่าน/เขียนอ้างชื่อหัวตารางล้วน ๆ
 * คอลัมน์ที่ชีตยังไม่มีจะถูกต่อท้ายขวาสุด ลำดับคอลัมน์เดิมจึงไม่ขยับ
 */
var REPAIR_FIELDS = [
  'repairId', 'receivedDate', 'jobNo', 'contractNo', 'vehicleModel', 'branch', 'zone',
  'status', 'note', 'updatedAt', 'updatedBy',
  'BranchCode', 'PlateNo', 'Source', 'EvidenceImage', 'ReceivedBy', 'ReceivedAt'
];

/** คอลัมน์ที่ต้องบังคับให้ชีตเก็บเป็นข้อความ ไม่งั้น Sheets แปลงเป็นวันที่/ตัวเลขให้เอง */
var TEXT_FIELDS = ['receivedDate', 'jobNo', 'contractNo', 'updatedAt',
                   'BranchCode', 'PlateNo', 'ReceivedAt'];

var BRANCH_FIELDS = ['branchCode', 'branchName', 'zone', 'active'];

/** สถานะของรถที่ส่งมาแล้วรอสาขาหลักกดรับ — ต้องตรงกับระบบเดิมเป๊ะ ๆ */
var INCOMING_STATUS = 'รอรับรถ (กำลังจัดส่ง)';

/** ที่มาของรายการ ใช้แยกว่ารายการไหนมาจากฟอร์มนี้ */
var SOURCE_LABEL = 'สาขาอื่น';

/** โฟลเดอร์เก็บรูปหลักฐาน (สร้างอัตโนมัติครั้งแรก แล้วจำ id ไว้ใน Script Properties) */
var EVIDENCE_FOLDER_NAME = 'หลักฐานรถส่งซ่อมข้ามสาขา';

/** ตัวเลือกให้พิมพ์ชื่อสาขาเองเมื่อไม่มีในรายการ */
var OTHER_BRANCH = '__other__';

var LOCK_WAIT_MS = 20000;

var TZ = 'Asia/Bangkok';

/* =======================================================================
 * ส่วนที่ 1 — ตัวช่วยพื้นฐาน (property / ชีต / วันเวลา)
 * ===================================================================== */

function props_() {
  return PropertiesService.getScriptProperties();
}

function prop_(key, fallback) {
  var v = props_().getProperty(key);
  return (v === null || v === '') ? (fallback === undefined ? '' : fallback) : v;
}

/**
 * ไฟล์ชีตของระบบเดิม
 * โปรเจกต์นี้เป็นสคริปต์เดี่ยว ไม่ได้ผูกกับชีต จึงต้องตั้ง SPREADSHEET_ID ไว้ใน Script Properties
 */
function getSpreadsheet_() {
  var id = prop_('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);

  var ss = SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error('ยังไม่ได้ตั้งค่า SPREADSHEET_ID ใน Script Properties — ' +
      'ใส่ id ของไฟล์ชีตที่ระบบแบต/รถส่งซ่อมใช้อยู่');
  }
  return ss;
}

function getSheet_(name) {
  var sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) {
    throw new Error('ไม่พบชีต "' + name + '" ในไฟล์ที่ตั้งค่าไว้ — ' +
      'ตรวจว่า SPREADSHEET_ID ชี้ไปที่ไฟล์ของระบบแบต/รถส่งซ่อมจริง');
  }
  return sh;
}

function todayIso_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

/** อ่านค่าจากช่องในชีตให้เป็นข้อความเสมอ (Sheets ชอบแปลงวันที่/ตัวเลขให้เอง) */
function cellText_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
    return Utilities.formatDate(v, TZ, hasTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
  }
  return String(v).trim();
}

/* =======================================================================
 * ส่วนที่ 2 — อ่าน/เขียนชีตโดยอ้างชื่อหัวตาราง (Header Map)
 * ห้ามอ้างเลขคอลัมน์ตรง ๆ เพราะชีตของระบบเดิมมีคอลัมน์ต่อท้ายเพิ่มได้เรื่อย ๆ
 * ===================================================================== */

/** { ชื่อคอลัมน์ → index เริ่มที่ 0 } ของหัวตารางจริง คอลัมน์ที่ไม่มีจะได้ -1 */
function headerMap_(sh, fields) {
  var index = {};
  var lastCol = sh.getLastColumn();
  if (lastCol > 0) {
    var head = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    for (var c = 0; c < head.length; c++) {
      var name = String(head[c] == null ? '' : head[c]).trim();
      if (name && index[name] === undefined) index[name] = c;
    }
  }
  fields.forEach(function (f) { if (index[f] === undefined) index[f] = -1; });
  return { index: index, lastCol: lastCol };
}

/**
 * เติมคอลัมน์ที่หัวตารางยังไม่มี โดยต่อท้ายด้านขวา ไม่ขยับข้อมูลเดิมแม้แต่ช่องเดียว
 * คืนรายชื่อคอลัมน์ที่เพิ่งเติม
 */
function ensureColumns_(sh, fields) {
  var map = headerMap_(sh, fields);
  var missing = fields.filter(function (f) { return map.index[f] < 0; });
  if (!missing.length) return [];

  var start = Math.max(map.lastCol, 0) + 1;
  var need = start + missing.length - 1;
  var maxCols = sh.getMaxColumns();
  if (maxCols < need) sh.insertColumnsAfter(Math.max(maxCols, 1), need - maxCols);

  sh.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold');

  // คอลัมน์ที่ต้องเก็บเป็นข้อความ ต้องล็อกรูปแบบไว้ตั้งแต่ตอนสร้าง
  var after = headerMap_(sh, fields);
  TEXT_FIELDS.forEach(function (f) {
    if (missing.indexOf(f) < 0) return;
    var col = after.index[f];
    if (col >= 0) {
      sh.getRange(2, col + 1, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
    }
  });

  console.warn('เติมคอลัมน์ที่ขาดในชีต ' + sh.getName() + ': ' + missing.join(', '));
  return missing;
}

/** ชีต Repairs ที่พร้อมเขียน — เติมคอลัมน์ที่ขาดให้ก่อน ค่าที่กรอกจะได้ไม่หายกลางทาง */
function repairSheet_() {
  var sh = getSheet_(SHEETS.REPAIRS);
  ensureColumns_(sh, REPAIR_FIELDS);
  return sh;
}

/** อ่านทุกแถวออกมาเป็นออบเจ็กต์ตามชื่อคอลัมน์ */
function readRows_(sh, fields) {
  var last = sh.getLastRow();
  if (last < 2) return [];

  var map = headerMap_(sh, fields);
  var width = Math.max(1, sh.getLastColumn());
  var values = sh.getRange(2, 1, last - 1, width).getValues();

  var out = [];
  for (var i = 0; i < values.length; i++) {
    var rec = { _row: i + 2 };
    fields.forEach(function (f) {
      var c = map.index[f];
      rec[f] = c >= 0 ? cellText_(values[i][c]) : '';
    });
    out.push(rec);
  }
  return out;
}

/** ตั้งรูปแบบ "ข้อความ" ให้ช่องที่ห้าม Sheets ตีความเอง เฉพาะแถวที่ระบุ */
function setTextFormatOnRow_(sh, row) {
  var map = headerMap_(sh, REPAIR_FIELDS);
  TEXT_FIELDS.forEach(function (f) {
    var col = map.index[f];
    if (col >= 0) sh.getRange(row, col + 1).setNumberFormat('@');
  });
}

/** เรียงค่าลงแถวตามหัวตารางจริง ช่องที่ไม่ได้ส่งค่ามาจะเว้นว่างไว้ */
function toRowValues_(sh, fields, rec) {
  var map = headerMap_(sh, fields);
  var width = Math.max(map.lastCol, fields.length);
  var row = [];
  for (var i = 0; i < width; i++) row.push('');
  fields.forEach(function (f) {
    var c = map.index[f];
    if (c >= 0 && c < width) row[c] = rec[f] === undefined ? '' : rec[f];
  });
  return row;
}

/* =======================================================================
 * ส่วนที่ 3 — ข้อมูลสาขา
 * ===================================================================== */

var BRANCH_CACHE_KEY = 'dispatch_branches_v1';
var BRANCH_CACHE_SEC = 300;

/** รายชื่อสาขาที่ยังใช้งาน (active ไม่ได้ระบุว่าปิด = ถือว่าเปิด) */
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
  var out = [];
  readRows_(sh, BRANCH_FIELDS).forEach(function (b) {
    var name = String(b.branchName || '').trim();
    if (!name) return;
    if (!isActive_(b.active)) return;
    out.push({
      code: padBranchCode_(b.branchCode),
      name: name,
      zone: String(b.zone || '').trim()
    });
  });

  out.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
  try {
    cache.put(BRANCH_CACHE_KEY, JSON.stringify(out), BRANCH_CACHE_SEC);
  } catch (err) {
    // แคชไม่ได้ก็ไม่เป็นไร แค่อ่านชีตบ่อยขึ้น
  }
  return out;
}

/** ถือว่าเปิดใช้งาน เว้นแต่ระบุชัดว่าปิด เพื่อให้แถวที่เว้นช่องว่างยังใช้ได้ */
function isActive_(v) {
  if (v === '' || v === null || v === undefined) return true;
  var s = String(v).trim().toUpperCase();
  return s !== 'FALSE' && s !== 'NO' && s !== '0' && s !== 'ไม่' && s !== 'ปิด';
}

/** รหัสสาขาให้เป็นเลข 4 หลักเสมอ (Sheets ตัด 0 นำหน้าทิ้ง) */
function padBranchCode_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (!/^\d+$/.test(s)) return s;
  while (s.length < 4) s = '0' + s;
  return s;
}

function findBranchByName_(name) {
  var key = String(name || '').trim();
  var list = getBranches_();
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === key) return list[i];
  }
  return null;
}

/* =======================================================================
 * ส่วนที่ 4 — เราต์ของเว็บแอป และ API ที่หน้าเว็บเรียก
 * ทุกฟังก์ชันที่หน้าเว็บเรียก คืนค่ารูปแบบเดียวกัน { ok, message, data }
 * ===================================================================== */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Form')
    .setTitle('ส่งรถซ่อมข้ามสาขา')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** ข้อมูลตั้งต้นของฟอร์ม: รายชื่อสาขา + วันนี้ */
function apiBootstrap() {
  try {
    var branches = getBranches_();
    return {
      ok: true,
      message: 'พร้อมใช้งาน (' + branches.length + ' สาขา)',
      data: {
        branches: branches,
        today: todayIso_(),
        otherBranchValue: OTHER_BRANCH
      }
    };
  } catch (err) {
    return { ok: false, message: String(err.message || err) };
  }
}

/**
 * รับข้อมูลจากฟอร์มแล้วบันทึกลงชีต Repairs
 * ทุกช่องบังคับกรอก รวมรูปหลักฐาน
 */
function apiSubmitRepair(payload) {
  try {
    return submitRepair_(payload || {});
  } catch (err) {
    return { ok: false, message: String(err.message || err) };
  }
}

function submitRepair_(p) {
  var clean = validateSubmission_(p);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) {
    throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณากดส่งอีกครั้ง');
  }

  var saved;
  try {
    var sh = repairSheet_();
    var rows = readRows_(sh, REPAIR_FIELDS).filter(function (r) { return !!r.repairId; });

    // ห้ามส่งเลขที่งานเดิมซ้ำ ถ้าคันก่อนยังรอสาขาหลักรับอยู่
    var key = clean.jobNo.toUpperCase();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].status !== INCOMING_STATUS) continue;
      if (String(rows[i].jobNo || '').trim().toUpperCase() !== key) continue;
      throw new Error('เลขที่งาน ' + clean.jobNo + ' ถูกส่งไปแล้ว (' + rows[i].repairId +
        ' จากสาขา ' + rows[i].branch + ') และยังรอสาขาหลักรับรถอยู่');
    }

    // เก็บรูปหลังผ่านด่านตรวจซ้ำ ไม่งั้นไฟล์ค้างในไดรฟ์ทั้งที่บันทึกไม่สำเร็จ
    var evidenceUrl = saveEvidenceImage_(clean);

    var stamp = nowStamp_();
    var rec = {
      repairId: nextRepairId_(rows),
      receivedDate: '',                 // ยังไม่ได้รับรถ เว้นไว้ให้สาขาหลักกรอกตอนกดรับ
      jobNo: clean.jobNo,
      contractNo: '',
      vehicleModel: clean.vehicleModel,
      branch: clean.branch,
      zone: clean.zone,
      status: INCOMING_STATUS,
      note: clean.note,
      updatedAt: stamp,
      updatedBy: clean.sender,
      BranchCode: clean.branchCode,
      PlateNo: clean.plateNo,
      Source: SOURCE_LABEL,
      EvidenceImage: evidenceUrl,
      ReceivedBy: '',
      ReceivedAt: ''
    };

    var values = toRowValues_(sh, REPAIR_FIELDS, rec);
    var target = sh.getLastRow() + 1;

    // ล็อกช่องที่ต้องเป็นข้อความของ "แถวนี้" ก่อนเขียน ไม่งั้น Sheets แปลง
    // "2026-08-12 09:30:00" เป็นวันที่ และตัด 0 นำหน้าของรหัสสาขา/ทะเบียนทิ้ง
    // ทำแค่แถวที่เพิ่ม ไม่แตะทั้งคอลัมน์ เพราะแถวเก่าของระบบเดิมจะเสียรูปแบบไปด้วย
    setTextFormatOnRow_(sh, target);

    sh.getRange(target, 1, 1, values.length).setValues([values]);
    saved = rec;
  } finally {
    lock.releaseLock();
  }

  return {
    ok: true,
    message: 'ส่งข้อมูลแล้ว — เลขที่รายการ ' + saved.repairId +
      '\nรออีกฝั่งกดรับรถเข้าซ่อม',
    data: {
      repairId: saved.repairId,
      jobNo: saved.jobNo,
      branch: saved.branch,
      zone: saved.zone,
      plateNo: saved.PlateNo,
      vehicleModel: saved.vehicleModel,
      evidenceImage: saved.EvidenceImage,
      submittedAt: saved.updatedAt
    }
  };
}

/** ตรวจข้อมูลจากฟอร์มให้ครบก่อนบันทึก (บังคับทุกช่อง) */
function validateSubmission_(p) {
  var branchChoice = String(p.branch || '').trim();
  if (!branchChoice) throw new Error('ยังไม่ได้เลือกสาขาที่ส่ง');

  var branch, zone, branchCode;
  if (branchChoice === OTHER_BRANCH) {
    branch = String(p.branchOther || '').trim();
    zone = String(p.zoneOther || '').trim();
    branchCode = '';
    if (!branch) throw new Error('เลือก "อื่น ๆ" แล้ว ต้องพิมพ์ชื่อสาขาด้วย');
    if (!zone) throw new Error('เลือก "อื่น ๆ" แล้ว ต้องพิมพ์โซนด้วย');
  } else {
    var info = findBranchByName_(branchChoice);
    if (!info) throw new Error('ไม่พบสาขา "' + branchChoice + '" ในระบบ — เลือกใหม่หรือใช้ "อื่น ๆ"');
    branch = info.name;
    zone = info.zone;
    branchCode = info.code;
  }

  var jobNo = String(p.jobNo || '').trim();
  if (!jobNo) throw new Error('ยังไม่ได้กรอกเลขที่งาน');

  var vehicleModel = String(p.vehicleModel || '').trim();
  if (!vehicleModel) throw new Error('ยังไม่ได้กรอกรุ่นรถ');

  var plateNo = String(p.plateNo || '').trim();
  if (!plateNo) throw new Error('ยังไม่ได้กรอกข้อมูลขนส่ง + ทะเบียน');

  var sender = String(p.sender || '').trim();
  if (!sender) throw new Error('ยังไม่ได้กรอกชื่อผู้ส่ง');

  var note = String(p.note || '').trim();
  if (!note) throw new Error('ยังไม่ได้กรอกอาการเบื้องต้น');

  var base64 = String(p.imageBase64 || '');
  if (!base64) throw new Error('ยังไม่ได้แนบรูปหลักฐาน');

  return {
    branch: branch,
    zone: zone,
    branchCode: branchCode,
    jobNo: jobNo,
    vehicleModel: vehicleModel,
    plateNo: plateNo,
    sender: sender,
    note: note,
    imageBase64: base64,
    imageMimeType: String(p.imageMimeType || 'image/jpeg')
  };
}

/**
 * เลขที่รายการ รูปแบบ RP-yyyyMMdd-HHmmss-###
 * ### คือลำดับที่ของวันนั้น นับจากแถวที่มีอยู่แล้ว (เรียกใต้ lock เท่านั้น)
 */
function nextRepairId_(rows) {
  var now = new Date();
  var day = Utilities.formatDate(now, TZ, 'yyyyMMdd');
  var prefix = 'RP-' + day + '-';

  var count = 0;
  rows.forEach(function (r) {
    if (String(r.repairId || '').indexOf(prefix) === 0) count++;
  });

  return prefix + Utilities.formatDate(now, TZ, 'HHmmss') + '-' +
    ('00' + (count + 1)).slice(-3);
}

/* =======================================================================
 * ส่วนที่ 5 — รูปหลักฐาน
 * ===================================================================== */

/**
 * ข้อความบอกทางแก้เวลาโดน Google ปฏิเสธเพราะยังไม่ได้อนุญาตสิทธิ์ Drive
 * ข้อความดิบของ Google เป็นภาษาอังกฤษปนลิงก์ยาว ๆ คนกรอกฟอร์มอ่านแล้วไม่รู้จะทำอะไร
 */
function drivePermissionError_(err) {
  var raw = String((err && err.message) || err || '');
  if (!/auth\/drive|Drive|ไม่ได้รับอนุญาต|not been granted|PERMISSION_DENIED/i.test(raw)) return null;

  return new Error(
    'ระบบยังไม่ได้รับสิทธิ์เข้าถึง Google Drive จึงเก็บรูปหลักฐานไม่ได้\n' +
    'แจ้งคนที่ดูแลระบบให้ทำตามนี้ (ทำครั้งเดียว):\n' +
    '1. เปิดโปรเจกต์ Apps Script ของฟอร์มนี้ แล้วรันฟังก์ชัน authorize\n' +
    '2. กดอนุญาตให้ครบทุกข้อ รวมข้อที่ขอสิทธิ์ Google Drive\n' +
    '3. Deploy → Manage deployments → ดินสอ → Version: New version\n' +
    '(รายละเอียดเดิมจาก Google: ' + raw + ')'
  );
}

/** โฟลเดอร์เก็บรูป (ตั้ง EVIDENCE_FOLDER_ID เองก็ได้ ไม่ตั้งระบบสร้างให้) */
function getEvidenceFolder_() {
  var id = prop_('EVIDENCE_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (err) {
      var denied = drivePermissionError_(err);
      if (denied) throw denied;
      // นอกจากเรื่องสิทธิ์ ก็คือโฟลเดอร์ถูกลบหรือ id ผิด — สร้างใหม่ให้
    }
  }

  try {
    var it = DriveApp.getFoldersByName(EVIDENCE_FOLDER_NAME);
    var folder = it.hasNext() ? it.next() : DriveApp.createFolder(EVIDENCE_FOLDER_NAME);
    props_().setProperty('EVIDENCE_FOLDER_ID', folder.getId());
    return folder;
  } catch (err2) {
    throw drivePermissionError_(err2) || err2;
  }
}

/**
 * เก็บรูปลงไดรฟ์ ตั้งชื่อเป็น เลขที่งาน_วันที่.นามสกุล แล้วเปิดลิงก์ให้ดูได้
 * คืนลิงก์เปิดดูรูป ถ้าเปิดสิทธิ์ลิงก์ไม่ได้ (นโยบายองค์กรบางที่ห้าม) ก็ยังคืนลิงก์เดิม
 * คนที่เปิดได้จะเป็นคนในองค์กรที่มีสิทธิ์อยู่แล้ว
 */
function saveEvidenceImage_(clean) {
  var type = String(clean.imageMimeType || 'image/jpeg');
  var ext = type.indexOf('png') >= 0 ? '.png'
    : (type.indexOf('webp') >= 0 ? '.webp' : '.jpg');
  var name = safeFileNamePart_(clean.jobNo) + '_' + todayIso_() + ext;

  var blob = Utilities.newBlob(Utilities.base64Decode(clean.imageBase64), type, name);

  var file;
  try {
    file = getEvidenceFolder_().createFile(blob);
  } catch (err) {
    throw drivePermissionError_(err) || err;
  }

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err2) {
    console.warn('เปิดสิทธิ์ลิงก์รูปไม่ได้ (อาจติดนโยบายขององค์กร): ' + err2);
  }
  return file.getUrl();
}

/** ตัดอักขระที่ห้ามใช้ในชื่อไฟล์ออก */
function safeFileNamePart_(v) {
  return String(v == null ? '' : v).trim().replace(/[\\/:*?"<>|]/g, '-').substring(0, 60) || 'ไม่ระบุงาน';
}

/* =======================================================================
 * ส่วนที่ 6 — ตรวจการตั้งค่า (รันเองจากหน้า Apps Script)
 * ===================================================================== */

/** ตรวจว่าต่อกับชีตของระบบเดิมถูกไฟล์ และคอลัมน์ที่ต้องใช้ครบไหม */
function checkSetup() {
  var lines = [];
  try {
    var ss = getSpreadsheet_();
    lines.push('✅ ไฟล์ชีต: ' + ss.getName());
    lines.push('   id: ' + ss.getId());

    [SHEETS.BRANCHES, SHEETS.REPAIRS].forEach(function (name) {
      var sh = ss.getSheetByName(name);
      lines.push((sh ? '✅' : '❌') + ' ชีต ' + name +
        (sh ? ' (' + Math.max(0, sh.getLastRow() - 1) + ' แถว)' : ' — ไม่พบ'));
    });

    var rp = ss.getSheetByName(SHEETS.REPAIRS);
    if (rp) {
      var map = headerMap_(rp, REPAIR_FIELDS);
      var missing = REPAIR_FIELDS.filter(function (f) { return map.index[f] < 0; });
      lines.push(missing.length
        ? '⚠️ ยังไม่มีคอลัมน์ ' + missing.join(', ') + ' — ระบบจะเติมให้เองตอนส่งครั้งแรก'
        : '✅ คอลัมน์ที่ต้องใช้ครบแล้ว');
    }

    lines.push('✅ สาขาที่เลือกได้: ' + getBranches_().length + ' สาขา');

    // แยก try ของ Drive ไว้ต่างหาก ติดเรื่องสิทธิ์แล้วบรรทัดอื่นต้องยังรายงานได้
    try {
      lines.push('📁 โฟลเดอร์รูปหลักฐาน: ' + getEvidenceFolder_().getName());
    } catch (driveErr) {
      lines.push('❌ Google Drive: ' + (driveErr.message || driveErr));
      lines.push('   → รันฟังก์ชัน authorize แล้วกดอนุญาตให้ครบทุกข้อ');
    }

    lines.push('🔗 ลิงก์ฟอร์มสำหรับแจกสาขา: ' + (ScriptApp.getService().getUrl() || 'ยังไม่ได้ deploy'));
  } catch (err) {
    lines.push('❌ ' + (err.message || err));
  }

  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

/**
 * รันตัวนี้เพื่อให้หน้าขอสิทธิ์เด้งขึ้นมาครบทุกข้อ (ชีต + Drive)
 *
 * Apps Script คิดรายการสิทธิ์จากโค้ดที่มีอยู่ตอนกดรัน ถ้าเคยกดอนุญาตไว้ตอนโค้ดยังไม่ครบ
 * ตัวโปรเจกต์จะค้างอยู่กับสิทธิ์ชุดเก่า แล้วพอถึงจังหวะเก็บรูปจริงก็โดนปฏิเสธ
 * ฟังก์ชันนี้แตะทั้งชีตและ Drive ในทีเดียว สิทธิ์ที่ขอจึงครบตั้งแต่รอบแรก
 */
function authorize() {
  var lines = [];
  try {
    var ss = getSpreadsheet_();
    lines.push('✅ เปิดไฟล์ชีตได้: ' + ss.getName());
  } catch (err) {
    lines.push('❌ เปิดไฟล์ชีตไม่ได้: ' + (err.message || err));
  }

  try {
    var folder = getEvidenceFolder_();
    lines.push('✅ เข้าถึง Google Drive ได้');
    lines.push('   โฟลเดอร์เก็บรูป: ' + folder.getName());
    lines.push('   id: ' + folder.getId());
  } catch (err2) {
    lines.push('❌ เข้าถึง Google Drive ไม่ได้: ' + (err2.message || err2));
    lines.push('   ถ้าไม่มีหน้าขอสิทธิ์เด้งขึ้นมาเลย ให้ถอนสิทธิ์เดิมออกก่อน:');
    lines.push('   myaccount.google.com → ความเป็นส่วนตัว → แอปของบุคคลที่สาม');
    lines.push('   → หาชื่อโปรเจกต์นี้ → ลบการเข้าถึง แล้วกลับมารัน authorize อีกครั้ง');
  }

  lines.push('');
  lines.push('ถ้าผ่านทั้งสองข้อแล้ว อย่าลืม Deploy → Manage deployments → ดินสอ');
  lines.push('→ Version: New version เพื่อให้เว็บแอปใช้สิทธิ์ชุดใหม่');

  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

/**
 * รันตัวนี้ถ้ารัน authorize() แล้วไม่มีหน้าต่างขอสิทธิ์เด้งขึ้นมาเลย
 *
 * authorize() เรียกชีตก่อนแล้วค่อยเรียก Drive ทีหลัง ถ้าขั้นชีตผ่านไปเงียบ ๆ
 * (เพราะได้รับอนุญาตอยู่แล้ว) บางเครื่อง/บางรอบตัวแก้ไขของ Apps Script จะไม่กลับมา
 * เปิดหน้าต่างขอสิทธิ์ให้อีกตอนไปเจอ Drive กลางฟังก์ชัน กลายเป็นเจอ error ทันทีเงียบ ๆ
 * ฟังก์ชันนี้แตะ Drive เป็นคำสั่งแรกและอย่างเดียว ไม่มีอะไรมาบังก่อน
 * จึงมีโอกาสสูงกว่าที่หน้าต่างขอสิทธิ์จะเด้งขึ้นมาจริง
 */
function authorizeDrive() {
  var folder = DriveApp.createFolder('ทดสอบสิทธิ์ไดรฟ์ - ลบได้');
  var id = folder.getId();
  folder.setTrashed(true);   // ทดสอบเสร็จก็ทิ้ง ไม่เกะกะไดรฟ์ของบัญชีที่ deploy

  var msg = '✅ เข้าถึง Google Drive ได้แล้ว (ทดสอบสร้าง-ลบโฟลเดอร์สำเร็จ id: ' + id + ')\n' +
    'กลับไปรัน authorize อีกครั้งเพื่อตรวจทั้งสองข้อพร้อมกัน ' +
    'แล้ว Deploy → Manage deployments → ดินสอ → Version: New version';
  Logger.log(msg);
  return msg;
}

/** ดูลิงก์ฟอร์มสำหรับแจกสาขา */
function showFormUrl() {
  var url = ScriptApp.getService().getUrl() || 'ยังไม่ได้ deploy เป็นเว็บแอป';
  Logger.log(url);
  return url;
}
