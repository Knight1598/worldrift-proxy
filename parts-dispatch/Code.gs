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
    'itemsSummary', 'clientToken'
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

function doGet() {
  return HtmlService.createHtmlOutputFromFile('App')
    .setTitle('บันทึกส่งอะไหล่')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** ข้อมูลตั้งต้นของฟอร์ม: รายชื่อเขต/สาขา/ขนส่ง/จุดฝากลง */
function apiBootstrap() {
  var masters = getMasters_();
  return {
    ok: true,
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

/** ค้น/กรองรายงานย้อนหลัง */
function apiSearch(payload) {
  try {
    return { ok: true, results: searchShipments_(payload || {}) };
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
        code: String(r.branchCode || '').trim(),
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

  var shipmentId, isDuplicate = false;
  try {
    var sh = getSheet_(SHEETS.SHIPMENTS);

    var dup = findByClientToken_(sh, clean.clientToken);
    if (dup) {
      isDuplicate = true;
      shipmentId = dup.shipmentId;
    } else {
      shipmentId = nextShipmentId_(sh);
      sh.appendRow(buildShipmentRow_(shipmentId, clean));
      writeItems_(shipmentId, clean.items);
    }
  } finally {
    lock.releaseLock();
  }

  if (isDuplicate) {
    // กดซ้ำ/เน็ตหลุดแล้วส่งซ้ำ — คืนผลเดิม ไม่เขียนแถวใหม่
    return { ok: true, shipmentId: shipmentId, duplicate: true };
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
    clientToken: c.clientToken
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

/** ค้นได้ด้วย เลขที่ใบ PR, รหัส/ชื่ออะไหล่, เลขพัสดุ, ชื่อสาขา, จุดฝากลง, เลขที่รอบส่ง */
function searchShipments_(opts) {
  var q = String(opts.q || '').trim().toLowerCase();
  var zone = String(opts.zone || '').trim();
  var branch = String(opts.branch || '').trim();
  var from = String(opts.from || '').trim();
  var to = String(opts.to || '').trim();
  var limit = Math.min(Number(opts.limit) || 50, 200);
  var transferOnly = !!opts.transferOnly;

  var shipments = readSheetObjects_(SHEETS.SHIPMENTS).slice(-3000);
  var itemsById = groupItems_();

  var results = [];
  for (var i = shipments.length - 1; i >= 0 && results.length < limit; i--) {
    var s = shipments[i];
    var id = String(s.shipmentId || '');
    if (!id) continue;

    var shipDate = String(s.shipDate || '');
    if (from && shipDate < from) continue;
    if (to && shipDate > to) continue;
    if (zone && String(s.zone || '') !== zone) continue;
    if (branch && String(s.destBranch || '') !== branch) continue;

    var isTransfer = String(s.isTransfer).toUpperCase() === 'TRUE';
    if (transferOnly && !isTransfer) continue;

    var items = itemsById[id] || [];
    if (q) {
      var haystack = [
        id, s.prNo, s.destBranch, s.zone, s.dropPoint, s.carrier,
        s.trackingNo, s.sender, s.receiverName, s.note, s.itemsSummary
      ].join(' ').toLowerCase();
      var itemText = items.map(function (it) {
        return it.partCode + ' ' + it.partName + ' ' + it.note;
      }).join(' ').toLowerCase();
      if (haystack.indexOf(q) < 0 && itemText.indexOf(q) < 0) continue;
    }

    results.push({
      shipmentId: id,
      shipDate: shipDate,
      prNo: String(s.prNo || ''),
      destBranch: String(s.destBranch || ''),
      zone: String(s.zone || ''),
      dropPoint: String(s.dropPoint || ''),
      isTransfer: isTransfer,
      carrier: String(s.carrier || ''),
      trackingNo: String(s.trackingNo || ''),
      boxCount: s.boxCount === '' ? '' : String(s.boxCount),
      sender: String(s.sender || ''),
      receiverName: String(s.receiverName || ''),
      note: String(s.note || ''),
      items: items
    });
  }
  return results;
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
 * ส่วนที่ 5 — ติดตั้งและตรวจสอบระบบ (รันเองจากเมนู Apps Script)
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

  clearMasterCache_();
  var msg = created.length
    ? 'สร้างชีตใหม่: ' + created.join(', ')
    : 'ชีตครบอยู่แล้ว — อัปเดตหัวตารางให้เรียบร้อย';
  Logger.log(msg);
  return msg;
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
  var out = lines.join('\n');
  Logger.log(out);
  return out;
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
