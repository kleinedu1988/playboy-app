// Čisté funkce pro texty a data: nesahají na stránku ani na backend, proto jdou testovat samostatně
import { porovnatOblibenost, znakySrdicek } from './srdicka.js';
import { RADY_CISEL } from './rady-cisel.js';

export const MESICE = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
// Různé soubory Disku ve vloženém textu: odkazy (file/d/…, id=…) i holá ID; stejně jako parseDriveIDs v app.go
// v pořadí, jak jsou v textu
export function odkazyDisku(text) {
    const shody = String(text || '').matchAll(/(?:file\/d\/|id=|\/d\/)([a-zA-Z0-9_-]{25,})|(?:^|\s)([a-zA-Z0-9_-]{25,})(?=\s|$)/g);
    return [...new Set([...shody].map(m => m[1] || m[2]))];
}

export const pocetOdkazuDisku = text => odkazyDisku(text).length;

// Počet slov a znaků textu v markdownu (patička editoru); značky formátování se nepočítají
export function pocetSlovAZnaku(text) {
    const cisty = String(text || '').replace(/^\s*(#{1,6}|>|[-*•–]|\d+\.)\s+/gm, '').replace(/\*\*|__|~~|[*`]/g, '');
    return { slov: (cisty.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length, znaku: cisty.replace(/\s/g, '').length };
}

// Okna coveru a článku (náhledy odkazů) volají stejnou funkci pod tímto jménem
export const idOdkazuDisku = odkazyDisku;

// Anglické názvy k výběru měsíce („Červen (June)“), americké zdroje píšou čísla anglicky
// Měsíce ve 2. pádě („15. listopadu“)
export const MESICE_GENITIV = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
export const MESICE_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const moznostiMesicu = () => MESICE.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m} (${MESICE_EN[i]})</option>`).join('');

// Edice časopisu; výchozí (US) se do vydání nepíše, ostatní mají příponu: 2009-11-CZ
export const EDICE = ['US', 'CZ'];
export const VYCHOZI_EDICE = 'US';

// Měsíční řady čísel jsou data podle řady v rady-cisel.js (0.02.014): od, do a čísla, která nevyšla. Měsíc mimo
// řadu se v kalendáři, ročníku a mapě edice neukazuje jako chybějící a nedá se přidat ani označit.
// RADY_EDIC (od, do podle edice Playboye) zůstává pro mapy a kapesní katalog.
export const RADY_EDIC = Object.fromEntries(EDICE.map(e => [e, { od: RADY_CISEL[e].od, do: RADY_CISEL[e].do }]));
export function cisloNevyslo(klic) {
    const v = rozlozitVydani(klic);
    if (!v || !/^\d\d$/.test(v.mesic)) return false;
    const rada = RADY_CISEL[v.edice];
    if (!rada) return false;
    const mesic = `${v.rok}-${v.mesic}`;
    return mesic < rada.od || Boolean(rada.do && mesic > rada.do) || rada.nevysla.includes(mesic);
}
// Kolik měsíčních čísel ročník edice měl (12 bez těch, která nevyšla)
export function ciselRocniku(rok, edice) {
    return 12 - MESICE.filter((_, i) => cisloNevyslo(slozitVydani(String(rok), String(i + 1).padStart(2, '0'), edice))).length;
}

// Časopis čísla (0.02, v Go hledani.RozdelitCasopis): klíč RRRR-MM[-EDICE][@ČASOPIS], např. „1985-09@PH“,
// „1986-03-UK@PH“; bez přípony Playboy, „@PB“ se nepíše. Edice je země vydání; „řada“ je edice i s časopisem –
// u Playboye „US“ / „CZ“ jako dřív, jinak „PH/US“. Pole `edice` z rozlozitVydani je řada, takže pohledy, které ji
// porovnávají s „US“ nebo „CZ“, čísla jiných časopisů samy vynechají, a slozitVydani z ní klíč složí zpátky.
export const VYCHOZI_CASOPIS = 'PB';

// Řada ze země a časopisu: („US“, „PB“) → „US“, („UK“, „PH“) → „PH/UK“
export const radaVydani = (zeme, casopis = VYCHOZI_CASOPIS) => (!casopis || casopis === VYCHOZI_CASOPIS ? zeme || VYCHOZI_EDICE : `${casopis}/${zeme || VYCHOZI_EDICE}`);

// Řada na časopis a zemi: „PH/UK“ → { casopis: 'PH', zeme: 'UK' }, „CZ“ → { casopis: 'PB', zeme: 'CZ' }
export function rozlozitRadu(rada) {
    const m = /^([A-Z]{2})\/([A-Z]{2})$/.exec(rada || '');
    return m ? { casopis: m[1], zeme: m[2] } : { casopis: VYCHOZI_CASOPIS, zeme: rada || VYCHOZI_EDICE };
}

// „2009-11-CZ" → { rok: '2009', mesic: '11', edice: 'CZ', zeme: 'CZ', casopis: 'PB' }; ročník bez měsíce má mesic '';
// neplatné → null. Speciál (zvláštní číslo mimo měsíční řadu) má místo měsíce pořadí v roce: „1995-S01" → mesic 'S01'.
// Jiný časopis: „1986-03-UK@PH" → { …, edice: 'PH/UK', zeme: 'UK', casopis: 'PH' }.
export function rozlozitVydani(text) {
    const casti = /^(\d{4})(?:-(0[1-9]|1[0-2]|S\d{2}))?(?:-([A-Z]{2}))?(?:@([A-Z]{2}))?$/.exec(text || '');
    if (!casti || casti[4] === VYCHOZI_CASOPIS) return null;
    const zeme = casti[3] || VYCHOZI_EDICE, casopis = casti[4] || VYCHOZI_CASOPIS;
    return { rok: casti[1], mesic: casti[2] || '', edice: radaVydani(zeme, casopis), zeme, casopis };
}

// Je klíč číslem Playboye? Pohledy Playboye (stěna Centerfoldů, kapesní katalog, dokončené ročníky) ukazují jen ty,
// dokud nebudou podle časopisu (0.02.016–0.02.018); neplatný klíč není číslo žádného časopisu
export const jeCisloPlayboye = klic => rozlozitVydani(klic)?.casopis === VYCHOZI_CASOPIS;

// Patří centerfold na stěnu Centerfoldů se zvolenou volbou (0.02.018)? „vse“ = celý Playboy (výchozí, jako dřív),
// „vsechny“ = všechny časopisy, „c:PH“ = celý časopis, jinak řada („US“, „CZ“, „PH/UK“). Album, které není číslem
// (staré pojmenování), je jen ve „vse“ a „vsechny“.
export function naSteneCenterfoldu(album, volba) {
    const v = rozlozitVydani(album);
    if (volba === 'vsechny') return true;
    if (volba === 'vse') return !v || v.casopis === VYCHOZI_CASOPIS;
    if (volba.startsWith('c:')) return v?.casopis === volba.slice(2);
    return v?.edice === volba;
}

// Volby stěny Centerfoldů: časopis (Playboy = „vse“), u časopisu s víc edicemi i jednotlivé edice, nakonec
// Všechny časopisy; bez načtené tabulky časopisů jen Playboy jako dřív
export function moznostiSteny() {
    const seznam = casopisy.size ? [...casopisy.values()] : [{ klic: VYCHOZI_CASOPIS, nazev: 'Playboy', edice: EDICE }];
    const v = seznam.flatMap(c => {
        const edice = c.edice?.length ? c.edice : [VYCHOZI_EDICE];
        return [{ hodnota: c.klic === VYCHOZI_CASOPIS ? 'vse' : `c:${c.klic}`, nazev: c.nazev },
            ...(edice.length > 1 ? edice.map(zeme => ({ hodnota: radaVydani(zeme, c.klic), nazev: `${c.nazev} ${zeme}` })) : [])];
    });
    return seznam.length > 1 ? [...v, { hodnota: 'vsechny', nazev: 'Všechny časopisy' }] : v;
}

// Klíč z roku, měsíce (nebo Snn, '' = ročník) a řady („US“, „CZ“, „PH/UK“)
export function slozitVydani(rok, mesic, edice) {
    if (!rok) return '';
    const { casopis, zeme } = rozlozitRadu(edice);
    return [rok, mesic, zeme !== VYCHOZI_EDICE ? zeme : ''].filter(Boolean).join('-') + (casopis !== VYCHOZI_CASOPIS ? `@${casopis}` : '');
}

// Časopisy z tabulky (casopisy.go) podle klíče; plní je rozhraní z backendu (mezipamet.js) jako názvy speciálů
const casopisy = new Map();

/** @param {{ klic: string, nazev: string, barva?: string, edice?: string[], modelkaMesice?: string, modelkaRoku?: string }[]} seznam */
export function nastavitCasopisy(seznam) {
    casopisy.clear();
    (seznam || []).forEach(c => casopisy.set(c.klic, c));
}

// Název časopisu podle klíče („PH“ → „Penthouse“); neznámý klíč zůstane zkratkou
export const nazevCasopisu = klic => casopisy.get(klic)?.nazev || klic || '';

// Tituly modelky čísla podle časopisu (0.02.009): Playboy má Playmate, Penthouse Pet, Hustler Honey. Z tabulky
// časopisů (modelkaMesice, modelkaRoku); bez načtené tabulky nebo bez vyplněného titulu Playboy, resp. obecný titul.
// druh: 'mesice' („Pet of the Month“), 'roku' („Pet of the Year“), 'kratky' („Pet“ – první slovo titulu měsíce,
// do štítků a vět jako „Playmate · Září 1985“)
const TITULY_PLAYBOYE = { mesice: 'Playmate měsíce', roku: 'Playmate roku' };
const OBECNE_TITULY = { mesice: 'Modelka měsíce', roku: 'Modelka roku' };

// Má některá modelka číslo nebo obálku jiného časopisu než Playboy? Statistiky je zatím nepočítají (filtr časopisu
// 0.02.061), texty pak místo „v časopise“ řeknou „v Playboyi“ (0.02.020)
export const maJineCasopisy = modelky => modelky.some(m => [...(m.vydani || []), ...(m.obalky || [])]
    .some(v => { const c = rozlozitVydani(v)?.casopis; return !!c && c !== VYCHOZI_CASOPIS; }));
export const vCasopiseStatistik = modelky => (maJineCasopisy(modelky) ? 'v Playboyi' : 'v časopise');

// Je název kategorie titulem jiného časopisu než Playboy („Pet of the Month“, „Honey of the Year“)?
export const jeTitulJinehoCasopisu = nazev => [...casopisy.keys()].some(k => k !== VYCHOZI_CASOPIS
    && (titulCasopisu(k, 'mesice') === nazev || titulCasopisu(k, 'roku') === nazev));

/** @param {string} klic @param {'mesice' | 'roku' | 'kratky'} [druh] */
export function titulCasopisu(klic, druh = 'mesice') {
    const k = klic || VYCHOZI_CASOPIS;
    const c = casopisy.get(k);
    const vychozi = k === VYCHOZI_CASOPIS ? TITULY_PLAYBOYE : OBECNE_TITULY;
    const mesice = c?.modelkaMesice?.trim() || vychozi.mesice;
    if (druh === 'roku') return c?.modelkaRoku?.trim() || vychozi.roku;
    if (druh === 'kratky') return mesice === OBECNE_TITULY.mesice ? 'Modelka' : mesice.split(/\s+/)[0];
    return mesice;
}

// Titul podle čísla („1985-09@PH“ → „Pet of the Month“); album, které není číslem, je Playboy
/** @param {string} vydani @param {'mesice' | 'roku' | 'kratky'} [druh] */
export const titulCisla = (vydani, druh = 'mesice') => titulCasopisu(rozlozitVydani(vydani)?.casopis || VYCHOZI_CASOPIS, druh);

/**
 * Kdo je v čísle (0.02.043) pro hero Kalendáře a Obálek: „centerfold Jméno“, „Pet of the Month Jméno“ (titul
 * měsíce bez centerfoldu) nebo „pictorial Jméno“ (jediná modelka čísla); prázdné, když to kalendář neví
 * @param {{ vydani: string, modelka?: string, modelkaCisla?: string, modelkaOdkud?: string } | null | undefined} cislo
 */
export function kdoVCisle(cislo) {
    const jmeno = cislo?.modelkaCisla || cislo?.modelka || '';
    if (!jmeno) return '';
    const odkud = cislo?.modelkaOdkud || (cislo?.modelka ? 'centerfold' : '');
    return `${odkud === 'titul' ? titulCisla(cislo.vydani) : odkud === 'pictorial' ? 'pictorial' : 'centerfold'} ${jmeno}`;
}

// Název řady: „US“, „CZ“ (Playboy jako dřív), „Penthouse“, „Penthouse UK“
export function nazevRady(rada) {
    const { casopis, zeme } = rozlozitRadu(rada);
    if (casopis === VYCHOZI_CASOPIS) return zeme;
    return `${nazevCasopisu(casopis)}${zeme !== VYCHOZI_EDICE ? ` ${zeme}` : ''}`;
}

// Volby „Časopis a edice“ do okna alba a coveru: [{ hodnota: řada, nazev }] v pořadí časopisů a jejich edic
// („Playboy US“, „Playboy CZ“, „Penthouse US“…); bez načtených časopisů jen edice Playboye
export function moznostiRad() {
    const seznam = casopisy.size ? [...casopisy.values()] : [{ klic: VYCHOZI_CASOPIS, nazev: 'Playboy', edice: EDICE }];
    return seznam.flatMap(c => (c.edice?.length ? c.edice : [VYCHOZI_EDICE]).map(zeme => ({ hodnota: radaVydani(zeme, c.klic), nazev: `${c.nazev} ${zeme}` })));
}

// Řada zobrazená v Kalendáři a Obálkách (0.02.016): platná je řada z tabulky časopisů; před jejím načtením stačí
// tvar, aby se uložená volba z minula nezahodila
export const platnaRadaKalendare = rada => /^([A-Z]{2}|[A-Z]{2}\/[A-Z]{2})$/.test(rada || '') && (!casopisy.size || moznostiRad().some(m => m.hodnota === rada));

// Název řady ve volbě a v prázdném stavu: „Playboy US“, „Penthouse UK“
export const nazevVolbyRady = rada => moznostiRad().find(m => m.hodnota === rada)?.nazev || nazevRady(rada);

// Přípona ročníku řady do vět („Ročník 1985 CZ“, „Ročník 1985 Penthouse US“); u Playboye US nic (0.02.021)
export const priponaRocniku = rada => (rada === VYCHOZI_EDICE ? '' : rada.includes('/') ? ` ${nazevVolbyRady(rada)}` : ` ${rada}`);

// Časopisy čísel a obálek modelky (klíče „PB“, „PH“…) a časopisy celé sbírky v pořadí tabulky časopisů (0.02.021)
// Časopisy modelky stejně jako nadtitulek profilu (0.02.044): čísla, pictorialy čísel i online alba (Playboy) –
// dřív jen vydání, obálky a centerfoldy, takže modelka jen s pictorialem nebo online do filtru Playboy nepatřila
// Pamatuje se u objektu modelky (Kronika filtruje tisíce záznamů); nová data z backendu jsou nové objekty
const casopisyPodleModelky = new WeakMap();
export function casopisyModelky(m) {
    if (!m) return new Set();
    let c = casopisyPodleModelky.get(m);
    if (!c) casopisyPodleModelky.set(m, c = new Set(karieraPoCasopisech(m).map(s => s.casopis)));
    return c;
}
export function casopisyVeSbirce(modelky) {
    const vse = new Set();
    for (const m of modelky) casopisyModelky(m).forEach(c => vse.add(c));
    const poradi = [...casopisy.keys()];
    const pozice = k => (poradi.includes(k) ? poradi.indexOf(k) : k === VYCHOZI_CASOPIS ? -1 : poradi.length);
    return [...vse].sort((a, b) => pozice(a) - pozice(b) || a.localeCompare(b))
        .map(klic => ({ klic, nazev: casopisy.get(klic)?.nazev || (klic === VYCHOZI_CASOPIS ? 'Playboy' : klic) }));
}

// Přípona časopisu a edice k názvu čísla: '' u Playboye US, „ · CZ“, u jiného časopisu „ · Penthouse“ /
// „ · Penthouse UK“; kratce (páska) se zkratkou „ · PH“ / „ · PH UK“
function priponaRady(v, kratce = false) {
    if (v.casopis !== VYCHOZI_CASOPIS) return ` · ${kratce ? v.casopis : nazevCasopisu(v.casopis)}${v.zeme !== VYCHOZI_EDICE ? ` ${v.zeme}` : ''}`;
    return v.zeme !== VYCHOZI_EDICE ? ` · ${v.zeme}` : '';
}

// Názvy speciálů podle klíče; plní je rozhraní z backendu (mezipamet.js)
const nazvySpecialu = new Map();

export function nastavitNazvySpecialu(seznam) {
    nazvySpecialu.clear();
    (seznam || []).forEach(s => nazvySpecialu.set(s.vydani, s.nazev));
}

export const jeSpecial = vydani => /^\d{4}-S\d{2}/.test(vydani || '');

// Speciály jednoho roku a edice: [{ vydani, nazev }] podle pořadí
export function specialyRoku(rok, edice = VYCHOZI_EDICE) {
    return [...nazvySpecialu].map(([vydani, nazev]) => ({ vydani, nazev, v: rozlozitVydani(vydani) }))
        .filter(s => s.v && s.v.rok === String(rok) && s.v.edice === edice)
        .sort((a, b) => a.vydani.localeCompare(b.vydani))
        .map(({ vydani, nazev }) => ({ vydani, nazev }));
}

// Název měsíce nebo speciálu z části „mesic" klíče
function nazevCasti(vydani, v) {
    if (v.mesic.startsWith('S')) return nazvySpecialu.get(vydani) || `Speciál ${parseInt(v.mesic.slice(1))}`;
    return MESICE[parseInt(v.mesic) - 1];
}

// Vydání pro zobrazení: „Listopad 2009", „2012", „Playmate Review 1995", u jiné než výchozí edice „… · CZ"
export function nazevVydani(vydani) {
    const v = rozlozitVydani(vydani);
    if (!v) return vydani;
    return (v.mesic ? `${nazevCasti(vydani, v)} ${v.rok}` : v.rok) + priponaRady(v);
}

// Páska čísla (dlaždice Čísel, levý panel profilu a čísla): „BŘE 95“, u speciálu „SPECIÁL 95“, u ročníku „ROČNÍK 95“, u jiné edice „… · CZ“
export const ZKRATKY_PASKY = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
export function paskaCisla(vydani) {
    const v = rozlozitVydani(vydani);
    if (!v) return '';
    const rok = v.rok.slice(2);
    const edice = priponaRady(v, true);
    if (!v.mesic) return `Ročník ${rok}${edice}`;
    if (v.mesic.startsWith('S')) return `Speciál ${rok}${edice}`;
    return `${ZKRATKY_PASKY[parseInt(v.mesic) - 1]} ${rok}${edice}`;
}

// Adresa obrázku v požadované velikosti; šablonu adresy (s {velikost}) skládá backend
export function obrazek(adresa, velikost) {
    return String(adresa || '').replace('{velikost}', velikost);
}

// Album centerfoldu a coveru je uložené jako vydání časopisu; zobrazuje se jako vydání
// Řazení galerie: abecedně, naposledy přidané, podle roku prvního vydání, podle srdíček, podle oblíbenosti z porovnávání
// (lib/srdicka.js), podle počtu fotek; modelky bez údaje jdou na konec
export const RAZENI_GALERIE = {
    jmeno: { popisek: 'A–Z', nazev: 'abecedně' },
    pridano: { popisek: 'Nově přidané', nazev: 'naposledy přidané' },
    rok: { popisek: 'Podle roku', nazev: 'podle roku prvního vydání' },
    hodnoceni: { popisek: 'Podle srdíček', nazev: 'podle srdíček, se stejnými srdíčky podle oblíbenosti (porovnávání a fotky)' },
    fotky: { popisek: 'Podle fotek', nazev: 'podle počtu fotek' },
};

// Rok a časopis prvního vystoupení (0.02.042): stejně jako nadtitulek profilu (karieraPoCasopisech – čísla
// i online alba), jednotně pro kartu, řazení podle roku a části lišty. Pamatuje se u objektu modelky.
const prvniVystoupeni = new WeakMap();
/** @returns {{ rok: number, casopis: string }} */
export function prvniCisloModelky(modelka) {
    let v = prvniVystoupeni.get(modelka);
    if (!v) {
        const s = karieraPoCasopisech(modelka)[0];
        v = { rok: parseInt(s?.rok || '', 10) || 0, casopis: s?.casopis || '' };
        prvniVystoupeni.set(modelka, v);
    }
    return v;
}
export const prvniRok = modelka => prvniCisloModelky(modelka).rok;

export function seraditModelky(modelky, razeni) {
    const vysledek = [...modelky];
    if (razeni === 'pridano') vysledek.sort((a, b) => (b.pridano || '').localeCompare(a.pridano || ''));
    else if (razeni === 'rok') vysledek.sort((a, b) => (prvniRok(a) || 9999) - (prvniRok(b) || 9999));
    else if (razeni === 'hodnoceni') vysledek.sort(porovnatOblibenost);
    else if (razeni === 'fotky') vysledek.sort((a, b) => (b.pocetFotek || 0) - (a.pocetFotek || 0));
    return vysledek;
}

// Část galerie, do které karta patří (lišta nad galerií): písmeno, měsíc přidání, desetiletí, srdíčka nebo rozsah fotek
export function castGalerie(modelka, razeni) {
    if (razeni === 'pridano') {
        const [rok, mesic] = (modelka.pridano || '').split('-');
        return rok && mesic ? `${MESICE[parseInt(mesic) - 1]} ${rok}` : 'Bez data';
    }
    if (razeni === 'rok') {
        const rok = prvniRok(modelka);
        return rok ? `${Math.floor(rok / 10) * 10}s` : 'Bez vydání';
    }
    if (razeni === 'hodnoceni') {
        return znakySrdicek(modelka.hodnoceni) || 'Bez srdíček';
    }
    if (razeni === 'fotky') {
        const n = modelka.pocetFotek || 0;
        return n >= 50 ? '50+ fotek' : n >= 20 ? '20–49 fotek' : n >= 1 ? '1–19 fotek' : 'Bez fotek';
    }
    const jmeno = bezDiakritiky(modelka.jmeno);
    return /^\p{L}/u.test(jmeno) ? jmeno[0].toUpperCase() : '#';
}

// Počet s podstatným jménem ve správném tvaru: 1 fotka, 2–4 fotky, 0 a 5+ fotek
export function sklonovat(n, jedna, dve, pet) {
    return `${n} ${n === 1 ? jedna : n > 1 && n < 5 ? dve : pet}`;
}

// Pictorial jen na webu (Cyber Girl, Coed, Muse…): nepatří k číslu časopisu, místo vydání má datum nafocení
export const TYP_ONLINE = 'Pictorial online';

// Cyber Girl of the Week / of the Month: online alba, u kterých se z data nafocení počítá týden (celé datum),
// nebo měsíc (stačí RRRR-MM)
export const TYP_CG_TYDNE = 'Cyber Girl týdne';
export const TYP_CG_MESICE = 'Cyber Girl měsíce';
export const jeOnline = typ => typ === TYP_ONLINE || typ === TYP_CG_TYDNE || typ === TYP_CG_MESICE;

// Pictorial playmate v časopise: Playmate of the Month a Playmate of the Year (kategorie Playmate měsíce, nebo
// Playmate roku s rokem čísla; odvozuje backend, snimek.go)
export const TYP_PM_MESICE = 'Playmate měsíce';
export const TYP_PM_ROKU = 'Playmate roku';

// Popisek volby typu v okně alba podle časopisu (0.02.011): Playboy „Playmate of the Month / Year“, Penthouse
// „Pet of the Month / Year“; uložený typ zůstává TYP_PM_MESICE / TYP_PM_ROKU (role modelky měsíce / roku)
export function popisDruhuCasopisu(typ, casopis = VYCHOZI_CASOPIS) {
    const roku = typ === TYP_PM_ROKU;
    if (typ !== TYP_PM_MESICE && !roku) return typ;
    if (!casopis || casopis === VYCHOZI_CASOPIS) return roku ? 'Playmate of the Year' : 'Playmate of the Month';
    return titulCasopisu(casopis, roku ? 'roku' : 'mesice');
}

// Období ocenění Cyber Girl z data nafocení: „24. týden 2004“, „červen 2004“; bez potřebné přesnosti ''
export function obdobiCyberGirl(typ, datum) {
    if (typ === TYP_CG_TYDNE) {
        const t = tydenRoku(datum);
        return t ? `${t.tyden}. týden ${t.rok}` : '';
    }
    const shoda = typ === TYP_CG_MESICE && /^(\d{4})-(\d{2})/.exec(String(datum || ''));
    return shoda ? formatDatum(`${shoda[1]}-${shoda[2]}`) : '';
}

// Týden v roce podle ISO 8601 (týden začíná pondělím, 1. týden obsahuje první čtvrtek) z data RRRR-MM-DD;
// bez dne týden nejde určit
export function tydenRoku(datum) {
    const shoda = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(datum || ''));
    if (!shoda) return null;
    const d = new Date(Date.UTC(+shoda[1], +shoda[2] - 1, +shoda[3]));
    d.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() + 6) % 7);
    const prvniCtvrtek = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    return { tyden: 1 + Math.round(((d.getTime() - prvniCtvrtek.getTime()) / 864e5 - 3 + (prvniCtvrtek.getUTCDay() + 6) % 7) / 7), rok: d.getUTCFullYear() };
}

// Typ alba v hlavičce; online album s datem nafocení: „Pictorial online · nafoceno červen 2004“,
// Cyber Girl týdne s celým datem: „Cyber Girl týdne · 24. týden 2004 (nafoceno 12. 6. 2004)“,
// Cyber Girl měsíce: „Cyber Girl měsíce · červen 2004“ (s celým datem i „(nafoceno …)“)
// Pictorial modelky měsíce / roku čísla jiného časopisu: „Pictorial Pet of the Month“ (vydani = číslo alba)
export function popisTypuAlba(typ, datum, vydani = '') {
    const obdobi = obdobiCyberGirl(typ, datum);
    if (obdobi) return `${typ} · ${obdobi}${/^\d{4}-\d{2}-\d{2}$/.test(datum) ? ` (nafoceno ${formatDatum(datum)})` : ''}`;
    if (typ === TYP_PM_MESICE || typ === TYP_PM_ROKU) {
        const casopis = rozlozitVydani(vydani)?.casopis || VYCHOZI_CASOPIS;
        return `Pictorial ${casopis === VYCHOZI_CASOPIS ? typ : titulCasopisu(casopis, typ === TYP_PM_ROKU ? 'roku' : 'mesice')}`;
    }
    return jeOnline(typ) && datum ? `${typ} · nafoceno ${formatDatum(datum)}` : typ;
}

// Typ alba na stránce čísla a v obsahu (0.02.043): u jiného časopisu než Playboy titul časopisu („Pet of the
// Month“ místo „Playmate měsíce“), jinak uložený typ beze změny
export function typVCisle(typ, vydani = '') {
    if (typ !== TYP_PM_MESICE && typ !== TYP_PM_ROKU) return typ;
    const casopis = rozlozitVydani(vydani)?.casopis || VYCHOZI_CASOPIS;
    return casopis === VYCHOZI_CASOPIS ? typ : titulCasopisu(casopis, typ === TYP_PM_ROKU ? 'roku' : 'mesice');
}

export function nazevAlba(album, typ) {
    return (typ === 'Centerfold' || typ === 'Cover') && rozlozitVydani(album)?.mesic ? nazevVydani(album) : album;
}

// Ošetření textu vkládaného do HTML
export function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
}

// Inline markdown: tučné (**text**, __text__), kurzíva (*text*, _text_), tučná kurzíva (***text***, ___text___), kód (`text`), přeškrtnutí (~~text~~)
export function markdownVRadku(text) {
    if (!text) return '';
    let out = esc(text);

    // Kód chráníme před vyhodnocením dalšího formátování
    const kody = [];
    out = out.replace(/`([^`]+)`/g, (_, kod) => {
        kody.push(`<code>${kod}</code>`);
        return `\x00KOD_${kody.length - 1}\x00`;
    });

    // Odkazy [[cíl]] a [[cíl|popisek]] (lib/odkazy.js) – chráněné před dalším formátováním, cíl dohledá app/wiki-odkazy.js
    out = out.replace(/\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g, (_, cil, popisek) => {
        kody.push(`<button type="button" class="wiki-odkaz" data-wiki="${cil.trim()}">${(popisek || cil).trim()}</button>`);
        return `\x00KOD_${kody.length - 1}\x00`;
    });

    // Tučná kurzíva: ***text*** nebo ___text___
    out = out.replace(/\*\*\*(?!\s)(.+?)(?<!\s)\*\*\*/g, '<strong><em>$1</em></strong>');
    out = out.replace(/___(?!\s)(.+?)(?<!\s)___/g, '<strong><em>$1</em></strong>');

    // Tučné: **text** nebo __text__
    out = out.replace(/\*\*(?!\s)(.+?)(?<!\s)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__(?!\s)(.+?)(?<!\s)__/g, '<strong>$1</strong>');

    // Kurzíva: *text* (nesmí mít mezeru hned za * ani před koncovým *)
    out = out.replace(/\*(?!\s)([^*]+?)(?<!\s)\*/g, '<em>$1</em>');
    // Kurzíva: _text_ (jen celá slova nebo ohraničená mezerami/závorkami/interpunkcí, ne uvnitř slov jako snake_case)
    out = out.replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?:]|$)/g, '$1<em>$2</em>');

    // Přeškrtnutí: ~~text~~
    out = out.replace(/~~(?!\s)(.+?)(?<!\s)~~/g, '<del>$1</del>');

    // Vrácení kódů
    out = out.replace(/\x00KOD_(\d+)\x00/g, (_, i) => kody[Number(i)]);

    return out;
}

