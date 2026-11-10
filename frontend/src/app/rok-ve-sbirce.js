// Rok ve sbírce (ROADMAP 1.46): výroční přehled práce na sbírce – co přibylo (modelky, alba, fotky, čísla), co se
// líbilo (nejlepší nové fotky a modelky), co se dokončilo (ročníky, sezóny), nejaktivnější měsíc a nejdelší série.
// Otevírá se tlačítkem „Rok ve sbírce →“ v heru Statistik; Jako časopis ho projde v režimu čtení, Tisk ho
// vytiskne nebo uloží do PDF.
import { GetRokVeSbirce } from './backend';
import { MESICE, esc, nazevVydani, obrazek, sklonovat } from '../lib/format';
import { cislaRoku, denCesky, dokonceneRocniky, nejaktivnejsiMesic, noveModelky, protiLoni, stranyRoku } from '../lib/rok-ve-sbirce';
import { textSrdicek } from '../lib/srdicka';
import { drzetFokus } from '../ui/dom';
import { oznamit } from '../ui/oznameni';
import { vsechnyModelky } from './mezipamet';
import { VELIKOST_KARTY, VELIKOST_NAHLEDU } from './obrazky';
import { stylVyrezu } from './navigace';
import { otevritProfilPodleId } from './cover';
import { otevritVydani } from './vydani';
import { otevritStrany } from './casopis';

let okno = null;
let rok = new Date().getFullYear();
/** @type {any} */
let data = null;
/** @type {any[]} */
let nove = [];
/** @type {ReturnType<typeof dokonceneRocniky>} */
let rocniky = [];
/** @type {Map<number, string>} */
let jmena = new Map();
let pozadavek = 0;
// Otevřeno bez roku: letošní, a když se letos ještě nepracovalo, poslední rok s prací
let hledatRok = false;

function vytvoritOkno() {
    okno = document.createElement('div');
    okno.className = 'modal-overlay hidden';
    okno.id = 'rokVeSbirceModal';
    okno.innerHTML = `<div class="modal-card rs-karta" role="dialog" aria-modal="true" aria-labelledby="rsNadpis">
        <div class="modal-header"><h3 id="rsNadpis">Rok ve sbírce</h3>
            <label class="rs-rok">Rok <select data-rs-rok aria-label="Rok"></select></label>
            <button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button></div>
        <div class="rs-obsah" data-rs-obsah></div>
        <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-zavrit>Zavřít</button>
            <button type="button" class="btn btn-secondary" data-rs-tisk title="Vytisknout přehled nebo ho uložit do PDF">Tisk / PDF</button>
            <button type="button" class="btn btn-primary" data-rs-casopis>Jako časopis</button>
        </div></div>`;
    document.body.append(okno);
    drzetFokus(okno);
    okno.addEventListener('change', (e) => {
        const t = /** @type {HTMLSelectElement} */ (e.target);
        if (t.matches('[data-rs-rok]')) {
            rok = parseInt(t.value) || rok;
            nacist();
        }
    });
    okno.addEventListener('click', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (t.closest('[data-zavrit]')) return zavrit();
        if (t.closest('[data-rs-casopis]')) return jakoCasopis();
        if (t.closest('[data-rs-tisk]')) return tisknout();
        const profil = /** @type {HTMLElement | null} */ (t.closest('[data-rs-profil]'));
        if (profil) {
            zavrit();
            return otevritProfilPodleId(parseInt(profil.dataset.rsProfil));
        }
        const cislo = /** @type {HTMLElement | null} */ (t.closest('[data-rs-cislo]'));
        if (cislo) {
            zavrit();
            return otevritVydani(cislo.dataset.rsCislo);
        }
    });
}

function zavrit() {
    okno?.classList.add('hidden');
    document.body.classList.remove('tisk-roku');
}

const dlazdice = (popis, hodnota, pod = '') => `<div class="rs-dlazdice"><b>${esc(hodnota)}</b><span>${esc(popis)}</span>${pod ? `<small>${esc(pod)}</small>` : ''}</div>`;

function htmlMesicu() {
    const max = Math.max(1, ...data.mesice.map(m => m.fotek));
    const nej = nejaktivnejsiMesic(data.mesice);
    return `<div class="rs-mesice" role="list">${data.mesice.map((m, i) => {
        const tip = `${MESICE[i]}: ${sklonovat(m.fotek, 'fotka', 'fotky', 'fotek')}, ${sklonovat(m.modelek, 'modelka', 'modelky', 'modelek')}, ${sklonovat(m.dnu, 'den', 'dny', 'dní')} práce`;
        return `<div class="rs-mesic${i === nej ? ' nej' : ''}" role="listitem" title="${esc(tip)}" aria-label="${esc(tip)}">
            <span class="rs-sloupec" style="height: ${Math.round((m.fotek / max) * 100)}%"></span><small>${MESICE[i].slice(0, 3)}</small></div>`;
    }).join('')}</div>`;
}

