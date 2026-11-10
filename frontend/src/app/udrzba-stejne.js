// Údržba › Stejné fotky: skupiny souborů, které vypadají jako tatáž fotka (stejne_fotky.go). Soubory skupiny jsou
// vedle sebe s místy ve sbírce, srdíčky a tagy; „Nechat vybranou“ ostatní soubory sloučí do vybraného (jde vrátit),
// „V pořádku“ skupinu přestane hlásit (jde vrátit). Otisky fotek se počítají na pozadí; dokud běží, stav se obnovuje.
import { ZkontrolovatNoveFotky, GetStavOtisku, GetStejneFotky, OznacitRuzneFotky, SloucitStejneFotky, SpustitOtisky, VratitSlouceniStejnych, ZrusitRuzneFotky } from './backend';
import { esc, obrazek, sklonovat } from '../lib/format';
import { nastavitHtml } from '../ui/dom';
import { oznamit } from '../ui/oznameni';
import { PLNE_ROZLISENI, VELIKOST_NAHLEDU } from './obrazky';
import { otevritProfilPodleId } from './cover';
import { htmlListyVyberu, potvrditRozdil } from '../ui/hromadne';

/** @type {{ viditelna: () => boolean, poZmene: () => void }} */
let api = { viditelna: () => false, poZmene: () => {} };
let kontejner = null;
let skupiny = null;      // poslední načtené skupiny (null = ještě nenačteno)
let stavOtisku = null;
let nacita = false;
let zastarale = false;   // sbírka se změnila: při zobrazení se skupiny načtou znovu (staré zůstanou vidět)
let casovac = null;
const vybrane = new Map(); // klíč skupiny → soubor, který nechat (jinak návrh z backendu)

const DUVODY = {
    stejna: ['Stejná fotka', 'Otisky se shodují: tentýž snímek, jen jinak uložený nebo zmenšený'],
    temer: ['Skoro stejná', 'Otisky jsou blízko: nejspíš tentýž snímek přeuložený, ořezaný nebo upravený'],
    obsah: ['Velmi podobná', 'Obsah fotek se skoro shoduje: mírně oříznutá kopie, nebo vedlejší snímek z téhož focení'],
};

export function pripravit(funkce) {
    api = { ...api, ...funkce };
}

export function zobrazit(prvek) {
    kontejner = prvek;
    vykreslit();
    if (skupiny === null || zastarale) nacist();
}

// Po změně sbírky jinde (smazané fotky, nové album) se skupiny načtou znovu, až budou vidět
export function zastarat() {
    zastarale = true;
    if (kontejner && api.viditelna()) nacist();
}

export const pocetSkupin = () => skupiny?.length ?? 0;

async function nacist() {
    if (nacita) return;
    nacita = true;
    zastarale = false;
    try {
        const [sk, st] = await Promise.all([GetStejneFotky(), GetStavOtisku()]);
        skupiny = sk || [];
        stavOtisku = st;
        for (const klic of [...vybrane.keys()]) if (!skupiny.some(s => s.klic === klic)) vybrane.delete(klic);
    } finally {
        nacita = false;
    }
    vykreslit();
    hlidatVypocet();
}

// Dokud se otisky počítají, stav (a po dokončení skupiny) se obnovuje, jen když je režim vidět
function hlidatVypocet() {
    clearTimeout(casovac);
    if (!stavOtisku?.bezi) return;
    casovac = setTimeout(async () => {
        if (!api.viditelna()) { hlidatVypocet(); return; }
        const pred = stavOtisku.hotovo;
        stavOtisku = await GetStavOtisku();
        if (!stavOtisku.bezi || stavOtisku.hotovo - pred >= 200) await nacist();
        else { vykreslit(); hlidatVypocet(); }
    }, 4000);
}

