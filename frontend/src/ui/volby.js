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
    roleModelek: 'Role',
    zobrazitCisla: 'Zobrazit',
};

const RAZENI = new Set(['razeniGalerie', 'razeniSteny']);

// Filtr, který se dá vypnout: bez zvoleného štítku ukazuje výchozí stav a nabídka má položku pro návrat na vše
const VYPINATELNE = new Set(['minHodnoceni', 'stenaMin', 'vyberId']);

// Výběr v Nejlepších mění, odkud fotky jsou, a má vlastní akce (přejmenovat, smazat): zůstává samostatným tlačítkem
const SAMOSTATNE = new Set(['vyberId']);

const IKONA_RAZENI = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/></svg>';
const IKONA_FILTRU = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
const IKONA_PREHRAT = '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';

// Panel filtrů zůstává otevřený i po změně filtru (přehled se překreslí a panel se naplní znovu)
let panelOtevren = false;
// „Zrušit filtry“ ruší filtry po jednom: po každém překreslení přehledu se zruší další zapnutý
let rusitVse = false;
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
    ukazatVolby(pohled.querySelector('.volby-v-liste'));
}

// Skupina štítků jednoho druhu (řazení, srdíčka, edice…) a co s ní lišta dělá
function popsatSkupinu(klic, stitky) {
    const zvoleny = stitky.find(s => s.classList.contains('active'));
    const vychoziVse = stitky.find(s => Object.values(s.dataset)[0] === 'vse');
    const vypinatelny = VYPINATELNE.has(klic);
    const zapnuto = (vypinatelny && Boolean(zvoleny)) || Boolean(vychoziVse && zvoleny && zvoleny !== vychoziVse);
    const druh = RAZENI.has(klic) ? 'razeni' : SAMOSTATNE.has(klic) ? 'samostatne' : vypinatelny || vychoziVse ? 'filtr' : 'povinne';
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
        rusitVse = false;
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

    if (rusitVse) {
        if (zapnute.length) setTimeout(() => zapnute[0].zrusit());
        else rusitVse = false;
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

    skupiny.filter(s => s.druh !== 'filtr').forEach(s => {
        let tlacitko;
        if (s.druh === 'razeni') {
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
            rusitVse = true;
            aktualniFiltry.zapnute[0].zrusit();
        }
    });
    // Klik mimo panel a tlačítko Filtry panel zavře; Esc také (a dál nejde, nezavře profil ani číslo)
    document.addEventListener('mousedown', (e) => {
        if (panelOtevren && !panelFiltru.contains(e.target) && !tlacitkoFiltru?.contains(e.target)) zavritPanel();
    }, true);
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
}

function zavritPanel() {
    panelOtevren = false;
    tlacitkoFiltru?.setAttribute('aria-expanded', 'false');
    panelFiltru?.classList.add('hidden');
}

function vykreslitPanel() {
    const { filtry, zapnute, pocet } = aktualniFiltry;
    panelFiltru.innerHTML = filtry.map((s, i) => `
        <h6>${POPISKY[s.klic]}</h6>
        <div class="volby-panel-rada">${s.volby.map((v, j) => `
            <button type="button" class="${v.zvolena ? 'active' : ''}" data-filtr="${i}:${j}" aria-pressed="${v.zvolena}">${esc(v.text)}${v.pocet ? `<span>${esc(v.pocet)}</span>` : ''}</button>`).join('')}
        </div>`).join('') + `
        <div class="volby-panel-pata"><span>${esc(pocet || '')}</span>
            <button type="button" class="link" data-zrusit-filtry ${zapnute.length ? '' : 'disabled'}>Zrušit filtry</button></div>`;
    panelFiltru.classList.remove('hidden');
    umistitPanel();
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
}

// Tlačítko „Zrušit hledání a filtry“ v prázdném stavu: smaže text hledání a zruší zapnuté filtry po jednom
export function zrusitHledaniAFiltry() {
    const hledani = document.getElementById('searchInput');
    if (hledani?.value) {
        hledani.value = '';
        hledani.dispatchEvent(new Event('input'));
    }
    if (!aktualniFiltry.zapnute.length) return;
    rusitVse = true;
    aktualniFiltry.zapnute[0].zrusit();
}