// Celý text na HTML: odstavce, nadpisy (# až ######), citace (>), odrážkové (*, -) a číslované (1.) seznamy
// perex: první odstavec dostane třídu clanek-perex (pro články)
// mluvci: začátek řádku ve tvaru „SLOVO:“ (např. PLAYBOY:, HEFNER:) zvýrazní tučně
export function formatMarkdown(text, { perex = false, mluvci = false } = {}) {
    if (!text) return '';
    const radky = String(text).replace(/\r/g, '').split('\n');
    const casti = [];
    let seznam = null;
    let citat = null;
    let odstavec = null;
    let pouzitPerex = perex;

    const ukoncit = () => {
        if (seznam) {
            casti.push(`<${seznam.typ}>${seznam.polozky.map(p => `<li>${p}</li>`).join('')}</${seznam.typ}>`);
            seznam = null;
        }
        if (citat) {
            casti.push(`<blockquote>${citat.join('<br>')}</blockquote>`);
            citat = null;
        }
        if (odstavec) {
            const trida = pouzitPerex ? ' class="clanek-perex"' : '';
            pouzitPerex = false;
            casti.push(`<p${trida}>${odstavec.join('<br>')}</p>`);
            odstavec = null;
        }
    };

    for (const radek of radky) {
        const t = radek.trim();
        if (!t) {
            ukoncit();
            continue;
        }

        // Nadpisy: #, ##, ###; #### až ###### (texty z webu, 0.02.041) jako nejmenší úroveň
        const mNadpis = /^(#{1,6})\s+(.*)$/.exec(t);
        if (mNadpis) {
            ukoncit();
            const u = Math.min(6, mNadpis[1].length + 2);
            casti.push(`<h${u}>${markdownVRadku(mNadpis[2])}</h${u}>`);
            continue;
        }

        // Citace: řádek začínající >
        if (t.startsWith('>')) {
            if (odstavec || seznam) ukoncit();
            (citat ||= []).push(markdownVRadku(t.replace(/^>\s*/, '')));
            continue;
        }

        // Odrážkový seznam: začíná *, -, • nebo pomlčkou
        const mOdrazka = /^[*•–\-]\s+(.*)$/.exec(t);
        if (mOdrazka) {
            if (citat || odstavec || (seznam && seznam.typ !== 'ul')) ukoncit();
            if (!seznam) seznam = { typ: 'ul', polozky: [] };
            seznam.polozky.push(markdownVRadku(mOdrazka[1]));
            continue;
        }

        // Číslovaný seznam: začíná 1. apod.
        const mCislo = /^\d+\.\s+(.*)$/.exec(t);
        if (mCislo) {
            if (citat || odstavec || (seznam && seznam.typ !== 'ol')) ukoncit();
            if (!seznam) seznam = { typ: 'ol', polozky: [] };
            seznam.polozky.push(markdownVRadku(mCislo[1]));
            continue;
        }

        // Pokračovací řádek odrážky (odsazený mezerami nebo tabulátorem)
        if (seznam && (radek.startsWith('  ') || radek.startsWith('\t'))) {
            seznam.polozky[seznam.polozky.length - 1] += ' ' + markdownVRadku(t);
            continue;
        }

        // Obyčejný text: ukončí předchozí seznam nebo citát
        if (seznam || citat) ukoncit();

        let radka = markdownVRadku(t);
        if (mluvci) {
            radka = radka.replace(/^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .'-]{1,30}):/, '<strong>$1:</strong>');
        }
        (odstavec ||= []).push(radka);
    }
    ukoncit();
    return casti.join('');
}

// RRRR-MM-DD -> D. M. RRRR, RRRR-MM -> březen RRRR, samotný rok zůstává
export function formatDatum(datum) {
    const casti = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum || '');
    if (casti) return `${parseInt(casti[3])}. ${parseInt(casti[2])}. ${casti[1]}`;
    const mesic = /^(\d{4})-(\d{2})$/.exec(datum || '');
    if (mesic && MESICE[parseInt(mesic[2]) - 1]) return `${MESICE[parseInt(mesic[2]) - 1].toLowerCase()} ${mesic[1]}`;
    return datum || '';
}

// Datum modelky (narození, úmrtí) smí být neúplné: RRRR, RRRR-MM nebo RRRR-MM-DD; prázdné je v pořádku
const VZOR_DATUMU = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
export const platneDatum = datum => !String(datum || '').trim() || VZOR_DATUMU.test(String(datum).trim());

// Text pro porovnávání: malá písmena bez diakritiky
// Písmena, která se na základní tvar nerozkládají sama (stejně jako v Go)
const ZVLASTNI_PISMENA = { 'ł': 'l', 'ø': 'o', 'đ': 'd', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'þ': 'th', 'ı': 'i' };
export const bezDiakritiky = text => {
    const s = String(text || '').toLowerCase();
    return /[^\x00-\x7f]/.test(s) ? s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[łøđßæœþı]/g, z => ZVLASTNI_PISMENA[z]) : s;
};
export const sjednotit = text => bezDiakritiky(text).trim();

