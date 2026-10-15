// Stěna centerfoldů a čísla časopisu
import { GetCenterfoldy, GetCovery, GetKalendar, GetStavyVydani } from './backend';
import { EDICE, bezDiakritiky, esc, nazevAlba, nazevVydani, obrazek, paskaCisla, rozlozitVydani, sjednotit, sklonovat } from '../lib/format';
import { sestavitAlba } from '../lib/alba';
import { stav } from './stav';
import { covers, coversList, searchInput, wall } from './prvky';
import { listaCoveru, listaSteny } from './listy';
import { VELIKOST_PLAKATU_MALA } from './obrazky';
import { ukazatPohled } from './navigace';
import { htmlPlakatu, pripravitPlakat } from './profil';
import { otevritVydani } from './vydani';
import { prevestNaVolby } from '../ui/volby';
import { nastavitEdiciKalendare } from './kalendar';

export async function nacistStenu(dotaz = '', zMezipameti = false) {
    const moje = ++stav.cisloNacteni;
    const fotky = zMezipameti && stav.stenaData ? stav.stenaData : await GetCenterfoldy() || [];
    if (moje !== stav.cisloNacteni) return;
    stav.stenaData = fotky;
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(wall);

    const hledat = sjednotit(dotaz);
    const vyhovuje = f => !hledat || [f.jmenoModelky, f.album, nazevAlba(f.album, f.typ)].some(t => bezDiakritiky(t).includes(hledat));
    stav.stenaPolozky = sestavitAlba(fotky.filter(vyhovuje)).flatMap(a => a.polozky);
    // Chronologicky: podle vydání (rok, měsíc, edice) jako časová osa, s lištou desetiletí
    const klicVydani = p => { const v = rozlozitVydani(p.album); return v ? `${v.rok}${v.mesic}${v.edice}` : '9999'; };
    if (stav.stenaChronologicky) stav.stenaPolozky.sort((x, y) => klicVydani(x).localeCompare(klicVydani(y)));

    const razeni = `<div class="wall-toolbar">
        <button class="chip ${stav.stenaChronologicky ? '' : 'active'}" data-razeni-steny="jmeno">Podle jména</button>
        <button class="chip ${stav.stenaChronologicky ? 'active' : ''}" data-razeni-steny="vydani">Podle vydání</button></div>`;
    if (stav.stenaPolozky.length === 0) {
        listaSteny.naplnit([]);
        wall.innerHTML = razeni + `<div class="empty-state">${fotky.length ? 'Hledání neodpovídá žádný centerfold.' : 'Zatím žádné centerfoldy. Přidej je tlačítkem + nahoře.'}</div>`;
        prevestNaVolby(wall.querySelector('.wall-toolbar'));
        return;
    }

    // Centerfold jako tisk v lehkém rámu: páska vydání přes rám, pod rámem jméno a vydání
    const htmlPolozky = (p, i) => `
        <figure class="wall-item" tabindex="0" data-index="${i}">
            <div class="wall-ram">
                ${htmlPlakatu(p, VELIKOST_PLAKATU_MALA, '', true)}
                ${paskaCisla(p.album) ? `<span class="wall-paska">${esc(paskaCisla(p.album))}</span>` : ''}
            </div>
            <figcaption>
                <strong>${esc(p.jmenoModelky)}</strong>
                <span>${esc(nazevAlba(p.album, p.typ))}</span>
            </figcaption>
        </figure>`;

    // Podle vydání: desetiletí jako oddíly s velkým tenkým nadpisem (jako roky v Kalendáři), lišta na ně skáče
    const dekady = new Map();
    if (stav.stenaChronologicky) {
        stav.stenaPolozky.forEach((p, i) => {
            const rok = parseInt(rozlozitVydani(p.album)?.rok);
            const dekada = rok ? Math.floor(rok / 10) * 10 : 0;
            if (!dekady.has(dekada)) dekady.set(dekada, []);
            dekady.get(dekada).push(i);
        });
    }
    wall.innerHTML = razeni + (stav.stenaChronologicky
        ? [...dekady].map(([dekada, indexy]) => `
            <section class="wall-dekada" data-cast="${dekada}">
                <h3>${dekada ? `${dekada}–${dekada + 9}` : 'Bez vydání'}<small>${sklonovat(indexy.length, 'centerfold', 'centerfoldy', 'centerfoldů')}</small></h3>
                <div class="wall-mrizka">${indexy.map(i => htmlPolozky(stav.stenaPolozky[i], i)).join('')}</div>
            </section>`).join('')
        : `<div class="wall-mrizka">${stav.stenaPolozky.map(htmlPolozky).join('')}</div>`);
    prevestNaVolby(wall.querySelector('.wall-toolbar'));
    listaSteny.naplnit([...dekady].filter(([dekada]) => dekada).map(([dekada, indexy]) => ({ klic: dekada, nazev: `${dekada}–${dekada + 9}`, pocet: indexy.length })));
    listaSteny.sledovat();
    wall.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
}

