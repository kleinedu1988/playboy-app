// Čisté funkce pro texty a data: nesahají na stránku ani na backend, proto jdou testovat samostatně

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
    const cisty = String(text || '').replace(/^\s*(#{1,3}|>|[-*•–]|\d+\.)\s+/gm, '').replace(/\*\*|__|~~|[*`]/g, '');
    return { slov: (cisty.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length, znaku: cisty.replace(/\s/g, '').length };
}

// Anglické názvy k výběru měsíce („Červen (June)“), americké zdroje píšou čísla anglicky
export const MESICE_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const moznostiMesicu = () => MESICE.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m} (${MESICE_EN[i]})</option>`).join('');

// Edice časopisu; výchozí (US) se do vydání nepíše, ostatní mají příponu: 2009-11-CZ
export const EDICE = ['US', 'CZ'];
export const VYCHOZI_EDICE = 'US';

// Měsíční řady edic. Americká: od 12/1953 (první číslo, Marilyn Monroe) do 03/2020 (Spring 2020, poslední
// pravidelné číslo); od 2025 vychází jen jako ročenka a čtvrtletník a ta čísla se evidují jako speciály.
// Česká: od 07/2011. Mimo řadu jsou ještě jednotlivá čísla, která nevyšla (americké z března 1955).
// Měsíc mimo řadu se v kalendáři, ročníku a mapě edice neukazuje jako chybějící a nedá se přidat ani označit.
export const RADY_EDIC = { US: { od: '1953-12', do: '2020-03' }, CZ: { od: '2011-07', do: '' } };
export const NEVYSLA_CISLA = new Set(['1955-03']);
export function cisloNevyslo(klic) {
    const v = rozlozitVydani(klic);
    if (!v || !/^\d\d$/.test(v.mesic)) return false;
    if (NEVYSLA_CISLA.has(klic)) return true;
    const rada = RADY_EDIC[v.edice];
    const mesic = `${v.rok}-${v.mesic}`;
    return Boolean(rada && (mesic < rada.od || (rada.do && mesic > rada.do)));
}
// Kolik měsíčních čísel ročník edice měl (12 bez těch, která nevyšla)
export function ciselRocniku(rok, edice) {
    return 12 - MESICE.filter((_, i) => cisloNevyslo(slozitVydani(String(rok), String(i + 1).padStart(2, '0'), edice))).length;
}

// „2009-11-CZ" → { rok: '2009', mesic: '11', edice: 'CZ' }; ročník bez měsíce má mesic ''; neplatné → null.
// Speciál (zvláštní číslo mimo měsíční řadu) má místo měsíce pořadí v roce: „1995-S01" → mesic 'S01'.
export function rozlozitVydani(text) {
    const casti = /^(\d{4})(?:-(0[1-9]|1[0-2]|S\d{2}))?(?:-([A-Z]{2}))?$/.exec(text || '');
    return casti ? { rok: casti[1], mesic: casti[2] || '', edice: casti[3] || VYCHOZI_EDICE } : null;
}

export function slozitVydani(rok, mesic, edice) {
    if (!rok) return '';
    return [rok, mesic, edice && edice !== VYCHOZI_EDICE ? edice : ''].filter(Boolean).join('-');
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
    return (v.mesic ? `${nazevCasti(vydani, v)} ${v.rok}` : v.rok) + (v.edice !== VYCHOZI_EDICE ? ` · ${v.edice}` : '');
}

// Páska čísla (dlaždice Čísel, levý panel profilu a čísla): „BŘE 95“, u speciálu „SPECIÁL 95“, u ročníku „ROČNÍK 95“, u jiné edice „… · CZ“
export const ZKRATKY_PASKY = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
export function paskaCisla(vydani) {
    const v = rozlozitVydani(vydani);
    if (!v) return '';
    const rok = v.rok.slice(2);
    const edice = v.edice && v.edice !== VYCHOZI_EDICE ? ` · ${v.edice}` : '';
    if (!v.mesic) return `Ročník ${rok}${edice}`;
    if (v.mesic.startsWith('S')) return `Speciál ${rok}${edice}`;
    return `${ZKRATKY_PASKY[parseInt(v.mesic) - 1]} ${rok}${edice}`;
}

// Adresa obrázku v požadované velikosti; šablonu adresy (s {velikost}) skládá backend
export function obrazek(adresa, velikost) {
    return String(adresa || '').replace('{velikost}', velikost);
}

// Album centerfoldu a coveru je uložené jako vydání časopisu; zobrazuje se jako vydání
// Řazení galerie: abecedně, naposledy přidané, podle roku prvního vydání, podle srdíček, podle počtu fotek; modelky bez údaje jdou na konec
export const RAZENI_GALERIE = {
    jmeno: { popisek: 'A–Z', nazev: 'abecedně' },
    pridano: { popisek: 'Nově přidané', nazev: 'naposledy přidané' },
    rok: { popisek: 'Podle roku', nazev: 'podle roku prvního vydání' },
    hodnoceni: { popisek: 'Podle srdíček', nazev: 'podle hodnocení' },
    fotky: { popisek: 'Podle fotek', nazev: 'podle počtu fotek' },
};

export function prvniRok(modelka) {
    const roky = (modelka.vydani || []).map(v => parseInt(String(v).slice(0, 4))).filter(r => r > 0);
    return roky.length ? Math.min(...roky) : 0;
}

export function seraditModelky(modelky, razeni) {
    const vysledek = [...modelky];
    if (razeni === 'pridano') vysledek.sort((a, b) => (b.pridano || '').localeCompare(a.pridano || ''));
    else if (razeni === 'rok') vysledek.sort((a, b) => (prvniRok(a) || 9999) - (prvniRok(b) || 9999));
    else if (razeni === 'hodnoceni') vysledek.sort((a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0));
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
        return modelka.hodnoceni > 0 ? '♥'.repeat(modelka.hodnoceni) : 'Bez srdíček';
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
export function popisTypuAlba(typ, datum) {
    const obdobi = obdobiCyberGirl(typ, datum);
    if (obdobi) return `${typ} · ${obdobi}${/^\d{4}-\d{2}-\d{2}$/.test(datum) ? ` (nafoceno ${formatDatum(datum)})` : ''}`;
    return jeOnline(typ) && datum ? `${typ} · nafoceno ${formatDatum(datum)}` : typ;
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

// Celý text na HTML: odstavce, nadpisy (# až ###), citace (>), odrážkové (*, -) a číslované (1.) seznamy
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

        // Nadpisy: #, ##, ###
        const mNadpis = /^(#{1,3})\s+(.*)$/.exec(t);
        if (mNadpis) {
            ukoncit();
            const u = mNadpis[1].length === 1 ? 3 : mNadpis[1].length === 2 ? 4 : 5;
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
export const bezDiakritiky = text => String(text || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[łøđßæœþı]/g, z => ZVLASTNI_PISMENA[z]);
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

// Kategorie odvozené z dat: centerfold = Playmate měsíce, obálka = Modelka obálky, online album = Cyber Girl
// (jen když modelka nemá zapsanou jinou online kategorii, třeba Coed nebo Muse); album Cyber Girl týdne vždy
export function odvozeneKategorie(modelka) {
    return [
        (modelka.centerfoldy || []).length ? 'Playmate měsíce' : '',
        modelka.cyberGirl || (modelka.onlineAlba || []).length && !onlineKategorie(modelka) ? 'Cyber Girl' : '',
        (modelka.obalky || []).length ? 'Modelka obálky' : '',
    ].filter(Boolean);
}

// První zapsaná online kategorie modelky (Cyber Girl, Coed, Muse…), nebo undefined
export function onlineKategorie(modelka) {
    const online = new Set(KATEGORIE.filter(k => k.online).map(k => k.nazev));
    return rozlozitKategorie(modelka.role).find(k => online.has(k.nazev));
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
    return (modelka.onlineAlba || []).length || onlineKategorie(modelka) ? 'online' : '';
}

// Všechny kategorie modelky v pořadí seznamu (vlastní na konci); odvozená má příznak odvozena
export function kategorieModelky(modelka) {
    const zapsane = rozlozitKategorie(modelka.role);
    odvozeneKategorie(modelka).forEach(nazev => {
        const detail = nazev === 'Cyber Girl' ? modelka.cyberGirl || '' : '';
        if (!zapsane.some(k => k.nazev === nazev)) zapsane.push({ nazev, detail, zbytek: '', vlastni: false, odvozena: true });
    });
    const poradi = k => k.vlastni ? KATEGORIE.length : KATEGORIE.findIndex(z => z.nazev === k.nazev);
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

// Token hledání pro frontendové filtrování (podporuje negaci -, čárku jako OR, rozsah let, mezeru za dvojtečkou a neuzavřené uvozovky)
export function rozlozitDotaz(dotaz) {
    let d = String(dotaz || '').trim();
    if (!d) return [];
    if ((d.match(/"/g) || []).length % 2 !== 0) d += '"';
    const vzor = /(-|!)?([\p{L}]+):\s*"([^"]*)"|(-|!)?([\p{L}]+):\s*((?:>=|<=|==|>|<|=)\s*\d+|[^\s",:]+(?:\s*,\s*[^\s",:]+)*)?|(-|!)?"([^"]*)"|(\S+)/gu;
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
        } else if (shoda[5]) {
            negace = Boolean(shoda[4]);
            klic = shoda[5];
            hodnota = shoda[6] || '';
        } else if (shoda[8] !== undefined) {
            negace = Boolean(shoda[7]);
            hodnota = shoda[8];
        } else if (shoda[9]) {
            let slovo = shoda[9];
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
        hodnota = hodnota.replace(/^"|"$/g, '').trim();
        if (!hodnota) continue;
        const varianty = hodnota.split(',').map(v => bezDiakritiky(v.trim())).filter(Boolean);
        tokeny.push({ negace, klic: bezDiakritiky(klic), hodnota: bezDiakritiky(hodnota), varianty });
    }
    return tokeny;
}

// Klíče cíleného hledání, které zná backend (hledání modelek). Pohled, který daný údaj nemá (vlasy na stěně
// centerfoldů), slovo s takovým klíčem nic neomezuje; neznámý klíč se hledá jako text „klic:hodnota“.
const ZNAME_KLICE = new Set(['jmeno', 'vlasy', 'oci', 'narodnost', 'etnicita', 'misto', 'tag', 'tagy', 'role', 'kategorie', 'vyskyt', 'fotograf',
    'rok', 'vydani', 'narozena', 'edice', 'prsa', 'ochlupeni', 'poznamka', 'vyska', 'vaha', 'miry', 'hodnoceni', 'srdicka',
    'tetovani', 'piercing', 'obalka', 'obalky', 'umrti', 'zemrela', 'nafoceno']);
const jeCislo = text => /^[\d.\-]+$/.test(text);
const CISELNA_POLE = new Set(['rok', 'narozena', 'vyska', 'vaha', 'hodnoceni', 'srdicka']);

// Číslo z textu vyhovuje rozsahu (1970..1979, 1970-1979) nebo porovnání (>=1970, >175); null = hodnota není číselná.
// Bez cíleného pole se porovnávají jen čtyřmístné roky, v cíleném poli všechna čísla.
function vyhovujeCislu(hodnota, texty, cilene, roky = false) {
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

// Údaje fotky pro cílené hledání (stěna centerfoldů, Nejlepší): jméno, fotograf, vydání, rok, edice, srdíčka
// a datum nafocení online alba
export function poleFotky(f) {
    const vydani = f.vydani || (rozlozitVydani(f.album) ? f.album : '');
    return {
        jmeno: f.jmenoModelky || '', fotograf: f.fotograf || '', vydani, rok: vydani.slice(0, 4),
        edice: rozlozitVydani(vydani)?.edice || '', hodnoceni: f.hodnoceni ? String(f.hodnoceni) : '', srdicka: f.hodnoceni ? String(f.hodnoceni) : '',
        nafoceno: f.datumAlba || '',
    };
}

// Údaje čísla časopisu pro cílené hledání (Čísla, Kalendář, našeptávač)
export const poleCisla = (vydani, modelka = '') => ({ jmeno: modelka, vydani, rok: vydani.slice(0, 4), edice: rozlozitVydani(vydani)?.edice || '' });

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
        // nafoceno:2004, nafoceno:2004-06 = předpona data nafocení online alba (stejně jako v app.go)
        if (t.klic === 'nafoceno' && 'nafoceno' in udaje) {
            let shoda = hledane.some(v => udaje.nafoceno.split(' ').some(d => d && d.startsWith(v)));
            if (t.negace) shoda = !shoda;
            if (!shoda) return false;
            continue;
        }
        // Čísla se porovnávají jen v číselných polích; vydani:1975-01 je text, u roků rozsah jen se čtyřmístnými mezemi
        const cilene = kde !== vse;
        let shoda = cilene && !CISELNA_POLE.has(t.klic) ? null : vyhovujeCislu(t.hodnota, kde, cilene, t.klic === 'rok' || t.klic === 'narozena');
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
        const shoda = slovaTextu.some(s => s.includes(h) || (maxD > 0 && vzdalenostLevenshtein(s, h) <= maxD));
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
    { klic: 'hodnoceni:', popis: 'Hodnocení (1–5, >=4)' },
    { klic: 'srdicka:', popis: 'Hodnocení srdíčky (5, >=4)' },
    { klic: 'narodnost:', popis: 'Národnost modelky' },
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
];


