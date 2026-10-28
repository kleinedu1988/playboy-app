// Čistá logika části Oblíbenost (app/oblibenost.js, porovnani-pasy.js): popisy fotek, texty složek pořadí (srdíčka,
// skóre fotek, porovnání, zájem), trend a řazení, úrovně Top 10 / 20 / 50 / 100 (štítky, čekání, seskupení, souboje).
// Bez stránky, aby šla testovat.

// Kolik nejlepších fotek každé modelky ukáže galerie obou v porovnání (nejvíc, kolik vrátí GetNahledyModelek)
export const NAHLEDU_V_POROVNANI = 24;

const cislo1 = n => (Number(n) || 0).toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Skóre fotek v řádku pořadí: „fotky 4,3“; bez hodnocených fotek prázdné
export const textSkoreFotek = skore => Number(skore) > 0 ? `fotky ${cislo1(skore)}` : '';

// Popisek fotky v galerii obou: „Album · ♥♥♥♥ · 3. fotka“ (fotky jsou od nejlepší)
export function popisNahledu(nahled, index) {
    const srdicka = nahled?.hodnoceni > 0 ? '♥'.repeat(Math.min(5, nahled.hodnoceni)) : 'bez srdíček';
    return [nahled?.album, srdicka, `${index + 1}. fotka`].filter(Boolean).join(' · ');
}

const mistaText = n => `${n} ${n === 1 ? 'místo' : n >= 2 && n <= 4 ? 'místa' : 'míst'}`;

// Trend modelky: posun v pořadí oblíbenosti proti snímku před trendDni dny ({ smer, znak, text }), nebo null
// (trend zatím není nebo je menší než min míst; na kartě se ukazuje jen výrazný)
export function trendModelky(modelka, min = 1) {
    const zmena = Number(modelka?.zmenaPoradi) || 0;
    const dni = Number(modelka?.trendDni) || 0;
    if (!dni || !zmena || Math.abs(zmena) < min) return null;
    const kdy = dni === 1 ? 'než včera' : `než před ${dni} dny`;
    const kratce = `${Math.abs(zmena)} ${dni === 1 ? 'od včera' : `za ${dni} dní`}`;
    return zmena > 0
        ? { smer: 'nahoru', znak: '▲', text: `o ${mistaText(zmena)} výš ${kdy}`, kratce }
        : { smer: 'dolu', znak: '▼', text: `o ${mistaText(-zmena)} níž ${kdy}`, kratce };
}

// Hodnota fotky napříč modelkami: srdíčka fotky říkají, jak dobrá je fotka té modelky (pětka = její nejlepší), proto
// se násobí oblíbeností modelky (srdíčka upřesněná porovnáním): pětisrdíčková fotka pětkové modelky má hodnotu 5,
// pětisrdíčková fotka jedničkové 1, trojková fotka pětkové 3. Modelka bez srdíček i odhadu bere střed 2,5.
export const hodnotaFotky = (hodnoceniFotky, oblibenostModelky) =>
    (Number(hodnoceniFotky) || 0) * (Number(oblibenostModelky) > 0 ? Number(oblibenostModelky) : 2.5) / 5;

// Úroveň hodnoty po celých srdíčkách (oddíly Nejlepších): 0–5
export const urovenHodnoty = hodnota => Math.min(5, Math.max(0, Math.round(hodnota)));

// Řazení fotek různých modelek podle hodnoty, při shodě podle srdíček fotky (oblibenost: Map id modelky → oblíbenost)
export const porovnatFotkyPodleHodnoty = oblibenost => (x, y) =>
    hodnotaFotky(y.hodnoceni, oblibenost.get(y.modelkaId)) - hodnotaFotky(x.hodnoceni, oblibenost.get(x.modelkaId))
    || (y.hodnoceni || 0) - (x.hodnoceni || 0);

