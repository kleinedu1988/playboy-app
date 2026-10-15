// Volby přehledu (řazení, filtr srdíček, výběr, edice) jako rozbalovací tlačítka „Řazení: A–Z ▾“ v horní liště.
// Přehled vykreslí do obsahu obyčejný řádek štítků (.chip s data atributem); ten se skryje a v liště se z něj
// složí tlačítka s nabídkou. Položka nabídky na skrytý štítek jen klikne, takže obsluha přehledu se nemění.
import { otevritKontextovouNabidku } from './nabidka';

const POPISKY = {
    razeniGalerie: 'Řazení',
    razeniSteny: 'Řazení',
    minHodnoceni: 'Srdíčka',
    nejlepsiMin: 'Srdíčka',
    vyberId: 'Výběr',
    edice: 'Edice',
    ediceCisel: 'Edice',
    zobrazitCisla: 'Zobrazit',
};

// Filtr, který se dá vypnout: bez zvoleného štítku ukazuje „vše“ a nabídka má položku Vše
const VYPINATELNE = new Set(['minHodnoceni']);

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

function ukazatVolby(lista) {
    const cil = misto();
    cil.innerHTML = '';
    cil.classList.toggle('hidden', !lista);
    if (!lista) return nastavitPocet();

    // Volby a tlačítka jsou v jednom plovoucím panelu s dělicími čarami; počet zůstává vedle panelu
    const panel = document.createElement('div');
    panel.className = 'volby-skupina';
    cil.append(panel);

    const skupiny = new Map();
    lista.querySelectorAll('.chip').forEach(stitek => {
        const klic = Object.keys(stitek.dataset)[0];
        if (!POPISKY[klic]) return;
        if (!skupiny.has(klic)) skupiny.set(klic, []);
        skupiny.get(klic).push(stitek);
    });
    // Odkazy v řádku (přejmenovat a smazat výběr) patří do nabídky poslední skupiny
    const odkazy = [...lista.querySelectorAll('button.link')];

    [...skupiny].forEach(([klic, stitky], i) => {
        const zvoleny = stitky.find(s => s.classList.contains('active'));
        const tlacitko = document.createElement('button');
        tlacitko.type = 'button';
        tlacitko.className = 'volba';
        tlacitko.classList.toggle('zapnuto', VYPINATELNE.has(klic) && Boolean(zvoleny));
        tlacitko.setAttribute('aria-haspopup', 'menu');
        tlacitko.innerHTML = '<span></span> <b></b> <i aria-hidden="true">▾</i>';
        tlacitko.querySelector('span').textContent = `${POPISKY[klic]}:`;
        tlacitko.querySelector('b').textContent = zvoleny ? textStitku(zvoleny) : VYPINATELNE.has(klic) ? 'vše' : '—';
        tlacitko.addEventListener('click', (e) => {
            e.stopPropagation();
            const polozky = stitky.map(s => {
                const pocet = s.querySelector('span')?.textContent.trim();
                return { text: `${s === zvoleny ? '✓ ' : ''}${textStitku(s)}${pocet ? ` (${pocet})` : ''}`, akce: () => s.click() };
            });
            // Vypnutí filtru: klik na zvolený štítek ho zruší
            if (VYPINATELNE.has(klic)) polozky.unshift({ text: `${zvoleny ? '' : '✓ '}Vše`, akce: () => zvoleny?.click() });
            if (i === skupiny.size - 1 && odkazy.length) {
                polozky.push(null, ...odkazy.map(o => ({ text: o.textContent.trim().replace(/^./, z => z.toUpperCase()), akce: () => o.click() })));
            }
            const r = tlacitko.getBoundingClientRect();
            // Dokud je nabídka otevřená, panel má růžový rámeček a vybíraná volba je zvýrazněná
            panel.classList.add('otevreno');
            tlacitko.classList.add('otevrena');
            otevritKontextovouNabidku(r.left, r.bottom + 4, polozky, { poZavreni: () => {
                panel.classList.remove('otevreno');
                tlacitko.classList.remove('otevrena');
            } });
        });
        panel.append(tlacitko);
    });

    // Další tlačítka řádku (Spustit slideshow) jako tlačítka lišty; klik na ně klikne na původní
    lista.querySelectorAll('button:not(.chip):not(.link)').forEach(puvodni => {
        const tlacitko = document.createElement('button');
        tlacitko.type = 'button';
        tlacitko.className = 'volba akce';
        tlacitko.textContent = puvodni.textContent.trim();
        tlacitko.addEventListener('click', () => puvodni.click());
        panel.append(tlacitko);
    });

    if (!panel.childElementCount) panel.remove();

    // Počet (22 modelek, 78 fotek) se v liště neukazuje, je v nápovědě zvoleného přehledu
    const pocet = [...lista.querySelectorAll(':scope > span:not([hidden])')].map(s => s.textContent.trim()).filter(Boolean).pop();
    nastavitPocet(pocet);
}

function nastavitPocet(pocet = '') {
    document.querySelectorAll('.hlavni-lista [data-rezim]').forEach(b => {
        b.dataset.titulek ??= b.title;
        b.title = b.classList.contains('active') && pocet ? `${b.dataset.titulek} · ${pocet}` : b.dataset.titulek;
    });
}
