// Statistiky sbírky v Přehledu: lišta výběru, řádek čísel a grafy ve skupinách (Zařazení, Vzhled a původ, Sbírka).
// Klik (nebo Enter) na sloupec či řádek grafu přidá podmínku výběru; další kliky výběr zužují (v jednom grafu
// platí jedna hodnota, klik na tutéž ji zruší). Všechny grafy i čísla se pak přepočítají: tlumeně celá sbírka,
// jasně modelky ve výběru. Výběr jde ukázat jako mřížku fotek a otevřít v galerii, když se dá vyjádřit hledáním.
// Počítá se ze seznamu modelek; fotografové a čísla podle edic jsou z backendu (GetStatistiky), modelky
// nejčastějších fotografů se dohledají hledáním. Grafy jsou HTML (písmo stejně velké v každé šířce karty);
// SVG grafSloupcu zůstává pro úvod Přehledu.
import { GetModelky, GetStatistiky } from './backend';
import { EDICE, MESICE, esc, kategorieModelky, nazevVydani, popisKategorie, rozlozitVydani, sjednotit, sklonovat } from '../lib/format';
import { vsechnyModelky } from './mezipamet';
import { adresaTitulni, nacitatPostupne } from './obrazky';
import { otevritDetailModelky } from './profil';
import { hledatHodnotu } from './galerie';
import { nacistVyvoj } from './vyvoj';

// Jedna řada má barvu akcentu; edice US a CZ růžová a modrá (dvojice ověřená na čitelnost i pro barvoslepé)
const BARVY_EDIC = { US: '#d81b60', CZ: '#2f8fe0' };
const BARVA = BARVY_EDIC.US;

const dekadaKratce = d => `${String(d).slice(2)}.`;
const dekadaCela = d => `${d}–${d + 9}`;
const cislo = n => String(Math.round(n * 10) / 10).replace('.', ',');
const pocetModelek = n => sklonovat(n, 'modelka', 'modelky', 'modelek');
const pocetCenterfoldu = n => sklonovat(n, 'centerfold', 'centerfoldy', 'centerfoldů');

// Zaoblený jen horní konec sloupce (4 px), dno sedí na ose
const sloupec = (x, y, sirka, vyska) => vyska <= 0 ? ''
    : `M${x},${y + vyska} V${y + Math.min(4, vyska)} q0,-${Math.min(4, vyska)} ${Math.min(4, sirka / 2)},-${Math.min(4, vyska)} h${sirka - 2 * Math.min(4, sirka / 2)} q${Math.min(4, sirka / 2)},0 ${Math.min(4, sirka / 2)},${Math.min(4, vyska)} V${y + vyska}Z`;

// Svislé sloupce jedné řady v SVG (úvod Přehledu); popisek hodnoty jen u maxima, ostatní v bublině
export function grafSloupcu(polozky, { sirka = 460, vyska = 190 } = {}) {
    const max = Math.max(1, ...polozky.map(p => p.hodnota));
    const dole = 22, nahore = 16, krok = sirka / polozky.length, sl = Math.min(30, krok * 0.58);
    const vyskaPlochy = vyska - dole - nahore;
    const mrizka = [0.5, 1].map(f => `<line class="graf-mrizka" x1="0" x2="${sirka}" y1="${nahore + vyskaPlochy * (1 - f)}" y2="${nahore + vyskaPlochy * (1 - f)}"/>`).join('');
    return `<svg class="graf" viewBox="0 0 ${sirka} ${vyska}" role="img">${mrizka}
        <line class="graf-osa" x1="0" x2="${sirka}" y1="${vyska - dole}" y2="${vyska - dole}"/>
        ${polozky.map((p, i) => {
            const v = vyskaPlochy * p.hodnota / max, x = i * krok + (krok - sl) / 2, y = vyska - dole - v;
            return `<g data-tip="${esc(p.tip)}">
                <rect class="graf-cil" x="${i * krok}" y="0" width="${krok}" height="${vyska}"/>
                <path d="${sloupec(x, y, sl, v)}" fill="${BARVA}"/>
                ${p.hodnota === max && p.hodnota ? `<text class="graf-hodnota" x="${x + sl / 2}" y="${y - 6}" text-anchor="middle">${p.hodnota}</text>` : ''}
                <text class="graf-popisek" x="${x + sl / 2}" y="${vyska - 6}" text-anchor="middle">${esc(p.popisek)}</text>
            </g>`;
        }).join('')}</svg>`;
}

