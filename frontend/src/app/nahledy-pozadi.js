// Stahování náhledů na pozadí (nahledy_pozadi.go): minutu po startu se v klidu stáhnou titulní fotky modelek
// a plakáty, aby se karty a stěny ukázaly hned i napoprvé. Průběh je vpravo ve stavové liště (✕ zastaví) a v nabídce
// ⋯ (Zastavit / Stáhnout náhledy). Zastavení si program pamatuje, dokud se stahování v nabídce znovu nespustí.
import { GetStavStahovaniNahledu, SpustitStahovaniNahledu, ZastavitStahovaniNahledu } from './backend';

const KLIC_VYPNUTO = 'nahledyNaPozadiVypnuto';
const PRODLEVA_PO_STARTU = 60000;
const OBNOVA = 2000;

/** @type {{ bezi: boolean, hotovo: number, celkem: number }} */
let stavStahovani = { bezi: false, hotovo: 0, celkem: 0 };
let casovac = 0;

const lista = () => /** @type {HTMLElement | null} */ (document.querySelector('#stavovaLista .stav-nahledy'));
const cislo = n => n.toLocaleString('cs-CZ');

function vypnuto() {
    try { return localStorage.getItem(KLIC_VYPNUTO) === '1'; } catch { return false; }
}
function nastavitVypnuto(ano) {
    try {
        if (ano) localStorage.setItem(KLIC_VYPNUTO, '1');
        else localStorage.removeItem(KLIC_VYPNUTO);
    } catch { /* jen pro toto spuštění */ }
}

// Zbývající čas podle 3 souběžných stažení po ~0,25 s (už uložené se přeskočí rychleji, proto „asi“)
function zbyva(s) {
    const minut = Math.ceil(((s.celkem - s.hotovo) * 0.25) / 3 / 60);
    return minut > 1 ? `asi ${minut} min` : 'necelou minutu';
}

function vykreslit() {
    const misto = lista();
    if (!misto) return;
    const s = stavStahovani;
    misto.hidden = !s.bezi || !s.celkem;
    if (misto.hidden) {
        misto.replaceChildren();
        return;
    }
    if (!misto.firstChild) {
        misto.innerHTML = `<span class="stav-nahledy-text"></span><i class="stav-nahledy-pruh"><i></i></i>
            <button type="button" class="stav-nahledy-zastavit" title="Zastavit stahování náhledů" aria-label="Zastavit stahování náhledů">✕</button>`;
        misto.querySelector('button').addEventListener('click', zastavit);
    }
    misto.title = `Stahuji náhledy na disk, ${zbyva(s)}`;
    misto.querySelector('.stav-nahledy-text').textContent = `⬇ Náhledy ${cislo(s.hotovo)} / ${cislo(s.celkem)}`;
    /** @type {HTMLElement} */ (misto.querySelector('.stav-nahledy-pruh > i')).style.width = `${Math.round((s.hotovo / s.celkem) * 100)}%`;
}

async function obnovit() {
    clearTimeout(casovac);
    try { stavStahovani = (await GetStavStahovaniNahledu()) || stavStahovani; } catch { /* stav zůstane */ }
    vykreslit();
    if (stavStahovani.bezi) casovac = setTimeout(obnovit, OBNOVA);
}

export async function spustit() {
    nastavitVypnuto(false);
    try { if (!(await SpustitStahovaniNahledu())) return; } catch { return; }
    obnovit();
}

export async function zastavit() {
    nastavitVypnuto(true);
    try { await ZastavitStahovaniNahledu(); } catch { /* doběhne samo */ }
    obnovit();
}

// Po startu: jen když ho uživatel nezastavil
export function naplanovatPoStartu() {
    if (!vypnuto()) setTimeout(spustit, PRODLEVA_PO_STARTU);
}

// Položky nabídky ⋯ (Soubory a mezipaměť)
export function polozkyNabidky() {
    const s = stavStahovani;
    if (s.bezi && s.celkem) {
        return [
            { info: `⬇ Stahuji náhledy ${cislo(s.hotovo)} / ${cislo(s.celkem)} · ${zbyva(s)}`, podil: s.hotovo / s.celkem },
            { text: 'Zastavit stahování náhledů', akce: zastavit },
        ];
    }
    return [{ text: 'Stáhnout náhledy celé sbírky', akce: spustit }];
}
