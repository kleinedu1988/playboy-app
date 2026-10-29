// Galerie modelek, srdíčka, filtr hodnocení a krokování mezi modelkami
import { GetDuvodOdhadu, GetModelky, SetHodnoceni, SetHodnoceniFotek } from './backend';
import { contextMenu } from '../ui/nabidka';
import { EDICE, VYSKYT, bezDiakritiky, esc, RAZENI_GALERIE, castGalerie, kategorieModelky, rozlozitVydani, seraditModelky, sklonovat, vyskytModelky } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { poZmeneDat } from './udalosti';
import { stav } from './stav';
import { otevritRychlePridani } from './formular-modelky';
import { importovatData, otevritHeslo } from './sprava';
import { otevritNapovedu } from './napoveda';
import { detailView, gallery, searchInput } from './prvky';
import { listaGalerie } from './listy';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { prepnoutRezim, stylVyrezu, ukazatPohled, zapamatovatMisto } from './navigace';
import { MODELEK_PRO_PISMENA, otevritDetailModelky } from './profil';
import { nacistCovery, nacistStenu } from './stena';
import { nacistKalendar } from './kalendar';
import { nacistPrehled } from './prehled';
import { nacistNejlepsi } from './nejlepsi';
import { lightbox } from './prohlizec';
import { trendModelky, urovenModelky } from '../lib/oblibenost';
import { vybraneDlazdice } from './vyber';
import { prevestNaVolby } from '../ui/volby';
import { htmlNicNenalezeno, htmlPrazdna } from '../ui/prazdno';
import { htmlSrdicekModelky, klavesaSrdicekModelky, obnovitSrdickaModelky } from '../ui/srdicka';
import { hodnotaPoKliku, kratceSrdicka, ukazatOdhad, vyhovujeMinimu } from '../lib/srdicka';
import { otevreneOkno } from '../ui/dom';

// Hodnocení fotky 1–5 srdíček; klik na N-té nastaví N, klik na současné hodnocení ho zruší.
// Na dlaždici (tabem = false) srdíčka nejsou v pořadí Tabu: zaměřená dlaždice se hodnotí klávesami 1–5
// a 0 (klavesnice.js), jinak by každá dlaždice přidala pět zastávek. Modelky mají srdíčka po půlkách (ui/srdicka.js).
export function htmlSrdicek(hodnoceni, atribut, tabem = true) {
    const srdicka = [1, 2, 3, 4, 5].map(n => `
        <button class="heart ${n <= hodnoceni ? 'on' : ''}" data-hodnota="${n}" ${tabem ? '' : 'tabindex="-1"'}
            title="${n === hodnoceni ? 'Zrušit hodnocení' : `Ohodnotit ${n} z 5`}"></button>`).join('');
    return `<span class="hearts ${hodnoceni ? 'rated' : ''}" ${atribut}>${srdicka}</span>`;
}

// Srdíčka modelky po půlkách; na kartě (tabem = false) bez zastávky Tabu, hodnotí zaměřená karta klávesami
export function htmlSrdicka(modelka, tabem = true) {
    return htmlSrdicekModelky(modelka.hodnoceni, `data-hodnoceni="${modelka.id}"`, { tabem, popis: `Hodnocení – ${esc(modelka.jmeno)}` });
}

// Důvody odhadů (id modelky → věta) z posledního načtení Oblíbenosti nebo z prvního najetí na štítek, aby je
// štítek odhadu ukázal v nápovědě; změna dat je zahodí (model vkusu se přeučí)
export const duvodyOdhadu = new Map();
poZmeneDat(() => duvodyOdhadu.clear());

const nadpisOdhadu = duvod => `Odhad podle tvého vkusu, zatím nehodnoceno${duvod ? ` – ${duvod}` : ''}`;

// Tlumený štítek „odhad 3½“ u nehodnocené modelky: odhad modelu vkusu, ne skutečné hodnocení
// Šipka trendu oblíbenosti na kartě: jen výrazný posun (aspoň 3 místa)
export function htmlTrendu(modelka) {
    const t = trendModelky(modelka, 3);
    return t ? `<span class="trend trend-karta ${t.smer}" title="${esc(`Oblíbenost: ${t.text}`)}">${t.znak}</span>` : '';
}