// Čísla časopisu: každé číslo, ke kterému je ve sbírce cover, centerfold nebo pictorial, jako výtisk s páskou
// měsíce; bez coveru ztlumený náhled. Chybějící čísla označená „sháním“ nebo „mám výtisk“ jako prázdná dlaždice.
const ZOBRAZIT_CISLA = { vse: 'vše', cover: 's coverem', bezCoveru: 'bez coveru', chybi: 'chybějící' };
// Pořadí v roce: měsíce, speciály, celý ročník
const poradiVRoce = v => !v.mesic ? 'Z' : v.mesic.startsWith('S') ? `T${v.mesic}` : v.mesic;

export async function nacistCovery(dotaz = '', zMezipameti = false) {
    const moje = ++stav.cisloNacteni;
    const [kalendar, stavy, coveryFotky] = zMezipameti && stav.coveryData ? stav.coveryData
        : await Promise.all([GetKalendar().then(k => k || []), GetStavyVydani().then(s => s || []), GetCovery().then(c => c || [])]);
    if (moje !== stav.cisloNacteni) return;
    stav.coveryData = [kalendar, stavy, coveryFotky];
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(covers);

    // Covery jako položky (pro prohlížeč a nabídku Upravit / Smazat cover) podle vydání
    stav.coveryPolozky = sestavitAlba(coveryFotky).flatMap(a => a.polozky);
    const coverVydani = new Map(stav.coveryPolozky.map((p, i) => [p.album, i]));
    const stavCisla = new Map(stavy.map(s => [s.vydani, s]));

    // Čísla zvolené edice; chybějící jen ta označená
    const cisla = kalendar.map(k => ({ ...k, casti: rozlozitVydani(k.vydani) })).filter(k => k.casti?.edice === stav.kalendarEdice);
    const zname = new Set(cisla.map(k => k.vydani));
    stavy.forEach(s => {
        const casti = rozlozitVydani(s.vydani);
        if ((s.stav === 'shanim' || s.stav === 'mam') && casti?.edice === stav.kalendarEdice && !zname.has(s.vydani)) {
            cisla.push({ vydani: s.vydani, casti, chybi: true });
        }
    });

    const hledat = sjednotit(dotaz);
    const vyhovuje = k => {
        if (stav.cislaZobrazit === 'cover' && !k.cover) return false;
        if (stav.cislaZobrazit === 'bezCoveru' && (k.cover || k.chybi)) return false;
        if (stav.cislaZobrazit === 'chybi' && !k.chybi) return false;
        return !hledat || [k.vydani, nazevVydani(k.vydani), k.modelka || '', stavCisla.get(k.vydani)?.naObalce || ''].some(t => bezDiakritiky(t).includes(hledat));
    };
    const vybrana = cisla.filter(vyhovuje);

    const volby = `<div class="cisla-volby">
        ${EDICE.map(e => `<button class="chip ${e === stav.kalendarEdice ? 'active' : ''}" data-edice-cisel="${e}">${e}</button>`).join('')}
        ${Object.entries(ZOBRAZIT_CISLA).map(([klic, nazev]) => `<button class="chip ${klic === stav.cislaZobrazit ? 'active' : ''}" data-zobrazit-cisla="${klic}">${nazev}</button>`).join('')}
        <span>${stav.cislaZobrazit === 'chybi' ? sklonovat(vybrana.length, 'chybějící číslo', 'chybějící čísla', 'chybějících čísel') : sklonovat(vybrana.filter(k => !k.chybi).length, 'číslo', 'čísla', 'čísel')}</span></div>`;

    if (vybrana.length === 0) {
        listaCoveru.naplnit([]);
        coversList.innerHTML = volby + `<div class="empty-state">${cisla.length ? 'Hledání ani volbě neodpovídá žádné číslo.' : `V edici ${stav.kalendarEdice} zatím nic není. Čísla se naplní covery, centerfoldy a pictorialy s vydáním.`}</div>`;
        prevestNaVolby(coversList.querySelector('.cisla-volby'));
        return;
    }

    const rocniky = new Map();
    vybrana.sort((a, b) => b.casti.rok.localeCompare(a.casti.rok) || poradiVRoce(a.casti).localeCompare(poradiVRoce(b.casti)))
        .forEach(k => {
            if (!rocniky.has(k.casti.rok)) rocniky.set(k.casti.rok, []);
            rocniky.get(k.casti.rok).push(k);
        });

    const dlazdice = k => {
        const s = stavCisla.get(k.vydani)?.stav;
        const stitek = s === 'mam' ? '<span class="cislo-stav">výtisk</span>' : s === 'shanim' ? '<span class="cislo-stav shanim">sháním</span>' : '';
        const paska = `<span class="cislo-paska">${esc(paskaCisla(k.vydani))}</span>`;
        const index = coverVydani.has(k.vydani) ? `data-cover="${coverVydani.get(k.vydani)}"` : '';
        const kdo = k.modelka || stavCisla.get(k.vydani)?.naObalce || '';
        return `
            <figure class="cislo ${k.chybi ? 'chybi' : ''}" tabindex="0" data-vydani="${esc(k.vydani)}" ${index} title="${esc(nazevVydani(k.vydani))}">
                <div class="cislo-obalka ${k.cover || k.chybi ? '' : 'bez-coveru'}">
                    ${paska}${stitek}
                    ${k.chybi ? '<span class="cislo-chybi">Ve sbírce chybí</span>'
                        : `<img src="${esc(obrazek(k.nahled, VELIKOST_PLAKATU_MALA))}" alt="" loading="lazy" draggable="false" />${k.cover ? '' : '<span class="cislo-znacka">bez coveru</span>'}`}
                </div>
                <figcaption>${kdo ? esc(kdo) : '&nbsp;'}</figcaption>
            </figure>`;
    };

    listaCoveru.naplnit([...rocniky].map(([rok, l]) => ({ klic: rok, nazev: rok, pocet: l.filter(k => !k.chybi).length })));
    coversList.innerHTML = volby + [...rocniky].map(([rok, l]) => {
        const mesicnich = l.filter(k => !k.chybi && /^\d\d$/.test(k.casti.mesic)).length;
        return `
            <section class="rocnik-cisel" data-cast="${esc(rok)}">
                <h3>${esc(rok)}${mesicnich ? `<small>${mesicnich} z 12</small>` : ''}</h3>
                <div class="cisla-mrizka">${l.map(dlazdice).join('')}</div>
            </section>`;
    }).join('');
    prevestNaVolby(coversList.querySelector('.cisla-volby'));
    listaCoveru.sledovat();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    try { stav.stenaChronologicky = localStorage.getItem('stenaChronologicky') === '1'; } catch { /* podle jména */ }
    try { stav.cislaZobrazit = ZOBRAZIT_CISLA[localStorage.getItem('cislaZobrazit')] ? localStorage.getItem('cislaZobrazit') : 'vse'; } catch { /* vše */ }

    wall.addEventListener('click', (e) => {
        const razeni = e.target.closest('[data-razeni-steny]');
        if (!razeni) return;
        e.stopPropagation();
        stav.stenaChronologicky = razeni.dataset.razeniSteny === 'vydani';
        try { localStorage.setItem('stenaChronologicky', stav.stenaChronologicky ? '1' : ''); } catch { /* jen se nezapamatuje */ }
        nacistStenu(searchInput.value, true);
    }, true);

    covers.addEventListener('click', (e) => {
        const edice = e.target.closest('[data-edice-cisel]');
        const zobrazit = e.target.closest('[data-zobrazit-cisla]');
        if (edice) {
            nastavitEdiciKalendare(edice.dataset.ediceCisel);
            nacistCovery(searchInput.value, true);
        } else if (zobrazit) {
            stav.cislaZobrazit = zobrazit.dataset.zobrazitCisla;
            try { localStorage.setItem('cislaZobrazit', stav.cislaZobrazit); } catch { /* jen se nezapamatuje */ }
            nacistCovery(searchInput.value, true);
        } else {
            const cislo = e.target.closest('.cislo');
            if (cislo) otevritVydani(cislo.dataset.vydani);
        }
    });
}