// Věk v letech k danému vydání (RRRR-MM), pokud je známé datum narození
export function vekPriVydani(narozeni, vydani) {
    const n = /^(\d{4})-(\d{2})/.exec(narozeni || '');
    const v = /^(\d{4})-(\d{2})/.exec(vydani || '');
    if (!n || !v) return '';
    const vek = parseInt(v[1]) - parseInt(n[1]) - (parseInt(v[2]) < parseInt(n[2]) ? 1 : 0);
    return vek > 0 && vek < 120 ? `${vek} let` : '';
}

// U tetování a piercingu je „ne" (0) vyplněná hodnota, nevyplněno je -1; u ostatních čísel nula znamená prázdné
export function udajChybi(modelka, vlastnost) {
    const hodnota = modelka[vlastnost];
    if (vlastnost === 'tetovani' || vlastnost === 'piercing') return hodnota !== 0 && hodnota !== 1;
    // Kategorie se počítá i odvozená (centerfold, obálka)
    if (vlastnost === 'role') return !kategorieModelky(modelka).length;
    return !hodnota;
}

// Kategorie modelek (podle rozdělení na Playboy.com). Ukládají se do pole `role` jako text oddělený čárkami,
// např. „Playmate roku 1998, Celebrita“; hodnota, kterou seznam nezná, zůstane jako vlastní kategorie.
// Playmate měsíce a Modelka obálky program navíc odvodí sám z centerfoldů a obálek.
// rok = kategorie má rok, urovne = Cyber Girl týdne / měsíce / roku; online = kategorie z Playboy.com, ne z časopisu;
// aliasy jsou bez diakritiky a malými písmeny
export const KATEGORIE = [
    { nazev: 'Playmate měsíce', odvozena: true, aliasy: ['playmate mesice', 'playmate of the month', 'pmom', 'playmate'] },
    { nazev: 'Playmate roku', rok: true, aliasy: ['playmate roku', 'playmate of the year', 'pmoy'] },
    { nazev: 'Cyber Girl', urovne: ['týdne', 'měsíce', 'roku'], online: true, aliasy: ['cyber girl', 'cybergirl', 'cyber'] },
    { nazev: 'Coed', urovne: ['týdne', 'měsíce'], online: true, aliasy: ['coed'] },
    { nazev: 'Muse', online: true, aliasy: ['muse', 'muses'] },
    { nazev: 'Celebrita', aliasy: ['celebrita', 'celebrity'] },
    { nazev: 'Modelka obálky', odvozena: true, aliasy: ['modelka obalky', 'cover girl', 'cover model', 'cover', 'obalka'] },
    { nazev: 'Jen ve speciálu', aliasy: ['jen ve specialu', 'special edition', 'specialni vydani', 'special', 'specialu'] },
    { nazev: 'Creator', online: true, aliasy: ['creator', 'tvurkyne'] },
    { nazev: 'Online', online: true, aliasy: ['online', 'jen online', 'playboy plus', 'playboy com', 'playboy.com'] },
];
const ALIASY_KATEGORII = KATEGORIE.flatMap(k => k.aliasy.map(alias => ({ alias, kategorie: k })))
    .sort((a, b) => b.alias.length - a.alias.length);
