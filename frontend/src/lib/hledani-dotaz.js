// Chytré hledání: přirozené české výrazy v poli hledání (výška > 175, pas <= 60, 90. léta, pmoy, česká edice, 4*+,
// blond, s tetováním, bez fotek) → podmínky v syntaxi hledání (vyska:>175, rok:1990-1999, srdicka:>=4 …), kterou
// umí backend (internal/hledani) i frontend (lib/format.js). Bezstavové: rozpoznat() vrací části textu s pozicí,
// příkazem a popisem čipu, prevest() celý text s nahrazenými částmi. Příkazy klic:hodnota a fráze v uvozovkách se
// nepřekládají, jen se popíšou čipem.
import { bezDiakritiky, rozdelitNebo, vyjmoutZavorky } from './format.js';

/** @typedef {{ od: number, do: number, text: string, prikaz: string, popis: string, druh: string }} CastDotazu */

// Názvy klíčů do čipů (i pro ručně psané příkazy)
const NAZVY = {
    vyska: 'Výška', vaha: 'Váha', pas: 'Pas', hrudnik: 'Hrudník', boky: 'Boky', bmi: 'BMI', whr: 'Pas : boky', vek: 'Věk v 1. čísle',
    fotek: 'Fotek', rok: 'Rok', narozena: 'Narozena', edice: 'Edice', casopis: 'Časopis', kategorie: 'Kategorie', role: 'Kategorie', vlasy: 'Vlasy', oci: 'Oči',
    narodnost: 'Národnost', tag: 'Tag', tagy: 'Tag', fotograf: 'Fotograf', hodnoceni: 'Srdíčka', srdicka: 'Srdíčka', tetovani: 'Tetování',
    foto: 'Na fotkách', obsah: 'Na fotkách', piercing: 'Piercing', prsa: 'Prsa', ochlupeni: 'Ochlupení', vyskyt: 'Výskyt', obalka: 'Obálka', jmeno: 'Jméno', nafoceno: 'Nafoceno',
};
const JEDNOTKY = { vyska: 'cm', vaha: 'kg', pas: 'cm', hrudnik: 'cm', boky: 'cm', vek: 'let' };

// Slova vlastností → klíč (bez diakritiky, malá písmena)
const VLASTNOSTI = [
    ['vyska', 'vyska'], ['vaha|hmotnost', 'vaha'], ['pas|obvod pasu', 'pas'], ['hrudnik|obvod hrudniku', 'hrudnik'],
    ['boky|obvod boku', 'boky'], ['bmi', 'bmi'], ['whr|pomer pas boky|pas ?: ?boky', 'whr'], ['vek|vek v cisle', 'vek'], ['fotek|pocet fotek', 'fotek'],
];
const SROVNANI = { 'vyssi nez': ['vyska', '>'], 'nizsi nez': ['vyska', '<'], 'tezsi nez': ['vaha', '>'], 'lehci nez': ['vaha', '<'],
    'starsi nez': ['vek', '>'], 'mladsi nez': ['vek', '<'] };

const DESETILETI_SLOVY = { padesata: 1950, sedesata: 1960, sedmdesata: 1970, osmdesata: 1980, devadesata: 1990, nulta: 2000, desata: 2010, dvacata: 2020 };