// Věta o zájmu v pořadí: od kdy si program všímá otevírání profilů a prohlížení fotek a kolik zájem váží
export function textVahyZajmu({ vahaZajmu = 0, zajemNaucen = false, porovnaniZajmu = 0, zajemDni = 0 } = {}) {
    const vaha = (Number(vahaZajmu) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 3 });
    if (!zajemDni && !zajemNaucen) {
        return 'Pořadí uvnitř srdíček posouvá i zájem: jak často otevíráš profil a jak dlouho prohlížíš fotky (čerstvý zájem víc).';
    }
    return zajemNaucen
        ? `Zájem (profil a fotky, poslední měsíce víc) posouvá sílu až o ${vaha} srdíčka na stupeň, naučeno z ${porovnaniZajmu} porovnání.`
        : `Zájem (profil a fotky, poslední měsíce víc) posouvá sílu až o ${vaha} srdíčka na stupeň (výchozí, naučí se z porovnání modelek se stejnými srdíčky).`;
}

// Stoupající a klesající v pořadí (posun aspoň o 3 místa a 3 % délky pořadí), nejvýš po pěti
export function stoupajiKlesaji(poradi, kolik = 5) {
    const prah = Math.max(3, Math.floor(poradi.length * 3 / 100));
    const stoupaji = poradi.filter(p => (p.zmenaPoradi || 0) >= prah).sort((a, b) => b.zmenaPoradi - a.zmenaPoradi).slice(0, kolik);
    const klesaji = poradi.filter(p => (p.zmenaPoradi || 0) <= -prah).sort((a, b) => a.zmenaPoradi - b.zmenaPoradi).slice(0, kolik);
    return { stoupaji, klesaji };
}

// ——— Úrovně oblíbenosti (Top 10 / 20 / 50 / 100) ———
// Backend (oblibenost.go) pouští modelku do vyšší úrovně, až splní podmínky úrovně (počet porovnání, nejistota,
// u Top 10 výhra nad modelkou z top 20); do té doby zůstane těsně pod hranicí a „čeká“. Prahy posílá backend
// (GetOblibenost().urovne), tady se jen popisují – nic z nich tu není natvrdo.
export const UROVNE = [10, 20, 50, 100];

// Úroveň podle potvrzeného místa (jen když backend úroveň neposlal): 1–10 → 10, 11–20 → 20 …, mimo top 100 → 0
export const urovenMista = misto => Number(misto) > 0 ? UROVNE.find(u => misto <= u) || 0 : 0;

export const nazevUrovne = uroven => `Top ${uroven}`;

// Úroveň a čekání modelky z kteréhokoli zdroje: položka pořadí (uroven, ceka) i modelka z GetModelky (urovenTop,
// cekaNaTop) → { uroven, ceka } (0 = žádná)
export function urovenModelky(x) {
    const uroven = Number(x?.urovenTop ?? x?.uroven ?? 0) || 0;
    const ceka = Number(x?.cekaNaTop ?? x?.ceka?.uroven ?? 0) || 0;
    return { uroven, ceka: ceka && (!uroven || ceka < uroven) ? ceka : 0 };
}

const cislo2 = n => (Number(n) || 0).toLocaleString('cs-CZ', { maximumFractionDigits: 2 });

// Co čekající modelce chybí do potvrzení (ceka z položky pořadí) – seznam krátkých vět; splněné podmínky vynechá
export function chybiKUrovni(ceka) {
    if (!ceka) return [];
    const chybi = [];
    const porovnani = Number(ceka.porovnani) || 0, potreba = Number(ceka.potrebaPorovnani) || 0;
    if (porovnani < potreba) chybi.push(`ještě ${potreba - porovnani} porovnání (má ${porovnani} z ${potreba})`);
    if (Number(ceka.maxNejistota) > 0 && Number(ceka.nejistota) > Number(ceka.maxNejistota)) {
        chybi.push(`jistější místo: nejistota ${cislo2(ceka.nejistota)}, potřeba nejvýš ${cislo2(ceka.maxNejistota)}`);
    }
    if (ceka.potrebaVyhry && !ceka.maVyhru) chybi.push('výhra nad modelkou z top 20');
    return chybi;
}

