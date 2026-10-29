// Volby přehledu v horní liště pod hledáním: řazení (ikona ⇅ a hodnota ▾), povinné volby jako rozbalovací tlačítka
// (Edice: US ▾, ♥ 4+ ▾), tlačítko Filtry s počtem zapnutých filtrů a panelem všech filtrů, zapnuté filtry jako štítky
// s × a nakonec počet položek. Přehled vykreslí do obsahu obyčejný řádek štítků (.chip s data atributem); ten se skryje
// a volba v liště nebo panelu na skrytý štítek jen klikne, takže obsluha přehledu se nemění.
import { esc } from '../lib/format';
import { otevritKontextovouNabidku, zavritKontextovouNabidku } from './nabidka';

const POPISKY = {
    razeniGalerie: 'Řazení',
    razeniSteny: 'Řazení',
    minHodnoceni: 'Srdíčka',
    stenaMin: 'Srdíčka',
    nejlepsiMin: 'Srdíčka',
    vyberId: 'Výběr',
    edice: 'Edice',
    ediceCisel: 'Edice',
    ediceModelek: 'Edice',
    ediceSteny: 'Edice',
    zobrazeniCisel: 'Zobrazení',
    roleModelek: 'Kategorie',
    vyskytModelek: 'Výskyt',
    zobrazitCisla: 'Zobrazit',
};

const RAZENI = new Set(['razeniGalerie', 'razeniSteny']);
// Zobrazení Čísel (Obálky / Kalendář): rozbalovací volba s ikonou zvolené hodnoty, jako řazení
const ZOBRAZENI = new Set(['zobrazeniCisel']);

// Filtr, který se dá vypnout: bez zvoleného štítku ukazuje výchozí stav a nabídka má položku pro návrat na vše
const VYPINATELNE = new Set(['minHodnoceni', 'stenaMin', 'vyberId']);

// Výběr v Nejlepších mění, odkud fotky jsou, a má vlastní akce (přejmenovat, smazat): zůstává samostatným tlačítkem
const SAMOSTATNE = new Set(['vyberId']);

const IKONA_RAZENI = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></svg>';
const IKONA_FILTRU = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
const IKONY_ZOBRAZENI = {
    'Obálky': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="3.5" width="7" height="10" rx="1.5"/><rect x="13" y="3.5" width="7" height="10" rx="1.5"/><rect x="4" y="15.5" width="7" height="5" rx="1.5"/><rect x="13" y="15.5" width="7" height="5" rx="1.5"/></svg>',
    'Kalendář': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    // Části Sbírky (pilulky v obsahu Přehledu)
    'Přehled': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
    'Údržba': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/></svg>',
    // Dvě srdíčka vedle sebe: porovnávání, která víc
    'Oblíbenost': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M8 18s-5.5-3.3-5.5-7.4A3 3 0 0 1 8 9a3 3 0 0 1 5.5 1.6c0 4.1-5.5 7.4-5.5 7.4z"/><path d="M15.2 6.6A3 3 0 0 1 21.5 8c0 3.2-3.3 5.9-4.8 6.9"/></svg>',
    'Sháním CZ': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>',
    // Část Oblíbenosti Hodnocení: srdíčko z půlky vyplněné (srdíčka, porovnání i pořadí v jednom)
    'Hodnocení': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.35-9.2-8.6C1.4 8.6 3 5 6.5 5c2 0 3.6 1.2 5.5 3.2C13.9 6.2 15.5 5 17.5 5 21 5 22.6 8.6 21.2 11.4 19 15.65 12 20 12 20z"/><path d="M12 20s-7-4.35-9.2-8.6C1.4 8.6 3 5 6.5 5c2 0 3.6 1.2 5.5 3.2V20z" fill="currentColor" stroke="none"/></svg>',
    // Pohledy Hodnocení (pilulky v obsahu, oblibenost.js): dva pásy fotek nad sebou, fotka se srdíčkem, žebříček
    'Porovnat': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/></svg>',
    'Fotky': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 16.5s-3.5-2.1-3.5-4.6a1.9 1.9 0 0 1 3.5-1 1.9 1.9 0 0 1 3.5 1c0 2.5-3.5 4.6-3.5 4.6z"/></svg>',
    'Pořadí': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h8M9 18h5"/><path d="M4 5v3M3.5 12h1.5l-1.5 2h1.5M3.5 17.5h1.5v2h-1.5"/></svg>',
    // Pohár: síň slávy
    'Síň slávy': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4.5v1.5A3 3 0 0 0 7.3 10.5M17 6h2.5v1.5a3 3 0 0 1-2.8 3"/><path d="M12 14v3M8.5 20h7M9.5 17h5"/></svg>',
    'Statistiky': '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>',
};
// Ikona volby podle názvu (i pro pilulky v obsahu, ať vypadají jako volby v liště); neznámý název nic
export const ikonaZobrazeni = nazev => IKONY_ZOBRAZENI[nazev] || '';
const TITULKY_ZOBRAZENI = { zobrazeniCisel: 'Zobrazení čísel' };
const IKONA_PREHRAT = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';