// Pevná slova a spojení → příkaz a popis čipu
const SLOVNIK = [
    ['ceska edice|edice cz|cz edice|ceske vydani', 'edice:CZ', 'Edice CZ', 'edice'],
    ['americka edice|edice us|us edice|americke vydani', 'edice:US', 'Edice US', 'edice'],
    // Časopisy (0.02.019): zkratky a názvy jiných časopisů; samotné „playboy“ zůstává textem (bývá v poznámkách)
    ['pb', 'casopis:pb', 'Časopis: Playboy', 'casopis'],
    ['ph|penthouse', 'casopis:ph', 'Časopis: Penthouse', 'casopis'],
    ['hu|hustler', 'casopis:hu', 'Časopis: Hustler', 'casopis'],
    ['pmoy|playmate roku|playmate of the year', 'kategorie:"playmate roku","playmate of the year"', 'Playmate roku', 'kategorie'],
    ['pmom|playmate mesice|playmate of the month', 'kategorie:"playmate mesice"', 'Playmate měsíce', 'kategorie'],
    ['cyber girl|cybergirl|cyber girls', 'kategorie:cyber', 'Cyber Girl', 'kategorie'],
    ['coed', 'kategorie:coed', 'Coed', 'kategorie'],
    ['celebrita|celebrity', 'kategorie:celebrit', 'Celebrita', 'kategorie'],
    ['blond|blondyna|blondynka|blondyny|blondynky|blond vlasy', 'vlasy:blond', 'Vlasy: blond', 'vlasy'],
    ['brunetka|brunetky|hnede vlasy|hnedovlasa', 'vlasy:hned,brown,brunet', 'Vlasy: hnědé', 'vlasy'],
    ['zrzka|zrzky|zrzava|zrzave vlasy|rusovlasa|ryse vlasy', 'vlasy:zrz,rus,rys,red,auburn', 'Vlasy: zrzavé', 'vlasy'],
    ['cernovlaska|cernovlasky|cerne vlasy|cernovlasa', 'vlasy:cern,black', 'Vlasy: černé', 'vlasy'],
    ['modre oci|modrooka|modrooke', 'oci:modr,blue', 'Oči: modré', 'oci'],
    ['zelene oci|zelenooka|zelenooke', 'oci:zelen,green', 'Oči: zelené', 'oci'],
    ['hnede oci|hnedooka|hnedooke', 'oci:hned,brown', 'Oči: hnědé', 'oci'],
    ['seda oci|sede oci|sedooka', 'oci:sed,grey,gray', 'Oči: šedé', 'oci'],
    ['bez tetovani|netetovana|netetovane', 'tetovani:ne', 'Bez tetování', 'tetovani'],
    ['s tetovanim|tetovana|tetovane|tetovani', 'tetovani:ano', 'S tetováním', 'tetovani'],
    ['bez piercingu', 'piercing:ne', 'Bez piercingu', 'piercing'],
    ['s piercingem|piercing', 'piercing:ano', 'S piercingem', 'piercing'],
    ['silikonova prsa|silikonove|silikony|silikon', 'prsa:silikon', 'Silikonová prsa', 'prsa'],
    ['prirodni prsa', 'prsa:prirod', 'Přírodní prsa', 'prsa'],
    ['oholena|oholene', 'ochlupeni:ohol', 'Oholené', 'ochlupeni'],
    ['bez fotek|bez fotky|zadne fotky', 'fotek:0', 'Bez fotek', 'fotek'],
    ['s fotkami|s fotkou|ma fotky', 'fotek:>0', 'S fotkami', 'fotek'],
    ['bez srdicek|nehodnocena|nehodnocene|bez hodnoceni', 'srdicka:0', 'Bez ♥', 'srdicka'],
    ['online', 'vyskyt:online', 'Jen online', 'vyskyt'],
];

const OP_SLOVY = { '>': '>', '<': '<', '>=': '>=', '<=': '<=', '=': '', '≥': '>=', '≤': '<=', '=>': '>=', '=<': '<=' };
const cislo = '(\\d+(?:[.,]\\d+)?)';
const hranice = '(?<![\\p{L}\\d:"])';
const konec = '(?![\\p{L}\\d:])';

const textCisla = n => String(n).replace('.', ',');
const vyrazPorovnani = (op, n) => `${op}${String(n).replace(',', '.')}`;
const popisPorovnani = (klic, op, n, n2 = null) => {
    const j = JEDNOTKY[klic] ? ` ${JEDNOTKY[klic]}` : '';
    if (n2 !== null) return `${NAZVY[klic]} ${textCisla(n)}–${textCisla(n2)}${j}`;
    const znak = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '': '=' }[op];
    return `${NAZVY[klic]} ${znak} ${textCisla(n)}${j}`;
};

