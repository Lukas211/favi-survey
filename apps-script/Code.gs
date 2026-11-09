/**
 * favi-survey-endpoint (verze 2 – odpovědi po sloupcích)
 * Přijímá odpovědi z dotazníku Partner dashboard (favionline.com)
 * a zapisuje je do listu "Odpovedi" v nadřazené Google tabulce.
 *
 * Dotazník posílá POST s JSON tělem (Content-Type: text/plain):
 * { lang, answers, text, columns, hp }
 *   lang    – jazyk dotazníku (cz / sk / en)
 *   answers – všechny odpovědi jako objekt (surová data)
 *   text    – čitelný textový přepis odpovědí
 *   columns – [{ label, value }] – jedna položka = jeden sloupec (česky,
 *             hodnocení jako "😍 5 – Velmi spokojený")
 *   hp      – honeypot (rezerva, dotazník ho zatím neposílá vyplněný)
 *
 * Sloupce se párují podle názvu v řádku 1. Když přijde otázka, která v
 * záhlaví ještě není, přidá se nový sloupec na konec.
 */

var SHEET_NAME = 'Odpovedi';
var MAX_CELL = 49000; // limit buňky v Google Sheets je 50 000 znaků

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (data.hp) return json_({ ok: true });

    var fields = [['Datum', new Date()], ['Jazyk', String(data.lang || '').toUpperCase()]];
    (data.columns || []).forEach(function (c) {
      if (c && c.label) fields.push([String(c.label), c.value]);
    });
    fields.push(['Odpovědi (text)', data.text || '']);
    fields.push(['Data (JSON)', JSON.stringify(data.answers || {})]);

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
  return json_({ ok: true, service: 'favi-survey-endpoint', version: 2 });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
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

// Ruční test: v editoru vyber "testZapis" a klikni Spustit.
// Do listu Odpovedi přibude testovací řádek (pak ho smaž).
function testZapis() {
  var fake = {
    postData: {
      contents: JSON.stringify({
        lang: 'cz',
        answers: { name: 'TEST Lukáš' },
        text: 'Testovací odpověď – smazat',
        columns: [
          { label: 'Jméno a příjmení', value: 'TEST Lukáš' },
          { label: 'Jaká je vaše celková spokojenost s novým dashboardem?', value: '😍 5 – Velmi spokojený' }
        ],
        hp: ''
      })
    }
  };
  console.log(doPost(fake).getContent());
}