// Stav: data a podmínky výběru (graf → { hodnota, popis, test, dotaz }); jeden výběr pro celé Statistiky
let data = null;                 // { s, modelky, fotografove: Map(nazev → Set id modelek) }
const filtry = new Map();
let mrizkaOtevrena = false;
const modelkyMrizky = new WeakMap();

// Centerfoldy modelky s desetiletím, edicí a věkem modelky v době vydání
const vekVLetech = (narozeni, vydani) => {
    const n = /^(\d{4})-(\d{2})/.exec(narozeni || ''), v = /^(\d{4})-(\d{2})/.exec(vydani || '');
    if (!n || !v) return null;
    const vek = parseInt(v[1]) - parseInt(n[1]) - (parseInt(v[2]) < parseInt(n[2]) ? 1 : 0);
    return vek > 12 && vek < 80 ? vek : null;
};
const skupinaVeku = v => v < 18 ? 17 : v > 29 ? 30 : v;
const popisVeku = v => v === 17 ? '≤17' : v === 30 ? '30+' : String(v);
const centerfoldyCache = new WeakMap();
function centerfoldyModelky(m) {
    if (!centerfoldyCache.has(m)) centerfoldyCache.set(m, (m.centerfoldy || []).map(v => {
        const casti = rozlozitVydani(v);
        if (!casti) return null;
        const vek = vekVLetech(m.narozeniDatum, v);
        return { v, edice: casti.edice, desetileti: Math.floor(parseInt(casti.rok) / 10) * 10, vek: vek === null ? null : skupinaVeku(vek), vekPresne: vek };
    }).filter(Boolean));
    return centerfoldyCache.get(m);
}
const median = cisla => {
    const s = [...cisla].sort((a, b) => a - b), p = Math.floor(s.length / 2);
    return s.length % 2 ? s[p] : (s[p - 1] + s[p]) / 2;
};

// Skupiny podle hodnoty údaje (vlasy, národnost…): stejné hodnoty bez ohledu na velikost písmen a diakritiku
function podleHodnoty(modelky, hodnota) {
    const skupiny = new Map();
    modelky.forEach(m => {
        const h = String(hodnota(m) || '').trim();
        if (!h) return;
        const klic = sjednotit(h);
        if (!skupiny.has(klic)) skupiny.set(klic, { klic, nazev: h, pocet: 0 });
        skupiny.get(klic).pocet++;
    });
    return [...skupiny.values()].sort((a, b) => b.pocet - a.pocet || a.nazev.localeCompare(b.nazev, 'cs'));
}

// Položka grafu: počty v celé sbírce a ve výběru (u centerfoldů se počítají centerfoldy, jinak modelky)
const polozka = (graf, hodnota, nazev, popis, test, { dotaz = null, pocet = null } = {}) => ({ graf, hodnota: String(hodnota), nazev, popis, test, dotaz, pocet });
function spocitat(polozky, vsechny, vybrane) {
    return polozky.map(p => ({
        ...p,
        celkem: p.pocet ? vsechny.reduce((s, m) => s + p.pocet(m), 0) : vsechny.filter(p.test).length,
        vybrano: p.pocet ? vybrane.reduce((s, m) => s + p.pocet(m), 0) : vybrane.filter(p.test).length,
    }));
}

// Grafy jako HTML: každý sloupec či řádek je tlačítko (klávesnice, bublina); vrstva celé sbírky a vrstva výběru
const zapnuty = p => filtry.get(p.graf)?.hodnota === p.hodnota;
const atributy = (p, tip) => `data-graf="${esc(p.graf)}" data-hodnota="${esc(p.hodnota)}" data-tip="${esc(tip)}" aria-pressed="${zapnuty(p)}"
    aria-label="${esc(tip)}" ${p.celkem ? '' : 'disabled'}`;