// Vzory s funkcí, která ze shody (nad textem bez diakritiky) udělá { prikaz, popis, druh }
/** @type {[RegExp, (s: RegExpMatchArray, puvodni: string) => { prikaz: string, popis: string, druh: string } | null][]} */
const VZORY = [
    // vyska > 175, pas<=60, bmi < 18,5, vek 18-21, vyska 170 az 180, vyska 175 cm
    ...VLASTNOSTI.map(([slova, klic]) => /** @type {[RegExp, (s: RegExpMatchArray) => { prikaz: string, popis: string, druh: string }]} */ ([new RegExp(`${hranice}(?:${slova})\\s*(>=|<=|=>|=<|>|<|=|≥|≤)?\\s*${cislo}(?:\\s*(?:-|–|az|\\.\\.)\\s*${cislo})?(?:\\s*(?:cm|kg|let|roku))?${konec}`, 'gu'),
        (s) => {
            const op = OP_SLOVY[s[1] || '='] ?? '';
            if (s[3]) return { prikaz: `${klic}:${s[2].replace(',', '.')}-${s[3].replace(',', '.')}`, popis: popisPorovnani(klic, '', s[2], s[3]), druh: klic };
            return { prikaz: `${klic}:${vyrazPorovnani(op, s[2])}`, popis: popisPorovnani(klic, op, s[2]), druh: klic };
        }])),
    // vyssi nez 175, mladsi nez 21
    [new RegExp(`${hranice}(${Object.keys(SROVNANI).join('|')})\\s+${cislo}(?:\\s*(?:cm|kg|let|roku))?${konec}`, 'gu'), (s) => {
        const [klic, op] = SROVNANI[s[1]];
        return { prikaz: `${klic}:${vyrazPorovnani(op, s[2])}`, popis: popisPorovnani(klic, op, s[2]), druh: klic };
    }],
    // 90. leta, 90 leta, leta 90, 1990s, 90s, devadesata leta
    [new RegExp(`${hranice}(?:(?:19|20)?(\\d)0\\.?\\s*leta|leta\\s*(?:19|20)?(\\d)0|((?:19|20)\\d)0s|(\\d)0s|(${Object.keys(DESETILETI_SLOVY).join('|')})\\s+leta)${konec}`, 'gu'), (s, puvodni) => {
        let od;
        if (s[5]) od = DESETILETI_SLOVY[s[5]];
        else if (s[3]) od = Number(s[3]) * 10;
        else {
            const d = Number(s[1] ?? s[2] ?? s[4]);
            const ctyrmistne = /(?:19|20)\d0/.exec(puvodni);
            od = ctyrmistne ? Number(ctyrmistne[0]) : d >= 5 ? 1900 + d * 10 : 2000 + d * 10;
        }
        return { prikaz: `rok:${od}-${od + 9}`, popis: `${od}–${od + 9}`, druh: 'rok' };
    }],
    // 1990-1999, 1990–1999, 1990 az 1999 (rozsah let)
    [new RegExp(`${hranice}((?:19|20)\\d\\d)\\s*(?:-|–|\\.\\.|az)\\s*((?:19|20)\\d\\d)${konec}`, 'gu'), (s) => {
        const [od, po] = [Number(s[1]), Number(s[2])].sort((a, b) => a - b);
        return { prikaz: `rok:${od}-${po}`, popis: `${od}–${po}`, druh: 'rok' };
    }],
    // 5*, 4*+, 4+*, 4+ *, ♥4+, ♥ 4, 4 srdicka, 4+ srdicek, 3,5*
    [new RegExp(`${hranice}(?:♥\\s*(\\d(?:[.,]5)?)(\\+)?|(\\d(?:[.,]5)?)\\s*(\\+)?\\s*(?:\\*|♥|srdick[aey]?|srdicek)\\s*(\\+)?)(?![\\p{L}\\d])`, 'gu'), (s) => {
        const n = (s[1] ?? s[3]).replace('.', ',');
        const plus = Boolean(s[2] || s[4] || s[5]);
        return { prikaz: `srdicka:${plus ? '>=' : ''}${n}`, popis: `♥ ${n.replace(',5', '½')}${plus ? '+' : ''}`, druh: 'srdicka' };
    }],
    // Slovník pevných spojení (delší napřed)
    ...SLOVNIK.map(([slova, prikaz, popis, druh]) => /** @type {[RegExp, () => { prikaz: string, popis: string, druh: string }]} */ ([
        new RegExp(`${hranice}(?:${slova.split('|').sort((a, b) => b.length - a.length).join('|')})${konec}`, 'gu'), () => ({ prikaz, popis, druh })])),
];

// Části textu, které se nepřekládají: příkazy klic:hodnota (i se seznamem v uvozovkách) a fráze v uvozovkách
const VZOR_PRIKAZU = /(-|!)?([\p{L}]+):\s*((?:>=|<=|==|>|<|=)\s*\d+(?:[.,]\d+)?|(?:"[^"]*"|[^\s",:]+)(?:\s*,\s*(?:"[^"]*"|[^\s",:]+))*)?|(-|!)?"([^"]*)"?/gu;

