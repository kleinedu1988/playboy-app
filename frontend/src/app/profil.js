// Profil modelky: alba, texty, plakáty, ruční pořadí fotek a zkrácená alba
import { htmlRadyOdznaku, nastavitPohledSlavy } from './sin-slavy';
import { nastavitCastOblibenosti, porovnatNaZacatku } from './oblibenost';
import { otevritOblibenost } from './prehled';
import { VYSKYT, barvaCasopisu, dalsiJmenaModelky, popisDalsihoJmena, stitkyModelky, odvozeneKategorie, jeOnline, esc, formatDatum, formatMarkdown, kategorieModelky, jeCisloPlayboye, titulCisla, nazevAlba, nazevVydani, obrazek, paskaCisla, popisKategorie, paskaOnline, popisTypuAlba, rozlozitVydani, vekPriVydani, sklonovat, vyskytModelky } from '../lib/format';
import { GetFotografieModelky, GetOdznakyModelky, GetPodobnostObsahu, GetProfilovaFotka, GetTitulySezonModelky, SetPoradiFotek, SetProfilovyVyrez } from './backend';
import { klicAlba, novePoradi, sestavitAlba } from '../lib/alba';
import { oznamit } from '../ui/oznameni';
import { vsechnyModelky } from './mezipamet';
import { stav } from './stav';
import { htmlAkciDlazdice } from './akce-fotky';
import { detailView, gallery, issueView } from './prvky';
import { hlavniOblast, listaAlb, listyStranky } from './listy';
import { VELIKOST_ZAHLAVI, VELIKOST_NAHLEDU, VELIKOST_TITULNI, adresaTitulni, nacitatPostupne, pomerFotky, zapamatovatPomer } from './obrazky';
import { stylVyrezu, ukazatPohled, zapamatovatMisto } from './navigace';
import { htmlOdhadu, htmlSrdicka, htmlSrdickaFotky } from './galerie';
import { rezimVyberu, selectionBar, zrusitVyber } from './vyber';
import { doplnitClankyModelky } from './clanky';
import { htmlPrazdna } from '../ui/prazdno';
import { htmlKostryAlb } from '../ui/kostra';
import { zaznamenatProfil } from './zajem';
import { upravitVyrez } from './vyrez';
import { nastavitStav } from '../ui/volby';
import { otevritLightbox } from './prohlizec';
import { podobneModelky } from '../lib/mapa-sbirky';
import { znakySrdicek } from '../lib/srdicka';
import { otevritMapuModelky } from './statistiky-pohled';
import { doplnitZminkyModelky } from './wiki-odkazy';
import * as zasobnik from './zasobnik';
import { otevritAlbumModal } from './formular-alba';
import { vzhled } from '../ui/vzhled';

// Prvky profilu ze šablony; zůstávají stejné, mění se jen jejich obsah. Nahoře pruh s identitou modelky, údaje
// ve výsuvném panelu vpravo (#profileSide), akce s modelkou ve spodním řádku pruhu (#profileActions).
const modelHeader = document.getElementById('modelHeader');
const profilPruh = document.getElementById('profilPruh');
const profilPruhObsah = document.getElementById('profilPruhObsah');
const centerfoldBtn = document.getElementById('centerfoldBtn');
const photosGrid = document.getElementById('photosGrid');
const profilPocet = document.getElementById('profilPocet');

// Štítek čísla časopisu; klik ho otevře (obsluha data-vydani v prohlizec.js)
// Číslo jiného časopisu má barvu časopisu (0.02.026); Playboy beze změny
const stylCasopisu = v => {
    const c = rozlozitVydani(v)?.casopis;
    const barva = c && !jeCisloPlayboye(v) ? barvaCasopisu(c) : '';
    return barva ? ` jiny-casopis" style="--casopis: ${esc(barva)}` : '';
};
const htmlStitkuVydani = v => `<button class="chip${stylCasopisu(v)}" data-vydani="${esc(v)}" title="Otevřít číslo">${esc(nazevVydani(v))}</button>`;