// Štítek čekající modelky: „čeká na Top 10 (5/8 porovnání)“; v závorce první nesplněná podmínka. Splňuje-li prahy,
// ale místo obhajuje držitelka: „čeká na souboj o Top 10 (místo brání Bára)“ (jmenoDrzitelky z modelek sbírky)
export function textCekani(ceka, jmenoDrzitelky = '') {
    if (!(Number(ceka?.uroven) > 0)) return '';
    if (Number(ceka.drzitelka) > 0) return `čeká na souboj o ${nazevUrovne(ceka.uroven)}${jmenoDrzitelky ? ` (místo brání ${jmenoDrzitelky})` : ''}`;
    const porovnani = Number(ceka.porovnani) || 0, potreba = Number(ceka.potrebaPorovnani) || 0;
    const zavorka = porovnani < potreba ? `${porovnani}/${potreba} porovnání`
        : Number(ceka.maxNejistota) > 0 && Number(ceka.nejistota) > Number(ceka.maxNejistota) ? `nejistota ${cislo2(ceka.nejistota)}`
        : ceka.potrebaVyhry && !ceka.maVyhru ? 'chybí výhra nad top 20' : '';
    return `čeká na ${nazevUrovne(ceka.uroven)}${zavorka ? ` (${zavorka})` : ''}`;
}

// Bublina čekající modelky: kam patří podle síly, co jí chybí a co s tím (víc řádků, do title)
export function bublinaCekani(ceka, mistoPodleSily = 0, jmenoDrzitelky = '') {
    if (!(Number(ceka?.uroven) > 0)) return '';
    if (Number(ceka.drzitelka) > 0) {
        const kdo = jmenoDrzitelky || 'držitelka';
        return [
            `Podle síly ${mistoPodleSily > 0 ? `patří na ${mistoPodleSily}. místo – do ${nazevUrovne(ceka.uroven)}` : `patří do ${nazevUrovne(ceka.uroven)}`} a podmínky splňuje.`,
            `Místo ale obhajuje ${kdo}: sestup je stejně těžký jako postup, takže do ${nazevUrovne(ceka.uroven)} postoupí, až ${jmenoDrzitelky ? 'ji' : 'držitelku'} porazí ve vzájemném souboji.`,
            'Porovnávání nabízí souboj o obhajobu napřed.',
        ].join('\n');
    }
    const chybi = chybiKUrovni(ceka);
    return [
        `Podle síly ${mistoPodleSily > 0 ? `patří na ${mistoPodleSily}. místo – do ${nazevUrovne(ceka.uroven)}` : `patří do ${nazevUrovne(ceka.uroven)}`}.`,
        chybi.length ? `Do potvrzení chybí:\n${chybi.map(c => `• ${c}`).join('\n')}` : 'Podmínky už splňuje, potvrdí se při příštím přepočtu.',
        'Do té doby zůstává těsně pod hranicí; dvojice o potvrzení nabízí Porovnávání.',
    ].join('\n');
}

// Štítek držitelky, která místo obhajuje: { text: „obhajuje Top 10“, title } (jmenoVyzyvatelky z modelek sbírky); jinak null
export function stitekObhajoby(obhajoba, jmenoVyzyvatelky = '') {
    if (!(Number(obhajoba?.uroven) > 0)) return null;
    const u = nazevUrovne(obhajoba.uroven);
    const kdo = jmenoVyzyvatelky || 'Jiná modelka';
    return {
        text: `obhajuje ${u}`,
        title: `${kdo} ji silou předstihla. Místo v ${u} jí ale zůstává, dokud s ${jmenoVyzyvatelky ? 'ní' : 'vyzyvatelkou'} neprohraje ve vzájemném souboji – sestup je stejně těžký jako postup. Souboj nabízí Porovnávání napřed.`,
    };
}

