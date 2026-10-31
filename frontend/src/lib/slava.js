// Texty síně slávy (Oblíbenost › Síň slávy): události kroniky, rekordy, počty dní a měsíce kroniky. Data posílá
// backend (GetSinSlavy, oblibenost_slava.go); jména modelek se nesklonují (cizí jména), věty jsou proto stavěné
// s jménem v prvním pádě.
import { esc, sklonovat } from './format.js';

const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

// „RRRR-MM-DD HH:MM:SS“ → Date (místní čas); neplatné null
export function casKroniky(cas) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(cas || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : null;
}

// „27. 10. 2026“
export function datumKroniky(cas) {
    const d = casKroniky(cas);
    return d ? `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}` : '';
}

// „říjen 2026“
export function mesicKroniky(cas) {
    const d = casKroniky(cas);
    return d ? `${MESICE[d.getMonth()]} ${d.getFullYear()}` : '';
}

// Počet dní: „dnes“, „1 den“, „3 dny“, „12 dní“; odZacatku = pobyt začal před kronikou („aspoň 12 dní“)
export function textDni(dni, odZacatku = false) {
    const n = Math.max(0, Number(dni) || 0);
    if (!n) return odZacatku ? 'od začátku kroniky' : 'od dneška';
    return `${odZacatku ? 'aspoň ' : ''}${sklonovat(n, 'den', 'dny', 'dní')}`;
}

// Událost kroniky → { ikona, text } (jmeno: id → jméno modelky, prázdné = neznámá)
export function textUdalosti(u, jmeno) {
    const kdo = jmeno(u.modelkaId) || 'Modelka';
    const souperka = u.souperka ? jmeno(u.souperka) : '';
    switch (u.druh) {
        case 'zacatek': return { ikona: '✦', text: 'Začátek kroniky – od teď si program pamatuje, kdo je v Top 10' };
        case 'pocatek': return { ikona: '★', text: `${kdo} byla v Top 10 už na začátku kroniky (${u.misto}. místo)` };
        case 'vstup': return { ikona: '▲', text: `${kdo} vstoupila do Top 10 na ${u.misto}. místo${souperka ? ` · rozhodla výhra, soupeřka ${souperka}` : ''}` };
        case 'vystup': return { ikona: '▼', text: `${kdo} vypadla z Top 10${souperka ? ` · vytlačila ji ${souperka}` : ''}` };
        case 'obhajoba': return { ikona: '🛡', text: `${kdo} obhájila místo v Top 10${souperka ? ` · vyzyvatelka ${souperka}` : ''}` };
        case 'jednicka': return { ikona: '♛', text: souperka ? `Nová jednička: ${kdo} · předtím ${souperka}` : `Jednička: ${kdo}` };
        case 'konec': return { ikona: '·', text: `${kdo} už není potvrzená jednička` };
        case 'favoritka': return { ikona: '♛', text: `${kdo} je Favoritka sezóny ${mesicKroniky(u.cas)}` };
        case 'milacek': return { ikona: '♥', text: `${kdo} je Miláček sezóny ${mesicKroniky(u.cas)}` };
        case 'odznak': {
            const o = ODZNAKY[u.odznak];
            if (!o) return { ikona: '·', text: kdo };
            const stupen = u.stupen ? ` · ${STUPNE[u.stupen]}` : '';
            const proc = u.stupen ? ` (${o.jednotka(o.prahy[u.stupen - 1])})` : souperka ? ` (${o.souperka(souperka)})` : '';
            return { ikona: o.ikona, text: `${kdo} získala odznak ${o.nazev}${stupen}${proc}` };
        }
        default: return { ikona: '·', text: kdo };
    }
}

// Rekord → { nazev, hodnota, popis }
export function textRekordu(r) {
    const n = Number(r?.hodnota) || 0;
    switch (r?.druh) {
        case 'nejdele': return { nazev: 'Nejdéle v Top 10', hodnota: textDni(n, r.odZacatku), popis: r.trva ? 'celkem, a pořád v ní je' : 'celkem' };
        case 'vlada': return { nazev: 'Nejdelší vláda', hodnota: textDni(n, r.odZacatku), popis: r.trva ? 'na 1. místě, vládne dál' : 'na 1. místě' };
        case 'obhajoby': return { nazev: 'Nejvíc obhajob', hodnota: `${n}×`, popis: 'obhájila místo v Top 10' };
        case 'rychlost': return { nazev: 'Nejrychlejší postup', hodnota: sklonovat(n, 'porovnání', 'porovnání', 'porovnání'), popis: 'do prvního vstupu do Top 10' };
        case 'navrat': return { nazev: 'Největší návrat', hodnota: textDni(n), popis: 'mimo Top 10, pak zpátky' };
        case 'serie': return { nazev: 'Nejdelší série', hodnota: sklonovat(n, 'výhra', 'výhry', 'výher'), popis: r.trva ? 'za sebou, a pořád vyhrává' : 'v porovnání za sebou' };
        case 'porovnani': return { nazev: 'Nejvíc porovnání', hodnota: `${n}×`, popis: 'v porovnávání' };
        case 'skok': return { nazev: 'Největší skok', hodnota: `o ${sklonovat(n, 'místo', 'místa', 'míst')}`, popis: 'v pořadí do týdne' };
        default: return { nazev: '', hodnota: String(n), popis: '' };
    }
}

