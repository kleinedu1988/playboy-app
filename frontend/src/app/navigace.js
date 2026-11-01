// Přepínání pohledů, historie pro Zpět a společné pomocné funkce
import { esc, nazevVydani, rozlozitVydani, slozitVydani } from '../lib/format';
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
import { hledaniFiltruje, zrusitHledani } from './naseptavac';
import { zavritPanelFiltru } from './filtr-modelek';
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
    // Zpět ukazuje celou cestu jako navigační kapsle: sekce › část (Hodnocení › Pořadí), nebo modelka, číslo
    backBtn.innerHTML = `<span class="nav-zpet-sipka" aria-hidden="true">&larr;</span><span class="nav-cesta">${cestaZpet().map(esc).join('<span class="nav-oddel" aria-hidden="true">›</span>')}</span>`;
    backBtn.title = `Zpět: ${popisZpet()} (Esc, Alt+šipka vlevo)`;
    ukazatDrobecek(pohled);
    // Na profil a číslo se řádek otevřený pro přehled nepřenáší; po návratu ho drží text, který přehled omezuje
    if (podstranka) hledaniOtevrel = false;
    obnovitViditelnostHledani();
    // Lišta písmen patří jen ke galerii modelek, lišta desetiletí jen ke stěně
    if (pohled !== gallery) document.getElementById('galleryNav')?.classList.add('hidden');
    if (pohled !== wall) document.getElementById('wallNav')?.classList.add('hidden');
    // Lišta alb profilu je ve druhém řádku hlavičky; jinde ji nikdo nenaplní, proto se skryje (a režim výběru skončí)
    document.getElementById('profilPruh')?.classList.toggle('hidden', pohled !== detailView);
    if (pohled !== detailView) document.querySelector('.navbar')?.classList.remove('profil-svinuty');
    if (pohled !== detailView) {
        document.getElementById('albumNav')?.classList.add('hidden');
        document.body.classList.remove('rezim-vyberu');
    }
    // Fokus ve skrytém pohledu (Enter na kartě, Zpět) by zůstal nikde: dostane ho nový pohled, další Tab jde do něj.
    // Hledání a lišta nahoře fokus nechávají.
    const aktivni = document.activeElement;
    if (!aktivni || aktivni === document.body || (hlavniOblast.contains(aktivni) && !pohled.contains(aktivni))) {
        pohled.tabIndex = -1;
        pohled.focus({ preventScroll: true });
    }
}

const hlavniOblast = document.querySelector('main');