// Otevření profilu modelky s fotogalerií
// seznam: id modelek, mezi kterými listují šipky ‹ › (pořadí, Top 10…); bez něj z galerie Modelky její karty,
// odjinud (hledání, kronika, číslo) se nelistuje. Listování a Zpět (bezHistorie) seznam nemění.
export async function otevritDetailModelky(modelka, { bezHistorie = false, seznam = null } = {}) {
    if (!bezHistorie) {
        stav.seznamProfilu = seznam?.length > 1 ? seznam
            : stav.rezim === 'modelky' && !gallery.classList.contains('hidden') ? stav.nacteneModelky.map(m => m.id) : null;
    }
    // Opožděná odpověď přehledu, ze kterého se sem přišlo, už profil nesmí přepsat
    const moje = ++stav.cisloNacteni;
    // Galerie a historie drží objekty z doby načtení; po úpravě by profil i formulář ukázaly staré údaje
    const vsechny = await vsechnyModelky();
    modelka = vsechny.find(m => m.id === modelka.id) || modelka;
    // Mezitím otevřený jiný pohled má přednost
    if (moje !== stav.cisloNacteni) return;
    if (!bezHistorie) zapamatovatMisto({ modelka });
    // Listování mezi profily (bez historie) je taky zájem; backend stejnou modelku počítá nejvýš jednou za 10 minut
    zaznamenatProfil(modelka.id);
    // Alba předchozí modelky se do načtení nahradí obrysy (stejná modelka po uložení zůstává, jak je)
    if (stav.aktualniModelka?.id !== modelka.id) photosGrid.innerHTML = htmlKostryAlb();
    stav.aktualniModelka = modelka;
    ukazatPohled(detailView);
    hlavniOblast.scrollTop = 0;

    const hledatelne = hodnota => hodnota
        ? `<button class="link" data-hledat="${esc(hodnota)}" title="Vyhledat modelky se stejnou hodnotou">${esc(hodnota)}</button>`
        : '';
    // Vydání se odvozují z alb a centerfoldů; starší ručně psané údaje se ukážou, jen když odvozená chybí
    const prvniVydani = modelka.vydani.find(v => rozlozitVydani(v)?.mesic) || (rozlozitVydani(modelka.vystoupeni)?.mesic ? modelka.vystoupeni : '');
    const vydani = modelka.vydani.length
        ? modelka.vydani.map(htmlStitkuVydani).join(' ')
        : esc([modelka.vystoupeni, ...modelka.pictorialVydani.split('\n')].map(v => v.trim()).filter(Boolean).join(', '));

    // Údaje ve třech blocích: Playboy (nejdůležitější pro sbírku), Osobní, Vzhled; prázdné části se nezobrazí.
    // Kategorie a výskyt se odvozují z vydání a alb; spočítají se jednou pro údaje i pro pásky.
    const kategorie = kategorieModelky(modelka);
    const vyskyt = vyskytModelky(modelka);
    // Kategorie jsou v hlavičce panelu vedle fotky (kdo modelka je), ne mezi řádky Playboy
    // Štítky pod jménem: časopis a rok, role z galerií a profese z Role, stejně pro všechny časopisy (0.02.034)
    const stitky = stitkyModelky(modelka);
    const htmlKategorii = stitky.map(s => `<span class="udaje-znamka stitek-${s.druh}"${s.druh === 'role' ? ' title="Z galerií modelky"' : ''}>${esc(s.text)}</span>`).join('');
    const playboy = [
        ['Vydání', vydani],
        ['Na obálce', (modelka.obalky || []).map(htmlStitkuVydani).join(' ')],
        ['Výskyt', vyskyt ? `<span class="udaje-znamka">${VYSKYT[vyskyt]}</span>` : ''],
    ].filter(([, hodnota]) => hodnota);

    // Osobní údaje jako věty: „12. 3. 1975, Praha · v prvním vydání 20 let“
    const vekVydani = vekPriVydani(modelka.narozeniDatum, prvniVydani);
    const vekUmrti = vekPriVydani(modelka.narozeniDatum, modelka.umrtiDatum);
    const osobni = [
        [esc([formatDatum(modelka.narozeniDatum), modelka.narozeniMisto].filter(Boolean).join(', ')), vekVydani && `v prvním vydání ${esc(vekVydani)}`]
            .filter(Boolean).join(' · '),
        modelka.umrtiDatum ? `† ${esc(formatDatum(modelka.umrtiDatum))}${vekUmrti ? `, ve věku ${esc(vekUmrti)}` : ''}` : '',
        [hledatelne(modelka.narodnost), esc(modelka.etnicita)].filter(Boolean).join(' · '),
    ].filter(Boolean);

    // Vzhled jako mřížka dvojic; tetování a piercing jen jako štítek, když je odpověď „ano“
    const vzhled = [
        ['Výška', modelka.vyskaCm ? `${modelka.vyskaCm} cm` : ''],
        ['Váha', modelka.vahaKg ? `${modelka.vahaKg} kg` : ''],
        ['Míry', esc(modelka.miry)],
        ['Prsa', esc([modelka.velikostPrsou, modelka.prsaTyp].filter(Boolean).join(', '))],
        ['Vlasy', hledatelne(modelka.vlasyBarva)],
        ['Oči', hledatelne(modelka.ociBarva)],
        ['Ochlupení', esc(modelka.ochlupeni)],
    ].filter(([, hodnota]) => hodnota);
    const znamky = [modelka.tetovani === 1 ? 'Tetování' : '', modelka.piercing === 1 ? 'Piercing' : ''].filter(Boolean);

    const bloky = [
        playboy.length ? `<section class="udaje-blok"><h4>Časopisy</h4>
            ${playboy.map(([nazev, hodnota]) => `<div class="udaje-radek"><span class="udaje-popis">${nazev}</span><div class="udaje-stitky">${hodnota}</div></div>`).join('')}
        </section>` : '',
        osobni.length ? `<section class="udaje-blok"><h4>Osobní</h4>${osobni.map(veta => `<p class="udaje-veta">${veta}</p>`).join('')}</section>` : '',
        vzhled.length || znamky.length ? `<section class="udaje-blok"><h4>Vzhled</h4>
            ${vzhled.length ? `<dl class="udaje-mrizka">${vzhled.map(([nazev, hodnota]) => `<div><dt>${nazev}</dt><dd>${hodnota}</dd></div>`).join('')}</dl>` : ''}
            ${znamky.length ? `<div class="udaje-znamky">${znamky.map(z => `<span class="udaje-znamka">${z}</span>`).join('')}</div>` : ''}
        </section>` : '',
    ].filter(Boolean);

    const tagy = modelka.tags.split(',').map(t => t.trim()).filter(Boolean);
    const dalsiJmena = dalsiJmenaModelky(modelka.dalsiJmena).map(popisDalsihoJmena);
    podobneProfilu = { id: modelka.id, vsechny, obsah: null };
    const podobne = htmlPodobnych();

    // Pásky v rohu fotky: štítek za každé číslo (rok i měsíc), ve kterém se modelka objevila
    const vsechnaVydani = [
        ...(modelka.vydani || []),
        ...(modelka.obalky || []),
        modelka.vystoupeni,
        ...String(modelka.pictorialVydani || '').split('\n'),
    ].map(v => (v || '').trim()).filter(Boolean);
    const platnaVydani = [...new Set(vsechnaVydani)].filter(v => paskaCisla(v)).sort((a, b) => a.localeCompare(b));
    // Titul na pásce: u Playboye „Playmate“ jako dřív (první měsíční číslo), u centerfoldu jiného časopisu
    // jeho titul („Pet · Zář 85 · PH“)
    const jePlaymate = odvozeneKategorie(modelka).includes('Playmate měsíce'); // titul z galerií, ne z Role (0.02.034)
    const cislaPlayboye = platnaVydani.filter(jeCisloPlayboye);
    const playmateVydani = (rozlozitVydani(modelka.vystoupeni)?.mesic && cislaPlayboye.includes(modelka.vystoupeni))
        ? modelka.vystoupeni
        : cislaPlayboye.find(v => rozlozitVydani(v)?.mesic);
    const centerfoldyJinde = new Set((modelka.centerfoldy || []).filter(v => !jeCisloPlayboye(v)));

    const paskyHtml = platnaVydani.map(v => {
        const role = centerfoldyJinde.has(v) ? `${titulCisla(v, 'kratky')} · ` : (v === playmateVydani && jePlaymate) ? 'Playmate · ' : '';
        const popisek = `${role}${paskaCisla(v)}`;
        return `<button type="button" class="pruh-odkaz${stylCasopisu(v)}" data-vydani="${esc(v)}" title="Otevřít číslo ${esc(nazevVydani(v))}">${esc(popisek)}</button>`;
    }).join('') + ((modelka.onlineAlba || []).length
        ? `<button type="button" class="pruh-odkaz" data-online-album title="Přejít na online album">${esc(paskaOnline(modelka))}</button>` : '');
    const titulni = `<img src="${esc(adresaTitulni(modelka, true))}" alt="${esc(modelka.jmeno)}" style="${stylVyrezu(modelka)}" decoding="async" draggable="false" />`;
    // Filmový banner: dole vlevo nadtitulek (kategorie), velké jméno se srdíčky, řádek kariéry (roky, alba a fotky
    // doplní vykreslení alb, čísla časopisu a online jako textové odkazy), pořadí a odznaky; celou plochu kryje fotka
    const roky = platnaVydani.map(v => parseInt(v, 10)).filter(r => r > 1900);
    const obdobi = roky.length ? (Math.min(...roky) === Math.max(...roky) ? String(roky[0]) : `${Math.min(...roky)}–${Math.max(...roky)}`) : '';
    // Modelka z víc časopisů: nadtitulek je souhrn kariéry s roky („Pet of the Month 1985 · Playmate 1987“)
    // Nadtitulek stejnou strukturou: časopis a rok, role v časopise, pak první profese
    const nadtitulek = [...stitky.filter(s => s.druh !== 'profese'), ...stitky.filter(s => s.druh === 'profese').slice(0, 2)]// Oddělovač drží u předchozí položky: zalomený řádek nezačne „·“ (0.02.041)
        .map(s => s.text).join('\u00a0· ');
    profilPruhObsah.innerHTML = `
        <div class="pruh-identita">
            ${nadtitulek ? `<div class="pruh-nadtitulek">${esc(nadtitulek)}</div>` : ''}
            <div class="pruh-jmeno">
                <h2>${esc(modelka.jmeno)}</h2>
                ${htmlSrdicka(modelka)}
            </div>
            <div class="pruh-radek">
                <span class="pruh-kariera">${obdobi ? `<span>${esc(obdobi)}</span>` : ''}<span class="pruh-pocty"></span>${paskyHtml ? `<span class="pruh-cisla">${paskyHtml}</span>` : ''}</span>
                ${htmlOdhadu(modelka, 'odhad-profil', { bezOdhadu: true })}
                ${htmlPoradi(modelka)}
                <div class="profile-odznaky" hidden></div>
                <button type="button" class="pruh-odkaz pruh-fotka-zahlavi" data-fotka-zahlavi hidden title="Záhlaví zatím nemá vlastní fotku">+ fotka záhlaví</button>
            </div>
        </div>
    `;
    aktualizovatBannerProfilu(modelka);
    // Jméno otevře nabídku modelek seznamu, když se profil otevřel ze seznamu (galerie, pořadí…)
    profilPruhObsah.querySelector('.pruh-identita')?.classList.toggle('s-nabidkou', (stav.seznamProfilu?.length || 0) > 1);
    // Panel Údaje: nahoře velká titulní fotka (jak ji ukazuje karta v galerii), pod ní další jména a kategorie;
    // dál údaje Playboy, Osobní, Vzhled (a články), text O modelce (markdown), tagy a odkazy. Tagy jsou sbalené
    // na dva řádky, zbytek rozbalí tlačítko (ukáže se, jen když se nevejdou).
    modelHeader.innerHTML = `
        <div class="profile-cover-ram">
            <div class="profile-cover">${titulni}</div>
            <button type="button" class="vyrez-btn" data-upravit-vyrez title="Upravit výřez fotky karty (jak ji ukazuje karta v galerii)" aria-label="Upravit výřez fotky karty"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg></button>
        </div>
        ${dalsiJmena.length || htmlKategorii ? `<div class="udaje-hlava">
            ${dalsiJmena.length ? `<p class="profile-aliases">také ${esc(dalsiJmena.join(', '))}</p>` : ''}
            ${htmlKategorii ? `<div class="udaje-kategorie">${htmlKategorii}</div>` : ''}
        </div>` : ''}
        ${bloky.length ? `<div class="udaje-modelky">${bloky.join('')}</div>` : ''}
        ${modelka.poznamka ? `<section class="udaje-blok udaje-poznamka"><h4>O modelce</h4><div class="profile-note">${formatMarkdown(modelka.poznamka)}</div></section>` : ''}
        ${tagy.length ? `<section class="udaje-blok udaje-tagy"><h4>Tagy <span class="udaje-pocet">${tagy.length}</span></h4>
            <div class="profile-tags">${tagy.map(t => `<button class="tag" data-hledat="${esc(t)}" title="Vyhledat modelky s tímto tagem">${esc(t)}</button>`).join('')}</div>
            <button type="button" class="tagy-rozbalit hidden" data-rozbalit-tagy aria-expanded="false">Všechny tagy</button>
        </section>` : ''}
        ${htmlOdkazu(modelka.odkazy) ? `<section class="udaje-blok udaje-odkazy"><h4>Odkazy</h4>${htmlOdkazu(modelka.odkazy)}</section>` : ''}
        ${podobne ? `<section class="udaje-blok udaje-podobne" data-podobne>${podobne}</section>` : ''}
    `;
    // Tlačítko rozbalení tagů jen tehdy, když se do dvou řádků nevejdou
    const poleTagu = /** @type {HTMLElement | null} */ (modelHeader.querySelector('.udaje-tagy .profile-tags'));
    if (poleTagu) modelHeader.querySelector('[data-rozbalit-tagy]').classList.toggle('hidden', poleTagu.scrollHeight <= poleTagu.clientHeight + 2);

    await Promise.all([nacistFotkyModelky(modelka.id), doplnitClankyModelky(modelka).then(() => doplnitZminkyModelky(modelka)), doplnitOdznaky(modelka.id), doplnitPodobne(modelka.id, moje)]);
}