function htmlStavu() {
    const st = stavOtisku;
    if (!st || !st.celkem) return '';
    const chybi = st.celkem - st.hotovo - st.chybne;
    const procento = Math.floor(st.hotovo / st.celkem * 100);
    const text = st.bezi
        ? `Počítám otisky fotek: ${st.hotovo} z ${st.celkem} (${procento} %). Náhledy se stahují, jen když okno nepoužíváš.`
        : chybi > 0
            ? `Otisky má ${st.hotovo} z ${st.celkem} fotek. Stejné kopie se najdou jen mezi fotkami s otiskem.`
            : `Otisky mají všechny fotky (${st.hotovo})${st.chybne ? `, ${sklonovat(st.chybne, 'soubor nešel', 'soubory nešly', 'souborů nešlo')} načíst` : ''}.`;
    const tlacitko = !st.bezi && chybi > 0 ? '<button type="button" class="btn btn-secondary btn-small" data-us-spustit>Spočítat otisky</button>' : '';
    return `<div class="us-stav${st.bezi ? ' bezi' : ''}" role="status">
        <span class="us-pruh" style="--hotovo:${procento}%"></span><p>${esc(text)}</p>${tlacitko}</div>`;
}

function htmlMista(f) {
    const srdicka = f.hodnoceni ? `<span class="us-srd" title="${f.hodnoceni} ♥">${'♥'.repeat(f.hodnoceni)}</span>` : '';
    const vydani = f.vydani ? ` · ${esc(f.vydani)}` : '';
    return `<li><button type="button" class="us-modelka" data-us-modelka="${f.modelkaId}">${esc(f.jmenoModelky || 'Bez modelky')}</button>
        <span class="us-album">${esc(f.album)} <em>${esc(f.typ)}${vydani}</em></span>${srdicka}</li>`;
}

function htmlSouboru(sk, s, ponechat) {
    const f = s.fotky[0];
    const nechat = s.driveId === ponechat;
    const tagu = s.tagu ? sklonovat(s.tagu, 'tag', 'tagy', 'tagů') : 'bez tagů';
    const mist = s.fotky.length > 1 ? ` · ve ${s.fotky.length} albech` : '';
    return `<figure class="us-soubor${nechat ? ' nechat' : ''}">
        <button type="button" class="us-nahled" data-us-nechat="${esc(sk.klic)}" data-soubor="${esc(s.driveId)}" aria-pressed="${nechat}" title="${nechat ? 'Tento soubor zůstane' : 'Nechat tento soubor'}">
            <img src="${esc(obrazek(f.url, VELIKOST_NAHLEDU))}" alt="" loading="lazy" decoding="async" draggable="false" />
            <span class="us-znacka">${nechat ? '✓ Nechat' : 'Kopie'}</span>
        </button>
        <figcaption>
            <ul class="us-mista">${s.fotky.map(htmlMista).join('')}</ul>
            <p class="us-udaje">${esc(tagu)}${esc(mist)} · <a href="${esc(obrazek(f.url, PLNE_ROZLISENI))}" target="_blank" rel="noopener" title="Otevřít v plném rozlišení">plné rozlišení ↗</a></p>
        </figcaption>
    </figure>`;
}

function htmlSkupiny(sk) {
    const ponechat = vybrane.get(sk.klic) || sk.soubory.find(s => s.ponechat)?.driveId || sk.soubory[0].driveId;
    const [nazev, popis] = DUVODY[sk.duvod] || DUVODY.obsah;
    const kopii = sk.soubory.length - 1;
    return `<article class="us-skupina" data-us-skupina="${esc(sk.klic)}">
        <header class="us-hlava"><span class="us-duvod us-${esc(sk.duvod || 'obsah')}" title="${esc(popis)}">${esc(nazev)}</span>
            <span class="us-pocet">${sklonovat(sk.soubory.length, 'soubor', 'soubory', 'souborů')}</span></header>
        <div class="us-soubory">${sk.soubory.map(s => htmlSouboru(sk, s, ponechat)).join('')}</div>
        <footer class="us-akce">
            <button type="button" class="btn btn-primary btn-small" data-us-sloucit="${esc(sk.klic)}" title="Ostatní soubory se ve sbírce nahradí vybraným; srdíčka a tagy přejdou na něj">Nechat vybranou${kopii > 1 ? `, odebrat ${kopii} kopie` : ', odebrat kopii'}</button>
            <button type="button" class="btn btn-secondary btn-small" data-us-poradku="${esc(sk.klic)}" title="Skupina se přestane hlásit">V pořádku (nejsou stejné)</button>
        </footer>
    </article>`;
}

