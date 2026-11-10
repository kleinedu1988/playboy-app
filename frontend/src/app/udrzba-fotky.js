// Údržba › Otočené a výřezy (otocene_fotky.go): fotky na boku nebo vzhůru nohama (kontrola na pozadí z vektorů
// CLIP otočených náhledů, potřebuje Obsah fotek) s otočením jedním klikem, a titulní fotky s výchozím výřezem,
// kterým jde výřez navrhnout z detekce postavy. Nic se neotočí ani neuloží bez kliknutí.
import { GetOtoceneFotky, GetStavOtoceni, GetTitulniBezVyrezu, NavrhnoutVyrezy, OznacitOtoceniVPoradku, OznacitVyrezVychozi, PrerusitKontroluOtoceni, SetCoverVyrez, SetRotaceFotek, SpustitKontroluOtoceni } from './backend';
import { esc, obrazek, sklonovat } from '../lib/format';
import { nastavitHtml } from '../ui/dom';
import { oznamit } from '../ui/oznameni';
import { VELIKOST_NAHLEDU } from './obrazky';
import { otevritProfilPodleId } from './cover';
import { stylVyrezu } from './navigace';

/** @type {{ viditelna: () => boolean, poZmene: () => void }} */
let api = { viditelna: () => false, poZmene: () => {} };
let kontejner = null;
/** @type {any[] | null} */
let otocene = null;
/** @type {any} */
let stavOtoceni = null;
/** @type {any[]} */
let bezVyrezu = [];
const navrhy = new Map(); // modelkaId → návrh výřezu (i neúspěšný s důvodem)
let navrhuje = false;
let zobrazitOtocenych = 48;
let casovac = null;
let zastarale = false;

const DAVKA_VYREZU = 24;

export function pripravit(funkce) {
    api = { ...api, ...funkce };
}

export function zobrazit(prvek) {
    kontejner = prvek;
    vykreslit();
    if (otocene === null || zastarale) nacist();
}

export function zastarat() {
    zastarale = true;
    if (kontejner && api.viditelna()) nacist();
}

async function nacist() {
    zastarale = false;
    const [o, st, bez] = await Promise.all([GetOtoceneFotky(), GetStavOtoceni(), GetTitulniBezVyrezu()]);
    otocene = o || [];
    stavOtoceni = st;
    bezVyrezu = bez || [];
    const ids = new Set(bezVyrezu.map(m => m.modelkaId));
    for (const id of [...navrhy.keys()]) if (!ids.has(id)) navrhy.delete(id);
    vykreslit();
    hlidat();
}

function hlidat() {
    clearTimeout(casovac);
    if (!stavOtoceni?.bezi) return;
    casovac = setTimeout(async () => {
        if (!api.viditelna()) { hlidat(); return; }
        await nacist();
    }, 4000);
}

function htmlStavu() {
    const st = stavOtoceni;
    if (!st) return '';
    if (!st.zapnuto) return '<p class="prazdno-male">Hledání otočených fotek stojí na Obsahu fotek (Nastavení › Obsah fotek). Po jeho zapnutí a spočítání vektorů se tu kontrola dá spustit.</p>';
    const zbyva = Math.max(0, st.fotek - st.zkontrolovano);
    const procento = st.celkem ? Math.floor(st.hotovo / st.celkem * 100) : 0;
    let text, tlacitko = '';
    if (st.bezi) {
        text = `Kontroluji otočení fotek: ${st.hotovo} z ${st.celkem} (${procento} %). Každá fotka se zkusí otočit o 90°, 180° a 270° a porovná se se zbytkem sbírky.`;
        tlacitko = '<button type="button" class="btn btn-secondary btn-small" data-uf-prerusit>Přerušit</button>';
    } else {
        text = st.zkontrolovano
            ? `Zkontrolováno ${st.zkontrolovano.toLocaleString('cs-CZ')} z ${st.fotek.toLocaleString('cs-CZ')} fotek${zbyva ? `, ${zbyva.toLocaleString('cs-CZ')} ještě ne (nové nebo bez vektoru)` : ''}.${st.chyba ? ` Poslední běh skončil chybou: ${esc(st.chyba)}` : ''}`
            : 'Kontrola projde fotky s vektorem a najde ty, které jsou na boku nebo vzhůru nohama. Trvá zhruba desetinu sekundy na fotku a běží na pozadí.';
        if (zbyva) tlacitko = `<button type="button" class="btn btn-primary btn-small" data-uf-spustit>${st.zkontrolovano ? 'Zkontrolovat zbylé' : 'Najít otočené fotky'}</button>`;
    }
    return `<div class="us-stav${st.bezi ? ' bezi' : ''}" role="status">${st.bezi ? `<span class="us-pruh" style="--hotovo:${procento}%"></span>` : ''}<p>${text}</p>${tlacitko}</div>`;
}

