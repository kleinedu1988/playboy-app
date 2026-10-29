// Přepínání pohledů, historie pro Zpět a společné pomocné funkce
import { esc, nazevVydani } from '../lib/format';
import { oznamit } from '../ui/oznameni';
import { OveritOdkaz } from './backend';
import { stav } from './stav';
import { backBtn, best, calendar, calList, covers, coversList, detailView, gallery, issueView, searchInput, stats, wall } from './prvky';
import { nacistGalerii } from './galerie';
import { otevritDetailModelky } from './profil';
import { otevritFotografa, otevritVydani } from './vydani';
import { zrusitVyber } from './vyber';
import { obnovitVolby, prizpusobitListu } from '../ui/volby';
import { vsechnyModelky } from './mezipamet';
import { prestatNacitat } from './obrazky';
import { prestatSledovatKonce } from './nejlepsi';
import { zrusitHledani } from './naseptavac';
import { nastavitPohledSlavy, pohledSlavy } from './sin-slavy';
import { nastavitCastOblibenosti } from './oblibenost';
import { obnovitPasHlavicky } from './prehled';

// Přehledy se seznamy (galerie, stěna, čísla, kalendář, nejlepší) se při každém zobrazení vykreslují celé znovu.
// Skryté by jen držely tisíce karet a fotek, které zpomalují každou další akci (úklid paměti, hledání v dokumentu,
// zásah myší), proto se jejich obsah po odchodu zahodí. Až v další úloze, po vykreslení nového pohledu,
// a jen když se přehled mezitím znovu neukázal. Profil, stránka vydání a Přehled (zapisuje se na místo) zůstávají.
const OBSAH_PREHLEDU = new Map([[gallery, gallery], [wall, wall], [covers, coversList], [calendar, calList], [best, document.getElementById('bestList')]]);
function uvolnitPozdeji(opoustene) {
    if (!opoustene.length) return;
    setTimeout(() => opoustene.forEach((pohled) => {
        if (!pohled.classList.contains('hidden')) return;
        const obsah = OBSAH_PREHLEDU.get(pohled);
        prestatNacitat(obsah);
        if (pohled === best) prestatSledovatKonce();
        obsah.replaceChildren();
    }), 0);
}

// Vždy je vidět jeden pohled; profil modelky a stránka vydání mají navíc v řádku okna tlačítko zpět
export function ukazatPohled(pohled) {
    // Výběr fotek a úprava výřezu na kartě patří k pohledu, ve kterém vznikly; při odchodu se zruší
    if (document.querySelector('.photo-item.vybrana, .poster.vybrana')) zrusitVyber();
    if (pohled !== gallery && stav.zrusitUpravuVyrezu) stav.zrusitUpravuVyrezu();
    uvolnitPozdeji([...OBSAH_PREHLEDU.keys()].filter(p => p !== pohled && !p.classList.contains('hidden')));
    [gallery, wall, covers, calendar, stats, best, detailView, issueView].forEach(p => p.classList.toggle('hidden', p !== pohled));
    const podstranka = pohled === detailView || pohled === issueView;
    // Zpět je vidět na podstránkách a v přehledu, kam se přešlo hledáním z profilu nebo vydání
    backBtn.classList.toggle('hidden', !podstranka && !historie.length);
    // Šipky na předchozí a další modelku jen v profilu otevřeném ze seznamu (galerie, pořadí, Top 10…)
    const listovat = pohled === detailView && !!stav.seznamProfilu;
    document.getElementById('prevModelBtn').classList.toggle('hidden', !listovat);
    document.getElementById('nextModelBtn').classList.toggle('hidden', !listovat);
    // Záložky přehledů zůstávají vidět i na podstránce (jedním klikem jinam); zvolená je tam jen tlumená
    prepinacRezimu.classList.toggle('podstranka', podstranka);
    zvyraznitRezim();
    // Pilulky podčástí (Oblíbenost, Sbírka) a volby v liště patří ukázanému přehledu; profil a stránka vydání žádné nemají
    obnovitPasHlavicky(pohled);
    obnovitVolby(pohled);
    backBtn.innerHTML = `&larr; ${esc(popisZpet())}`;
    backBtn.title = `Zpět: ${popisZpet()} (Esc, Alt+šipka vlevo)`;
    ukazatDrobecek(pohled);
    // Lišta písmen patří jen ke galerii modelek, lišta desetiletí jen ke stěně
    if (pohled !== gallery) document.getElementById('galleryNav')?.classList.add('hidden');
    if (pohled !== wall) document.getElementById('wallNav')?.classList.add('hidden');
    // Fokus ve skrytém pohledu (Enter na kartě, Zpět) by zůstal nikde: dostane ho nový pohled, další Tab jde do něj.
    // Hledání a lišta nahoře fokus nechávají.
    const aktivni = document.activeElement;
    if (!aktivni || aktivni === document.body || (hlavniOblast.contains(aktivni) && !pohled.contains(aktivni))) {
        pohled.tabIndex = -1;
        pohled.focus({ preventScroll: true });
    }
}