// Kronika (od nejnovější) po měsících: [{ mesic, udalosti }]
export function kronikaPoMesicich(kronika) {
    const skupiny = [];
    (kronika || []).forEach(u => {
        const mesic = mesicKroniky(u.cas);
        if (skupiny.at(-1)?.mesic === mesic) skupiny.at(-1).udalosti.push(u);
        else skupiny.push({ mesic, udalosti: [u] });
    });
    return skupiny;
}

// Odznaky (GetSinSlavy().odznaky, oblibenost_odznaky.go): stupňové mají prahy (bronz, stříbro, zlato), jednorázové ne.
// jednotka(n) = „100 dní v Top 10“, kratce(n) = „100 dní“ (kolik zbývá), souperka(jméno) = „porazila Annu“ u jednorázových se soupeřkou
const dni = n => sklonovat(n, 'den', 'dny', 'dní');
/** @type {Record<string, { ikona: string, nazev: string, popis: string, prahy?: number[], jednotka?: (n: number) => string, kratce?: (n: number) => string, souperka?: (j: string) => string }>} */
export const ODZNAKY = {
    stalice: { ikona: '🏛', nazev: 'Stálice', prahy: [30, 100, 365], jednotka: n => `${dni(n)} v Top 10`, kratce: dni, popis: 'Dny v Top 10 celkem' },
    kralovna: { ikona: '♛', nazev: 'Královna', prahy: [7, 30, 100], jednotka: n => `${dni(n)} na 1. místě`, kratce: dni, popis: 'Dny na 1. místě celkem' },
    hradba: { ikona: '🛡', nazev: 'Hradba', prahy: [3, 5, 10], jednotka: n => `${n}× obhájila`, kratce: n => `${n}× obhájit`, popis: 'Obhájila místo v Top 10' },
    serie: { ikona: '🔥', nazev: 'Série', prahy: [5, 10, 20], jednotka: n => `${sklonovat(n, 'výhra', 'výhry', 'výher')} za sebou`, kratce: n => sklonovat(n, 'výhra', 'výhry', 'výher'), popis: 'Výhry v porovnání za sebou' },
    zasluzena: { ikona: '⚔', nazev: 'Zasloužená', prahy: [25, 50, 100], jednotka: n => sklonovat(n, 'porovnání', 'porovnání', 'porovnání'), kratce: n => sklonovat(n, 'porovnání', 'porovnání', 'porovnání'), popis: 'Porovnání celkem' },
    raketa: { ikona: '🚀', nazev: 'Raketa', popis: 'Do Top 10 z místa za stovkou do 30 dní' },
    comeback: { ikona: '🔄', nazev: 'Comeback', popis: 'Návrat do Top 10 po aspoň 30 dnech venku' },
    david: { ikona: '🪨', nazev: 'David a Goliáš', popis: 'Z místa za Top 20 porazila jedničku', souperka: j => `porazila jedničku ${j}` },
    latka: { ikona: '⬆', nazev: 'Přeskočená laťka', popis: 'Porazila modelku s o celé srdíčko víc', souperka: j => `porazila ${j}` },
    neporazitelna: { ikona: '🧊', nazev: 'Neporazitelná', popis: '30 dní v Top 10 bez prohry (aspoň 3 porovnání)' },
    favoritka: { ikona: '👑', nazev: 'Favoritka', prahy: [1, 3, 6], jednotka: n => `${n}× Favoritka sezóny`, kratce: n => `${n}× vyhrát sezónu`, popis: 'Tituly Favoritka sezóny' },
};

// ——— Sezóny (Síň slávy › Sezóna, oblibenost_sezony.go) ———