// Odznak Top 10 na kartě: jen potvrzená top 10 (nejvýš deset karet v celé galerii, takže nepřeplácá); nižší úrovně
// a čekání ukazuje profil a Oblíbenost
export function htmlTopu(modelka) {
    if (urovenModelky(modelka).uroven !== 10) return '';
    return `<span class="top-karta" title="${esc(`Top 10 v oblíbenosti${modelka.poradi > 0 ? ` · ${modelka.poradi}. místo` : ''}`)}">Top 10</span>`;
}

export function htmlOdhadu(modelka, tridy = '') {
    if (!ukazatOdhad(modelka)) return '';
    return `<span class="odhad-chip ${tridy}" data-odhad="${modelka.id}" title="${esc(nadpisOdhadu(duvodyOdhadu.get(modelka.id)))}">odhad ${kratceSrdicka(modelka.odhadHodnoceni)}</span>`;
}

// Štítek odhadu bez známého důvodu si ho při najetí myší načte (nápověda se ukáže až po chvíli, do té doby je tu)
document.addEventListener('mouseover', async e => {
    const stitek = e.target instanceof Element ? e.target.closest('.odhad-chip[data-odhad]') : null;
    if (!(stitek instanceof HTMLElement) || stitek.dataset.duvodNacitan) return;
    const id = parseInt(stitek.dataset.odhad || '');
    if (!duvodyOdhadu.has(id)) {
        stitek.dataset.duvodNacitan = '1';
        const duvod = await GetDuvodOdhadu(id).catch(() => '');
        delete stitek.dataset.duvodNacitan;
        if (duvod) duvodyOdhadu.set(id, duvod);
    }
    const duvod = duvodyOdhadu.get(id);
    if (duvod && !stitek.closest('.ob-tip')) stitek.title = nadpisOdhadu(duvod);
});

// Srdíčka fotky; index míří do seznamu položek právě zobrazeného pohledu
export function htmlSrdickaFotky(polozka, index) {
    return htmlSrdicek(polozka.hodnoceni, `data-hodnoceni-fotky="${index}"`, false);
}

export async function ohodnotitPolozku(polozka, zvoleno) {
    const nove = zvoleno === polozka.hodnoceni ? 0 : zvoleno;
    if (!await SetHodnoceniFotek(polozka.fotky.map(f => f.id), nove)) return false;
    polozka.hodnoceni = nove;
    polozka.fotky.forEach(f => { f.hodnoceni = nove; });
    return true;
}

const HTML_UVODU = `
    <section class="uvod">
        <h2>Vítej v Playboy Database</h2>
        <p>Katalog sbírky: modelky, alba fotek, centerfoldy, covery a čísla časopisu. Fotky zůstávají na Google
            Disku, program si pamatuje jen odkazy a údaje.</p>
        <ol>
            <li><strong>Sdílej fotky na Disku</strong> jako „kdokoli s odkazem“ (u složky stačí jednou) – jinak je program neuvidí.</li>
            <li><strong>Přidej první modelku</strong> a k ní album: vložíš odkazy na fotky z Disku, klidně víc naráz.</li>
            <li>Nebo <strong>načti hotová data</strong> ze souborů YAML či Markdown (export z programu nebo vlastní poznámky).</li>
            <li>Volitelně <strong>nastav heslo</strong>, aby se sbírka ukázala až po odemčení.</li>
        </ol>
        <div class="uvod-akce">
            <button class="btn btn-primary" data-uvod="modelka">Přidat modelku</button>
            <button class="btn btn-secondary" data-uvod="import">Importovat soubory…</button>
            <button class="btn btn-secondary" data-uvod="heslo">Nastavit heslo…</button>
            <button class="btn btn-secondary" data-uvod="napoveda">Nápověda (?)</button>
        </div>
        <p class="uvod-pozn">Data jsou v ~/.local/share/playboy-app; zálohy vznikají samy denně a před každou hromadnou změnou.</p>
    </section>`;

