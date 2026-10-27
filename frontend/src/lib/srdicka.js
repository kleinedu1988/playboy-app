// Hodnocení modelek srdíčky po půlkách (0–5, krok 0,5): převody, české zápisy a ovládání klávesnicí.
// Fotky mají dál celá srdíčka 1–5 (galerie.js, htmlSrdicek); tady je jen logika bez stránky, aby šla testovat.

export const NEJVIC_SRDICEK = 5;

// Hodnota zaokrouhlená na půlky v rozsahu 0–5; nečíselná je 0
export function naPulky(hodnota) {
    const n = Number(hodnota);
    if (!Number.isFinite(n)) return 0;
    return Math.min(NEJVIC_SRDICEK, Math.max(0, Math.round(n * 2) / 2));
}

// Číslo s desetinnou čárkou: 3 → „3“, 3,5 → „3,5“
export const formatSrdicek = hodnota => String(naPulky(hodnota)).replace('.', ',');

// Hodnota slovy pro čtečku obrazovky a popisky: „bez srdíček“, „1 srdíčko“, „3,5 srdíčka“, „5 srdíček“
export function textSrdicek(hodnota) {
    const h = naPulky(hodnota);
    if (!h) return 'bez srdíček';
    // Desetinné číslo se pojí s 2. pádem jednotného čísla (3,5 srdíčka), celé podle počtu
    const tvar = h % 1 ? 'srdíčka' : h === 1 ? 'srdíčko' : h < 5 ? 'srdíčka' : 'srdíček';
    return `${formatSrdicek(h)} ${tvar}`;
}

// Krátký zápis se zlomkem: 3,5 → „3½“, 0,5 → „½“ (štítek odhadu)
export function kratceSrdicka(hodnota) {
    const h = naPulky(hodnota);
    const cela = Math.floor(h);
    return `${cela || (h % 1 ? '' : '0')}${h % 1 ? '½' : ''}`;
}

// Srdíčka znaky pro lišty a seznamy: 3,5 → „♥♥♥½“; bez hodnocení prázdný text
export function znakySrdicek(hodnota) {
    const h = naPulky(hodnota);
    return '♥'.repeat(Math.floor(h)) + (h % 1 ? '½' : '');
}

// Klik na srdíčko (půlku): stejná hodnota jako současná hodnocení zruší, jiná ho nastaví
export function hodnotaPoKliku(soucasna, zvolena) {
    const z = naPulky(zvolena);
    return z === naPulky(soucasna) ? 0 : z;
}

// Klik do srdíčka podle místa: levá půlka dá půl, pravá celé (poradi 1–5, podil = x / šířka srdíčka 0–1)
export const hodnotaZPozice = (poradi, podil) => naPulky(poradi - (podil < 0.5 ? 0.5 : 0));

// Klávesa nad srdíčky modelky; vrací novou hodnotu, nebo null, když klávesa srdíčkům nepatří.
// 1–5 celá srdíčka, stejná číslice znovu přidá půlku (3 → 3½ → 3; u pětky 5 → 4½ → 5), 0 zruší,
// šipky ← ↓ a → ↑ po půlce, Home a End na 0 a 5.
export function hodnotaPoKlavese(soucasna, klavesa) {
    const h = naPulky(soucasna);
    if (/^[1-5]$/.test(klavesa)) {
        const n = Number(klavesa);
        if (n === NEJVIC_SRDICEK) return h === n ? n - 0.5 : n;
        return h === n ? n + 0.5 : n;
    }
    if (klavesa === '0' || klavesa === 'Delete') return 0;
    if (klavesa === 'ArrowRight' || klavesa === 'ArrowUp') return naPulky(h + 0.5);
    if (klavesa === 'ArrowLeft' || klavesa === 'ArrowDown') return naPulky(h - 0.5);
    if (klavesa === 'Home') return 0;
    if (klavesa === 'End') return NEJVIC_SRDICEK;
    return null;
}

// Filtr srdíček v galerii: -1 = jen nehodnocené, 0 = vše, N = aspoň N (3+ zahrnuje i 3,5)
export function vyhovujeMinimu(hodnoceni, minimum) {
    const h = naPulky(hodnoceni);
    if (minimum === -1) return h === 0;
    return !minimum || h >= minimum;
}

// Řazení galerie podle srdíček: napřed srdíčka, se stejnými srdíčky podle oblíbenosti (porovnávání a fotky), takže
// i filtr ♥ 4+ ukáže pořadí; nehodnocené jsou na konci podle odhadu z fotek. Stabilní, jinak zůstává pořadí vstupu
export const porovnatOblibenost = (a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || (b.oblibenost || 0) - (a.oblibenost || 0);

// Odhad hodnocení se ukazuje jen u nehodnocené modelky; skutečné hodnocení má vždy přednost
export const ukazatOdhad = modelka => !naPulky(modelka?.hodnoceni) && naPulky(modelka?.odhadHodnoceni) > 0;

// Procento s celým číslem (přesnost modelu vkusu 0–1 → „72 %“)
export const procentaPresnosti = presnost => `${Math.round(Math.max(0, Math.min(1, Number(presnost) || 0)) * 100)} %`;

// Věta o modelu vkusu pod nadpisem Oblíbenosti; bez přesnosti (málo dat) říká, co ještě chybí
export function textModeluVkusu({ presnost = 0, hodnocenych: pocet = 0, porovnani = 0 } = {}) {
    const hodnocenych = `${pocet} ${pocet === 1 ? 'hodnocené modelky' : 'hodnocených modelek'}`;
    if (!presnost) return `Model vkusu se teprve učí: zatím má ${hodnocenych} a ${porovnani} porovnání. Ohodnoť víc modelek srdíčky nebo je porovnávej.`;
    return `Model vkusu odhaduje tvé hodnocení s přesností ${procentaPresnosti(presnost)} podle ${hodnocenych} a ${porovnani} porovnání.`;
}

// Dvojice z backendu: a, b jsou id modelek (pro jistotu i celé modelky s id)
export const idDvojice = d => ({ a: Number(d?.a?.id ?? d?.a) || 0, b: Number(d?.b?.id ?? d?.b) || 0, duvod: String(d?.duvod || '') });

// Počet dnešních porovnání: uložené { datum, pocet } platí jen pro dnešní datum (RRRR-MM-DD)
export const dnesniPocet = (ulozene, dnes) => ulozene?.datum === dnes ? Number(ulozene.pocet) || 0 : 0;

// Pruhy síly v pořadí: síla (Bradley–Terry, libovolná stupnice) převedená na 0–100 % rozsahu seznamu, nejistota
// jako polovina šířky „vousů“ ve stejných procentech. Nejslabší má pořád kousek pruhu, aby bylo vidět, že tam je.
export function pruhySily(polozky) {
    const sily = polozky.map(p => Number(p.sila) || 0);
    const min = Math.min(...sily), max = Math.max(...sily);
    const rozsah = max - min || 1;
    return polozky.map((p, i) => ({
        sirka: max === min ? 100 : Math.max(4, Math.round((sily[i] - min) / rozsah * 1000) / 10),
        nejistota: Math.min(50, Math.round((Number(p.nejistota) || 0) / rozsah * 1000) / 10),
    }));
}