// „2026-11“ → „listopad 2026“; kratce → „XI/26“ (štítek na kartě minulé sezóny)
const RIMSKE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export function nazevSezony(mesic, kratce = false) {
    const m = /^(\d{4})-(\d{2})$/.exec(String(mesic || ''));
    if (!m) return '';
    return kratce ? `${RIMSKE[+m[2] - 1]}/${m[1].slice(2)}` : `${MESICE[+m[2] - 1]} ${m[1]}`;
}

// Kolik dní do konce sezóny: „poslední den“, „zbývá 1 den“, „zbývá 9 dní“ (den = kolikátý je dnes, dni = délka)
export function textZbyva(den, dni) {
    const zbyva = Math.max(0, (Number(dni) || 0) - (Number(den) || 0));
    return zbyva ? `zbývá ${sklonovat(zbyva, 'den', 'dny', 'dní')}` : 'poslední den';
}

// Složení bodů modelky v sezóně na podíly pruhu (souboje, zájem) proti nejvyšším bodům v sezóně (0–1)
export function slozeniBodu(b, nejvys) {
    const n = Math.max(1, Number(nejvys) || 0);
    return { souboje: Math.max(0, Number(b?.zaSouboje) || 0) / n, zajem: Math.max(0, Number(b?.zaZajem) || 0) / n };
}
export const PORADI_ODZNAKU = Object.keys(ODZNAKY);
export const STUPNE = ['', 'bronz', 'stříbro', 'zlato'];

// Odznak modelky → { ikona, nazev, stupen ('bronz'…, '' u jednorázového), text (bublina), postup (0–1 k dalšímu
// stupni, null = není další), zbyva („18 dní do stříbra“) }
/** @param {any} o @param {(id: number) => string} [jmeno] */
export function popisOdznaku(o, jmeno = () => '') {
    const d = ODZNAKY[o?.odznak];
    if (!d) return null;
    const stupen = STUPNE[o.stupen] || '';
    const souperka = o.souperka && d.souperka ? jmeno(o.souperka) : '';
    const dalsi = Number(o.dalsi) || 0;
    const hodnota = Number(o.hodnota) || 0;
    const odPrahu = o.stupen > 0 ? d.prahy[o.stupen - 1] : 0;
    const postup = d.prahy && dalsi ? Math.max(0, Math.min(1, (hodnota - odPrahu) / (dalsi - odPrahu))) : null;
    const zbyva = d.prahy && dalsi ? `ještě ${d.kratce(dalsi - hodnota)} do ${['bronzu', 'stříbra', 'zlata'][o.stupen]}` : '';
    const text = [
        `${d.nazev}${stupen ? ` – ${stupen}` : o.ziskan ? '' : ' (zatím ne)'}`,
        d.prahy ? `${d.popis}: ${d.jednotka(hodnota)}` : d.popis,
        souperka ? d.souperka(souperka) : '',
        zbyva,
    ].filter(Boolean).join(' · ');
    return { ikona: d.ikona, nazev: d.nazev, stupen, text, postup, zbyva };
}

const TRIDY_STUPNU = ['jednorazovy', 'bronz', 'stribro', 'zlato'];
const velkym = s => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Bublina odznaku (najetí myší): ikona, název a stupeň, co odznak měří a kolik modelka má, žebříček stupňů s prahy
 * (dosažené zaškrtnuté), postup k dalšímu stupni, soupeřka a kdy ho získala. Bez modelky (o.modelkaId 0) jen popis
 * odznaku a stupňů.
 * @param {any} o
 * @param {(id: number) => string} [jmeno]
 */