const smer = uhel => ({ 90: 'o 90° doprava', 180: 'vzhůru nohama', 270: 'o 90° doleva' }[uhel] || `${uhel}°`);
// Otočení, které zbývá ze současné rotace na navrženou
const krok = f => ((f.navrh - f.rotace) % 360 + 360) % 360;

function htmlOtocene(f, i) {
    const nahled = esc(obrazek(f.url, VELIKOST_NAHLEDU));
    const jistota = f.rozdil >= 0.06 ? 'vysoká' : f.rozdil >= 0.035 ? 'střední' : 'nízká';
    return `<figure class="uf-otocena">
        <div class="uf-dvojice">
            <span class="uf-ram" title="Teď"><img src="${nahled}" alt="" loading="lazy" decoding="async" draggable="false" style="transform: rotate(${f.rotace}deg)" /></span>
            <span class="uf-sipka" aria-hidden="true">→</span>
            <span class="uf-ram navrh" title="Po otočení"><img src="${nahled}" alt="" loading="lazy" decoding="async" draggable="false" style="transform: rotate(${f.navrh}deg)" /></span>
        </div>
        <figcaption>
            <button type="button" class="us-modelka" data-uf-profil="${f.modelkaId}">${esc(f.jmeno || 'Bez modelky')}</button>
            <span class="us-album">${esc(f.album)}${f.fotkyIds.length > 1 ? ` · ve ${f.fotkyIds.length} albech` : ''}</span>
            <span class="uf-jistota uf-${jistota}">otočit ${smer(krok(f))} · jistota ${jistota}</span>
            <span class="uf-akce">
                <button type="button" class="btn btn-primary btn-small" data-uf-otocit="${i}">Otočit</button>
                <button type="button" class="btn btn-secondary btn-small" data-uf-poradku="${i}" title="Fotka je schválně takhle, už se nebude hlásit">V pořádku</button>
            </span>
        </figcaption></figure>`;
}

function htmlVyrezu(m) {
    const n = navrhy.get(m.modelkaId);
    const nahled = esc(obrazek(m.url, VELIKOST_NAHLEDU));
    const vyrez = n?.ok ? { coverZoom: n.zoom, coverX: n.x, coverY: n.y } : null;
    return `<figure class="uf-vyrez">
        <div class="uf-dvojice">
            <span class="uf-karta" title="Výchozí výřez"><img src="${nahled}" alt="" loading="lazy" decoding="async" draggable="false" /></span>
            ${vyrez ? `<span class="uf-sipka" aria-hidden="true">→</span><span class="uf-karta navrh" title="Navržený výřez"><img src="${nahled}" alt="" loading="lazy" decoding="async" draggable="false" style="${stylVyrezu(vyrez)}" /></span>` : ''}
        </div>
        <figcaption>
            <button type="button" class="us-modelka" data-uf-profil="${m.modelkaId}">${esc(m.jmeno)}</button>
            ${n && !n.ok ? `<span class="uf-duvod">${esc(n.duvod)}</span>` : ''}
            <span class="uf-akce">
                ${vyrez ? `<button type="button" class="btn btn-primary btn-small" data-uf-pouzit="${m.modelkaId}">Použít</button>` : ''}
                <button type="button" class="btn btn-secondary btn-small" data-uf-vychozi="${m.modelkaId}" title="Výchozí výřez sedí, úkol se už nebude hlásit">Nechat výchozí</button>
            </span>
        </figcaption></figure>`;
}

