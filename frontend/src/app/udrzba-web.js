// Údržba › Z webu (pruchod_webem.go): průchod celou sbírkou proti Wikidatům, Wikipedii a Boobpedii na pozadí
// (1 dotaz za sekundu na server, jde přerušit a dokončit i po restartu) a fronta rozdílů proti zdrojům.
// Návrhy se přijímají po jednom, po modelce, nebo hromadně po údaji či zdroji (filtr + „Přijmout zobrazené“);
// odmítnuté se pamatují a znovu se nenabízí. Nic se nezapíše bez kliknutí.
import { GetNavrhyZWebu, GetStavPruchoduWebem, OdmitnoutNavrhyZWebu, PocetOdmitnutychZWebu, PrerusitPruchodWebem, PrijmoutNavrhyZWebuVratitelne, SpustitPruchodWebem, VratitPrijetiZWebu, ZrusitOdmitnutiZWebu } from './backend';
import { htmlListyVyberu, potvrditRozdil } from '../ui/hromadne';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { esc, formatDatum, sklonovat } from '../lib/format';
import { nastavitHtml } from '../ui/dom';
import { oznamit } from '../ui/oznameni';
import { otevritProfilPodleId } from './cover';
import { potvrdit } from './formular-modelky';

/** @type {{ viditelna: () => boolean, poZmene: () => void }} */
let api = { viditelna: () => false, poZmene: () => {} };
let kontejner = null;
/** @type {any[] | null} */
let navrhy = null;
/** @type {any} */
let stavPruchodu = null;
let odmitnutych = 0;
let casovac = null;
let zastarale = false;
const filtr = { pole: '', zdroj: '', opravy: false };
let jenChybejici = true;

const DATUMOVA = new Set(['narozeniDatum', 'umrtiDatum']);
const hodnotaKUkazani = (pole, h) => (h && DATUMOVA.has(pole) ? formatDatum(h) : h);

export function pripravit(funkce) {
    api = { ...api, ...funkce };
}

export function zobrazit(prvek) {
    kontejner = prvek;
    vykreslit();
    if (navrhy === null || zastarale) nacist();
}

// Po změně sbírky jinde (vyplněný údaj, smazaná modelka) se fronta načte znovu, až bude vidět
export function zastarat() {
    zastarale = true;
    if (kontejner && api.viditelna()) nacist();
}

async function nacist() {
    zastarale = false;
    const [n, st, odm] = await Promise.all([GetNavrhyZWebu(), GetStavPruchoduWebem(), PocetOdmitnutychZWebu()]);
    navrhy = n || [];
    stavPruchodu = st;
    odmitnutych = odm || 0;
    vykreslit();
    hlidatPruchod();
}

// Dokud průchod běží, stav a fronta se obnovují, jen když je režim vidět
function hlidatPruchod() {
    clearTimeout(casovac);
    if (!stavPruchodu?.bezi) return;
    casovac = setTimeout(async () => {
        if (!api.viditelna()) { hlidatPruchod(); return; }
        await nacist();
    }, 3000);
}

// Návrhy podle filtru; bez „opravy“ jen doplnění prázdných údajů
const zobrazene = () => (navrhy || []).filter(n => (!filtr.pole || n.pole === filtr.pole) && (!filtr.zdroj || n.zdroj === filtr.zdroj)
    && (filtr.opravy || !n.stavajici));

// Hromadně jen jednoznačné: u modelky a údaje jediná navržená hodnota mezi zobrazenými
function jednoznacne(seznam) {
    const pocty = new Map();
    seznam.forEach(n => {
        const k = `${n.modelkaId}|${n.pole}`;
        pocty.set(k, (pocty.get(k) || new Set()).add(n.hodnota));
    });
    return seznam.filter(n => pocty.get(`${n.modelkaId}|${n.pole}`).size === 1);
}

