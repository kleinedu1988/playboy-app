// Kalendář vydání po rocích a měsících
import { GetKalendar, GetStavyVydani, GetVydani, SetStavVydani } from './backend';
import { EDICE, MESICE, VYCHOZI_EDICE, ciselRocniku, cisloNevyslo, esc, nazevVydani, obrazek, poleCisla, rozlozitDotaz, rozlozitVydani, slozitVydani, sklonovat, specialyRoku, vyhovujeHledani } from '../lib/format';
import { otevritKontextovouNabidku } from '../ui/nabidka';
import { stav } from './stav';
import { zalozitSpecial } from './specialy';
import { calList, calendar, searchInput } from './prvky';
import { listaKalendare } from './listy';
import { htmlZobrazeniCisel, ukazatPohled } from './navigace';
import { NAZVY_STAVU, otevritVydani, upravitVydani } from './vydani';
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
    // Nové vykreslení ukončí listování na kartě; čerstvá data zahodí zapamatovaný obsah čísel
    zastavitListovani();
    if (!zMezipameti) obsahCisel.clear();
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

    const prepinacEdic = pocet => `<div class="cal-editions">${htmlZobrazeniCisel('kalendar')}${EDICE.map(e => `<button class="chip ${e === stav.kalendarEdice ? 'active' : ''}" data-edice="${e}">${e}</button>`).join('')}<span>${sklonovat(pocet, 'číslo', 'čísla', 'čísel')}</span></div>`;
    if (vydani.size === 0) {
        listaKalendare.naplnit([]);
        calList.innerHTML = prepinacEdic(0) + htmlPrazdna(`Edice ${stav.kalendarEdice} je prázdná`, 'Kalendář se naplní covery, centerfoldy a pictorialy, které mají měsíc a rok vydání.', { ikona: 'kalendar', tlacitko: { text: 'Přidat…', akce: 'pridat' } });
        prevestNaVolby(calList.querySelector('.cal-editions'));
        return;
    }

    const roky = [...vydani.keys()].map(v => parseInt(v.slice(0, 4)));
    // Hledání stejnou syntaxí jako ostatní přehledy (rok:1994-1995, -1995, jméno modelky…): rok zůstane,
    // když dotazu odpovídá sám rok nebo některé jeho číslo
    const tokeny = rozlozitDotaz(dotaz);
    const hledat = tokeny.length > 0;
    const rokyKalendare = [];
    for (let rok = Math.max(...roky); rok >= Math.min(...roky); rok--) {
        if (hledat) {
            const r = String(rok);
            const shodaRoku = vyhovujeHledani([r], tokeny, { rok: r });
            const cisla = [
                ...ZKRATKY_MESICU.map((zkr, i) => ({ klic: slozitVydani(r, String(i + 1).padStart(2, '0'), stav.kalendarEdice), nazvy: [zkr, MESICE[i]] })),
                ...[...vydani.keys()].filter(klic => klic.startsWith(`${r}-S`)).map(klic => ({ klic, nazvy: [nazevVydani(klic)] })),
            ];
            const shodaVydani = cisla.some(({ klic, nazvy }) => {
                const v = vydani.get(klic);
                const udaje = stavCisla.get(klic);
                return vyhovujeHledani([r, ...nazvy, v?.modelka || '', udaje?.naObalce || '', udaje?.poznamka || '', udaje?.stav || ''],
                    tokeny, poleCisla(klic, v?.modelka || ''));
            });
            if (!shodaRoku && !shodaVydani) continue;
        }

        let obsazeno = 0;
        const policka = ZKRATKY_MESICU.map((zkratka, i) => {
            const klic = slozitVydani(String(rok), String(i + 1).padStart(2, '0'), stav.kalendarEdice);
            const v = vydani.get(klic);
            if (!v && cisloNevyslo(klic)) {
                return `<div class="cal-cell nevyslo" title="${esc(nazevVydani(klic))} – číslo nevyšlo"><span class="cal-month">${zkratka}</span><em>nevyšlo</em></div>`;
            }
            if (!v) {
                // Chybějící číslo může být označené „mám výtisk“, „sháním“ nebo „nezajímá mě“
                const udaje = stavCisla.get(klic);
                const popisStavu = udaje?.stav ? ` – ${NAZVY_STAVU[udaje.stav].toLowerCase()}` : ' – chybí, klik nabídne přidání';
                return `<button class="cal-cell empty ${udaje?.stav || ''}" data-prazdne="${klic}" title="${esc(nazevVydani(klic))}${popisStavu}${udaje?.poznamka ? `\n${esc(udaje.poznamka)}` : ''}">
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
            <section class="cal-year" data-rok="${rok}" ${oznacitDekadu(rok, obsazeno + obsazenoSpecialu)}>
                <div class="cal-year-label"><button class="link cal-year-link" data-vydani="${slozitVydani(String(rok), '', stav.kalendarEdice)}" title="Celý ročník"><strong>${rok}</strong></button><span>${ciselRocniku(rok, stav.kalendarEdice) ? `${obsazeno} z ${ciselRocniku(rok, stav.kalendarEdice)}` : obsazeno}</span></div>
                <div class="cal-months">${policka}</div>
                ${stitky ? `<div class="cal-specials" title="Speciály ${rok}">${stitky}</div>` : ''}
            </section>
        `);
    }

    const celkemVydani = rokyKalendare.reduce((soucet, r) => soucet + r.obsazeno + r.obsazenoSpecialu, 0);
    listaKalendare.naplnit([...desetileti].map(([dekada, pocet]) => ({ klic: dekada, nazev: `${dekada}–${dekada + 9}`, pocet })));
    calList.innerHTML = prepinacEdic(celkemVydani) + `
        <p class="cal-legend">Linky na obálce zleva: <i></i> cover <i></i> centerfold <i></i> pictorial. Prázdné políčko = číslo ve sbírce chybí.</p>
        ${radky.join('') || htmlNicNenalezeno('Hledání neodpovídá žádné číslo.')}
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
// Po zápisu se kalendář obnoví, jen když je pořád vidět (uživatel mezitím mohl odejít jinam)
const obnovitKalendar = () => { if (!calendar.classList.contains('hidden')) nacistKalendar(searchInput.value, true); };

// Nabídka čísla, všude stejná (kalendář, Čísla, Přehled, ročník): otevřít a upravit, přidat jen to, co číslu chybí,
// a stav čísla s ✓ u současného (druhý klik ho zruší). Výtisky se sbírají jen u české edice, americká má jen „nezajímá mě“.
// navic: další položky za přidáváním (akce coveru na stránce Čísla); poZmene obnoví stránku po označení stavu.
// Nabídka se otevře až po načtení dat; mezitím mohl uživatel otevřít jinou nabídku čísla nebo přejít jinam
let poradiNabidkyCisla = 0;
const zobrazenyPohled = () => [...document.querySelector('main').children].find(e => !e.classList.contains('hidden'));
export async function nabidkaCisla(klic, x, y, { navic = [], poZmene = obnovitKalendar } = {}) {
    const moje = ++poradiNabidkyCisla;
    const pohled = zobrazenyPohled();
    // Kalendář má data přehledu Čísla také (stav.coveryData), stačí je vzít
    const [kalendar, stavy] = await Promise.all([stav.kalendarData || stav.coveryData?.[0] || GetKalendar().then(k => k || []),
        stav.stavyVydaniData || stav.coveryData?.[1] || GetStavyVydani().then(s => s || [])]);
    if (moje !== poradiNabidkyCisla || zobrazenyPohled() !== pohled) return;
    const data = kalendar.find(k => k.vydani === klic);
    const casti = rozlozitVydani(klic);
    const soucasny = stavy.find(s => s.vydani === klic)?.stav || '';
    const oznacit = (hodnota, text) => ({ text: `${soucasny === hodnota ? '✓ ' : ''}${text}`, akce: async () => {
        await SetStavVydani(klic, soucasny === hodnota ? '' : hodnota);
        poZmene();
    } });
    otevritKontextovouNabidku(x, y, [
        { nadpis: nazevVydani(klic) },
        ...(data ? [{ text: 'Otevřít číslo', akce: () => otevritVydani(klic) }] : []),
        { text: 'Upravit číslo…', akce: () => upravitVydani(klic) },
        null,
        // Ročník (bez měsíce) nemá cover ani centerfold, jen pictorial
        ...(casti?.mesic && !data?.cover ? [{ text: 'Přidat cover…', akce: () => otevritCoverModal(null, klic) }] : []),
        ...(casti?.mesic && !data?.centerfold ? [{ text: 'Přidat centerfold…', akce: () => pridatCenterfold(klic) }] : []),
        ...(!data?.pictorial ? [{ text: 'Přidat pictorial…', akce: () => pridatPictorial(klic) }] : []),
        null,
        ...navic,
        null,
        // Americká edice výtisky nenabízí, už nastavený stav ale jde zrušit
        ...(casti?.edice === 'CZ' || soucasny === 'mam' ? [oznacit('mam', 'Mám výtisk')] : []),
        ...(casti?.edice === 'CZ' || soucasny === 'shanim' ? [oznacit('shanim', 'Sháním')] : []),
        oznacit('nezajima', 'Nezajímá mě'),
    ]);
}

// Nabídka ročníku (nadpis roku v kalendáři): celý ročník a nový speciál
export function nabidkaRoku(klic, x, y) {
    const { rok, edice } = rozlozitVydani(klic);
    otevritKontextovouNabidku(x, y, [
        { nadpis: `Ročník ${rok}${edice !== VYCHOZI_EDICE ? ` · ${edice}` : ''}` },
        { text: 'Otevřít ročník', akce: () => otevritVydani(klic) },
        { text: 'Přidat pictorial k ročníku', akce: () => pridatPictorial(klic) },
        { text: `Nový speciál roku ${rok}…`, akce: async () => { if (await zalozitSpecial(rok, edice)) obnovitKalendar(); } },
    ]);
}

// Rozbalené řady prázdných roků (klíč „od-do")
export const rozbaleneMezery = new Set();

// Listování obsahem čísla na kartě: když myš chvíli zůstane na kartě, střídá se cover, centerfold a pictorial
// (nejlépe hodnocená fotka); linka dole ukazuje, co je právě vidět. Obsah čísla se načte až při prvním najetí.
const PRODLEVA_LISTOVANI = 500;
const INTERVAL_LISTOVANI = 1200;
const obsahCisel = new Map();
let listovani = null;

async function snimkyCisla(klic) {
    if (!obsahCisel.has(klic)) {
        obsahCisel.set(klic, GetVydani(klic).then(fotky => {
            const sUrl = (fotky || []).filter(f => f.url);
            const prvni = typ => sUrl.filter(f => f.typ === typ).sort((a, b) => (a.poradi || 0) - (b.poradi || 0))[0];
            const pictorial = sUrl.filter(f => f.typ !== 'Cover' && f.typ !== 'Centerfold')
                .sort((a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || (a.poradi || 0) - (b.poradi || 0))[0];
            // Pořadí jako linky na kartě: 0 cover, 1 centerfold, 2 pictorial
            return [{ linka: 0, f: prvni('Cover') }, { linka: 1, f: prvni('Centerfold') }, { linka: 2, f: pictorial }]
                .filter(s => s.f).map(s => ({ linka: s.linka, url: obrazek(s.f.url, 'w300') }));
        }).catch(() => []));
    }
    return obsahCisel.get(klic);
}

function zastavitListovani() {
    if (!listovani) return;
    clearTimeout(listovani.casovac);
    clearInterval(listovani.interval);
    const { bunka, puvodni } = listovani;
    bunka.querySelector('.cal-dalsi')?.remove();
    const img = bunka.querySelector('img');
    if (img && puvodni) img.src = puvodni;
    bunka.querySelectorAll('.cal-linky i.ted').forEach(i => i.classList.remove('ted'));
    listovani = null;
}

function spustitListovani(bunka) {
    const img = /** @type {HTMLImageElement} */ (bunka.querySelector('img'));
    if (!img) return;
    const stavListovani = listovani = { bunka, puvodni: img.getAttribute('src'), casovac: 0, interval: 0 };
    stavListovani.casovac = setTimeout(async () => {
        const snimky = await snimkyCisla(bunka.dataset.vydani);
        if (listovani !== stavListovani || snimky.length < 2) return;
        // Začne obrázkem, který karta ukazuje (bývá to cover), a pokračuje dalším
        let index = Math.max(0, snimky.findIndex(s => s.url === stavListovani.puvodni));
        const linky = bunka.querySelectorAll('.cal-linky i');
        const ukazat = (i) => {
            linky.forEach((l, k) => l.classList.toggle('ted', k === snimky[i].linka));
            // Prolnutí: nový obrázek nad starým, po načtení se zviditelní a pak nahradí spodní
            const dalsi = document.createElement('img');
            dalsi.className = 'cal-dalsi';
            dalsi.draggable = false;
            dalsi.onload = () => {
                if (listovani !== stavListovani) return;
                requestAnimationFrame(() => dalsi.classList.add('viditelny'));
                setTimeout(() => {
                    if (listovani !== stavListovani) return;
                    img.src = snimky[i].url;
                    dalsi.remove();
                }, 400);
            };
            dalsi.src = snimky[i].url;
            bunka.querySelector('.cal-dalsi')?.remove();
            img.after(dalsi);
        };
        ukazat(index);
        stavListovani.interval = setInterval(() => {
            index = (index + 1) % snimky.length;
            ukazat(index);
        }, INTERVAL_LISTOVANI);
    }, PRODLEVA_LISTOVANI);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Listování obsahem čísla při podržení myši na kartě
    calendar.addEventListener('mouseover', (e) => {
        const bunka = /** @type {HTMLElement} */ (e.target).closest('.cal-cell[data-vydani]');
        if (bunka === listovani?.bunka) return;
        zastavitListovani();
        if (bunka) spustitListovani(bunka);
    });
    calendar.addEventListener('mouseleave', zastavitListovani);
    // Kliknutí nebo nové vykreslení listování ukončí
    calendar.addEventListener('mousedown', zastavitListovani, true);

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
        nabidkaCisla(prazdne.dataset.prazdne, misto.left, misto.bottom + 4);
    });
}
