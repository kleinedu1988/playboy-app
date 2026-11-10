// Stěna centerfoldů a čísla časopisu
import { GetCenterfoldy, GetCovery, GetKalendar, GetStavyVydani } from './backend';
import { moznostiSteny, naSteneCenterfoldu, bezDiakritiky, ciselRocniku, cisloNevyslo, esc, htmlVarovaniHledani, nazevAlba, nepouziteKlice, nazevVydani, obrazek, paskaCisla, plocheTokeny, poleCisla, poleFotky, poleModelkyFotky, rozlozitDotaz, rozlozitVydani, sjednotit, sklonovat, vyhovujeHledani } from '../lib/format';
import { sestavitAlba } from '../lib/alba';
import { rozbalitFrontu } from '../lib/fronta';
import { stav } from './stav';
import { htmlStitkuRad, nazevVolbyRady } from './rady';
import { covers, coversList, searchInput, wall } from './prvky';
import { listaCoveru, listaSteny } from './listy';
import { VELIKOST_PLAKATU_MALA, VELIKOST_TITULNI, VELIKOST_ZAHLAVI, nacitatPostupne, sledovatDalsi } from './obrazky';
import { htmlZobrazeniCisel, ukazatPohled } from './navigace';
import { htmlPlakatu, pripravitPlakat } from './profil';
import { otevritVydani } from './vydani';
import { prevestNaVolby } from '../ui/volby';
import { nacistPlnouObalku, nastavitEdiciKalendare } from './kalendar';
import { poctyObalek, poradiObalekHero } from '../lib/hero-obalek';
import { predLety } from '../lib/hero-kalendare';
import { htmlNicNenalezeno, htmlPrazdna } from '../ui/prazdno';
import { modelkyPodleId, oblibenostModelek } from './mezipamet';
import { prevest } from '../lib/hledani-dotaz';
import { porovnatFotkyPodleHodnoty } from '../lib/oblibenost';

const RAZENI_STENY = {
    jmeno: 'Podle jména',
    vydani: 'Od nejstarších',
    nejnovejsi: 'Od nejnovějších',
    hodnoceni: 'Podle srdíček',
};