const hlavniOblast = document.querySelector('main');

// Drobečky v řádku okna: „← odkud › kde jsem“, u profilu i kolikátá modelka v seznamu (‹ 3 z 22 ›)
function ukazatDrobecek(pohled) {
    const drobecek = document.getElementById('drobecek');
    const poradi = document.getElementById('poradiModelky');
    let nazev = '';
    if (pohled === detailView) nazev = stav.aktualniModelka?.jmeno || '';
    else if (pohled === issueView) nazev = stav.aktualniFotograf || (stav.aktualniVydani ? nazevVydani(stav.aktualniVydani) : '');
    drobecek.textContent = nazev;
    drobecek.title = nazev;
    drobecek.classList.toggle('hidden', !nazev);
    const seznam = stav.seznamProfilu || [];
    const index = pohled === detailView ? seznam.indexOf(stav.aktualniModelka?.id) : -1;
    poradi.textContent = index >= 0 && seznam.length > 1 ? `${index + 1} z ${seznam.length}` : '';
    poradi.classList.toggle('hidden', !poradi.textContent);
    document.querySelector('.logo')?.classList.toggle('hidden', backBtn.classList.contains('hidden') && !nazev);
}

// Prvek s fokusem jako selektor, aby se po návratu Zpět dal najít i v nově vykresleném pohledu
const ATRIBUTY_FOKUSU = ['data-id', 'data-index', 'data-vydani', 'data-prazdne', 'data-cislo', 'data-modelka', 'data-album', 'data-otevrit-modelku'];
function selektorFokusu() {
    const a = document.activeElement;
    if (!a || !hlavniOblast.contains(a)) return '';
    const atribut = ATRIBUTY_FOKUSU.find(at => a.hasAttribute(at));
    return atribut ? `${a.classList[0] ? `.${CSS.escape(a.classList[0])}` : a.tagName.toLowerCase()}[${atribut}="${CSS.escape(a.getAttribute(atribut))}"]` : '';
}

// Historie pro Zpět: kam se vrátit a na jaké místo stránky
export const historie = [];
// Kalendář je zobrazení Čísel: Zpět se jmenuje podle záložky
export const NAZVY_REZIMU = { modelky: 'Modelky', centerfoldy: 'Centerfoldy', covery: 'Čísla', kalendar: 'Čísla', nejlepsi: 'Nejlepší', prehled: 'Sbírka' };
// Přehled má tři stránky (tlačítka vpravo v liště); Zpět se jmenuje podle té, ze které se odešlo
// Přehled má stránky Hodnocení a Síň slávy (Oblíbenost) a Sbírku s částmi; Zpět se jmenuje podle té, ze které se
// odešlo (úvod Sbírky je prostě „Sbírka“)
const NAZVY_STRANEK = { hodnoceni: 'Hodnocení', slava: 'Síň slávy', uvod: 'Sbírka', udrzba: 'Údržba', shanim: 'Sháním CZ', statistiky: 'Statistiky' };
const strankaPrehledu = ({ sekce, cast }) => NAZVY_STRANEK[sekce === 'oblibenost' ? cast : sekce] || NAZVY_REZIMU.prehled;