function htmlNejlepsich() {
    if (!data.nejlepsi.length) return '<p class="pass-hint">Z fotek přidaných v tomto roce zatím žádná nemá aspoň čtyři srdíčka.</p>';
    return `<div class="rs-fotky">${data.nejlepsi.map(f => `<button type="button" class="rs-fotka" data-rs-profil="${f.modelkaId}" title="${esc([f.jmeno, f.vydani ? nazevVydani(f.vydani) : f.album, textSrdicek(f.hodnoceni)].filter(Boolean).join(' · '))}">
        <img src="${esc(obrazek(f.url, VELIKOST_NAHLEDU))}" alt="" loading="lazy" decoding="async" draggable="false"${f.rotace ? ` style="transform: rotate(${f.rotace}deg)"` : ''} />
        <span>${esc(f.jmeno || f.album)}</span></button>`).join('')}</div>`;
}

function htmlModelek() {
    if (!nove.length) return '<p class="pass-hint">V tomto roce žádná modelka nepřibyla.</p>';
    const ukazat = nove.slice(0, 12);
    return `<div class="rs-modelky">${ukazat.map(m => `<button type="button" class="rs-modelka" data-rs-profil="${m.id}">
        <span class="rs-portret">${m.coverUrl ? `<img src="${esc(obrazek(m.coverUrl, VELIKOST_KARTY))}" alt="" loading="lazy" decoding="async" draggable="false" style="${stylVyrezu(m)}" />` : ''}</span>
        <span class="rs-jmeno">${esc(m.jmeno)}</span><small>${m.hodnoceni ? esc(textSrdicek(m.hodnoceni)) : sklonovat(m.pocetFotek || 0, 'fotka', 'fotky', 'fotek')}</small></button>`).join('')}</div>
        ${nove.length > ukazat.length ? `<p class="pass-hint">a ${sklonovat(nove.length - ukazat.length, 'další', 'další', 'dalších')}</p>` : ''}`;
}

function htmlDokonceno() {
    const radky = [
        ...rocniky.map(r => `<li>Ročník <b>${r.rocnik}</b>${r.edice !== 'US' ? ` ${esc(r.edice)}` : ''} je celý – ${sklonovat(r.cisel, 'centerfold', 'centerfoldy', 'centerfoldů')}, poslední přibyla ${esc(r.posledni)}</li>`),
        ...data.sezony.filter(s => s.favoritka).map(s => `<li>${esc(s.nazev || s.klic)}: Favoritka <button type="button" class="link" data-rs-profil="${s.favoritka}">${esc(jmena.get(s.favoritka) || '?')}</button>${s.milacek && jmena.get(s.milacek) ? `, Miláček <button type="button" class="link" data-rs-profil="${s.milacek}">${esc(jmena.get(s.milacek))}</button>` : ''}</li>`),
    ];
    const cisla = data.novaCisla.length ? `<p class="rs-cisla">Nová čísla: ${data.novaCisla.slice(0, 40).map(c => `<button type="button" class="link" data-rs-cislo="${esc(c)}">${esc(nazevVydani(c))}</button>`).join(', ')}${data.novaCisla.length > 40 ? ` a ${data.novaCisla.length - 40} dalších` : ''}</p>` : '';
    return radky.length || cisla ? `${radky.length ? `<ul class="rs-dokonceno">${radky.join('')}</ul>` : ''}${cisla}` : '<p class="pass-hint">Tento rok se nedokončil žádný ročník ani nevyhlásila sezóna.</p>';
}