function htmlStavu() {
    const st = stavPruchodu;
    if (!st) return '';
    const procento = st.celkem ? Math.floor(st.hotovo / st.celkem * 100) : 0;
    let text, tlacitka = '';
    if (st.bezi) {
        text = `Procházím sbírku na webu: ${st.hotovo} z ${st.celkem} (${procento} %)${st.aktualni ? ` – ${st.aktualni}` : ''}. Jeden dotaz za sekundu na každý server, aplikaci můžeš dál používat.`;
        tlacitka = '<button type="button" class="btn btn-secondary btn-small" data-uw-prerusit>Přerušit</button>';
    } else if (st.zbyva > 0) {
        text = `Průchod je přerušený: hotovo ${st.hotovo} z ${st.celkem}, ${sklonovat(st.zbyva, 'modelka zbývá', 'modelky zbývají', 'modelek zbývá')}.`;
        tlacitka = '<button type="button" class="btn btn-primary btn-small" data-uw-pokracovat>Pokračovat</button>'
            + '<button type="button" class="btn btn-secondary btn-small" data-uw-spustit>Začít znovu</button>';
    } else {
        text = st.konec
            ? `Poslední průchod ${esc(formatDatum(st.konec.slice(0, 10)))} (${sklonovat(st.celkem, 'modelka', 'modelky', 'modelek')}${st.jenChybejici ? ' s chybějícími údaji' : ''})${st.chyb ? `, u ${st.chyb} zdroje neodpověděly` : ''}.`
            : 'Projde všechny modelky proti Wikidatům, Wikipedii a Boobpedii a rozdíly přidá sem. Nic se nezapíše samo.';
        tlacitka = `<label class="uw-volba"><input type="checkbox" data-uw-jen-chybejici ${jenChybejici ? 'checked' : ''} /> jen modelky s chybějícími údaji</label>
            <button type="button" class="btn btn-primary btn-small" data-uw-spustit>Projít sbírku na webu…</button>`;
    }
    return `<div class="us-stav uw-stav${st.bezi ? ' bezi' : ''}" role="status">
        ${st.bezi || st.zbyva ? `<span class="us-pruh" style="--hotovo:${procento}%"></span>` : ''}<p>${text}</p><div class="uw-tlacitka">${tlacitka}</div></div>`;
}

function htmlFiltru() {
    const vse = navrhy || [];
    const moznosti = (klic, popis) => [...new Map(vse.map(n => [n[klic], n[popis] || n[klic]])).entries()]
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'cs'));
    const select = (atribut, hodnota, prazdna, seznam) => `<select data-uw-filtr="${atribut}">
        <option value="">${prazdna}</option>${seznam.map(([k, n]) => `<option value="${esc(k)}" ${k === hodnota ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    const zobr = zobrazene();
    const hromadne = jednoznacne(zobr);
    const opravPocet = vse.filter(n => n.stavajici).length;
    return `<div class="uw-filtry">
        ${select('pole', filtr.pole, 'Všechny údaje', moznosti('pole', 'nazev'))}
        ${select('zdroj', filtr.zdroj, 'Všechny zdroje', moznosti('zdroj', 'zdrojNazev'))}
        <label class="uw-volba" title="Návrhy, které mění už vyplněný údaj (zdroj uvádí jinou hodnotu)"><input type="checkbox" data-uw-opravy ${filtr.opravy ? 'checked' : ''} /> i opravy vyplněných (${opravPocet})</label>
    </div>
    ${zobr.length ? htmlListyVyberu({ pocet: zobr.length, jednotky: ['návrh', 'návrhy', 'návrhů'], popis: hromadne.length < zobr.length ? `${hromadne.length} jednoznačných` : '', akce: [
        hromadne.length && { text: `Přijmout zobrazené (${hromadne.length})`, atribut: 'data-uw-prijmout-zobrazene', hlavni: true, titulek: 'Jen jednoznačné: kde zdroje nenavrhují pro tentýž údaj různé hodnoty. Předtím ukáže rozdíl.' },
        { text: 'Odmítnout zobrazené', atribut: 'data-uw-odmitnout-zobrazene' },
    ] }) : ''}`;
}

function htmlNavrhu(n, i) {
    const zmena = n.stavajici
        ? `<s title="Ve sbírce">${esc(hodnotaKUkazani(n.pole, n.stavajici))}</s> → <b>${esc(hodnotaKUkazani(n.pole, n.hodnota))}</b>`
        : `<b>${esc(hodnotaKUkazani(n.pole, n.hodnota))}</b>`;
    return `<li class="uw-navrh${n.stavajici ? ' oprava' : ''}">
        <span class="uw-pole">${esc(n.nazev)}</span>
        <span class="uw-hodnota">${zmena}</span>
        <button type="button" class="link uw-zdroj" data-uw-zdroj="${i}" title="${esc(n.url)}">${esc(n.zdrojNazev || n.zdroj)} ↗</button>
        <span class="uw-akce">
            <button type="button" class="btn btn-primary btn-small" data-uw-prijmout="${i}">${n.stavajici ? 'Opravit' : 'Doplnit'}</button>
            <button type="button" class="btn btn-secondary btn-small" data-uw-odmitnout="${i}" title="Tato hodnota se už nenabídne">Odmítnout</button>
        </span></li>`;
}

