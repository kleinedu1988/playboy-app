// Čisté funkce pro texty a data: nesahají na stránku ani na backend, proto jdou testovat samostatně

export const MESICE = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

// Edice časopisu; výchozí (US) se do vydání nepíše, ostatní mají příponu: 2009-11-CZ
export const EDICE = ['US', 'CZ'];
export const VYCHOZI_EDICE = 'US';

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
const ZKRATKY_PASKY = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
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
// Řazení galerie: abecedně, naposledy přidané, podle roku prvního vydání; modelky bez údaje jdou na konec
export const RAZENI_GALERIE = {
    jmeno: { popisek: 'A–Z', nazev: 'abecedně' },
    pridano: { popisek: 'Nově přidané', nazev: 'naposledy přidané' },
    rok: { popisek: 'Podle roku', nazev: 'podle roku prvního vydání' },
};

export function prvniRok(modelka) {
    const roky = (modelka.vydani || []).map(v => parseInt(String(v).slice(0, 4))).filter(r => r > 0);
    return roky.length ? Math.min(...roky) : 0;
}

export function seraditModelky(modelky, razeni) {
    const vysledek = [...modelky];
    if (razeni === 'pridano') vysledek.sort((a, b) => (b.pridano || '').localeCompare(a.pridano || ''));
    else if (razeni === 'rok') vysledek.sort((a, b) => (prvniRok(a) || 9999) - (prvniRok(b) || 9999));
    return vysledek;
}

// Část galerie, do které karta patří (lišta nad galerií): písmeno, měsíc přidání, nebo desetiletí
export function castGalerie(modelka, razeni) {
    if (razeni === 'pridano') {
        const [rok, mesic] = (modelka.pridano || '').split('-');
        return rok && mesic ? `${MESICE[parseInt(mesic) - 1]} ${rok}` : 'Bez data';
    }
    if (razeni === 'rok') {
        const rok = prvniRok(modelka);
        return rok ? `${Math.floor(rok / 10) * 10}s` : 'Bez vydání';
    }
    const jmeno = bezDiakritiky(modelka.jmeno);
    return /^\p{L}/u.test(jmeno) ? jmeno[0].toUpperCase() : '#';
}

// Počet s podstatným jménem ve správném tvaru: 1 fotka, 2–4 fotky, 0 a 5+ fotek
export function sklonovat(n, jedna, dve, pet) {
    return `${n} ${n === 1 ? jedna : n > 1 && n < 5 ? dve : pet}`;
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
    return !hodnota;
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

// Token hledání pro frontendové filtrování (podporuje negaci -, čárku jako OR, rozsah let a neuzavřené uvozovky)
export function rozlozitDotaz(dotaz) {
    let d = String(dotaz || '').trim();
    if (!d) return [];
    if ((d.match(/"/g) || []).length % 2 !== 0) d += '"';
    const vzor = /(-|!)?([\p{L}]+):"([^"]*)"|(-|!)?"([^"]*)"|(\S+)/gu;
    const tokeny = [];
    let shoda;
    while ((shoda = vzor.exec(d)) !== null) {
        let negace = Boolean(shoda[1] || shoda[4]);
        let klic = shoda[2] || '';
        let hodnota = shoda[3] || shoda[5] || '';
        if (!klic && !hodnota && shoda[6]) {
            let slovo = shoda[6];
            if (slovo.startsWith('-') || slovo.startsWith('!')) {
                negace = true;
                slovo = slovo.slice(1);
            }
            const i = slovo.indexOf(':');
            if (i > 0 && i < slovo.length - 1) {
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

// Ověří, zda pole textových hodnot odpovídá tokenům hledání (AND mezi tokeny, OR přes čárku, negace -, rozsah let a operátory)
export function vyhovujeHledani(texty, tokeny) {
    if (!tokeny.length) return true;
    const zjednoduseneTexty = texty.filter(Boolean).map(t => bezDiakritiky(t));
    for (const t of tokeny) {
        // Kontrola rozsahu let např. 1970..1979 nebo 1970-1979 a operátorů >=1970, <1980
        const rozsah = /^(\d{4})(?:\.\.|\-)(\d{4})$/.exec(t.hodnota);
        const opMatch = /^(>=|<=|>|<|==|=)(\d{4})$/.exec(t.hodnota);
        let shoda = false;
        if (rozsah) {
            const od = parseInt(rozsah[1]), doR = parseInt(rozsah[2]);
            shoda = zjednoduseneTexty.some(txt => {
                const roky = txt.match(/\b\d{4}\b/g) || [];
                return roky.some(r => parseInt(r) >= od && parseInt(r) <= doR);
            });
        } else if (opMatch) {
            const op = opMatch[1];
            const cil = parseInt(opMatch[2]);
            shoda = zjednoduseneTexty.some(txt => {
                const roky = txt.match(/\b\d{4}\b/g) || [];
                return roky.some(r => {
                    const c = parseInt(r);
                    if (op === '>=') return c >= cil;
                    if (op === '<=') return c <= cil;
                    if (op === '>') return c > cil;
                    if (op === '<') return c < cil;
                    if (op === '=' || op === '==') return c === cil;
                    return false;
                });
            });
        } else {
            shoda = t.varianty.some(v => zjednoduseneTexty.some(txt => txt.includes(v) || odpovidaTextFuzzy(txt, v)));
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
    { klic: 'role:', popis: 'Role (Playmate, Cover, Modelka…)' },
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