export function vykreslit() {
    if (!kontejner) return;
    if (skupiny === null) {
        nastavitHtml(kontejner, '<p class="prazdno-male">Hledám stejné fotky…</p>');
        return;
    }
    const uvod = skupiny.length
        ? `<p class="us-uvod">${esc(sklonovat(skupiny.length, 'skupina vypadá', 'skupiny vypadají', 'skupin vypadá'))} jako tatáž fotka. Klikem na náhled vyber soubor, který zůstane; v albech, kde je jen kopie, se soubor vymění a fotka v albu zůstane.</p>`
        : `<p class="prazdno-male">${stavOtisku?.hotovo ? 'Žádné stejné fotky. Sbírka je bez kopií.' : 'Zatím nejsou spočítané otisky fotek, stejné kopie se ještě nedají najít.'}</p>`;
    const jiste = skupiny.filter(sk => sk.duvod === 'stejna');
    const lista = skupiny.length ? htmlListyVyberu({ pocet: skupiny.length, jednotky: ['skupina', 'skupiny', 'skupin'], popis: `${jiste.length} jistě stejných`, akce: [
        jiste.length && { text: `Sloučit jistě stejné (${jiste.length})`, atribut: 'data-us-sloucit-jiste', hlavni: true, titulek: 'Jen skupiny se skoro shodnými otisky; v každé zůstane vybraný (nebo navržený) soubor. Předtím ukáže rozdíl.' },
    ] }) : '';
    nastavitHtml(kontejner, `<div class="us">${htmlStavu()}${uvod}${lista}<div class="us-seznam">${skupiny.map(htmlSkupiny).join('')}</div></div>`);
    if (!kontejner.dataset.usObsluha) {
        kontejner.dataset.usObsluha = '1';
        kontejner.addEventListener('click', klik);
    }
}

const skupina = klic => skupiny?.find(s => s.klic === klic);

async function klik(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    const nechat = /** @type {HTMLElement | null} */ (cil.closest('[data-us-nechat]'));
    const sloucit = /** @type {HTMLElement | null} */ (cil.closest('[data-us-sloucit]'));
    const poradku = /** @type {HTMLElement | null} */ (cil.closest('[data-us-poradku]'));
    const modelka = /** @type {HTMLElement | null} */ (cil.closest('[data-us-modelka]'));
    if (cil.closest('[data-us-sloucit-jiste]')) {
        await sloucitJiste();
    } else if (cil.closest('[data-us-spustit]')) {
        if (await SpustitOtisky()) {
            stavOtisku = await GetStavOtisku();
            vykreslit();
            hlidatVypocet();
        }
    } else if (nechat) {
        vybrane.set(nechat.dataset.usNechat, nechat.dataset.soubor);
        vykreslit();
    } else if (sloucit) {
        const sk = skupina(sloucit.dataset.usSloucit);
        if (!sk) return;
        const ponechat = vybrane.get(sk.klic) || sk.soubory.find(s => s.ponechat)?.driveId || sk.soubory[0].driveId;
        const odebrat = sk.soubory.map(s => s.driveId).filter(id => id !== ponechat);
        sloucit.setAttribute('disabled', '');
        const vysledek = await SloucitStejneFotky(ponechat, odebrat);
        if (!vysledek || vysledek.chyba) {
            sloucit.removeAttribute('disabled');
            oznamit('Fotky se nepodařilo sloučit.');
            return;
        }
        odebratSkupinu(sk.klic);
        const casti = [];
        if (vysledek.odebrano.length) casti.push(`${sklonovat(vysledek.odebrano.length, 'kopie odebrána', 'kopie odebrány', 'kopií odebráno')}`);
        if (vysledek.nahrazeno.length) casti.push(`v ${sklonovat(vysledek.nahrazeno.length, 'albu', 'albech', 'albech')} vyměněn soubor`);
        oznamit(`Sloučeno: ${casti.join(', ') || 'beze změny'}. Soubory na Google Disku zůstaly.`, { text: 'Vrátit', akce: async () => {
            await VratitSlouceniStejnych(vysledek);
            api.poZmene();
            zastarat();
        } });
        api.poZmene();
    } else if (poradku) {
        const sk = skupina(poradku.dataset.usPoradku);
        if (!sk) return;
        const ids = sk.soubory.map(s => s.driveId);
        if (!await OznacitRuzneFotky(ids)) return;
        odebratSkupinu(sk.klic);
        oznamit('Skupina označená jako v pořádku, už se nebude hlásit.', { text: 'Vrátit', akce: async () => {
            await ZrusitRuzneFotky(ids);
            zastarat();
        } });
    } else if (modelka) {
        otevritProfilPodleId(Number(modelka.dataset.usModelka));
    }
}

