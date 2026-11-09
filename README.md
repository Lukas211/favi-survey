# favi-survey

Partner dashboard questionnaire for favionline.com.

Dotazník pro klienty FAVI k novému partner dashboardu. Stránka běží na
favionline.com (Webflow), kód dotazníku se načítá z tohoto repa přes jsDelivr
a odpovědi se ukládají do Google Sheetu přes Google Apps Script.

## Obsah repa
- `survey.js` – dotazník (CZ / SK / EN) + odesílání odpovědí do Apps Scriptu
- `survey.css` – styly, všechny zúžené pod třídu `.favi-survey`
  (nekolidují se styly Webflow)
- `fonts/` – Work Sans (woff2)
- `img/` – snímky původního a nového dashboardu (`old-dashboard.png`,
  `new-dashboard.png`) – jen anonymizované, repo je veřejné
- `apps-script/Code.gs` – záloha kódu Apps Scriptu `favi-survey-endpoint`
  (skutečný kód běží v Google tabulce „Partner dashboard – dotazník – odpovědi“)

## Vložení do Webflow (Code Embed)
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/Lukas211/favi-survey@v1/survey.css">
<div class="favi-survey" id="favi-survey"></div>
<script src="https://cdn.jsdelivr.net/gh/Lukas211/favi-survey@v1/survey.js"></script>
```

## Vydání nové verze
1. Upravit soubory, commit + push.
2. Nový tag: `git tag v2 && git push origin v2`.
3. Ve Webflow v Code Embedu změnit `@v1` na `@v2` a publikovat web.

Soubory z větve `main` jsDelivr dlouho cachuje, změny by se neprojevily hned –
proto se vždy odkazuje na konkrétní tag.

## Apps Script
- Odpovědi se posílají jako POST (Content-Type `text/plain`, `mode: no-cors`).
- Po změně `Code.gs`: Nasadit → Spravovat nasazení → tužka → Verze: Nová verze
  (URL zůstane stejná). Nikdy ne „Nové nasazení“ – vznikla by nová URL.
- Bez připojení se odpověď uloží v prohlížeči (`favi-pd-survey-pending`)
  a odešle se při další návštěvě stránky.