// Řádek voleb nad kartami (řazení, filtr srdíček včetně nehodnocených, edice, kategorie a výskyt)
function htmlNastroju(pocet, roleCetnosti = [], vyskytCetnosti = new Map()) {
    // Řazení podle oblíbenosti jen s backendem, který ji počítá
    const razeni = Object.entries(RAZENI_GALERIE).map(([klic, r]) => `
        <button class="chip ${klic === stav.razeniGalerie ? 'active' : ''}" data-razeni-galerie="${klic}" title="Řadit ${r.nazev}">${r.popisek}</button>`).join('');
    const srdicka = [1, 2, 3, 4, 5].map(n => `
        <button class="chip ${n === stav.minHodnoceni ? 'active' : ''}" data-min-hodnoceni="${n}"
            title="${n === stav.minHodnoceni ? 'Zobrazit všechny modelky' : `Jen modelky s hodnocením ${n}${n < 5 ? ` a více (i ${n},5)` : ''}`}">&#9829; ${n}${n < 5 ? '+' : ''}</button>`).join('')
        + `<button class="chip ${stav.minHodnoceni === -1 ? 'active' : ''}" data-min-hodnoceni="-1"
            title="${stav.minHodnoceni === -1 ? 'Zobrazit všechny modelky' : 'Jen nehodnocené modelky (bez srdíček)'}">Bez &#9829;</button>`;
    const edice = ['vse', ...EDICE].map(e => `
        <button class="chip ${e === stav.ediceModelek ? 'active' : ''}" data-edice-modelek="${e}">${e === 'vse' ? 'vše' : e}</button>`).join('');
    const role = roleCetnosti.length ? `<button class="chip ${stav.roleModelek === 'vse' ? 'active' : ''}" data-role-modelek="vse">vše</button>`
        + roleCetnosti.map(([nazev, n]) => `<button class="chip ${nazev === stav.roleModelek ? 'active' : ''}" data-role-modelek="${esc(nazev)}">${esc(nazev)}<span>${n}</span></button>`).join('') : '';
    // Výskyt: v časopise, jen online, neurčeno (lib/format.js, vyskytModelky); hodnota bez modelek se nenabízí
    const vyskyt = `<button class="chip ${stav.vyskytModelek === 'vse' ? 'active' : ''}" data-vyskyt-modelek="vse">vše</button>`
        + Object.entries(VYSKYT).filter(([klic]) => vyskytCetnosti.get(klic) || klic === stav.vyskytModelek).map(([klic, nazev]) => `
        <button class="chip ${klic === stav.vyskytModelek ? 'active' : ''}" data-vyskyt-modelek="${klic || 'neurceno'}">${nazev}<span>${vyskytCetnosti.get(klic) || 0}</span></button>`).join('');
    return `<div class="gallery-toolbar">${razeni}<span class="oddelovac"></span>${srdicka}<span class="oddelovac"></span>${edice}${role ? `<span class="oddelovac"></span>${role}` : ''}<span class="oddelovac"></span>${vyskyt}
        <span>${sklonovat(pocet, 'modelka', 'modelky', 'modelek')}</span></div>`;
}

// Předchozí a další modelka v pořadí, v jakém jsou v galerii
// Šipky ‹ › v profilu listují seznamem, ze kterého se profil otevřel (stav.seznamProfilu)
export async function krokModelky(smer) {
    const seznam = stav.seznamProfilu;
    if (!stav.aktualniModelka || !seznam) return;
    const index = seznam.indexOf(stav.aktualniModelka.id);
    if (index < 0 || seznam.length < 2) return;
    const id = seznam[(index + smer + seznam.length) % seznam.length];
    const modelka = (await vsechnyModelky()).find(m => m.id === id);
    // Listování mezi modelkami historii neplní, Zpět vede tam, odkud se do profilů přišlo
    if (modelka) otevritDetailModelky(modelka, { bezHistorie: true });
}