// Věta o podmínkách úrovní z GetOblibenost().urovne, od nejnižší: „Top 100: 2 porovnání · Top 50: 4 porovnání,
// nejistota ≤ 0,5 · … Top 10: 8 porovnání, nejistota ≤ 0,3, výhra nad modelkou z top 20.“
export function textPravidelUrovni(urovne) {
    const serazene = [...(urovne || [])].filter(u => Number(u?.uroven) > 0).sort((a, b) => b.uroven - a.uroven);
    if (!serazene.length) return '';
    const podminky = serazene.map(u => {
        const casti = [`${Number(u.potrebaPorovnani) || 0} porovnání`];
        if (Number(u.maxNejistota) > 0) casti.push(`nejistota ≤ ${cislo2(u.maxNejistota)}`);
        if (u.potrebaVyhry) casti.push('výhra nad modelkou z top 20');
        return `${nazevUrovne(u.uroven)}: ${casti.join(', ')}`;
    });
    return `Úrovně potvrzuje počet porovnání a jistota místa – ${podminky.join(' · ')}. Modelka, která je ještě nesplňuje, čeká těsně pod hranicí. Potvrzená v Top 10, 20 nebo 50 o místo nepřijde jen proto, že ji silou předstihla jiná: obhajuje ho, dokud s ní neprohraje v souboji.`;
}

// Pořadí rozdělené na úseky podle místa pro oddělovače: [{ uroven (0 = mimo top 100), polozky, potvrzenych }].
// Úsek dává místo (1.–10. = Top 10…), ne úroveň modelky: když úroveň nemá dost potvrzených, volné místo dostane
// nejsilnější nepotvrzená (s čekáním). potvrzenych = kolik modelek v úseku na něj splňuje prahy.
export function seskupitPodleUrovni(poradi) {
    const skupiny = [];
    (poradi || []).forEach((p, i) => {
        const uroven = urovenMista(p.poradi || i + 1);
        const potvrzena = uroven ? Number(p.uroven) > 0 && Number(p.uroven) <= uroven : true;
        const posledni = skupiny.at(-1);
        if (posledni?.uroven === uroven) { posledni.polozky.push(p); posledni.potvrzenych += potvrzena ? 1 : 0; }
        else skupiny.push({ uroven, polozky: [p], potvrzenych: potvrzena ? 1 : 0 });
    });
    return skupiny;
}

// Počty čekajících podle úrovně, na kterou čekají (z položek pořadí nebo modelek): [[10, 1], [50, 2]]
export function poctyCekajicich(seznam) {
    const pocty = new Map();
    (seznam || []).forEach(x => {
        const { ceka } = urovenModelky(x);
        if (ceka) pocty.set(ceka, (pocty.get(ceka) || 0) + 1);
    });
    return [...pocty].sort((a, b) => a[0] - b[0]);
}

// „3 čekají na potvrzení (1 na Top 10, 2 na Top 50)“; celkem = počet z backendu (cekajicich), jinak součet
export function textCekajicich(pocty, celkem = 0) {
    const soucet = pocty.reduce((s, [, n]) => s + n, 0);
    const n = Number(celkem) || soucet;
    if (!n) return '';
    const sloveso = n === 1 ? 'čeká' : n <= 4 ? 'čekají' : 'čeká';
    const rozpis = pocty.length ? ` (${pocty.map(([u, k]) => `${k} na ${nazevUrovne(u)}`).join(', ')})` : '';
    return `${n} ${sloveso} na potvrzení${rozpis}`;
}

// Nadpis souboje nad pásy z dvojice (druh „souboj“) a úrovní obou modelek: „Souboj o Top 10“, u dvojice
// o potvrzení čekající „O postup do Top 10“; jiná dvojice ''
export function nadpisSouboje(dvojice, a = null, b = null) {
    if (dvojice?.druh === 'overeni') return 'Ověření srdíček';
    if (dvojice?.druh !== 'souboj') return '';
    const duvod = String(dvojice.duvod || '');
    const zDuvodu = Number(duvod.match(/top\s*(\d+)/i)?.[1]) || 0;
    const zModelek = [a, b].map(m => urovenModelky(m).ceka).filter(Boolean);
    const uroven = zDuvodu || (zModelek.length ? Math.min(...zModelek) : 0);
    const naPotvrzeni = /čeká na potvrzení/i.test(duvod);
    if (/^obhajoba/i.test(duvod)) return uroven ? `Obhajoba ${nazevUrovne(uroven)}` : 'Obhajoba místa';
    if (!uroven) return 'Souboj o místo';
    return naPotvrzeni ? `O postup do ${nazevUrovne(uroven)}` : `Souboj o ${nazevUrovne(uroven)}`;
}