// ——— Podobné modelky (lib/mapa-sbirky.js podobneModelky) ———
// Napřed z údajů (hned), po odpovědi backendu (GetPodobnostObsahu) i se společnými fotografy a s přepínačem
// Údaje / Na fotkách, když má modelka dost fotek s vektorem obsahu. Zvolený režim se pamatuje.
const KLIC_REZIMU_PODOBNYCH = 'podobneModelkyRezim';
let rezimPodobnych = (() => { try { return localStorage.getItem(KLIC_REZIMU_PODOBNYCH) === 'fotky' ? 'fotky' : 'udaje'; } catch { return 'udaje'; } })();
let podobneProfilu = { id: 0, vsechny: [], obsah: null };

const lzeNaFotkach = obsah => Boolean(obsah?.fotek >= 3 && Object.keys(obsah.naFotkach || {}).length);

function htmlPodobnych() {
    const { id, vsechny, obsah } = podobneProfilu;
    const naFotkach = lzeNaFotkach(obsah);
    const rezim = naFotkach ? rezimPodobnych : 'udaje';
    const podobne = podobneModelky(id, vsechny, { pocet: 5, obsah, rezim });
    if (!podobne.length) return '';
    const prepinac = naFotkach ? `<div class="podobne-rezim" role="group" aria-label="Podobné podle">${[['udaje', 'Údaje', 'Podobné postavou, údaji a obdobím'], ['fotky', 'Na fotkách', 'Přimíchá vizuální podobnost fotek (obsah fotek)']].map(([k, n, t]) =>
        `<button type="button" class="${k === rezim ? 'on' : ''}" data-podobne-rezim="${k}" aria-pressed="${k === rezim}" title="${t}">${n}</button>`).join('')}</div>` : '';
    return `<h4>Podobné modelky <button type="button" class="link udaje-na-mape" data-na-mape="${id}" title="Zobrazit modelku a její okolí na Mapě sbírky ve Statistikách">Na mapě →</button></h4>
        ${prepinac}
        <div class="podobne-seznam">${podobne.map(p => `<div class="podobna-polozka">
            <button type="button" class="podobna-otevrit" data-modelka="${p.id}" title="Otevřít profil ${esc(p.m.jmeno)}">
                <span class="podobna-hlava"><span class="podobna-jmeno">${esc(p.m.jmeno)}</span>${p.m.hodnoceni ? `<span class="podobna-srd">${znakySrdicek(p.m.hodnoceni)}</span>` : ''}</span>
                ${p.duvody.length ? `<span class="podobna-duvody">${esc(p.duvody.join(' · '))}</span>` : ''}
            </button>
            <button type="button" class="podobna-porovnat" data-porovnat-s="${p.id}" title="Porovnat s touto: obě modelky vedle sebe v Hodnocení › Porovnat" aria-label="Porovnat s ${esc(p.m.jmeno)}">⚔</button>
        </div>`).join('')}</div>`;
}

function prekreslitPodobne() {
    const misto = /** @type {HTMLElement | null} */ (modelHeader.querySelector('[data-podobne]'));
    if (!misto) return;
    const html = htmlPodobnych();
    misto.innerHTML = html;
    misto.hidden = !html;
}

async function doplnitPodobne(id, moje) {
    let obsah = null;
    try { obsah = await GetPodobnostObsahu(id); } catch { return; }
    if (moje !== stav.cisloNacteni || podobneProfilu.id !== id) return;
    podobneProfilu.obsah = obsah;
    prekreslitPodobne();
}