/** @returns {CastDotazu[]} */
export function rozpoznat(text) {
    const puvodni = String(text || '');
    if (!puvodni.trim()) return [];
    let maly = bezDiakritiky(puvodni);
    // Indexy musí sedět s původním textem; kdyby se délka změnila (zvláštní znaky), překládá se bez diakritiky po znacích
    if (maly.length !== puvodni.length) maly = [...puvodni].map(z => { const b = bezDiakritiky(z); return b.length === z.length ? b : z; }).join('');
    if (maly.length !== puvodni.length) maly = puvodni.toLowerCase();
    /** @type {CastDotazu[]} */
    const casti = [];
    const chranene = [];
    for (const s of maly.matchAll(VZOR_PRIKAZU)) {
        const od = s.index, doI = s.index + s[0].length;
        chranene.push([od, doI]);
        if (s[2]) {
            const klic = s[2];
            const hodnota = (s[3] || '').replace(/"/g, '');
            if (!hodnota) continue;
            const surovy = puvodni.slice(od, doI);
            const hodnotaPuvodni = surovy.slice(surovy.indexOf(':') + 1).trim().replace(/"/g, '');
            casti.push({ od, do: doI, text: surovy, prikaz: surovy, druh: klic,
                popis: `${s[1] ? 'Ne: ' : ''}${NAZVY[klic] || klic}: ${hodnotaPuvodni}` });
        }
    }
    const volne = (od, doI) => !chranene.some(([a, b]) => od < b && doI > a);
    const kandidati = [];
    for (const [vzor, prevod] of VZORY) {
        vzor.lastIndex = 0;
        for (const s of maly.matchAll(vzor)) {
            let od = s.index;
            const doI = s.index + s[0].length;
            if (!volne(od, doI)) continue;
            const vysledek = prevod(s, puvodni.slice(od, doI));
            if (!vysledek) continue;
            // Mínus před výrazem (-blond, -s tetovanim) je vyloučení
            const negace = od > 0 && (puvodni[od - 1] === '-' || puvodni[od - 1] === '!') && (od === 1 || /\s/.test(puvodni[od - 2]));
            if (negace) od--;
            kandidati.push({ od, do: doI, text: puvodni.slice(od, doI), prikaz: `${negace ? '-' : ''}${vysledek.prikaz}`,
                popis: `${negace ? 'Ne: ' : ''}${vysledek.popis}`, druh: vysledek.druh });
        }
    }
    // Překrývající se shody: dřívější a delší vyhrává
    kandidati.sort((a, b) => a.od - b.od || (b.do - b.od) - (a.do - a.od));
    let posledni = -1;
    for (const k of kandidati) {
        if (k.od < posledni) continue;
        casti.push(k);
        posledni = k.do;
    }
    return casti.sort((a, b) => a.od - b.od);
}

// Samostatné slovo „nebo“ mimo uvozovky → svislítko (blond nebo zrzka = blond | zrzka); na začátku či konci nic nespojuje
export function neboNaSvislitko(text) {
    return String(text || '').split(/("[^"]*"?)/).map((cast, i) => i % 2 ? cast
        : cast.replace(/(^|\s)nebo(?=\s|$)/giu, (_, mezera) => `${mezera}|`)).join('');
}

// Text dotazu s rozpoznanými výrazy nahrazenými příkazy (pro backend a filtrování ve frontendu)
export function prevest(text) {
    return neboNaSvislitko(prevestVyrazy(text));
}
function prevestVyrazy(text) {
    const puvodni = String(text || '');
    const casti = rozpoznat(puvodni);
    if (!casti.length) return puvodni;
    let vysledek = '';
    let pozice = 0;
    for (const c of casti) {
        vysledek += puvodni.slice(pozice, c.od) + c.prikaz;
        pozice = c.do;
    }
    return vysledek + puvodni.slice(pozice);
}

// Text bez jedné části (× u čipu); mezery na místě části se sloučí
export function odebrat(text, cast) {
    const puvodni = String(text || '');
    return `${puvodni.slice(0, cast.od).trimEnd()} ${puvodni.slice(cast.do).trimStart()}`.trim();
}

// Návrhy pro našeptávač: výrazy, které začínají psaným slovem (bez diakritiky), s ukázkou
export const NAVRHY_VYRAZU = [
    ['výška > ', 'Výška v cm, také < >= <= nebo 170-180'], ['váha < ', 'Váha v kg'], ['pas <= ', 'Obvod pasu v cm'], ['hrudník > ', 'Obvod hrudníku v cm'],
    ['boky ', 'Obvod boků v cm'], ['bmi < ', 'BMI, i desetinně (18,5)'], ['whr < ', 'Poměr pas : boky (0,7)'], ['věk < ', 'Věk v prvním čísle'],
    ['mladší než ', 'Věk v prvním čísle'], ['starší než ', 'Věk v prvním čísle'], ['vyšší než ', 'Výška v cm'], ['nižší než ', 'Výška v cm'],
    ['50. léta', '1950–1959'], ['60. léta', '1960–1969'], ['70. léta', '1970–1979'], ['80. léta', '1980–1989'], ['90. léta', '1990–1999'],
    ['2000–2009', 'Rozsah let vydání'], ['2010–2019', 'Rozsah let vydání'],
    ['česká edice', 'Jen česká edice'], ['americká edice', 'Jen americká edice'], ['penthouse', 'Časopis Penthouse (ph)'], ['hustler', 'Časopis Hustler (hu)'], ['pmoy', 'Playmate roku'], ['pmom', 'Playmate měsíce'],
    ['cyber girl', 'Kategorie Cyber Girl'], ['blond', 'Vlasy: blond'], ['brunetka', 'Vlasy: hnědé'], ['zrzka', 'Vlasy: zrzavé'], ['černovláska', 'Vlasy: černé'],
    ['modré oči', 'Oči'], ['zelené oči', 'Oči'], ['hnědé oči', 'Oči'], ['s tetováním', 'Tetování'], ['bez tetování', 'Tetování'],
    ['s piercingem', 'Piercing'], ['silikonová prsa', 'Prsa'], ['přírodní prsa', 'Prsa'], ['bez fotek', 'Modelky bez fotek'],
    ['foto:"', 'Co je na fotkách, slovy: foto:"na pláži"'], ['nebo', 'Jedna z podmínek: blond nebo zrzka (také |)'],
    ['4*+', 'Aspoň 4 srdíčka'], ['5*', 'Přesně 5 srdíček'], ['bez srdíček', 'Nehodnocené'],
];
export function navrhnoutVyrazy(slovo, nejvic = 6) {
    const s = bezDiakritiky(String(slovo || '').trim());
    if (s.length < 2) return [];
    return NAVRHY_VYRAZU.filter(([vyraz]) => {
        const v = bezDiakritiky(vyraz);
        return v.startsWith(s) && v.trim() !== s;
    }).slice(0, nejvic).map(([vyraz, popis]) => ({ vyraz, popis }));
}

// Věta pod polem hledání pro složený dotaz (nebo, závorky, foto:): „Hledám: (1970–1979 nebo 1980–1989) a Výška > 175 cm“.
// Prázdný řetězec, když dotaz složený není (stačí čipy).
export function vetaDotazu(text) {
    const t = neboNaSvislitko(String(text || ''));
    if (!/[|(]/.test(t) && !/(^|\s)-?(foto|obsah):/i.test(t)) return '';
    const veta = popsatCast(t);
    return veta ? `Hledám: ${veta}` : '';
}
function popsatCast(text) {
    const alternativy = rozdelitNebo(text).map(a => popsatCast1(a)).filter(Boolean);
    return alternativy.join(' nebo ');
}
function popsatCast1(text) {
    const { zbytek, skupiny } = vyjmoutZavorky(text);
    const casti = rozpoznat(zbytek);
    const popisy = [];
    let pozice = 0;
    const volna = (usek) => {
        for (const slovo of usek.match(/-?"[^"]*"?|\S+/g) || []) {
            const ne = /^[-!]/.test(slovo);
            const ciste = slovo.replace(/^[-!]/, '').replace(/"/g, '').trim();
            if (ciste) popisy.push(`${ne ? 'ne ' : ''}„${ciste}“`);
        }
    };
    for (const c of casti) {
        volna(zbytek.slice(pozice, c.od));
        popisy.push(c.popis.replace(/^Ne: /, 'ne '));
        pozice = c.do;
    }
    volna(zbytek.slice(pozice));
    for (const z of skupiny) {
        const vnitrek = popsatCast(z.text);
        if (vnitrek) popisy.push(`${z.negace ? 'ne ' : ''}(${vnitrek})`);
    }
    return popisy.join(' a ');
}
