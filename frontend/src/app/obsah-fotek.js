// Obsah fotek (obsah_fotek.go, docs/NAVRH-OBSAH-FOTEK.md): obrazový model CLIP spočítá pro každou fotku sbírky vektor
// a „Podobné fotky“ v akcích fotky pak najdou fotky, které vypadají podobně (stejné focení, scéna, téměř stejné
// snímky). Zapíná se v nabídce ⋯ stažením modelu (~100 MB); výpočet celé sbírky běží na pozadí (~1,5 h), průběh je
// ve stavové liště (✕ pozastaví) a v nabídce. Po startu se dopočítají nové fotky, pokud výpočet uživatel nepozastavil.
import { GetPodobneFotky, GetStavObsahu, VypnoutObsah, ZapnoutObsah, ZastavitObsah } from './backend';
import { potvrdit } from './formular-modelky';
import { oznamit } from '../ui/oznameni';
import { otevritLightbox } from './prohlizec';

const KLIC_POZASTAVENO = 'obsahFotekPozastaveno';
const PRODLEVA_PO_STARTU = 90000;
const OBNOVA = 2000;

/** @type {{ faze: string, stazeno: number, stahnout: number, hotovo: number, celkem: number, vektoru: number, chyba: string }} */
let stavObsahu = { faze: 'vypnuto', stazeno: 0, stahnout: 0, hotovo: 0, celkem: 0, vektoru: 0, chyba: '' };
let casovac = 0;

const lista = () => /** @type {HTMLElement | null} */ (document.querySelector('#stavovaLista .stav-obsah'));
const cislo = n => n.toLocaleString('cs-CZ');
const mb = b => `${Math.round(b / 1e6)} MB`;
const bezi = s => s.faze === 'stahuje' || s.faze === 'pocita';

function pozastaveno() {
    try { return localStorage.getItem(KLIC_POZASTAVENO) === '1'; } catch { return false; }
}
function nastavitPozastaveno(ano) {
    try {
        if (ano) localStorage.setItem(KLIC_POZASTAVENO, '1');
        else localStorage.removeItem(KLIC_POZASTAVENO);
    } catch { /* jen pro toto spuštění */ }
}

// Text a podíl průběhu; null, když nic neběží
function prubeh(s) {
    if (s.faze === 'stahuje' && s.stahnout) {
        return { text: `⬇ Model obsahu fotek ${mb(s.stazeno)} / ${mb(s.stahnout)}`, podil: s.stazeno / s.stahnout };
    }
    if (s.faze === 'pocita' && s.celkem) {
        return { text: `◎ Obsah fotek ${cislo(s.hotovo)} / ${cislo(s.celkem)}`, podil: s.hotovo / s.celkem };
    }
    return null;
}

function vykreslit() {
    const misto = lista();
    if (!misto) return;
    const p = prubeh(stavObsahu);
    misto.hidden = !p;
    if (!p) {
        misto.replaceChildren();
        return;
    }
    if (!misto.firstChild) {
        misto.innerHTML = `<span class="stav-nahledy-text"></span><i class="stav-nahledy-pruh"><i></i></i>
            <button type="button" class="stav-nahledy-zastavit" title="Pozastavit obsah fotek" aria-label="Pozastavit obsah fotek">✕</button>`;
        misto.querySelector('button').addEventListener('click', pozastavit);
    }
    misto.title = stavObsahu.faze === 'stahuje' ? 'Stahuji model pro podobné fotky' : 'Počítám obsah fotek pro podobné fotky (na pozadí, po přerušení pokračuje)';
    misto.querySelector('.stav-nahledy-text').textContent = p.text;
    /** @type {HTMLElement} */ (misto.querySelector('.stav-nahledy-pruh > i')).style.width = `${Math.round(p.podil * 100)}%`;
}

