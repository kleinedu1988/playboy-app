// Zásobník odkazů v profilu modelky (nad alby): průběžně sem odkládáš odkazy na fotky z Disku – vložením (Ctrl+V
// kdekoli v profilu), přetažením textu z prohlížeče nebo psaním. Ukazuje, kolik odkazů je platných a které fotky
// už ve sbírce jsou; Ctrl+Enter (nebo Přidat) vloží nové do zvoleného alba, „Nové album…“ je předá do okna alba.
// Rozepsaný text každé modelky se pamatuje (i po přepnutí jinam a po restartu), dokud se nevloží nebo nevyprázdní.
import { AddBulkPhotos } from './backend';
import { esc, nazevAlba, odkazyDisku, sklonovat } from '../lib/format';
import { klicAlba } from '../lib/alba';
import { stav } from './stav';
import { detailView } from './prvky';
import { oznamit } from '../ui/oznameni';
import { otevreneOkno } from '../ui/dom';
import { oznamitVlozeni } from './navigace';
import { sledovatOdkazy } from './kontrola-odkazu';
import { upozornitNaStejne } from './udrzba-stejne';

const KLIC = 'zasobnikOdkazu';
const NOVE_ALBUM = '__nove__';

let prvek = null;
let kontrola = null;
let modelkaId = 0;
let otevreny = false;
let nacistFotky = async (_id) => {};
let otevritAlbum = (_modelka, _odkazy) => {};

/** @returns {Record<string, { text: string, album: string }>} */
function ulozene() {
    try { return JSON.parse(localStorage.getItem(KLIC) || '{}') || {}; } catch { return {}; }
}
function ulozit(zmena) {
    const vse = ulozene();
    const zaznam = { ...(vse[modelkaId] || { text: '', album: '' }), ...zmena };
    if (zaznam.text.trim() || zaznam.album) vse[modelkaId] = zaznam;
    else delete vse[modelkaId];
    try { localStorage.setItem(KLIC, JSON.stringify(vse)); } catch { /* jen do zavření */ }
}

const pole = () => /** @type {HTMLTextAreaElement} */ (prvek.querySelector('[data-zas-text]'));
const vyberAlba = () => /** @type {HTMLSelectElement} */ (prvek.querySelector('[data-zas-album]'));

// Vlastní alba modelky a sdílená, do kterých se fotky vkládají jí (klíč alba z lib/alba.js)
const albaModelky = () => (stav.aktualniAlba || []).filter(a => a.typ !== 'Centerfold' || a.modelkaId === stav.aktualniModelka?.id);

