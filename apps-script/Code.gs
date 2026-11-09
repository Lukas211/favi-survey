/**
 * favi-survey-endpoint
 * Přijímá odpovědi z dotazníku Partner dashboard (favionline.com)
 * a zapisuje je do listu "Odpovedi" v nadřazené Google tabulce.
 *
 * Dotazník posílá POST s JSON tělem (Content-Type: text/plain):
 * { lang, answers, text, hp }
 *   lang    – jazyk dotazníku (cz / sk / en)
 *   answers – všechny odpovědi jako objekt (S.a z dotazníku)
 *   text    – čitelný textový přepis odpovědí
 *   hp      – honeypot (skryté pole); když je vyplněné, jde o robota
 */

var SHEET_NAME = 'Odpovedi';
var MAX_CELL = 49000; // limit buňky v Google Sheets je 50 000 znaků

var HEADERS = [
  'Datum', 'Jazyk', 'Jméno', 'E-shop', 'E-mail', 'Telefon',
  'Hovor', 'Souhlas s kontaktem', 'Odpovědi (text)', 'Data (JSON)'
];

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Robot vyplnil skryté pole → tiše ignorovat
    if (data.hp) return json_({ ok: true });

    var a = data.answers || {};
    var row = [
      new Date(),
      String(data.lang || '').toUpperCase(),
      a.name || '',
      a.shop || '',
      a.cemail || '',
      a.cphone || '',
      a.callChoice === 'yes' ? 'ano' : (a.callChoice === 'no' ? 'ne' : ''),
      a.cconsent ? 'ano' : '',
      data.text || '',
      JSON.stringify(a)
    ].map(clean_);

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = getSheet_();
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
  return json_({ ok: true, service: 'favi-survey-endpoint' });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

// Ochrana proti vložení vzorce (=, +, -, @) a příliš dlouhému textu
function clean_(v) {
  if (v instanceof Date) return v;
  var s = String(v);
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
        answers: { name: 'TEST Lukáš', shop: 'test-shop.cz', cemail: 'test@example.com', callChoice: 'no' },
        text: 'Testovací odpověď – smazat',
        hp: ''
      })
    }
  };
  var res = doPost(fake);
  console.log(res.getContent());
}