function vykreslit() {
    const obsah = okno.querySelector('[data-rs-obsah]');
    const vyber = /** @type {HTMLSelectElement} */ (okno.querySelector('[data-rs-rok]'));
    const roky = data.roky.includes(rok) ? data.roky : [rok, ...data.roky].sort((a, b) => b - a);
    vyber.innerHTML = roky.map(r => `<option value="${r}"${r === rok ? ' selected' : ''}>${r}</option>`).join('');
    okno.querySelector('#rsNadpis').textContent = `Rok ${rok} ve sbírce`;
    const nic = !data.fotek && !nove.length && !data.dnuPrace;
    /** @type {HTMLButtonElement} */ (okno.querySelector('[data-rs-casopis]')).disabled = nic;
    if (nic) {
        obsah.innerHTML = `<p class="pass-hint">V roce ${rok} se na sbírce nepracovalo – nepřibyla žádná fotka ani modelka.${data.roky.length ? ' Zkus jiný rok nahoře.' : ''}</p>`;
        return;
    }
    const nej = nejaktivnejsiMesic(data.mesice);
    const vedle = [
        protiLoni(data.fotek, data.fotekLoni) && `Fotek ${protiLoni(data.fotek, data.fotekLoni)}`,
        nej >= 0 && `nejvíc práce v ${['lednu', 'únoru', 'březnu', 'dubnu', 'květnu', 'červnu', 'červenci', 'srpnu', 'září', 'říjnu', 'listopadu', 'prosinci'][nej]}`,
        data.serie.dni > 1 && `nejdelší série ${sklonovat(data.serie.dni, 'den', 'dny', 'dní')} (${denCesky(data.serie.od)} – ${denCesky(data.serie.do)})`,
    ].filter(Boolean).join(' · ');
    const pod = {
        Fotek: data.fotek ? `${data.hodnocenych} s hodnocením, ${data.fotek5} s pěti` : '',
        Modelek: protiLoni(nove.length, data.modelekLoni),
        'Dní práce': data.zapisu ? sklonovat(data.zapisu, 'zápis v Údržbě', 'zápisy v Údržbě', 'zápisů v Údržbě') : '',
    };
    obsah.innerHTML = `<div class="rs-dlazdice-rada">${cislaRoku(data, nove).map(([k, v]) => dlazdice(k, v, pod[k] || '')).join('')}</div>
        ${vedle ? `<p class="rs-veta">${esc(vedle.charAt(0).toUpperCase() + vedle.slice(1))}.</p>` : ''}
        <section class="rs-sekce"><h4>Po měsících <small>přidané fotky</small></h4>${htmlMesicu()}</section>
        <section class="rs-sekce"><h4>Nejlepší nové fotky</h4>${htmlNejlepsich()}</section>
        <section class="rs-sekce"><h4>Nové modelky <small>${nove.length}</small></h4>${htmlModelek()}</section>
        <section class="rs-sekce"><h4>Dokončeno</h4>${htmlDokonceno()}</section>`;
}

async function nacist() {
    const cislo = ++pozadavek;
    okno.querySelector('[data-rs-obsah]').innerHTML = '<p class="pass-hint">Počítám…</p>';
    const [d, modelky] = await Promise.all([GetRokVeSbirce(rok).catch(() => null), vsechnyModelky()]);
    if (cislo !== pozadavek || okno.classList.contains('hidden')) return;
    if (!d) {
        okno.querySelector('[data-rs-obsah]').innerHTML = '<p class="pass-hint">Přehled roku se nepodařilo spočítat.</p>';
        return;
    }
    if (hledatRok && !d.roky.includes(rok) && d.roky.length) {
        hledatRok = false;
        rok = d.roky[0];
        return nacist();
    }
    hledatRok = false;
    data = d;
    nove = noveModelky(modelky, rok);
    rocniky = dokonceneRocniky(modelky, rok);
    jmena = new Map(modelky.map(m => [m.id, m.jmeno]));
    vykreslit();
}

function jakoCasopis() {
    if (!data) return;
    const strany = stranyRoku({ data, nove, rocniky, jmenaSezon: jmena });
    zavrit();
    otevritStrany(strany, `Rok ${rok} ve sbírce`);
}

// Tisk jen přehledu: ostatní obsah okna skryje tisková pravidla (body.tisk-roku)
function tisknout() {
    if (!data) return;
    document.body.classList.add('tisk-roku');
    const konec = () => {
        document.body.classList.remove('tisk-roku');
        window.removeEventListener('afterprint', konec);
    };
    window.addEventListener('afterprint', konec);
    try {
        window.print();
    } catch {
        konec();
        oznamit('Tisk se nepodařilo otevřít.');
    }
}

export function otevritRokVeSbirce(novyRok) {
    hledatRok = !parseInt(novyRok);
    rok = parseInt(novyRok) || new Date().getFullYear();
    if (!okno) vytvoritOkno();
    data = null;
    okno.classList.remove('hidden');
    /** @type {HTMLElement} */ (okno.querySelector('[data-rs-rok]')).innerHTML = `<option>${rok}</option>`;
    nacist();
    /** @type {HTMLElement} */ (okno.querySelector('.close-btn'))?.focus();
}

export function pripravit() {
    document.addEventListener('click', (e) => {
        const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.('[data-rok-ve-sbirce]'));
        if (!b) return;
        e.stopPropagation();
        otevritRokVeSbirce(b.dataset.rokVeSbirce);
    });
}
