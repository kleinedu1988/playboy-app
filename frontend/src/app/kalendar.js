// Kalendář vydání po rocích a měsících
import { GetKalendar, GetStavyVydani, SetStavVydani } from './backend';
import { EDICE, MESICE, VYCHOZI_EDICE, bezDiakritiky, esc, nazevVydani, obrazek, rozlozitVydani, sjednotit, slozitVydani, sklonovat, specialyRoku } from '../lib/format';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { stav } from './stav';
import { zalozitSpecial } from './specialy';
import { calList, calendar, searchInput } from './prvky';
import { listaKalendare } from './listy';
import { ukazatPohled } from './navigace';
import { NAZVY_STAVU } from './vydani';
import { otevritCoverModal } from './cover';
import { pridatCenterfold, pridatPictorial } from './formular-alba';
import { prevestNaVolby } from '../ui/volby';
import { htmlNicNenalezeno, htmlPrazdna } from '../ui/prazdno';

// Kalendář vydání: roky × měsíce jako časová osa obálek. Prázdná políčka ukazují, co ve sbírce chybí.
export const ZKRATKY_MESICU = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

export async function nacistKalendar(dotaz = '', zMezipameti = false) {
    const moje = ++stav.cisloNacteni;
    const [kalendar, stavy] = zMezipameti && stav.kalendarData && stav.stavyVydaniData ? [stav.kalendarData, stav.stavyVydaniData]
        : await Promise.all([GetKalendar().then(k => k || []), GetStavyVydani().then(s => s || [])]);
    if (moje !== stav.cisloNacteni) return;
    stav.kalendarData = kalendar;
    stav.stavyVydaniData = stavy;
    const stavCisla = new Map(stavy.map(s => [s.vydani, s]));
    stav.zrusitUpravuVyrezu = null;
    ukazatPohled(calendar);

    // Vydání zvolené edice; pictorial přiřazený jen k ročníku nemá v kalendáři své políčko
    const vydani = new Map();
    kalendar.forEach(k => {
        const casti = rozlozitVydani(k.vydani);
        if (casti?.mesic && casti.edice === stav.kalendarEdice) vydani.set(k.vydani, k);
    });

    const prepinacEdic = pocet => `<div class="cal-editions">${EDICE.map(e => `<button class="chip ${e === stav.kalendarEdice ? 'active' : ''}" data-edice="${e}">${e}</button>`).join('')}<span>${sklonovat(pocet, 'číslo', 'čísla', 'čísel')}</span></div>`;
    if (vydani.size === 0) {
        listaKalendare.naplnit([]);
        calList.innerHTML = prepinacEdic(0) + htmlPrazdna(`Edice ${stav.kalendarEdice} je prázdná`, 'Kalendář se naplní covery, centerfoldy a pictorialy, které mají měsíc a rok vydání.', { ikona: 'kalendar', tlacitko: { text: 'Přidat…', akce: 'pridat' } });
        prevestNaVolby(calList.querySelector('.cal-editions'));
        return;
    }

    const roky = [...vydani.keys()].map(v => parseInt(v.slice(0, 4)));
    const slova = sjednotit(dotaz).split(/\s+/).filter(Boolean);
    const hledat = slova.length > 0;
    const rokyKalendare = [];
    for (let rok = Math.max(...roky); rok >= Math.min(...roky); rok--) {
        if (hledat) {
            const shodaRoku = slova.every(s => String(rok).includes(s));
            const shodaVydani = slova.every(s => {
                if (String(rok).includes(s)) return true;
                const shodaMesice = ZKRATKY_MESICU.some((zkr, i) => {
                    const klic = slozitVydani(String(rok), String(i + 1).padStart(2, '0'), stav.kalendarEdice);
                    const v = vydani.get(klic);
                    const udaje = stavCisla.get(klic);
                    const texty = [zkr, MESICE[i], v?.modelka || '', udaje?.naObalce || '', udaje?.poznamka || '', udaje?.stav || ''];
                    return texty.some(t => bezDiakritiky(t).includes(s));
                });
                if (shodaMesice) return true;
                return [...vydani.keys()].some(klic => {
                    if (!klic.startsWith(`${rok}-S`)) return false;
                    const v = vydani.get(klic);
                    const udaje = stavCisla.get(klic);
                    const texty = [nazevVydani(klic), v?.modelka || '', udaje?.naObalce || '', udaje?.poznamka || ''];
                    return texty.some(t => bezDiakritiky(t).includes(s));
                });
            });
            if (!shodaRoku && !shodaVydani) continue;
        }

        let obsazeno = 0;
        const policka = ZKRATKY_MESICU.map((zkratka, i) => {
            const klic = slozitVydani(String(rok), String(i + 1).padStart(2, '0'), stav.kalendarEdice);
            const v = vydani.get(klic);
            if (!v) {
                // Chybějící číslo může být označené „mám výtisk“, „sháním“ nebo „nezajímá mě“
                const udaje = stavCisla.get(klic);
                const popisStavu = udaje?.stav ? ` – ${NAZVY_STAVU[udaje.stav].toLowerCase()}` : ' – chybí, klikni pro přidání';
                return `<button class="cal-cell empty ${udaje?.stav || ''}" data-prazdne="${klic}" title="${nazevVydani(klic)}${popisStavu}${udaje?.poznamka ? `\n${esc(udaje.poznamka)}` : ''}">
                    <span class="cal-plus">+</span><span class="cal-month">${zkratka}</span>${udaje?.stav === 'shanim' ? '<em>sháním</em>' : udaje?.stav === 'mam' ? '<em>výtisk</em>' : ''}</button>`;
            }
            obsazeno++;
            const popis = [v.cover && 'cover', v.centerfold && `centerfold: ${v.modelka}`, v.pictorial && 'pictorial'].filter(Boolean).join(', ');
            const vytisk = stavCisla.get(klic)?.stav === 'mam';
            return `
                <button class="cal-cell ${vytisk ? 'mam' : ''}" data-vydani="${klic}" title="${esc(nazevVydani(klic))} – ${esc(popis)}${vytisk ? ' · mám výtisk' : ''}">
                    <img src="${esc(obrazek(v.nahled, 'w300'))}" loading="lazy" draggable="false" />
                    <span class="cal-paska">${zkratka}</span>
                    ${vytisk ? '<span class="cal-stav">výtisk</span>' : ''}
                    <span class="cal-linky" aria-hidden="true">
                        <i class="${v.cover ? 'on' : ''}"></i><i class="${v.centerfold ? 'on' : ''}"></i><i class="${v.pictorial ? 'on' : ''}"></i>
                    </span>
                </button>
            `;
        }).join('');

        // Speciály roku: pojmenované i ty, ke kterým jsou jen alba; pod měsíci jako štítky
        const specialy = new Map(specialyRoku(rok, stav.kalendarEdice).map(s => [s.vydani, s.nazev]));
        for (const klic of vydani.keys()) {
            if (klic.startsWith(`${rok}-S`) && !specialy.has(klic)) specialy.set(klic, nazevVydani(klic).replace(` ${rok}`, ''));
        }
        let obsazenoSpecialu = 0;
        const stitky = [...specialy].sort(([a], [b]) => a.localeCompare(b)).map(([klic, nazev]) => {
            const v = vydani.get(klic);
            const udaje = stavCisla.get(klic);
            if (v) obsazenoSpecialu++;
            const popis = v ? [v.cover && 'cover', v.centerfold && `centerfold: ${v.modelka}`, v.pictorial && 'pictorial'].filter(Boolean).join(', ') : 'zatím prázdný';
            return `<button class="cal-special ${v ? '' : 'empty'} ${udaje?.stav || ''}" data-${v ? 'vydani' : 'prazdne'}="${klic}" title="${esc(nazev)} ${rok} – speciál, ${esc(popis)}${udaje?.stav ? ' · ' + NAZVY_STAVU[udaje.stav].toLowerCase() : ''}">${esc(nazev)}</button>`;
        }).join('');
        // Označená chybějící čísla (mám výtisk, sháním) rok nesbalí, jinak by označení nebylo vidět
        const oznaceno = ZKRATKY_MESICU.some((_, i) => stavCisla.get(slozitVydani(String(rok), String(i + 1).padStart(2, '0'), stav.kalendarEdice))?.stav);
        rokyKalendare.push({ rok, obsazeno, obsazenoSpecialu, policka, stitky, oznaceno });
    }

    // Souvislá řada aspoň dvou prázdných roků se sbalí do jednoho řádku (při hledání roku ne)
    const radky = [];
    const desetileti = new Map();
    const oznacitDekadu = (rok, obsazeno) => {
        const dekada = Math.floor(rok / 10) * 10;
        const prvni = !desetileti.has(dekada);
        desetileti.set(dekada, (desetileti.get(dekada) || 0) + obsazeno);
        return prvni ? `data-cast="${dekada}"` : '';
    };
    for (let i = 0; i < rokyKalendare.length; i++) {
        let konec = i;
        const prazdny = r => r.obsazeno === 0 && !r.stitky && !r.oznaceno;
        while (!hledat && konec + 1 < rokyKalendare.length && prazdny(rokyKalendare[i]) && prazdny(rokyKalendare[konec + 1])) konec++;
        const klicMezery = `${rokyKalendare[konec].rok}-${rokyKalendare[i].rok}`;
        if (konec > i && !rozbaleneMezery.has(klicMezery)) {
            const odRoku = rokyKalendare[konec].rok, doRoku = rokyKalendare[i].rok;
            radky.push(`
                <section class="cal-gap" ${oznacitDekadu(doRoku, 0)}>
                    <button class="cal-gap-btn" data-mezera="${klicMezery}" title="Rozbalit">${odRoku}–${doRoku} · ${sklonovat(konec - i + 1, 'rok', 'roky', 'roků')} bez jediného čísla</button>
                </section>
            `);
            i = konec;
            continue;
        }
        const { rok, obsazeno, obsazenoSpecialu, policka, stitky } = rokyKalendare[i];
        radky.push(`
            <section class="cal-year" ${oznacitDekadu(rok, obsazeno + obsazenoSpecialu)}>
                <div class="cal-year-label"><button class="link cal-year-link" data-vydani="${slozitVydani(String(rok), '', stav.kalendarEdice)}" title="Celý ročník"><strong>${rok}</strong></button><span>${obsazeno} z 12</span></div>
                <div class="cal-months">${policka}</div>
                ${stitky ? `<div class="cal-specials" title="Speciály ${rok}">${stitky}</div>` : ''}
            </section>
        `);
    }

    const celkemVydani = rokyKalendare.reduce((soucet, r) => soucet + r.obsazeno + r.obsazenoSpecialu, 0);
    listaKalendare.naplnit([...desetileti].map(([dekada, pocet]) => ({ klic: dekada, nazev: `${dekada}–${dekada + 9}`, pocet })));
    calList.innerHTML = prepinacEdic(celkemVydani) + `
        <p class="cal-legend">Linky na obálce zleva: <i></i> cover <i></i> centerfold <i></i> pictorial. Prázdné políčko = číslo ve sbírce chybí.</p>
        ${radky.join('') || htmlNicNenalezeno('Hledanému roku neodpovídá žádné vydání.')}
    `;
    prevestNaVolby(calList.querySelector('.cal-editions'));
    listaKalendare.sledovat();
}