const ponechanySoubor = sk => vybrane.get(sk.klic) || sk.soubory.find(s => s.ponechat)?.driveId || sk.soubory[0].driveId;
const popisSouboru = s => `${s.fotky[0]?.jmenoModelky || 'bez modelky'} · ${s.fotky[0]?.album || ''}`;

async function sloucitJiste() {
    const seznam = (skupiny || []).filter(sk => sk.duvod === 'stejna');
    if (!seznam.length) return;
    const radky = seznam.flatMap(sk => {
        const nechat = sk.soubory.find(s => s.driveId === ponechanySoubor(sk));
        return sk.soubory.filter(s => s !== nechat).map(s => ({ kdo: popisSouboru(s), co: s.fotky.length > 1 ? `kopie ve ${s.fotky.length} albech` : 'kopie', pred: 'tento soubor', po: `soubor z ${popisSouboru(nechat)}` }));
    });
    if (!await potvrditRozdil({
        nadpis: 'Sloučit jistě stejné fotky',
        souhrn: `${sklonovat(seznam.length, 'skupina', 'skupiny', 'skupin')}: v každé zůstane jeden soubor, kopie se ve sbírce nahradí (srdíčka a tagy přejdou). Soubory na Disku zůstanou.`,
        radky, tlacitko: `Sloučit ${seznam.length}`,
    })) return;
    const hotove = [];
    for (const sk of seznam) {
        const ponechat = ponechanySoubor(sk);
        const v = await SloucitStejneFotky(ponechat, sk.soubory.map(s => s.driveId).filter(id => id !== ponechat)).catch(() => null);
        if (v && !v.chyba) { hotove.push(v); odebratSkupinu(sk.klic); }
    }
    if (!hotove.length) { oznamit('Fotky se nepodařilo sloučit.'); return; }
    oznamit(`Sloučeno ${sklonovat(hotove.length, 'skupina', 'skupiny', 'skupin')}${hotove.length < seznam.length ? ` (${seznam.length - hotove.length} se nepovedlo)` : ''}. Soubory na Google Disku zůstaly.`, { text: 'Vrátit', akce: async () => {
        for (const v of [...hotove].reverse()) await VratitSlouceniStejnych(v);
        api.poZmene();
        zastarat();
    } });
    api.poZmene();
}

function odebratSkupinu(klic) {
    skupiny = (skupiny || []).filter(s => s.klic !== klic);
    vybrane.delete(klic);
    vykreslit();
    document.dispatchEvent(new CustomEvent('volby-prehledu'));
}

// Otevření Sbírky › Údržba › Stejné fotky odjinud (upozornění po vložení fotek)
export function otevritStejneFotky() {
    try { localStorage.setItem('udrzbaRezim', 'stejne'); } catch { /* jen pro toto spuštění */ }
    zastarale = true;
    document.dispatchEvent(new CustomEvent('otevrit-rezim-udrzby', { detail: 'stejne' }));
}

// Po vložení fotek: otisky nových souborů proti sbírce (na pozadí, náhledy se stahují); shoda nabídne Stejné fotky
export async function upozornitNaStejne(links) {
    const nalezy = await ZkontrolovatNoveFotky(links) || [];
    if (!nalezy.length) return;
    const f = nalezy[0].existujici;
    const kde = `${f.jmenoModelky || 'bez modelky'}, ${f.album}`;
    const text = nalezy.length === 1
        ? `Nově vložená fotka už ve sbírce nejspíš je (${kde}).`
        : `${nalezy.length} nově vložených fotek už ve sbírce nejspíš je (např. ${kde}).`;
    oznamit(text, { text: 'Ukázat', akce: otevritStejneFotky });
}
