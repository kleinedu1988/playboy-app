// Úvodní obrazovka – kruh profilovek (návrh A). Patří do frontend/public/ a načítá se obyčejným <script> hned
// za <div id="uvod"> (před balíkem programu): CSP „script-src 'self'“ inline skript nepustí, soubor ano.
// Profilovky jsou z minulého běhu (localStorage „uvodProfilovky“, ukládá je ui/uvod.js po načtení modelek);
// při prvním spuštění nebo s prázdným seznamem zůstane ikona z index.html.
// Záznam: { u: adresa titulní fotky, x: coverX, y: coverY, z: coverZoom }.
(function () {
    'use strict';
    var MIST = 12;          // míst na válci (po 30°), musí sedět s @keyframes kruh-otacet
    var NEJMENE = 4;        // s menším počtem fotek kruh nedává smysl – zůstane ikona
    var uvod = document.getElementById('uvod');
    if (!uvod) return;

    var seznam;
    try { seznam = JSON.parse(localStorage.getItem('uvodProfilovky') || '[]'); } catch (e) { return; }
    if (!Array.isArray(seznam)) return;
    seznam = seznam.filter(function (p) { return p && typeof p.u === 'string' && p.u.length < 2048 && /^(https?:|\.?\/)/.test(p.u); });
    if (seznam.length < NEJMENE) return;

    // Při každém spuštění jiné pořadí (Fisher–Yates)
    for (var i = seznam.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = seznam[i]; seznam[i] = seznam[j]; seznam[j] = t;
    }

    var cislo = function (h, vychozi, od, po) { h = Number(h); return isFinite(h) ? Math.min(Math.max(h, od), po) : vychozi; };
    var nacteno = function () { this.classList.add('nacteno'); };
    // Fotka, která se nenačte (od minula smazaná nebo nedostupná): karta dostane jinou ze seznamu; když se nenačte
    // žádná, vrátí se místo kruhu ikona (šedé dlaždice by se točily naprázdno)
    var vadne = {};
    var pocetVadnych = 0;
    var chyba = function () {
        var img = this;
        if (!vadne[img.src]) { vadne[img.src] = true; pocetVadnych++; }
        if (pocetVadnych >= seznam.length) { vratitIkonu(); return; }
        for (var n = 0; n < seznam.length; n++) {
            var dalsi = seznam[(Number(img.dataset.poradi) + 1 + n) % seznam.length];
            if (!vadne[new URL(dalsi.u, location.href).href]) {
                img.dataset.poradi = String(seznam.indexOf(dalsi));
                img.style.setProperty('--x', cislo(dalsi.x, 50, 0, 100) + '%');
                img.style.setProperty('--y', cislo(dalsi.y, 50, 0, 100) + '%');
                img.style.setProperty('--z', String(cislo(dalsi.z, 1, 1, 4)));
                img.src = dalsi.u;
                return;
            }
        }
        img.remove();   // zůstane tmavý zástupce karty
    };

    var scena = document.createElement('div');
    scena.className = 'uvod-kruh';
    scena.setAttribute('aria-hidden', 'true');
    var kruh = document.createElement('div');
    kruh.className = 'kruh';
    scena.appendChild(kruh);

    for (var k = 0; k < MIST; k++) {
        // Méně fotek než míst: opakují se (v zamíchaném pořadí, sousedé se neopakují, je-li jich aspoň 4)
        var p = seznam[k % seznam.length];
        var karta = document.createElement('div');
        karta.className = 'kruh-karta';
        // Poloha ve statické řadě (prefers-reduced-motion): -2…2 kolem prostřední, ostatní se skryjí
        var poloha = k <= MIST / 2 ? k : k - MIST;
        poloha = -poloha; // karta 0 uprostřed, 1 vpravo… stejně jako na válci
        karta.style.setProperty('--i', String(k));
        karta.style.setProperty('--p', String(poloha));
        karta.style.setProperty('--a', String(Math.abs(poloha)));
        if (Math.abs(poloha) > 2) karta.classList.add('mimo');

        var img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.decoding = 'async';
        img.style.setProperty('--x', cislo(p.x, 50, 0, 100) + '%');
        img.style.setProperty('--y', cislo(p.y, 50, 0, 100) + '%');
        img.style.setProperty('--z', String(cislo(p.z, 1, 1, 4)));
        img.dataset.poradi = String(k % seznam.length);
        img.addEventListener('load', nacteno);
        img.addEventListener('error', chyba);
        img.src = p.u;
        karta.appendChild(img);
        kruh.appendChild(karta);
    }

    var ikona = uvod.querySelector('.uvod-ikona');
    var vratitIkonu = function () {
        if (!scena.parentNode) return;
        if (ikona) scena.parentNode.replaceChild(ikona, scena); else scena.remove();
        uvod.classList.remove('s-kruhem');
        try { localStorage.removeItem('uvodProfilovky'); } catch (e) { /* příště se vybere znovu */ }
    };
    if (ikona) uvod.replaceChild(scena, ikona); else uvod.insertBefore(scena, uvod.firstChild);
    uvod.classList.add('s-kruhem');
})();