async function obnovit() {
    clearTimeout(casovac);
    const predtim = stavObsahu.faze;
    try { stavObsahu = (await GetStavObsahu()) || stavObsahu; } catch { /* stav zůstane */ }
    vykreslit();
    if (bezi(stavObsahu)) casovac = setTimeout(obnovit, OBNOVA);
    else if (stavObsahu.faze === 'chyba' && predtim !== 'chyba') oznamit(`Obsah fotek: ${stavObsahu.chyba}`);
    else if (predtim === 'stahuje' && stavObsahu.faze === 'pripraveno') oznamit('Model obsahu fotek je stažený.');
}

async function spustit() {
    nastavitPozastaveno(false);
    try { if (!(await ZapnoutObsah())) return; } catch { return; }
    obnovit();
}

async function zapnout() {
    await obnovit();
    if (!await potvrdit('Zapnout podobné fotky',
        `Program stáhne obrazový model CLIP (${mb(stavObsahu.stahnout)}) a na pozadí spočítá obsah každé fotky sbírky – `
        + 'poprvé asi hodinu a půl, stahují se přitom náhledy fotek. Pak v akcích fotky (⋯) najdeš „Podobné fotky“. '
        + 'Fotky z počítače nikam neodcházejí, vše běží místně.', 'Stáhnout a zapnout')) return;
    spustit();
}

export async function pozastavit() {
    nastavitPozastaveno(true);
    try { await ZastavitObsah(); } catch { /* doběhne samo */ }
    obnovit();
}

async function vypnout() {
    if (!await potvrdit('Vypnout podobné fotky', 'Smaže se stažený model a spočítaný obsah fotek. Zapnout jde znovu kdykoli, výpočet pak poběží od začátku.', 'Vypnout a smazat', { nebezpecne: true })) return;
    try { await VypnoutObsah(); } catch { /* chybu ohlásí backend */ }
    obnovit();
}

// Po startu: zjistí stav a dopočítá nové fotky, pokud je funkce zapnutá a výpočet nebyl pozastavený
export async function naplanovatPoStartu() {
    await obnovit();
    if (stavObsahu.faze !== 'vypnuto' && !pozastaveno()) setTimeout(spustit, PRODLEVA_PO_STARTU);
}

// Položky nabídky ⋯ (Soubory a mezipaměť)
export function polozkyNabidky() {
    const s = stavObsahu;
    const p = prubeh(s);
    if (p) {
        return [
            { info: p.text, podil: p.podil },
            { text: 'Pozastavit obsah fotek', akce: pozastavit },
        ];
    }
    if (s.faze === 'vypnuto') return [{ text: 'Zapnout podobné fotky…', akce: zapnout }];
    return [
        ...(s.vektoru < s.celkem || !s.celkem || s.faze === 'chyba'
            ? [{ text: s.vektoru ? 'Dopočítat obsah fotek' : 'Spočítat obsah fotek', akce: spustit }] : []),
        { text: 'Vypnout podobné fotky…', akce: vypnout },
    ];
}

// Akce fotky „Podobné fotky“: jen když je funkce zapnutá
export const podobneZapnuto = () => stavObsahu.faze !== 'vypnuto';

// Otevře v prohlížeči fotky podobné dané fotce (vlastní fotka první)
export async function ukazatPodobne(fotka) {
    const fotky = await GetPodobneFotky(fotka.id) || [];
    if (fotky.length < 2) {
        await obnovit();
        oznamit(bezi(stavObsahu)
            ? `Tahle fotka ještě nemá spočítaný obsah. Výpočet běží (${cislo(stavObsahu.hotovo)} / ${cislo(stavObsahu.celkem)}).`
            : fotky.length ? 'Ke fotce se nenašly žádné další fotky.' : 'Tahle fotka ještě nemá spočítaný obsah, výpočet se spustil.');
        return;
    }
    const polozky = fotky.map(f => ({
        fotky: [f], album: f.album, typ: f.typ, modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, rotace: f.rotace, hodnoceni: f.hodnoceni,
    }));
    // Vlastní fotka je první; prohlížeč začne u nejpodobnější další
    otevritLightbox(1, false, polozky);
    oznamit(`Podobné fotky: ${fotky.length - 1}, od nejpodobnější. Šipkou doleva je původní fotka.`);
}