export function nastavitEdiciKalendare(edice) {
    if (!EDICE.includes(edice)) return;
    stav.kalendarEdice = edice;
    try { localStorage.setItem('kalendarEdice', edice); } catch { /* jen se nezapamatuje */ }
}

// Co jde přidat k jednomu vydání; nabízí prázdné políčko kalendáře i pravé tlačítko na něm
export const pridatKVydani = klic => [
    ...(rozlozitVydani(klic) ? [{ text: `Nový speciál roku ${rozlozitVydani(klic).rok}…`, akce: async () => {
        if (await zalozitSpecial(rozlozitVydani(klic).rok, rozlozitVydani(klic).edice)) nacistKalendar(searchInput.value);
    } }] : []),
    { text: `Přidat cover: ${nazevVydani(klic)}`, akce: () => otevritCoverModal(null, klic) },
    { text: `Přidat centerfold: ${nazevVydani(klic)}`, akce: () => pridatCenterfold(klic) },
    { text: `Přidat pictorial: ${nazevVydani(klic)}`, akce: () => pridatPictorial(klic) },
];
// Prázdné políčko nabízí i označení čísla
// Po zápisu se kalendář obnoví, jen když je pořád vidět (uživatel mezitím mohl odejít jinam)
const obnovitKalendar = () => { if (!calendar.classList.contains('hidden')) nacistKalendar(searchInput.value, true); };