export function vykreslit() {
    if (!kontejner) return;
    if (otocene === null) {
        nastavitHtml(kontejner, '<p class="prazdno-male">Načítám…</p>');
        return;
    }
    const vidim = otocene.slice(0, zobrazitOtocenych);
    const sekceOtocene = `<section class="uf-sekce"><h4>Otočené fotky${otocene.length ? ` <small>${otocene.length}</small>` : ''}</h4>${htmlStavu()}
        ${otocene.length ? `<p class="us-uvod">Seřazené od nejjistějších. Vlevo fotka, jak je teď, vpravo po otočení. Otočení platí pro fotku ve všech albech a jde kdykoli změnit v prohlížeči (R).
            <button type="button" class="link" data-uf-otocit-vse>Otočit všech ${vidim.length} zobrazených</button></p>
            <div class="uf-mrizka">${vidim.map(htmlOtocene).join('')}</div>
            ${otocene.length > vidim.length ? `<button type="button" class="btn btn-secondary btn-small" data-uf-dalsi>Ukázat dalších ${Math.min(48, otocene.length - vidim.length)}</button>` : ''}`
            : stavOtoceni?.zkontrolovano ? '<p class="prazdno-male">Žádná zkontrolovaná fotka nevypadá otočeně.</p>' : ''}</section>`;
    const navrzene = bezVyrezu.filter(m => navrhy.get(m.modelkaId)?.ok);
    const bezNavrhu = bezVyrezu.filter(m => !navrhy.has(m.modelkaId));
    const sekceVyrez = `<section class="uf-sekce"><h4>Titulní fotky s výchozím výřezem${bezVyrezu.length ? ` <small>${bezVyrezu.length}</small>` : ''}</h4>
        ${bezVyrezu.length ? `<p class="us-uvod">Výřez se navrhne z toho, kde detektor na fotce najde postavu a obličej (kdo to je, nepozná). Výřez jde vždycky doladit tažením na kartě.</p>
            <div class="uf-lista">
                ${stavOtoceni?.zapnuto && bezNavrhu.length ? `<button type="button" class="btn btn-primary btn-small" data-uf-navrhnout ${navrhuje ? 'disabled' : ''}>${navrhuje ? 'Navrhuji…' : `Navrhnout výřez ${Math.min(DAVKA_VYREZU, bezNavrhu.length)} dalším`}</button>` : ''}
                ${!stavOtoceni?.zapnuto ? '<span class="pass-hint">Návrh výřezu potřebuje zapnutý Obsah fotek.</span>' : ''}
                ${navrzene.length > 1 ? `<button type="button" class="btn btn-secondary btn-small" data-uf-pouzit-vse>Použít všech ${navrzene.length} navržených</button>` : ''}
            </div>
            <div class="uf-mrizka">${[...bezVyrezu.filter(m => navrhy.has(m.modelkaId)), ...bezNavrhu.slice(0, Math.max(0, 12 - navrhy.size))].map(htmlVyrezu).join('')}</div>`
            : '<p class="prazdno-male">Všechny titulní fotky mají výřez, nebo jim výchozí sedí.</p>'}</section>`;
    nastavitHtml(kontejner, `<div class="us uf">${sekceOtocene}${sekceVyrez}</div>`);
    if (!kontejner.dataset.ufObsluha) {
        kontejner.dataset.ufObsluha = '1';
        kontejner.addEventListener('click', klik);
    }
}