const normalizovat = text => bezDiakritiky(text).toLowerCase().replace(/\s+/g, ' ').trim();

/** @typedef {{ nazev: string, detail: string, zbytek: string, vlastni: boolean, odvozena?: boolean }} Kategorie */

// „Playmate roku 1998, Cybergirl of the Month 2005" → [{ nazev, detail, zbytek, vlastni }]
/** @returns {Kategorie[]} */
export function rozlozitKategorie(text) {
    /** @type {Kategorie[]} */
    const vysledek = [];
    for (const kus of String(text || '').split(/[,;\n]/).map(k => k.trim()).filter(Boolean)) {
        const maly = normalizovat(kus);
        const shoda = ALIASY_KATEGORII.find(({ alias }) => maly === alias || maly.startsWith(alias + ' '));
        if (!shoda) {
            vysledek.push({ nazev: kus, detail: '', zbytek: '', vlastni: true });
            continue;
        }
        const k = shoda.kategorie;
        // Zbytek za názvem (po slovech): úroveň (týdne, of the month…) nebo rok; co program nepozná, se zachová
        const slova = kus.split(/\s+/).slice(shoda.alias.split(' ').length);
        let detail = '';
        if (k.urovne) {
            const uroven = /^(of the )?(tydne|week|mesice|month|roku|year)\b/.exec(normalizovat(slova.join(' ')));
            const nazevUrovne = uroven && { tydne: 'týdne', week: 'týdne', mesice: 'měsíce', month: 'měsíce', roku: 'roku', year: 'roku' }[uroven[2]];
            if (nazevUrovne && k.urovne.includes(nazevUrovne)) {
                detail = nazevUrovne;
                slova.splice(0, uroven[0].split(' ').length);
            }
        } else if (k.rok) {
            const index = slova.findIndex(s => /^(19|20)\d{2}$/.test(s));
            if (index >= 0) detail = slova.splice(index, 1)[0];
        }
        const zbytek = slova.join(' ');
        if (!vysledek.some(v => v.nazev === k.nazev)) vysledek.push({ nazev: k.nazev, detail, zbytek, vlastni: false });
    }
    return vysledek;
}

