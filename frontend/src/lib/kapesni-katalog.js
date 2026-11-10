// Kapesní katalog offline (app/kapesni-katalog.js, kapesni_katalog.go): z podkladů čísel složí seznam podle rozsahu
// a jednu samostatnou stránku index.html pro prohlížeč telefonu – bez sítě, bez knihoven, data jako JSON uvnitř.
// Česká edice (výtisky) má i čísla, která ve sbírce chybí, aby šlo na burze zjistit „mám / sháním / chybí“.
import { EDICE, RADY_EDIC, cisloNevyslo, nazevVydani, rozlozitVydani, sklonovat, slozitVydani } from './format.js';

export const ROZSAHY = [
    ['vse', 'Celá sbírka', 'Všechna čísla s daty a celá česká edice'],
    ['cz', 'Jen česká edice', 'Všechna čísla české edice od 07/2011, i chybějící'],
    ['shanim', 'Jen sháněná čísla', 'Čísla označená „sháním“'],
];

const STAVY = { mam: 'mám', shanim: 'sháním', nezajima: 'nezajímá' };

/** Měsíční čísla edice od začátku řady do měsíce dnes (RRRR-MM) */
function cislaRady(edice, dnes) {
    const rada = RADY_EDIC[edice];
    if (!rada) return [];
    const konec = rada.do && rada.do < dnes ? rada.do : dnes;
    const v = [];
    let [r, m] = rada.od.split('-').map(Number);
    for (;;) {
        const mesic = `${r}-${String(m).padStart(2, '0')}`;
        if (mesic > konec) break;
        const klic = slozitVydani(String(r), String(m).padStart(2, '0'), edice);
        if (!cisloNevyslo(klic)) v.push(klic);
        m++;
        if (m > 12) { m = 1; r++; }
    }
    return v;
}

/**
 * Položky katalogu podle rozsahu, seřazené po edicích (česká první) a vydáních
 * @param {any[]} podklady GetPodkladyKatalogu
 * @param {string} rozsah vse / cz / shanim
 * @param {string} dnes RRRR-MM
 */
export function polozkyKatalogu(podklady, rozsah, dnes) {
    const podle = new Map(podklady.map(p => [p.vydani, p]));
    if (rozsah !== 'shanim') for (const klic of cislaRady('CZ', dnes)) if (!podle.has(klic)) podle.set(klic, { vydani: klic, playmate: [], obalka: [], dalsi: [], stav: '', driveId: '' });
    const polozky = [];
    for (const p of podle.values()) {
        const v = rozlozitVydani(p.vydani);
        if (!v) continue;
        if (rozsah === 'cz' && v.edice !== 'CZ') continue;
        if (rozsah === 'shanim' && p.stav !== 'shanim') continue;
        const obalka = [...(p.obalka || [])];
        if (p.naObalce && !obalka.includes(p.naObalce)) obalka.push(p.naObalce);
        const maData = Boolean(p.driveId || p.playmate?.length || p.dalsi?.length || obalka.length);
        polozky.push({
            v: p.vydani, n: nazevVydani(p.vydani) + (p.nazev ? ` · ${p.nazev}` : ''), e: v.edice, r: parseInt(v.rok),
            s: STAVY[p.stav] || (v.edice === 'CZ' ? 'chybí' : ''), d: maData ? 1 : 0,
            pm: p.playmate || [], ob: obalka.filter(j => !(p.playmate || []).includes(j)), da: (p.dalsi || []).filter(j => !(p.playmate || []).includes(j)),
            f: p.driveId || '',
        });
    }
    const poradiEdice = e => (e === 'CZ' ? -1 : EDICE.indexOf(e));
    return polozky.sort((a, b) => poradiEdice(a.e) - poradiEdice(b.e) || a.v.localeCompare(b.v));
}

/** Souhrn pro okno: kolik čísel, kolik mám / sháním / chybí */
export function souhrnKatalogu(polozky) {
    const s = { cisel: polozky.length, mam: 0, shanim: 0, chybi: 0 };
    for (const p of polozky) {
        if (p.s === 'mám') s.mam++;
        else if (p.s === 'sháním') s.shanim++;
        else if (p.s === 'chybí') s.chybi++;
    }
    return s;
}

