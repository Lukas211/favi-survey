/**
 * favi-survey-endpoint (verze 4 – odpovědi po sloupcích, verze dotazníku, surová data zvlášť)
 * Přijímá odpovědi z dotazníku Partner dashboard (favionline.com)
 * a zapisuje je do listu "Odpovedi" v nadřazené Google tabulce.
 *
 * Dotazník posílá POST s JSON tělem (Content-Type: text/plain):
 * { lang, version, answers, text, columns, hp }
 *   lang    – jazyk dotazníku (cz / sk / en)
 *   version – verze dotazníku = tag v repu favi-survey (v3, v4, …)
 *   answers – všechny odpovědi jako objekt (surová data)
 *   text    – čitelný textový přepis odpovědí
 *   columns – [{ label, value }] – jedna položka = jeden sloupec (česky,
 *             hodnocení jako "😍 5 – Velmi spokojený")
 *   hp      – honeypot (rezerva, dotazník ho zatím neposílá vyplněný)
 *
 * List "Odpovedi": Datum, Jazyk, Verze dotazníku + jeden sloupec na otázku (název sloupce =
 * přesné znění otázky v aktuální verzi dotazníku, hodnota = odpověď).
 * Sloupce se párují podle názvu v řádku 1. Když přijde otázka, která v
 * záhlaví ještě není (nová nebo přejmenovaná), přidá se nový sloupec na konec.
 *
 * List "Raw": záloha surových dat (JSON + textový přepis) – jen pro případ
 * dohledání, pro běžnou práci se nepoužívá.
 */

var SHEET_NAME = 'Odpovedi';
var RAW_SHEET_NAME = 'Raw';
var MAX_CELL = 49000; // limit buňky v Google Sheets je 50 000 znaků

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.hp) return json_({ ok: true });

    var fields = [
      ['Datum', new Date()],
      ['Jazyk', String(data.lang || '').toUpperCase()],
      ['Verze dotazníku', String(data.version || '')]
    ];
    (data.columns || []).forEach(function (c) {
      if (c && c.label) fields.push([String(c.label), c.value]);
    });

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = getSheet_();
      var lastCol = sheet.getLastColumn();
      var header = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
      var startLen = header.length;

      fields.forEach(function (f) {
        if (header.indexOf(f[0]) === -1) header.push(f[0]);
      });
      if (header.length !== startLen) {
        sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }

      var row = header.map(function () { return ''; });
      fields.forEach(function (f) { row[header.indexOf(f[0])] = clean_(f[1]); });
      sheet.appendRow(row);

      var raw = getRawSheet_();
      raw.appendRow([fields[0][1], fields[1][1], fields[2][1], clean_(data.text || ''), clean_(JSON.stringify(data.answers || {}))]);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err) });
  }
}

// Otevření URL v prohlížeči jen ověří, že endpoint běží
function doGet() {
  return json_({ ok: true, service: 'favi-survey-endpoint', version: 4 });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function getRawSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(RAW_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(RAW_SHEET_NAME);
    sh.appendRow(['Datum', 'Jazyk', 'Verze dotazníku', 'Odpovědi (text)', 'Data (JSON)']);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  return sh;
}

// Ochrana proti vložení vzorce (=, +, -, @) a příliš dlouhému textu
function clean_(v) {
  if (v instanceof Date) return v;
  var s = v == null ? '' : String(v);
  if (s.length > MAX_CELL) s = s.slice(0, MAX_CELL) + ' …[zkráceno]';
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