// Odznaky síně slávy pod pořadím (jen získané) a tituly sezón (♛ Favoritka, ♥ Miláček – název sezóny, nejvýš tři
// nejnovější); klik otevře Síň slávy (odznaky, resp. kroniku)
const TITULU_V_PROFILU = 3;
async function doplnitOdznaky(id) {
    let odznaky = [];
    let tituly = [];
    try {
        // Každé zvlášť: chyba titulů nesmí schovat odznaky
        const [o, t] = await Promise.allSettled([GetOdznakyModelky(id), GetTitulySezonModelky(id)]);
        odznaky = o.status === 'fulfilled' ? o.value : [];
        tituly = t.status === 'fulfilled' ? t.value : [];
    } catch { /* odznaky jsou jen doplněk */ }
    odznaky ||= [];
    tituly ||= [];
    const misto = /** @type {HTMLElement | null} */ (profilPruh.querySelector('.profile-odznaky'));
    if (!misto || stav.aktualniModelka?.id !== id || (!odznaky.length && !tituly.length)) return;
    const popis = t => `${t.druh === 'favoritka' ? 'Favoritka' : 'Miláček'} sezóny ${t.nazev}${t.nazev !== t.obdobi ? ` (${t.obdobi})` : ''}`;
    const htmlTitulu = tituly.length
        ? `<button type="button" class="profile-tituly" data-otevrit-oblibenost="slava" data-slava-pohled="kronika" title="${esc(tituly.map(popis).join('\n'))}">${tituly.slice(0, TITULU_V_PROFILU).map(t =>
            `<span class="profile-titul ${esc(t.druh)}">${t.druh === 'favoritka' ? '♛' : '♥'} ${esc(t.nazev)}</span>`).join('')}${tituly.length > TITULU_V_PROFILU ? `<span class="profile-titul">+${tituly.length - TITULU_V_PROFILU}</span>` : ''}</button>`
        : '';
    const htmlOdznaku = odznaky.length ? `<button type="button" class="profile-odznaky-tlacitko" data-otevrit-oblibenost="slava" data-slava-pohled="odznaky" title="Otevřít odznaky v Síni slávy">${htmlRadyOdznaku(odznaky, 12)}</button>` : '';
    misto.innerHTML = htmlTitulu + htmlOdznaku;
    misto.hidden = false;
}

// Aktuální potvrzené pořadí v oblíbenosti pod srdíčky; klik otevře Pořadí v Oblíbenosti
function htmlPoradi(modelka) {
    if (!(Number(modelka.poradi) > 0)) return '';
    return `<button type="button" class="profile-poradi" data-otevrit-oblibenost title="Otevřít Pořadí v Hodnocení">${modelka.poradi}. v oblíbenosti</button>`;
}

// Ostatní modelky sdíleného alba (hlavní i další kromě té, jejíž profil je otevřený) jako odkazy na jejich profil
function htmlSpoluModelek(a, krome = stav.aktualniModelka?.id) {
    const ostatni = [{ id: a.modelkaId, jmeno: a.jmenoModelky }, ...a.dalsiModelky].filter(m => m.id !== krome && m.jmeno);
    return ostatni.length ? `<span class="album-spolu">s ${ostatni.map(m => `<button class="chip" data-modelka="${m.id}" title="Otevřít profil">${esc(m.jmeno)}</button>`).join(' ')}</span>` : '';
}

// Průvodní text alba a fotograf; delší text je zkrácený a rozbaluje se kliknutím
export function htmlPopisuAlba(a) {
    if (!a.popis && !a.fotograf) return '';
    return `
        <div class="album-desc">
            ${a.popis ? `<div class="album-desc-text">${formatMarkdown(a.popis)}</div>
            <button class="link album-desc-more hidden" data-rozbalit>více</button>` : ''}
            ${a.fotograf ? `<p class="album-credit">Foto: <button class="link" data-fotograf="${esc(a.fotograf)}" title="Všechna alba tohoto fotografa">${esc(a.fotograf)}</button></p>` : ''}
        </div>
    `;
}

// Tlačítko „více" má smysl jen u textu, který se do zkrácené podoby nevešel
// Rozměry se nejdřív všechny přečtou a pak se teprve zapisuje; střídání čtení a zápisu by u každého alba
// znovu rozvrhovalo celou stránku
export function pripravitPopisy(pohled) {
    const texty = [...pohled.querySelectorAll('.album-desc-text')];
    const vejdeSe = texty.map(text => text.scrollHeight <= text.clientHeight + 1);
    texty.forEach((text, i) => text.nextElementSibling.classList.toggle('hidden', vejdeSe[i]));
}

