// Odkazy z webů časopisů (0.02.066): z adresy stránky (penthouse.com, playboy.com, hustler.com…) se pozná
// časopis a podle slov v adrese rok, měsíc a titul (Pet of the Month / of the Year). Čte se jen adresa –
// stránka se nestahuje, obsah za přihlášením se tak nikdy nečte. Výsledek předvyplní časopis a číslo
// v rychlém okně Nová modelka a v novém albu ze zásobníku odkazů.
import { MESICE_EN, nazevRady, nazevVydani, slozitVydani } from './format.js';

// Domény časopisů → řada (časopis/edice jako v okně alba); poddomény se počítají k doméně
const WEBY = [
    { domena: 'penthouse.com', rada: 'PH/US' },
    { domena: 'penthousemagazine.com', rada: 'PH/US' },
    { domena: 'penthousegold.com', rada: 'PH/US' },
    { domena: 'playboy.com', rada: 'US' },
    { domena: 'playboyplus.com', rada: 'US' },
    { domena: 'playboy.cz', rada: 'CZ' },
    { domena: 'hustler.com', rada: 'HU/US' },
    { domena: 'hustlermagazine.com', rada: 'HU/US' },
];
// Archiv čísel magazine-empire.com: PENT_1969.htm, PLAY_1985.htm, HUST_1990.htm
const ARCHIV = { pent: 'PH/US', play: 'US', hust: 'HU/US' };

// Názvy řad z webů pro oznámení (nezávisle na načtené tabulce časopisů)
const NAZVY_RAD = { US: 'Playboy', CZ: 'Playboy CZ', 'PH/US': 'Penthouse', 'HU/US': 'Hustler' };

const MESICE = MESICE_EN.map(m => m.toLowerCase());
const KRATKE = MESICE.map(m => m.slice(0, 3));

/**
 * Rozpoznání jedné adresy: { rada, web, rok, mesic, titul, vydani, url } nebo null (není web časopisu)
 * rok a mesic jsou řetězce ('' = neznámý), titul 'mesice' | 'roku' | '', vydani klíč čísla nebo ročníku ('' bez roku)
 * @param {string} adresa
 */
export function rozpoznatAdresu(adresa) {
    let u;
    try { u = new URL(String(adresa).trim()); } catch { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    let rada = WEBY.find(w => host === w.domena || host.endsWith(`.${w.domena}`))?.rada || '';
    const cesta = decodeURIComponent(u.pathname + ' ' + u.search).toLowerCase();
    if (!rada && host === 'magazine-empire.com') {
        const a = /\/(pent|play|hust)[a-z]*_/.exec(cesta);
        rada = a ? ARCHIV[a[1]] : '';
    }
    if (!rada) return null;
    const slova = cesta.split(/[^a-z0-9]+/).filter(Boolean);
    let rok = '', mesic = '';
    // Číslo jako 2019-06 nebo 2019/06
    const cislo = /(?:^|[^0-9])(19[5-9]\d|20[0-3]\d)[-/_](0[1-9]|1[0-2])(?![0-9])/.exec(cesta);
    if (cislo) [rok, mesic] = [cislo[1], cislo[2]];
    for (const s of slova) {
        if (!rok && /^(19[5-9]\d|20[0-3]\d)$/.test(s)) rok = s;
        // Měsíc celým jménem (june) nebo zkratkou (jun)
        const i = MESICE.includes(s) ? MESICE.indexOf(s) : KRATKE.indexOf(s);
        if (!mesic && i >= 0) mesic = String(i + 1).padStart(2, '0');
    }
    const titul = /of[-_ ]the[-_ ]year|pet[-_ ]?oty|pmoy/.test(cesta) ? 'roku' : /of[-_ ]the[-_ ]month|pet[-_ ]?otm|pmom/.test(cesta) ? 'mesice' : '';
    if (titul === 'roku') mesic = '';
    return { rada, web: host, rok, mesic, titul, vydani: rok ? slozitVydani(rok, mesic, rada) : '', url: u.href };
}

/** První odkaz na web časopisu v textu (zásobník, pole odkazů); null, když žádný není @param {string} text */
export function odkazCasopisu(text) {
    for (const m of String(text || '').matchAll(/https?:\/\/[^\s,;<>"']+/g)) {
        const r = rozpoznatAdresu(m[0]);
        if (r) return r;
    }
    return null;
}

/** Popis pro oznámení: „Penthouse, červen 2002“, bez roku jen časopis @param {ReturnType<typeof rozpoznatAdresu>} c */
export function popisOdkazuCasopisu(c) {
    if (!c) return '';
    const casopis = NAZVY_RAD[c.rada] || nazevRady(c.rada);
    return c.vydani ? `${casopis}, ${nazevVydani(c.vydani).replace(/\s*·.*$/, '').replace(/^\p{Lu}/u, z => z.toLowerCase())}` : casopis;
}
