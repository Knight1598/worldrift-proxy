/**
 * ระบบบันทึกการส่งอะไหล่ (เลขที่ใบ PR / เขต / สาขา / ขนส่ง) + รายงานย้อนหลัง
 * ก็อปไฟล์นี้ทั้งไฟล์ไปวางใน Apps Script (ไฟล์ชนิด Script ชื่อ Code)
 * แล้วก็อป App.html ไปวางอีกไฟล์ (ชนิด HTML ชื่อ App) — มีแค่ 2 ไฟล์เท่านั้น
 *
 * ดูขั้นตอนติดตั้งทั้งหมดใน README.md
 */

var SHEETS = {
  BRANCHES: 'Branches',
  CARRIERS: 'Carriers',
  DROP_POINTS: 'DropPoints',
  PARTS: 'Parts',
  SHIPMENTS: 'Shipments',
  ITEMS: 'Items'
};

var HEADERS = {
  Branches: ['branchCode', 'branchName', 'zone', 'defaultCarrier', 'defaultDropPoint', 'active'],
  Carriers: ['carrierCode', 'carrierName', 'phone', 'note', 'active'],
  DropPoints: ['dropPointName', 'zone', 'note'],
  Parts: ['partCode', 'partName', 'status', 'replacedBy', 'note', 'updatedAt'],
  Shipments: [
    'shipmentId', 'createdAt', 'shipDate', 'prNo', 'destBranch', 'zone', 'dropPoint',
    'isTransfer', 'carrier', 'trackingNo', 'boxCount', 'sender', 'receiverName', 'note',
    'itemsSummary', 'slipFileId', 'clientToken', 'slipHash', 'updatedAt', 'updatedBy'
  ],
  Items: ['shipmentId', 'lineNo', 'partCode', 'partName', 'qty', 'unit', 'note']
};

var TZ = 'Asia/Bangkok';

/* =======================================================================
 * ส่วนที่ 1 — ตัวช่วยพื้นฐาน (property, ชีต, วันที่)
 * ===================================================================== */

function props_() {
  return PropertiesService.getScriptProperties();
}

function prop_(key, fallback) {
  var v = props_().getProperty(key);
  return (v === null || v === '') ? (fallback === undefined ? '' : fallback) : v;
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

/** อ่านทั้งชีตออกมาเป็นอาร์เรย์ของ object โดยใช้แถวแรกเป็นชื่อคีย์ */
function readSheetObjects_(name) {
  var values = getSheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;
    var obj = { _row: i + 1 };
    for (var j = 0; j < head.length; j++) {
      if (head[j]) obj[head[j]] = row[j];
    }
    out.push(obj);
  }
  return out;
}

/** ถือว่า active เว้นแต่จะระบุชัดว่าไม่ใช้ เพื่อให้แถวที่เว้นช่องว่างไว้ยังใช้งานได้ */
function isActive_(v) {
  if (v === '' || v === null || v === undefined) return true;
  var s = String(v).trim().toUpperCase();
  return s !== 'FALSE' && s !== 'NO' && s !== '0' && s !== 'ไม่' && s !== 'ปิด';
}

/**
 * ทำรหัสสาขาให้เป็นเลข 4 หลักเสมอ (1 → 0001, 12 → 0012)
 * จำเป็นเพราะ Google Sheets มองค่าอย่าง "0132" เป็นตัวเลขแล้วตัด 0 นำหน้าทิ้งเหลือ 132
 * ทำให้เทียบกับรหัสที่อ่านได้จากใบโอนย้ายไม่ตรง
 */
function padBranchCode_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (!/^\d+$/.test(s)) return s;          // รหัสที่มีตัวอักษรปนอยู่ ปล่อยตามเดิม
  while (s.length < 4) s = '0' + s;
  return s;
}

/**
 * อ่านค่าจากช่องในชีตให้ออกมาเป็นข้อความเสมอ
 * Google Sheets ชอบแปลง "2026-08-01" เป็นชนิดวันที่ ถ้าเอา String() ครอบตรง ๆ
 * จะได้ "Sat Aug 01 2026 00:00:00 GMT+0700" ซึ่งเทียบกับช่วงวันที่ไม่ได้
 */
function cellText_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  return String(v).trim();
}

function colIndex_(sheetName, field) {
  var idx = HEADERS[sheetName].indexOf(field);
  if (idx < 0) throw new Error('ไม่รู้จักคอลัมน์ ' + field + ' ในชีต ' + sheetName);
  return idx + 1;
}

function todayIso_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

/* =======================================================================
 * ส่วนที่ 2 — เราต์ของเว็บแอป และ API ที่หน้าเว็บเรียกใช้
 * ===================================================================== */