export const oznacitCislo = klic => [
    { text: 'Mám výtisk', akce: async () => { await SetStavVydani(klic, 'mam'); obnovitKalendar(); } },
    { text: 'Sháním toto číslo', akce: async () => { await SetStavVydani(klic, 'shanim'); obnovitKalendar(); } },
    { text: 'Nezajímá mě', akce: async () => { await SetStavVydani(klic, 'nezajima'); obnovitKalendar(); } },
    { text: 'Zrušit označení', akce: async () => { await SetStavVydani(klic, ''); obnovitKalendar(); } },
];

// Rozbalené řady prázdných roků (klíč „od-do")
export const rozbaleneMezery = new Set();

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    try { stav.kalendarEdice = EDICE.includes(localStorage.getItem('kalendarEdice')) ? localStorage.getItem('kalendarEdice') : VYCHOZI_EDICE; } catch { /* výchozí edice */ }

    calendar.addEventListener('click', (e) => {
        const mezera = e.target.closest('[data-mezera]');
        if (mezera) {
            rozbaleneMezery.add(mezera.dataset.mezera);
            nacistKalendar(searchInput.value, true);
            return;
        }
        const edice = e.target.closest('[data-edice]');
        if (edice) {
            nastavitEdiciKalendare(edice.dataset.edice);
            nacistKalendar(searchInput.value, true);
            return;
        }
        const prazdne = e.target.closest('[data-prazdne]');
        if (!prazdne) return;
        e.stopPropagation();
        const misto = prazdne.getBoundingClientRect();
        otevritKontextovouNabidku(misto.left, misto.bottom + 4, [...pridatKVydani(prazdne.dataset.prazdne), null, ...oznacitCislo(prazdne.dataset.prazdne)]);
    });
}