export const popisKategorie = k => [k.nazev, k.detail, k.zbytek].filter(Boolean).join(' ');
export const slozitKategorie = seznam => seznam.map(popisKategorie).join(', ');

// Kategorie odvozené z dat: centerfold Playboye nebo pictorial Playmate of the Month = Playmate měsíce, pictorial
// Playmate of the Year = Playmate roku, obálka = Modelka obálky, album Cyber Girl týdne nebo měsíce = Cyber Girl
// (obyčejný Pictorial online kategorii nedává). Jiný časopis dá svůj titul (0.02.012): centerfold a pictorial
// modelky měsíce Penthouse = Pet of the Month, modelky roku = Pet of the Year (backend titulyJinde)
export function titulyJindeModelky(modelka) {
    const v = [...(modelka.titulyJinde || [])];
    for (const c of new Set((modelka.centerfoldy || []).map(x => rozlozitVydani(x)?.casopis).filter(c => c && c !== VYCHOZI_CASOPIS))) {
        const nazev = titulCasopisu(c);
        if (!v.some(t => t.nazev === nazev)) v.push({ nazev, rok: '' });
    }
    return v;
}

// Další jména s časopisem (0.02.027, v Go hledani.RozdelitJmeno): „Jane Doe @PH“ = pod tímto jménem vyšla
// v Penthouse. Vrací [{ jmeno, casopis }] bez prázdných; casopis '' = jméno bez časopisu.
export function dalsiJmenaModelky(pole) {
    return String(pole || '').split(',').map(d => {
        const s = d.trim();
        const m = /^(.*\S)\s*@([A-Za-z]{2})$/.exec(s);
        return m ? { jmeno: m[1].trim(), casopis: m[2].toUpperCase() } : { jmeno: s, casopis: '' };
    }).filter(d => d.jmeno);
}
// „Jane Doe (Penthouse)“ do textu profilu
export const popisDalsihoJmena = d => (d.casopis ? `${d.jmeno} (${nazevCasopisu(d.casopis)})` : d.jmeno);

// Barva časopisu z tabulky časopisů („#d81b60“); neznámý nebo bez barvy ''
export const barvaCasopisu = klic => casopisy.get(klic || VYCHOZI_CASOPIS)?.barva || '';

// Zápis v poli Role, který je titulem nebo místem publikace (PMOTM, Penthouse Pet, Centerfold, Cybergirl, Cover…),
// ne profesí; tituly se od 0.02.034 berou jen z galerií
const TITULOVY_ZAPIS = /playmate|\bpmo[mty]|\bpmotm|\bpet\b|\bpets\b|honey|centerfold|cyber ?girl|\bcoed|cover|ob[aá]lk|playboy|penthouse|hustler|\bmuses?\b|creator|online|speci[aá]l|of the (month|year)|měsíce|roku/i;
const PROFESE_JAKO = { model: 'Modelka', 'modelka': 'Modelka', actress: 'Herečka', singer: 'Zpěvačka', dancer: 'Tanečnice', 'porn actress': 'Pornoherečka', 'adult actress': 'Pornoherečka', 'pornstar': 'Pornoherečka', 'porn star': 'Pornoherečka', celebrity: 'Celebrita', celebrita: 'Celebrita' };

/**
 * Profese z pole Role (0.02.034): vše, co není titul ani místo publikace; „Model“ → „Modelka“, anglické názvy česky.
 * Modelka je vždy první (běžná profese každé modelky), další za ní v zapsaném pořadí.
 * @returns {string[]}
 */
export function profeseModelky(modelka) {
    const v = ['Modelka'];
    for (const kus of String(modelka.role || '').split(/[,;\n]/).map(k => k.trim()).filter(Boolean)) {
        if (TITULOVY_ZAPIS.test(kus) && !/bunny/i.test(kus)) continue; // Bunny je povolání v klubu, ne titul čísla
        const nazev = PROFESE_JAKO[normalizovat(kus)] || velkymPismenem(kus);
        if (!v.includes(nazev)) v.push(nazev);
    }
    return v;
}
const velkymPismenem = t => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Kariéra po časopisech (0.02.034), jednotně pro všechny: časopis a rok prvního vydání, pak role v časopise jen
 * z galerií – modelka měsíce (centerfold nebo pictorial s tím typem), modelka roku, obálka; jinak „Pictorial“.
 * Online alba patří Playboyi: „Cyber Girl …“ (album Cyber Girl), jinak „Online“; modelka jen online dostane skupinu
 * Playboy s rokem prvního online alba. Časopisy chronologicky podle prvního roku.
 * @returns {{ casopis: string, nazev: string, rok: string, role: string[] }[]}
 */
const nazevCasopisuKariery = c => casopisy.get(c)?.nazev || (c === VYCHOZI_CASOPIS ? 'Playboy' : c);
export function karieraPoCasopisech(modelka) {
    const cisla = [...(modelka.vydani || []), ...(modelka.obalky || []), ...(modelka.centerfoldy || []),
        ...String(modelka.pictorialVydani || '').split('\n')].map(v => v.trim()).filter(v => rozlozitVydani(v));
    const tituly = titulyJindeModelky(modelka);
    const vCasopise = (seznam, c) => (seznam || []).filter(v => rozlozitVydani(v)?.casopis === c);
    const skupiny = [];
    for (const c of new Set(cisla.map(v => rozlozitVydani(v).casopis))) {
        const role = [];
        const pb = c === VYCHOZI_CASOPIS;
        if (vCasopise(modelka.centerfoldy, c).length || (pb ? modelka.playmateMesice : tituly.some(t => t.nazev === titulCasopisu(c)))) role.push(titulCasopisu(c));
        const roku = pb ? (modelka.playmateRoku ? `Playmate roku${/^\d{4}$/.test(modelka.playmateRoku) ? ` ${modelka.playmateRoku}` : ''}` : '')
            : (t => (t ? `${t.nazev}${t.rok && t.rok !== '?' ? ` ${t.rok}` : ''}` : ''))(tituly.find(t => t.nazev === titulCasopisu(c, 'roku')));
        if (roku) role.push(roku);
        if (vCasopise(modelka.obalky, c).length) role.push('Obálka');
        if (!role.length) role.push('Pictorial');
        skupiny.push({ casopis: c, nazev: nazevCasopisuKariery(c), rok: cisla.filter(v => rozlozitVydani(v).casopis === c).map(v => v.slice(0, 4)).sort()[0], role });
    }
    const online = (modelka.onlineAlba || []).map(v => String(v).slice(0, 4)).filter(r => /^\d{4}$/.test(r)).sort();
    if (online.length || modelka.cyberGirl) {
        let pb = skupiny.find(s => s.casopis === VYCHOZI_CASOPIS);
        if (!pb) skupiny.push(pb = { casopis: VYCHOZI_CASOPIS, nazev: nazevCasopisuKariery(VYCHOZI_CASOPIS), rok: online[0] || '', role: [] });
        pb.role.push(modelka.cyberGirl ? `Cyber Girl ${modelka.cyberGirl}` : 'Online');
    }
    return skupiny.sort((a, b) => (a.rok || '9999').localeCompare(b.rok || '9999'));
}

/**
 * Štítky pod jménem v profilu (0.02.034), stejně pro všechny časopisy: za každý časopis „Playboy 2000“ a jeho role
 * (Playmate měsíce, Pet of the Month, Pictorial, Online…), pak profese z pole Role (Modelka, Herečka…).
 * @returns {{ text: string, druh: 'casopis' | 'role' | 'profese' }[]}
 */
export function stitkyModelky(modelka) {
    return [
        ...karieraPoCasopisech(modelka).flatMap(s => [{ text: [s.nazev, s.rok].filter(Boolean).join(' '), druh: /** @type {const} */ ('casopis') },
            ...s.role.map(text => ({ text, druh: /** @type {const} */ ('role') }))]),
        ...profeseModelky(modelka).map(text => ({ text, druh: /** @type {const} */ ('profese') })),
    ];
}

export function odvozeneKategorie(modelka) {
    return [
        (modelka.centerfoldy || []).some(jeCisloPlayboye) || modelka.playmateMesice ? 'Playmate měsíce' : '',
        modelka.playmateRoku ? 'Playmate roku' : '',
        ...titulyJindeModelky(modelka).map(t => t.nazev),
        modelka.cyberGirl ? 'Cyber Girl' : '',
        (modelka.obalky || []).length ? 'Modelka obálky' : '',
        (modelka.onlineAlba || []).length && !modelka.cyberGirl ? 'Online' : '',
    ].filter(Boolean);
}

// Páska online alb v rohu fotky, bez data: Cyber Girl má přednost, jinak „Online“ (Coed, Muse… zatím také)
export function paskaOnline(modelka) {
    return kategorieModelky(modelka).some(k => k.nazev === 'Cyber Girl') ? 'Cyber Girl' : 'Online';
}

// Výskyt modelky: v časopise (centerfold, obálka nebo album u konkrétního čísla – měsíc nebo speciál; ročník bez
// měsíce jako „Cybergirl of the Year 2012“ se nepočítá), jen online (bez čísla, s online kategorií nebo online
// albem) nebo neurčeno; stejně jako vyskyt: v hledání (poleHledani v app.go)
export const VYSKYT = { casopis: 'V časopise', online: 'Jen online', '': 'Neurčeno' };
export function vyskytModelky(modelka) {
    const cisla = [...(modelka.vydani || []), ...(modelka.obalky || []), ...(modelka.centerfoldy || [])];
    if (cisla.some(v => rozlozitVydani(v)?.mesic)) return 'casopis';
    // Jen z galerií (0.02.038): online album nebo album Cyber Girl, ne zápis v Roli
    return (modelka.onlineAlba || []).length || modelka.cyberGirl ? 'online' : '';
}

