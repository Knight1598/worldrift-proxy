/**
 * ระบบบันทึกการส่งอะไหล่ + แจ้งเตือนกลุ่มไลน์
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
  Parts: ['partCode', 'partName', 'unit', 'lastUsedAt'],
  Shipments: [
    'shipmentId', 'createdAt', 'shipDate', 'docNo', 'destBranch', 'zone', 'dropPoint',
    'isTransfer', 'carrier', 'trackingNo', 'boxCount', 'sender', 'receiverName', 'note',
    'itemsSummary', 'lineStatus', 'clientToken'
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

function formatThaiDate_(iso) {
  var s = String(iso || '').trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : s;
}

/* =======================================================================
 * ส่วนที่ 2 — เราต์ของเว็บแอป และ API ที่หน้าเว็บเรียกใช้
 * ===================================================================== */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('App')
    .setTitle('บันทึกส่งอะไหล่')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** รับเฉพาะ webhook ของ LINE (หน้าเว็บคุยกับสคริปต์ผ่าน google.script.run ไม่ผ่านทางนี้) */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    body = {};
  }
  if (body && body.events) return handleLineWebhook_(body);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: 'unsupported payload' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function requirePin_(pin) {
  var expected = prop_('APP_PIN');
  if (!expected) return;
  if (String(pin || '') !== String(expected)) {
    throw new Error('PIN_REQUIRED');
  }
}

/** ข้อมูลตั้งต้นของฟอร์ม: รายชื่อสาขา/ขนส่ง/จุดฝากลง/อะไหล่ */
function apiBootstrap(payload) {
  payload = payload || {};
  if (prop_('APP_PIN') && String(payload.pin || '') !== prop_('APP_PIN')) {
    return { ok: false, needPin: true };
  }
  var masters = getMasters_();
  return {
    ok: true,
    needPin: false,
    today: todayIso_(),
    lineReady: !!(prop_('LINE_CHANNEL_ACCESS_TOKEN') && prop_('LINE_GROUP_ID')),
    branches: masters.branches,
    carriers: masters.carriers,
    dropPoints: masters.dropPoints,
    parts: masters.parts
  };
}

