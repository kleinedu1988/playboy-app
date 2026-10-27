// Texty síně slávy (Oblíbenost › Síň slávy): události kroniky, rekordy, počty dní a měsíce kroniky. Data posílá
// backend (GetSinSlavy, oblibenost_slava.go); jména modelek se nesklonují (cizí jména), věty jsou proto stavěné
// s jménem v prvním pádě.
import { sklonovat } from './format.js';

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

// Řádek síně slávy v profilu modelky (GetSlavaModelky): „V Top 10 87 dní · 2× obhájila · nejlépe 1.“; mimo kroniku ''
export function textSlavyProfilu(s) {
    if (!(Number(s?.modelkaId) > 0) || !s.pobytu) return '';
    const casti = [s.vTop ? `V Top 10 ${textDni(s.dniTed, s.odZacatku)}` : `V Top 10 byla ${textDni(s.dniCelkem, s.odZacatku)}`];
    if (s.vTop && s.pobytu > 1) casti.push(`celkem ${textDni(s.dniCelkem)}`);
    if (s.dniNaPrvnim > 0) casti.push(`na 1. místě ${textDni(s.dniNaPrvnim)}`);
    if (s.obhajob > 0) casti.push(`${s.obhajob}× obhájila`);
    if (s.nejlepsiMisto > 0) casti.push(`nejlépe ${s.nejlepsiMisto}.`);
    return casti.join(' · ');
}