export function popisZpet() {
    const misto = historie[historie.length - 1];
    if (misto?.typ === 'profil') return misto.modelka.jmeno;
    if (misto?.typ === 'vydani') return nazevVydani(misto.vydani);
    if (misto?.typ === 'fotograf') return misto.jmeno;
    if (misto?.rezim === 'prehled') return strankaPrehledu(misto.prehled);
    if (!misto && stav.rezim === 'prehled') return strankaPrehledu({ sekce: stav.prehledSekce, cast: stav.oblibenostCast });
    return NAZVY_REZIMU[misto?.rezim || stav.rezim];
}

export function soucasneMisto() {
    const scroll = document.querySelector('main').scrollTop;
    const fokus = selektorFokusu();
    if (!detailView.classList.contains('hidden')) return { typ: 'profil', modelka: stav.aktualniModelka, seznam: stav.seznamProfilu, scroll, fokus };
    if (!issueView.classList.contains('hidden')) return stav.aktualniFotograf ? { typ: 'fotograf', jmeno: stav.aktualniFotograf, scroll, fokus } : { typ: 'vydani', vydani: stav.aktualniVydani, scroll, fokus };
    // V Přehledu i stránka a část, aby Zpět vrátilo přesně tam (Údržba, Kronika…)
    const prehled = stav.rezim === 'prehled'
        ? { sekce: stav.prehledSekce, cast: stav.oblibenostCast, pohled: stav.hodnoceniPohled, slava: pohledSlavy() } : null;
    return { typ: 'prehled', rezim: stav.rezim, prehled, scroll, fokus };
}

// Před otevřením profilu nebo vydání se zapamatuje, odkud se přišlo (ne při návratu na totéž místo)
export function zapamatovatMisto(cil) {
    const misto = soucasneMisto();
    if ((misto.typ === 'profil' && cil.modelka?.id === misto.modelka?.id) || (misto.typ === 'vydani' && cil.vydani === misto.vydani)
        || (misto.typ === 'fotograf' && cil.fotograf === misto.jmeno)) return;
    historie.push(misto);
    if (historie.length > 50) historie.shift();
}

export async function zpet() {
    // Profil modelky, která mezitím zmizela (smazaná, sloučená), se přeskočí; jinak aktuální údaje modelky
    let misto = historie.pop();
    while (misto?.typ === 'profil') {
        const aktualni = (await vsechnyModelky()).find(m => m.id === misto.modelka.id);
        if (aktualni) {
            misto = { ...misto, modelka: aktualni };
            break;
        }
        misto = historie.pop();
    }
    const hlavni = document.querySelector('main');
    if (misto?.typ === 'profil') {
        stav.seznamProfilu = misto.seznam || null;
        await otevritDetailModelky(misto.modelka, { bezHistorie: true });
    } else if (misto?.typ === 'vydani') {
        await otevritVydani(misto.vydani, { bezHistorie: true });
    } else if (misto?.typ === 'fotograf') {
        await otevritFotografa(misto.jmeno, { bezHistorie: true });
    } else {
        if (misto?.prehled) {
            stav.prehledSekce = misto.prehled.sekce;
            nastavitCastOblibenosti(misto.prehled.pohled);
            if (misto.prehled.cast === 'slava') nastavitCastOblibenosti('slava');
            nastavitPohledSlavy(misto.prehled.slava);
        }
        if (misto) prepnoutRezim(misto.rezim);
        await nacistGalerii(searchInput.value);
    }
    // Stejné místo stránky, ze kterého se odešlo, a fokus na prvku, ze kterého se odešlo (karta, dlaždice…)
    if (misto) requestAnimationFrame(() => {
        hlavni.scrollTop = misto.scroll;
        if (misto.fokus) document.querySelector(misto.fokus)?.focus({ preventScroll: true });
    });
}
export const viewToggle = document.getElementById('viewToggle');
// Všechna tlačítka přehledů v horní liště
export const prepinacRezimu = document.querySelector('.navbar');