async function otocit(seznam) {
    let ok = 0;
    for (const f of seznam) if (await SetRotaceFotek(f.fotkyIds, f.navrh)) ok++;
    if (!ok) { oznamit('Fotky se nepodařilo otočit.'); return; }
    const puvodni = seznam.map(f => ({ ids: f.fotkyIds, rotace: f.rotace }));
    oznamit(ok === 1 ? 'Fotka otočená.' : `${sklonovat(ok, 'fotka otočená', 'fotky otočené', 'fotek otočeno')}.`, { text: 'Vrátit', akce: async () => {
        for (const p of puvodni) await SetRotaceFotek(p.ids, p.rotace);
        api.poZmene();
        await nacist();
    } });
    api.poZmene();
    await nacist();
}

async function pouzitVyrezy(ids) {
    let ok = 0;
    for (const id of ids) {
        const n = navrhy.get(id);
        if (n?.ok && await SetCoverVyrez(id, n.zoom, n.x, n.y)) { ok++; navrhy.delete(id); }
    }
    if (!ok) { oznamit('Výřez se nepodařilo uložit.'); return; }
    oznamit(ok === 1 ? 'Výřez titulní fotky uložen.' : `Výřez uložen u ${sklonovat(ok, 'modelky', 'modelek', 'modelek')}.`, { text: 'Vrátit', akce: async () => {
        for (const id of ids) await SetCoverVyrez(id, 1, 50, 50);
        api.poZmene();
        await nacist();
    } });
    api.poZmene();
    await nacist();
}

async function klik(e) {
    const cil = /** @type {HTMLElement} */ (e.target);
    const data = (atribut) => /** @type {HTMLElement | null} */ (cil.closest(`[${atribut}]`));
    let p;
    if (data('data-uf-spustit')) {
        if (!await SpustitKontroluOtoceni()) oznamit('Kontrolu nejde spustit: fotky ještě nemají vektory, nebo už běží.');
        await nacist();
    } else if (data('data-uf-prerusit')) {
        await PrerusitKontroluOtoceni();
        oznamit('Kontrola přerušena; hotové fotky zůstanou, zbytek se zkontroluje příště.');
        await nacist();
    } else if ((p = data('data-uf-otocit'))) {
        await otocit([otocene[parseInt(p.dataset.ufOtocit)]]);
    } else if (data('data-uf-otocit-vse')) {
        await otocit(otocene.slice(0, zobrazitOtocenych));
    } else if ((p = data('data-uf-poradku'))) {
        const f = otocene[parseInt(p.dataset.ufPoradku)];
        if (!await OznacitOtoceniVPoradku([f.driveId], true)) return;
        oznamit('Fotka se už nebude hlásit.', { text: 'Vrátit', akce: async () => { await OznacitOtoceniVPoradku([f.driveId], false); await nacist(); } });
        await nacist();
    } else if (data('data-uf-dalsi')) {
        zobrazitOtocenych += 48;
        vykreslit();
    } else if ((p = data('data-uf-profil'))) {
        otevritProfilPodleId(Number(p.dataset.ufProfil));
    } else if (data('data-uf-navrhnout')) {
        if (navrhuje) return;
        navrhuje = true;
        vykreslit();
        try {
            const davka = bezVyrezu.filter(m => !navrhy.has(m.modelkaId)).slice(0, DAVKA_VYREZU).map(m => m.modelkaId);
            (await NavrhnoutVyrezy(davka) || []).forEach(n => navrhy.set(n.modelkaId, n));
        } finally {
            navrhuje = false;
        }
        vykreslit();
    } else if ((p = data('data-uf-pouzit'))) {
        await pouzitVyrezy([Number(p.dataset.ufPouzit)]);
    } else if (data('data-uf-pouzit-vse')) {
        await pouzitVyrezy(bezVyrezu.filter(m => navrhy.get(m.modelkaId)?.ok).map(m => m.modelkaId));
    } else if ((p = data('data-uf-vychozi'))) {
        const id = Number(p.dataset.ufVychozi);
        if (!await OznacitVyrezVychozi([id], true)) return;
        navrhy.delete(id);
        oznamit('Výchozí výřez ponechán, úkol se už nebude hlásit.', { text: 'Vrátit', akce: async () => { await OznacitVyrezVychozi([id], false); await nacist(); } });
        await nacist();
    }
}