// Odkazy modelky jako štítky s názvem webu; otevírají se v prohlížeči
export function htmlOdkazu(text) {
    const odkazy = String(text || '').split('\n').map(o => o.trim()).filter(o => /^https?:\/\//i.test(o));
    if (!odkazy.length) return '';
    const web = o => { try { return new URL(o).hostname.replace(/^www\./, ''); } catch { return o; } };
    return `<div class="profile-links">${odkazy.map(o => `<button class="chip" data-odkaz="${esc(o)}" title="${esc(o)}">${esc(web(o))}</button>`).join('')}</div>`;
}

// Plakát: jedna nebo více stránek spojených bez mezer, volitelně otočený
// line = adresa jen v data-src, načte ji postupné načítání (nacitatPostupne) při přiblížení k oknu;
// pro dlouhé přehledy, kde je plakátů mnoho
export function htmlPlakatu(polozka, velikost, atributy = '', line = false) {
    return `
        <div class="poster" data-rot="${polozka.rotace}" ${atributy} ${atributy.includes('data-index') ? 'tabindex="0"' : ''}>
            <div class="poster-inner">
                ${polozka.fotky.map(f => `<img ${line ? 'data-src' : 'src'}="${esc(obrazek(f.url, velikost))}" data-foto-id="${f.id}" draggable="false" decoding="async" />`).join('')}
            </div>
            ${htmlAkciDlazdice()}
        </div>
    `;
}

// Po načtení stránek nastaví plakátu poměr stran a rozložení stránek
export function pripravitPlakat(plakat, poZmene = () => {}) {
    const vnitrek = plakat.querySelector('.poster-inner');
    const obrazky = [...vnitrek.querySelectorAll('img')];

    const prepocitat = () => {
        if (obrazky.some(o => !o.naturalWidth)) return;
        const pomery = obrazky.map(o => o.naturalWidth / o.naturalHeight);
        // Stránky na výšku se řadí vedle sebe, stránky na šířku pod sebe
        const sloupec = obrazky.length > 1 && pomery[0] > 1;
        vnitrek.classList.toggle('column', sloupec);
        // Podíl stránky na délce plakátu; násobek drží součet nad 1, jinak by flex nevyplnil celý plakát
        obrazky.forEach((o, i) => { o.style.flex = `${(sloupec ? 1 / pomery[i] : pomery[i]) * 100} 1 0px`; });

        // Rozměr celého plakátu v pixelech zdrojových obrázků (před otočením)
        const W = sloupec ? Math.max(...obrazky.map(o => o.naturalWidth)) : null;
        const H = sloupec ? null : Math.max(...obrazky.map(o => o.naturalHeight));
        plakat._rozmer = sloupec
            ? { W, H: W * pomery.reduce((s, p) => s + 1 / p, 0) }
            : { W: H * pomery.reduce((s, p) => s + p, 0), H };

        const pomer = plakat._rozmer.W / plakat._rozmer.H;
        plakat.style.setProperty('--ar', parseInt(plakat.dataset.rot) % 180 ? 1 / pomer : pomer);
        poZmene();
    };

    obrazky.forEach(o => o.addEventListener('load', prepocitat));
    prepocitat();
}

// Alba v profilu chronologicky podle vydání, bez vydání na konci v pořadí, jak přibyla; ruční přeřazení fotek
// uvnitř alba tak pořadí alb nemění. Online album se řadí podle data nafocení (vydání nemá). Centerfoldy první.
// Stejné pořadí má prohlížeč otevřený z náhledu v Oblíbenosti.
export function seraditAlbaProfilu(alba) {
    const klicPoradi = a => {
        const v = jeOnline(a.typ) ? rozlozitVydani(a.datumAlba.slice(0, 7)) : rozlozitVydani(a.typ === 'Centerfold' ? a.album : a.vydani);
        return v ? `0${v.rok}${v.mesic || '00'}${v.edice}` : '1';
    };
    const prvniFotka = a => Math.min(...a.fotky.map(f => f.id));
    return alba.sort((x, y) => Number(y.typ === 'Centerfold') - Number(x.typ === 'Centerfold')
        || klicPoradi(x).localeCompare(klicPoradi(y)) || prvniFotka(x) - prvniFotka(y));
}

// Načtení fotografií v detailu
export async function nacistFotkyModelky(modelkaId) {
    const fotky = await GetFotografieModelky(modelkaId);
    // Při rychlém listování mezi modelkami může dorazit odpověď pro tu předchozí; její alba se nesmí ukázat
    // pod jménem jiné modelky, úpravy by pak šly na špatnou
    if (stav.aktualniModelka?.id !== modelkaId) return;
    // Překreslení alb výběr ruší
    stav.posledniVybrana = null;
    selectionBar.classList.add('hidden');

    stav.aktualniAlba = sestavitAlba(fotky || []);
    // Jméno hlavní modelky sdíleného alba (fotky profilu jména nenesou)
    const jmenaModelek = new Map((stav.nacteneModelky || []).map(m => [m.id, m.jmeno]));
    jmenaModelek.set(stav.aktualniModelka.id, stav.aktualniModelka.jmeno);
    const neznama = stav.aktualniAlba.filter(a => !jmenaModelek.has(a.modelkaId));
    if (neznama.length) (await vsechnyModelky()).forEach(m => jmenaModelek.set(m.id, m.jmeno));
    stav.aktualniAlba.forEach(a => { a.jmenoModelky = jmenaModelek.get(a.modelkaId) || ''; });
    seraditAlbaProfilu(stav.aktualniAlba);
    // Pořadí pro prohlížeč: nejdřív centerfoldy z levého sloupce, potom alba
    stav.aktualniPolozky = stav.aktualniAlba.flatMap(a => a.polozky);

    // Indexy alb a položek se sestaví jednou; hledání v poli u každé dlaždice by rostlo s druhou mocninou
    const indexAlba = new Map(stav.aktualniAlba.map((a, i) => [a, i]));
    const indexPolozky = new Map(stav.aktualniPolozky.map((p, i) => [p, i]));

    const htmlAlba = (a) => {
        const popis = sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek');

        return `
            <section class="album" data-album="${indexAlba.get(a)}" data-cast="${indexAlba.get(a)}"${jeOnline(a.typ) ? ' data-online' : ''}>
                <div class="album-header">
                    <h4>${esc(nazevAlba(a.album, a.typ))}</h4>
                    <span>${esc(popisTypuAlba(a.typ, a.datumAlba, a.vydani))} · ${popis}</span>
                    ${a.vydani ? htmlStitkuVydani(a.vydani) : ''}
                    ${htmlSpoluModelek(a)}
                    <button class="album-more" data-nabidka-alba title="Akce alba (také pravým tlačítkem)">&#8943;</button>
                </div>
                ${htmlPopisuAlba(a)}
                <div class="photos-grid mozaika" ${atributyMrizky(a)}>
                    ${a.polozky.map(p => {
                        const index = indexPolozky.get(p);
                        return `<div class="photo-item" data-index="${index}" data-foto-id="${p.fotky[0].id}" tabindex="0" style="--pomer: ${pomerFotky(p.fotky[0].id) || 0.75}">
                                   <img data-src="${esc(obrazek(p.fotky[0].url, VELIKOST_NAHLEDU))}" decoding="async" draggable="false" />
                                   ${htmlSrdickaFotky(p, index)}
                                   ${htmlAkciDlazdice()}
                               </div>`;
                    }).join('')}
                </div>
            </section>
        `;
    };

    const centerfoldy = stav.aktualniAlba.filter(a => a.typ === 'Centerfold');
    const ostatni = stav.aktualniAlba.filter(a => a.typ !== 'Centerfold');
    // Prázdný stav se sestaví, jen když modelka nemá žádná další alba; text podle toho, zda má aspoň centerfold
    const prazdno = () => centerfoldy.length
        ? htmlPrazdna('Žádná další alba', 'Pictorialy, fotky z dalších čísel a ostatní alba modelky se objeví tady. Stačí vložit odkazy na fotky z Google Disku.', { tlacitko: { text: 'Přidat fotky', akce: 'pridat-album' } })
        : htmlPrazdna('Zatím žádná alba', 'Centerfoldy, pictorialy a další alba modelky se objeví tady. Stačí vložit odkazy na fotky z Google Disku.', { tlacitko: { text: 'Přidat fotky', akce: 'pridat-album' } });
    photosGrid.innerHTML = ostatni.map(htmlAlba).join('') || prazdno();

    // Centerfold je tlačítko v pruhu: otevře plakát v prohlížeči (víc centerfoldů: ↑ ↓ mezi nimi); hvězdička je
    // růžová, když modelka centerfold má, jinak jen bílý obrys a tlačítko je vypnuté
    const prvniCenterfold = centerfoldy[0]?.polozky[0];
    // Bez centerfoldu je tlačítko vypnuté; v záhlaví profilu se pak neukazuje (style.css)
    centerfoldBtn.disabled = !prvniCenterfold;
    centerfoldBtn.dataset.index = prvniCenterfold ? String(indexPolozky.get(prvniCenterfold)) : '';
    centerfoldBtn.querySelector('b').textContent = centerfoldy.length > 1 ? `Centerfoldy ${centerfoldy.length}` : 'Centerfold';
    centerfoldBtn.title = !prvniCenterfold ? 'Modelka zatím nemá centerfold'
        : centerfoldy.length > 1 ? 'Otevřít centerfoldy v prohlížeči (↑ ↓ mezi nimi)'
        : `Otevřít centerfold${centerfoldy[0]?.album ? ` ${nazevVydani(centerfoldy[0].album)}` : ''} v prohlížeči`;

    // Lišta má smysl až od dvou alb
    listaAlb.naplnit(ostatni.map(a => ({ klic: indexAlba.get(a), nazev: nazevAlba(a.album, a.typ), pocet: a.fotky.length })));
    const fotek = stav.aktualniAlba.reduce((s, a) => s + a.fotky.length, 0);
    profilPocet.textContent = fotek ? `${sklonovat(fotek, 'fotka', 'fotky', 'fotek')} · ${sklonovat(stav.aktualniAlba.length, 'album', 'alba', 'alb')}` : '';
    // Řádek kariéry v banneru: alba a fotky
    const pocty = profilPruhObsah.querySelector('.pruh-pocty');
    if (pocty) pocty.textContent = fotek ? `${sklonovat(stav.aktualniAlba.length, 'album', 'alba', 'alb')} · ${sklonovat(fotek, 'fotka', 'fotky', 'fotek')}` : '';
    nastavitStav(profilPocet.textContent);

    detailView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    nacitatPostupne(photosGrid);
    pripravitPopisy(detailView);
    sledovatMozaiku(photosGrid, detailView);
    zkratitAlba(detailView);
    listaAlb.sledovat();
    zasobnik.zobrazitProModelku();
}

function zrusitZnackyVlozeni() {
    document.querySelectorAll('.vlozit-pred, .vlozit-za').forEach(d => d.classList.remove('vlozit-pred', 'vlozit-za'));
}

async function dokoncitTazeniFotky(zrusit = false) {
    const t = stav.tazenaFotka;
    stav.tazenaFotka = null;
    if (!t || !t.tahne) return;
    zrusitZnackyVlozeni();
    t.dlazdice.classList.remove('tazena');
    document.body.classList.remove('razeni');
    // Uvolnění tlačítka po tažení nesmí fotku otevřít
    stav.praveTazeno = true;
    setTimeout(() => { stav.praveTazeno = false; }, 0);
    if (zrusit || !t.cil) return;

    // Výchozí je pořadí, v jakém jsou fotky právě vidět; tím se z alba stává ručně seřazené
    const album = stav.aktualniAlba[parseInt(t.dlazdice.closest('.album').dataset.album)];
    const ids = novePoradi(album.polozky.map(p => p.fotky[0].id),
        parseInt(t.dlazdice.dataset.fotoId), parseInt(t.cil.dataset.fotoId), t.pred);

    if (!await SetPoradiFotek(ids)) return;
    if (!album.rucniPoradi) oznamit('Album má teď ruční pořadí a podle srdíček se už nepřeskupuje. Zpět: ⋯ u alba → Řadit album podle srdíček.');
    nacistFotkyModelky(stav.aktualniModelka.id);
}

// Posun stránky spojeného plakátu o jedno místo; smer -1 = dřív, 1 = později
export async function posunoutStranku(album, fotka, smer) {
    const ids = album.fotky.map(f => f.id);
    const odkud = ids.indexOf(fotka.id);
    const kam = odkud + smer;
    if (kam < 0 || kam >= ids.length) return;
    [ids[odkud], ids[kam]] = [ids[kam], ids[odkud]];
    if (await SetPoradiFotek(ids)) nacistFotkyModelky(stav.aktualniModelka.id);
}

// Mozaika alb v profilu: řady stejné výšky, šířka dlaždice podle poměru stran fotky (fotka na šířku je širší). Poměr
// se zjistí po načtení obrázku a zapamatuje (pomerFotky); pak se znovu spočítá, které řady ukážou jen alba, ve
// kterých se obrázek načetl (ostatní alba se nerozbalují a neměří).
function sledovatMozaiku(mrizka, pohled) {
    if (mrizka.dataset.mozaika) return;
    mrizka.dataset.mozaika = '1';
    let prepocet = 0;
    const zmenene = new Set();
    mrizka.addEventListener('load', (e) => {
        const img = /** @type {HTMLImageElement} */ (e.target);
        const dlazdice = img?.tagName === 'IMG' ? /** @type {HTMLElement | null} */ (img.parentElement?.closest('.mozaika > .photo-item')) : null;
        if (!dlazdice || !img.naturalWidth || img.src.startsWith('data:')) return;
        const pomer = img.naturalWidth / img.naturalHeight;
        dlazdice.style.setProperty('--pomer', pomer.toFixed(3));
        zapamatovatPomer(Number(dlazdice.dataset.fotoId), pomer);
        if (dlazdice.parentElement) zmenene.add(dlazdice.parentElement);
        clearTimeout(prepocet);
        prepocet = setTimeout(() => {
            const jen = new Set(zmenene);
            zmenene.clear();
            zkratitAlba(pohled, jen);
        }, 120);
    }, true);
}

// Kolik dlaždic mozaiky se vejde do prvních řad: změřit řady (dlaždice jsou už všechny ukázané) a vrátit index
// první dlaždice za nimi
function limitMozaiky(dlazdice) {
    const vrcholy = [];
    for (const [i, d] of dlazdice.entries()) {
        const vrchol = /** @type {HTMLElement} */ (d).offsetTop;
        if (!vrcholy.includes(vrchol)) vrcholy.push(vrchol);
        if (vrcholy.length > RADKU_NAHLEDU) return i;
    }
    return dlazdice.length;
}

// Dlouhé album ukazuje jen první řádky; poslední viditelná dlaždice nese počet skrytých fotek a album rozbalí
const RADKU_NAHLEDU = 2;
const rozbalenaAlba = new Set();
export const atributyMrizky = a => `data-klic="${esc(klicAlba(a))}"`;

// Počty sloupců všech mřížek se zjistí najednou před prvním zápisem (jinak by se po každém albu rozvrhovalo znovu).
// Mozaiky všech alb se stejně tak nejdřív všechny rozbalí, pak změří a teprve potom zkrátí; střídání zápisu a měření
// po albech by rozvrhovalo celou stránku znovu za každé album.
// jen = mřížky, které se změnily (načtené obrázky mozaiky); bez něj všechny
export function zkratitAlba(pohled, jen = null) {
    const mrizky = [...pohled.querySelectorAll('.photos-grid')]
        // Počet sloupců jde zjistit jen u mřížky, která je vidět
        .filter(mrizka => (!jen || jen.has(mrizka)) && mrizka.offsetParent)
        .map(mrizka => ({ mrizka, dlazdice: [...mrizka.children], sloupcu: mrizka.classList.contains('mozaika') ? 0 : getComputedStyle(mrizka).gridTemplateColumns.split(' ').length }));
    // Mozaika nemá sloupce: řady se změří, až jsou vidět všechny dlaždice
    mrizky.forEach(({ dlazdice, sloupcu }) => { if (!sloupcu) dlazdice.forEach(d => d.classList.remove('skryta', 'dalsi')); });
    const limity = mrizky.map(({ dlazdice, sloupcu }) => sloupcu ? sloupcu * RADKU_NAHLEDU : limitMozaiky(dlazdice));
    mrizky.forEach(({ mrizka, dlazdice }, j) => {
        const limit = limity[j];
        const zkratit = dlazdice.length > limit && !rozbalenaAlba.has(mrizka.dataset.klic);

        dlazdice.forEach((d, i) => {
            d.classList.toggle('skryta', zkratit && i >= limit);
            d.classList.toggle('dalsi', zkratit && i === limit - 1);
            if (zkratit && i === limit - 1) d.dataset.dalsich = `+${dlazdice.length - limit}`;
        });
        mrizka.classList.toggle('zkracena', zkratit);
        mrizka.classList.toggle('rozbalena', dlazdice.length > limit && !zkratit);
    });
}

export function prepnoutRozbaleniAlba(mrizka, rozbalit) {
    if (rozbalit) rozbalenaAlba.add(mrizka.dataset.klic);
    else rozbalenaAlba.delete(mrizka.dataset.klic);
    zkratitAlba(mrizka.parentElement, new Set([mrizka]));
    listaAlb.sledovat();
}

// Klik na dlaždici s počtem skrytých fotek album rozbalí, místo aby otevřel fotku
export function rozbalitKliknute(e) {
    const dlazdice = e.target.closest('.photo-item.dalsi');
    if (dlazdice) prepnoutRozbaleniAlba(dlazdice.parentElement, true);
    return Boolean(dlazdice);
}

// Výsuvný panel s údaji modelky vpravo; otevřený zůstane i pro další profily (pamatuje si to i po restartu)
const KLIC_UDAJU = 'profilUdaje';
function nastavitUdaje(otevrit) {
    detailView.classList.toggle('udaje-otevrene', otevrit);
    const tlacitko = document.getElementById('infoBtn');
    tlacitko?.classList.toggle('zapnuto', otevrit);
    tlacitko?.setAttribute('aria-pressed', String(otevrit));
    try { localStorage.setItem(KLIC_UDAJU, otevrit ? '1' : '0'); } catch { /* jen pohodlí */ }
}
export function prepnoutUdaje(otevrit = !detailView.classList.contains('udaje-otevrene')) {
    nastavitUdaje(otevrit);
    // Užší galerie má jiný počet fotek v řadách náhledu
    requestAnimationFrame(() => zkratitAlba(detailView));
}

// Fotka záhlaví (v datech profilová) s vlastním výřezem vyplní záhlaví bez ohledu na to, je-li na výšku, nebo
// na šířku – záhlaví se fotce nepřizpůsobuje, výřez určí, která část je vidět. Fotku karty si záhlaví nepůjčuje:
// bez fotky záhlaví je nižší a nabídne, jak ji vybrat.
export function aktualizovatBannerProfilu(modelka) {
    const bannerImg = /** @type {HTMLImageElement | null} */ (document.getElementById('profilBannerFoto'));
    if (!bannerImg) return;
    const id = modelka.id;
    if (stav.profilovaFotka?.modelkaId !== id) {
        stav.profilovaFotka = null;
        nastavitFotkuBanneru(bannerImg, '', '');
    }
    GetProfilovaFotka(id).then(profilova => {
        if (stav.aktualniModelka?.id !== id) return;
        stav.profilovaFotka = profilova?.url ? { ...profilova, modelkaId: id } : null;
        nastavitFotkuBanneru(bannerImg, profilova?.url ? obrazek(profilova.url, VELIKOST_TITULNI) : '', profilova?.url ? stylVyrezu(profilova) : '',
            profilova?.url ? obrazek(profilova.url, VELIKOST_ZAHLAVI) : '');
    }).catch(() => nastavitFotkuBanneru(bannerImg, '', ''));
}

// Jak vybrat fotku záhlaví (odkaz v záhlaví bez fotky, nabídka)
export const navodFotkyZahlavi = () => oznamit('Fotku záhlaví vybereš na kterékoli fotce modelky: pravým tlačítkem nebo ⋯ › Nastavit jako fotku záhlaví. Fotka vyplní celé záhlaví, výřez pak určí, která část je vidět.');

// Záhlaví je široké přes celé okno: náhled (w800) se nahradí fotkou v plném rozlišení (VELIKOST_ZAHLAVI, uložená
// na disku – podruhé je tam hned), jakmile se načte; rozostřené pozadí zůstane na náhledu
function nastavitFotkuBanneru(bannerImg, adresa, styl, originalAdresa = '') {
    const pozadi = document.getElementById('profilBannerPozadi');
    const rozmazane = document.getElementById('profilBannerRozmazane');
    pozadi?.classList.toggle('bez-fotky', !adresa);
    const odkaz = /** @type {HTMLElement | null} */ (profilPruhObsah.querySelector('[data-fotka-zahlavi]'));
    if (odkaz) odkaz.hidden = Boolean(adresa);
    if (adresa) {
        bannerImg.src = adresa;
        if (originalAdresa && originalAdresa !== adresa) {
            const original = new Image();
            original.decoding = 'async';
            original.onload = () => {
                // Mezitím se mohl otevřít jiný profil nebo změnit fotka záhlaví
                if (bannerImg.getAttribute('src') === adresa) bannerImg.src = originalAdresa;
            };
            original.src = originalAdresa;
        }
        // cssText přepíše celý styl, proto display až po něm
        bannerImg.style.cssText = styl;
        bannerImg.style.display = 'block';
        if (rozmazane) rozmazane.style.backgroundImage = `url("${adresa.replace(/"/g, '%22')}")`;
    } else {
        bannerImg.removeAttribute('src');
        bannerImg.style.display = 'none';
        if (rozmazane) rozmazane.style.backgroundImage = '';
    }
}

// Úprava výřezu profilové fotky přímo v záhlaví (fotka přes celou šířku): záhlaví se rozbalí a fotka vystoupí nad jméno a akce
// (.uprava-profilove); tažením posun, kolečkem nebo posuvníkem přiblížení. Titulní fotky se úprava netýká.
export function upravitVyrezProfilove() {
    const modelka = stav.aktualniModelka;
    const profilova = stav.profilovaFotka;
    const banner = /** @type {HTMLElement | null} */ (document.getElementById('profilBannerPozadi'));
    const ram = /** @type {HTMLElement | null} */ (document.getElementById('profilBannerRam'));
    const lista = document.querySelector('.hlavni-lista');
    if (!modelka || !profilova || !banner || !ram || !lista) return;
    hlavniOblast.scrollTop = 0;
    document.querySelector('.navbar')?.classList.remove('profil-svinuty');
    lista.classList.add('uprava-profilove');
    upravitVyrez(modelka, {
        karta: banner,
        // Výřez se upravuje v rámu ostré fotky (ten je vidět), ne přes celou šířku banneru
        ramFotky: ram,
        vyrezFotky: profilova,
        vychozi: { coverZoom: 1, coverX: 50, coverY: 22 },
        ulozit: (v) => SetProfilovyVyrez(modelka.id, v.coverZoom, v.coverX, v.coverY),
        poUkonceni: () => lista.classList.remove('uprava-profilove'),
    });
}

// Úprava výřezu titulní fotky v profilu: na velké fotce v panelu Údaje (panel se otevře). Rám má při úpravě poměr
// stran karty v galerii, výřez tak odpovídá tomu, co karta ukáže; záhlaví (profilové fotky) se netýká.
export function upravitVyrezProfilu() {
    const modelka = stav.aktualniModelka;
    const ram = /** @type {HTMLElement | null} */ (modelHeader.querySelector('.profile-cover-ram'));
    if (!modelka || !ram) return;
    prepnoutUdaje(true);
    ram.scrollIntoView({ block: 'nearest' });
    upravitVyrez(modelka, { karta: ram });
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Zásobník odkazů nad alby; „Nové album…“ předá odkazy do okna alba
    zasobnik.pripravit({
        nacistFotky: nacistFotkyModelky,
        otevritAlbum: (modelka, odkazy) => {
            otevritAlbumModal(modelka);
            const pole = /** @type {HTMLTextAreaElement} */ (document.getElementById('inputBulkLinks'));
            pole.value = odkazy;
            pole.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('inputAlbumName')?.focus();
        },
    });
    modelHeader.addEventListener('click', (e) => {
        if (e.target.closest('[data-upravit-vyrez]')) upravitVyrezProfilu();
        const naMape = /** @type {HTMLElement | null} */ (e.target.closest('[data-na-mape]'));
        if (naMape) {
            otevritMapuModelky(parseInt(naMape.dataset.naMape, 10));
            return;
        }
        const rezim = /** @type {HTMLElement | null} */ (e.target.closest('[data-podobne-rezim]'));
        if (rezim) {
            rezimPodobnych = rezim.dataset.podobneRezim === 'fotky' ? 'fotky' : 'udaje';
            try { localStorage.setItem(KLIC_REZIMU_PODOBNYCH, rezimPodobnych); } catch { /* jen pro toto spuštění */ }
            prekreslitPodobne();
            /** @type {HTMLElement | null} */ (modelHeader.querySelector(`[data-podobne-rezim="${rezimPodobnych}"]`))?.focus();
            return;
        }
        // ⚔ u podobné modelky: dvojice jde do Hodnocení › Porovnat jako první (obsluha data-zobrazeni-prehledu
        // v prehled.js Porovnat otevře, ať je Hodnocení načtené, nebo ne)
        const porovnat = /** @type {HTMLElement | null} */ (e.target.closest('[data-porovnat-s]'));
        if (porovnat) {
            porovnatNaZacatku(podobneProfilu.id, parseInt(porovnat.dataset.porovnatS, 10));
            const b = document.createElement('button');
            b.hidden = true;
            b.dataset.zobrazeniPrehledu = 'porovnat';
            document.querySelector('main')?.append(b);
            b.click();
            b.remove();
            return;
        }
        // Tagy: rozbalení a sbalení dlouhého seznamu
        const rozbalit = /** @type {HTMLElement | null} */ (e.target.closest('[data-rozbalit-tagy]'));
        if (rozbalit) {
            const tagy = rozbalit.parentElement.querySelector('.profile-tags');
            const rozbaleno = tagy.classList.toggle('rozbalene');
            rozbalit.setAttribute('aria-expanded', String(rozbaleno));
            rozbalit.textContent = rozbaleno ? 'Méně tagů' : 'Všechny tagy';
        }
    });
    let otevreneUdaje = false;
    try { otevreneUdaje = localStorage.getItem(KLIC_UDAJU) === '1'; } catch { /* výchozí zavřené */ }
    nastavitUdaje(otevreneUdaje);
    document.getElementById('infoBtn').addEventListener('click', () => prepnoutUdaje());

    // Lišta alb je ve druhém řádku hlavičky vedle drobečků, jako podmenu ostatních sekcí
    document.getElementById('podmenu').before(listaAlb.nav);
    // Pruh s modelkou je součástí panelu s drobečky (nad lištou alb): jeden panel profilu v hlavičce se širokoúhlým bannerem.
    listaAlb.nav.before(profilPruh);
    // Nahoře na stránce je záhlaví vysoké a bez skla (fotka v banneru je vidět); po odrolování se zmenší na
    // kompaktní pruh se sklem. Mezera mezi prahy, aby záhlaví na hranici neblikalo.
    const navbar = document.querySelector('.navbar');
    hlavniOblast.addEventListener('scroll', () => {
        if (detailView.classList.contains('hidden')) return;
        const odrolovano = hlavniOblast.scrollTop;
        // Záhlaví z ⋯ › Vzhled: Vysoké se svine po odrolování, Pevné zůstane vysoké, Jen pruh je svinuté stále
        const zahlavi = vzhled().zahlavi;
        if (zahlavi !== 'vysoke') navbar.classList.toggle('profil-svinuty', zahlavi === 'pruh');
        else if (odrolovano > 60) navbar.classList.add('profil-svinuty');
        else if (odrolovano < 20) navbar.classList.remove('profil-svinuty');
    }, { passive: true });
    // Změna záhlaví v ⋯ › Vzhled při otevřeném profilu
    window.addEventListener('vzhled-zmenen', () => {
        if (detailView.classList.contains('hidden')) return;
        const zahlavi = vzhled().zahlavi;
        navbar.classList.toggle('profil-svinuty', zahlavi === 'pruh' || (zahlavi === 'vysoke' && hlavniOblast.scrollTop > 60));
    });
    // Jméno v pruhu u profilu otevřeného ze seznamu otevře nabídku modelek seznamu (jako dřív jméno v drobečcích)
    profilPruhObsah.addEventListener('click', (e) => {
        if (!/** @type {HTMLElement} */ (e.target).closest('.pruh-identita h2')) return;
        const drobecek = /** @type {HTMLButtonElement} */ (document.getElementById('drobecek'));
        if (drobecek.disabled) return;
        // Klik by jinak doběhl k dokumentu a nabídku hned zavřel jako klik mimo ni
        e.stopPropagation();
        drobecek.click();
    });

    // I přepne údaje; Esc nejdřív ukončí režim výběru
    document.addEventListener('keydown', (e) => {
        if (detailView.classList.contains('hidden') || e.ctrlKey || e.altKey || e.metaKey
            || e.target.closest('input, textarea, select, [contenteditable]') || document.querySelector('.lightbox:not(.hidden), .modal-overlay:not(.hidden)')) return;
        if (e.key.toLowerCase() === 'i' && !e.shiftKey) {
            e.preventDefault();
            prepnoutUdaje();
        } else if (e.key === 'Escape' && rezimVyberu()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            zrusitVyber();
        }
    }, true);

    hlavniOblast.addEventListener('click', (e) => {
        const tlacitko = e.target.closest('[data-rozbalit]');
        if (!tlacitko) return;
        const rozbaleno = tlacitko.previousElementSibling.classList.toggle('open');
        tlacitko.textContent = rozbaleno ? 'méně' : 'více';
    });

    // Páska online alb přeskočí na první online album; pořadí v oblíbenosti otevře Hodnocení nebo Síň slávy (jako tlačítko v liště)
    profilPruh.addEventListener('click', (e) => {
        // Centerfold je v záhlaví okna, mimo stránku profilu: plakát otevře přímo (obsluha dlaždic stránky ho nevidí)
        const cf = /** @type {HTMLButtonElement | null} */ (e.target.closest('#centerfoldBtn'));
        if (cf) {
            if (!cf.disabled && cf.dataset.index) otevritLightbox(parseInt(cf.dataset.index));
            return;
        }
        if (e.target.closest('[data-udaje]')) {
            prepnoutUdaje();
            return;
        }
        const doOblibenosti = e.target.closest('[data-otevrit-oblibenost]');
        if (doOblibenosti) {
            nastavitCastOblibenosti(doOblibenosti.dataset.otevritOblibenost || 'poradi');
            // Řada odznaků otevře v síni slávy rovnou sbírku odznaků
            if (doOblibenosti.dataset.slavaPohled) nastavitPohledSlavy(doOblibenosti.dataset.slavaPohled);
            otevritOblibenost();
            return;
        }
        if (e.target.closest('[data-fotka-zahlavi]')) {
            navodFotkyZahlavi();
            return;
        }
        const paska = e.target.closest('[data-online-album]');
        if (!paska) return;
        document.querySelector('#photosGrid section.album[data-online]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    photosGrid.addEventListener('pointerdown', (e) => {
        const dlazdice = e.target.closest('.photo-item');
        // S Ctrl nebo Shift se fotky vybírají, netahají
        if (e.button !== 0 || !dlazdice || dlazdice.classList.contains('dalsi') || e.target.closest('.hearts') || e.ctrlKey || e.metaKey || e.shiftKey) return;
        stav.tazenaFotka = { dlazdice, x: e.clientX, y: e.clientY, tahne: false, cil: null, pred: false };
    });

    window.addEventListener('pointermove', (e) => {
        const t = stav.tazenaFotka;
        if (!t) return;
        // Malý pohyb při kliknutí ještě není tažení
        if (!t.tahne) {
            if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 8) return;
            t.tahne = true;
            t.dlazdice.classList.add('tazena');
            document.body.classList.add('razeni');
        }
        // Značku vložení nese jen dosavadní cíl; hledat ji při každém pohybu myši v celém dokumentu netřeba
        t.cil?.classList.remove('vlozit-pred', 'vlozit-za');
        const pod = document.elementFromPoint(e.clientX, e.clientY)?.closest('.photo-item');
        // Přesouvá se jen uvnitř téhož alba
        t.cil = pod && pod !== t.dlazdice && pod.parentElement === t.dlazdice.parentElement ? pod : null;
        if (!t.cil) return;
        const obdelnik = t.cil.getBoundingClientRect();
        t.pred = e.clientX < obdelnik.left + obdelnik.width / 2;
        t.cil.classList.add(t.pred ? 'vlozit-pred' : 'vlozit-za');
    });

    window.addEventListener('pointerup', () => dokoncitTazeniFotky());

    window.addEventListener('pointercancel', () => dokoncitTazeniFotky(true));

    window.addEventListener('blur', () => dokoncitTazeniFotky(true));

    photosGrid.addEventListener('click', (e) => {
        if (!stav.praveTazeno) return;
        e.stopPropagation();
        e.preventDefault();
    }, true);

    hlavniOblast.addEventListener('scroll', () => {
        if (stav.cekaNaOznaceni) return;
        stav.cekaNaOznaceni = true;
        requestAnimationFrame(() => {
            stav.cekaNaOznaceni = false;
            listyStranky.forEach(l => l.sledovat());
        });
    }, { passive: true });

    // Počet sloupců mřížky, a tím i počet fotek v náhledu, závisí na šířce okna. Při tažení okraje okna chodí
    // událostí víc za snímek; přepočítá se jednou před dalším vykreslením.
    let cekaNaPrepocet = false;
    window.addEventListener('resize', () => {
        if (cekaNaPrepocet) return;
        cekaNaPrepocet = true;
        requestAnimationFrame(() => {
            cekaNaPrepocet = false;
            zkratitAlba(detailView);
            zkratitAlba(issueView);
            listyStranky.forEach(l => { l.sledovat(); l.upravitSipky(); });
        });
    });
}