// Panel filtrů zůstává otevřený i po změně filtru (přehled se překreslí a panel se naplní znovu)
let panelOtevren = false;
// „Zrušit filtry“ ruší filtry po jednom: po každém překreslení přehledu se zruší další zapnutý. Platí jen pro
// přehled, ve kterém se začalo (rodič řádku voleb), a nejvýš 3 s; přepnutí jinam nebo nezdařené načtení ho ukončí.
let rusitVse = null;
const RUSENI_NEJDELE = 3000;
const zacitRuseni = (lista) => { rusitVse = { kde: lista?.parentElement, do: Date.now() + RUSENI_NEJDELE }; };
let aktualniLista = null;
let tlacitkoFiltru = null;

const misto = () => document.getElementById('volbyPrehledu');

// Text štítku bez počtu (výběr má počet v <span>)
const textStitku = (stitek) => (stitek.childNodes[0]?.textContent || stitek.textContent).trim();

// Řádek voleb přehledu se v obsahu skryje a jeho volby se ukážou v liště
export function prevestNaVolby(lista) {
    if (!lista) return;
    lista.classList.add('volby-v-liste');
    ukazatVolby(lista);
}

// Po přepnutí pohledu: volby nově ukázaného přehledu, nebo prázdné místo (profil, vydání, covery, přehled)
export function obnovitVolby(pohled) {
    rusitVse = null;
    ukazatVolby(pohled.querySelector('.volby-v-liste'));
}

// Skupina štítků jednoho druhu (řazení, srdíčka, edice…) a co s ní lišta dělá
function popsatSkupinu(klic, stitky) {
    const zvoleny = stitky.find(s => s.classList.contains('active'));
    const vychoziVse = stitky.find(s => Object.values(s.dataset)[0] === 'vse');
    const vypinatelny = VYPINATELNE.has(klic);
    const zapnuto = (vypinatelny && Boolean(zvoleny)) || Boolean(vychoziVse && zvoleny && zvoleny !== vychoziVse);
    const druh = ZOBRAZENI.has(klic) ? 'zobrazeni' : RAZENI.has(klic) ? 'razeni' : SAMOSTATNE.has(klic) ? 'samostatne' : vypinatelny || vychoziVse ? 'filtr' : 'povinne';
    return {
        klic, stitky, zvoleny, vypinatelny, zapnuto, druh,
        // Filtr s vypínáním nemá štítek „vše“: v nabídce i v panelu se doplní
        volby: vypinatelny ? [{ text: klic === 'vyberId' ? 'Vše podle srdíček' : 'Vše', zvolena: !zvoleny, akce: () => zvoleny?.click() }, ...stitky.map(st => volbaStitku(st, zvoleny))]
            : stitky.map(st => volbaStitku(st, zvoleny)),
        zrusit: vypinatelny ? () => zvoleny?.click() : vychoziVse ? () => vychoziVse.click() : null,
    };
}