// Všechny kategorie modelky v pořadí seznamu (vlastní na konci); odvozená má příznak odvozena
// Od 0.02.038 jednotně se štítky profilu: tituly jen z galerií (odvozené), z Role jen profese
export function kategorieModelky(modelka) {
    const zapsane = rozlozitKategorie(modelka.role).filter(k => !TITULOVY_ZAPIS.test(k.nazev) || /bunny/i.test(k.nazev));
    odvozeneKategorie(modelka).forEach(nazev => {
        const rokJinde = titulyJindeModelky(modelka).find(t => t.nazev === nazev)?.rok;
        const detail = nazev === 'Cyber Girl' ? modelka.cyberGirl || ''
            : nazev === 'Playmate roku' && modelka.playmateRoku !== '?' ? modelka.playmateRoku || ''
                : rokJinde && rokJinde !== '?' ? rokJinde : '';
        if (!zapsane.some(k => k.nazev === nazev)) zapsane.push({ nazev, detail, zbytek: '', vlastni: false, odvozena: true });
    });
    // Titul jiného časopisu (Pet of the Month) hned za tituly Playboye
    const zaPlaymate = KATEGORIE.findIndex(z => z.nazev === 'Playmate roku') + 0.5;
    const poradi = k => {
        if (k.vlastni) return KATEGORIE.length;
        const i = KATEGORIE.findIndex(z => z.nazev === k.nazev);
        return i >= 0 ? i : k.odvozena ? zaPlaymate : KATEGORIE.length;
    };
    return zapsane.sort((a, b) => poradi(a) - poradi(b));
}

// Míry z amerických zdrojů. Samotné číslo se bere v centimetrech či kilogramech; null = nerozpoznáno.
// Výška: 5'7", 5′7″, 5 ft 7 in, 170 cm
export function prevestVysku(text) {
    const t = String(text || '').trim().replace(',', '.');
    if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t));
    const cm = /^(\d+(?:\.\d+)?)\s*cm$/i.exec(t);
    if (cm) return Math.round(parseFloat(cm[1]));
    const stopy = /^(\d)\s*(?:'|′|ft|feet)\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|″|''|in|inch|inches)?)?$/i.exec(t);
    if (stopy) return Math.round((parseInt(stopy[1]) * 12 + parseFloat(stopy[2] || '0')) * 2.54);
    return null;
}

// Váha: 115 lbs, 115 lb, 52 kg
export function prevestVahu(text) {
    const t = String(text || '').trim().replace(',', '.');
    if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t));
    const kg = /^(\d+(?:\.\d+)?)\s*kg$/i.exec(t);
    if (kg) return Math.round(parseFloat(kg[1]));
    const libry = /^(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)$/i.exec(t);
    if (libry) return Math.round(parseFloat(libry[1]) * 0.45359);
    return null;
}

// Míry „34B-24-34" nebo „86-61-86": obvody v centimetrech a velikost prsou.
// Hrudník pod 60 znamená, že jsou všechny tři v palcích.
export function rozlozitMiry(text) {
    const m = /^(\d{2,3})\s*([A-K]{1,3})?\s*[-–/x]\s*(\d{2,3})\s*[-–/x]\s*(\d{2,3})$/i.exec(String(text || '').trim());
    if (!m) return null;
    const palce = parseInt(m[1]) < 60;
    const naCm = n => palce ? Math.round(parseInt(n) * 2.54) : parseInt(n);
    return { hrudnik: naCm(m[1]), pas: naCm(m[3]), boky: naCm(m[4]), velikost: m[2] ? `${m[1]}${m[2].toUpperCase()}` : '' };
}

// Svislítko na nejvyšší úrovni (mimo uvozovky a závorky) dělí dotaz na alternativy (stejně jako hledani.go rozdelitNebo)
export function rozdelitNebo(s) {
    const casti = [];
    let hloubka = 0, uvozovky = false, od = 0;
    for (let i = 0; i < s.length; i++) {
        const z = s[i];
        if (z === '"') uvozovky = !uvozovky;
        else if (uvozovky) continue;
        else if (z === '(') hloubka++;
        else if (z === ')') { if (hloubka > 0) hloubka--; }
        else if (z === '|' && hloubka === 0) { casti.push(s.slice(od, i)); od = i + 1; }
    }
    casti.push(s.slice(od));
    return casti;
}

// Závorky na nejvyšší úrovni (i s - nebo ! před nimi) se vyjmou jako skupiny; neuzavřená sahá do konce
export function vyjmoutZavorky(s) {
    let zbytek = '';
    const skupiny = [];
    let uvozovky = false;
    for (let i = 0; i < s.length; i++) {
        const z = s[i];
        if (z === '"') uvozovky = !uvozovky;
        if (uvozovky || z !== '(') { zbytek += z; continue; }
        let negace = false;
        const t = zbytek.replace(/ +$/, '');
        if (/(^|\s)[-!]$/.test(t)) { negace = true; zbytek = t.slice(0, -1); }
        let hloubka = 1, uvnitr = false, j = i + 1;
        for (; j < s.length && hloubka > 0; j++) {
            if (s[j] === '"') uvnitr = !uvnitr;
            else if (uvnitr) continue;
            else if (s[j] === '(') hloubka++;
            else if (s[j] === ')') hloubka--;
        }
        skupiny.push({ negace, text: s.slice(i + 1, hloubka === 0 ? j - 1 : j) });
        zbytek += ' ';
        i = j - 1;
    }
    return { zbytek, skupiny };
}

// Token hledání pro frontendové filtrování (podporuje negaci -, čárku jako OR, rozsah let, mezeru za dvojtečkou a neuzavřené uvozovky).
// Svislítko a závorky (blond | zrzava, (rok:1970-1979 | rok:1980-1989) vyska:>175) dají token se skupinou:
// skupina = alternativy (každá je seznam tokenů, stačí jedna), text = původní zápis pro panel filtrů.
export function rozlozitDotaz(dotaz) {
    let d = String(dotaz || '').trim();
    if (!d) return [];
    if ((d.match(/"/g) || []).length % 2 !== 0) d += '"';
    const alternativy = rozdelitNebo(d);
    if (alternativy.length > 1) {
        const skupina = alternativy.map(a => rozlozitDotaz(a)).filter(t => t.length);
        if (!skupina.length) return [];
        if (skupina.length === 1) return skupina[0];
        return [tokenSkupiny(false, skupina, d)];
    }
    const { zbytek, skupiny } = vyjmoutZavorky(d);
    const tokeny = rozlozitSlova(zbytek);
    for (const z of skupiny) {
        const vnitrek = rozlozitDotaz(z.text);
        if (vnitrek.length) tokeny.push(tokenSkupiny(z.negace, [vnitrek], `${z.negace ? '-' : ''}(${z.text.trim()})`));
    }
    return tokeny;
}
const tokenSkupiny = (negace, skupina, text) => ({ negace, klic: '', hodnota: '', varianty: [], surove: [], skupina, text });
// Všechny tokeny i uvnitř skupin (které příkazy dotaz používá)
export const plocheTokeny = tokeny => tokeny.flatMap(t => t.skupina ? [t, ...t.skupina.flatMap(plocheTokeny)] : [t]);

function rozlozitSlova(d) {
    // Stejný vzor jako backend (hledani.go, vzorSlovaHledani): klíč s hodnotou (porovnání čísla i desetinného,
    // seznam NEBO přes čárku, každá hodnota i v uvozovkách), fráze v uvozovkách, samostatné slovo
    const vzor = /(-|!)?([\p{L}]+):\s*((?:>=|<=|==|>|<|=)\s*\d+(?:[.,]\d+)?|(?:"[^"]*"|[^\s",:]+)(?:\s*,\s*(?:"[^"]*"|[^\s",:]+))*)?|(-|!)?"([^"]*)"|(\S+)/gu;
    const tokeny = [];
    let shoda;
    while ((shoda = vzor.exec(d)) !== null) {
        let negace = false;
        let klic = '';
        let hodnota = '';
        if (shoda[2]) {
            negace = Boolean(shoda[1]);
            klic = shoda[2];
            hodnota = shoda[3] || '';
        } else if (shoda[5] !== undefined) {
            negace = Boolean(shoda[4]);
            hodnota = shoda[5];
        } else if (shoda[6]) {
            let slovo = shoda[6];
            if (slovo.startsWith('-') || slovo.startsWith('!')) {
                negace = true;
                slovo = slovo.slice(1);
            }
            const i = slovo.indexOf(':');
            if (i > 0) {
                klic = slovo.slice(0, i);
                hodnota = slovo.slice(i + 1);
            } else {
                hodnota = slovo;
            }
        }
        // Uvozovky jen ohraničují hodnoty (i jednotlivé v seznamu NEBO), do hodnoty nepatří
        hodnota = hodnota.replace(/"/g, '').trim();
        if (!hodnota) continue;
        const surove = hodnota.split(',').map(v => v.trim()).filter(Boolean);
        const varianty = surove.map(v => bezDiakritiky(v));
        // surove = hodnoty tak, jak je uživatel napsal (štítky filtru je ukazují; porovnává se bez diakritiky)
        tokeny.push({ negace, klic: bezDiakritiky(klic), hodnota: bezDiakritiky(hodnota), varianty, surove });
    }
    return tokeny;
}

// Klíče cíleného hledání, které zná backend (hledání modelek). Pohled, který daný údaj nemá (vlasy na stěně
// centerfoldů), slovo s takovým klíčem nic neomezuje; neznámý klíč se hledá jako text „klic:hodnota“.
const ZNAME_KLICE = new Set(['foto', 'obsah', 'jmeno', 'vlasy', 'oci', 'narodnost', 'etnicita', 'misto', 'tag', 'tagy', 'role', 'kategorie', 'vyskyt', 'fotograf',
    'rok', 'vydani', 'narozena', 'edice', 'casopis', 'prsa', 'ochlupeni', 'poznamka', 'vyska', 'vaha', 'miry', 'hodnoceni', 'srdicka',
    'tetovani', 'piercing', 'obalka', 'obalky', 'umrti', 'zemrela', 'nafoceno', 'pas', 'hrudnik', 'boky', 'bmi', 'whr', 'vek', 'fotek']);
