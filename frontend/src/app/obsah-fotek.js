// Obsah fotek (obsah_fotek.go, docs/NAVRH-OBSAH-FOTEK.md): obrazový model CLIP dá každé fotce sbírky vektor – čísla,
// která popisují, co je na fotce (scéna, světlo, oblečení, póza). Z vektorů se počítají podobné fotky a návrhy.
// Úvodní obrazovka zkontroluje model a chybějící stáhne (~100 MB, s průběhem); výpočet vektorů běží potom sám
// na pozadí (poprvé ~1,5 h), průběh je ve stavové liště (✕ pozastaví do příštího spuštění) a v nabídce ⋯.
import { GetPodobneFotky, GetStavObsahu, MaOdhadSrdicekFotek, ZapnoutObsah, ZastavitObsah } from './backend';
import { oznamit } from '../ui/oznameni';
import { otevritLightbox } from './prohlizec';

const PRODLEVA_PO_STARTU = 60000;
// Na úvodu nabídne pokračovat bez čekání na stažení modelu (stahování pak doběhne na pozadí)
const NABIDNOUT_PRESKOCENI = 4000;
const OBNOVA = 2000;

/** @type {{ faze: string, stazeno: number, stahnout: number, hotovo: number, celkem: number, vektoru: number, chyba: string }} */
let stavObsahu = { faze: 'vypnuto', stazeno: 0, stahnout: 0, hotovo: 0, celkem: 0, vektoru: 0, chyba: '' };
let casovac = 0;
// Dost hodnocených fotek s vektorem: Rychle ♥ může řadit „nejdřív, co se ti asi bude líbit“
let maOdhad = false;
export const odhadSrdicek = () => maOdhad;

const lista = () => /** @type {HTMLElement | null} */ (document.querySelector('#stavovaLista .stav-obsah'));
const cislo = n => n.toLocaleString('cs-CZ');
const mb = b => `${Math.round(b / 1e6)} MB`;
const bezi = s => s.faze === 'stahuje' || s.faze === 'pocita';

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
    if (stavObsahu.vektoru) MaOdhadSrdicekFotek().then((ano) => { maOdhad = Boolean(ano); }).catch(() => {});
    if (bezi(stavObsahu)) casovac = setTimeout(obnovit, OBNOVA);
    else if (stavObsahu.faze === 'chyba' && predtim !== 'chyba') oznamit(`Obsah fotek: ${stavObsahu.chyba}`);
    else if (predtim === 'stahuje' && stavObsahu.faze === 'pripraveno') oznamit('Model obsahu fotek je stažený.');
}

async function spustit() {
    try { if (!(await ZapnoutObsah())) return; } catch { return; }
    obnovit();
}

export async function pozastavit() {
    try { await ZastavitObsah(); } catch { /* doběhne samo */ }
    obnovit();
}

// Úvodní obrazovka: chybí-li model, stáhne ho s průběhem v úvodu (po chvíli jde pokračovat bez čekání); se staženým
// modelem jen naplánuje dopočítání nových fotek. Chyba stažení (bez připojení) start nezastaví, zkusí se příště.
export async function pripravitVUvodu(krokUvodu, tlacitkoUvodu) {
    await obnovit();
    if (stavObsahu.faze !== 'vypnuto') {
        setTimeout(spustit, PRODLEVA_PO_STARTU);
        return;
    }
    krokUvodu('Stahuji model obsahu fotek…', 0.8);
    try { if (!(await ZapnoutObsah())) return; } catch { return; }
    let preskoceno = false;
    const nabidka = setTimeout(() => tlacitkoUvodu('Pokračovat, stáhnout na pozadí').then(() => { preskoceno = true; }), NABIDNOUT_PRESKOCENI);
    while (!preskoceno) {
        try { stavObsahu = (await GetStavObsahu()) || stavObsahu; } catch { break; }
        if (stavObsahu.faze !== 'stahuje') break;
        if (stavObsahu.stahnout) {
            krokUvodu(`Stahuji model obsahu fotek ${mb(stavObsahu.stazeno)} / ${mb(stavObsahu.stahnout)}…`, 0.8 + 0.2 * (stavObsahu.stazeno / stavObsahu.stahnout));
        }
        await new Promise(hotovo => setTimeout(hotovo, 300));
    }
    clearTimeout(nabidka);
    tlacitkoUvodu('');
    if (stavObsahu.faze === 'chyba') {
        krokUvodu('Model obsahu fotek se nepodařilo stáhnout, zkusí se příště', 1);
        await new Promise(hotovo => setTimeout(hotovo, 1500));
    }
    obnovit();
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
    if (s.faze === 'vypnuto') return [{ text: 'Stáhnout model obsahu fotek', akce: spustit }];
    return s.vektoru < s.celkem || !s.celkem || s.faze === 'chyba'
        ? [{ text: s.vektoru ? `Dopočítat obsah fotek (${cislo(s.vektoru)} / ${cislo(s.celkem || s.vektoru)})` : 'Spočítat obsah fotek', akce: spustit }]
        : [{ info: `◎ Obsah fotek spočítaný: ${cislo(s.vektoru)} fotek` }];
}

// Akce fotky „Podobné fotky“: jen se staženým modelem
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