const volbaStitku = (stitek, zvoleny) => ({
    text: textStitku(stitek).replace(/^vše$/, 'Vše'),
    pocet: stitek.querySelector('span')?.textContent.trim() || '',
    zvolena: stitek === zvoleny,
    akce: () => stitek.click(),
});

const hodnota = s => s.zvoleny ? textStitku(s.zvoleny) : 'vše';

function ukazatVolby(lista) {
    const cil = misto();
    cil.innerHTML = '';
    cil.classList.toggle('hidden', !lista);
    tlacitkoFiltru = null;
    if (!lista) {
        rusitVse = null;
        zavritPanel();
        return nastavitPocet();
    }

    // Volby a tlačítka jsou v jednom plovoucím panelu s dělicími čarami, počet na jeho konci
    const panel = document.createElement('div');
    panel.className = 'volby-skupina';
    cil.append(panel);

    const podleKlice = new Map();
    lista.querySelectorAll('.chip').forEach(stitek => {
        const klic = Object.keys(stitek.dataset)[0];
        if (!POPISKY[klic]) return;
        if (!podleKlice.has(klic)) podleKlice.set(klic, []);
        podleKlice.get(klic).push(stitek);
    });
    const skupiny = [...podleKlice].map(([klic, stitky]) => popsatSkupinu(klic, stitky));
    const filtry = skupiny.filter(s => s.druh === 'filtr');
    const zapnute = filtry.filter(s => s.zapnuto);
    // Odkazy v řádku (přejmenovat a smazat výběr) patří do nabídky výběru, jinak poslední volby
    const odkazy = [...lista.querySelectorAll('button.link')];
    const sOdkazy = skupiny.find(s => s.druh === 'samostatne') || skupiny.filter(s => s.druh !== 'filtr').at(-1);

    aktualniLista = lista;
    if (rusitVse) {
        const pokracovat = rusitVse.kde === lista.parentElement && Date.now() < rusitVse.do && zapnute.length;
        if (pokracovat) setTimeout(() => zapnute[0].zrusit());
        else rusitVse = null;
    }

    const pridatTlacitko = (html, trida = '') => {
        const tlacitko = document.createElement('button');
        tlacitko.type = 'button';
        tlacitko.className = `volba ${trida}`.trim();
        tlacitko.innerHTML = html;
        panel.append(tlacitko);
        return tlacitko;
    };

    const nabidka = (s, tlacitko) => {
        const polozky = s.volby.map(v => ({ text: `${v.zvolena ? '✓ ' : ''}${v.text}${v.pocet ? ` (${v.pocet})` : ''}`, akce: v.akce }));
        if (s === sOdkazy && odkazy.length) {
            polozky.push(null, ...odkazy.map(o => ({ text: o.textContent.trim().replace(/^./, z => z.toUpperCase()), akce: () => o.click() })));
        }
        const r = tlacitko.getBoundingClientRect();
        otevritKontextovouNabidku(r.left, r.bottom + 4, polozky);
    };

    // × u zapnuté volby (nebo Shift+klik, prostřední tlačítko) ji zruší, jinak klik otevře nabídku nebo panel
    const zrusitelne = (tlacitko, s, otevrit) => {
        tlacitko.addEventListener('click', (e) => {
            e.stopPropagation();
            if (s.zapnuto && s.zrusit && (e.shiftKey || e.target.closest('.volba-zrusit'))) return s.zrusit();
            otevrit();
        });
        if (s.zapnuto && s.zrusit) {
            tlacitko.addEventListener('auxclick', (e) => {
                if (e.button !== 1) return;
                e.stopPropagation();
                e.preventDefault();
                s.zrusit();
            });
        }
    };
    const krizek = '<em class="volba-zrusit" title="Zrušit filtr" aria-label="Zrušit filtr">&times;</em>';

    // Přepínač zobrazení (Obálky / Kalendář): všechny možnosti vedle sebe, zvolená
    // zvýrazněná, klik přepne rovnou (bez nabídky)
    const pridatPrepinac = (s) => {
        const prepinac = document.createElement('div');
        prepinac.className = 'volba-prepinac';
        prepinac.setAttribute('role', 'radiogroup');
        prepinac.setAttribute('aria-label', TITULKY_ZOBRAZENI[s.klic] || POPISKY[s.klic]);
        s.volby.forEach(v => {
            const tlacitko = document.createElement('button');
            tlacitko.type = 'button';
            tlacitko.className = `prepinac-volba ${v.zvolena ? 'aktivni' : ''}`.trim();
            tlacitko.setAttribute('role', 'radio');
            tlacitko.setAttribute('aria-checked', String(v.zvolena));
            tlacitko.title = v.text;
            tlacitko.innerHTML = `${IKONY_ZOBRAZENI[v.text] || ''}<span>${esc(v.text)}</span>${v.pocet ? `<small>${esc(v.pocet)}</small>` : ''}`;
            tlacitko.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!v.zvolena) v.akce();
            });
            prepinac.append(tlacitko);
        });
        panel.append(prepinac);
    };

    // Povinná volba bez zvolené hodnoty (srdíčka v Nejlepších, když je zvolený výběr) se neukazuje
    skupiny.filter(s => s.druh !== 'filtr' && (s.druh !== 'povinne' || s.zvoleny)).forEach(s => {
        let tlacitko;
        if (s.druh === 'zobrazeni') {
            pridatPrepinac(s);
            return;
        } else if (s.druh === 'razeni') {
            tlacitko = pridatTlacitko(`${IKONA_RAZENI}<b>${esc(hodnota(s))}</b> <i aria-hidden="true">▾</i>`, 'razeni');
            tlacitko.title = 'Řazení';
        } else if (s.druh === 'samostatne') {
            tlacitko = pridatTlacitko(s.zvoleny
                ? `<b>${esc(hodnota(s))}</b> ${krizek} <i aria-hidden="true">▾</i>`
                : `<span class="nazev">${POPISKY[s.klic]}</span> <i aria-hidden="true">▾</i>`, s.zapnuto ? 'zapnuto' : '');
            tlacitko.title = POPISKY[s.klic];
        } else {
            tlacitko = pridatTlacitko(`<span>${POPISKY[s.klic]}:</span> <b>${esc(hodnota(s))}</b> <i aria-hidden="true">▾</i>`);
        }
        tlacitko.setAttribute('aria-haspopup', 'menu');
        zrusitelne(tlacitko, s, () => nabidka(s, tlacitko));
    });

    if (filtry.length) {
        tlacitkoFiltru = pridatTlacitko(`${IKONA_FILTRU}<b>Filtry</b>${zapnute.length ? `<span class="volby-odznak">${zapnute.length}</span>` : ''} <i aria-hidden="true">▾</i>`, 'filtry');
        tlacitkoFiltru.setAttribute('aria-haspopup', 'dialog');
        tlacitkoFiltru.setAttribute('aria-expanded', String(panelOtevren));
        tlacitkoFiltru.addEventListener('click', (e) => {
            e.stopPropagation();
            if (panelOtevren) zavritPanel();
            else otevritPanel();
        });
        // Zapnuté filtry jako štítky: klik otevře panel, × filtr zruší
        zapnute.forEach(s => {
            const stitek = pridatTlacitko(`${esc(hodnota(s))} ${krizek}`, 'volba-stitek');
            stitek.title = `${POPISKY[s.klic]}: ${hodnota(s)}`;
            zrusitelne(stitek, s, () => otevritPanel());
        });
    }

    // Další tlačítka řádku jako tlačítka lišty (slideshow jako ikona ▶); klik na ně klikne na původní
    lista.querySelectorAll('button:not(.chip):not(.link)').forEach(puvodni => {
        const popis = puvodni.textContent.trim();
        const slideshow = /slideshow/i.test(popis);
        const tlacitko = pridatTlacitko(slideshow ? IKONA_PREHRAT : esc(popis), slideshow ? 'akce ikona' : 'akce');
        tlacitko.title = popis;
        tlacitko.setAttribute('aria-label', popis);
        tlacitko.addEventListener('click', () => puvodni.click());
    });

    // Počet (22 modelek, 78 fotek) se ukazuje na konci kapsle voleb i v nápovědě zvoleného přehledu
    const pocet = [...lista.querySelectorAll(':scope > span:not([hidden])')].map(s => s.textContent.trim()).filter(Boolean).pop();
    if (pocet) {
        const pocitadlo = document.createElement('span');
        pocitadlo.className = 'volby-pocet';
        pocitadlo.textContent = pocet;
        panel.append(pocitadlo);
    }

    if (!panel.childElementCount) panel.remove();
    nastavitPocet(pocet);

    aktualniFiltry = { filtry, zapnute, pocet };
    if (panelOtevren && filtry.length) vykreslitPanel();
    else zavritPanel();
}