const jeCislo = text => /^[\d.\-]+$/.test(text);
const CISELNA_POLE = new Set(['rok', 'narozena', 'vyska', 'vaha', 'hodnoceni', 'srdicka', 'pas', 'hrudnik', 'boky', 'bmi', 'whr', 'vek', 'fotek']);
// Pole s desetinnou hodnotou (chytré hledání, internal/hledani DesetinnaHodnota): přesná hodnota s přesností zadaného čísla
const DESETINNA_POLE = new Set(['pas', 'hrudnik', 'boky', 'bmi', 'whr', 'vek', 'fotek']);

// Číslo z textu vyhovuje rozsahu (1970..1979, 1970-1979) nebo porovnání (>=1970, >175); null = hodnota není číselná.
// Bez cíleného pole se porovnávají jen čtyřmístné roky, v cíleném poli všechna čísla.
function vyhovujeCislu(hodnota, texty, cilene, roky = false, desetinne = false) {
    if (desetinne) return vyhovujeDesetinnemu(hodnota, texty);
    const rozsah = cilene && !roky ? /^(\d+)\s*(?:\.\.|-)\s*(\d+)$/.exec(hodnota) : /^(\d{4})\s*(?:\.\.|-)\s*(\d{4})$/.exec(hodnota);
    const porovnani = cilene ? /^(>=|<=|>|<|==|=)\s*(\d+)$/.exec(hodnota) : /^(>=|<=|>|<|==|=)\s*(\d{4})$/.exec(hodnota);
    if (!rozsah && !porovnani) return null;
    const cisla = texty.flatMap(txt => (txt.match(cilene ? /\d+/g : /\b\d{4}\b/g) || []).map(Number));
    if (rozsah) {
        const [od, doR] = [Number(rozsah[1]), Number(rozsah[2])].sort((x, y) => x - y);
        return cisla.some(c => c >= od && c <= doR);
    }
    const [, op, cil] = porovnani;
    return cisla.some(c => op === '>=' ? c >= +cil : op === '<=' ? c <= +cil : op === '>' ? c > +cil : op === '<' ? c < +cil : c === +cil);
}

// Desetinné pole (bmi:<18,5, whr:0,65-0,72, pas:60) stejně jako backend (parsovatDesetinnyFiltr); prázdný údaj nevyhovuje
function vyhovujeDesetinnemu(hodnota, texty) {
    const h = String(hodnota || '').replace(/\s+/g, '');
    const cislo = t => /^\d+(?:[.,]\d+)?$/.test(t) ? parseFloat(t.replace(',', '.')) : null;
    const x = texty[0] === '' || texty[0] === undefined ? null : parseFloat(texty[0]);
    if (x === null || Number.isNaN(x)) return false;
    const eps = 1e-9;
    const op = ['>=', '<=', '==', '>', '<', '='].find(o => h.startsWith(o));
    if (op) {
        const n = cislo(h.slice(op.length));
        if (n === null) return null;
        return op === '>=' ? x >= n - eps : op === '<=' ? x <= n + eps : op === '>' ? x > n + eps : op === '<' ? x < n - eps : presne(x, n);
    }
    for (const oddelovac of ['..', '-']) {
        const casti = h.split(oddelovac);
        if (casti.length === 2 && cislo(casti[0]) !== null && cislo(casti[1]) !== null) {
            const [od, po] = [cislo(casti[0]), cislo(casti[1])].sort((a, b) => a - b);
            return x >= od - eps && x <= po + eps;
        }
    }
    const n = cislo(h);
    return n === null ? null : presne(x, n);
}
// Přesná hodnota s přesností zadaného čísla: 18 = 18,0–18,99…, 0,7 = 0,70–0,79…
const presne = (x, n) => {
    const p = [1, 0.1, 0.01, 0.001].find(q => Math.abs(n / q - Math.round(n / q)) < 1e-6) ?? 0.0001;
    return x >= n - 1e-9 && x < n + p;
};

// Filtr srdíček stejně jako backend (hledani.go, parsovatFiltrHodnoceni), v polovinách srdíčka: hodnoceni:4 (přesně 4),
// hodnoceni:3,5 (3½), hodnoceni:>=3,5, hodnoceni:3..4, hodnoceni:3,4 (3 nebo 4); null = hodnota není srdíčková
export function filtrHodnoceni(hodnota) {
    const h = String(hodnota || '').replace(/\s+/g, '');
    const pul = (text) => /^\d+(?:[.,]\d+)?$/.test(text) ? Math.round(parseFloat(text.replace(',', '.')) * 2) : null;
    for (const op of ['>=', '<=', '==', '>', '<', '=']) {
        if (!h.startsWith(op)) continue;
        const n = pul(h.slice(op.length));
        return n === null ? null : [{ op: op === '==' ? '=' : op, od: n }];
    }
    for (const oddelovac of ['..', '-']) {
        const casti = h.split(oddelovac);
        if (casti.length !== 2) continue;
        const [od, po] = casti.map(pul);
        if (od !== null && po !== null) return [{ op: '..', od: Math.min(od, po), do: Math.max(od, po) }];
    }
    if (/^\d[.,][05]$/.test(h)) return [{ op: '=', od: pul(h) }];
    const filtry = [];
    for (const cast of h.split(',').filter(Boolean)) {
        const n = pul(cast);
        if (n === null) return null;
        filtry.push({ op: '=', od: n });
    }
    return filtry.length ? filtry : null;
}
export const vyhovujeSrdickum = (n, filtry) => filtry.some(({ op, od, do: po }) => op === '>=' ? n >= od : op === '<=' ? n <= od
    : op === '>' ? n > od : op === '<' ? n < od : op === '..' ? n >= od && n <= po : n === od);

// Časopis čísla pro hledání casopis: (0.02.019): název a zkratka („penthouse ph“); album, které není číslem, nic
export function textCasopisu(vydani) {
    const c = rozlozitVydani(vydani)?.casopis;
    if (!c) return '';
    return `${nazevCasopisu(c) === c && c === VYCHOZI_CASOPIS ? 'Playboy' : nazevCasopisu(c)} ${c}`;
}

// Údaje fotky pro cílené hledání (stěna centerfoldů, Nejlepší): jméno, fotograf, vydání, rok, edice, srdíčka
// a datum nafocení online alba
export function poleFotky(f) {
    const vydani = f.vydani || (rozlozitVydani(f.album) ? f.album : '');
    return {
        jmeno: f.jmenoModelky || '', fotograf: f.fotograf || '', vydani, rok: vydani.slice(0, 4),
        edice: rozlozitVydani(vydani)?.edice || '', casopis: textCasopisu(vydani), hodnoceni: f.hodnoceni ? String(f.hodnoceni) : '', srdicka: f.hodnoceni ? String(f.hodnoceni) : '',
        nafoceno: f.datumAlba || '',
    };
}

// Údaje modelky pro cílené hledání ve fotkách (stěna, Nejlepší): vzhled, míry, příznaky, kategorie a věk v prvním
// čísle stejně jako backend (internal/hledani hodnotaPole, DesetinnaHodnota); m = modelka fotky, nebo nic
export function poleModelkyFotky(m) {
    if (!m) return {};
    const anoNe = h => (h === 1 ? 'ano yes' : h === 0 ? 'ne no' : '');
    const kladne = n => (n > 0 ? String(n) : '');
    const bmi = m.vyskaCm > 0 && m.vahaKg > 0 ? String(m.vahaKg / (m.vyskaCm / 100) ** 2) : '';
    const whr = m.obvodPasCm > 0 && m.obvodBokyCm > 0 ? String(m.obvodPasCm / m.obvodBokyCm) : '';
    return {
        vlasy: m.vlasyBarva || '', oci: m.ociBarva || '', narodnost: m.narodnost || '', prsa: `${m.velikostPrsou || ''} ${m.prsaTyp || ''}`.trim(),
        ochlupeni: m.ochlupeni || '', tetovani: anoNe(m.tetovani), piercing: anoNe(m.piercing), kategorie: kategorieModelky(m).map(k => k.nazev).join(', '),
        vyska: kladne(m.vyskaCm), vaha: kladne(m.vahaKg), pas: kladne(m.obvodPasCm), hrudnik: kladne(m.obvodHrudnikCm), boky: kladne(m.obvodBokyCm),
        bmi, whr, vek: String(vekVPrvnimCisle(m) ?? ''), fotek: String(m.pocetFotek ?? 0),
    };
}
// Jen číselné údaje modelky (obvody, BMI, poměr pas : boky, věk v prvním čísle, počet fotek) pro panel Filtry
export const poleCiselModelky = m => {
    const { pas, hrudnik, boky, bmi, whr, vek, fotek } = poleModelkyFotky(m);
    return { pas, hrudnik, boky, bmi, whr, vek, fotek };
};
// Věk v nejstarším čísle (jako backend VekVPrvnimCisle); null bez narození nebo čísla
export function vekVPrvnimCisle(m) {
    const n = /^(\d{4})(?:-(\d{2}))?/.exec(m?.narozeniDatum || '');
    const prvni = (m?.vydani || []).filter(v => /^\d{4}/.test(v)).sort()[0];
    if (!n || !prvni) return null;
    const v = /^(\d{4})(?:-(\d{2}))?/.exec(prvni);
    let vek = Number(v[1]) - Number(n[1]);
    if (n[2] && v[2] && Number(v[2]) < Number(n[2])) vek--;
    return vek > 10 && vek < 100 ? vek : null;
}