// Štítek úrovně u modelky (pás porovnání, profil): položka pořadí (uroven, ceka s podrobnostmi, mistoPodleSily)
// nebo modelka z GetModelky (urovenTop, cekaNaTop) → { text, ceka, title }; bez úrovně i čekání null
export function stitekUrovne(x) {
    const { uroven, ceka } = urovenModelky(x);
    if (ceka) {
        const podrobne = typeof x?.ceka === 'object' && x.ceka;
        return {
            text: podrobne ? textCekani(podrobne) : `čeká na ${nazevUrovne(ceka)}`,
            ceka: true,
            title: podrobne ? bublinaCekani(podrobne, Number(x.mistoPodleSily) || 0)
                : `Podle síly patří do ${nazevUrovne(ceka)}, potvrdí ji další porovnání. Do té doby zůstává těsně pod hranicí.`,
        };
    }
    const obhajoba = Number(x?.obhajoba?.uroven ?? x?.obhajujeTop ?? 0) || 0;
    if (uroven && obhajoba) return { text: `${nazevUrovne(uroven)} · obhajuje`, ceka: false, title: `Potvrzená v ${nazevUrovne(uroven)}. Silou ji předstihla jiná modelka, místo obhajuje, dokud s ní neprohraje v souboji.` };
    return uroven ? { text: nazevUrovne(uroven), ceka: false, title: `Potvrzená v ${nazevUrovne(uroven)} oblíbenosti` } : null;
}

// Výsledek série „Rozhodnout teď“ po přepočtu: { ok, text }. obhajovala = modelka byla držitelkou, která místo
// obhajovala; uroven = úroveň, o kterou šlo; ted = položka pořadí po přepočtu (uroven, ceka)
export function vysledekRozhodnuti({ jmeno, uroven, obhajovala = false, ted = null }) {
    const kdo = jmeno || 'Modelka';
    const u = nazevUrovne(uroven);
    const v = Number(ted?.uroven) || 0;
    const uspech = v > 0 && v <= uroven;
    if (obhajovala) return uspech ? { ok: true, text: `${kdo} obhájila ${u}.` } : { ok: false, text: `${kdo} prohrála a vypadla z ${u}.` };
    if (uspech) return { ok: true, text: `${kdo} postoupila do ${u}!` };
    const chybi = chybiKUrovni(ted?.ceka);
    const proc = Number(ted?.ceka?.drzitelka) > 0 ? ' – místo dál obhajuje držitelka' : chybi.length ? ` – chybí ${chybi.join(', ')}` : '';
    return { ok: false, text: `${kdo} zatím nepostoupila do ${u}${proc}.` };
}

// Výsledek série ověření srdíček (nesoulad) po přepočtu: ted = položka nesouladu teď (nebo null, když zmizel).
// { ok, text, navrh } – navrh = srdíčka, která porovnání potvrdila (rozhraní je nabídne jedním klikem)
export function vysledekOvereni({ jmeno, hodnoceni, ted = null }) {
    const kdo = jmeno || 'Modelka';
    const h = String(hodnoceni).replace('.5', '½');
    if (Number(ted?.navrh) > 0) {
        return { ok: true, navrh: Number(ted.navrh), text: `${kdo}: porovnání to potvrdila – patří jí spíš ${String(ted.navrh).replace('.5', '½')} ♥ místo ${h} ♥.` };
    }
    return { ok: false, navrh: 0, text: `${kdo}: porovnání nesoulad nepotvrdila – ${h} ♥ jí sedí.` };
}