// Drobečky ve druhém řádku: „← odkud (sekce › část) › [ročník ›] kde jsem ▾ │ ‹ 3 z 22 ›“. U profilu otevřeného
// ze seznamu otevře jméno nabídku modelek seznamu (jako klik na zvolenou sekci v navigační kapsli), u čísla
// s měsícem je před ním jeho ročník.
function ukazatDrobecek(pohled) {
    const drobecek = document.getElementById('drobecek');
    const rocnik = document.getElementById('rocnikBtn');
    const poradi = document.getElementById('poradiModelky');
    let nazev = '';
    if (pohled === detailView) nazev = stav.aktualniModelka?.jmeno || '';
    else if (pohled === issueView) nazev = stav.aktualniFotograf || (stav.aktualniVydani ? nazevVydani(stav.aktualniVydani) : '');
    drobecek.textContent = nazev;
    drobecek.classList.toggle('hidden', !nazev);
    const sNabidkou = pohled === detailView && (stav.seznamProfilu?.length || 0) > 1;
    drobecek.classList.toggle('s-nabidkou', sNabidkou);
    // V profilu je jméno v pruhu s modelkou (součást panelu); drobeček zůstane jen pro nabídku modelek seznamu
    drobecek.classList.toggle('v-pruhu', pohled === detailView);
    drobecek.disabled = !sNabidkou;
    drobecek.title = sNabidkou ? `${nazev} – další modelky seznamu` : nazev;
    if (sNabidkou) drobecek.setAttribute('aria-haspopup', 'menu');
    else drobecek.removeAttribute('aria-haspopup');
    const casti = pohled === issueView && !stav.aktualniFotograf ? rozlozitVydani(stav.aktualniVydani) : null;
    const klicRocniku = casti?.mesic ? slozitVydani(casti.rok, '', casti.edice) : '';
    rocnik.classList.toggle('hidden', !klicRocniku);
    rocnik.dataset.vydani = klicRocniku;
    rocnik.textContent = klicRocniku ? `Ročník ${casti.rok}` : '';
    rocnik.title = klicRocniku ? `Celý ročník ${casti.rok}` : '';
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
export const NAZVY_REZIMU = { modelky: 'Modelky', centerfoldy: 'Čísla', covery: 'Čísla', kalendar: 'Čísla', nejlepsi: 'Modelky', prehled: 'Sbírka' };
// Části Sbírky (a Hodnocení, Síně slávy) v cestě Zpět; úvod Sbírky je prostě „Sbírka“
const NAZVY_STRANEK = { hodnoceni: 'Hodnocení', slava: 'Síň slávy', uvod: 'Sbírka', udrzba: 'Údržba', shanim: 'Sháním CZ', statistiky: 'Statistiky' };

// Cesta, kam vede Zpět, stejnými názvy jako navigační kapsle: sekce › část, u podstránky modelka, číslo, fotograf
const CASTI_REZIMU = { modelky: ['Modelky', 'Profily'], nejlepsi: ['Modelky', 'Galerie'], covery: ['Čísla', 'Obálky'], kalendar: ['Čísla', 'Kalendář'], centerfoldy: ['Čísla', 'Centerfoldy'] };
const POHLEDY_HODNOCENI = { porovnat: 'Porovnat', fotky: 'Fotky', poradi: 'Pořadí' };
function cestaPrehledu({ sekce, cast, pohled }) {
    if (sekce === 'oblibenost') return ['Hodnocení', cast === 'slava' ? 'Síň slávy' : POHLEDY_HODNOCENI[pohled] || 'Porovnat'];
    return NAZVY_STRANEK[sekce] && sekce !== 'uvod' ? ['Sbírka', NAZVY_STRANEK[sekce]] : ['Sbírka'];
}
export function cestaZpet() {
    const misto = historie[historie.length - 1];
    if (misto?.typ === 'profil') return [misto.modelka.jmeno];
    if (misto?.typ === 'vydani') return [nazevVydani(misto.vydani)];
    if (misto?.typ === 'fotograf') return [misto.jmeno];
    if (misto?.rezim === 'prehled') return cestaPrehledu(misto.prehled);
    if (!misto && stav.rezim === 'prehled') return cestaPrehledu({ sekce: stav.prehledSekce, cast: stav.oblibenostCast, pohled: stav.hodnoceniPohled });
    return CASTI_REZIMU[misto?.rezim || stav.rezim] || [NAZVY_REZIMU[misto?.rezim || stav.rezim] || 'Modelky'];
}
export const popisZpet = () => cestaZpet().join(' › ');

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
    nejlepsi: ['Hledat v galerii fotek…', 'Galerie nejlepších: jméno modelky, vydání, fotograf. Více slov zužuje výběr.'],
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

// Řádek s kapslí hledat pod drobečky (tlačítko lupy, Ctrl+F). Otevřený ho drží buď uživatel, nebo text, který
// právě omezuje přehled (vlasy:blond v Modelkách, hledání ve frontě Údržby): takový řádek se neschová, dokud
// text nikdo nesmaže, a po návratu z profilu nebo čísla je zase vidět. Na podstránce (profil, číslo) text nic
// nefiltruje, tam se řádek řídí jen lupou.
let hledaniOtevrel = false;
export function nastavitViditelnostHledani(videt, { zamerit = false } = {}) {
    hledaniOtevrel = videt;
    obnovitViditelnostHledani();
    if (!videt) {
        zrusitHledani();
    } else if (zamerit) {
        searchInput.focus();
        searchInput.select();
    }
}

// psani: změna textu v poli; otevřený řádek pak zůstane i po smazání textu (×), dokud ho nezavře lupa nebo Esc
export function obnovitViditelnostHledani({ psani = false } = {}) {
    const radek = document.getElementById('hledaniRadek');
    const prepinac = document.getElementById('searchToggleBtn');
    if (!radek || !prepinac) return;
    if (psani && !radek.classList.contains('hidden')) hledaniOtevrel = true;
    const filtruje = hledaniFiltruje();
    const videt = hledaniOtevrel || filtruje;
    radek.classList.toggle('hidden', !videt);
    radek.classList.toggle('filtruje', filtruje);
    prepinac.classList.toggle('active', videt);
    prepinac.setAttribute('aria-expanded', String(videt));
    prepinac.title = filtruje ? 'Hledání omezuje přehled – smaž text (×), aby šlo řádek zavřít (Ctrl+F)' : 'Hledat (Ctrl+F)';
}

// Lupa: otevře řádek a skočí do pole; otevřený zavře, jen když jeho text nic neomezuje (jinak skočí do pole)
export function prepnoutHledani() {
    const radek = document.getElementById('hledaniRadek');
    const videt = Boolean(radek?.classList.contains('hidden')) || hledaniFiltruje();
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
    // Panel filtru Modelek (app/filtr-modelek.js) patří jen Modelkám
    if (novy !== 'modelky') zavritPanelFiltru();
    zvyraznitRezim();
    obnovitViditelnostHledani();
    if (novy === 'covery' || novy === 'kalendar') {
        try { localStorage.setItem('zobrazeniCisel', novy === 'kalendar' ? 'kalendar' : 'obalky'); } catch { /* jen pro toto spuštění */ }
    }
    // Při příštím spuštění se program otevře ve stejném přehledu
    try { localStorage.setItem('posledniRezim', novy); } catch { /* bez úložiště se jen nezapamatuje */ }
    document.querySelector('main').scrollTop = 0;
}

// Svítí záložka otevřené hlavní sekce (Modelky, Čísla, Sbírka); podstránky (Galerie, Síň slávy, Kalendář, Centerfoldy)
// patří své hlavní sekci. Čtečky obrazovky ji poznají podle aria-current (na profilu a stránce čísla jen „true“).
export function zvyraznitRezim() {
    const novy = stav.rezim;
    prepinacRezimu.querySelectorAll('[data-rezim]').forEach((b) => {
        let zvoleny = false;
        // Sekce: Modelky (profily, galerie), Čísla (obálky, kalendář, centerfoldy), Hodnocení (Oblíbenost i Síň slávy),
        // Sbírka (ostatní části Přehledu)
        const vOblibenosti = novy === 'prehled' && stav.prehledSekce === 'oblibenost';
        if (b.dataset.rezim === 'modelky') {
            zvoleny = novy === 'modelky' || novy === 'nejlepsi';
        } else if (b.dataset.rezim === 'covery') {
            zvoleny = novy === 'covery' || novy === 'kalendar' || novy === 'centerfoldy';
        } else if (b.dataset.sekce === 'hodnoceni') {
            zvoleny = vOblibenosti;
        } else if (b.dataset.rezim === 'prehled') {
            zvoleny = novy === 'prehled' && !vOblibenosti;
        }
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
[hlavicka, document.getElementById('volbyPrehledu'), document.querySelector('.hlavni-lista'), document.querySelector('.hlavni-lista > .logo'), document.getElementById('podmenu')]
    .forEach(p => p && sledovatListu.observe(p));
document.fonts?.ready.then(() => prizpusobitListu());