export function htmlBublinyOdznaku(o, jmeno = () => '') {
    const d = ODZNAKY[o?.odznak];
    if (!d) return '';
    const p = popisOdznaku(o, jmeno);
    const kdo = o.modelkaId ? jmeno(o.modelkaId) : '';
    const trida = !o.modelkaId ? (d.prahy ? 'zlato' : 'jednorazovy') : !o.ziskan ? 'cil' : TRIDY_STUPNU[o.stupen] || 'jednorazovy';
    const stupen = p.stupen ? STUPNE.indexOf(p.stupen) : 0;
    const radky = [];
    if (d.prahy) {
        if (o.modelkaId) radky.push(`<p class="ob-hodnota">${esc(kdo)}: <b>${esc(d.jednotka(Number(o.hodnota) || 0))}</b></p>`);
        radky.push(`<div class="ob-nadpis">Stupně</div><ol class="ob-stupne">${d.prahy.map((prah, i) => `<li class="${TRIDY_STUPNU[i + 1]}${o.modelkaId && stupen > i ? ' dosazeno' : ''}"><span>${o.modelkaId && stupen > i ? '✓' : '○'} ${esc(STUPNE[i + 1])}</span><span>${esc(d.jednotka(prah))}</span></li>`).join('')}</ol>`);
        if (o.modelkaId && p.postup !== null) radky.push(`<div class="ob-postup"><span class="odznak-pruh"><i style="width:${Math.round(p.postup * 100)}%"></i></span><small>${esc(p.zbyva)}</small></div>`);
        else if (o.modelkaId && stupen === 3) radky.push('<p class="ob-maximum">Nejvyšší stupeň – zlato</p>');
    } else if (kdo) {
        const souperka = o.souperka && d.souperka ? jmeno(o.souperka) : '';
        radky.push(`<p class="ob-hodnota">${esc(kdo)}${souperka ? ` · ${esc(d.souperka(souperka))}` : ''}</p>`);
    }
    const kdy = o.ziskan && o.cas ? datumKroniky(o.cas) : '';
    return `<div class="ob-hlava"><span class="odznak velky ${trida}">${d.ikona}</span><span><b>${esc(d.nazev)}</b><small class="${trida}">${esc(velkym(p.stupen || (d.prahy ? (o.modelkaId ? 'zatím nezískaný' : 'bronz · stříbro · zlato') : 'jednorázový')))}</small></span></div>
        <p class="ob-popis">${esc(d.popis)}</p>${radky.join('')}${kdy ? `<p class="ob-kdy">Získala ${esc(kdy)}</p>` : ''}`;
}

// Rekordy v pořadí na trofejové polici (síň slávy › Rekordy) a znak na poháru
export const PORADI_REKORDU = ['nejdele', 'vlada', 'obhajoby', 'serie', 'rychlost', 'navrat', 'porovnani', 'skok'];
export const ZNAKY_REKORDU = { nejdele: '⏳', vlada: '♛', obhajoby: '🛡', serie: '🔥', rychlost: '⚡', navrat: '🔄', porovnani: '⚔', skok: '📈' };

// Co rekord měří a co znamená jeho čas (cas)
export const POPISY_REKORDU = {
    nejdele: { popis: 'Nejvíc dní v Top 10 celkem – součet všech pobytů' },
    vlada: { popis: 'Nejdelší nepřerušená vláda na 1. místě', cas: 'Vláda začala' },
    obhajoby: { popis: 'Nejvíc obhájených míst v Top 10 proti silnějším vyzyvatelkám' },
    rychlost: { popis: 'Nejméně vlastních porovnání do prvního vstupu do Top 10', cas: 'Vstoupila do Top 10' },
    navrat: { popis: 'Nejdelší pauza mimo Top 10 před návratem', cas: 'Vrátila se' },
    serie: { popis: 'Nejvíc výher v porovnání za sebou (remíza sérii nepřeruší)', cas: 'Série dosáhla rekordu' },
    porovnani: { popis: 'Nejvíc porovnání ze všech modelek' },
    skok: { popis: 'Největší posun v potvrzeném pořadí za nejvýš týden', cas: 'Skok' },
};

/**
 * Bublina rekordu (🏆 na kartě v síni slávy), stejná jako u odznaků: název, kdo ho drží a hodnota, co rekord měří,
 * odkdy a jestli dál roste.
 * @param {any} r
 * @param {(id: number) => string} [jmeno]
 */
export function htmlBublinyRekordu(r, jmeno = () => '') {
    const t = textRekordu(r);
    if (!t.nazev) return '';
    const d = POPISY_REKORDU[r.druh] || { popis: '' };
    const kdo = jmeno(r.modelkaId);
    const kdy = d.cas && r.cas ? `${d.cas} ${datumKroniky(r.cas)}` : '';
    return `<div class="ob-hlava"><span class="odznak velky zlato">🏆</span><span><b>${esc(t.nazev)}</b><small class="zlato">Rekord síně slávy</small></span></div>
        <p class="ob-popis">${esc(d.popis)}</p>
        <div class="ob-nadpis">Drží ho</div>
        <p class="ob-hodnota">${esc(kdo || 'Modelka')}: <b>${esc(t.hodnota)}</b></p>
        ${r.odZacatku ? '<p class="ob-kdy">Pobyt začal už před kronikou, skutečná hodnota může být vyšší.</p>' : ''}
        ${r.trva ? '<p class="ob-trva">Rekord pořád roste</p>' : ''}${kdy ? `<p class="ob-kdy">${esc(kdy)}</p>` : ''}`;
}