// Shrnutí vložení odkazů: co se uložilo a co bylo odmítnuto
export function oznamitVlozeni(v, co) {
    const casti = [`Přidáno ${co}: ${v.vlozeno}.`];
    if (v.nedostupne) casti.push(`Nefunkčních odkazů (smazané nebo nesdílené soubory): ${v.nedostupne} – neuloženy.`);
    if (v.duplicitni) casti.push(`Už uložených: ${v.duplicitni} – přeskočeny.`);
    if (v.neovereno) casti.push(`Bez ověření kvůli připojení: ${v.neovereno}.`);
    if (v.vlozeno === 0 && !v.nedostupne && !v.duplicitni) casti[0] = 'Ve vloženém textu nebyl žádný odkaz na Google Disk.';
    oznamit(casti.join(' '));
}

// Odkaz na složku Disku program neumí rozbalit na fotky; místo „nefunkčního odkazu" řekne proč
export function jeOdkazNaSlozku(text) {
    if (!/\/folders\//.test(text)) return false;
    oznamit('Odkaz vede na složku Disku. Vlož odkazy na jednotlivé fotky – složku program nerozbalí.');
    return true;
}

// Odkaz, který Disk nevrací jako obrázek, se neuloží
export async function odkazJeVPoradku(odkaz) {
    if (!odkaz.trim()) return true;
    if (jeOdkazNaSlozku(odkaz)) return false;
    if (await OveritOdkaz(odkaz) !== 0) return true;
    oznamit('Tento odkaz nefunguje – soubor na Google Disku je smazaný, není sdílený „kdokoli s odkazem“, nebo to není obrázek.');
    return false;
}

// Výřez titulní fotky: poloha v procentech a přiblížení kolem téhož bodu (transform jen při přiblížení, aby
// nepřiblížené karty nevytvářely stovky zbytečných kompozitních vrstev)
export function stylVyrezu({ coverZoom = 1, coverX = 50, coverY = 50 }) {
    const pos = coverX !== 50 || coverY !== 50 ? `object-position: ${coverX}% ${coverY}%;` : '';
    const zoom = coverZoom !== 1 ? ` transform-origin: ${coverX}% ${coverY}%; transform: scale(${coverZoom});` : '';
    return (pos + zoom).trim();
}

// Každý přehled si pamatuje své hledání; text z Modelek by v kalendáři filtroval roky
export const hledaniPodleRezimu = {};

// Hledání prohledává v každém přehledu něco jiného; pole to říká textem a nápovědou
const HLEDANI_PODLE_REZIMU = {
    modelky: ['Hledat modelku…', document.getElementById('searchInput').title],
    centerfoldy: ['Hledat v centerfoldech…', 'Centerfoldy: jméno modelky, vydání (např. březen 1995), fotograf. Více slov zužuje výběr.'],
    covery: ['Hledat v číslech…', 'Čísla: vydání (např. 1995), název, modelka nebo obálka. Více slov zužuje výběr.'],
    kalendar: ['Hledat v číslech…', 'Kalendář: ročníky podle čísla (1975), měsíce i jména modelek a speciálů.'],
    nejlepsi: ['Hledat v nejlepších fotkách…', 'Nejlepší fotky: jméno modelky, vydání, fotograf. Více slov zužuje výběr.'],
    // Na stránkách Hodnocení, Síň slávy a Sbírka hledání najde modelku a otevře její profil (výsledky pod polem)
    prehled: ['Najít modelku…', 'Jméno modelky, číslo nebo článek; Enter otevře první výsledek. Do hledání skočíš klávesami Ctrl+F.'],
};

// Čísla mají dvě zobrazení: Obálky (přehled 'covery') a Kalendář (přehled 'kalendar'); volba v liště voleb,
// záložka Čísla otevře naposledy zvolené
export function zobrazeniCisel() {
    try { return localStorage.getItem('zobrazeniCisel') === 'kalendar' ? 'kalendar' : 'obalky'; } catch { return 'obalky'; }
}
// Štítky volby Zobrazení na začátku řádku voleb (ui/volby.js z nich složí rozbalovací volbu)
export const htmlZobrazeniCisel = aktivni => [['obalky', 'Obálky'], ['kalendar', 'Kalendář']]
    .map(([klic, nazev]) => `<button class="chip ${klic === aktivni ? 'active' : ''}" data-zobrazeni-cisel="${klic}">${nazev}</button>`).join('');

// Přepínač řádku s kapslí hledat (tlačítko lupy v kontextové liště)
export function nastavitViditelnostHledani(videt, { zamerit = false } = {}) {
    const radek = document.getElementById('hledaniRadek');
    const prepinac = document.getElementById('searchToggleBtn');
    if (!radek || !prepinac) return;
    radek.classList.toggle('hidden', !videt);
    prepinac.classList.toggle('active', videt);
    prepinac.setAttribute('aria-expanded', String(videt));
    if (!videt) {
        zrusitHledani();
    } else if (zamerit) {
        searchInput.focus();
        searchInput.select();
    }
}

export function prepnoutHledani() {
    const radek = document.getElementById('hledaniRadek');
    const videt = Boolean(radek?.classList.contains('hidden'));
    nastavitViditelnostHledani(videt, { zamerit: videt });
}

export function prepnoutRezim(novy) {
    const [text, napoveda] = HLEDANI_PODLE_REZIMU[novy] || HLEDANI_PODLE_REZIMU.modelky;
    searchInput.placeholder = text;
    searchInput.title = napoveda;
    if (novy !== stav.rezim) {
        hledaniPodleRezimu[stav.rezim] = searchInput.value;
        // Na stránkách Přehledu hledání nic nefiltruje, text se tam nepamatuje
        searchInput.value = novy === 'prehled' ? '' : hledaniPodleRezimu[novy] || '';
    }
    // Staré výsledky hledání pod polem (a rozběhnuté hledání) patří předchozímu přehledu
    zrusitHledani();
    stav.rezim = novy;
    zvyraznitRezim();
    if (novy === 'covery' || novy === 'kalendar') {
        try { localStorage.setItem('zobrazeniCisel', novy === 'kalendar' ? 'kalendar' : 'obalky'); } catch { /* jen pro toto spuštění */ }
    }
    // Při příštím spuštění se program otevře ve stejném přehledu
    try { localStorage.setItem('posledniRezim', novy); } catch { /* bez úložiště se jen nezapamatuje */ }
    document.querySelector('main').scrollTop = 0;
}

// Svítí záložka otevřeného přehledu (Kalendář je zobrazení Čísel, Nejlepší je část Oblíbenosti); v Přehledu záložka
// Oblíbenost nebo Sbírka. Čtečky obrazovky ji poznají podle aria-current (na profilu a stránce čísla jen „true“).
export function zvyraznitRezim() {
    const novy = stav.rezim;
    const stranka = stav.prehledSekce === 'oblibenost' ? 'oblibenost' : 'sprava';
    prepinacRezimu.querySelectorAll('[data-rezim]').forEach((b) => {
        const zvoleny = novy === 'prehled'
            ? b.dataset.rezim === 'prehled' && b.dataset.castPrehledu === stranka
            : novy === 'nejlepsi'
                ? b.dataset.castPrehledu === 'oblibenost'
                : b.dataset.rezim === novy || (novy === 'kalendar' && b.dataset.rezim === 'covery');
        b.classList.toggle('active', zvoleny);
        if (zvoleny) b.setAttribute('aria-current', prepinacRezimu.classList.contains('podstranka') ? 'true' : 'page');
        else b.removeAttribute('aria-current');
    });
    prizpusobitListu();
}

// Lišta se přizpůsobí při každé změně šířky lišty nebo voleb uprostřed (i po načtení písma). Spodní hrana hlavičky
// (v úzkém okně má lišta víc řádků) posouvá rejstříky u pravého okraje (--pod-hlavickou).
const hlavicka = document.querySelector('.navbar');
const sledovatListu = new ResizeObserver(() => {
    prizpusobitListu();
    document.documentElement.style.setProperty('--pod-hlavickou', `${Math.round(hlavicka.getBoundingClientRect().bottom)}px`);
});
[hlavicka, document.getElementById('volbyPrehledu')].forEach(p => sledovatListu.observe(p));
document.fonts?.ready.then(() => prizpusobitListu());