const textPoctu = (p, vyber) => vyber ? `${p.vybrano} / ${p.celkem}` : String(p.celkem);

// Celá sbírka i výběr mají každý měřítko podle svého největšího sloupce, aby byl tvar výběru vidět i u malého
// výběru (5 z 2 000); přesná čísla jsou v textu a v bublině
function sloupce(polozky, vyber, { barva = BARVA, jednotka = pocetModelek } = {}) {
    const max = Math.max(1, ...polozky.map(p => p.celkem));
    const maxVyberu = Math.max(1, ...polozky.map(p => p.vybrano));
    const nejvic = Math.max(...polozky.map(p => vyber ? p.vybrano : p.celkem));
    return `<div class="sg-sloupce">${polozky.map(p => {
        const tip = `${p.nazev}: ${vyber ? `${p.vybrano} z ${jednotka(p.celkem)}` : jednotka(p.celkem)}`;
        const hodnota = vyber ? p.vybrano : p.celkem;
        return `<button type="button" class="sg-sloupec ${zapnuty(p) ? 'vybrany' : ''}" ${atributy(p, tip)}>
            <span class="sg-plocha"><b class="${hodnota === nejvic && hodnota ? '' : 'skryte'}" style="bottom:calc(${vyber ? hodnota / maxVyberu * 100 : hodnota / max * 100}% + 3px)">${hodnota}</b>
                <i class="sg-celkem ${vyber ? 'tlum' : ''}" style="height:${p.celkem / max * 100}%;--barva:${barva}"></i>
                ${vyber ? `<i class="sg-vybrano" style="height:${p.vybrano / maxVyberu * 100}%;--barva:${barva}"></i>` : ''}</span>
            <small>${esc(p.popisek ?? p.nazev)}</small></button>`;
    }).join('')}</div>`;
}

function pruhy(polozky, vyber) {
    const max = Math.max(1, ...polozky.map(p => p.celkem));
    const maxVyberu = Math.max(1, ...polozky.map(p => p.vybrano));
    return `<div class="sg-pruhy">${polozky.map(p => `
        <button type="button" class="sg-pruh ${zapnuty(p) ? 'vybrany' : ''}" ${atributy(p, `${p.nazev}: ${vyber ? `${p.vybrano} z ${pocetModelek(p.celkem)}` : pocetModelek(p.celkem)}`)}>
            <span class="sg-nazev">${esc(p.nazev)}</span>
            <span class="sg-draha"><i class="sg-celkem ${vyber ? 'tlum' : ''}" style="width:${p.celkem / max * 100}%"></i>${vyber ? `<i class="sg-vybrano" style="width:${p.vybrano / maxVyberu * 100}%"></i>` : ''}</span>
            <span class="sg-pocet">${textPoctu(p, vyber)}</span>
        </button>`).join('')}</div>`;
}

// Sloupce po skupinách (desetiletí) a edicích; radky: [{ popisek, polozky: { US, CZ } }]
function skupinySloupcu(radky, edice, vyber) {
    const vsechny = radky.flatMap(r => edice.map(e => r.polozky[e]).filter(Boolean));
    const max = Math.max(1, ...vsechny.map(p => p.celkem));
    const maxVyberu = Math.max(1, ...vsechny.map(p => p.vybrano));
    return `<div class="sg-sloupce sg-skupiny">${radky.map(r => `
        <div class="sg-skupina"><span class="sg-dvojice">${edice.map(e => {
            const p = r.polozky[e];
            const tip = `${p.nazev}: ${vyber ? `${p.vybrano} z ${pocetCenterfoldu(p.celkem)}` : pocetCenterfoldu(p.celkem)}`;
            return `<button type="button" class="sg-sloupec ${zapnuty(p) ? 'vybrany' : ''}" ${atributy(p, tip)}>
                <span class="sg-plocha"><i class="sg-celkem ${vyber ? 'tlum' : ''}" style="height:${p.celkem / max * 100}%;--barva:${BARVY_EDIC[e] || BARVA}"></i>
                ${vyber ? `<i class="sg-vybrano" style="height:${p.vybrano / maxVyberu * 100}%;--barva:${BARVY_EDIC[e] || BARVA}"></i>` : ''}</span></button>`;
        }).join('')}</span><small>${esc(r.popisek)}</small></div>`).join('')}</div>`;
}