// Panel filtrů pod tlačítkem Filtry: každý filtr jako řádek pilulek, dole počet a Zrušit filtry
let aktualniFiltry = { filtry: [], zapnute: [], pocet: '' };
let panelFiltru = null;

function pripravitPanel() {
    if (panelFiltru) return;
    panelFiltru = document.createElement('div');
    panelFiltru.id = 'volbyPanel';
    panelFiltru.className = 'volby-panel hidden';
    panelFiltru.setAttribute('role', 'dialog');
    panelFiltru.setAttribute('aria-label', 'Filtry');
    document.body.append(panelFiltru);

    panelFiltru.addEventListener('click', (e) => {
        const volba = e.target.closest('[data-filtr]');
        if (volba) {
            const [i, j] = volba.dataset.filtr.split(':').map(Number);
            const v = aktualniFiltry.filtry[i]?.volby[j];
            if (v && !v.zvolena) v.akce();
        } else if (e.target.closest('[data-zrusit-filtry]') && aktualniFiltry.zapnute.length) {
            zacitRuseni(aktualniLista);
            aktualniFiltry.zapnute[0].zrusit();
        }
    });
    // Klik mimo panel a tlačítko Filtry panel zavře; Esc také (a dál nejde, nezavře profil ani číslo)
    document.addEventListener('mousedown', (e) => {
        if (panelOtevren && !panelFiltru.contains(e.target) && !tlacitkoFiltru?.contains(e.target)) zavritPanel();
    }, true);
    // Tab zůstává v panelu (dokola), jako v okně
    panelFiltru.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const tlacitka = [...panelFiltru.querySelectorAll('button:not(:disabled)')];
        const kde = tlacitka.indexOf(document.activeElement);
        if (e.shiftKey ? kde <= 0 : kde === tlacitka.length - 1) {
            e.preventDefault();
            tlacitka[e.shiftKey ? tlacitka.length - 1 : 0]?.focus();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (!panelOtevren || e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        zavritPanel();
        tlacitkoFiltru?.focus();
    }, true);
    window.addEventListener('resize', () => panelOtevren && umistitPanel());
}