export function vykreslit() {
    if (!kontejner) return;
    if (navrhy === null) {
        nastavitHtml(kontejner, '<p class="prazdno-male">Načítám návrhy z webu…</p>');
        return;
    }
    const zobr = zobrazene();
    const indexy = new Map(navrhy.map((n, i) => [n, i]));
    const podleModelek = new Map();
    zobr.forEach(n => {
        if (!podleModelek.has(n.modelkaId)) podleModelek.set(n.modelkaId, []);
        podleModelek.get(n.modelkaId).push(n);
    });
    const karty = [...podleModelek].map(([id, seznam]) => `<article class="uw-modelka">
        <header><button type="button" class="us-modelka" data-uw-profil="${id}">${esc(seznam[0].jmeno)}</button>
            ${jednoznacne(seznam).length > 1 ? `<button type="button" class="link" data-uw-prijmout-modelku="${id}">přijmout vše (${jednoznacne(seznam).length})</button>` : ''}</header>
        <ul>${seznam.map(n => htmlNavrhu(n, indexy.get(n))).join('')}</ul></article>`).join('');
    const skryto = navrhy.length - zobr.length;
    const prazdno = navrhy.length
        ? `<p class="prazdno-male">Filtru nic neodpovídá${skryto ? ` (skryto ${skryto})` : ''}.</p>`
        : `<p class="prazdno-male">${stavPruchodu?.konec ? 'Všechny rozdíly proti zdrojům jsou vyřízené.' : 'Zatím žádné návrhy z webu.'}</p>`;
    const pata = odmitnutych ? `<p class="pass-hint uw-pata">${sklonovat(odmitnutych, 'odmítnutá hodnota se nenabízí', 'odmítnuté hodnoty se nenabízí', 'odmítnutých hodnot se nenabízí')} · <button type="button" class="link" data-uw-zrusit-odmitnuti>znovu nabízet všechny</button></p>` : '';
    nastavitHtml(kontejner, `<div class="us uw">${htmlStavu()}${navrhy.length ? htmlFiltru() : ''}
        ${karty ? `<p class="us-uvod">${sklonovat(zobr.length, 'návrh', 'návrhy', 'návrhů')} u ${sklonovat(podleModelek.size, 'modelky', 'modelek', 'modelek')}${skryto ? ` (dalších ${skryto} skrývá filtr)` : ''}. Každý údaj má odkaz na zdroj; přijatý zapíše i odkaz na zdroj mezi odkazy modelky.</p><div class="uw-seznam">${karty}</div>` : prazdno}${pata}</div>`);
    if (!kontejner.dataset.uwObsluha) {
        kontejner.dataset.uwObsluha = '1';
        kontejner.addEventListener('click', klik);
        kontejner.addEventListener('change', zmena);
    }
}

function zmena(e) {
    const t = /** @type {HTMLInputElement} */ (e.target);
    if (t.dataset.uwFiltr) filtr[t.dataset.uwFiltr] = t.value;
    else if (t.hasAttribute('data-uw-opravy')) filtr.opravy = t.checked;
    else if (t.hasAttribute('data-uw-jen-chybejici')) { jenChybejici = t.checked; return; }
    else return;
    vykreslit();
}