// Filtr srdíček (♥ N+) řadí karty podle srdíček a oblíbenosti, i když je zvolené jiné řazení: zapnutí přepne
// řazení na „Podle srdíček“ (bez uložení), vypnutí vrátí původní. Řazení zvolené během filtru zůstane.
let razeniPredFiltrem = null;
function nastavitMinimumSrdicek(minimum) {
    if (minimum > 0 && razeniPredFiltrem === null && stav.razeniGalerie !== 'hodnoceni') {
        razeniPredFiltrem = stav.razeniGalerie;
        stav.razeniGalerie = 'hodnoceni';
    } else if (minimum <= 0 && razeniPredFiltrem !== null) {
        stav.razeniGalerie = razeniPredFiltrem;
        razeniPredFiltrem = null;
    }
    stav.minHodnoceni = minimum;
}

// Klik na údaj v profilu vyhledá všechny modelky se stejnou hodnotou
export function hledatHodnotu(hodnota) {
    nastavitMinimumSrdicek(0);
    stav.ediceModelek = 'vse';
    stav.roleModelek = 'vse';
    stav.vyskytModelek = 'vse';
    zapamatovatMisto({});
    prepnoutRezim('modelky');
    searchInput.value = hodnota;
    nacistGalerii(hodnota);
}

// Modelky právě vykreslených karet podle id (klik na kartu otevře profil)
let modelkyKaret = new Map();
let posledniDotazModelky = null;
let posledniVsechnyModelky = null;
let pametCetnosti = null;
const metaModelky = new WeakMap();

poZmeneDat(() => {
    posledniDotazModelky = null;
    posledniVsechnyModelky = null;
    pametCetnosti = null;
});

function ziskatMetaModelky(m) {
    let meta = metaModelky.get(m);
    if (!meta) {
        const kategorie = kategorieModelky(m).map(k => k.nazev);
        const vyskyt = vyskytModelky(m);
        const edice = new Set();
        for (const v of [...(m.vydani || []), ...(m.obalky || [])]) {
            const ed = rozlozitVydani(v)?.edice;
            if (ed) edice.add(ed);
        }
        meta = { kategorie, kategorieSet: new Set(kategorie), vyskyt, edice };
        metaModelky.set(m, meta);
    }
    return meta;
}

function spocitatCetnostiKatalogu(katalog) {
    if (!pametCetnosti) {
        const cetnostiRoli = new Map();
        const vyskytCetnosti = new Map();
        for (const m of katalog) {
            const meta = ziskatMetaModelky(m);
            for (const nazev of meta.kategorie) cetnostiRoli.set(nazev, (cetnostiRoli.get(nazev) || 0) + 1);
            vyskytCetnosti.set(meta.vyskyt, (vyskytCetnosti.get(meta.vyskyt) || 0) + 1);
        }
        pametCetnosti = { cetnostiRoli, vyskytCetnosti };
    }
    const cetnostiRoli = new Map(pametCetnosti.cetnostiRoli);
    if (stav.roleModelek !== 'vse' && !cetnostiRoli.has(stav.roleModelek)) {
        cetnostiRoli.set(stav.roleModelek, 0);
    }
    return { roleCetnosti: [...cetnostiRoli.entries()], vyskytCetnosti: pametCetnosti.vyskytCetnosti };
}

