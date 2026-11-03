// Předpříprava po úvodní obrazovce: backend si po krocích naplní mezipaměti (Predpripravit v predpriprava.go), aby
// první otevření Sbírky, volby sezóny, Čísel, hledání a Statistik nečekalo. Okno samo žádná data nedrží, takže po
// zápisu nic zastaralého neukáže (mezipaměti backendu hlídají změny dat). Krok se spustí jen v klidu: žádné
// rozběhnuté volání backendu, aspoň KLID ms od posledního kliknutí, klávesy či kolečka a okno je vidět. Kliknutí
// uprostřed kroku ho nepřeruší (krok trvá nejvýš asi sekundu), jen další krok počká. Po zápisu se zopakují kroky,
// které zápis zneplatnil, až po delším klidu (série srdíček tak nepřepočítává po každém).
import { pocetRozbehnutychVolani, Predpripravit } from './backend';
import { poZmeneDat } from './udalosti';

const KROKY = ['temata', 'sbirka', 'kalendar', 'texty', 'statistiky'];
// Po hodnocení (srdíčka, souboje, tagy) se mění témata a snímek sbírky, údaje Sbírky a kalendář ne
const PO_HODNOCENI = ['temata', 'texty'];
const KLID = 600;
const KLID_PO_ZAPISU = 5000;

let posledniVstup = 0;
let fronta = [];
let bezi = false;
let casovac = 0;
let spustena = false;

function naplanovat(za) {
    clearTimeout(casovac);
    casovac = setTimeout(dalsi, za);
}

async function dalsi() {
    if (bezi || !fronta.length) return;
    if (document.hidden || pocetRozbehnutychVolani() > 0 || performance.now() - posledniVstup < KLID) return naplanovat(250);
    const krok = fronta.shift();
    bezi = true;
    try { await Predpripravit(krok); } catch { /* krok se jen nepřipraví */ }
    bezi = false;
    naplanovat(30);
}

export function spustitPredpripravu(prodleva = 1500) {
    if (spustena) return;
    spustena = true;
    for (const typ of ['pointerdown', 'keydown', 'wheel']) {
        addEventListener(typ, () => { posledniVstup = performance.now(); }, { capture: true, passive: true });
    }
    fronta = [...KROKY];
    naplanovat(prodleva);
    poZmeneDat((rozsah) => {
        const znovu = rozsah === 'hodnoceni' ? PO_HODNOCENI : KROKY;
        fronta = [...new Set([...fronta, ...znovu])];
        posledniVstup = performance.now() + KLID_PO_ZAPISU - KLID;
        naplanovat(KLID_PO_ZAPISU);
    });
}