export async function nacistStenu(dotaz = '', zMezipameti = false) {
    const moje = ++stav.cisloNacteni;
    const fotky = zMezipameti && stav.stenaData ? stav.stenaData : rozbalitFrontu(await GetCenterfoldy());
    const oblibenost = stav.razeniSteny === 'hodnoceni' ? await oblibenostModelek().catch(() => new Map()) : new Map();
    if (moje !== stav.cisloNacteni) return;
    stav.stenaData = fotky;
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(wall);

    const tokeny = rozlozitDotaz(prevest(dotaz));
    // Příkazy vzhledu a měr (vlasy:blond, vyska:>175) se posuzují podle modelky fotky
    const katalog = plocheTokeny(tokeny).some(t => t.klic && !(t.klic in poleFotky({}))) ? await modelkyPodleId() : null;
    if (moje !== stav.cisloNacteni) return;
    const poleSModelkou = f => ({ ...poleModelkyFotky(katalog?.get(f.modelkaId) || (katalog ? {} : null)), ...poleFotky(f) });
    const vyhovuje = f => {
        if (!naSteneCenterfoldu(f.album, stav.stenaEdice)) return false;
        return vyhovujeHledani([
            f.jmenoModelky,
            f.album,
            nazevAlba(f.album, f.typ),
            f.fotograf || '',
            f.popis || '',
        ], tokeny, poleSModelkou(f));
    };
    stav.stenaPolozky = sestavitAlba(fotky.filter(vyhovuje)).flatMap(a => a.polozky).filter(p => {
        if (stav.stenaMin === -1) return !p.hodnoceni;
        if (stav.stenaMin > 0) return (p.hodnoceni || 0) >= stav.stenaMin;
        return true;
    });
    // Chronologicky (od nejstarších či nejnovějších) nebo podle srdíček
    if (stav.razeniSteny === 'vydani') {
        const klicVydani = p => { const v = rozlozitVydani(p.album); return v ? `${v.rok}${v.mesic}${v.edice}` : '9999'; };
        stav.stenaPolozky.sort((x, y) => klicVydani(x).localeCompare(klicVydani(y)));
    } else if (stav.razeniSteny === 'nejnovejsi') {
        const klicVydani = p => { const v = rozlozitVydani(p.album); return v ? `${v.rok}${v.mesic}${v.edice}` : '0000'; };
        stav.stenaPolozky.sort((x, y) => klicVydani(y).localeCompare(klicVydani(x)));
    } else if (stav.razeniSteny === 'hodnoceni') {
        // Podle hodnoty fotky: srdíčka fotky × oblíbenost modelky (pětka slabší modelky je níž než pětka oblíbené)
        stav.stenaPolozky.sort(porovnatFotkyPodleHodnoty(oblibenost));
    }

    const razeni = `<div class="wall-toolbar">
        ${Object.entries(RAZENI_STENY).map(([klic, nazev]) => `<button class="chip ${stav.razeniSteny === klic ? 'active' : ''}" data-razeni-steny="${klic}">${nazev}</button>`).join('')}
        ${[1, 2, 3, 4, 5].map(n => `<button class="chip ${stav.stenaMin === n ? 'active' : ''}" data-stena-min="${n}">&#9829; ${n}${n < 5 ? '+' : ''}</button>`).join('')}
        <button class="chip ${stav.stenaMin === -1 ? 'active' : ''}" data-stena-min="-1">Bez &#9829;</button>
        ${moznostiSteny().map(m => `<button class="chip ${stav.stenaEdice === m.hodnota ? 'active' : ''}" data-edice-steny="${esc(m.hodnota)}">${esc(m.nazev)}</button>`).join('')}
        ${htmlVarovaniHledani(nepouziteKlice(tokeny, { ...poleModelkyFotky({}), ...poleFotky({}) }))}
        <span>${sklonovat(stav.stenaPolozky.length, 'centerfold', 'centerfoldy', 'centerfoldů')}</span></div>`;
    if (stav.stenaPolozky.length === 0) {
        listaSteny.naplnit([]);
        wall.innerHTML = razeni + (fotky.length ? htmlNicNenalezeno('Hledání ani filtrům neodpovídá žádný centerfold.')
            : htmlPrazdna('Zatím žádné centerfoldy', 'Centerfoldy modelek se tu seřadí jako stěna plakátů. Přidávají se tlačítkem + nahoře.', { tlacitko: { text: 'Přidat…', akce: 'pridat' } }));
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
    const maDekady = stav.razeniSteny === 'vydani' || stav.razeniSteny === 'nejnovejsi';
    const dekady = new Map();
    if (maDekady) {
        stav.stenaPolozky.forEach((p, i) => {
            const rok = parseInt(rozlozitVydani(p.album)?.rok);
            const dekada = rok ? Math.floor(rok / 10) * 10 : 0;
            if (!dekady.has(dekada)) dekady.set(dekada, []);
            dekady.get(dekada).push(i);
        });
    }
    // Mřížky (oddíl desetiletí, nebo jedna) se sestaví prázdné a plní po dávkách: prvních PLAKATU_HNED hned,
    // zbytek v dalších úlohách (dřív se stěna s tisíci centerfoldy skládala najednou přes sekundu)
    const skupiny = maDekady ? [...dekady] : [[null, stav.stenaPolozky.map((_, i) => i)]];
    wall.innerHTML = razeni + skupiny.map(([dekada, indexy]) => dekada === null
        ? '<div class="wall-mrizka"></div>'
        : `<section class="wall-dekada" data-cast="${dekada}">
                <h3>${dekada ? `${dekada}–${dekada + 9}` : 'Bez vydání'}<small>${sklonovat(indexy.length, 'centerfold', 'centerfoldy', 'centerfoldů')}</small></h3>
                <div class="wall-mrizka"></div>
            </section>`).join('');
    prevestNaVolby(wall.querySelector('.wall-toolbar'));
    const mrizky = [...wall.querySelectorAll('.wall-mrizka')];
    dokresleniSteny = { moje, html: htmlPolozky, fronta: skupiny.flatMap(([, indexy], j) => indexy.map(i => [j, i])), mrizky, od: 0 };
    nacitatPostupne(wall);
    pridatDavkuSteny(PLAKATU_HNED);
    naplanovatDavkuSteny();
    listaSteny.naplnit([...dekady].filter(([dekada]) => dekada).map(([dekada, indexy]) => ({ klic: dekada, nazev: `${dekada}–${dekada + 9}`, pocet: indexy.length })));
    listaSteny.sledovat();
}

// Dokreslování stěny po dávkách (jako galerie): fronta [mřížka, index položky] v pořadí stránky
const PLAKATU_HNED = 60;
const PLAKATU_V_DAVCE = 150;
/** @type {{ moje: number, html: (p: any, i: number) => string, fronta: number[][], mrizky: Element[], od: number } | null} */
let dokresleniSteny = null;

function pridatDavkuSteny(kolik) {
    const d = dokresleniSteny;
    if (!d || d.moje !== stav.cisloNacteni || !d.mrizky[0]?.isConnected) {
        dokresleniSteny = null;
        return;
    }
    const do_ = Math.min(d.fronta.length, d.od + kolik);
    // Po mřížkách: souvislé úseky jedné mřížky jedním vložením
    let i = d.od;
    while (i < do_) {
        const j = d.fronta[i][0];
        let k = i;
        while (k < do_ && d.fronta[k][0] === j) k++;
        const pred = d.mrizky[j].childElementCount;
        d.mrizky[j].insertAdjacentHTML('beforeend', d.fronta.slice(i, k).map(([, idx]) => d.html(stav.stenaPolozky[idx], idx)).join(''));
        [...d.mrizky[j].children].slice(pred).forEach(f => f.querySelectorAll('.poster').forEach(p => pripravitPlakat(p)));
        sledovatDalsi(wall, d.mrizky[j]);
        i = k;
    }
    d.od = do_;
    if (d.od >= d.fronta.length) dokresleniSteny = null;
}

function naplanovatDavkuSteny() {
    if (!dokresleniSteny) return;
    setTimeout(() => {
        pridatDavkuSteny(PLAKATU_V_DAVCE);
        naplanovatDavkuSteny();
    }, 0);
}

// Stěna celá hned (skok v liště desetiletí, návrat Zpět na místo dole na stránce, fokus na plakátu)
export function dokreslitStenu() {
    if (dokresleniSteny) pridatDavkuSteny(Infinity);
}
listaSteny.dovykreslit = () => dokreslitStenu();

// Čísla časopisu: každé číslo, ke kterému je ve sbírce cover, centerfold nebo pictorial, jako výtisk s páskou
// měsíce; bez coveru ztlumený náhled. Chybějící čísla označená „sháním“ nebo „mám výtisk“ jako prázdná dlaždice.
const ZOBRAZIT_CISLA = { vse: 'vše', cover: 's coverem', bezCoveru: 'bez coveru', chybi: 'chybějící' };
// Pořadí v roce: měsíce, speciály, celý ročník
const poradiVRoce = v => !v.mesic ? 'Z' : v.mesic.startsWith('S') ? `T${v.mesic}` : v.mesic;

// Hero Obálek (0.02.024, jako Kalendář): obálka zvolené řady – výročí čísla, jinak nejlépe hodnocená – s počty
// obálek a akcemi; Další ↻ střídá v pořadí poradiObalekHero, změna řady začne znovu
let posunHeroObalek = 0;
function htmlHeroObalek(coveryFotky, cisla, stavCisla) {
    const poradi = poradiObalekHero(coveryFotky, stav.kalendarEdice);
    if (!poradi.length) return '';
    const o = poradi[((posunHeroObalek % poradi.length) + poradi.length) % poradi.length];
    const p = poctyObalek(cisla.filter(k => !k.chybi), stav.kalendarEdice);
    const k = cisla.find(x => x.vydani === o.vydani);
    // Kdo je na obálce (údaj čísla), jinak centerfold čísla – to nemusí být modelka z obálky
    const kdo = stavCisla.get(o.vydani)?.naObalce || '';
    const leta = new Date().getFullYear() - parseInt(o.vydani.slice(0, 4), 10);
    const vety = [
        o.vyroci ? `Vyšlo ${predLety(leta)}.` : '',
        kdo ? `Na obálce ${kdo}.` : k?.modelka ? `Centerfold ${k.modelka}.` : '',
        o.hodnoceni ? `${'♥'.repeat(o.hodnoceni)}` : '',
        p.chybi ? `V ${sklonovat(p.rocniku, 'rozpracovaném ročníku', 'rozpracovaných ročnících', 'rozpracovaných ročnících')} chybí ${sklonovat(p.chybi, 'obálka', 'obálky', 'obálek')}.` : 'Rozpracované ročníky mají všechny obálky.',
    ].filter(Boolean);
    const nahled = obrazek(o.url, VELIKOST_TITULNI), plna = obrazek(o.url, VELIKOST_ZAHLAVI);
    return `<section class="profily-hero sh-hero kal-hero" aria-label="Obálka ${esc(nazevVydani(o.vydani))}">
        <div class="ph-rozmazane" style="background-image:url('${esc(nahled).replace(/'/g, '%27')}')"></div>
        <div class="sh-scena">
            <div class="ph-ram"><img src="${esc(nahled)}" data-plna="${esc(plna)}" alt="" draggable="false" /></div><div class="ph-prekryv"></div>
            <div class="ph-obsah">
                <div class="ph-nadtitulek">${esc(nazevVolbyRady(stav.kalendarEdice))} · ${o.vyroci ? 'výročí obálky' : o.hodnoceni ? 'nejlépe hodnocené obálky' : 'obálky'}${poradi.length > 1 ? ` · ${((posunHeroObalek % poradi.length) + poradi.length) % poradi.length + 1} z ${poradi.length}` : ''}</div>
                <h2>${esc(nazevVydani(o.vydani))}</h2>
                <div class="sh-zmena">${sklonovat(p.sCoverem, 'obálka', 'obálky', 'obálek')}</div>
                <p class="ph-duvod">${esc(vety.join(' '))}</p>
                <div class="ph-akce">
                    <button type="button" class="ph-tlacitko hlavni" data-vydani="${esc(o.vydani)}">Otevřít číslo</button>
                    ${p.chybi ? '<button type="button" class="ph-tlacitko" data-ho-chybi title="Ukázat jen čísla bez coveru a chybějící">Bez obálky</button>' : ''}
                    ${poradi.length > 1 ? '<button type="button" class="ph-tlacitko" data-ho-dalsi title="Další obálka">Další ↻</button>' : ''}
                </div>
            </div>
        </div>
    </section>`;
}

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

    const tokeny = rozlozitDotaz(prevest(dotaz));
    const vyhovuje = k => {
        if (stav.cislaZobrazit === 'cover' && !k.cover) return false;
        if (stav.cislaZobrazit === 'bezCoveru' && (k.cover || k.chybi)) return false;
        if (stav.cislaZobrazit === 'chybi' && !k.chybi) return false;
        const texty = [
            k.vydani,
            nazevVydani(k.vydani),
            k.modelka || '',
            stavCisla.get(k.vydani)?.naObalce || '',
            stavCisla.get(k.vydani)?.poznamka || '',
        ];
        return vyhovujeHledani(texty, tokeny, poleCisla(k.vydani, k.modelka || ''));
    };
    const vybrana = cisla.filter(vyhovuje);

    const volby = `<div class="cisla-volby">
        ${htmlZobrazeniCisel('obalky')}
        ${htmlStitkuRad('data-edice-cisel')}
        ${Object.entries(ZOBRAZIT_CISLA).map(([klic, nazev]) => `<button class="chip ${klic === stav.cislaZobrazit ? 'active' : ''}" data-zobrazit-cisla="${klic}">${nazev}</button>`).join('')}
        ${htmlVarovaniHledani(nepouziteKlice(tokeny, poleCisla('')))}
        <span>${stav.cislaZobrazit === 'chybi' ? sklonovat(vybrana.length, 'chybějící číslo', 'chybějící čísla', 'chybějících čísel') : sklonovat(vybrana.filter(k => !k.chybi).length, 'číslo', 'čísla', 'čísel')}</span></div>`;

    if (vybrana.length === 0) {
        listaCoveru.naplnit([]);
        coversList.innerHTML = volby + (cisla.length ? htmlNicNenalezeno('Hledání ani filtrům neodpovídá žádné číslo.')
            : htmlPrazdna(`${nazevVolbyRady(stav.kalendarEdice)}: zatím žádné číslo`, 'Čísla se naplní covery, centerfoldy a pictorialy, které mají měsíc a rok vydání.', { ikona: 'kalendar', tlacitko: { text: 'Přidat…', akce: 'pridat' } }));
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
                        : `<img data-src="${esc(obrazek(k.nahled, VELIKOST_PLAKATU_MALA))}" alt="" decoding="async" draggable="false" />${k.cover ? '' : '<span class="cislo-znacka">bez coveru</span>'}`}
                </div>
                <figcaption>${kdo ? esc(kdo) : '&nbsp;'}</figcaption>
            </figure>`;
    };

    listaCoveru.naplnit([...rocniky].map(([rok, l]) => ({ klic: rok, nazev: rok, pocet: l.filter(k => !k.chybi).length })));
    const hero = tokeny.length ? '' : htmlHeroObalek(coveryFotky, cisla, stavCisla);
    coversList.innerHTML = hero + volby + [...rocniky].map(([rok, l]) => {
        const mesicnich = l.filter(k => !k.chybi && /^\d\d$/.test(k.casti.mesic) && !cisloNevyslo(k.vydani)).length;
        return `
            <section class="rocnik-cisel" data-cast="${esc(rok)}">
                <h3>${esc(rok)}${mesicnich ? `<small>${ciselRocniku(rok, stav.kalendarEdice) ? `${mesicnich} z ${ciselRocniku(rok, stav.kalendarEdice)}` : mesicnich}</small>` : ''}</h3>
                <div class="cisla-mrizka">${l.map(dlazdice).join('')}</div>
            </section>`;
    }).join('');
    prevestNaVolby(coversList.querySelector('.cisla-volby'));
    nacistPlnouObalku(coversList);
    nacitatPostupne(coversList);
    listaCoveru.sledovat();
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    try {
        const ulozene = localStorage.getItem('razeniSteny');
        stav.razeniSteny = RAZENI_STENY[ulozene] ? ulozene : (localStorage.getItem('stenaChronologicky') === '1' ? 'vydani' : 'jmeno');
    } catch { /* podle jména */ }
    try { stav.cislaZobrazit = ZOBRAZIT_CISLA[localStorage.getItem('cislaZobrazit')] ? localStorage.getItem('cislaZobrazit') : 'vse'; } catch { /* vše */ }

    wall.addEventListener('click', (e) => {
        const razeni = e.target.closest('[data-razeni-steny]');
        const minimum = e.target.closest('[data-stena-min]');
        const edice = e.target.closest('[data-edice-steny]');
        if (razeni) {
            e.stopPropagation();
            stav.razeniSteny = razeni.dataset.razeniSteny;
            try { localStorage.setItem('razeniSteny', stav.razeniSteny); } catch { /* jen se nezapamatuje */ }
            nacistStenu(searchInput.value, true);
        } else if (minimum) {
            e.stopPropagation();
            const n = Number(minimum.dataset.stenaMin);
            stav.stenaMin = n === stav.stenaMin ? 0 : n;
            nacistStenu(searchInput.value, true);
        } else if (edice) {
            e.stopPropagation();
            stav.stenaEdice = edice.dataset.ediceSteny;
            nacistStenu(searchInput.value, true);
        }
    }, true);

    covers.addEventListener('click', (e) => {
        const edice = e.target.closest('[data-edice-cisel]');
        const zobrazit = e.target.closest('[data-zobrazit-cisla]');
        if (e.target.closest('[data-ho-dalsi]')) {
            posunHeroObalek++;
            nacistCovery(searchInput.value, true);
        } else if (e.target.closest('[data-ho-chybi]')) {
            stav.cislaZobrazit = 'bezCoveru';
            try { localStorage.setItem('cislaZobrazit', stav.cislaZobrazit); } catch { /* jen se nezapamatuje */ }
            nacistCovery(searchInput.value, true);
        } else if (edice) {
            posunHeroObalek = 0;
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