/** บันทึกรอบส่ง 1 รอบ แล้วยิงข้อความเข้ากลุ่มไลน์ */
function apiSaveShipment(payload) {
  payload = payload || {};
  try {
    requirePin_(payload.pin);
    return saveShipment_(payload);
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** ค้นประวัติการส่ง */
function apiSearch(payload) {
  payload = payload || {};
  try {
    requirePin_(payload.pin);
    return { ok: true, results: searchShipments_(payload) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** ส่งข้อความเข้าไลน์ซ้ำสำหรับรอบส่งที่ยิงไม่สำเร็จ */
function apiResendLine(payload) {
  payload = payload || {};
  try {
    requirePin_(payload.pin);
    return resendLine_(payload.shipmentId);
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/* =======================================================================
 * ส่วนที่ 3 — ข้อมูลหลัก (สาขา / ขนส่ง / จุดฝากลง / อะไหล่)
 * ตารางสาขาคือหัวใจของการ "ไม่ต้องจำเขตขนส่ง"
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

  var data = {
    branches: readSheetObjects_(SHEETS.BRANCHES)
      .filter(function (r) { return String(r.branchName || '').trim() && isActive_(r.active); })
      .map(function (r) {
        return {
          code: String(r.branchCode || '').trim(),
          name: String(r.branchName).trim(),
          zone: String(r.zone || '').trim(),
          carrier: String(r.defaultCarrier || '').trim(),
          dropPoint: String(r.defaultDropPoint || '').trim()
        };
      }),
    carriers: readSheetObjects_(SHEETS.CARRIERS)
      .filter(function (r) { return String(r.carrierName || '').trim() && isActive_(r.active); })
      .map(function (r) {
        return { name: String(r.carrierName).trim(), note: String(r.note || '').trim() };
      }),
    dropPoints: readSheetObjects_(SHEETS.DROP_POINTS)
      .filter(function (r) { return String(r.dropPointName || '').trim(); })
      .map(function (r) {
        return { name: String(r.dropPointName).trim(), zone: String(r.zone || '').trim() };
      }),
    parts: readSheetObjects_(SHEETS.PARTS)
      .filter(function (r) { return String(r.partCode || r.partName || '').trim(); })
      .map(function (r) {
        return {
          code: String(r.partCode || '').trim(),
          name: String(r.partName || '').trim(),
          unit: String(r.unit || '').trim()
        };
      })
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

/**
 * เก็บอะไหล่ที่เพิ่งคีย์เข้าคลังคำ เพื่อให้ครั้งหน้ามี autocomplete ให้เลือก
 * ยึดรหัสเป็นหลัก ถ้าไม่มีรหัสก็ยึดชื่อ
 */
function upsertParts_(items) {
  if (!items || !items.length) return;
  var sh = getSheet_(SHEETS.PARTS);
  var existing = readSheetObjects_(SHEETS.PARTS);
  var byKey = {};
  existing.forEach(function (r) {
    var k = partKey_(r.partCode, r.partName);
    if (k) byKey[k] = r;
  });

  var stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  var toAppend = [];
  var seen = {};

  items.forEach(function (it) {
    var key = partKey_(it.partCode, it.partName);
    if (!key || seen[key]) return;
    seen[key] = true;
    var found = byKey[key];
    if (found) {
      sh.getRange(found._row, colIndex_('Parts', 'lastUsedAt')).setValue(stamp);
      if (!String(found.partName || '').trim() && it.partName) {
        sh.getRange(found._row, colIndex_('Parts', 'partName')).setValue(it.partName);
      }
    } else {
      toAppend.push([it.partCode || '', it.partName || '', it.unit || '', stamp]);
    }
  });

  if (toAppend.length) {
    sh.getRange(sh.getLastRow() + 1, 1, toAppend.length, HEADERS.Parts.length).setValues(toAppend);
    clearMasterCache_();
  }
}

function partKey_(code, name) {
  var c = String(code || '').trim().toUpperCase();
  if (c) return 'C:' + c;
  var n = String(name || '').trim().toUpperCase();
  return n ? 'N:' + n : '';
}

/* =======================================================================
 * ส่วนที่ 4 — บันทึกรอบส่งและค้นประวัติ
 * ===================================================================== */

/**
 * บันทึก 1 รอบส่ง: เขียนชีตให้เสร็จก่อน แล้วค่อยยิงไลน์
 * ถ้าไลน์ล้ม ข้อมูลยังอยู่ครบ และกดส่งซ้ำจากหน้าประวัติได้
 */
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
    // กดซ้ำ/เน็ตหลุดแล้วส่งซ้ำ — คืนผลเดิม ไม่เขียนใหม่และไม่ยิงไลน์ซ้ำ
    return { ok: true, shipmentId: shipmentId, duplicate: true, lineStatus: 'ส่งไปแล้วก่อนหน้านี้' };
  }

  try {
    upsertParts_(clean.items);
  } catch (err) {
    // อัปเดตคลังคำอะไหล่ไม่สำเร็จ ไม่ควรทำให้การบันทึกล้มเหลว
    console.warn('upsertParts_ ล้มเหลว: ' + err);
  }

  var line = pushLineText_(buildShipmentMessage_(shipmentId, clean));
  setLineStatus_(shipmentId, line.ok ? 'SENT ' + nowStamp_() : 'FAILED: ' + line.error);

  return {
    ok: true,
    shipmentId: shipmentId,
    duplicate: false,
    lineSent: line.ok,
    lineStatus: line.ok ? 'แจ้งเข้ากลุ่มไลน์แล้ว' : ('ยังไม่ได้แจ้งไลน์: ' + line.error),
    summary: {
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
    docNo: String(p.docNo || '').trim(),
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
    docNo: c.docNo,
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
    lineStatus: 'PENDING',
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

function setLineStatus_(shipmentId, status) {
  var sh = getSheet_(SHEETS.SHIPMENTS);
  var last = sh.getLastRow();
  if (last < 2) return;
  var ids = sh.getRange(2, colIndex_('Shipments', 'shipmentId'), last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === shipmentId) {
      sh.getRange(i + 2, colIndex_('Shipments', 'lineStatus')).setValue(status);
      return;
    }
  }
}

/** ค้นได้ด้วย รหัส/ชื่ออะไหล่, เลขพัสดุ, เลขที่บิล, ชื่อสาขา, จุดฝากลง, เลขที่รอบส่ง */
function searchShipments_(opts) {
  var q = String(opts.q || '').trim().toLowerCase();
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
    if (branch && String(s.destBranch || '') !== branch) continue;

    var isTransfer = String(s.isTransfer).toUpperCase() === 'TRUE';
    if (transferOnly && !isTransfer) continue;

    var items = itemsById[id] || [];
    if (q) {
      var haystack = [
        id, s.docNo, s.destBranch, s.zone, s.dropPoint, s.carrier,
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
      docNo: String(s.docNo || ''),
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
      lineStatus: String(s.lineStatus || ''),
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

/** ส่งข้อความเข้าไลน์ซ้ำสำหรับรอบส่งเดิม */
function resendLine_(shipmentId) {
  var id = String(shipmentId || '').trim();
  if (!id) throw new Error('ไม่ได้ระบุเลขที่รอบส่ง');

  var found = null;
  var shipments = readSheetObjects_(SHEETS.SHIPMENTS);
  for (var i = shipments.length - 1; i >= 0; i--) {
    if (String(shipments[i].shipmentId) === id) { found = shipments[i]; break; }
  }
  if (!found) throw new Error('ไม่พบรอบส่ง ' + id);

  var items = (groupItems_()[id] || []);
  var payload = {
    shipDate: String(found.shipDate || ''),
    docNo: String(found.docNo || ''),
    destBranch: String(found.destBranch || ''),
    zone: String(found.zone || ''),
    dropPoint: String(found.dropPoint || ''),
    isTransfer: String(found.isTransfer).toUpperCase() === 'TRUE',
    carrier: String(found.carrier || ''),
    trackingNo: String(found.trackingNo || ''),
    boxCount: found.boxCount,
    sender: String(found.sender || ''),
    receiverName: String(found.receiverName || ''),
    note: String(found.note || ''),
    items: items
  };

  var line = pushLineText_(buildShipmentMessage_(id, payload));
  setLineStatus_(id, line.ok ? 'SENT ' + nowStamp_() : 'FAILED: ' + line.error);
  return { ok: line.ok, shipmentId: id, error: line.error || '' };
}

/* =======================================================================
 * ส่วนที่ 5 — LINE Messaging API
 *
 * หมายเหตุ: LINE Notify ปิดบริการไปแล้ว (31 มี.ค. 2568) จึงต้องใช้ LINE Official Account
 * เชิญบอทเข้ากลุ่ม แล้ว push ข้อความไปที่ groupId ของกลุ่มนั้น
 * ===================================================================== */

var LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
var LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

/** ส่งข้อความ text เข้ากลุ่มที่ตั้งค่าไว้ — ไม่ throw แต่คืน {ok, error} ให้ผู้เรียกตัดสินใจ */
function pushLineText_(text) {
  var token = prop_('LINE_CHANNEL_ACCESS_TOKEN');
  var groupId = prop_('LINE_GROUP_ID');
  if (!token) return { ok: false, error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN' };
  if (!groupId) return { ok: false, error: 'ยังไม่ได้ตั้งค่า LINE_GROUP_ID (ยังไม่ได้จับคู่กลุ่ม)' };

  try {
    var res = UrlFetchApp.fetch(LINE_PUSH_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        to: groupId,
        messages: [{ type: 'text', text: truncateForLine_(text) }]
      }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code === 200) return { ok: true, error: '' };
    return { ok: false, error: 'LINE ตอบกลับ HTTP ' + code + ' ' + res.getContentText().substring(0, 300) };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

/** ข้อความ LINE ยาวได้ไม่เกิน 5,000 ตัวอักษร */
function truncateForLine_(text) {
  var s = String(text || '');
  return s.length > 4900 ? s.substring(0, 4890) + '\n… (ตัดข้อความ)' : s;
}

/**
 * ข้อความสรุปที่ยิงเข้ากลุ่ม
 * บรรทัด ⚠️ จะขึ้นเฉพาะรอบที่ฝากลงคนละที่กับสาขาปลายทาง เพื่อให้สะดุดตา
 */
function buildShipmentMessage_(shipmentId, c) {
  var lines = [];
  lines.push('📦 ส่งอะไหล่ ' + shipmentId);

  var head = '📅 ' + formatThaiDate_(c.shipDate);
  if (c.docNo) head += '  |  บิล ' + c.docNo;
  lines.push(head);

  lines.push('🏢 ปลายทาง: ' + c.destBranch + (c.zone ? ' (เขต' + c.zone + ')' : ''));
  if (c.isTransfer) lines.push('⚠️ ฝากลงที่: ' + c.dropPoint);

  var ship = '🚚 ขนส่ง: ' + c.carrier;
  if (c.trackingNo) ship += ' | เลขพัสดุ: ' + c.trackingNo;
  if (c.boxCount !== '' && c.boxCount !== null && c.boxCount !== undefined) ship += ' | ' + c.boxCount + ' กล่อง';
  lines.push(ship);

  if (c.receiverName) lines.push('👤 ผู้รับ: ' + c.receiverName);

  lines.push('📋 รายการ');
  (c.items || []).forEach(function (it) {
    var row = ' • ' + (it.partCode ? it.partCode + ' ' : '') + it.partName + ' x' + it.qty;
    if (it.unit) row += ' ' + it.unit;
    if (it.note) row += ' (' + it.note + ')';
    lines.push(row);
  });

  if (c.note) lines.push('📝 ' + c.note);
  if (c.sender) lines.push('— บันทึกโดย: ' + c.sender);

  return lines.join('\n');
}

/**
 * รับ webhook จาก LINE เพื่อจับ groupId ตอนตั้งค่า
 *
 * ข้อจำกัด: Apps Script อ่าน HTTP header ไม่ได้ จึงตรวจลายเซ็น X-Line-Signature ไม่ได้
 * เพราะฉะนั้นจะรับ event เฉพาะตอนเปิด PAIRING_MODE เท่านั้น และปิดโหมดทันทีที่จับคู่สำเร็จ
 */
function handleLineWebhook_(body) {
  var ok = { ok: true };
  if (prop_('PAIRING_MODE') !== 'true') return jsonOut_(ok);

  var events = body.events || [];
  for (var i = 0; i < events.length; i++) {
    var src = events[i].source || {};
    var id = src.groupId || src.roomId;
    if (!id) continue;

    props_().setProperty('LINE_GROUP_ID', id);
    props_().setProperty('PAIRING_MODE', 'false');

    if (events[i].replyToken) {
      replyLineText_(events[i].replyToken,
        '✅ จับคู่กลุ่มสำเร็จ\nต่อจากนี้ทุกครั้งที่มีการบันทึกส่งอะไหล่ ระบบจะแจ้งเข้ากลุ่มนี้อัตโนมัติ');
    }
    break;
  }
  return jsonOut_(ok);
}

function replyLineText_(replyToken, text) {
  var token = prop_('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) return;
  try {
    UrlFetchApp.fetch(LINE_REPLY_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: truncateForLine_(text) }]
      }),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.warn('ตอบกลับ LINE ไม่สำเร็จ: ' + err);
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =======================================================================
 * ส่วนที่ 6 — ติดตั้งและตรวจสอบระบบ (รันเองจากเมนู Apps Script)
 * ===================================================================== */

/** ตัวอย่างข้อมูลตั้งต้น ให้ลบทิ้งแล้วใส่ของจริงทับได้เลย */
var SAMPLE_DATA = {
  Branches: [
    ['KKN', 'ขอนแก่น', 'อีสานเหนือ', 'นิ่มซี่เส็ง', 'ขอนแก่น', 'TRUE'],
    ['KTW', 'กันทรวิชัย', 'อีสานเหนือ', 'นิ่มซี่เส็ง', 'กันทรวิชัย', 'TRUE'],
    ['MKM', 'มหาสารคาม', 'อีสานเหนือ', 'นิ่มซี่เส็ง', 'มหาสารคาม', 'TRUE'],
    ['UDN', 'อุดรธานี', 'อีสานเหนือ', 'ขนส่งชัยพัฒนา', 'อุดรธานี', 'TRUE'],
    ['UBN', 'อุบลราชธานี', 'อีสานใต้', 'ขนส่งชัยพัฒนา', 'อุบลราชธานี', 'TRUE']
  ],
  Carriers: [
    ['NIM', 'นิ่มซี่เส็ง', '', 'ส่งจันทร์/พุธ/ศุกร์', 'TRUE'],
    ['CHP', 'ขนส่งชัยพัฒนา', '', '', 'TRUE'],
    ['KRY', 'Kerry', '', '', 'TRUE'],
    ['FLE', 'Flash Express', '', '', 'TRUE'],
    ['CAR', 'รถบริษัท', '', 'รอบวันศุกร์', 'TRUE']
  ],
  DropPoints: [
    ['ท่ารถขอนแก่น', 'อีสานเหนือ', 'ฝากท่ารถให้สาขามารับเอง'],
    ['ปั๊มน้ำมันหน้าอำเภอ', 'อีสานเหนือ', '']
  ],
  Parts: [
    ['M-001', 'มอเตอร์ล้อหลัง', 'ตัว', ''],
    ['B-014', 'สายเบรกหน้า', 'เส้น', ''],
    ['C-220', 'คอนโทรลเลอร์', 'ตัว', '']
  ]
};

/** สร้างชีตทั้งหมดพร้อมหัวตาราง เรียกซ้ำได้ปลอดภัย (ไม่ลบข้อมูลเดิม) */
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

    if (sh.getLastRow() < 2 && SAMPLE_DATA[name]) {
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

/** ทดสอบว่าส่งข้อความเข้ากลุ่มไลน์ได้จริง — รันหลังใส่ token และ groupId แล้ว */
function testLineMessage() {
  var res = pushLineText_('✅ ทดสอบระบบบันทึกส่งอะไหล่ — ถ้าเห็นข้อความนี้แปลว่าเชื่อมต่อสำเร็จแล้ว');
  Logger.log(res.ok ? 'ส่งสำเร็จ' : 'ส่งไม่สำเร็จ: ' + res.error);
  return res;
}

/** เปิดโหมดจับคู่กลุ่ม แล้วไปพิมพ์อะไรก็ได้ในกลุ่มไลน์ เพื่อให้ระบบเก็บ groupId ให้เอง */
function pairingModeOn() {
  props_().setProperty('PAIRING_MODE', 'true');
  return 'เปิดโหมดจับคู่แล้ว — เชิญบอทเข้ากลุ่ม แล้วพิมพ์ข้อความอะไรก็ได้ในกลุ่ม';
}

function pairingModeOff() {
  props_().setProperty('PAIRING_MODE', 'false');
  return 'ปิดโหมดจับคู่แล้ว groupId ปัจจุบัน: ' + (prop_('LINE_GROUP_ID') || '(ยังไม่มี)');
}

/** ดู URL ของเว็บแอปที่ deploy ไว้ (เอาไปใส่เป็น Webhook URL และเปิดบนมือถือ) */
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
  lines.push((prop_('LINE_CHANNEL_ACCESS_TOKEN') ? '✅' : '❌') + ' LINE_CHANNEL_ACCESS_TOKEN');
  lines.push((prop_('LINE_GROUP_ID') ? '✅' : '❌') + ' LINE_GROUP_ID ' + (prop_('LINE_GROUP_ID') ? '(' + prop_('LINE_GROUP_ID') + ')' : ''));
  lines.push((prop_('APP_PIN') ? '🔒 ตั้ง PIN ไว้' : '🔓 ไม่ได้ตั้ง PIN (ใครมีลิงก์ก็คีย์ได้)'));
  lines.push('PAIRING_MODE = ' + (prop_('PAIRING_MODE') || 'false'));
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
    .addSeparator()
    .addItem('ทดสอบส่งไลน์', 'testLineMessageDialog')
    .addItem('เปิดโหมดจับคู่กลุ่มไลน์', 'pairingModeOnDialog')
    .addItem('ปิดโหมดจับคู่กลุ่มไลน์', 'pairingModeOffDialog')
    .addToUi();
}

function checkSetupDialog() { SpreadsheetApp.getUi().alert(checkSetup()); }
function pairingModeOnDialog() { SpreadsheetApp.getUi().alert(pairingModeOn()); }
function pairingModeOffDialog() { SpreadsheetApp.getUi().alert(pairingModeOff()); }
function testLineMessageDialog() {
  var res = testLineMessage();
  SpreadsheetApp.getUi().alert(res.ok ? 'ส่งเข้ากลุ่มไลน์สำเร็จ' : 'ส่งไม่สำเร็จ:\n' + res.error);
}