// Načtení Hlavní Galerie
// zMezipameti = jen přefiltrovat data načtená minule (psaní do hledání, změna filtru či řazení), nenačítat je znovu z databáze
export async function nacistGalerii(dotaz = '', zMezipameti = false) {
    if (stav.rezim === 'centerfoldy') return nacistStenu(dotaz, zMezipameti);
    if (stav.rezim === 'covery') return nacistCovery(dotaz, zMezipameti);
    if (stav.rezim === 'kalendar') return nacistKalendar(dotaz, zMezipameti);
    if (stav.rezim === 'prehled') return nacistPrehled();
    if (stav.rezim === 'nejlepsi') return nacistNejlepsi(dotaz, zMezipameti);

    const moje = ++stav.cisloNacteni;
    const cistyDotaz = dotaz.trim();
    const katalog = await vsechnyModelky();
    let vsechny;
    if (!cistyDotaz) {
        vsechny = katalog;
    } else if (zMezipameti && posledniVsechnyModelky && posledniDotazModelky === dotaz) {
        vsechny = posledniVsechnyModelky;
    } else {
        vsechny = await GetModelky(dotaz).then(m => m || []);
        posledniDotazModelky = dotaz;
        posledniVsechnyModelky = vsechny;
    }
    if (moje !== stav.cisloNacteni) return;

    const { roleCetnosti, vyskytCetnosti } = spocitatCetnostiKatalogu(katalog);

    const vyhovujeModelka = m => {
        if (!vyhovujeMinimu(m.hodnoceni, stav.minHodnoceni)) return false;
        const meta = ziskatMetaModelky(m);
        if (stav.ediceModelek !== 'vse' && !meta.edice.has(stav.ediceModelek)) return false;
        if (stav.roleModelek !== 'vse' && !meta.kategorieSet.has(stav.roleModelek)) return false;
        if (stav.vyskytModelek !== 'vse' && meta.vyskyt !== stav.vyskytModelek) return false;
        return true;
    };

    // Zvolené řazení (stabilní: při shodě zůstává pořadí podle jména z backendu)
    const modelky = seraditModelky(vsechny.filter(vyhovujeModelka), stav.razeniGalerie);
    stav.nacteneModelky = modelky;
    modelkyKaret = new Map(modelky.map(m => [m.id, m]));
    stav.zrusitUpravuVyrezu?.();
    ukazatPohled(gallery);

    // Prázdná sbírka: úvod s prvními kroky místo prázdné galerie
    if (katalog.length === 0 && vsechny.length === 0 && !cistyDotaz) {
        listaGalerie.naplnit([]);
        gallery.innerHTML = HTML_UVODU;
        return;
    }
    if (modelky.length === 0) {
        listaGalerie.naplnit([]);
        const zrusit = { text: 'Zrušit hledání a filtry', akce: 'zrusit' };
        // Srdíčka jako jediná příčina mají vlastní hlášku; s hledáním nebo dalším filtrem je to „Nic nenalezeno“
        const jinyFiltr = cistyDotaz || stav.ediceModelek !== 'vse' || stav.roleModelek !== 'vse' || stav.vyskytModelek !== 'vse';
        gallery.innerHTML = htmlNastroju(0, roleCetnosti, vyskytCetnosti) + (
            jinyFiltr ? htmlNicNenalezeno('Hledání ani filtrům neodpovídá žádná modelka.')
            : stav.minHodnoceni === -1 ? htmlPrazdna('Vše ohodnoceno', 'Všechny modelky už mají srdíčka.', { ikona: 'srdce', tlacitko: zrusit })
            : stav.minHodnoceni > 0 ? htmlPrazdna(`Žádná modelka s ♥ ${stav.minHodnoceni}${stav.minHodnoceni < 5 ? '+' : ''}`, 'Modelky se hodnotí srdíčky na kartě nebo v profilu.', { ikona: 'srdce', tlacitko: zrusit })
            : htmlPrazdna('Zatím žádné modelky', 'Sbírka začíná první modelkou. Přidej ji a pak k ní vlož fotky z Google Disku.', { tlacitko: { text: 'Přidat modelku', akce: 'pridat-modelku' } }));
        prevestNaVolby(gallery.querySelector('.gallery-toolbar'));
        return;
    }

    // Lišta částí: písmena, měsíce přidání, desetiletí, úrovně srdíček nebo pásma počtu fotek;
    // značku části (data-cast) dostane první karta každé části rovnou v šabloně
    const maRejstrik = modelky.length >= MODELEK_PRO_PISMENA;
    const casti = new Map();
    gallery.innerHTML = htmlNastroju(modelky.length, roleCetnosti, vyskytCetnosti) + modelky.map(m => {
        let atributCasti = '';
        if (maRejstrik) {
            const c = castGalerie(m, stav.razeniGalerie);
            if (!casti.has(c)) atributCasti = ` data-cast="${esc(c)}"`;
            casti.set(c, (casti.get(c) || 0) + 1);
        }
        const styl = stylVyrezu(m);
        return `
        <div class="card" data-id="${m.id}"${atributCasti} tabindex="0" aria-label="${esc(m.jmeno)}">
            <div class="card-image-wrap">
                <img data-src="${esc(adresaTitulni(m))}" alt=""${styl ? ` style="${styl}"` : ''} draggable="false" decoding="async" />
                ${htmlSrdicka(m, false)}
                ${htmlOdhadu(m)}
                ${htmlTopu(m)}
            </div>
            <div class="card-info">
                <h3 title="${esc(m.jmeno)}"><span class="jmeno-karta">${esc(m.jmeno)}</span>${htmlTrendu(m)}</h3>
            </div>
        </div>
    `;
    }).join('');
    prevestNaVolby(gallery.querySelector('.gallery-toolbar'));
    nacitatPostupne(gallery);

    if (maRejstrik) {
        listaGalerie.naplnit([...casti].map(([c, pocet]) => ({ klic: c, nazev: c, pocet })));
        listaGalerie.sledovat();
    } else {
        listaGalerie.naplnit([]);
    }
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Tlačítka úvodu prázdné sbírky
    gallery.addEventListener('click', (e) => {
        const akce = e.target.closest('[data-uvod]')?.dataset.uvod;
        if (akce === 'modelka') otevritRychlePridani();
        else if (akce === 'import') importovatData();
        else if (akce === 'heslo') otevritHeslo();
        else if (akce === 'napoveda') otevritNapovedu();

        // Řádek voleb nad kartami
        const razeni = e.target.closest('[data-razeni-galerie]')?.dataset.razeniGalerie;
        const minimum = e.target.closest('[data-min-hodnoceni]')?.dataset.minHodnoceni;
        const edice = e.target.closest('[data-edice-modelek]')?.dataset.ediceModelek;
        const role = e.target.closest('[data-role-modelek]')?.dataset.roleModelek;
        const vyskyt = e.target.closest('[data-vyskyt-modelek]')?.dataset.vyskytModelek;
        if (razeni) {
            stav.razeniGalerie = razeni;
            razeniPredFiltrem = null;
            try { localStorage.setItem('razeniGalerie', razeni); } catch { /* jen pro toto spuštění */ }
            nacistGalerii(searchInput.value, true);
        } else if (minimum) {
            // Klik na zvolený filtr ho zruší
            nastavitMinimumSrdicek(Number(minimum) === stav.minHodnoceni ? 0 : Number(minimum));
            nacistGalerii(searchInput.value, true);
        } else if (edice) {
            stav.ediceModelek = edice;
            nacistGalerii(searchInput.value, true);
        } else if (role) {
            stav.roleModelek = role;
            nacistGalerii(searchInput.value, true);
        } else if (vyskyt) {
            stav.vyskytModelek = vyskyt === 'neurceno' ? '' : vyskyt;
            nacistGalerii(searchInput.value, true);
        }
    });

    // Hromadné zrušení všech filtrů galerie jedním překreslením (místo postupného rušení po jednom)
    gallery.addEventListener('zrusit-filtry', (e) => {
        e.preventDefault();
        clearTimeout(stav.casovacHledani);
        nastavitMinimumSrdicek(0);
        stav.ediceModelek = 'vse';
        stav.roleModelek = 'vse';
        stav.vyskytModelek = 'vse';
        nacistGalerii(searchInput.value, true);
    });

    // Klik na kartu otevře profil modelky (jedna obsluha pro všechny karty, ne posluchač na každé z tisíců karet)
    gallery.addEventListener('click', (e) => {
        const karta = e.target.closest('.card');
        if (!karta || karta.classList.contains('editing') || e.target.closest('.hearts')) return;
        const modelka = modelkyKaret.get(parseInt(karta.dataset.id));
        if (modelka) otevritDetailModelky(modelka);
    });

    // Nová řada srdíček místo staré; fokus zůstane na srdíčku se stejnou hodnotou (ovládání klávesnicí)
    const nahraditSrdicka = (rada, html, hodnota) => {
        const rodic = rada.parentElement;
        const meloFokus = rada.contains(document.activeElement);
        rada.outerHTML = html;
        if (meloFokus) rodic.querySelector(`.hearts .heart[data-hodnota="${hodnota}"]`)?.focus({ preventScroll: true });
    };

    // Srdíčka na dlaždici fotky v profilu a na stránce vydání
    document.querySelector('main').addEventListener('click', async (e) => {
        const srdicko = e.target.closest('[data-hodnoceni-fotky] .heart');
        if (!srdicko) return;
        const rada = srdicko.closest('.hearts');
        const seznam = rada.closest('#best') ? stav.nejlepsiPolozky : rada.closest('#issueView') ? stav.vydaniPolozky : stav.aktualniPolozky;
        const polozka = seznam[parseInt(rada.dataset.hodnoceniFotky)];
        if (!polozka || !await ohodnotitPolozku(polozka, parseInt(srdicko.dataset.hodnota))) return;

        // Mění se jen srdíčka: překreslení by fotku přeřadilo pod rukama a stránka by odskočila.
        // Podle nového hodnocení se album seřadí při příštím otevření.
        nahraditSrdicka(rada, htmlSrdickaFotky(polozka, parseInt(rada.dataset.hodnoceniFotky)), srdicko.dataset.hodnota);
    });

    // Srdíčka modelky (po půlkách) na kartě, v profilu a v Oblíbenosti
    document.querySelector('main').addEventListener('click', async (e) => {
        const srdicko = e.target.closest('.hearts-pul[data-hodnoceni] .pulka');
        if (!srdicko) return;
        const rada = srdicko.closest('.hearts');
        const id = parseInt(rada.dataset.hodnoceni);
        const nactene = [stav.aktualniModelka, modelkyKaret.get(id), stav.prehledModelky.get(id)].filter(m => m && m.id === id);
        if (!nactene.length) return;

        const nove = hodnotaPoKliku(nactene[0].hodnoceni, srdicko.dataset.hodnota);
        if (!await SetHodnoceni(id, nove)) return;

        // Tatáž modelka může být v galerii, v profilu i v Oblíbenosti: srdíčka se přepíšou na místě (fokus
        // zůstane, takže funguje i dvojstisk 1–5 pro půlsrdíčko), odhad u ohodnocené zmizí. Galerie se překreslí
        // jen tehdy, když modelka přestala splňovat zapnutý filtr srdíček.
        nactene.forEach(m => { m.hodnoceni = nove; });
        document.querySelectorAll(`.hearts-pul[data-hodnoceni="${id}"]`).forEach(r => obnovitSrdickaModelky(r, nove));
        document.querySelectorAll(`.odhad-chip[data-odhad="${id}"]`).forEach(c => c.classList.toggle('hidden', nove > 0));
        document.dispatchEvent(new CustomEvent('hodnoceni-modelky', { detail: { id, hodnoceni: nove } }));
        if (stav.minHodnoceni && !gallery.classList.contains('hidden') && !vyhovujeMinimu(nove, stav.minHodnoceni)) {
            await nacistGalerii(searchInput.value, true);
        }
    });

    // Zaměřená srdíčka v profilu a v Oblíbenosti: číslice, šipky, Home a End (ui/srdicka.js); šipky tu nelistují modelkami
    document.querySelector('main').addEventListener('keydown', (e) => {
        const rada = e.target.closest?.('.hearts-pul[data-hodnoceni][role="slider"]');
        if (rada && rada === e.target && klavesaSrdicekModelky(e, rada)) e.stopPropagation();
    });

    try {
        // Dřívější řazení „Podle oblíbenosti“ je teď součástí řazení podle srdíček
        const ulozene = localStorage.getItem('razeniGalerie') === 'oblibenost' ? 'hodnoceni' : localStorage.getItem('razeniGalerie');
        if (RAZENI_GALERIE[ulozene]) stav.razeniGalerie = ulozene;
    } catch { /* výchozí řazení podle jména */ }
    document.getElementById('prevModelBtn').onclick = () => krokModelky(-1);

    document.getElementById('nextModelBtn').onclick = () => krokModelky(1);

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        // Alt + šipka je Zpět, s Ctrl a ve výběru fotek se šipkami nelistuje
        const zamestnano = detailView.classList.contains('hidden') || e.defaultPrevented
            || e.altKey || e.ctrlKey || e.metaKey
            || !lightbox.classList.contains('hidden')
            || !contextMenu.classList.contains('hidden')
            || otevreneOkno()
            || vybraneDlazdice().length
            || e.target.closest('input, textarea, select');
        if (!zamestnano) krokModelky(e.key === 'ArrowRight' ? 1 : -1);
    });
}