async function prijmout(seznam, potvrzeni = false) {
    if (!seznam.length) return;
    const modelek = new Set(seznam.map(n => n.modelkaId)).size;
    if (potvrzeni && !await potvrditRozdil({
        nadpis: 'Přijmout návrhy z webu',
        souhrn: `Zapíše se ${sklonovat(seznam.length, 'údaj', 'údaje', 'údajů')} u ${sklonovat(modelek, 'modelky', 'modelek', 'modelek')}${seznam.some(n => n.stavajici) ? ', včetně přepsání vyplněných' : ''}. Předtím se vytvoří záloha.`,
        radky: seznam.map(n => ({ kdo: n.jmeno, co: n.nazev, pred: n.stavajici ? hodnotaKUkazani(n.pole, n.stavajici) : '', po: hodnotaKUkazani(n.pole, n.hodnota) })),
        tlacitko: `Přijmout ${seznam.length}`,
    })) return;
    const v = await PrijmoutNavrhyZWebuVratitelne(seznam).catch(() => null);
    if (!v?.zapsano) { oznamit('Návrhy se nepodařilo zapsat.'); return; }
    const text = seznam.length === 1 ? `${seznam[0].jmeno}: ${seznam[0].nazev} ${seznam[0].stavajici ? 'opraveno' : 'doplněno'}.` : `Zapsáno u ${sklonovat(v.zapsano, 'modelky', 'modelek', 'modelek')}.`;
    oznamit(text, { text: 'Vrátit', akce: async () => {
        if (!await VratitPrijetiZWebu(v)) oznamit('Některé údaje se nepodařilo vrátit.');
        api.poZmene();
        await nacist();
    } });
    api.poZmene();
    await nacist();
}

async function odmitnout(seznam) {
    if (!seznam.length || !await OdmitnoutNavrhyZWebu(seznam, true)) return;
    oznamit(seznam.length === 1 ? 'Návrh odmítnut, už se nenabídne.' : `${sklonovat(seznam.length, 'návrh odmítnut', 'návrhy odmítnuty', 'návrhů odmítnuto')}.`, { text: 'Vrátit', akce: async () => {
        await OdmitnoutNavrhyZWebu(seznam, false);
        await nacist();
    } });
    await nacist();
}

async function klik(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    const data = (atribut) => /** @type {HTMLElement | null} */ (cil.closest(`[${atribut}]`));
    const navrh = (prvek, klic) => navrhy[parseInt(prvek.dataset[klic])];
    let p;
    if (data('data-uw-spustit')) {
        if (stavPruchodu?.zbyva > 0 && !await potvrdit('Začít průchod znovu', 'Rozpracovaný průchod se zahodí a začne se od začátku. Návrhy ve frontě zůstanou.', 'Začít znovu')) return;
        if (!await SpustitPruchodWebem(jenChybejici, false)) oznamit(jenChybejici ? 'Žádné modelce nechybí údaje, které zdroje umí doplnit.' : 'Průchod nejde spustit.');
        await nacist();
    } else if (data('data-uw-pokracovat')) {
        await SpustitPruchodWebem(jenChybejici, true);
        await nacist();
    } else if (data('data-uw-prerusit')) {
        await PrerusitPruchodWebem();
        oznamit('Průchod přerušen; dokončíš ho tlačítkem Pokračovat, i po restartu.');
        await nacist();
    } else if ((p = data('data-uw-prijmout'))) {
        await prijmout([navrh(p, 'uwPrijmout')]);
    } else if ((p = data('data-uw-odmitnout'))) {
        await odmitnout([navrh(p, 'uwOdmitnout')]);
    } else if ((p = data('data-uw-zdroj'))) {
        BrowserOpenURL(navrh(p, 'uwZdroj').url);
    } else if ((p = data('data-uw-profil'))) {
        otevritProfilPodleId(Number(p.dataset.uwProfil));
    } else if ((p = data('data-uw-prijmout-modelku'))) {
        const id = Number(p.dataset.uwPrijmoutModelku);
        await prijmout(jednoznacne(zobrazene().filter(n => n.modelkaId === id)));
    } else if (data('data-uw-prijmout-zobrazene')) {
        await prijmout(jednoznacne(zobrazene()), true);
    } else if (data('data-uw-odmitnout-zobrazene')) {
        const seznam = zobrazene();
        if (seznam.length > 1 && !await potvrditRozdil({
            nadpis: 'Odmítnout návrhy z webu',
            souhrn: `Odmítne se ${sklonovat(seznam.length, 'návrh', 'návrhy', 'návrhů')}; tyto hodnoty se už nenabídnou. Údaje ve sbírce zůstanou, jak jsou.`,
            radky: seznam.map(n => ({ kdo: n.jmeno, co: n.nazev, pred: hodnotaKUkazani(n.pole, n.hodnota), po: 'odmítnuto' })),
            tlacitko: `Odmítnout ${seznam.length}`,
        })) return;
        await odmitnout(seznam);
    } else if (data('data-uw-zrusit-odmitnuti')) {
        await ZrusitOdmitnutiZWebu();
        oznamit('Odmítnuté hodnoty se znovu nabídnou.');
        await nacist();
    }
}