function doGet(e) {
  // เปิดดูรูปหลักฐาน: ?img=<fileId>
  // เสิร์ฟผ่านเว็บแอปแทนการเปิดลิงก์ Drive ตรง ๆ จะได้ไม่ต้องแชร์ไฟล์ให้เป็นสาธารณะ
  var imgId = e && e.parameter ? String(e.parameter.img || '').trim() : '';
  if (imgId) return serveSlipImage_(imgId);

  return HtmlService.createHtmlOutputFromFile('App')
    .setTitle('บันทึกส่งอะไหล่')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/**
 * เว็บแอปส่งไฟล์ไบนารีตรง ๆ ไม่ได้ จึงฝังรูปเป็น data URI ในหน้า HTML แทน
 * เสิร์ฟเฉพาะ id ที่มีอยู่จริงในชีต Shipments เท่านั้น
 * เพราะเว็บแอปรันด้วยสิทธิ์เจ้าของ ถ้าไม่กันไว้ ใครมีลิงก์ก็เดา id
 * แล้วดึงไฟล์อื่นในไดรฟ์ของเจ้าของออกไปดูได้
 */
function serveSlipImage_(fileId) {
  try {
    if (!isKnownSlipFile_(fileId)) {
      return HtmlService.createHtmlOutput('<p>ไม่พบรูปนี้ในระบบ</p>');
    }
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

/** ไฟล์นี้ถูกอ้างถึงเป็นรูปหลักฐานของรอบส่งไหนสักรอบไหม */
function isKnownSlipFile_(fileId) {
  var id = String(fileId || '').trim();
  if (!id) return false;
  try {
    var sh = getSheet_(SHEETS.SHIPMENTS);
    var last = sh.getLastRow();
    if (last < 2) return false;
    var col = sh.getRange(2, colIndex_('Shipments', 'slipFileId'), last - 1, 1).getValues();
    for (var i = 0; i < col.length; i++) {
      if (String(col[i][0] == null ? '' : col[i][0]).trim() === id) return true;
    }
  } catch (err) {
    console.warn('ตรวจ id รูปไม่สำเร็จ: ' + err);
  }
  return false;
}

/** ข้อมูลตั้งต้นของฟอร์ม: รายชื่อเขต/สาขา/ขนส่ง/จุดฝากลง */
function apiBootstrap() {
  var masters = getMasters_();
  var appUrl = '';
  try {
    appUrl = ScriptApp.getService().getUrl() || '';
  } catch (err) {
    // ยังไม่ได้ deploy ก็ไม่เป็นไร แค่จะยังเปิดลิงก์รูปไม่ได้
  }
  return {
    ok: true,
    appUrl: appUrl,
    today: todayIso_(),
    zones: masters.zones,
    branches: masters.branches,
    carriers: masters.carriers,
    dropPoints: masters.dropPoints
  };
}

/** บันทึกรอบส่ง 1 รอบ */
function apiSaveShipment(payload) {
  try {
    return saveShipment_(payload || {});
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** ค้น/กรองรายงานย้อนหลัง พร้อมยอดสรุปรายวัน */
function apiSearch(payload) {
  try {
    var found = searchShipments_(payload || {});
    return {
      ok: true,
      results: found.results,
      days: found.days,
      totals: found.totals,
      truncated: found.truncated
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** ลบรอบส่งที่บันทึกไปแล้ว 1 รอบ (ลบรายการอะไหล่ของรอบนั้นตามไปด้วย) */
function apiDeleteShipment(payload) {
  try {
    return deleteShipment_(payload || {});
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** ค้นรายการสินค้าจากชีต Parts (พิมพ์รหัสหรือชื่อก็ได้) คืนไม่เกิน 20 รายการ */
function apiLookupParts(query) {
  try {
    return { ok: true, results: lookupParts_(query) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** หาสินค้าจากรหัสแบบตรงตัวเป๊ะ ๆ ใช้ตอนพิมพ์รหัสเต็มแล้วออกจากช่อง */
function apiLookupPartByCode(code) {
  try {
    return { ok: true, part: lookupPartByCode_(code) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** รายชื่อขนส่ง/ผู้มารับของ สำหรับหน้าจัดการ */
function apiListCarriers(query) {
  try {
    return { ok: true, results: lookupCarriers_(query, 100) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** เพิ่ม/แก้ไขขนส่ง 1 รายการ ลงชีต Carriers */
function apiSaveCarrier(payload) {
  try {
    var res = saveCarrier_(payload || {});
    return { ok: true, carrier: res.carrier, isNew: res.isNew };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** รายการอะไหล่สำหรับหน้าจัดการ (คืนได้สูงสุด 100 รายการ) */
function apiListParts(query) {
  try {
    return { ok: true, results: lookupParts_(query, 100) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** เพิ่ม/แก้ไขอะไหล่ 1 รายการ ลงชีต Parts */
function apiSavePart(payload) {
  try {
    var res = savePart_(payload || {});
    return { ok: true, part: res.part, warning: res.warning, isNew: res.isNew };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/* =======================================================================
 * ส่วนที่ 3 — ข้อมูลหลัก (เขต / สาขา / ขนส่ง / จุดฝากลง / อะไหล่)
 * ตารางสาขาผูกกับเขตโดยตรง จึงเลือกเขตก่อนแล้วกรองสาขาในเขตนั้นได้ทันที
 * ===================================================================== */

var MASTER_CACHE_KEY = 'masters_v1';
var MASTER_CACHE_SEC = 300;

function getMasters_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(MASTER_CACHE_KEY);
  if (hit) {
    try {
      return JSON.parse(hit);
    } catch (err) {
      // แคชเสีย ก็อ่านใหม่จากชีต
    }
  }

  var branches = readSheetObjects_(SHEETS.BRANCHES)
    .filter(function (r) { return String(r.branchName || '').trim() && isActive_(r.active); })
    .map(function (r) {
      return {
        code: padBranchCode_(r.branchCode),
        name: String(r.branchName).trim(),
        zone: String(r.zone || '').trim(),
        carrier: String(r.defaultCarrier || '').trim(),
        dropPoint: String(r.defaultDropPoint || '').trim()
      };
    });

  var zoneSet = {};
  branches.forEach(function (b) { if (b.zone) zoneSet[b.zone] = true; });
  var zones = Object.keys(zoneSet).sort(function (a, b) {
    var na = parseInt(a, 10), nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a < b ? -1 : (a > b ? 1 : 0);
  });

  var data = {
    zones: zones,
    branches: branches,
    carriers: readSheetObjects_(SHEETS.CARRIERS)
      .filter(function (r) { return String(r.carrierName || '').trim() && isActive_(r.active); })
      .map(function (r) {
        return { name: String(r.carrierName).trim(), note: String(r.note || '').trim() };
      }),
    dropPoints: readSheetObjects_(SHEETS.DROP_POINTS)
      .filter(function (r) { return String(r.dropPointName || '').trim(); })
      .map(function (r) {
        return { name: String(r.dropPointName).trim(), zone: String(r.zone || '').trim() };
      })
    // ไม่ส่งรายการสินค้าทั้งหมดมาที่หน้าเว็บ เพราะอาจมีหลักหมื่นรายการ
    // หน้าเว็บจะค้นผ่าน apiLookupParts() ทีละครั้งแทน
  };

  try {
    cache.put(MASTER_CACHE_KEY, JSON.stringify(data), MASTER_CACHE_SEC);
  } catch (err) {
    // ข้อมูลใหญ่เกินโควตาแคช (100KB) ก็ข้ามไป อ่านจากชีตทุกครั้งแทน
  }
  return data;
}

function clearMasterCache_() {
  try {
    CacheService.getScriptCache().remove(MASTER_CACHE_KEY);
  } catch (err) {
    // ไม่เป็นไร
  }
}

function findBranch_(name) {
  var key = String(name || '').trim();
  var list = getMasters_().branches;
  for (var i = 0; i < list.length; i++) {
    if (list[i].name === key) return list[i];
  }
  return null;
}

var STATUS_ACTIVE = 'ใช้งาน';
var STATUS_RETIRED = 'เลิกใช้';
var AUTO_ADD_NOTE = 'เพิ่มอัตโนมัติตอนบันทึกส่งของ';

/** อ่านรายการสินค้าทั้งหมดจากชีต Parts (แนบเลขแถวไว้ใช้ตอนแก้ไข) */
function readParts_() {
  var sh = getSheet_(SHEETS.PARTS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, HEADERS.Parts.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var code = String(row[0] == null ? '' : row[0]).trim();
    var name = String(row[1] == null ? '' : row[1]).trim();
    if (!code && !name) continue;
    out.push({
      code: code,
      name: name,
      status: String(row[2] == null ? '' : row[2]).trim() || STATUS_ACTIVE,
      replacedBy: String(row[3] == null ? '' : row[3]).trim(),
      note: String(row[4] == null ? '' : row[4]).trim(),
      updatedAt: String(row[5] == null ? '' : row[5]).trim(),
      _row: i + 2
    });
  }
  return out;
}

/** ตัด _row ออกก่อนส่งกลับหน้าเว็บ */
function toPartDto_(p) {
  if (!p) return null;
  return {
    code: p.code, name: p.name, status: p.status,
    replacedBy: p.replacedBy, note: p.note, updatedAt: p.updatedAt
  };
}

/**
 * ค้นสินค้าจากรหัสหรือชื่อ
 * เรียงผลลัพธ์ให้ "รหัสที่ขึ้นต้นด้วยคำค้น" มาก่อน เพราะปกติผู้ใช้พิมพ์รหัสเป็นหลัก
 * ถ้าไม่ใส่คำค้นจะคืนรายการแรก ๆ มาให้ (ใช้ในหน้าจัดการอะไหล่)
 */
function lookupParts_(query, limit) {
  var q = String(query || '').trim().toLowerCase();
  var max = Math.min(Number(limit) || 20, 200);
  var parts = readParts_();

  if (!q) return parts.slice(0, max).map(toPartDto_);

  var starts = [];
  var contains = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    var code = p.code.toLowerCase();
    if (code.indexOf(q) === 0) {
      if (starts.length < max) starts.push(p);
    } else if (contains.length < max &&
               (code.indexOf(q) > 0 || p.name.toLowerCase().indexOf(q) >= 0)) {
      contains.push(p);
    }
    if (starts.length >= max) break;
  }
  return starts.concat(contains).slice(0, max).map(toPartDto_);
}

/** หาสินค้าจากรหัสแบบตรงตัว (ไม่สนตัวพิมพ์เล็กใหญ่) */
function lookupPartByCode_(code) {
  var key = String(code || '').trim().toLowerCase();
  if (!key) return null;
  var parts = readParts_();
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].code.toLowerCase() === key) return toPartDto_(parts[i]);
  }
  return null;
}

/**
 * เพิ่มหรือแก้ไขอะไหล่ 1 รายการ
 * ส่ง originalCode มาด้วย = แก้ไขของเดิม, ไม่ส่ง = เพิ่มใหม่
 */
function savePart_(p) {
  var code = String(p.partCode || '').trim();
  var name = String(p.partName || '').trim();
  if (!code) throw new Error('ยังไม่ได้กรอกรหัสสินค้า');
  if (!name) throw new Error('ยังไม่ได้กรอกชื่อสินค้า');

  var status = String(p.status || '').trim() === STATUS_RETIRED ? STATUS_RETIRED : STATUS_ACTIVE;
  var replacedBy = String(p.replacedBy || '').trim();
  if (replacedBy && replacedBy.toLowerCase() === code.toLowerCase()) {
    throw new Error('รหัสที่ใช้แทนต้องไม่ใช่รหัสเดียวกับตัวมันเอง');
  }
  var note = String(p.note || '').trim();
  var originalCode = String(p.originalCode || '').trim();

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณาลองใหม่');

  var warning = '';
  try {
    var sh = getSheet_(SHEETS.PARTS);
    var parts = readParts_();
    var byCode = {};
    parts.forEach(function (item) { byCode[item.code.toLowerCase()] = item; });

    var target = originalCode ? byCode[originalCode.toLowerCase()] : null;
    if (originalCode && !target) throw new Error('ไม่พบรหัสเดิม ' + originalCode + ' ในตาราง');

    var clash = byCode[code.toLowerCase()];
    if (clash && (!target || clash._row !== target._row)) {
      throw new Error('มีรหัส ' + code + ' อยู่ในตารางแล้ว');
    }

    // เตือนถ้ารหัสที่ใช้แทนยังไม่มีในตาราง แต่ไม่บล็อก เผื่อกำลังจะเพิ่มทีหลัง
    if (replacedBy && !byCode[replacedBy.toLowerCase()]) {
      warning = 'บันทึกแล้ว แต่ยังไม่มีรหัส ' + replacedBy + ' ในตาราง อย่าลืมเพิ่มด้วย';
    }

    var row = [code, name, status, replacedBy, note, nowStamp_()];
    if (target) {
      sh.getRange(target._row, 1, 1, HEADERS.Parts.length).setValues([row]);
    } else {
      sh.getRange(sh.getLastRow() + 1, 1, 1, HEADERS.Parts.length).setValues([row]);
    }
  } finally {
    lock.releaseLock();
  }

  clearMasterCache_();
  return {
    part: { code: code, name: name, status: status, replacedBy: replacedBy, note: note },
    warning: warning,
    isNew: !originalCode
  };
}

/**
 * เก็บอะไหล่ที่ยังไม่มีในตารางแม่เข้าไปตอนบันทึกส่งของ
 * ใส่หมายเหตุกำกับไว้ว่ามาจากการเพิ่มอัตโนมัติ จะได้ตามไปตรวจ/แก้ชื่อทีหลังได้
 */
function autoAddParts_(items) {
  if (!items || !items.length) return [];
  var sh = getSheet_(SHEETS.PARTS);
  var existing = {};
  readParts_().forEach(function (p) { existing[p.code.toLowerCase()] = true; });

  var stamp = nowStamp_();
  var rows = [];
  var added = [];
  var seen = {};

  items.forEach(function (it) {
    var code = String(it.partCode || '').trim();
    if (!code) return;
    var key = code.toLowerCase();
    if (existing[key] || seen[key]) return;
    seen[key] = true;
    rows.push([code, String(it.partName || '').trim(), STATUS_ACTIVE, '', AUTO_ADD_NOTE, stamp]);
    added.push(code);
  });

  if (rows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.Parts.length).setValues(rows);
    clearMasterCache_();
  }
  return added;
}

/* ---------- ขนส่ง / ผู้มารับของ ---------- */

/** อ่านรายชื่อขนส่งทั้งหมด (แนบเลขแถวไว้ใช้ตอนแก้ไข) */
function readCarriers_() {
  var sh = getSheet_(SHEETS.CARRIERS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, HEADERS.Carriers.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var code = String(row[0] == null ? '' : row[0]).trim();
    var name = String(row[1] == null ? '' : row[1]).trim();
    if (!code && !name) continue;
    out.push({
      code: code,
      name: name,
      phone: String(row[2] == null ? '' : row[2]).trim(),
      note: String(row[3] == null ? '' : row[3]).trim(),
      active: isActive_(row[4]),
      _row: i + 2
    });
  }
  return out;
}

function toCarrierDto_(c) {
  if (!c) return null;
  return { code: c.code, name: c.name, phone: c.phone, note: c.note, active: c.active };
}

/** ค้นขนส่งจากชื่อ/รหัส/เบอร์โทร ไม่ใส่คำค้นก็คืนรายการทั้งหมด */
function lookupCarriers_(query, limit) {
  var q = String(query || '').trim().toLowerCase();
  var max = Math.min(Number(limit) || 100, 200);
  var list = readCarriers_();
  if (q) {
    list = list.filter(function (c) {
      return (c.name + ' ' + c.code + ' ' + c.phone + ' ' + c.note).toLowerCase().indexOf(q) >= 0;
    });
  }
  return list.slice(0, max).map(toCarrierDto_);
}

/**
 * เพิ่มหรือแก้ไขขนส่ง 1 รายการ
 * ส่ง originalName มาด้วย = แก้ไขของเดิม, ไม่ส่ง = เพิ่มใหม่
 * ยึดชื่อเป็นคีย์ เพราะชีต Shipments เก็บ "ชื่อขนส่ง" ไว้ในแถวการส่ง
 */
function saveCarrier_(p) {
  var name = String(p.carrierName || '').trim();
  if (!name) throw new Error('ยังไม่ได้กรอกชื่อขนส่ง/ผู้มารับ');

  var code = String(p.carrierCode || '').trim();
  var phone = String(p.phone || '').trim();
  var note = String(p.note || '').trim();
  var active = p.active === false ? 'FALSE' : 'TRUE';
  var originalName = String(p.originalName || '').trim();

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณาลองใหม่');

  try {
    var sh = getSheet_(SHEETS.CARRIERS);
    var list = readCarriers_();
    var byName = {};
    list.forEach(function (c) { byName[c.name.toLowerCase()] = c; });

    var target = originalName ? byName[originalName.toLowerCase()] : null;
    if (originalName && !target) throw new Error('ไม่พบชื่อเดิม ' + originalName + ' ในตาราง');

    var clash = byName[name.toLowerCase()];
    if (clash && (!target || clash._row !== target._row)) {
      throw new Error('มีชื่อ ' + name + ' อยู่ในตารางแล้ว');
    }

    var row = [code, name, phone, note, active];
    if (target) {
      sh.getRange(target._row, 1, 1, HEADERS.Carriers.length).setValues([row]);
    } else {
      sh.getRange(sh.getLastRow() + 1, 1, 1, HEADERS.Carriers.length).setValues([row]);
    }
  } finally {
    lock.releaseLock();
  }

  clearMasterCache_();
  return {
    carrier: { code: code, name: name, phone: phone, note: note, active: active === 'TRUE' },
    isNew: !originalName
  };
}

/* =======================================================================
 * ส่วนที่ 4 — บันทึกรอบส่งและค้นรายงานย้อนหลัง
 * ===================================================================== */

/** บันทึก 1 รอบส่ง */
function saveShipment_(payload) {
  var clean = validateShipment_(payload);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณากดบันทึกอีกครั้ง');
  }

  var shipmentId, isDuplicate = false, blocked = null;
  try {
    var sh = getSheet_(SHEETS.SHIPMENTS);

    var dup = findByClientToken_(sh, clean.clientToken);
    if (dup) {
      isDuplicate = true;
      shipmentId = dup.shipmentId;
    } else {
      // ตรวจใบซ้ำใต้ lock เดียวกับที่เขียน ไม่งั้นสองเครื่องกดพร้อมกันจะรอดไปทั้งคู่
      blocked = findConflict_(sh, clean);
      if (!blocked) {
        shipmentId = nextShipmentId_(sh);
        sh.appendRow(buildShipmentRow_(shipmentId, clean));
        writeItems_(shipmentId, clean.items);
      }
    }
  } finally {
    lock.releaseLock();
  }

  if (blocked) return blocked;

  if (isDuplicate) {
    // กดซ้ำ/เน็ตหลุดแล้วส่งซ้ำ — คืนผลเดิม ไม่เขียนแถวใหม่
    return { ok: true, shipmentId: shipmentId, duplicate: true };
  }

  // เก็บรูปหลักฐานหลังยืนยันการขนส่งแล้วเท่านั้น (ทำนอก lock เพราะอัปโหลดใช้เวลา)
  var slipFileId = clean.slipFileId;
  if (!slipFileId && clean.slipBase64) {
    try {
      slipFileId = saveSlipImage_(clean.slipBase64, clean.slipMimeType, clean.shipDate,
        branchCodeByName_(clean.destBranch), clean.prNo);
      setShipmentField_(shipmentId, 'slipFileId', slipFileId);
    } catch (err) {
      // เก็บรูปไม่สำเร็จ ไม่ควรทำให้ข้อมูลการส่งที่บันทึกไปแล้วหาย
      console.warn('saveSlipImage_ ล้มเหลว: ' + err);
      slipFileId = '';
    }
  }

  // อะไหล่ที่ยังไม่มีในตารางแม่ ให้เก็บเข้าชีต Parts ไปเลย
  var addedParts = [];
  try {
    addedParts = autoAddParts_(clean.items);
  } catch (err) {
    // เพิ่มเข้าตารางแม่ไม่สำเร็จ ไม่ควรทำให้การบันทึกส่งของล้มเหลว
    console.warn('autoAddParts_ ล้มเหลว: ' + err);
  }

  return {
    ok: true,
    shipmentId: shipmentId,
    duplicate: false,
    addedParts: addedParts,
    slipFileId: slipFileId,
    summary: {
      prNo: clean.prNo,
      destBranch: clean.destBranch,
      zone: clean.zone,
      dropPoint: clean.dropPoint,
      isTransfer: clean.isTransfer,
      carrier: clean.carrier,
      itemCount: clean.items.length
    }
  };
}

/**
 * หาว่ารอบนี้ชนกับรอบที่บันทึกไปแล้วไหม (เรียกใต้ lock เท่านั้น)
 * คืน null ถ้าไม่ชน หรือคืนผลลัพธ์สำเร็จรูปที่บอกว่าชนกับรอบไหน
 * ถ้าผู้ใช้ยืนยันว่าจะบันทึกซ้ำจริง ๆ (allowDuplicate) ก็ไม่ต้องตรวจ
 */
function findConflict_(sh, clean, excludeId) {
  if (clean.allowDuplicate) return null;

  if (clean.slipHash) {
    var sameSlip = findBySlipHash_(sh, clean.slipHash, excludeId);
    if (sameSlip) {
      return {
        ok: false,
        duplicate: 'slip',
        existing: sameSlip,
        error: 'รูปใบนี้เคยแนบบันทึกไปแล้วเป็นรอบ ' + sameSlip.shipmentId +
          ' (ใบ ' + sameSlip.prNo + ' → ' + sameSlip.destBranch + ' วันที่ ' + sameSlip.shipDate + ')'
      };
    }
  }

  var samePr = findByPrNo_(sh, clean.prNo, excludeId);
  if (samePr) {
    return {
      ok: false,
      duplicate: 'pr',
      existing: samePr,
      error: 'เลขที่ใบ ' + clean.prNo + ' เคยบันทึกไปแล้วเป็นรอบ ' + samePr.shipmentId +
        ' (→ ' + samePr.destBranch + ' วันที่ ' + samePr.shipDate + ')'
    };
  }
  return null;
}

/** แก้ไขรอบส่งที่บันทึกไปแล้ว */
function apiUpdateShipment(payload) {
  try {
    return updateShipment_(payload || {});
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/**
 * เขียนทับรอบส่งเดิมทั้งแถว พร้อมแทนที่รายการอะไหล่ของรอบนั้น
 * ค่าที่หน้าเว็บไม่ได้ส่งมา (createdAt / clientToken / รูปเดิม) ต้องรักษาไว้
 */
function updateShipment_(payload) {
  var id = String(payload.shipmentId || '').trim();
  if (!id) throw new Error('ไม่ได้ระบุรายการที่จะแก้ไข');

  var clean = validateShipment_(payload);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณากดบันทึกอีกครั้ง');
  }

  var conflict = null, before = null;
  try {
    var sh = getSheet_(SHEETS.SHIPMENTS);
    before = findShipmentRow_(sh, id);
    if (!before) throw new Error('ไม่พบรายการ ' + id + ' — อาจถูกลบไปแล้ว');

    // ตรวจซ้ำโดยไม่นับตัวเอง ไม่งั้นแก้อะไรก็ไม่ได้เลยเพราะเจอแถวของตัวเองทุกที
    conflict = findConflict_(sh, clean, id);
    if (!conflict) {
      var keepSlip = !clean.slipBase64;
      clean.slipFileId = keepSlip ? String(before.values.slipFileId || '') : '';
      clean.slipHash = keepSlip ? String(before.values.slipHash || '') : clean.slipHash;
      clean.clientToken = String(before.values.clientToken || '');
      clean.updatedAt = nowStamp_();
      clean.updatedBy = clean.sender;

      var row = buildShipmentRow_(id, clean);
      row[HEADERS.Shipments.indexOf('createdAt')] = before.values.createdAt;
      sh.getRange(before.row, 1, 1, HEADERS.Shipments.length).setValues([row]);
      replaceItems_(id, clean.items);
    }
  } finally {
    lock.releaseLock();
  }

  if (conflict) return conflict;

  // แนบรูปใหม่มาแทนของเดิม — ทำนอก lock เพราะอัปโหลดใช้เวลา
  var slipFileId = clean.slipFileId;
  if (!slipFileId && clean.slipBase64) {
    try {
      slipFileId = saveSlipImage_(clean.slipBase64, clean.slipMimeType, clean.shipDate,
        branchCodeByName_(clean.destBranch), clean.prNo);
      setShipmentField_(id, 'slipFileId', slipFileId);
    } catch (err) {
      console.warn('saveSlipImage_ ล้มเหลว: ' + err);
      slipFileId = '';
    }
  }

  var addedParts = [];
  try {
    addedParts = autoAddParts_(clean.items);
  } catch (err) {
    console.warn('autoAddParts_ ล้มเหลว: ' + err);
  }

  return {
    ok: true,
    shipmentId: id,
    updated: true,
    addedParts: addedParts,
    slipFileId: slipFileId,
    summary: {
      prNo: clean.prNo,
      destBranch: clean.destBranch,
      zone: clean.zone,
      dropPoint: clean.dropPoint,
      isTransfer: clean.isTransfer,
      carrier: clean.carrier,
      itemCount: clean.items.length
    }
  };
}

/** ลบรายการอะไหล่เดิมของรอบนั้นทิ้ง แล้วเขียนชุดใหม่ลงไป */
function replaceItems_(shipmentId, items) {
  deleteItemsOf_(shipmentId);
  if (items.length) writeItems_(shipmentId, items);
}

/** ลบทุกแถวในชีต Items ที่เป็นของรอบส่งนี้ คืนจำนวนแถวที่ลบไป */
function deleteItemsOf_(shipmentId) {
  var sh = getSheet_(SHEETS.ITEMS);
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, colIndex_('Items', 'shipmentId'), last - 1, 1).getValues();
  var removed = 0;
  // ลบจากล่างขึ้นบน ไม่งั้นเลขแถวที่เหลือจะเลื่อนจนลบผิดแถว
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0] == null ? '' : ids[i][0]).trim() === shipmentId) {
      sh.deleteRow(i + 2);
      removed++;
    }
  }
  return removed;
}

/**
 * ลบรอบส่ง 1 รอบออกจากรายงาน
 * ลบทั้งแถวในชีต Shipments และรายการอะไหล่ของรอบนั้นในชีต Items
 * รูปหลักฐานจะถูกย้ายไปถังขยะของไดรฟ์ (กู้คืนเองได้ภายใน 30 วัน)
 * ไม่แตะชีต Parts เพราะอะไหล่ที่เคยเพิ่มเข้าตารางแม่อาจถูกใช้ในรอบอื่นแล้ว
 */
function deleteShipment_(payload) {
  var id = String(payload.shipmentId || '').trim();
  if (!id) throw new Error('ไม่ได้ระบุรายการที่จะลบ');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('ระบบกำลังบันทึกรายการอื่นอยู่ กรุณากดลบอีกครั้ง');
  }

  var before, itemsRemoved = 0;
  try {
    var sh = getSheet_(SHEETS.SHIPMENTS);
    before = findShipmentRow_(sh, id);
    if (!before) throw new Error('ไม่พบรายการ ' + id + ' — อาจถูกลบไปแล้ว');

    // ลบลูกก่อนแม่ ถ้าลบแถวรอบส่งสำเร็จแล้วลบรายการอะไหล่ไม่ได้ จะเหลือรายการลอย
    itemsRemoved = deleteItemsOf_(id);
    sh.deleteRow(before.row);
  } finally {
    lock.releaseLock();
  }

  var slipTrashed = false;
  var slipFileId = String(before.values.slipFileId || '');
  if (slipFileId) {
    try {
      DriveApp.getFileById(slipFileId).setTrashed(true);
      slipTrashed = true;
    } catch (err) {
      // ลบรูปไม่ได้ก็ไม่ควรทำให้การลบรายการล้มเหลว แถวถูกลบไปแล้ว
      console.warn('ทิ้งรูปหลักฐานไม่สำเร็จ: ' + err);
    }
  }

  return {
    ok: true,
    deleted: true,
    shipmentId: id,
    itemsRemoved: itemsRemoved,
    slipTrashed: slipTrashed,
    summary: {
      prNo: String(before.values.prNo || ''),
      destBranch: String(before.values.destBranch || ''),
      shipDate: cellText_(before.values.shipDate)
    }
  };
}

/** ตรวจและปรับข้อมูลจากฟอร์มให้อยู่ในรูปที่พร้อมเขียนลงชีต */
function validateShipment_(payload) {
  var p = payload || {};
  var prNo = String(p.prNo || '').trim();
  if (!prNo) throw new Error('ยังไม่ได้กรอกเลขที่ใบ PR');

  var destBranch = String(p.destBranch || '').trim();
  if (!destBranch) throw new Error('ยังไม่ได้เลือกสาขาปลายทาง');

  var carrier = String(p.carrier || '').trim();
  if (!carrier) throw new Error('ยังไม่ได้เลือกขนส่ง');

  var items = (p.items || [])
    .map(function (it) {
      return {
        partCode: String(it.partCode || '').trim(),
        partName: String(it.partName || '').trim(),
        qty: it.qty === '' || it.qty === null || it.qty === undefined ? 1 : Number(it.qty),
        unit: String(it.unit || '').trim(),
        note: String(it.note || '').trim()
      };
    })
    .filter(function (it) { return it.partCode || it.partName; });

  if (!items.length) throw new Error('ยังไม่ได้ใส่รายการอะไหล่');

  var branch = findBranch_(destBranch);
  var isTransfer = !!p.isTransfer;
  var dropPoint = String(p.dropPoint || '').trim();
  if (!isTransfer) {
    dropPoint = (branch && branch.dropPoint) ? branch.dropPoint : destBranch;
  } else if (!dropPoint) {
    throw new Error('เลือก "ฝากลงที่อื่น" แล้ว แต่ยังไม่ได้ระบุจุดฝากลง');
  }
  // ถ้าจุดฝากลงตรงกับสาขาปลายทางพอดี ก็ไม่นับว่าเป็นการฝากลง
  if (isTransfer && dropPoint === destBranch) isTransfer = false;

  var shipDate = String(p.shipDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(shipDate)) shipDate = todayIso_();

  return {
    shipDate: shipDate,
    prNo: prNo,
    destBranch: destBranch,
    zone: branch ? branch.zone : String(p.zone || '').trim(),
    dropPoint: dropPoint,
    isTransfer: isTransfer,
    carrier: carrier,
    trackingNo: String(p.trackingNo || '').trim(),
    boxCount: p.boxCount === '' || p.boxCount === null || p.boxCount === undefined ? '' : Number(p.boxCount),
    sender: String(p.sender || '').trim(),
    receiverName: String(p.receiverName || '').trim(),
    note: String(p.note || '').trim(),
    items: items,
    slipFileId: String(p.slipFileId || '').trim(),
    slipBase64: String(p.slipBase64 || ''),
    slipMimeType: String(p.slipMimeType || 'image/jpeg'),
    // คิดลายนิ้วมือจากรูปที่ฝั่งเซิร์ฟเวอร์ ไม่รับค่าที่หน้าเว็บส่งมา
    // เพราะถ้าเชื่อค่าจากหน้าเว็บ ระบบกันซ้ำจะถูกข้ามได้ง่าย ๆ
    slipHash: slipHash_(p.slipBase64),
    allowDuplicate: !!p.allowDuplicate,
    clientToken: String(p.clientToken || '').trim()
  };
}

function buildShipmentRow_(shipmentId, c) {
  var map = {
    shipmentId: shipmentId,
    createdAt: nowStamp_(),
    shipDate: c.shipDate,
    prNo: c.prNo,
    destBranch: c.destBranch,
    zone: c.zone,
    dropPoint: c.dropPoint,
    isTransfer: c.isTransfer,
    carrier: c.carrier,
    trackingNo: c.trackingNo,
    boxCount: c.boxCount,
    sender: c.sender,
    receiverName: c.receiverName,
    note: c.note,
    itemsSummary: itemsSummary_(c.items),
    slipFileId: c.slipFileId,
    clientToken: c.clientToken,
    slipHash: c.slipHash,
    updatedAt: c.updatedAt || '',
    updatedBy: c.updatedBy || ''
  };
  return HEADERS.Shipments.map(function (h) { return map[h]; });
}

function writeItems_(shipmentId, items) {
  var sh = getSheet_(SHEETS.ITEMS);
  var rows = items.map(function (it, i) {
    return [shipmentId, i + 1, it.partCode, it.partName, it.qty, it.unit, it.note];
  });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.Items.length).setValues(rows);
}

function itemsSummary_(items) {
  var text = items.map(function (it) {
    return (it.partCode ? it.partCode + ' ' : '') + it.partName + ' x' + it.qty;
  }).join(', ');
  return text.length > 500 ? text.substring(0, 497) + '...' : text;
}

/** เลขที่รอบส่งรูปแบบ WR-YYYYMMDD-NNN นับใหม่ทุกวัน (เรียกใต้ lock เท่านั้น) */
function nextShipmentId_(sh) {
  var prefix = 'WR-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd') + '-';
  var last = sh.getLastRow();
  var max = 0;
  if (last > 1) {
    var ids = sh.getRange(2, colIndex_('Shipments', 'shipmentId'), last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var v = String(ids[i][0]);
      if (v.indexOf(prefix) === 0) {
        var n = parseInt(v.substring(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
  }
  return prefix + ('00' + (max + 1)).slice(-3);
}

/** กันบันทึกซ้ำจากการกดสองที/เน็ตหลุด */
/* ---------- กันบันทึกใบซ้ำ ----------
 *
 * มีสองชั้น เพราะซ้ำได้สองแบบ
 *   1. แนบ "ไฟล์รูปเดิม" ซ้ำ  → เทียบลายนิ้วมือของรูป จับได้แน่นอน
 *   2. ถ่ายใบเดิมใหม่อีกรอบ   → ไฟล์คนละไฟล์ ลายนิ้วมือไม่ตรง แต่เลขที่ใบ PR ซ้ำ
 * ทั้งสองแบบไม่ได้ห้ามขาด — บอกว่าซ้ำกับรอบไหน แล้วให้คนตัดสินใจยืนยันเอง
 */

/** ลายนิ้วมือของรูป คิดจากตัวไฟล์เอง ไฟล์เดียวกันได้ค่าเดียวกันเสมอ */
function slipHash_(base64) {
  if (!base64) return '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(base64));
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
}

/** อ่านข้อมูลรอบส่งของแถวหนึ่งเท่าที่ต้องใช้บอกว่า "ซ้ำกับรอบไหน" */
function shipmentBrief_(sh, row) {
  var values = sh.getRange(row, 1, 1, HEADERS.Shipments.length).getValues()[0];
  function at(field) {
    var v = values[HEADERS.Shipments.indexOf(field)];
    return v == null ? '' : String(v).trim();
  }
  return {
    shipmentId: at('shipmentId'),
    prNo: at('prNo'),
    destBranch: at('destBranch'),
    shipDate: at('shipDate'),
    createdAt: at('createdAt'),
    carrier: at('carrier'),
    slipFileId: at('slipFileId')
  };
}

/**
 * ไล่หาแถวที่ค่าในคอลัมน์หนึ่งตรงกับที่ต้องการ เอาแถวล่าสุดก่อน
 * excludeId ไว้ตอนแก้ไขรายการเดิม จะได้ไม่ไปเจอตัวเองแล้วหาว่าซ้ำ
 */
function findShipmentBy_(sh, field, wanted, excludeId, upper) {
  if (!wanted) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;

  var values = sh.getRange(2, colIndex_('Shipments', field), last - 1, 1).getValues();
  var ids = sh.getRange(2, colIndex_('Shipments', 'shipmentId'), last - 1, 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (excludeId && String(ids[i][0] == null ? '' : ids[i][0]).trim() === excludeId) continue;
    var v = String(values[i][0] == null ? '' : values[i][0]).trim();
    if (upper) v = v.toUpperCase();
    if (v === wanted) return shipmentBrief_(sh, i + 2);
  }
  return null;
}

/** หารอบส่งที่เคยแนบไฟล์รูปเดียวกันนี้ไปแล้ว */
function findBySlipHash_(sh, hash, excludeId) {
  return findShipmentBy_(sh, 'slipHash', hash, excludeId, false);
}

/** หารอบส่งที่ใช้เลขที่ใบ PR เดียวกัน */
function findByPrNo_(sh, prNo, excludeId) {
  return findShipmentBy_(sh, 'prNo', String(prNo || '').trim().toUpperCase(), excludeId, true);
}

/** หาแถวของรอบส่งจากเลขที่รายการ คืนทั้งเลขแถวและค่าทุกคอลัมน์ */
function findShipmentRow_(sh, shipmentId) {
  var last = sh.getLastRow();
  if (last < 2) return null;
  var ids = sh.getRange(2, colIndex_('Shipments', 'shipmentId'), last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0] == null ? '' : ids[i][0]).trim() === shipmentId) {
      var row = i + 2;
      var raw = sh.getRange(row, 1, 1, HEADERS.Shipments.length).getValues()[0];
      var values = {};
      HEADERS.Shipments.forEach(function (h, c) {
        values[h] = raw[c] == null ? '' : raw[c];
      });
      return { row: row, values: values };
    }
  }
  return null;
}

/**
 * ตรวจว่าใบนี้เคยบันทึกไปแล้วหรือยัง — เรียกได้ตั้งแต่ตอนแนบรูป
 * ไม่ต้องรอถึงตอนกดบันทึก จะได้รู้ตัวก่อนคีย์ข้อมูลทั้งใบ
 */
function apiCheckSlipDuplicate(payload) {
  try {
    payload = payload || {};
    var sh = getSheet_(SHEETS.SHIPMENTS);
    var out = { ok: true, slipDuplicate: null, prDuplicate: null };

    if (payload.base64) out.slipDuplicate = findBySlipHash_(sh, slipHash_(payload.base64));
    if (payload.prNo) out.prDuplicate = findByPrNo_(sh, payload.prNo);
    return out;
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

function findByClientToken_(sh, token) {
  if (!token) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var start = Math.max(2, last - 499);
  var count = last - start + 1;
  var ids = sh.getRange(start, colIndex_('Shipments', 'shipmentId'), count, 1).getValues();
  var tokens = sh.getRange(start, colIndex_('Shipments', 'clientToken'), count, 1).getValues();
  for (var i = tokens.length - 1; i >= 0; i--) {
    if (String(tokens[i][0]) === token) return { shipmentId: String(ids[i][0]), row: start + i };
  }
  return null;
}

/** อัปเดตช่องใดช่องหนึ่งของรอบส่งที่บันทึกไปแล้ว (ใช้เก็บ id รูปหลังอัปโหลดเสร็จ) */
function setShipmentField_(shipmentId, field, value) {
  var sh = getSheet_(SHEETS.SHIPMENTS);
  var last = sh.getLastRow();
  if (last < 2) return;
  var ids = sh.getRange(2, colIndex_('Shipments', 'shipmentId'), last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === shipmentId) {
      sh.getRange(i + 2, colIndex_('Shipments', field)).setValue(value);
      return;
    }
  }
}

/**
 * ค้นได้ด้วย เลขที่ใบ PR, รหัส/ชื่ออะไหล่, เลขพัสดุ, ชื่อสาขา, จุดฝากลง, เลขที่รอบส่ง
 * พิมพ์หลายคำคั่นด้วยเว้นวรรคได้ ต้องเจอครบทุกคำถึงจะนับว่าตรง
 * เช่น "คง แบตเตอรี่" = ส่งไปสาขาคง และในรอบนั้นมีแบตเตอรี่
 *
 * คืนทั้งรายการที่ตรง (จำกัดจำนวนตาม limit) และยอดสรุปรายวัน
 * ยอดสรุปนับจากรายการที่ตรงทั้งหมด ไม่ได้นับแค่หน้าที่ส่งกลับไป
 * จะได้ไม่หลอกตาเวลาผลลัพธ์ยาวเกิน limit
 */
function searchShipments_(opts) {
  var terms = searchTerms_(opts.q);
  var zone = String(opts.zone || '').trim();
  var branch = String(opts.branch || '').trim();
  var from = String(opts.from || '').trim();
  var to = String(opts.to || '').trim();
  var limit = Math.min(Number(opts.limit) || 50, 500);
  var transferOnly = !!opts.transferOnly;

  var shipments = readSheetObjects_(SHEETS.SHIPMENTS).slice(-3000);
  var itemsById = groupItems_();

  var results = [];
  var byDate = {};
  var dates = [];
  var byCarrier = {};
  var carriers = [];
  var byPart = {};
  var partKeys = [];
  var totals = { shipments: 0, qty: 0, items: 0, days: 0 };

  for (var i = shipments.length - 1; i >= 0; i--) {
    var s = shipments[i];
    var id = cellText_(s.shipmentId);
    if (!id) continue;

    var shipDate = cellText_(s.shipDate);
    if (from && shipDate < from) continue;
    if (to && shipDate > to) continue;
    if (zone && cellText_(s.zone) !== zone) continue;
    if (branch && cellText_(s.destBranch) !== branch) continue;

    var isTransfer = String(s.isTransfer).toUpperCase() === 'TRUE';
    if (transferOnly && !isTransfer) continue;

    var items = itemsById[id] || [];
    if (terms.length && !matchesTerms_(terms, s, id, items)) continue;

    var qty = sumItemQty_(items);

    // ยอดรวมรายวันนับทุกแถวที่ตรงเงื่อนไข แม้จะเกิน limit จนไม่ได้ส่งรายละเอียดกลับไป
    var day = byDate[shipDate];
    if (!day) {
      day = byDate[shipDate] = { date: shipDate, shipments: 0, qty: 0, items: 0 };
      dates.push(shipDate);
    }
    day.shipments++;
    day.qty += qty;
    day.items += items.length;

    // สรุป "ไปกับใคร" และ "มีอะไรไปบ้าง" นับจากทุกแถวที่ตรงเงื่อนไข ใช้ตอนออกรายงาน PDF
    var carrierName = cellText_(s.carrier) || 'ไม่ระบุขนส่ง';
    var car = byCarrier[carrierName];
    if (!car) {
      car = byCarrier[carrierName] = { name: carrierName, shipments: 0, qty: 0 };
      carriers.push(car);
    }
    car.shipments++;
    car.qty += qty;

    items.forEach(function (it) {
      var key = (it.partCode || it.partName || '-').toLowerCase();
      var rec = byPart[key];
      if (!rec) {
        rec = byPart[key] = { partCode: it.partCode, partName: it.partName, qty: 0, rounds: 0 };
        partKeys.push(key);
      }
      var n = Number(String(it.qty == null ? '' : it.qty).replace(/,/g, ''));
      if (!isNaN(n) && isFinite(n)) rec.qty += n;
      rec.rounds++;
      if (!rec.partName && it.partName) rec.partName = it.partName;
    });

    totals.shipments++;
    totals.qty += qty;
    totals.items += items.length;

    if (results.length >= limit) continue;

    results.push({
      shipmentId: id,
      shipDate: shipDate,
      prNo: cellText_(s.prNo),
      destBranch: cellText_(s.destBranch),
      zone: cellText_(s.zone),
      dropPoint: cellText_(s.dropPoint),
      isTransfer: isTransfer,
      carrier: cellText_(s.carrier),
      trackingNo: cellText_(s.trackingNo),
      boxCount: s.boxCount === '' ? '' : String(s.boxCount),
      sender: cellText_(s.sender),
      receiverName: cellText_(s.receiverName),
      note: cellText_(s.note),
      slipFileId: cellText_(s.slipFileId),
      updatedAt: cellText_(s.updatedAt),
      updatedBy: cellText_(s.updatedBy),
      totalQty: qty,
      items: items
    });
  }

  totals.days = dates.length;
  dates.sort();
  dates.reverse();          // วันล่าสุดอยู่บนสุด ตรงกับลำดับการ์ดในรายงาน

  function byQtyDesc(a, b) { return b.qty - a.qty || b.shipments - a.shipments; }

  return {
    results: results,
    days: dates.map(function (d) { return byDate[d]; }),
    carriers: carriers.sort(byQtyDesc),
    parts: partKeys.map(function (k) { return byPart[k]; })
      .sort(function (a, b) { return b.qty - a.qty || b.rounds - a.rounds; }),
    totals: totals,
    truncated: totals.shipments > results.length
  };
}

/** แยกคำค้นด้วยเว้นวรรค ตัดคำซ้ำทิ้ง */
function searchTerms_(q) {
  var seen = {};
  return String(q || '').trim().toLowerCase().split(/\s+/)
    .filter(function (t) {
      if (!t || seen[t]) return false;
      seen[t] = true;
      return true;
    });
}

/** ต้องเจอครบทุกคำ (จะอยู่คนละช่องก็ได้) ถึงจะนับว่าตรง */
function matchesTerms_(terms, s, id, items) {
  var hay = [
    id, s.prNo, s.destBranch, s.zone, s.dropPoint, s.carrier,
    s.trackingNo, s.sender, s.receiverName, s.note, s.itemsSummary, cellText_(s.shipDate)
  ].map(cellText_).join(' ') + ' ' + items.map(function (it) {
    return it.partCode + ' ' + it.partName + ' ' + it.note;
  }).join(' ');

  hay = hay.toLowerCase();
  // เทียบแบบตัดช่องว่างออกด้วย เผื่อรหัสในชีตมีเว้นวรรคคั่นแต่คนค้นพิมพ์ติดกัน
  var tight = hay.replace(/\s+/g, '');

  return terms.every(function (t) {
    return hay.indexOf(t) >= 0 || tight.indexOf(t) >= 0;
  });
}

/** รวมจำนวนชิ้นของรอบส่งหนึ่ง (ช่องที่ว่างหรือกรอกเป็นตัวหนังสือ นับเป็น 0) */
function sumItemQty_(items) {
  var total = 0;
  (items || []).forEach(function (it) {
    var n = Number(String(it.qty == null ? '' : it.qty).replace(/,/g, ''));
    if (!isNaN(n) && isFinite(n)) total += n;
  });
  return total;
}

/* =======================================================================
 * ส่วนที่ 4.5 — ออกรายงานเป็น PDF ตามช่วงวันที่ที่เลือกไว้ในหน้ารายงาน
 *
 * สร้างเป็น Google Docs ก่อนแล้วแปลงเป็น PDF ไม่ได้แปลงจาก HTML ตรง ๆ
 * เพราะตัวแปลง HTML → PDF ของ Apps Script ไม่มีฟอนต์ไทย ตัวหนังสือจะออกมาเป็นกล่องเปล่า
 * ส่วน Docs ใช้ตัวเรนเดอร์เดียวกับ Google Docs จริง ภาษาไทยจึงออกมาครบ
 * ===================================================================== */

var PDF_FOLDER_NAME = 'รายงาน PDF ส่งอะไหล่';
var PDF_MAX_ROUNDS = 500;        // เกินนี้รายงานจะยาวและสร้างไม่ทันในเวลาที่ Apps Script ให้
var PDF_MAX_PART_ROWS = 200;     // ตารางสรุปอะไหล่ ยาวกว่านี้ตัดแล้วบอกว่าตัด

/** ออกรายงาน PDF ตามเงื่อนไขเดียวกับที่ค้นในหน้ารายงาน */
function apiExportPdf(payload) {
  try {
    return exportReportPdf_(payload || {});
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

function exportReportPdf_(p) {
  var found = searchShipments_({
    q: p.q, zone: p.zone, branch: p.branch,
    from: p.from, to: p.to, transferOnly: p.transferOnly,
    limit: PDF_MAX_ROUNDS
  });

  if (!found.totals.shipments) {
    throw new Error('ไม่มีรายการในเงื่อนไขที่เลือก จึงยังไม่มีอะไรให้ออกรายงาน');
  }

  var detail = String(p.detail || 'full') !== 'summary';
  var name = pdfName_(p, found);
  var doc = DocumentApp.create(name);

  try {
    buildReportDoc_(doc, p, found, detail);
    doc.saveAndClose();

    var pdf = DriveApp.getFileById(doc.getId()).getAs('application/pdf').setName(name + '.pdf');
    var saved = getPdfFolder_().createFile(pdf);

    return {
      ok: true,
      name: saved.getName(),
      fileId: saved.getId(),
      url: 'https://drive.google.com/file/d/' + saved.getId() + '/view',
      base64: Utilities.base64Encode(pdf.getBytes()),
      rounds: found.results.length,
      totals: found.totals,
      truncated: found.truncated
    };
  } finally {
    // ไฟล์ Docs เป็นแค่ทางผ่าน ทิ้งทุกครั้งแม้สร้าง PDF ไม่สำเร็จ ไม่ให้ค้างในไดรฟ์
    try { DriveApp.getFileById(doc.getId()).setTrashed(true); } catch (err) { /* ลบไม่ได้ก็ข้าม */ }
  }
}

function getPdfFolder_() {
  var id = prop_('PDF_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (err) {
      // โฟลเดอร์ถูกลบไป สร้างใหม่ให้
    }
  }
  var folder = DriveApp.createFolder(PDF_FOLDER_NAME);
  props_().setProperty('PDF_FOLDER_ID', folder.getId());
  return folder;
}

function pdfName_(p, found) {
  var from = String(p.from || '');
  var to = String(p.to || '');
  var days = found.days;
  if (!from && days.length) from = days[days.length - 1].date;
  if (!to && days.length) to = days[0].date;
  var span = (from === to) ? from : from + '_ถึง_' + to;
  return 'รายงานส่งอะไหล่_' + (span || todayIso_());
}

/** เขียนเนื้อรายงานลงในเอกสาร */
function buildReportDoc_(doc, p, found, detail) {
  var body = doc.getBody();

  // A4 นอน เพราะตารางรายละเอียดมี 6 คอลัมน์ ตั้งตรงจะแคบเกินไป
  body.setPageWidth(842).setPageHeight(595);
  body.setMarginTop(28).setMarginBottom(28).setMarginLeft(28).setMarginRight(28);

  var title = body.appendParagraph('รายงานการส่งอะไหล่');
  title.setHeading(DocumentApp.ParagraphHeading.TITLE);

  head_(body, pdfRangeText_(p, found));
  var cond = pdfConditionText_(p);
  if (cond) head_(body, 'เงื่อนไข: ' + cond);
  head_(body, 'พิมพ์เมื่อ ' + nowStamp_() + (p.sender ? ' โดย ' + p.sender : ''));

  var sum = body.appendParagraph('รวม ' + found.totals.shipments + ' รอบส่ง • ' +
    found.totals.qty + ' ชิ้น • ' + found.totals.days + ' วัน');
  sum.setHeading(DocumentApp.ParagraphHeading.HEADING2);

  if (found.truncated) {
    head_(body, '⚠️ รายละเอียดในรายงานนี้แสดง ' + found.results.length + ' รอบล่าสุดเท่านั้น ' +
      '(ยอดสรุปด้านบนนับครบทุกรอบ) — แบ่งช่วงวันที่ให้แคบลงเพื่อให้ได้รายละเอียดครบ');
  }

  /* ---- สรุปรายวัน ---- */
  section_(body, 'สรุปรายวัน');
  var dayRows = [['วันที่', 'รอบส่ง', 'จำนวนชิ้น']];
  found.days.forEach(function (d) {
    dayRows.push([thaiDateText_(d.date), String(d.shipments), String(d.qty)]);
  });
  dayRows.push(['รวมทั้งหมด', String(found.totals.shipments), String(found.totals.qty)]);
  styleTable_(body.appendTable(dayRows), [180, 90, 110], true);

  /* ---- ไปกับใครบ้าง ---- */
  section_(body, 'สรุปตามขนส่ง / ผู้มารับของ');
  var carRows = [['ขนส่ง / ผู้มารับของ', 'รอบส่ง', 'จำนวนชิ้น']];
  found.carriers.forEach(function (c) {
    carRows.push([c.name, String(c.shipments), String(c.qty)]);
  });
  styleTable_(body.appendTable(carRows), [320, 90, 110], true);

  /* ---- มีอะไรไปบ้าง ---- */
  section_(body, 'สรุปตามอะไหล่');
  var partRows = [['รหัสสินค้า', 'ชื่อสินค้า', 'จำนวนชิ้น', 'อยู่ในกี่รอบ']];
  found.parts.slice(0, PDF_MAX_PART_ROWS).forEach(function (it) {
    partRows.push([it.partCode || '-', it.partName || '-', String(it.qty), String(it.rounds)]);
  });
  styleTable_(body.appendTable(partRows), [140, 380, 100, 100], true);
  if (found.parts.length > PDF_MAX_PART_ROWS) {
    head_(body, 'แสดง ' + PDF_MAX_PART_ROWS + ' อันดับแรกจากทั้งหมด ' + found.parts.length + ' รายการ');
  }

  if (!detail) return;

  /* ---- รายละเอียดแยกตามวัน ---- */
  var byDate = {};
  found.results.forEach(function (s) {
    if (!byDate[s.shipDate]) byDate[s.shipDate] = [];
    byDate[s.shipDate].push(s);
  });

  found.days.forEach(function (d) {
    var rows = byDate[d.date];
    if (!rows || !rows.length) return;      // วันนั้นถูกตัดออกจากรายละเอียดไปแล้ว

    body.appendPageBreak();
    section_(body, 'วันที่ ' + thaiDateText_(d.date) + ' — ' + d.shipments + ' รอบ • ' + d.qty + ' ชิ้น');

    var table = [['เลขที่ใบ PR', 'สาขาปลายทาง', 'ขนส่ง / ผู้มารับของ', 'กล่อง / เลขพัสดุ',
                  'รายการอะไหล่', 'ชิ้น']];
    rows.forEach(function (s) {
      table.push([
        s.prNo || s.shipmentId,
        s.destBranch + (s.zone ? '\n(เขต' + s.zone + ')' : '') +
          (s.isTransfer ? '\nฝากลงที่ ' + s.dropPoint : ''),
        s.carrier + (s.receiverName ? '\nผู้รับ ' + s.receiverName : ''),
        [s.boxCount ? s.boxCount + ' กล่อง' : '', s.trackingNo].filter(String).join('\n') || '-',
        itemLines_(s.items),
        String(s.totalQty)
      ]);
    });
    styleTable_(body.appendTable(table), [110, 130, 130, 100, 250, 50], true);
  });
}

/** บรรทัดเล็กสีเทาใต้หัวเรื่อง */
function head_(body, text) {
  body.appendParagraph(text).setFontSize(9).setForegroundColor('#666666');
}

function section_(body, text) {
  body.appendParagraph(text).setHeading(DocumentApp.ParagraphHeading.HEADING3);
}

/** รายการอะไหล่ในหนึ่งช่อง: บรรทัดละรายการ */
function itemLines_(items) {
  var lines = (items || []).map(function (it) {
    return (it.partCode ? it.partCode + ' ' : '') + (it.partName || '') +
      ' x' + it.qty + (it.unit ? ' ' + it.unit : '');
  });
  return lines.length ? lines.join('\n') : '-';
}

/**
 * ใส่เส้นตาราง ขนาดตัวอักษร และทำหัวตารางให้เป็นตัวหนา
 * ตั้งค่าเป็นก้อนเดียวทั้งตาราง ไม่ไล่ทำทีละช่อง เพราะเอกสารยาว ๆ จะช้ามาก
 */
function styleTable_(table, widths, boldHeader) {
  table.setBorderWidth(0.5);
  table.editAsText().setFontSize(9);
  (widths || []).forEach(function (w, i) {
    try { table.setColumnWidth(i, w); } catch (err) { /* คอลัมน์ไม่ครบก็ข้าม */ }
  });
  if (boldHeader && table.getNumRows()) {
    var cols = table.getRow(0).getNumCells();
    for (var c = 0; c < cols; c++) {
      var cell = table.getCell(0, c);
      cell.setBackgroundColor('#eeeeee');
      cell.editAsText().setBold(true);
    }
  }
  return table;
}

function thaiDateText_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || 'ไม่ระบุวันจัดส่ง');
}

function pdfRangeText_(p, found) {
  var from = String(p.from || '');
  var to = String(p.to || '');
  if (from && to) {
    return from === to
      ? 'ประจำวันที่ ' + thaiDateText_(from)
      : 'ช่วงวันที่ ' + thaiDateText_(from) + ' ถึง ' + thaiDateText_(to);
  }
  if (from) return 'ตั้งแต่วันที่ ' + thaiDateText_(from);
  if (to) return 'ถึงวันที่ ' + thaiDateText_(to);
  var days = found.days;
  if (days.length) {
    return 'ทุกวันที่มีข้อมูล (' + thaiDateText_(days[days.length - 1].date) +
      ' ถึง ' + thaiDateText_(days[0].date) + ')';
  }
  return 'ทุกวันที่มีข้อมูล';
}

function pdfConditionText_(p) {
  var bits = [];
  if (p.q) bits.push('คำค้น "' + p.q + '"');
  if (p.zone) bits.push('เขต ' + p.zone);
  if (p.branch) bits.push('สาขา' + p.branch);
  if (p.transferOnly) bits.push('เฉพาะรายการที่ฝากลงที่อื่น');
  return bits.join(' • ');
}

function groupItems_() {
  var rows = readSheetObjects_(SHEETS.ITEMS);
  var map = {};
  rows.forEach(function (r) {
    var id = String(r.shipmentId || '');
    if (!id) return;
    if (!map[id]) map[id] = [];
    map[id].push({
      partCode: String(r.partCode || ''),
      partName: String(r.partName || ''),
      qty: r.qty === '' ? '' : String(r.qty),
      unit: String(r.unit || ''),
      note: String(r.note || '')
    });
  });
  return map;
}

/* =======================================================================
 * ส่วนที่ 5 — อ่านข้อมูลจากรูปใบโอนย้ายสินค้า (OCR) และเก็บรูปเป็นหลักฐาน
 * ===================================================================== */

var SLIP_FOLDER_NAME = 'หลักฐานการส่งอะไหล่';

/**
 * แยกข้อมูลจากข้อความที่ OCR อ่านได้จากใบโอนย้ายสินค้า
 * แยกเป็นฟังก์ชันล้วน ๆ (ไม่แตะ Drive/ชีต) เพื่อให้ทดสอบได้ง่าย
 */
function parseSlipText_(text) {
  var raw = String(text || '');
  var lines = raw.split('\n')
    .map(normalizeSlipLine_)
    .filter(function (l) { return l; });

  var out = { prNo: '', shipDate: '', originCode: '', destCode: '', destName: '', items: [] };

  // เลขที่ใบโอนย้าย เช่น 0907TR690004839
  var mPr = raw.match(/เลขที่ใบโอนย้าย\s*[:：]?\s*([A-Za-z0-9\-\/]+)/);
  if (mPr) out.prNo = mPr[1];
  if (!out.prNo) {
    var mPr2 = raw.match(/\b(\d{3,4}[A-Z]{2}\d{8,12})\b/);
    if (mPr2) out.prNo = mPr2[1];
  }

  // สาขาต้นทาง / ปลายทาง เช่น "สาขาปลายทาง : 0132:คง"
  var mOrigin = raw.match(/สาขาต้นทาง\s*[:：]?\s*(\d{3,4})\s*[:：]?\s*([^\n]*)/);
  if (mOrigin) out.originCode = mOrigin[1];

  var mDest = raw.match(/สาขาปลายทาง\s*[:：]?\s*(\d{3,4})\s*[:：]?\s*([^\n]*)/);
  if (mDest) {
    out.destCode = mDest[1];
    out.destName = String(mDest[2] || '').trim();
  }
  // สำรอง: อ่านจากคอลัมน์ "ย้ายไป" เช่น 0907/T09 ->0132/S02
  if (!out.destCode) {
    var mMove = raw.match(/->\s*(\d{3,4})\s*\//);
    if (mMove) out.destCode = mMove[1];
  }

  // วันที่ เช่น 01/08/2569 (พ.ศ.) → 2026-08-01
  var mDate = raw.match(/วันที่\s*[:：]?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mDate) {
    var year = parseInt(mDate[3], 10);
    if (year > 2400) year -= 543;          // แปลง พ.ศ. เป็น ค.ศ.
    out.shipDate = year + '-' + pad2_(mDate[2]) + '-' + pad2_(mDate[1]);
  }

  out.items = parseSlipItems_(lines);
  // เก็บบรรทัดไว้ให้ resolveSlip_ กวาดหารหัสอะไหล่ซ้ำอีกรอบ (ไม่ได้ส่งกลับไปหน้าเว็บ)
  out.lines = lines;

  return out;
}

function pad2_(v) {
  var s = String(v);
  return s.length < 2 ? '0' + s : s;
}

/* ----- อ่านรายการอะไหล่จากใบโอนย้าย: เอาแค่ รหัสสินค้า / ชื่อสินค้า / จำนวน -----
 *
 * ในใบจริงหนึ่งแถวมีทั้งลำดับ ซีเรียล สี ราคาขาย และยอดรวม
 * ระบบสนใจแค่สามช่อง ที่เหลือตัดทิ้งให้หมดตั้งแต่ตอนอ่าน
 * จะได้ไม่มีราคาหรือซีเรียลหลุดไปปนอยู่ในชื่ออะไหล่ตอนบันทึก
 */

var THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

/** ตัวเลขไทย → อารบิก, ขีดแปลก ๆ และเส้นตาราง → เว้นวรรค, บีบช่องว่างซ้ำ */
function normalizeSlipLine_(line) {
  return String(line == null ? '' : line)
    .replace(/[๐-๙]/g, function (d) { return String(THAI_DIGITS.indexOf(d)); })
    .replace(/[|¦│]/g, ' ')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

// บรรทัดหัวตาราง/ท้ายใบ ไม่ใช่รายการสินค้า
var SLIP_SKIP_RE = /(รวมทั้งสิ้น|รวมเงิน|ยอดรวม|จำนวนเงิน|ภาษี|ลายเซ็น|ลงชื่อ|ผู้รับของ|ผู้ส่งของ|ผู้รับสินค้า|ผู้จัดส่งสินค้า|ผู้อนุมัติ|ผู้จัดของ|หน้าที่|เลขที่ใบ|เล่มที่|สาขาต้นทาง|สาขาปลายทาง|คลังต้นทาง|คลังปลายทาง|รหัสสินค้า|คำอธิบาย|IP=|Time=)/;

/**
 * รหัสสินค้า เช่น aa67001106, AA67001106, กก67001106
 * = ตัวอักษร 1-4 ตัว (เว้นวรรคคั่นได้ OCR ชอบแทรกช่องว่างเข้ามา) แล้วตามด้วยเลข 5-12 หลัก
 * ช่วงตัวเลขยอมให้มีตัวอักษรที่ OCR มักอ่านสลับกับเลขปนมาด้วย แล้วค่อยแปลงกลับทีหลัง
 */
var SLIP_CODE_RE = /^([A-Za-z฀-๿]{1,4})\s?([0-9OoQIlSsBZzG]{5,12})([A-Za-z0-9]{0,3})\s+(.+)$/;

// ตัวอักษรที่ OCR มักอ่านสลับกับตัวเลข ใช้ทั้งตอนแยกรหัสและตอนเทียบกับตารางแม่
var OCR_DIGIT_FIX = {
  O: '0', o: '0', Q: '0',
  I: '1', l: '1',
  S: '5', s: '5',
  B: '8', Z: '2', z: '2', G: '6'
};

function fixOcrDigits_(v) {
  return String(v == null ? '' : v).replace(/[OoQIlSsBZzG]/g, function (c) {
    return OCR_DIGIT_FIX[c] || c;
  });
}

/**
 * ทำรหัสสินค้าให้อยู่ในรูปที่เอาไปเทียบกันได้ แม้ OCR จะอ่านเพี้ยน
 * ตัดช่องว่าง/ขีดออก แล้วแปลงตัวอักษรที่มักอ่านสลับกับเลขให้เป็นเลขทั้งสองฝั่ง
 * เช่น "aa6700ll06" กับ "aa67001106" จะได้คีย์เดียวกัน
 */
function codeKey_(v) {
  return fixOcrDigits_(String(v == null ? '' : v).replace(/[\s\-_.]/g, '')).toLowerCase();
}

/** ชื่อสินค้าแบบตัดช่องว่าง ใช้กู้รหัสคืนตอน OCR อ่านรหัสไม่ได้เรื่องแต่ชื่ออ่านออก */
function nameKey_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, '').toLowerCase();
}

// ราคา/ยอดเงิน มีทศนิยมสองตำแหน่งเสมอ ใช้เป็นเส้นแบ่งว่าจบชื่อสินค้าตรงไหน
var SLIP_MONEY_RE = /\d{1,3}(?:,\d{3})*\.\d{2}\b/;

function parseSlipItems_(lines) {
  var out = [];
  var seen = {};

  for (var i = 0; i < lines.length; i++) {
    var item = extractSlipItem_(lines[i]);
    if (!item) continue;

    // OCR ตัดบรรทัดกลางรายการบ่อย ถ้าอ่านจำนวนไม่ได้ ลองดูบรรทัดถัดไปที่มีแต่ตัวเลข
    if (item.qty === '' && i + 1 < lines.length && /^[\d.,\s]+$/.test(lines[i + 1])) {
      var nums = lines[i + 1].match(/\d[\d,]*(?:\.\d+)?/g) || [];
      if (nums.length) {
        item.qty = toQty_(nums[0]);
        i++;
      }
    }

    // OCR อ่านบรรทัดเดิมซ้ำได้ ถ้าเหมือนกันทั้งรหัส ชื่อ และจำนวน ถือว่าเป็นแถวเดียวกัน
    var key = (item.partCode + '|' + item.partName + '|' + item.qty).toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;

    out.push({
      partCode: item.partCode,
      rawCode: item.rawCode,
      partName: item.partName,
      qty: item.qty,
      needsCheck: item.qty === '' || !item.partName
    });
  }
  return out;
}

/** ดึงสามช่องที่ต้องการออกจากบรรทัดเดียว คืน null ถ้าบรรทัดนี้ไม่ใช่รายการสินค้า */
function extractSlipItem_(line) {
  if (!line || SLIP_SKIP_RE.test(line)) return null;

  // ตัดเลขลำดับหน้าบรรทัดทิ้งก่อน เช่น "1 aa67001106 ..." หรือ "1. aa67001106 ..."
  var body = line.replace(/^\d{1,3}[.)]?\s+/, '');

  var m = body.match(SLIP_CODE_RE);
  if (!m) return null;

  var digits = fixOcrDigits_(m[2]);
  if (!/^\d{5,12}$/.test(digits)) return null;   // แปลงแล้วยังไม่ใช่ตัวเลขล้วน ไม่ใช่รหัสสินค้า

  var code = m[1] + digits + m[3];
  var rawCode = m[1] + m[2] + m[3];              // ตามที่ OCR อ่านมาจริง ๆ ก่อนแก้ตัวเลข
  var got = qtyFromTail_(m[4]);
  return {
    partCode: code,
    rawCode: rawCode,
    partName: cleanPartName_(got.name),
    qty: got.qty
  };
}

/**
 * แยก "จำนวน" กับ "ชื่อสินค้า" ออกจากข้อความที่อยู่หลังรหัสสินค้าในบรรทัดเดียวกัน
 * ใช้ร่วมกันทั้งตอนอ่านทั้งแถว และตอนกวาดหารหัสแล้วย้อนกลับมาหาจำนวนในบรรทัดนั้น
 */
function qtyFromTail_(rest) {
  rest = String(rest || '');

  // ทุกอย่างหลังราคาช่องแรกคือช่องเงิน ไม่เกี่ยวกับชื่อหรือจำนวน ตัดทิ้ง
  var money = rest.match(SLIP_MONEY_RE);
  var head = money ? rest.slice(0, money.index) : rest;

  // จำนวนคือตัวเลขตัวสุดท้ายก่อนช่องเงิน (ในใบเขียนได้ทั้ง "2" และ "2.00")
  // บางใบพิมพ์หน่วยต่อท้ายจำนวนด้วย เช่น "2 ชิ้น" หรือ "2 EA" ก็ยอมให้มีได้
  var mQty = head.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:ชิ้น|อัน|ตัว|ชุด|เส้น|ใบ|กล่อง|คู่|PCS|PC|EA|SET|UNIT)?\s*$/i);
  if (mQty) return { qty: toQty_(mQty[1]), name: head.slice(0, mQty.index) };

  // บางใบพิมพ์จำนวนเป็นทศนิยมด้วย เช่น "2.00 950.00 1,900.00"
  // มีเลขทศนิยมสามช่องติดกันเมื่อไหร่ ช่องแรกคือจำนวน ไม่ใช่ราคา
  if (money && (rest.match(new RegExp(SLIP_MONEY_RE.source, 'g')) || []).length >= 3) {
    return { qty: toQty_(money[0]), name: head };
  }

  return { qty: '', name: head };
}

/**
 * กวาดหา "รหัสอะไหล่" ทุกตัวในใบ ไม่สนว่าบรรทัดนั้นจะอยู่ในรูปตารางหรือไม่
 * ใช้คู่กับการเทียบตารางแม่ — ตัวที่ไม่มีในตารางแม่จะถูกทิ้ง
 * เลขที่ใบ ซีเรียล เบอร์โทร ฯลฯ จึงไม่หลุดเข้ามาเป็นรายการ
 */
function scanPartCodes_(lines) {
  var out = [];
  (lines || []).forEach(function (line, i) {
    if (!line || SLIP_SKIP_RE.test(line)) return;
    var re = /([A-Za-z฀-๿]{1,4})\s?([0-9OoQIlSsBZzG]{5,12})([A-Za-z0-9]{0,3})/g;
    var m;
    while ((m = re.exec(line))) {
      var digits = fixOcrDigits_(m[2]);
      if (!/^\d{5,12}$/.test(digits)) continue;
      out.push({
        code: m[1] + digits + m[3],
        rawCode: m[1] + m[2] + m[3],
        line: line,
        lineIndex: i,
        after: line.slice(m.index + m[0].length)
      });
    }
  });
  return out;
}

/** เอาซีเรียล เลขลอย และเครื่องหมายคั่นออกจากชื่อสินค้า ให้เหลือแต่ชื่อจริง */
function cleanPartName_(name) {
  return String(name || '')
    .replace(/\b[A-Za-z0-9]*\d[A-Za-z0-9]{9,}\b/g, ' ')   // ซีเรียลยาว ๆ ที่พิมพ์ปนมากับชื่อ
    .replace(/\s\d{5,}\s/g, ' ')                          // เลขล้วนยาว ๆ กลางชื่อ
    .replace(/[\-–—:;,\/]+\s*$/, '')
    .replace(/^\s*[\-–—:;,\/]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1,200.00" → 1200 ; จำนวนติดลบหรืออ่านไม่ออก คืนค่าว่างให้ผู้ใช้กรอกเอง */
function toQty_(v) {
  var n = Number(String(v == null ? '' : v).replace(/,/g, ''));
  if (isNaN(n) || !isFinite(n) || n < 0) return '';
  return n;
}

/** หาสาขาจากรหัสสาขา (เทียบแบบเติม 0 ให้ครบ 4 หลักทั้งสองฝั่ง) */
function findBranchByCode_(code) {
  var key = padBranchCode_(code);
  if (!key) return null;
  var list = getMasters_().branches;
  for (var i = 0; i < list.length; i++) {
    if (padBranchCode_(list[i].code) === key) return list[i];
  }
  return null;
}

/** หารหัสสาขาจากชื่อสาขา ใช้ตอนตั้งชื่อไฟล์รูปหลักฐาน */
function branchCodeByName_(name) {
  var b = findBranch_(name);
  return b ? padBranchCode_(b.code) : '';
}

/**
 * เทียบข้อมูลที่ OCR อ่านได้กับตารางแม่ เพื่อแก้จุดที่ OCR อ่านเพี้ยน
 * รหัสสาขา/รหัสสินค้าเป็นตัวเลขซึ่ง OCR อ่านแม่นกว่าตัวอักษรไทย จึงใช้เป็นตัวยึด
 */
function resolveSlip_(parsed) {
  var branch = findBranchByCode_(parsed.destCode);
  var result = {
    prNo: parsed.prNo,
    shipDate: parsed.shipDate,
    originCode: parsed.originCode,
    destCode: parsed.destCode,
    destBranch: branch ? branch.name : '',
    zone: branch ? branch.zone : '',
    destMatched: !!branch,
    destNameFromSlip: parsed.destName,
    items: []
  };

  var parts = readParts_();
  var byCode = {};        // รหัสตรงตัว
  var byFuzzy = {};       // รหัสแบบเผื่อ OCR อ่านตัวอักษรสลับกับตัวเลข
  var byName = {};        // ชื่อสินค้าแบบตัดช่องว่าง
  parts.forEach(function (p) {
    byCode[p.code.toLowerCase()] = p;
    var fk = codeKey_(p.code);
    if (fk && byFuzzy[fk] === undefined) byFuzzy[fk] = p;
    var nk = nameKey_(p.name);
    // ชื่อซ้ำกันหลายรหัสก็เดาไม่ได้ว่าอันไหน ทำเครื่องหมายไว้ว่าห้ามใช้กู้รหัส
    if (nk) byName[nk] = (byName[nk] === undefined) ? p : null;
  });

  /** หาสินค้าในตารางแม่จากรหัสที่ OCR อ่านมา (ไล่จากตรงตัวไปหาแบบเผื่ออ่านเพี้ยน) */
  function findPart(code, name) {
    var hit = byCode[String(code || '').toLowerCase()];
    // OCR มักอ่านช่องว่างเกินมา ลองตัดช่องว่างในรหัสแล้วหาอีกครั้ง
    if (!hit) hit = byCode[String(code || '').replace(/\s+/g, '').toLowerCase()];
    // ยังไม่เจอ ลองแบบเผื่ออ่าน 0 เป็น O / 1 เป็น l / 5 เป็น S
    if (!hit && code) hit = byFuzzy[codeKey_(code)];
    // รหัสอ่านไม่ได้เรื่องเลย แต่ชื่อตรงกับในตารางแม่พอดี ก็กู้รหัสจากชื่อได้
    if (!hit && name) hit = byName[nameKey_(name)] || null;
    return hit || null;
  }

  var taken = {};   // รหัสที่หยิบเข้ารายการไปแล้ว กันเพิ่มซ้ำตอนกวาดรอบสอง

  parsed.items.forEach(function (it) {
    var code = String(it.partCode || '').trim();
    var raw = String(it.rawCode || it.partCode || '').trim();
    var name = String(it.partName || '').trim();

    var hit = findPart(code, name);
    var partCode = hit ? hit.code : code;
    var partName = hit ? hit.name : name;
    taken[codeKey_(partCode)] = true;

    result.items.push({
      partCode: partCode,
      partName: partName,
      qty: it.qty,
      matched: !!hit,
      // ระบบแก้รหัสที่อ่านเพี้ยนให้ — ควรให้คนมองยืนยันอีกที
      // เทียบกับสิ่งที่ OCR อ่านมาดิบ ๆ เพราะบางตัวถูกแก้ไปแล้วตั้งแต่ตอนแยกบรรทัด
      corrected: !!hit && !!raw && partCode.toLowerCase() !== raw.toLowerCase(),
      // ช่องไหนอ่านมาไม่ครบ ให้หน้าเว็บทำเครื่องหมายไว้ว่าต้องตรวจก่อนบันทึก
      needsCheck: !!it.needsCheck || !partName || it.qty === '' || !partCode,
      status: hit ? hit.status : '',
      replacedBy: hit ? hit.replacedBy : '',
      fromCode: false
    });
  });

  /* รอบสอง — กวาดหารหัสอะไหล่ทั้งใบแล้วเทียบกับตารางแม่
   *
   * รอบแรกอ่านทั้งแถว ซึ่งพังง่ายเวลา OCR ทำคอลัมน์เพี้ยนหรือตัดบรรทัด
   * แต่ "รหัส" เป็นตัวอักษรกับตัวเลขล้วน OCR อ่านแม่นกว่าชื่อไทยมาก
   * รอบนี้จึงเอารหัสเป็นตัวตั้ง แล้วดึงชื่อจากตารางแม่มาใส่แทนการอ่านชื่อจากกระดาษ
   * รับเฉพาะรหัสที่มีอยู่จริงในตารางแม่ เลขที่ใบ/ซีเรียล/เบอร์โทรจึงไม่หลุดเข้ามา
   */
  scanPartCodes_(parsed.lines).forEach(function (hit) {
    var key = codeKey_(hit.code);
    if (taken[key]) return;

    var part = byCode[hit.code.toLowerCase()] || byFuzzy[key];
    if (!part) return;          // ไม่มีในตารางแม่ = ไม่ใช่รหัสอะไหล่

    taken[key] = true;
    var qty = qtyFromTail_(hit.after).qty;
    result.items.push({
      partCode: part.code,
      partName: part.name,
      qty: qty,
      matched: true,
      corrected: part.code.toLowerCase() !== hit.rawCode.toLowerCase(),
      needsCheck: qty === '',
      status: part.status,
      replacedBy: part.replacedBy,
      fromCode: true            // ได้มาจากการเทียบรหัสกับตารางแม่ ไม่ได้อ่านทั้งแถว
    });
  });

  return result;
}

/** โฟลเดอร์เก็บรูปหลักฐาน (สร้างอัตโนมัติครั้งแรก แล้วจำ id ไว้) */
function getSlipFolder_() {
  var id = prop_('SLIP_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (err) {
      // โฟลเดอร์ถูกลบไป สร้างใหม่ให้
    }
  }
  var folder = DriveApp.createFolder(SLIP_FOLDER_NAME);
  props_().setProperty('SLIP_FOLDER_ID', folder.getId());
  return folder;
}

/* =======================================================================
 * OCR — แปลงรูปเป็นข้อความ
 *
 * มีสองเครื่องยนต์ ระบบเลือกให้เองตามที่ตั้งค่าไว้
 *   1) Cloud Vision  ใช้เมื่อใส่ VISION_API_KEY ไว้ใน Script Properties
 *                    อ่านตารางภาษาไทยแม่นกว่ามาก และคืนตำแหน่งของทุกคำมาให้
 *                    จึงประกอบบรรทัดใหม่ตามพิกัดจริงได้ คอลัมน์ไม่สลับกัน
 *   2) Drive OCR     ของเดิม ใช้เมื่อยังไม่ได้ตั้งคีย์ หรือ Vision เรียกไม่ผ่าน
 * ===================================================================== */

/** เลือกเครื่องยนต์แล้วคืน { text, engine, note } */
function ocrImage_(blob) {
  var key = prop_('VISION_API_KEY');
  if (key) {
    try {
      return { text: visionOcr_(blob, key), engine: 'vision', note: '' };
    } catch (err) {
      // Vision ล่ม/คีย์หมดโควตา ก็ยังต้องอ่านให้ได้ ถอยไปใช้ของเดิม
      console.warn('Vision OCR ล้มเหลว ใช้ Drive OCR แทน: ' + err);
      return {
        text: driveOcr_(blob),
        engine: 'drive',
        note: 'เรียก Cloud Vision ไม่สำเร็จ (' + String(err.message || err).substring(0, 120) +
          ') ใช้ตัวอ่านสำรองแทน'
      };
    }
  }
  return { text: driveOcr_(blob), engine: 'drive', note: '' };
}

/**
 * อ่านด้วย Cloud Vision (DOCUMENT_TEXT_DETECTION)
 * แล้วประกอบข้อความใหม่จากพิกัดของแต่ละคำ แทนที่จะใช้ข้อความก้อนเดียวที่ API คืนมา
 * เพราะใบโอนย้ายเป็นตาราง ถ้าเรียงตามลำดับที่ API ให้มา คอลัมน์จะสลับกันจนแยกรายการไม่ออก
 */
function visionOcr_(blob, apiKey) {
  var payload = {
    requests: [{
      image: { content: Utilities.base64Encode(blob.getBytes()) },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      imageContext: { languageHints: ['th', 'en'] }
    }]
  };

  var res = UrlFetchApp.fetch(
    'https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(apiKey),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  if (res.getResponseCode() !== 200) {
    throw new Error('HTTP ' + res.getResponseCode() + ' ' + res.getContentText().substring(0, 200));
  }

  var body = JSON.parse(res.getContentText());
  var first = (body.responses || [])[0] || {};
  if (first.error) throw new Error(first.error.message || 'Vision ตอบกลับมาเป็นข้อผิดพลาด');

  var words = first.textAnnotations || [];
  if (words.length > 1) return visionLines_(words.slice(1)).join('\n');

  // ไม่มีพิกัดรายคำ (รูปแทบไม่มีตัวหนังสือ) ก็ใช้ข้อความก้อนเดียวเท่าที่ได้
  return String((first.fullTextAnnotation && first.fullTextAnnotation.text) || '');
}

/**
 * จัดคำที่ Vision อ่านได้ให้กลับเป็นบรรทัดตามที่ตาเห็น
 * คำที่อยู่ระดับความสูงใกล้กันถือเป็นบรรทัดเดียวกัน แล้วเรียงจากซ้ายไปขวา
 */
function visionLines_(words) {
  var boxes = words.map(function (w) {
    var v = (w.boundingPoly && w.boundingPoly.vertices) || [];
    if (!v.length) return null;
    var xs = v.map(function (p) { return p.x || 0; });
    var ys = v.map(function (p) { return p.y || 0; });
    var top = Math.min.apply(null, ys);
    var bottom = Math.max.apply(null, ys);
    return {
      text: String(w.description || ''),
      x: Math.min.apply(null, xs),
      y: (top + bottom) / 2,
      h: Math.max(bottom - top, 1)
    };
  }).filter(function (b) { return b && b.text; });

  if (!boxes.length) return [];

  // ระยะที่ถือว่ายังเป็นบรรทัดเดียวกัน คิดจากความสูงตัวอักษรกลาง ๆ ของทั้งใบ
  var heights = boxes.map(function (b) { return b.h; }).sort(function (a, b) { return a - b; });
  var tol = Math.max(heights[Math.floor(heights.length / 2)] * 0.6, 4);

  boxes.sort(function (a, b) { return a.y - b.y || a.x - b.x; });

  var lines = [];
  var current = null;
  boxes.forEach(function (b) {
    if (!current || Math.abs(b.y - current.y) > tol) {
      current = { y: b.y, items: [b] };
      lines.push(current);
    } else {
      current.items.push(b);
      // ค่ากลางของบรรทัดขยับตามคำที่เพิ่มเข้ามา กันบรรทัดเอียงทีละนิดจนหลุดกลุ่ม
      current.y = (current.y * (current.items.length - 1) + b.y) / current.items.length;
    }
  });

  return lines.map(function (line) {
    return line.items
      .sort(function (a, b) { return a.x - b.x; })
      .map(function (b) { return b.text; })
      .join(' ');
  });
}

/**
 * ตัวอ่านสำรอง: OCR ของ Google Drive
 * ทำโดยอัปโหลดรูปแล้วสั่งแปลงเป็น Google Docs พร้อม ocrLanguage=th
 * อ่านข้อความออกมาแล้วลบไฟล์ชั่วคราวทิ้ง
 */
function driveOcr_(blob) {
  var token = ScriptApp.getOAuthToken();
  var boundary = 'slipBoundary' + Date.now();
  var metadata = { name: 'ocr-temp-' + Date.now(), mimeType: 'application/vnd.google-apps.document' };

  var payload = Utilities.newBlob(
    '--' + boundary + '\r\n' +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    '--' + boundary + '\r\n' +
    'Content-Type: ' + blob.getContentType() + '\r\n\r\n'
  ).getBytes()
    .concat(blob.getBytes())
    .concat(Utilities.newBlob('\r\n--' + boundary + '--\r\n').getBytes());

  var upload = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=th&fields=id',
    {
      method: 'post',
      contentType: 'multipart/related; boundary=' + boundary,
      payload: Utilities.newBlob(payload).getBytes(),
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    }
  );

  if (upload.getResponseCode() !== 200) {
    throw new Error('อ่านรูปไม่สำเร็จ (อัปโหลดเพื่อ OCR ไม่ผ่าน HTTP ' +
      upload.getResponseCode() + ') ' + upload.getContentText().substring(0, 200));
  }

  var docId = JSON.parse(upload.getContentText()).id;
  try {
    var exported = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + docId + '/export?mimeType=text/plain',
      { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
    );
    if (exported.getResponseCode() !== 200) {
      throw new Error('อ่านข้อความจากรูปไม่สำเร็จ (HTTP ' + exported.getResponseCode() + ')');
    }
    return exported.getContentText();
  } finally {
    try { DriveApp.getFileById(docId).setTrashed(true); } catch (err) { /* ลบไม่ได้ก็ข้าม */ }
  }
}

/**
 * รับรูปจากหน้าเว็บ → OCR → แยกข้อมูล → เทียบกับตารางแม่
 * ยังไม่เก็บรูปลง Drive ตอนนี้ — จะเก็บตอนผู้ใช้กดบันทึกการขนส่งแล้วเท่านั้น
 */
function apiReadSlip(payload) {
  try {
    payload = payload || {};
    var base64 = String(payload.base64 || '');
    if (!base64) throw new Error('ไม่พบข้อมูลรูป');

    var mimeType = String(payload.mimeType || 'image/jpeg');
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, 'slip-temp');

    var ocr = ocrImage_(blob);
    var text = ocr.text;
    var resolved = resolveSlip_(parseSlipText_(text));
    resolved.ok = true;
    resolved.engine = ocr.engine;
    resolved.engineNote = ocr.note || '';
    // ส่งข้อความที่อ่านได้กลับไปด้วย เผื่อบางใบอ่านรายการไม่ออกจะได้ดูว่า OCR เห็นอะไร
    resolved.rawText = String(text || '').substring(0, 4000);

    // หน้าเว็บส่งรูปคนละไฟล์มาให้อ่าน (คมกว่า) กับที่จะเก็บเป็นหลักฐาน
    // การกันใบซ้ำต้องคิดจากรูปที่เก็บจริง ไม่งั้นลายนิ้วมือจะไม่ตรงกับตอนบันทึก
    var dupBase64 = String(payload.dupBase64 || base64);

    // บอกตั้งแต่ตอนอ่านเลยว่าใบนี้เคยบันทึกไปแล้วหรือยัง จะได้ไม่เสียเวลาคีย์ทั้งใบ
    try {
      var sh = getSheet_(SHEETS.SHIPMENTS);
      resolved.slipDuplicate = findBySlipHash_(sh, slipHash_(dupBase64));
      resolved.prDuplicate = resolved.prNo ? findByPrNo_(sh, resolved.prNo) : null;
    } catch (err) {
      // ตรวจซ้ำไม่ได้ก็ไม่ควรทำให้การอ่านรูปล้มไปด้วย ตอนกดบันทึกยังมีด่านตรวจอีกชั้น
      console.warn('ตรวจใบซ้ำไม่สำเร็จ: ' + err);
    }
    return resolved;
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/* =======================================================================
 * ส่วนที่ 5.5 — เลือกรูปใบโอนย้ายจาก Google Drive
 *
 * เว็บแอปรันด้วยสิทธิ์ของเจ้าของสคริปต์ ไม่ใช่สิทธิ์ของคนที่เปิดลิงก์
 * ถ้าเปิดให้เลือกไฟล์ได้ทั้งไดรฟ์ ใครมีลิงก์ก็เท่ากับเปิดดูไดรฟ์ของเจ้าของได้ทั้งใบ
 * จึงจำกัดให้เลือกได้เฉพาะในโฟลเดอร์ที่กำหนดไว้โฟลเดอร์เดียว (รวมโฟลเดอร์ย่อยข้างใน)
 * ตั้งโฟลเดอร์เองได้ที่ Script Property ชื่อ PICK_FOLDER_ID
 * ===================================================================== */

var PICK_FOLDER_NAME = 'รูปใบโอนย้ายรอบันทึก';
var PICK_MAX_BYTES = 15 * 1024 * 1024;
var PICK_PAGE_SIZE = 24;
var PICK_MAX_DEPTH = 8;       // กันไล่หาโฟลเดอร์แม่วนไม่รู้จบ

/** โฟลเดอร์ที่อนุญาตให้เลือก (สร้างให้ครั้งแรกถ้ายังไม่มี) */
function pickRootId_() {
  var id = prop_('PICK_FOLDER_ID');
  if (id) {
    try {
      DriveApp.getFolderById(id);
      return id;
    } catch (err) {
      // โฟลเดอร์ถูกลบหรือ id ผิด สร้าง/หาใหม่ให้
    }
  }
  var it = DriveApp.getFoldersByName(PICK_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(PICK_FOLDER_NAME);
  props_().setProperty('PICK_FOLDER_ID', folder.getId());
  return folder.getId();
}

/** เรียก Drive REST v3 ด้วยสิทธิ์ของสคริปต์ (ไม่ต้องใช้ API key) */
function driveApiGet_(path, params) {
  var parts = [];
  Object.keys(params || {}).forEach(function (k) {
    var v = params[k];
    if (v === '' || v === null || v === undefined) return;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
  });
  var url = 'https://www.googleapis.com/drive/v3/' + path + (parts.length ? '?' + parts.join('&') : '');
  var res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('เรียกข้อมูลจากไดรฟ์ไม่สำเร็จ (HTTP ' + res.getResponseCode() + ')');
  }
  return JSON.parse(res.getContentText());
}

/** เครื่องหมาย ' กับ \ ในคำค้นต้อง escape ไม่งั้น query ของ Drive พัง */
function driveEscape_(v) {
  return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** ไฟล์/โฟลเดอร์นี้อยู่ในโฟลเดอร์ที่อนุญาตหรือเปล่า (ไล่ดูโฟลเดอร์แม่ขึ้นไป) */
function isUnderPickRoot_(id, rootId) {
  var current = String(id || '').trim();
  if (!current) return false;
  for (var i = 0; i < PICK_MAX_DEPTH && current; i++) {
    if (current === rootId) return true;
    var meta = driveApiGet_('files/' + encodeURIComponent(current),
      { fields: 'id,parents', supportsAllDrives: true });
    var parents = meta.parents || [];
    if (!parents.length) return false;
    current = parents[0];
  }
  return current === rootId;
}

/** รายชื่อโฟลเดอร์ย่อยและรูปในโฟลเดอร์ที่เปิดอยู่ (ใหม่สุดก่อน) */
function apiListDriveImages(payload) {
  try {
    payload = payload || {};
    var root = pickRootId_();
    var folderId = String(payload.folderId || '').trim() || root;
    if (folderId !== root && !isUnderPickRoot_(folderId, root)) {
      throw new Error('โฟลเดอร์นี้อยู่นอกโฟลเดอร์ที่อนุญาตให้เลือก');
    }

    var q = String(payload.q || '').trim();
    var pageToken = String(payload.pageToken || '');

    // หน้าถัดไปเอาเฉพาะไฟล์ ไม่ต้องส่งรายชื่อโฟลเดอร์ซ้ำ
    var folders = pageToken ? { files: [] } : driveApiGet_('files', {
      q: "'" + driveEscape_(folderId) + "' in parents and " +
         "mimeType='application/vnd.google-apps.folder' and trashed=false",
      orderBy: 'name',
      pageSize: 50,
      fields: 'files(id,name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    var fq = "'" + driveEscape_(folderId) + "' in parents and mimeType contains 'image/' and trashed=false";
    if (q) fq += " and name contains '" + driveEscape_(q) + "'";

    var found = driveApiGet_('files', {
      q: fq,
      orderBy: 'modifiedTime desc',
      pageSize: PICK_PAGE_SIZE,
      pageToken: pageToken,
      fields: 'nextPageToken, files(id,name,size,modifiedTime,mimeType,thumbnailLink)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    var raw = found.files || [];
    var files = raw.map(function (f) {
      return {
        id: f.id,
        name: String(f.name || ''),
        size: Number(f.size || 0),
        modified: String(f.modifiedTime || '').substring(0, 10),
        mimeType: String(f.mimeType || ''),
        thumb: ''
      };
    });
    fetchThumbs_(raw, files);

    return {
      ok: true,
      root: root,
      folderId: folderId,
      folderName: driveName_(folderId),
      isRoot: folderId === root,
      folders: (folders.files || []).map(function (f) { return { id: f.id, name: String(f.name || '') }; }),
      files: files,
      nextPageToken: found.nextPageToken || ''
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

function driveName_(id) {
  try {
    return String(driveApiGet_('files/' + encodeURIComponent(id),
      { fields: 'name', supportsAllDrives: true }).name || '');
  } catch (err) {
    return '';
  }
}

/**
 * ดึงรูปย่อของทุกไฟล์ในหน้าเดียวกันทีเดียว
 * ใช้ fetchAll เพราะยิงทีละใบ 24 ใบจะรอนานมาก
 * ลิงก์รูปย่อของไดรฟ์ต้องแนบ token ไปด้วย หน้าเว็บจึงโหลดเองไม่ได้
 */
function fetchThumbs_(raw, files) {
  var token = ScriptApp.getOAuthToken();
  var reqs = [], slot = [];
  raw.forEach(function (f, i) {
    if (!f.thumbnailLink) return;
    reqs.push({
      url: String(f.thumbnailLink).replace(/=s\d+(-c)?$/, '=s320'),
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    slot.push(i);
  });
  if (!reqs.length) return;

  try {
    UrlFetchApp.fetchAll(reqs).forEach(function (res, k) {
      if (res.getResponseCode() !== 200) return;
      var blob = res.getBlob();
      files[slot[k]].thumb = 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' +
        Utilities.base64Encode(blob.getBytes());
    });
  } catch (err) {
    // ไม่มีรูปย่อก็ยังเลือกไฟล์จากชื่อได้ ไม่ต้องทำให้ทั้งหน้าล้ม
    console.warn('โหลดรูปย่อไม่สำเร็จ: ' + err);
  }
}

/**
 * ชนิดรูปที่เบราว์เซอร์ทั่วไปเปิดได้เอง
 * .HEIC ของไอโฟนไม่อยู่ในนี้ — Chrome/Android เปิดไม่ได้ ต้องแปลงเป็น JPG ให้ก่อนส่งไป
 */
var BROWSER_SAFE_IMAGE = /^image\/(jpeg|jpg|png|gif|webp|bmp)$/i;
var JPEG_COPY_SIZE = 2400;

/**
 * ขอสำเนา JPG ของไฟล์จากไดรฟ์
 * ไดรฟ์สร้างภาพตัวอย่างเป็น JPG ให้ทุกไฟล์รูปอยู่แล้ว รวมถึง .HEIC
 * จึงยืมทางนั้นมาใช้แปลงไฟล์ แทนที่จะต้องมีตัวแปลงรูปเอง
 */
function driveJpegCopy_(meta) {
  if (!meta || !meta.thumbnailLink) return '';
  try {
    var url = String(meta.thumbnailLink).replace(/=s\d+(-c)?$/, '=s' + JPEG_COPY_SIZE);
    var res = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return '';
    return Utilities.base64Encode(res.getBlob().getBytes());
  } catch (err) {
    console.warn('แปลงรูปเป็น JPG ไม่สำเร็จ: ' + err);
    return '';
  }
}

/** เปลี่ยนนามสกุลชื่อไฟล์เป็น .jpg ให้ตรงกับของที่ส่งไปจริง */
function asJpgName_(name) {
  var s = String(name || 'slip');
  return s.replace(/\.[A-Za-z0-9]+$/, '') + '.jpg';
}

/** ส่งไฟล์รูปจากไดรฟ์กลับไปให้หน้าเว็บ (ต้องอยู่ในโฟลเดอร์ที่อนุญาตเท่านั้น) */
function apiGetDriveImage(payload) {
  try {
    var p = payload || {};
    var id = String(p.fileId || '').trim();
    if (!id) throw new Error('ไม่ได้ระบุไฟล์');

    var root = pickRootId_();
    if (!isUnderPickRoot_(id, root)) throw new Error('ไฟล์นี้อยู่นอกโฟลเดอร์ที่อนุญาตให้เลือก');

    var meta = driveApiGet_('files/' + encodeURIComponent(id),
      { fields: 'id,name,size,mimeType,thumbnailLink', supportsAllDrives: true });
    var type = String(meta.mimeType || '');
    if (type.indexOf('image/') !== 0) throw new Error('ไฟล์นี้ไม่ใช่รูปภาพ');

    // แปลงให้เมื่อเป็นชนิดที่เบราว์เซอร์เปิดไม่ได้ หรือเมื่อหน้าเว็บลองเปิดแล้วไม่ผ่านจึงขอมาใหม่
    var safe = BROWSER_SAFE_IMAGE.test(type);
    if (!safe || p.asJpeg) {
      var jpeg = driveJpegCopy_(meta);
      if (jpeg) {
        return {
          ok: true,
          name: asJpgName_(meta.name),
          mimeType: 'image/jpeg',
          base64: jpeg,
          converted: true,
          fromType: type
        };
      }
      if (!safe) {
        throw new Error('ไฟล์ชนิด ' + type + ' แปลงเป็น JPG ไม่สำเร็จ — ' +
          'ลองเปิดไฟล์ในไดรฟ์สักครั้งให้ไดรฟ์สร้างภาพตัวอย่างก่อน แล้วเลือกใหม่');
      }
      // ขอเป็น JPG มาแต่แปลงไม่ได้ และไฟล์เดิมเบราว์เซอร์เปิดได้อยู่แล้ว ก็ส่งไฟล์เดิมไป
    }

    if (Number(meta.size || 0) > PICK_MAX_BYTES) {
      throw new Error('ไฟล์ใหญ่เกิน ' + Math.round(PICK_MAX_BYTES / 1048576) + ' MB — ย่อรูปก่อนแล้วลองใหม่');
    }

    var blob = DriveApp.getFileById(id).getBlob();
    return {
      ok: true,
      name: String(meta.name || 'slip.jpg'),
      mimeType: blob.getContentType() || type,
      base64: Utilities.base64Encode(blob.getBytes()),
      converted: false
    };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/**
 * เก็บรูปหลักฐานลง Drive ตอนบันทึกการขนส่ง
 * ตั้งชื่อเป็น วันที่_รหัสสาขา_เลขที่ใบPR เพื่อให้ค้นในไดรฟ์ได้ง่าย
 * เช่น 2026-08-01_0132_0907TR690004839.jpg
 */
function saveSlipImage_(base64, mimeType, shipDate, branchCode, prNo) {
  var type = String(mimeType || 'image/jpeg');
  var ext = type.indexOf('png') >= 0 ? '.png' : '.jpg';
  var name = [
    shipDate || todayIso_(),
    branchCode || 'ไม่ระบุสาขา',
    safeFileNamePart_(prNo) || 'ไม่ระบุเลขที่ใบ'
  ].join('_') + ext;
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), type, name);
  return getSlipFolder_().createFile(blob).getId();
}

/** ตัดอักขระที่ใช้ในชื่อไฟล์ไม่ได้ออก */
function safeFileNamePart_(v) {
  return String(v == null ? '' : v).trim().replace(/[\\\/:*?"<>|]+/g, '-');
}

/* =======================================================================
 * ส่วนที่ 6 — ติดตั้งและตรวจสอบระบบ (รันเองจากเมนู Apps Script)
 * ===================================================================== */

/**
 * ข้อมูลตั้งต้น
 * Branches คือรายชื่อเขต/สาขาจริงทั้งหมด (53 เขต 166 สาขา) ดึงมาจากตารางจัดเขตขายที่ให้มา
 * แก้ไข/เพิ่ม/ลบทีหลังได้ตามจริง — ค่า defaultCarrier/defaultDropPoint เว้นว่างไว้ให้กรอกเอง
 */
var SAMPLE_DATA = {
  Branches: [
    ['0001', 'สนญ.-ยามาฮ่า', '01:เยาว์', '', '', 'TRUE'],
    ['0043', 'บ้านนางใย', '01:เยาว์', '', '', 'TRUE'],
    ['0108', 'สนญ.-ฮอนด้า', '01:เยาว์', '', '', 'TRUE'],
    ['0144', 'สนญ.ซูซูกิ', '01:เยาว์', '', '', 'TRUE'],
    ['0048', 'หนองแปน', '02:ป๋อง', '', '', 'TRUE'],
    ['0049', 'ร่องคำ', '02:ป๋อง', '', '', 'TRUE'],
    ['0109', 'สนญ.-มดแดง', '02:ป๋อง', '', '', 'TRUE'],
    ['0009', 'วาปี-ฮอนด้า', '03:แต๋ว', '', '', 'TRUE'],
    ['0046', 'วาปี-ยามาฮ่า', '03:แต๋ว', '', '', 'TRUE'],
    ['0802', 'อีฮงน้อยวาปีปทุม', '03:แต๋ว', '', '', 'TRUE'],
    ['0011', 'บรบือ', '04:เปา', '', '', 'TRUE'],
    ['0013', 'นาดูน', '04:เปา', '', '', 'TRUE'],
    ['0005', 'โกสุมฯ-ฮอนด้า', '05:เก่ง', '', '', 'TRUE'],
    ['0096', 'โกสุมฯ-มดแดง', '05:เก่ง', '', '', 'TRUE'],
    ['0097', 'บ้านแพง', '05:เก่ง', '', '', 'TRUE'],
    ['0083', 'กุดรัง', '06:เมธี', '', '', 'TRUE'],
    ['0146', 'บ้านไผ่', '06:เมธี', '', '', 'TRUE'],
    ['0152', 'โนนศิลา', '06:เมธี', '', '', 'TRUE'],
    ['0029', 'ซับใหญ่', '07:แกะ', '', '', 'TRUE'],
    ['0125', 'ภักดีชุมพล', '07:แกะ', '', '', 'TRUE'],
    ['0133', 'เทพสถิตย์', '07:แกะ', '', '', 'TRUE'],
    ['0016', 'แกดำ', '08:เจี๊ยบ', '', '', 'TRUE'],
    ['0505', 'ย่อยแวงน่าง', '08:เจี๊ยบ', '', '', 'TRUE'],
    ['0801', 'อีฮงน้อยมหาสารคาม', '08:เจี๊ยบ', '', '', 'TRUE'],
    ['0006', 'เชียงยืน-มดแดง', '09:ถิน', '', '', 'TRUE'],
    ['0070', 'เชียงยืน-ยามาฮ่า', '09:ถิน', '', '', 'TRUE'],
    ['0094', 'ชื่นชม', '09:ถิน', '', '', 'TRUE'],
    ['0031', 'ท่าคันโท', '10:บ๋อม', '', '', 'TRUE'],
    ['0033', 'หนองกุงศรี', '10:บ๋อม', '', '', 'TRUE'],
    ['0039', 'ห้วยเม็ก', '10:บ๋อม', '', '', 'TRUE'],
    ['0045', 'นามน', '11:เปียว', '', '', 'TRUE'],
    ['0047', 'ดอนจาน', '11:เปียว', '', '', 'TRUE'],
    ['0067', 'สมเด็จ', '11:เปียว', '', '', 'TRUE'],
    ['0136', 'กาฬสินธุ์-เวสป้า', '11:เปียว', '', '', 'TRUE'],
    ['0032', 'สหัสขันธ์', '12:นิก', '', '', 'TRUE'],
    ['0036', 'คำม่วง', '12:นิก', '', '', 'TRUE'],
    ['0514', 'บ้านโพน', '12:นิก', '', '', 'TRUE'],
    ['0024', 'โนนหัน', '13:พงษ์', '', '', 'TRUE'],
    ['0071', 'ภูเขียว', '13:พงษ์', '', '', 'TRUE'],
    ['0072', 'เกษตรสมบูรณ์', '13:พงษ์', '', '', 'TRUE'],
    ['0077', 'ชุมแพ', '13:พงษ์', '', '', 'TRUE'],
    ['0124', 'คอนสาร', '13:พงษ์', '', '', 'TRUE'],
    ['0037', 'ภูกระดึง', '14:Kเอี้ยง', '', '', 'TRUE'],
    ['0145', 'ภูผาม่าน', '14:Kเอี้ยง', '', '', 'TRUE'],
    ['0149', 'น้ำหนาว', '14:Kเอี้ยง', '', '', 'TRUE'],
    ['0088', 'โคกโพธิ์ชัย', '15:ดี', '', '', 'TRUE'],
    ['0131', 'มัญจาคีรี', '15:ดี', '', '', 'TRUE'],
    ['0135', 'แก้งคร้อ', '15:ดี', '', '', 'TRUE'],
    ['0100', 'วังสะพุง', '16:สมรักษ์', '', '', 'TRUE'],
    ['0101', 'เมืองเลย', '16:สมรักษ์', '', '', 'TRUE'],
    ['0103', 'เอราวัณ', '16:สมรักษ์', '', '', 'TRUE'],
    ['0054', 'บุรีรัมย์', '17:หนึ่ง', '', '', 'TRUE'],
    ['0066', 'ลำปลายมาศ', '17:หนึ่ง', '', '', 'TRUE'],
    ['0092', 'ชำนิ', '17:หนึ่ง', '', '', 'TRUE'],
    ['0025', 'โนนแดง', '18:แก้ว', '', '', 'TRUE'],
    ['0074', 'ชุมพวง', '18:แก้ว', '', '', 'TRUE'],
    ['0085', 'ลำทะเมนชัย', '18:แก้ว', '', '', 'TRUE'],
    ['0020', 'สตึก', '19:เปิ้ล', '', '', 'TRUE'],
    ['0080', 'แคนดง', '19:เปิ้ล', '', '', 'TRUE'],
    ['0148', 'คูเมือง', '19:เปิ้ล', '', '', 'TRUE'],
    ['0075', 'นางรอง', '20:ธนิต', '', '', 'TRUE'],
    ['0153', 'ละหานทราย', '20:ธนิต', '', '', 'TRUE'],
    ['0164', 'โนนสุวรรณ', '20:ธนิต', '', '', 'TRUE'],
    ['0053', 'ท่าตูม', '21:เอก', '', '', 'TRUE'],
    ['0114', 'รัตนบุรี', '21:เอก', '', '', 'TRUE'],
    ['0150', 'ชุมพลบุรี', '21:เอก', '', '', 'TRUE'],
    ['0050', 'เฉลิมพระเกียรติ(ท่าช้าง)', '22:โทนี่', '', '', 'TRUE'],
    ['0065', 'จักราช', '22:โทนี่', '', '', 'TRUE'],
    ['0126', 'โนนสูง', '22:โทนี่', '', '', 'TRUE'],
    ['0017', 'เมืองเก่าขอนแก่น', '23:วุฒิ(M)', '', '', 'TRUE'],
    ['0058', 'ท่าพระ', '23:วุฒิ(M)', '', '', 'TRUE'],
    ['0064', 'พระยืน', '23:วุฒิ(M)', '', '', 'TRUE'],
    ['0041', 'ขามสะแกแสง', '24:หน่อย', '', '', 'TRUE'],
    ['0090', 'พิมาย', '24:หน่อย', '', '', 'TRUE'],
    ['0139', 'พระทองคำ', '24:หน่อย', '', '', 'TRUE'],
    ['0044', 'เนินสง่า', '25:แต้ว', '', '', 'TRUE'],
    ['0117', 'จัตุรัส', '25:แต้ว', '', '', 'TRUE'],
    ['0162', 'บำเหน็จณรงค์', '25:แต้ว', '', '', 'TRUE'],
    ['0111', 'ภูเรือ', '26:บุ๋มบิ๋ม', '', '', 'TRUE'],
    ['0127', 'ด่านซ้าย', '26:บุ๋มบิ๋ม', '', '', 'TRUE'],
    ['0128', 'ท่าลี่', '26:บุ๋มบิ๋ม', '', '', 'TRUE'],
    ['0115', 'สำโรงทาบ', '27:ดรีม', '', '', 'TRUE'],
    ['0118', 'สนม', '27:ดรีม', '', '', 'TRUE'],
    ['0167', 'ศีขรภูมิ', '27:ดรีม', '', '', 'TRUE'],
    ['0112', 'ปากชม', '28:เบิร์ด', '', '', 'TRUE'],
    ['0119', 'บ้านธาตุ', '28:เบิร์ด', '', '', 'TRUE'],
    ['0122', 'เชียงคาน', '28:เบิร์ด', '', '', 'TRUE'],
    ['0068', 'สามเหลี่ยมขอนแก่น', '29:พวง', '', '', 'TRUE'],
    ['0155', 'ดอนโมง', '29:พวง', '', '', 'TRUE'],
    ['0165', 'พระธาตุขามแก่น', '29:พวง', '', '', 'TRUE'],
    ['0504', 'สาขาหน้าร.8', '29:พวง', '', '', 'TRUE'],
    ['0076', 'สีคิ้ว', '30:ป้อ', '', '', 'TRUE'],
    ['0142', 'สูงเนิน', '30:ป้อ', '', '', 'TRUE'],
    ['0163', 'ปักธงชัย', '30:ป้อ', '', '', 'TRUE'],
    ['0026', 'จอมพระ', '31:เท่ห์', '', '', 'TRUE'],
    ['0079', 'กระสัง', '31:เท่ห์', '', '', 'TRUE'],
    ['0089', 'ปราสาท', '31:เท่ห์', '', '', 'TRUE'],
    ['0154', 'ลำดวน', '31:เท่ห์', '', '', 'TRUE'],
    ['0014', 'นาเชือก', '32:วุฒิ', '', '', 'TRUE'],
    ['0015', 'ยางสีสุราช', '32:วุฒิ', '', '', 'TRUE'],
    ['0056', 'หนองสองห้อง', '32:วุฒิ', '', '', 'TRUE'],
    ['0055', 'ชัยภูมิ', '33:น้อย', '', '', 'TRUE'],
    ['0073', 'หนองบัวแดง', '33:น้อย', '', '', 'TRUE'],
    ['0120', 'ประโคนชัย', '34:ต๋อง', '', '', 'TRUE'],
    ['0158', 'บ้านกรวด', '34:ต๋อง', '', '', 'TRUE'],
    ['0171', 'พลับพลาชัย', '34:ต๋อง', '', '', 'TRUE'],
    ['0051', 'หนองบัวระเหว', '35:ฝน', '', '', 'TRUE'],
    ['0099', 'บ้านค่าย', '35:ฝน', '', '', 'TRUE'],
    ['0513', 'บ้านเขว้า', '35:ฝน', '', '', 'TRUE'],
    ['0062', 'แก้งสนามนาง', '36:ณัฐ', '', '', 'TRUE'],
    ['0063', 'ชนบท', '36:ณัฐ', '', '', 'TRUE'],
    ['0138', 'แวงน้อย', '36:ณัฐ', '', '', 'TRUE'],
    ['0141', 'คอนสวรรค์', '36:ณัฐ', '', '', 'TRUE'],
    ['0091', 'ผาขาว', '37:แป้ง', '', '', 'TRUE'],
    ['0140', 'หนองหิน', '37:แป้ง', '', '', 'TRUE'],
    ['0151', 'ภูหลวง', '37:แป้ง', '', '', 'TRUE'],
    ['0038', 'คำใหญ่', '38:บ๋อม(ญ)', '', '', 'TRUE'],
    ['0061', 'น้ำพอง', '38:บ๋อม(ญ)', '', '', 'TRUE'],
    ['0084', 'กระนวน', '38:บ๋อม(ญ)', '', '', 'TRUE'],
    ['0102', 'ซำสูง-มดแดง', '38:บ๋อม(ญ)', '', '', 'TRUE'],
    ['0022', 'ครบุรี', '39:ปุ้ย', '', '', 'TRUE'],
    ['0052', 'เสิงสาง', '39:ปุ้ย', '', '', 'TRUE'],
    ['0121', 'ปะคำ', '39:ปุ้ย', '', '', 'TRUE'],
    ['0007', 'ยางตลาด', '40:โฟร์', '', '', 'TRUE'],
    ['0008', 'กาฬสินธุ์1', '40:โฟร์', '', '', 'TRUE'],
    ['0035', 'กันทรวิชัย', '40:โฟร์', '', '', 'TRUE'],
    ['0086', 'สีชมพู', '41:เบิร์ด', '', '', 'TRUE'],
    ['0087', 'ศรีบุญเรือง', '41:เบิร์ด', '', '', 'TRUE'],
    ['0095', 'ภูเวียง', '41:เบิร์ด', '', '', 'TRUE'],
    ['0168', 'กุดดินจี่', '41:เบิร์ด', '', '', 'TRUE'],
    ['0027', 'สีดา', '42:วิญญู', '', '', 'TRUE'],
    ['0093', 'นาโพธิ์', '42:วิญญู', '', '', 'TRUE'],
    ['0098', 'ประทาย', '42:วิญญู', '', '', 'TRUE'],
    ['0137', 'พุทไธสง', '42:วิญญู', '', '', 'TRUE'],
    ['0040', 'วังสามหมอ', '43:ต้อ', '', '', 'TRUE'],
    ['0143', 'กุมภวาปี', '43:ต้อ', '', '', 'TRUE'],
    ['0160', 'เขาสวนกวาง', '43:ต้อ', '', '', 'TRUE'],
    ['0509', 'ศรีธาตุ', '43:ต้อ', '', '', 'TRUE'],
    ['0159', 'บัวเชด', '44:ยุทธ', '', '', 'TRUE'],
    ['0161', 'สังขะ', '44:ยุทธ', '', '', 'TRUE'],
    ['0170', 'ศรีณรงค์', '44:ยุทธ', '', '', 'TRUE'],
    ['0012', 'พยัคฆภูมิพิสัย', '45:บี', '', '', 'TRUE'],
    ['0042', 'ปทุมรัตต์', '45:บี', '', '', 'TRUE'],
    ['0803', 'อีฮงน้อยพยัคฆภูมิพิสัย', '45:บี', '', '', 'TRUE'],
    ['0110', 'นากลาง', '46:บอย', '', '', 'TRUE'],
    ['0129', 'นาด้วง', '46:บอย', '', '', 'TRUE'],
    ['0157', 'นาวัง', '46:บอย', '', '', 'TRUE'],
    ['0107', 'หนองบัวลำภู', '47:เอ๋', '', '', 'TRUE'],
    ['0156', 'อุบลรัตน์', '47:เอ๋', '', '', 'TRUE'],
    ['0169', 'โนนสัง', '47:เอ๋', '', '', 'TRUE'],
    ['0123', 'หนองเรือ', '48:บ๊อบบี้', '', '', 'TRUE'],
    ['0147', 'หนองแก', '48:บ๊อบบี้', '', '', 'TRUE'],
    ['0166', 'บ้านแท่น', '48:บ๊อบบี้', '', '', 'TRUE'],
    ['0057', 'หัวทะเล', '49:ป้อ', '', '', 'TRUE'],
    ['0511', 'นิคมสุรนารี', '49:ป้อ', '', '', 'TRUE'],
    ['0010', 'ร้อยเอ็ด1', '50:อั๋น', '', '', 'TRUE'],
    ['0023', 'ร้อยเอ็ด2', '50:อั๋น', '', '', 'TRUE'],
    ['0028', 'บ้านเหลื่อม', '51:ก้อย', '', '', 'TRUE'],
    ['0130', 'บัวใหญ่', '51:ก้อย', '', '', 'TRUE'],
    ['0132', 'คง', '51:ก้อย', '', '', 'TRUE'],
    ['0060', 'ห้วยแถลง', '52:อาย', '', '', 'TRUE'],
    ['0078', 'หนองหงส์', '52:อาย', '', '', 'TRUE'],
    ['0081', 'หนองกี่', '52:อาย', '', '', 'TRUE'],
    ['0106', 'สนญ.-เวสป้า', '55:คิงส์', '', '', 'TRUE'],
    ['0113', 'สนญ.-คาวาซากิ', '55:คิงส์', '', '', 'TRUE'],
    ['0134', 'ร้อยเอ็ด-เวสป้า', '55:คิงส์', '', '', 'TRUE']
  ],
  Carriers: [
    ['ดุลย์', 'อดุลย์ศักดิ์ แสนตู้ลาน', '', '', 'TRUE'],
    ['เบียร์', 'ปัฐวิกรณ์ กิจนิยม', '', '', 'TRUE'],
    ['โจ้', 'วงศธร สุขสมคุณ', '', '', 'TRUE'],
    ['ชัย', 'เจริญชัย บุญโกมุด', '', '', 'TRUE'],
    ['ตั้ม', 'วิทวัช นามพิชัย', '', '', 'TRUE'],
    ['ทัช', 'มนัสชัย ดีเสมอ', '', '', 'TRUE']
  ],
  DropPoints: [],
  Parts: []
};

/**
 * สร้างชีตทั้งหมดพร้อมหัวตาราง เรียกซ้ำได้ปลอดภัย (ไม่ลบข้อมูลเดิม)
 */
function setupSheets() {
  var ss = getSpreadsheet_();
  var created = [];

  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      created.push(name);
    }
    var headers = HEADERS[name];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold')
      .setBackground('#eef2ff');
    sh.setFrozenRows(1);

    if (sh.getLastRow() < 2 && SAMPLE_DATA[name] && SAMPLE_DATA[name].length) {
      sh.getRange(2, 1, SAMPLE_DATA[name].length, headers.length)
        .setValues(SAMPLE_DATA[name]);
    }
    sh.autoResizeColumns(1, headers.length);
  });

  var fixed = normalizeBranchCodes_();

  clearMasterCache_();
  var msg = created.length
    ? 'สร้างชีตใหม่: ' + created.join(', ')
    : 'ชีตครบอยู่แล้ว — อัปเดตหัวตารางให้เรียบร้อย';
  if (fixed) msg += ' | แก้รหัสสาขาให้เป็น 4 หลัก ' + fixed + ' แถว';
  Logger.log(msg);
  return msg;
}

/**
 * ซ่อมคอลัมน์รหัสสาขาให้เป็นข้อความ 4 หลักเสมอ
 * Google Sheets จะแปลง "0132" เป็นตัวเลข 132 เองถ้าไม่ตั้งรูปแบบเป็นข้อความไว้
 */
function normalizeBranchCodes_() {
  var sh = getSpreadsheet_().getSheetByName(SHEETS.BRANCHES);
  if (!sh) return 0;
  var last = sh.getLastRow();
  if (last < 2) return 0;

  var range = sh.getRange(2, colIndex_('Branches', 'branchCode'), last - 1, 1);
  range.setNumberFormat('@');            // ล็อกเป็นข้อความ กัน 0 นำหน้าหายอีก

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

/** ดู URL ของเว็บแอปที่ deploy ไว้ (เอาไปเปิดบนมือถือ) */
function showWebAppUrl() {
  var url = ScriptApp.getService().getUrl();
  Logger.log(url);
  return url;
}

/** ตรวจว่าตั้งค่าครบหรือยัง */
function checkSetup() {
  var lines = [];
  Object.keys(HEADERS).forEach(function (name) {
    var sh = getSpreadsheet_().getSheetByName(name);
    lines.push((sh ? '✅' : '❌') + ' ชีต ' + name + (sh ? ' (' + Math.max(0, sh.getLastRow() - 1) + ' แถว)' : ''));
  });
  lines.push(prop_('VISION_API_KEY')
    ? '✅ ตัวอ่านเอกสาร: Cloud Vision (แม่นกว่า)'
    : '➖ ตัวอ่านเอกสาร: Drive OCR — ใส่ VISION_API_KEY ใน Script Properties เพื่อใช้ Cloud Vision');
  try {
    var pickId = pickRootId_();
    lines.push('✅ โฟลเดอร์ที่เลือกรูปจากไดรฟ์ได้: ' + driveName_(pickId) + ' (' + pickId + ')');
  } catch (err) {
    lines.push('❌ เตรียมโฟลเดอร์สำหรับเลือกรูปจากไดรฟ์ไม่สำเร็จ: ' + (err.message || err));
  }
  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

/**
 * ทดสอบว่าคีย์ Cloud Vision ใช้ได้จริงไหม (รันเองจากหน้า Apps Script)
 * ส่งรูปสี่เหลี่ยมเล็ก ๆ ไปหนึ่งใบ ถ้าตอบกลับมาโดยไม่ error แปลว่าคีย์ผ่าน
 */
function checkVisionKey() {
  var key = prop_('VISION_API_KEY');
  if (!key) {
    var msg = '❌ ยังไม่ได้ตั้ง VISION_API_KEY ใน Script Properties — ตอนนี้ระบบใช้ Drive OCR อยู่';
    Logger.log(msg);
    return msg;
  }
  var pixel = Utilities.base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
  try {
    visionOcr_(Utilities.newBlob(pixel, 'image/png', 'ping.png'), key);
    var ok = '✅ คีย์ Cloud Vision ใช้ได้ ระบบจะใช้ตัวนี้อ่านใบให้';
    Logger.log(ok);
    return ok;
  } catch (err) {
    var bad = '❌ คีย์ใช้ไม่ได้: ' + (err.message || err) +
      '\nตรวจว่าเปิดใช้ Cloud Vision API ในโปรเจกต์ และเปิดการเรียกเก็บเงินไว้แล้ว';
    Logger.log(bad);
    return bad;
  }
}

/** เมนูลัดบนชีต (ใช้ได้เมื่อสคริปต์ผูกกับไฟล์ชีต) */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ระบบส่งอะไหล่')
    .addItem('ติดตั้ง/ซ่อมโครงสร้างชีต', 'setupSheets')
    .addItem('ตรวจการตั้งค่า', 'checkSetupDialog')
    .addToUi();
}

function checkSetupDialog() { SpreadsheetApp.getUi().alert(checkSetup()); }