// funkce: { nacistFotky(id), otevritAlbum(modelka, odkazy) } – z profilu (bez kruhových importů)
export function pripravit(funkce) {
    ({ nacistFotky, otevritAlbum } = funkce);
    const mrizka = document.getElementById('photosGrid');
    prvek = document.createElement('section');
    prvek.className = 'zasobnik hidden';
    prvek.setAttribute('aria-label', 'Zásobník odkazů na fotky');
    prvek.innerHTML = `
        <button type="button" class="zas-hlava" data-zas-prepnout aria-expanded="false">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h16l-1.5 11.5a1 1 0 0 1-1 .9H6.5a1 1 0 0 1-1-.9z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>
            <b>Zásobník odkazů</b><span class="zas-souhrn" data-zas-souhrn>vlož nebo přetáhni odkazy na fotky (Ctrl+V)</span>
        </button>
        <div class="zas-telo" data-zas-telo hidden>
            <textarea data-zas-text rows="3" spellcheck="false" placeholder="Odkazy na fotky z Google Disku – vlož, přetáhni z prohlížeče nebo piš; zůstanou tu, dokud je nevložíš"></textarea>
            <div class="kontrola-odkazu" data-zas-kontrola aria-live="polite" hidden></div>
            <div class="zas-akce">
                <label>Do alba <select data-zas-album></select></label>
                <button type="button" class="btn btn-primary btn-small" data-zas-pridat>Přidat</button>
                <button type="button" class="btn btn-secondary btn-small" data-zas-vyprazdnit>Vyprázdnit</button>
                <kbd class="zas-klavesa">Ctrl+Enter</kbd>
            </div>
        </div>`;
    mrizka.before(prvek);
    kontrola = sledovatOdkazy(pole(), prvek.querySelector('[data-zas-kontrola]'), { poZmene: obnovitTlacitko });

    pole().addEventListener('input', () => {
        ulozit({ text: pole().value });
        obnovitSouhrn();
    });
    pole().addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            pridat();
        }
    });
    vyberAlba().addEventListener('change', () => {
        ulozit({ album: vyberAlba().value === NOVE_ALBUM ? '' : vyberAlba().value });
        obnovitTlacitko();
    });
    prvek.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        if (cil.closest('[data-zas-prepnout]')) nastavitOtevreni(!otevreny, { zamerit: !otevreny });
        else if (cil.closest('[data-zas-pridat]')) pridat();
        else if (cil.closest('[data-zas-vyprazdnit]')) vyprazdnit();
    });

    // Text přetažený z prohlížeče (odkaz nebo označený text) kamkoli do profilu přijde do zásobníku
    const jeText = (/** @type {DragEvent} */ e) => {
        const typy = [...(e.dataTransfer?.types || [])];
        return !typy.includes('Files') && (typy.includes('text/uri-list') || typy.includes('text/plain'));
    };
    detailView.addEventListener('dragover', (e) => {
        if (!jeText(e) || !modelkaId) return;
        e.preventDefault();
        prvek.classList.add('cil');
    });
    detailView.addEventListener('dragleave', (e) => {
        if (!detailView.contains(/** @type {Node} */ (e.relatedTarget))) prvek.classList.remove('cil');
    });
    detailView.addEventListener('drop', (e) => {
        prvek.classList.remove('cil');
        if (!jeText(e) || !modelkaId || e.target === pole()) return;
        e.preventDefault();
        pripsat(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'));
    });
    // Ctrl+V v profilu mimo pole: odkazy na Disk jdou do zásobníku
    document.addEventListener('paste', (e) => {
        if (!modelkaId || detailView.classList.contains('hidden') || otevreneOkno()) return;
        if (/** @type {HTMLElement} */ (e.target).closest?.('input, textarea, select, [contenteditable]')) return;
        const text = e.clipboardData?.getData('text') || '';
        if (!odkazyDisku(text).length && !/\/folders\//.test(text)) return;
        e.preventDefault();
        pripsat(text);
    });
}

// Text na konec zásobníku (každý kus na nový řádek), zásobník se otevře
function pripsat(text) {
    const t = String(text || '').trim();
    if (!t) return;
    const p = pole();
    p.value = p.value.trim() ? `${p.value.trimEnd()}\n${t}` : t;
    p.dispatchEvent(new Event('input', { bubbles: true }));
    nastavitOtevreni(true);
    kontrola.zkontrolovat();
}

function nastavitOtevreni(otevrit, { zamerit = false } = {}) {
    otevreny = otevrit;
    prvek.querySelector('[data-zas-telo]').hidden = !otevrit;
    prvek.querySelector('[data-zas-prepnout]').setAttribute('aria-expanded', String(otevrit));
    prvek.classList.toggle('otevreny', otevrit);
    if (otevrit && zamerit) pole().focus();
}

function obnovitSouhrn() {
    const n = odkazyDisku(pole().value).length;
    prvek.querySelector('[data-zas-souhrn]').textContent = n
        ? `${sklonovat(n, 'odkaz čeká', 'odkazy čekají', 'odkazů čeká')} na vložení`
        : 'vlož nebo přetáhni odkazy na fotky (Ctrl+V)';
    prvek.classList.toggle('plny', n > 0);
}

function obnovitTlacitko() {
    const k = kontrola.kontrola();
    const n = k ? (kontrola.vkladatVse() ? k.ids.length : k.nove.length) : odkazyDisku(pole().value).length;
    const tlacitko = /** @type {HTMLButtonElement} */ (prvek.querySelector('[data-zas-pridat]'));
    const nove = vyberAlba().value === NOVE_ALBUM;
    tlacitko.textContent = !n ? 'Přidat' : nove ? `Nové album s ${sklonovat(n, 'fotkou', 'fotkami', 'fotkami')}…` : `Přidat ${sklonovat(n, 'fotku', 'fotky', 'fotek')}`;
    tlacitko.disabled = !n;
}

// Po načtení fotek profilu: zásobník této modelky (text, alba do výběru)
export function zobrazitProModelku() {
    if (!prvek) return;
    const modelka = stav.aktualniModelka;
    prvek.classList.toggle('hidden', !modelka);
    if (!modelka) return;
    const zmena = modelka.id !== modelkaId;
    modelkaId = modelka.id;
    const zaznam = ulozene()[modelkaId] || { text: '', album: '' };
    const alba = albaModelky();
    const posledni = alba.filter(a => a.typ !== 'Centerfold').at(-1) || alba.at(-1);
    const zvolene = alba.some(a => klicAlba(a) === zaznam.album) ? zaznam.album : posledni ? klicAlba(posledni) : NOVE_ALBUM;
    vyberAlba().innerHTML = alba.map(a => `<option value="${esc(klicAlba(a))}">${esc(nazevAlba(a.album, a.typ))}${a.modelkaId !== modelka.id ? ` (s ${esc(a.jmenoModelky || 'jinou modelkou')})` : ''}</option>`).join('')
        + `<option value="${NOVE_ALBUM}">Nové album…</option>`;
    vyberAlba().value = zvolene;
    if (zmena) {
        pole().value = zaznam.text;
        kontrola.obnovit();
        nastavitOtevreni(Boolean(zaznam.text.trim()));
    }
    obnovitSouhrn();
    obnovitTlacitko();
}

async function pridat() {
    const modelka = stav.aktualniModelka;
    if (!modelka || modelka.id !== modelkaId) return;
    const k = await kontrola.zkontrolovat();
    const ids = await kontrola.idsKVlozeni();
    if (!ids.length) {
        oznamit(k?.ids.length ? 'Všechny fotky ze zásobníku už ve sbírce jsou. Pro vložení zaškrtni „Vložit i ty, které už ve sbírce jsou“.'
            : 'V zásobníku není žádný odkaz na fotku z Google Disku.');
        return;
    }
    const preskoceno = k.ids.length - ids.length;
    if (vyberAlba().value === NOVE_ALBUM) {
        vyprazdnit({ zavrit: false });
        otevritAlbum(modelka, ids.join('\n'));
        return;
    }
    const album = albaModelky().find(a => klicAlba(a) === vyberAlba().value);
    if (!album) return;
    const tlacitko = /** @type {HTMLButtonElement} */ (prvek.querySelector('[data-zas-pridat]'));
    tlacitko.disabled = true;
    const vysledek = await AddBulkPhotos(album.modelkaId, album.album, album.typ, ids.join(' '));
    vysledek.duplicitni += preskoceno;
    oznamitVlozeni(vysledek, 'fotek');
    if (vysledek.vlozeno || vysledek.duplicitni) vyprazdnit();
    else tlacitko.disabled = false;
    if (vysledek.vlozeno) {
        upozornitNaStejne(ids.join(' '));
        await nacistFotky(modelka.id);
    }
}

function vyprazdnit({ zavrit = true } = {}) {
    pole().value = '';
    ulozit({ text: '' });
    kontrola.obnovit();
    obnovitSouhrn();
    obnovitTlacitko();
    if (zavrit) nastavitOtevreni(false);
}