const escHtml = t => String(t).replace(/[&<>"']/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[z]);

/**
 * Samostatná stránka katalogu. Data jsou v <script type="application/json"> (bez „<“, aby text nic neuzavřel);
 * náhledy z vedlejší složky n/<id>.jpg, chybějící se schovají.
 * @param {ReturnType<typeof polozkyKatalogu>} polozky
 * @param {{ vytvoreno: string, rozsah: string }} o
 */
export function htmlKatalogu(polozky, { vytvoreno, rozsah }) {
    const nazevRozsahu = ROZSAHY.find(([k]) => k === rozsah)?.[1] || '';
    const data = JSON.stringify(polozky).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Playboy · kapesní katalog</title>
<style>
:root { --bg: #0f0f12; --karta: #18181c; --text: #f0f0f5; --tlum: #9a9a9e; --cara: #2a2a30; --akcent: #d81b60; --akcent-text: #ff4081; --mam: #4caf50; color-scheme: dark; }
@media (prefers-color-scheme: light) { :root { --bg: #f6f6f8; --karta: #fff; --text: #17171a; --tlum: #66666c; --cara: #e2e2e6; --akcent-text: #ad1457; --mam: #2e7d32; color-scheme: light; } }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); }
header { position: sticky; top: 0; z-index: 1; padding: 12px 16px 10px; background: var(--bg); border-bottom: 1px solid var(--cara); }
h1 { margin: 0 0 2px; font-size: 18px; }
.pod { margin: 0 0 10px; font-size: 12px; color: var(--tlum); }
input[type=search] { width: 100%; padding: 10px 12px; font-size: 16px; border-radius: 10px; border: 1px solid var(--cara); background: var(--karta); color: var(--text); }
.filtry { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.filtry button { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--cara); background: var(--karta); color: var(--text); font-size: 13px; }
.filtry button[aria-pressed=true] { background: var(--akcent); border-color: var(--akcent); color: #fff; }
main { padding: 8px 16px 40px; }
h2 { margin: 18px 0 6px; font-size: 13px; color: var(--tlum); text-transform: uppercase; letter-spacing: .04em; }
.c { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--cara); }
.c img, .c .bez { flex: none; width: 44px; height: 58px; object-fit: cover; border-radius: 4px; background: var(--karta); }
.c div { min-width: 0; flex: 1; }
.c b { display: block; font-weight: 600; }
.c small { display: block; color: var(--tlum); font-size: 13px; overflow-wrap: anywhere; }
.s { flex: none; font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--cara); color: var(--tlum); }
.s.mam { color: var(--mam); border-color: var(--mam); }
.s.shanim { color: var(--akcent-text); border-color: var(--akcent-text); }
.prazdno { color: var(--tlum); padding: 24px 0; text-align: center; }
</style></head>
<body>
<header>
<h1>Playboy · kapesní katalog</h1>
<p class="pod">${escHtml(nazevRozsahu)} · ${sklonovat(polozky.length, 'číslo', 'čísla', 'čísel')} · vytvořeno ${escHtml(vytvoreno)}</p>
<input type="search" id="hledat" placeholder="Hledat jméno, rok nebo číslo (06/1995)…" autocomplete="off">
<div class="filtry" role="group" aria-label="Stav">
<button type="button" data-f="" aria-pressed="true">Vše</button><button type="button" data-f="mám" aria-pressed="false">Mám</button><button type="button" data-f="sháním" aria-pressed="false">Sháním</button><button type="button" data-f="chybí" aria-pressed="false">Chybí</button>
</div>
</header>
<main id="seznam"></main>
<script type="application/json" id="data">${data}</script>
<script>
(function () {
  var cisla = JSON.parse(document.getElementById('data').textContent);
  var bez = function (t) { return String(t).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); };
  var esc = function (t) { return String(t).replace(/[&<>"']/g, function (z) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]; }); };
  cisla.forEach(function (c) {
    var mm = (/^\\d{4}-(\\d\\d)/.exec(c.v) || [])[1];
    c.h = bez([c.n, c.v, mm ? mm + '/' + c.r : '', c.pm.join(' '), c.ob.join(' '), c.da.join(' '), c.s].join(' '));
  });
  var stav = '', seznam = document.getElementById('seznam'), pole = document.getElementById('hledat');
  function radek(c) {
    var jmena = [];
    if (c.pm.length) jmena.push('Playmate: ' + c.pm.join(', '));
    if (c.ob.length) jmena.push('Obálka: ' + c.ob.join(', '));
    if (c.da.length) jmena.push(c.da.join(', '));
    var obr = c.f ? '<img src="n/' + esc(c.f) + '.jpg" alt="" loading="lazy" onerror="this.outerHTML=\\'<span class=bez></span>\\'">' : '<span class="bez"></span>';
    var tr = c.s === 'mám' ? 'mam' : c.s === 'sháním' ? 'shanim' : '';
    return '<div class="c">' + obr + '<div><b>' + esc(c.n) + '</b>' + (jmena.length ? '<small>' + esc(jmena.join(' · ')) + '</small>' : '') + '</div>' + (c.s ? '<span class="s ' + tr + '">' + esc(c.s) + '</span>' : '') + '</div>';
  }
  function vykreslit() {
    var slova = bez(pole.value).split(/\\s+/).filter(Boolean);
    var html = '', skupina = '', n = 0;
    for (var i = 0; i < cisla.length; i++) {
      var c = cisla[i];
      if (stav && c.s !== stav) continue;
      if (slova.some(function (s) { return c.h.indexOf(s) < 0; })) continue;
      if (n++ >= 600) continue;
      var g = (c.e === 'CZ' ? 'Česká edice' : 'Americká edice') + ' · ' + c.r;
      if (g !== skupina) { html += '<h2>' + esc(g) + '</h2>'; skupina = g; }
      html += radek(c);
    }
    if (n > 600) html += '<p class="prazdno">a další ' + (n - 600) + ' – upřesni hledání</p>';
    seznam.innerHTML = n ? html : '<p class="prazdno">Nic nenalezeno.</p>';
  }
  pole.addEventListener('input', vykreslit);
  document.querySelector('.filtry').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    stav = b.getAttribute('data-f');
    this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    vykreslit();
  });
  vykreslit();
})();
</script>
</body></html>
`;
}