function otevritPanel() {
    pripravitPanel();
    zavritKontextovouNabidku();
    panelOtevren = true;
    tlacitkoFiltru?.setAttribute('aria-expanded', 'true');
    vykreslitPanel();
    // Fokus do panelu na zvolenou volbu prvního filtru, aby šel ovládat klávesnicí
    panelFiltru.querySelector('button.active, button')?.focus({ preventScroll: true });
}

function zavritPanel() {
    panelOtevren = false;
    tlacitkoFiltru?.setAttribute('aria-expanded', 'false');
    panelFiltru?.classList.add('hidden');
}

function vykreslitPanel() {
    const { filtry, zapnute, pocet } = aktualniFiltry;
    // Po překreslení zůstane fokus na stejné volbě (výběr Enterem jinak fokus ztratí)
    const fokus = panelFiltru.contains(document.activeElement) ? document.activeElement.dataset.filtr || 'zrusit' : null;
    panelFiltru.innerHTML = filtry.map((s, i) => `
        <h6>${POPISKY[s.klic]}</h6>
        <div class="volby-panel-rada">${s.volby.map((v, j) => `
            <button type="button" class="${v.zvolena ? 'active' : ''}" data-filtr="${i}:${j}" aria-pressed="${v.zvolena}">${esc(v.text)}${v.pocet ? `<span>${esc(v.pocet)}</span>` : ''}</button>`).join('')}
        </div>`).join('') + `
        <div class="volby-panel-pata"><span>${esc(pocet || '')}</span>
            <button type="button" class="link" data-zrusit-filtry ${zapnute.length ? '' : 'disabled'}>Zrušit filtry</button></div>`;
    panelFiltru.classList.remove('hidden');
    umistitPanel();
    if (fokus) (panelFiltru.querySelector(`[data-filtr="${fokus}"]`) || panelFiltru.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
}

// Panel uprostřed pod lištou voleb (stejně jako hledání nad ní), celý v okně
function umistitPanel() {
    const lista = misto().querySelector('.volby-skupina');
    if (!lista) return;
    const r = lista.getBoundingClientRect();
    const sirka = panelFiltru.offsetWidth;
    const levo = Math.min(Math.max(8, r.left + r.width / 2 - sirka / 2), window.innerWidth - sirka - 8);
    panelFiltru.style.left = `${levo}px`;
    panelFiltru.style.top = `${r.bottom + 10}px`;
}

function nastavitPocet(pocet = '') {
    document.querySelectorAll('.hlavni-lista [data-rezim]').forEach(b => {
        b.dataset.titulek ??= b.title;
        b.title = b.classList.contains('active') && pocet ? `${b.dataset.titulek} · ${pocet}` : b.dataset.titulek;
    });
    prizpusobitListu();
}

// Záložky v liště mají ikonu a název; když se vedle voleb uprostřed nevejdou, nezvolené ukážou jen ikonu
// (název je v bublině): napřed stránky vpravo, potom i přehledy vlevo. Zvolená má název vždy.
const ODSTUP_V_LISTE = 16;
const prekryvaji = (a, b) => a.width && b.width && a.right + ODSTUP_V_LISTE > b.left && b.right + ODSTUP_V_LISTE > a.left
    && a.bottom > b.top && b.bottom > a.top;
export function prizpusobitListu() {
    const lista = document.querySelector('.hlavni-lista');
    const vlevo = document.getElementById('viewToggle');
    const vpravo = lista?.querySelector('.nav-akce');
    if (!vlevo || !vpravo) return;
    const volby = misto();
    const stredy = () => (volby.classList.contains('hidden') ? [] : [volby.getBoundingClientRect()]);
    const tesno = () => {
        const l = vlevo.getBoundingClientRect();
        const p = vpravo.getBoundingClientRect();
        return prekryvaji(l, p) || stredy().some(v => prekryvaji(l, v) || prekryvaji(v, p));
    };
    lista.classList.remove('bez-nazvu-vpravo', 'bez-nazvu-vlevo');
    if (tesno()) lista.classList.add('bez-nazvu-vpravo');
    if (tesno()) lista.classList.add('bez-nazvu-vlevo');
}

// Tlačítko „Zrušit hledání a filtry“ v prázdném stavu: smaže text hledání a zruší zapnuté filtry po jednom
export function zrusitHledaniAFiltry() {
    const hledani = document.getElementById('searchInput');
    if (hledani?.value) {
        hledani.value = '';
        hledani.dispatchEvent(new Event('input'));
    }
    if (!aktualniFiltry.zapnute.length) return;
    zacitRuseni(aktualniLista);
    aktualniFiltry.zapnute[0].zrusit();
}