const karta = (nadpis, obsah, poznamka = '') => `<div class="stat-karta"><div class="stat-karta-nadpis">${nadpis}</div>${obsah}${poznamka ? `<p class="stat-pozn">${poznamka}</p>` : ''}</div>`;
const legenda = edice => `<div class="stat-legenda">${edice.map(e => `<span><i style="background:${BARVY_EDIC[e] || BARVA}"></i>${e}</span>`).join('')}</div>`;

function htmlStatistik() {
    const { s, modelky, fotografove } = data;
    const vybrane = modelky.filter(m => [...filtry.values()].every(f => f.test(m)));
    const vyber = filtry.size > 0;
    // Položky všech grafů (i pro nalezení podmínky po kliknutí)
    const vsechnyPolozky = [];
    const graf = seznam => {
        const spocitane = spocitat(seznam, modelky, vybrane);
        vsechnyPolozky.push(...spocitane);
        return spocitane;
    };

    // Zařazení
    const kategorie = new Map();
    modelky.forEach(m => kategorieModelky(m).forEach(k => kategorie.set(k.nazev, (kategorie.get(k.nazev) || 0) + 1)));
    const polozkyKategorii = graf([...kategorie.keys()].sort((a, b) => kategorie.get(b) - kategorie.get(a)).map(n => polozka('kat', n, n, n,
        m => kategorieModelky(m).some(k => k.nazev === n), { dotaz: `kategorie:"${n.toLowerCase()}"` })));
    const vsechnyCf = modelky.flatMap(centerfoldyModelky);
    const edice = EDICE.filter(e => vsechnyCf.some(c => c.edice === e));
    const dekady = [...new Set(vsechnyCf.map(c => c.desetileti))].sort((a, b) => a - b);
    const radkyCf = dekady.length ? Array.from({ length: (dekady.at(-1) - dekady[0]) / 10 + 1 }, (_, i) => dekady[0] + i * 10).map(d => ({
        popisek: dekadaKratce(d),
        polozky: Object.fromEntries(edice.map(e => {
            const nazev = `${dekadaCela(d)}${edice.length > 1 ? ` · ${e}` : ''}`;
            const pocet = m => centerfoldyModelky(m).filter(c => c.desetileti === d && c.edice === e).length;
            return [e, spocitat([polozka('cf', `${d}:${e}`, nazev, `centerfold ${nazev}`, m => pocet(m) > 0, { pocet })], modelky, vybrane)[0]];
        })),
    })) : [];
    radkyCf.forEach(r => vsechnyPolozky.push(...Object.values(r.polozky)));
    const veky = [...new Set(vsechnyCf.map(c => c.vek).filter(v => v !== null))].sort((a, b) => a - b);
    const polozkyVeku = veky.length ? graf(Array.from({ length: veky.at(-1) - veky[0] + 1 }, (_, i) => veky[0] + i).map(v => {
        const pocet = m => centerfoldyModelky(m).filter(c => c.vek === v).length;
        return { ...polozka('vek', v, `${popisVeku(v)} let`, `věk ${popisVeku(v)}`, m => pocet(m) > 0, { pocet }), popisek: popisVeku(v) };
    })) : [];

    // Vzhled a původ
    const podleUdaje = (klic, hodnota, dotaz, nejvic) => graf(podleHodnoty(modelky, hodnota).slice(0, nejvic).map(h =>
        polozka(klic, h.klic, h.nazev, h.nazev, m => sjednotit(String(hodnota(m) || '').trim()) === h.klic, { dotaz: `${dotaz}:"${h.nazev}"` })));
    const narodnosti = podleUdaje('nar', m => m.narodnost, 'narodnost', 8);
    const vlasy = podleUdaje('vlasy', m => m.vlasyBarva, 'vlasy', 6);
    const oci = podleUdaje('oci', m => m.ociBarva, 'oci', 6);
    const srdicka = graf([0, 1, 2, 3, 4, 5].map(n => ({ ...polozka('srd', n, n ? `${n} ♥` : 'Bez hodnocení', n ? `${n} ♥` : 'bez hodnocení',
        m => (m.hodnoceni || 0) === n, { dotaz: n ? `hodnoceni:${n}` : null }), popisek: n ? `${n} ♥` : 'bez' })));

    // Sbírka: přibývání po měsících (poslední rok) a fotografové
    const dnes = new Date();
    const mesice = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(dnes.getFullYear(), dnes.getMonth() - 11 + i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const pribyvani = spocitat(mesice.map(k => {
        const nazev = `${MESICE[parseInt(k.slice(5)) - 1]} ${k.slice(0, 4)}`;
        return { ...polozka('prib', k, nazev, `přidané ${nazev}`, m => (m.pridano || '').startsWith(k)), popisek: MESICE[parseInt(k.slice(5)) - 1].slice(0, 3) };
    }), modelky, vybrane);
    vsechnyPolozky.push(...pribyvani);
    const polozkyFotografu = graf(s.fotografove.filter(f => fotografove.has(f.nazev)).map(f =>
        polozka('fot', f.nazev, f.nazev, `fotograf ${f.nazev}`, m => fotografove.get(f.nazev).has(m.id), { dotaz: `fotograf:"${f.nazev}"` })));
    data.polozky = new Map(vsechnyPolozky.map(p => [`${p.graf}\u0000${p.hodnota}`, p]));

    // Čísla nahoře: výběr proti celé sbírce
    const vybraneCf = vybrane.flatMap(centerfoldyModelky);
    const vekyVyberu = vybraneCf.map(c => c.vekPresne).filter(v => v !== null);
    const vekyVsech = vsechnyCf.map(c => c.vekPresne).filter(v => v !== null);
    const nar = podleHodnoty(vybrane, m => m.narodnost);
    const sNarodnosti = nar.reduce((soucet, n) => soucet + n.pocet, 0);
    const prumer = seznam => {
        const hodnocene = seznam.filter(m => m.hodnoceni > 0);
        return hodnocene.length ? hodnocene.reduce((s, m) => s + m.hodnoceni, 0) / hodnocene.length : null;
    };
    const prumerVyberu = prumer(vybrane), prumerVsech = prumer(modelky);
    const cisla = [
        ['Modelky', vybrane.length, vyber ? `z ${modelky.length}` : `${modelky.filter(m => /^\d{4}-\d{2}/.test(m.narozeniDatum || '')).length} s datem narození`],
        ['Centerfoldy', vybraneCf.length, vyber ? `z ${vsechnyCf.length}` : (dekady.length ? `${dekadaCela(dekady[0])} až ${dekadaCela(dekady.at(-1))}` : 'zatím žádný')],
        ['Věk', vekyVyberu.length ? cislo(median(vekyVyberu)) : '–', vekyVyberu.length ? `let medián${vyber && vekyVsech.length ? ` (celkem ${cislo(median(vekyVsech))})` : ''}` : 'chybí data narození'],
        ['Národnosti', nar.length || '–', nar.length ? `${esc(nar[0].nazev)} ${Math.round(nar[0].pocet / sNarodnosti * 100)} %` : 'neuvedené'],
        ['Hodnocení', prumerVyberu ? `${cislo(prumerVyberu)} ♥` : '–', prumerVyberu ? `průměr${vyber && prumerVsech ? ` (celkem ${cislo(prumerVsech)})` : ''}` : 'zatím bez srdíček'],
    ];

    // Lišta výběru: podmínky jako štítky, počet a akce
    const dotazy = [...filtry.values()].map(f => f.dotaz);
    const lista = vyber ? `
        <div class="sg-vyber">
            <b>${pocetModelek(vybrane.length)}</b><span class="sg-vyber-text">odpovídá výběru:</span>
            ${[...filtry.entries()].map(([g, f]) => `<button type="button" class="chip active" data-zrusit-podminku="${esc(g)}" title="Odebrat podmínku">${esc(f.popis)} ×</button>`).join('')}
            <span class="sg-vyber-akce">
                <button type="button" class="btn btn-secondary btn-small" data-zrusit-vyber>Zrušit výběr</button>
                ${vybrane.length ? `<button type="button" class="btn btn-primary btn-small" data-ukazat-mrizku aria-expanded="${mrizkaOtevrena}">${mrizkaOtevrena ? 'Skrýt modelky' : `Zobrazit ${pocetModelek(vybrane.length)}`}</button>` : ''}
            </span>
        </div>
        ${mrizkaOtevrena && vybrane.length ? htmlMrizky(vybrane, dotazy.every(Boolean) ? dotazy.join(' ') : '') : ''}
        <p class="sg-napoveda">Jasně výběr, tlumeně celá sbírka – každý v měřítku svého největšího sloupce; přesné počty jsou u řádků a v bublině.</p>`
        : '<p class="sg-napoveda">Klik na sloupec nebo řádek vybere modelky; další kliky výběr zúží. Grafy pak ukazují celou sbírku tlumeně a výběr jasně.</p>';

    const karty = (...seznam) => seznam.filter(Boolean).join('');
    const sekce = (nazev, obsah) => obsah ? `<div class="sg-sekce">${nazev}</div><div class="stat-grafy">${obsah}</div>` : '';
    const ediceCisel = EDICE.filter(e => s.desetileti.some(d => d.edice?.[e]));
    return `
        <h3>Statistiky sbírky</h3>
        ${lista}
        <div class="stat-cisla">${cisla.map(([nadpis, hodnota, veta]) => `
            <div class="stat-cislo"><div class="stat-karta-nadpis">${nadpis}</div><div class="stat-velke">${hodnota}</div><p>${veta}</p></div>`).join('')}
        </div>
        ${sekce('Zařazení', karty(
            polozkyKategorii.length && karta('Kategorie', pruhy(polozkyKategorii, vyber)),
            radkyCf.length && karta('Centerfoldy podle desetiletí', (edice.length > 1 ? legenda(edice) : '') + skupinySloupcu(radkyCf, edice, vyber)),
            polozkyVeku.length && karta('Věk v době centerfoldu', sloupce(polozkyVeku, vyber, { jednotka: pocetCenterfoldu }),
                `Z ${sklonovat(vekyVsech.length, 'centerfoldu', 'centerfoldů', 'centerfoldů')} se známým měsícem a rokem narození.`),
        ))}
        ${sekce('Vzhled a původ', karty(
            narodnosti.length && karta('Národnosti', pruhy(narodnosti, vyber)),
            vlasy.length && karta('Barva vlasů', pruhy(vlasy, vyber)),
            oci.length && karta('Barva očí', pruhy(oci, vyber)),
            modelky.length && karta('Hodnocení', sloupce(srdicka, vyber)),
        ))}
        ${sekce('Sbírka', karty(
            pribyvani.some(p => p.celkem) && karta('Přibývání sbírky', sloupce(pribyvani, vyber), 'Modelky přidané po měsících za poslední rok.'),
            polozkyFotografu.length && karta('Nejčastější fotografové', pruhy(polozkyFotografu, vyber),
                s.fotografuCelkem > polozkyFotografu.length ? `${polozkyFotografu.length} nejčastějších z ${sklonovat(s.fotografuCelkem, 'fotografa', 'fotografů', 'fotografů')}; počet modelek.` : 'Počet modelek.'),
            ediceCisel.length > 1 && karta('Čísla ve sbírce podle edic', legenda(ediceCisel) + `<div class="sg-sloupce sg-skupiny">${s.desetileti.filter(d => ediceCisel.some(e => d.edice?.[e])).map(d => {
                const max = Math.max(1, ...s.desetileti.flatMap(x => ediceCisel.map(e => x.edice?.[e] || 0)));
                return `<div class="sg-skupina"><span class="sg-dvojice">${ediceCisel.map(e => `<span class="sg-sloupec" data-tip="${esc(`${dekadaCela(d.desetileti)} · ${e}: ${sklonovat(d.edice?.[e] || 0, 'číslo', 'čísla', 'čísel')}`)}">
                    <span class="sg-plocha"><i class="sg-celkem" style="height:${(d.edice?.[e] || 0) / max * 100}%;--barva:${BARVY_EDIC[e] || BARVA}"></i></span></span>`).join('')}</span><small>${dekadaKratce(d.desetileti)}</small></div>`;
            }).join('')}</div>`, 'Celá sbírka; výběr modelek se na čísla nevztahuje.'),
        ))}
        ${modelky.length ? '' : '<p class="stat-prazdne">Statistiky se ukážou, až budou ve sbírce modelky.</p>'}`;
}

// Mřížka fotek modelek ve výběru; dotaz = hledání pro galerii (jen když všechny podmínky jde vyjádřit hledáním)
const ZOBRAZIT_NAJEDNOU = 48;
let zobrazitVse = false;
function htmlMrizky(vybrane, dotaz) {
    const serazene = [...vybrane].sort((a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || a.jmeno.localeCompare(b.jmeno, 'cs'));
    const zobrazene = zobrazitVse ? serazene : serazene.slice(0, ZOBRAZIT_NAJEDNOU);
    const detail = m => {
        const cf = centerfoldyModelky(m)[0];
        return [kategorieModelky(m).filter(k => !k.odvozena).map(popisKategorie)[0], cf && nazevVydani(cf.v)].filter(Boolean).join(' · ');
    };
    return `<div class="stat-karta stat-vyber" data-mrizka>
        <div class="stat-vyber-mrizka">${zobrazene.map(m => `
            <button type="button" class="stat-vyber-modelka" data-modelka-vyberu="${m.id}">
                <img data-src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
                <span>${esc(m.jmeno)}</span><small>${esc(detail(m))}</small>
            </button>`).join('')}</div>
        <div class="stat-vyber-akce">
            ${zobrazene.length < serazene.length ? `<button type="button" class="link" data-vse-vyberu>Zobrazit všech ${serazene.length}</button>` : ''}
            ${dotaz ? `<button type="button" class="btn btn-secondary btn-small" data-vyber-galerie="${esc(dotaz)}">Otevřít v galerii →</button>` : ''}
        </div></div>`;
}

// Vykreslení s ponecháním fokusu na stejném sloupci (nebo štítku) a polohy stránky
function vykreslit(koren) {
    const obsah = koren.querySelector('[data-stat-obsah]');
    if (!obsah || !data) return;
    const aktivni = /** @type {HTMLElement} */ (document.activeElement);
    const fokus = aktivni && obsah.contains(aktivni) ? (aktivni.dataset.graf ? `[data-graf="${CSS.escape(aktivni.dataset.graf)}"][data-hodnota="${CSS.escape(aktivni.dataset.hodnota)}"]`
        : aktivni.matches('[data-ukazat-mrizku]') ? '[data-ukazat-mrizku]' : '') : '';
    obsah.innerHTML = htmlStatistik();
    const mrizka = obsah.querySelector('[data-mrizka]');
    if (mrizka) {
        modelkyMrizky.set(mrizka, new Map(data.modelky.map(m => [m.id, m])));
        nacitatPostupne(mrizka);
    }
    if (fokus) /** @type {HTMLElement} */ (obsah.querySelector(fokus) || obsah.querySelector('.sg-vyber button'))?.focus({ preventScroll: true });
}

// Načtení a vykreslení do oddílu Přehledu; volá se při prvním zobrazení oddílu (výběr zůstává, dokud se nezmění data)
export async function nacistStatistiky(koren) {
    if (!koren || koren.dataset.nacteno) return;
    koren.dataset.nacteno = '1';
    const [s, modelky] = await Promise.all([GetStatistiky(), vsechnyModelky()]);
    if (!koren.isConnected) return;
    data = { s, modelky, fotografove: new Map(), polozky: new Map() };
    // Podmínky, jejichž hodnota v nových datech už není, se zahodí
    filtry.forEach((f, g) => { if (g === 'fot') filtry.delete(g); });
    koren.innerHTML = `<div data-stat-obsah></div>
        <!-- Vývoj v čase se počítá zvlášť (app/vyvoj.js) a výběr se ho netýká -->
        <div class="vyvoj" data-vyvoj><p class="stat-prazdne">Počítám vývoj v čase…</p></div>
        <div class="graf-bublina hidden"></div>`;
    vykreslit(koren);
    nacistVyvoj(koren.querySelector('[data-vyvoj]'));
    // Modelky nejčastějších fotografů (z hledání), pak se graf fotografů doplní
    const vysledky = await Promise.all(s.fotografove.map(f => GetModelky(`fotograf:"${f.nazev}"`)
        .then(seznam => /** @type {[string, Set<number>]} */ ([f.nazev, new Set((seznam || []).map(m => m.id))]))));
    if (!koren.isConnected || data?.s !== s) return;
    data.fotografove = new Map(vysledky);
    vykreslit(koren);
}

// Bublina u sloupce nebo řádku grafu pod myší; kliky a klávesnice pro výběr
export function pripravit(stats) {
    stats.addEventListener('mousemove', (e) => {
        // Každá část (úvod, statistiky) má vlastní bublinu
        const bublina = e.target.closest?.('.stat-section')?.querySelector('.graf-bublina');
        if (!bublina) return;
        const cil = e.target.closest?.('[data-tip]');
        bublina.classList.toggle('hidden', !cil);
        stats.querySelectorAll('.graf g.aktivni').forEach(g => g !== cil && g.classList.remove('aktivni'));
        if (!cil) return;
        cil.classList.add('aktivni');
        bublina.textContent = cil.dataset.tip;
        const okraj = bublina.offsetParent.getBoundingClientRect();
        const x = Math.min(e.clientX - okraj.left + 14, okraj.width - bublina.offsetWidth - 8);
        bublina.style.left = `${x}px`;
        bublina.style.top = `${e.clientY - okraj.top + 16}px`;
    });
    stats.addEventListener('mouseleave', () => stats.querySelectorAll('.graf-bublina').forEach(b => b.classList.add('hidden')));

    stats.addEventListener('click', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        const koren = cil.closest('.stat-statistiky');
        if (!koren || !data) return;
        const modelka = cil.closest('[data-modelka-vyberu]');
        if (modelka) {
            const m = modelkyMrizky.get(modelka.closest('[data-mrizka]'))?.get(parseInt(modelka.dataset.modelkaVyberu));
            if (m) otevritDetailModelky(m);
            return;
        }
        const galerie = cil.closest('[data-vyber-galerie]');
        if (galerie) {
            hledatHodnotu(galerie.dataset.vyberGalerie);
            return;
        }
        if (cil.closest('[data-vse-vyberu]')) zobrazitVse = true;
        else if (cil.closest('[data-ukazat-mrizku]')) {
            mrizkaOtevrena = !mrizkaOtevrena;
            zobrazitVse = false;
        } else if (cil.closest('[data-zrusit-vyber]')) {
            filtry.clear();
            mrizkaOtevrena = false;
        } else if (cil.closest('[data-zrusit-podminku]')) {
            filtry.delete(cil.closest('[data-zrusit-podminku]').dataset.zrusitPodminku);
            if (!filtry.size) mrizkaOtevrena = false;
        } else {
            const sloupecGrafu = cil.closest('[data-graf]');
            const p = sloupecGrafu && data.polozky.get(`${sloupecGrafu.dataset.graf}\u0000${sloupecGrafu.dataset.hodnota}`);
            if (!p) return;
            // Klik na zvolenou hodnotu podmínku zruší, na jinou v tomtéž grafu ji vymění
            if (zapnuty(p)) filtry.delete(p.graf);
            else filtry.set(p.graf, { hodnota: p.hodnota, popis: p.popis, test: p.test, dotaz: p.dotaz });
            if (!filtry.size) mrizkaOtevrena = false;
            zobrazitVse = false;
        }
        vykreslit(koren);
    });
    // Esc: nejdřív zavře mřížku modelek, pak zruší výběr
    stats.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const koren = /** @type {HTMLElement} */ (e.target).closest?.('.stat-statistiky');
        if (!koren || (!mrizkaOtevrena && !filtry.size)) return;
        e.preventDefault();
        e.stopPropagation();
        if (mrizkaOtevrena) mrizkaOtevrena = false;
        else filtry.clear();
        vykreslit(koren);
    });
}