// Cílené příkazy dotazu, které pohled nezná (vlasy: na Číslech): nic neomezují, pohled to ve stavové liště řekne.
// pole = údaje pohledu pro cílené hledání (poleFotky, poleCisla); srdicka: je totéž co hodnoceni:
export function nepouziteKlice(tokeny, pole) {
    const zna = new Set(Object.keys(pole));
    if (zna.has('hodnoceni')) zna.add('srdicka');
    return [...new Set(plocheTokeny(tokeny).filter(t => t.klic && ZNAME_KLICE.has(t.klic) && !zna.has(t.klic)).map(t => `${t.klic}:`))];
}
// Varování do řádku voleb (ui/volby.js ho přesune vpravo do stavové lišty)
export const htmlVarovaniHledani = (klice) => klice.length
    ? `<button type="button" class="volby-varovani" title="Tento přehled údaj nezná, příkaz se tu přeskočí">⚠ ${esc(klice.join(' '))} tady nefiltruje</button>` : '';

// Údaje čísla časopisu pro cílené hledání (Čísla, Kalendář, našeptávač)
export const poleCisla = (vydani, modelka = '') => ({ jmeno: modelka, vydani, rok: vydani.slice(0, 4), edice: rozlozitVydani(vydani)?.edice || '', casopis: textCasopisu(vydani) });

// Ověří, zda texty položky odpovídají tokenům hledání: AND mezi tokeny, OR přes čárku, negace -, rozsahy a porovnání čísel.
// pole = údaje pro cílené hledání ({ jmeno, fotograf, rok, … }); slovo s klíčem se hledá jen v daném údaji,
// bez nich ve všech textech.
// Překlepy se tolerují jen u hledaných slov s písmeny (ne u čísel a vylučovaných slov) a jen ve jméně a fotografovi,
// pokud je pohled zná, jinak ve všech textech.
export function vyhovujeHledani(texty, tokeny, pole = {}) {
    if (!tokeny.length) return true;
    const vse = texty.filter(Boolean).map(t => bezDiakritiky(t));
    const udaje = Object.fromEntries(Object.entries(pole).map(([k, v]) => [k, bezDiakritiky(v || '')]));
    const jmenaAFotografove = 'jmeno' in udaje || 'fotograf' in udaje ? [udaje.jmeno, udaje.fotograf].filter(Boolean) : vse;
    for (const t of tokeny) {
        if (t.skupina) {
            let shoda = t.skupina.some(alt => vyhovujeHledani(texty, alt, pole));
            if (t.negace) shoda = !shoda;
            if (!shoda) return false;
            continue;
        }
        // Obsah fotek slovy umí jen backend (Galerie modelek); jinde podmínka nic neomezuje
        if ((t.klic === 'foto' || t.klic === 'obsah') && !(t.klic in pole)) continue;
        let kde = vse;
        let proPreklepy = jmenaAFotografove;
        let hledane = t.varianty;
        // Bez údajů pohledu (pole = {}) se cílené slovo hledá ve všech textech
        if (t.klic && Object.keys(udaje).length) {
            if (t.klic in udaje) {
                kde = [udaje[t.klic]];
                proPreklepy = t.klic === 'jmeno' || t.klic === 'fotograf' ? kde : [];
            } else if (ZNAME_KLICE.has(t.klic)) {
                continue;
            } else {
                hledane = [`${t.klic}:${t.hodnota}`];
                proPreklepy = [];
            }
        }
        // rok:1975-01 = číslo z daného měsíce (hledá se ve vydání)
        if (t.klic === 'rok' && /^\d{4}-/.test(t.hodnota) && 'vydani' in udaje) kde = [udaje.vydani];
        // Srdíčka po polovinách stejně jako v backendu (hodnoceni:>=3,5, hodnoceni:4 = přesně 4)
        if ((t.klic === 'hodnoceni' || t.klic === 'srdicka') && kde !== vse) {
            const filtry = filtrHodnoceni(t.hodnota);
            if (filtry) {
                let shoda = vyhovujeSrdickum(Math.round(Number(kde[0] || 0) * 2), filtry);
                if (t.negace) shoda = !shoda;
                if (!shoda) return false;
                continue;
            }
        }
        // nafoceno:2004, nafoceno:2004-06 = předpona data nafocení online alba (stejně jako v app.go)
        if (t.klic === 'nafoceno' && 'nafoceno' in udaje) {
            let shoda = hledane.some(v => udaje.nafoceno.split(' ').some(d => d && d.startsWith(v)));
            if (t.negace) shoda = !shoda;
            if (!shoda) return false;
            continue;
        }
        // Čísla se porovnávají jen v číselných polích; vydani:1975-01 je text, u roků rozsah jen se čtyřmístnými mezemi
        const cilene = kde !== vse;
        let shoda = cilene && !CISELNA_POLE.has(t.klic) ? null : vyhovujeCislu(t.hodnota, kde, cilene, t.klic === 'rok' || t.klic === 'narozena', cilene && DESETINNA_POLE.has(t.klic));
        if (shoda === null) {
            shoda = hledane.some(v => kde.some(txt => txt.includes(v))
                || (!t.negace && !jeCislo(v) && proPreklepy.some(txt => odpovidaTextFuzzy(txt, v))));
        }
        if (t.negace) shoda = !shoda;
        if (!shoda) return false;
    }
    return true;
}

// Levenshteinova vzdálenost mezi dvěma řetězci (počet vložení, smazání a záměn)
export function vzdalenostLevenshtein(s1, s2) {
    const a = [...String(s1 || '')];
    const b = [...String(s2 || '')];
    const lenA = a.length, lenB = b.length;
    if (!lenA) return lenB;
    if (!lenB) return lenA;
    const predchozi = new Array(lenB + 1);
    const aktualni = new Array(lenB + 1);
    for (let j = 0; j <= lenB; j++) predchozi[j] = j;
    for (let i = 1; i <= lenA; i++) {
        aktualni[0] = i;
        for (let j = 1; j <= lenB; j++) {
            const cena = a[i - 1] === b[j - 1] ? 0 : 1;
            aktualni[j] = Math.min(predchozi[j] + 1, aktualni[j - 1] + 1, predchozi[j - 1] + cena);
        }
        for (let j = 0; j <= lenB; j++) predchozi[j] = aktualni[j];
    }
    return aktualni[lenB];
}

// Maximální povolená editační vzdálenost podle délky hledaného slova (max 1–2 překlepy pro jména a fotografy)
export function maxPovolenaVzdalenost(delka) {
    if (delka <= 3) return 0;
    if (delka <= 6) return 1;
    return 2;
}

// Ověří, zda hledaný dotaz (i víceslovný) odpovídá textu (přesně nebo fuzzy Levenshteinem)
export function odpovidaTextFuzzy(text, hledanyDotaz) {
    const hledane = bezDiakritiky(hledanyDotaz).split(/\s+/).filter(Boolean);
    if (!hledane.length) return true;
    const slovaTextu = bezDiakritiky(text).split(/\s+/).filter(Boolean);
    for (const h of hledane) {
        const maxD = maxPovolenaVzdalenost(h.length);
        const shoda = slovaTextu.some(s => s.includes(h) || (maxD > 0 && Math.abs(s.length - h.length) <= maxD && vzdalenostLevenshtein(s, h) <= maxD));
        if (!shoda) return false;
    }
    return true;
}

// Podporované příkazy vyhledávání s popisem
export const PRIKAZY = [
    { klic: 'vlasy:', popis: 'Barva vlasů (blond, hnědá, černá, zrzavá…)' },
    { klic: 'vydani:', popis: 'Vydání časopisu (např. 1975-05, 1995-03-CZ)' },
    { klic: 'vyska:', popis: 'Výška modelky v cm (>175, 170..180)' },
    { klic: 'vaha:', popis: 'Váha modelky v kg' },
    { klic: 'tag:', popis: 'Tag ze sbírky (playmate, cyb…)' },
    { klic: 'rok:', popis: 'Rok vydání (1970..1979, >=1980)' },
    { klic: 'kategorie:', popis: 'Kategorie (playmate, cyber girl, muse, celebrita…)' },
    { klic: 'vyskyt:', popis: 'Výskyt: casopis, online (jen na internetu), neurceno' },
    { klic: 'nafoceno:', popis: 'Kdy bylo online album nafoceno (2004, 2004-06)' },
    { klic: 'fotograf:', popis: 'Jméno fotografa' },
    { klic: 'foto:', popis: 'Co je na fotkách, slovy (foto:"na pláži v bílém"); řadí podle shody' },
    { klic: 'hodnoceni:', popis: 'Hodnocení (1–5 i půlky 3,5; >=4)' },
    { klic: 'srdicka:', popis: 'Hodnocení srdíčky (5, >=4)' },
    { klic: 'narodnost:', popis: 'Národnost modelky' },
    { klic: 'casopis:', popis: 'Časopis (playboy, penthouse, hustler nebo pb, ph, hu)' },
    { klic: 'edice:', popis: 'Edice časopisu (US, CZ)' },
    { klic: 'narozena:', popis: 'Rok nebo datum narození' },
    { klic: 'misto:', popis: 'Místo narození' },
    { klic: 'oci:', popis: 'Barva očí' },
    { klic: 'prsa:', popis: 'Velikost a typ poprsí' },
    { klic: 'miry:', popis: 'Míry postavy (90-60-90)' },
    { klic: 'tetovani:', popis: 'Tetování (ano / ne)' },
    { klic: 'piercing:', popis: 'Piercing (ano / ne)' },
    { klic: 'obalka:', popis: 'Obálka čísla' },
    { klic: 'jmeno:', popis: 'Jméno nebo pseudonym' },
    { klic: 'poznamka:', popis: 'Poznámka' },
    { klic: 'pas:', popis: 'Obvod pasu v cm (<=60)' },
    { klic: 'hrudnik:', popis: 'Obvod hrudníku v cm' },
    { klic: 'boky:', popis: 'Obvod boků v cm' },
    { klic: 'bmi:', popis: 'BMI (<18,5, 18..20)' },
    { klic: 'whr:', popis: 'Poměr pas : boky (<0,7)' },
    { klic: 'vek:', popis: 'Věk v prvním čísle (<21, 18-20)' },
    { klic: 'fotek:', popis: 'Počet fotek (0 = bez fotek, >50)' },
];


