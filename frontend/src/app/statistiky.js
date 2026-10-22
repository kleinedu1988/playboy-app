// Statistiky sbírky v Přehledu: nahoře řádek čísel, pod ním karty s grafy (sloupce, pruhy, skupiny edic).
// Grafy jsou SVG; najetí myší ukáže bublinu s hodnotou, klik (nebo Enter) na sloupec či řádek rozbalí pod řadou
// grafů výběr modelek, které do něj patří. Počítá se ze seznamu modelek, aby každý sloupec znal své modelky;
// fotografové a čísla podle edic jsou z backendu (GetStatistiky), modelky fotografa se dohledají hledáním.
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
const cislo = n => String(n).replace('.', ',');
const pocetModelek = n => sklonovat(n, 'modelka', 'modelky', 'modelek');
const NAPOVEDA_KLIKU = ' · klik ukáže modelky';

// Zaoblený jen horní konec sloupce (4 px), dno sedí na ose
const sloupec = (x, y, sirka, vyska) => vyska <= 0 ? ''
    : `M${x},${y + vyska} V${y + Math.min(4, vyska)} q0,-${Math.min(4, vyska)} ${Math.min(4, sirka / 2)},-${Math.min(4, vyska)} h${sirka - 2 * Math.min(4, sirka / 2)} q${Math.min(4, sirka / 2)},0 ${Math.min(4, sirka / 2)},${Math.min(4, vyska)} V${y + vyska}Z`;

// Skupina grafu: bublina, a když vede na výběr modelek, i ovládání myší a klávesnicí
const skupina = (tip, vyber) => vyber
    ? `<g data-tip="${esc(tip + NAPOVEDA_KLIKU)}" data-vyber="${esc(vyber)}" tabindex="0" role="button" aria-label="${esc(tip)}">`
    : `<g data-tip="${esc(tip)}">`;

// Svislé sloupce jedné řady; popisek hodnoty jen u maxima (ostatní v bublině); vyber = klíč výběru modelek
export function grafSloupcu(polozky, { sirka = 460, vyska = 190 } = {}) {
    const max = Math.max(1, ...polozky.map(p => p.hodnota));
    const dole = 22, nahore = 16, krok = sirka / polozky.length, sl = Math.min(30, krok * 0.58);
    const vyskaPlochy = vyska - dole - nahore;
    const mrizka = [0.5, 1].map(f => `<line class="graf-mrizka" x1="0" x2="${sirka}" y1="${nahore + vyskaPlochy * (1 - f)}" y2="${nahore + vyskaPlochy * (1 - f)}"/>`).join('');
    return `<svg class="graf" viewBox="0 0 ${sirka} ${vyska}" role="img">${mrizka}
        <line class="graf-osa" x1="0" x2="${sirka}" y1="${vyska - dole}" y2="${vyska - dole}"/>
        ${polozky.map((p, i) => {
            const v = vyskaPlochy * p.hodnota / max, x = i * krok + (krok - sl) / 2, y = vyska - dole - v;
            return `${skupina(p.tip, p.hodnota ? p.vyber : '')}
                <rect class="graf-cil" x="${i * krok}" y="0" width="${krok}" height="${vyska}"/>
                <path d="${sloupec(x, y, sl, v)}" fill="${BARVA}"/>
                ${p.hodnota === max && p.hodnota ? `<text class="graf-hodnota" x="${x + sl / 2}" y="${y - 6}" text-anchor="middle">${p.hodnota}</text>` : ''}
                <text class="graf-popisek" x="${x + sl / 2}" y="${vyska - 6}" text-anchor="middle">${esc(p.popisek)}</text>
            </g>`;
        }).join('')}</svg>`;
}

// Vodorovné pruhy žebříčku: název vlevo, hodnota za pruhem; nejkratší pruh je jen zaoblený konec (4 px)
function grafPruhu(polozky, { sirka = 460, radek = 26, prostor = 128 } = {}) {
    const max = Math.max(1, ...polozky.map(p => p.pocet));
    return `<svg class="graf" viewBox="0 0 ${sirka} ${polozky.length * radek}" role="img">
        ${polozky.map((p, i) => {
            const y = i * radek + 7, d = Math.max(4, (sirka - prostor - 44) * p.pocet / max);
            return `${skupina(`${p.nazev}: ${p.tip}`, p.vyber)}
                <rect class="graf-cil" x="0" y="${i * radek}" width="${sirka}" height="${radek}"/>
                <text class="graf-nazev" x="${prostor - 10}" y="${y + 9}" text-anchor="end">${esc(p.nazev.length > 20 ? p.nazev.slice(0, 19) + '…' : p.nazev)}</text>
                <path d="M${prostor},${y} h${d - 4} q4,0 4,4 v4 q0,4 -4,4 h-${d - 4}Z" fill="${BARVA}"/>
                <text class="graf-popisek" x="${prostor + d + 8}" y="${y + 9}">${p.pocet}</text>
            </g>`;
        }).join('')}</svg>`;
}

// Seskupené sloupce edic po skupinách (desetiletích); mezi sloupci páru mezera 2 px, hodnoty přímo nad sloupci.
// radky: [{ popisek, tip, hodnoty: { US: { hodnota, vyber } } }]
function grafSkupin(radky, edice, { sirka = 460, vyska = 190 } = {}) {
    const max = Math.max(1, ...radky.flatMap(r => edice.map(e => r.hodnoty[e]?.hodnota || 0)));
    const dole = 22, nahore = 18, krok = sirka / radky.length, sl = Math.min(26, krok / (edice.length + 1));
    const vyskaPlochy = vyska - dole - nahore;
    return `<svg class="graf" viewBox="0 0 ${sirka} ${vyska}" role="img">
        <line class="graf-osa" x1="0" x2="${sirka}" y1="${vyska - dole}" y2="${vyska - dole}"/>
        ${radky.map((r, i) => {
            const stred = i * krok + krok / 2, zacatek = stred - (edice.length * sl + (edice.length - 1) * 2) / 2;
            return `<g>${edice.map((e, k) => {
                const { hodnota = 0, vyber = '' } = r.hodnoty[e] || {};
                const v = vyskaPlochy * hodnota / max, x = zacatek + k * (sl + 2), y = vyska - dole - v;
                return `${skupina(`${r.tip} · ${e} ${hodnota}`, hodnota ? vyber : '')}
                    <rect class="graf-cil" x="${x - 1}" y="0" width="${sl + 2}" height="${vyska - dole}"/>
                    <path d="${sloupec(x, y, sl, v)}" fill="${BARVY_EDIC[e] || BARVA}"/>
                    ${hodnota ? `<text class="graf-hodnota" x="${x + sl / 2}" y="${y - 6}" text-anchor="middle">${hodnota}</text>` : ''}</g>`;
            }).join('')}
                <text class="graf-popisek" x="${stred}" y="${vyska - 6}" text-anchor="middle">${esc(r.popisek)}</text></g>`;
        }).join('')}</svg>`;
}

const karta = (nadpis, obsah, siroka = false) => `<div class="stat-karta ${siroka ? 'siroka' : ''}"><div class="stat-karta-nadpis">${nadpis}</div>${obsah}</div>`;
const prazdne = text => `<p class="stat-prazdne">${text}</p>`;
const legenda = edice => `<div class="stat-legenda">${edice.map(e => `<span><i style="background:${BARVY_EDIC[e] || BARVA}"></i>${e}</span>`).join('')}</div>`;

// Výběry modelek pro kliknutí: klíč → { nazev, seznam (nebo nacist), dotaz pro galerii, detail modelky }
let vybery = new Map();

// Počty podle hodnoty údaje (barva vlasů, národnost…); stejné hodnoty bez ohledu na velikost písmen a diakritiku
function podleHodnoty(modelky, hodnota) {
    const skupiny = new Map();
    modelky.forEach(m => {
        const h = String(hodnota(m) || '').trim();
        if (!h) return;
        const klic = sjednotit(h);
        if (!skupiny.has(klic)) skupiny.set(klic, { nazev: h, modelky: [] });
        skupiny.get(klic).modelky.push(m);
    });
    return [...skupiny.values()].sort((a, b) => b.modelky.length - a.modelky.length || a.nazev.localeCompare(b.nazev, 'cs'));
}

// Žebříček s výběrem: nejvýše `nejvic` řádků, každý vede na své modelky
function zebricek(skupiny, predpona, { nejvic = 8, dotaz = null, detail = null } = {}) {
    return skupiny.slice(0, nejvic).map(s => {
        const vyber = `${predpona}:${s.nazev}`;
        vybery.set(vyber, { nazev: s.nazev, seznam: s.modelky, dotaz: dotaz?.(s.nazev), detail });
        return { nazev: s.nazev, pocet: s.modelky.length, tip: pocetModelek(s.modelky.length), vyber };
    });
}

const vekVLetech = (narozeni, vydani) => {
    const n = /^(\d{4})-(\d{2})/.exec(narozeni || ''), v = /^(\d{4})-(\d{2})/.exec(vydani || '');
    if (!n || !v) return null;
    const vek = parseInt(v[1]) - parseInt(n[1]) - (parseInt(v[2]) < parseInt(n[2]) ? 1 : 0);
    return vek > 12 && vek < 80 ? vek : null;
};
const median = cisla => {
    const s = [...cisla].sort((a, b) => a - b), p = Math.floor(s.length / 2);
    return s.length % 2 ? s[p] : (s[p - 1] + s[p]) / 2;
};

function htmlStatistik(s, modelky) {
    vybery = new Map();
    const dnes = new Date();

    // Centerfoldy: každý centerfold modelky s vydáním (modelka, vydání, edice, desetiletí, věk)
    const centerfoldy = modelky.flatMap(m => (m.centerfoldy || []).map(v => {
        const casti = rozlozitVydani(v);
        return casti ? { m, v, edice: casti.edice, desetileti: Math.floor(parseInt(casti.rok) / 10) * 10, vek: vekVLetech(m.narozeniDatum, v) } : null;
    }).filter(Boolean));
    const unikatni = seznam => [...new Set(seznam)];

    // Čísla nahoře
    const sDatem = modelky.filter(m => /^\d{4}-\d{2}/.test(m.narozeniDatum || '')).length;
    const poDekadach = new Map();
    centerfoldy.forEach(c => poDekadach.set(c.desetileti, (poDekadach.get(c.desetileti) || 0) + 1));
    const nejvicDekada = [...poDekadach.entries()].sort((a, b) => b[1] - a[1])[0];
    const veky = centerfoldy.map(c => c.vek).filter(v => v !== null);
    const cetnostVeku = new Map();
    veky.forEach(v => cetnostVeku.set(v, (cetnostVeku.get(v) || 0) + 1));
    const nejcastejsiVek = [...cetnostVeku.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
    const narodnosti = podleHodnoty(modelky, m => m.narodnost);
    const sNarodnosti = narodnosti.reduce((soucet, n) => soucet + n.modelky.length, 0);
    const pred30 = new Date(dnes.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const pribylo = modelky.filter(m => (m.pridano || '') >= pred30).sort((a, b) => b.pridano.localeCompare(a.pridano));
    vybery.set('pribylo', { nazev: 'Přibylo za posledních 30 dní', seznam: pribylo, detail: m => `přidáno ${m.pridano.slice(8, 10).replace(/^0/, '')}. ${m.pridano.slice(5, 7).replace(/^0/, '')}.` });

    const cisla = [
        ['Modelky', modelky.length, modelky.length ? `${sDatem} s datem narození` : 'zatím žádné', ''],
        ['Centerfoldy', centerfoldy.length, nejvicDekada ? `nejvíc z <strong>${dekadaKratce(nejvicDekada[0])} let</strong>` : 'zatím žádný centerfold', ''],
        ['Věk', veky.length ? cislo(median(veky)) : '–', veky.length ? `let medián, nejčastěji <strong>${nejcastejsiVek[0]}</strong>` : 'chybí data narození', ''],
        ['Národnosti', narodnosti.length || '–', narodnosti.length ? `<strong>${esc(narodnosti[0].nazev)} ${Math.round(narodnosti[0].modelky.length / sNarodnosti * 100)} %</strong>` : 'zatím neuvedené', ''],
        ['Přibylo', pribylo.length ? `+${pribylo.length}` : '0', 'za posledních 30 dní', pribylo.length ? 'pribylo' : ''],
    ];

    // Kategorie (i odvozené)
    const kategorie = new Map();
    modelky.forEach(m => kategorieModelky(m).forEach(k => {
        if (!kategorie.has(k.nazev)) kategorie.set(k.nazev, { nazev: k.nazev, modelky: [] });
        kategorie.get(k.nazev).modelky.push(m);
    }));
    const radkyKategorii = zebricek([...kategorie.values()], 'kat', {
        nejvic: 12, dotaz: n => `kategorie:"${n.toLowerCase()}"`,
        detail: null,
    });
    // Detail v kategorii: její popis u modelky (Playmate roku 1998)
    radkyKategorii.forEach(r => {
        const v = vybery.get(r.vyber);
        v.detail = m => popisKategorie(kategorieModelky(m).find(k => k.nazev === r.nazev) || { nazev: r.nazev, detail: '', zbytek: '' });
    });

    // Centerfoldy podle desetiletí a edic
    const edice = EDICE.filter(e => centerfoldy.some(c => c.edice === e));
    const dekady = [...poDekadach.keys()].sort((a, b) => a - b);
    const vsechnyDekady = dekady.length ? Array.from({ length: (dekady.at(-1) - dekady[0]) / 10 + 1 }, (_, i) => dekady[0] + i * 10) : [];
    const radkyCf = vsechnyDekady.map(d => {
        const hodnoty = {};
        edice.forEach(e => {
            const tyto = centerfoldy.filter(c => c.desetileti === d && c.edice === e);
            const vyber = `cf:${d}:${e}`;
            vybery.set(vyber, { nazev: `Centerfoldy ${dekadaCela(d)}${edice.length > 1 ? ` · ${e}` : ''}`, seznam: unikatni(tyto.map(c => c.m)),
                detail: m => tyto.filter(c => c.m === m).map(c => nazevVydani(c.v)).join(', ') });
            hodnoty[e] = { hodnota: tyto.length, vyber };
        });
        return { popisek: dekadaKratce(d), tip: dekadaCela(d), hodnoty };
    });

    // Věk v době centerfoldu: do 17, jednotlivé roky, 30 a víc
    const skupinaVeku = v => v < 18 ? 17 : v > 29 ? 30 : v;
    const popisVeku = v => v === 17 ? '≤17' : v === 30 ? '30+' : String(v);
    const vekove = [...new Set(veky.map(skupinaVeku))].sort((a, b) => a - b);
    const sloupceVeku = vekove.length ? Array.from({ length: vekove.at(-1) - vekove[0] + 1 }, (_, i) => vekove[0] + i).map(v => {
        const tyto = centerfoldy.filter(c => c.vek !== null && skupinaVeku(c.vek) === v);
        const vyber = `vek:${v}`;
        vybery.set(vyber, { nazev: `Věk ${popisVeku(v)} let v době centerfoldu`, seznam: unikatni(tyto.map(c => c.m)),
            detail: m => tyto.filter(c => c.m === m).map(c => `${c.vek} let · ${nazevVydani(c.v)}`).join(', ') });
        return { popisek: popisVeku(v), hodnota: tyto.length, tip: `${popisVeku(v)} let: ${sklonovat(tyto.length, 'centerfold', 'centerfoldy', 'centerfoldů')}`, vyber };
    }) : [];

    // Vzhled a hodnocení
    const vlasy = podleHodnoty(modelky, m => m.vlasyBarva);
    const oci = podleHodnoty(modelky, m => m.ociBarva);
    const srdicka = [0, 1, 2, 3, 4, 5].map(n => {
        const tyto = modelky.filter(m => (m.hodnoceni || 0) === n);
        const vyber = `srd:${n}`;
        vybery.set(vyber, { nazev: n ? `Hodnocení ${'♥'.repeat(n)}` : 'Bez hodnocení', seznam: tyto, dotaz: n ? `hodnoceni:${n}` : null });
        return { popisek: n ? `${n} ♥` : 'bez', hodnota: tyto.length, tip: `${n ? `${n} ♥` : 'Bez hodnocení'}: ${pocetModelek(tyto.length)}`, vyber };
    });

    // Přibývání sbírky: modelky přidané v posledních 12 měsících
    const mesice = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(dnes.getFullYear(), dnes.getMonth() - 11 + i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const sloupcePribyvani = mesice.map(k => {
        const tyto = modelky.filter(m => (m.pridano || '').startsWith(k));
        const nazev = `${MESICE[parseInt(k.slice(5)) - 1]} ${k.slice(0, 4)}`;
        const vyber = `prib:${k}`;
        vybery.set(vyber, { nazev: `Přidané v měsíci ${nazev}`, seznam: tyto });
        return { popisek: MESICE[parseInt(k.slice(5)) - 1].slice(0, 3), hodnota: tyto.length, tip: `${nazev}: ${pocetModelek(tyto.length)}`, vyber };
    });
    const nicNepribylo = sloupcePribyvani.every(p => !p.hodnota);

    // Fotografové z backendu; modelky se dohledají hledáním až po kliknutí
    const fotografove = s.fotografove.map(f => {
        const vyber = `fot:${f.nazev}`;
        vybery.set(vyber, { nazev: `Fotograf ${f.nazev}`, nacist: () => GetModelky(`fotograf:"${f.nazev}"`), dotaz: `fotograf:"${f.nazev}"` });
        return { ...f, tip: sklonovat(f.pocet, 'album', 'alba', 'alb'), vyber };
    });

    // Čísla ve sbírce podle edic (bez výběru modelek), jen když jsou aspoň dvě edice
    const ediceCisel = EDICE.filter(e => s.desetileti.some(d => d.edice?.[e]));
    const radkyCisel = s.desetileti.filter(d => ediceCisel.some(e => d.edice?.[e])).map(d => ({
        popisek: dekadaKratce(d.desetileti), tip: dekadaCela(d.desetileti),
        hodnoty: Object.fromEntries(ediceCisel.map(e => [e, { hodnota: d.edice?.[e] || 0 }])),
    }));

    const karty = [
        karta('Kategorie', radkyKategorii.length ? grafPruhu(radkyKategorii) : prazdne('Kategorie se volí v „Upravit modelku…“.')),
        karta('Centerfoldy podle desetiletí', radkyCf.length ? (edice.length > 1 ? legenda(edice) : '') + grafSkupin(radkyCf, edice)
            : prazdne('Centerfoldy se počítají podle vydání.')),
        karta('Věk v době centerfoldu', sloupceVeku.length ? grafSloupcu(sloupceVeku)
            + `<p class="stat-pozn">Z ${sklonovat(veky.length, 'centerfoldu', 'centerfoldů', 'centerfoldů')}, u kterých je známý aspoň měsíc a rok narození modelky.</p>`
            : prazdne('Věk se počítá z data narození modelky (aspoň rok a měsíc) a vydání centerfoldu.')),
        karta('Národnosti', narodnosti.length ? grafPruhu(zebricek(narodnosti, 'nar', { dotaz: n => `narodnost:"${n}"` }))
            + (narodnosti.length > 8 ? `<p class="stat-pozn">8 nejčastějších z ${sklonovat(narodnosti.length, 'země', 'zemí', 'zemí')}.</p>` : '')
            : prazdne('Národnost se zapisuje u modelky.')),
        karta('Barva vlasů', vlasy.length ? grafPruhu(zebricek(vlasy, 'vlasy', { nejvic: 6, dotaz: n => `vlasy:"${n}"` })) : prazdne('Barva vlasů se zapisuje u modelky.')),
        karta('Barva očí', oci.length ? grafPruhu(zebricek(oci, 'oci', { nejvic: 6, dotaz: n => `oci:"${n}"` })) : prazdne('Barva očí se zapisuje u modelky.')),
        karta('Hodnocení modelek', modelky.length ? grafSloupcu(srdicka) : prazdne('Zatím žádné modelky.')),
        karta('Přibývání sbírky', nicNepribylo ? prazdne('Za posledních 12 měsíců nepřibyla žádná modelka.') : grafSloupcu(sloupcePribyvani)
            + '<p class="stat-pozn">Modelky přidané po měsících za poslední rok.</p>'),
        karta('Nejčastější fotografové', fotografove.length ? grafPruhu(fotografove)
            + (s.fotografuCelkem > fotografove.length ? `<p class="stat-pozn">${fotografove.length} nejčastějších z ${sklonovat(s.fotografuCelkem, 'fotografa', 'fotografů', 'fotografů')}.</p>` : '')
            : prazdne('Fotograf se zapisuje u alba (Upravit album).')),
    ];
    if (ediceCisel.length > 1) karty.push(karta('Čísla ve sbírce podle edic a desetiletí', legenda(ediceCisel) + grafSkupin(radkyCisel, ediceCisel)));
    // Lichý počet karet: poslední přes celou šířku, ať v řadě nezůstane díra
    if (karty.length % 2) karty[karty.length - 1] = karty.at(-1).replace('class="stat-karta ', 'class="stat-karta siroka ');

    return `
        <h3>Statistiky sbírky</h3>
        <div class="stat-cisla">${cisla.map(([nadpis, hodnota, veta, vyber]) => `
            <div class="stat-cislo" ${vyber ? `data-vyber="${vyber}" tabindex="0" role="button" title="Klik ukáže modelky"` : ''}>
                <div class="stat-karta-nadpis">${nadpis}</div><div class="stat-velke">${hodnota}</div><p>${veta}</p></div>`).join('')}
        </div>
        <div class="stat-grafy">${karty.join('')}</div>
        <!-- Vývoj v čase se počítá zvlášť (app/vyvoj.js) -->
        <div class="vyvoj" data-vyvoj><p class="stat-prazdne">Počítám vývoj v čase…</p></div>
        <div class="graf-bublina hidden"></div>`;
}

// Načtení a vykreslení do oddílu Přehledu; volá se při prvním zobrazení oddílu
export async function nacistStatistiky(koren) {
    if (!koren || koren.dataset.nacteno) return;
    koren.dataset.nacteno = '1';
    const [s, modelky] = await Promise.all([GetStatistiky(), vsechnyModelky()]);
    if (!koren.isConnected) return;
    koren.innerHTML = htmlStatistik(s, modelky);
    nacistVyvoj(koren.querySelector('[data-vyvoj]'));
}

// Výběr modelek pod řadou grafů, ve které je kliknutý sloupec (u čísel nahoře pod nimi)
const ZOBRAZIT_NAJEDNOU = 48;
let otevrenyVyber = '';
// Modelky zobrazené v panelu výběru podle id (pro otevření profilu)
const modelkyPanelu = new WeakMap();

function zavritVyber(koren) {
    koren.querySelector('.stat-vyber')?.remove();
    koren.querySelectorAll('.vybrany').forEach(p => p.classList.remove('vybrany'));
    otevrenyVyber = '';
}

async function ukazatVyber(prvek, vse = false) {
    const koren = prvek.closest('.stat-section');
    const klic = prvek.dataset.vyber;
    const vyber = vybery.get(klic);
    if (!koren || !vyber) return;
    if (otevrenyVyber === klic && !vse) {
        zavritVyber(koren);
        return;
    }
    zavritVyber(koren);
    otevrenyVyber = klic;
    koren.querySelectorAll(`[data-vyber="${CSS.escape(klic)}"]`).forEach(p => p.classList.add('vybrany'));

    // Místo vložení: za poslední kartu ve stejné řadě mřížky
    const kartaGrafu = prvek.closest('.stat-karta');
    let za = /** @type {Element} */ (prvek.closest('.stat-cisla'));
    if (kartaGrafu) {
        za = kartaGrafu;
        for (let dalsi = kartaGrafu.nextElementSibling; dalsi && /** @type {HTMLElement} */ (dalsi).offsetTop === /** @type {HTMLElement} */ (kartaGrafu).offsetTop; dalsi = dalsi.nextElementSibling) za = dalsi;
    }
    const panel = document.createElement('div');
    panel.className = 'stat-karta siroka stat-vyber';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', vyber.nazev);
    panel.innerHTML = '<p class="stat-prazdne">Hledám modelky…</p>';
    za.after(panel);

    const seznam = vyber.seznam || (vyber.seznam = await vyber.nacist() || []);
    if (otevrenyVyber !== klic) return;
    const serazene = [...seznam].sort((a, b) => (b.hodnoceni || 0) - (a.hodnoceni || 0) || a.jmeno.localeCompare(b.jmeno, 'cs'));
    const zobrazene = vse ? serazene : serazene.slice(0, ZOBRAZIT_NAJEDNOU);
    const detail = vyber.detail || (m => kategorieModelky(m).filter(k => !k.odvozena).map(popisKategorie).join(', ') || (m.vydani?.[0] ? nazevVydani(m.vydani[0]) : ''));
    panel.innerHTML = `
        <div class="stat-vyber-hlavicka">
            <h4>${esc(vyber.nazev)} · ${pocetModelek(seznam.length)}</h4>
            <button type="button" class="link" data-zavrit-vyber>Zavřít</button>
        </div>
        <p class="stat-pozn">Klik na modelku otevře profil · Esc výběr zavře</p>
        ${seznam.length ? `<div class="stat-vyber-mrizka">${zobrazene.map(m => `
            <button type="button" class="stat-vyber-modelka" data-modelka-vyberu="${m.id}">
                <img data-src="${esc(adresaTitulni(m))}" alt="" draggable="false" />
                <span>${esc(m.jmeno)}</span><small>${esc(detail(m))}</small>
            </button>`).join('')}</div>` : prazdne('Žádná modelka.')}
        <div class="stat-vyber-akce">
            ${zobrazene.length < seznam.length ? `<button type="button" class="link" data-vse-vyberu="${esc(klic)}">Zobrazit všech ${seznam.length}</button>` : ''}
            ${vyber.dotaz && seznam.length ? `<button type="button" class="btn btn-secondary btn-small" data-vyber-galerie="${esc(vyber.dotaz)}">Zobrazit v galerii →</button>` : ''}
        </div>`;
    modelkyPanelu.set(panel, new Map(seznam.map(m => [m.id, m])));
    nacitatPostupne(panel);
    panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// Bublina u sloupce nebo řádku grafu pod myší; klik a klávesnice pro výběr modelek
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
        const modelka = cil.closest('[data-modelka-vyberu]');
        if (modelka) {
            const m = modelkyPanelu.get(modelka.closest('.stat-vyber'))?.get(parseInt(modelka.dataset.modelkaVyberu));
            if (m) otevritDetailModelky(m);
            return;
        }
        const galerie = cil.closest('[data-vyber-galerie]');
        if (galerie) {
            hledatHodnotu(galerie.dataset.vyberGalerie);
            return;
        }
        const vse = cil.closest('[data-vse-vyberu]');
        if (vse) {
            const zdroj = stats.querySelector(`.stat-section [data-vyber="${CSS.escape(vse.dataset.vseVyberu)}"]`);
            if (zdroj) ukazatVyber(/** @type {HTMLElement} */ (zdroj), true);
            return;
        }
        if (cil.closest('[data-zavrit-vyber]')) {
            zavritVyber(cil.closest('.stat-section'));
            return;
        }
        const vyber = cil.closest('[data-vyber]');
        if (vyber && stats.contains(vyber)) ukazatVyber(/** @type {HTMLElement} */ (vyber));
    });
    stats.addEventListener('keydown', (e) => {
        const cil = /** @type {HTMLElement} */ (e.target);
        if ((e.key === 'Enter' || e.key === ' ') && cil.matches?.('[data-vyber]')) {
            e.preventDefault();
            ukazatVyber(cil);
        } else if (e.key === 'Escape' && otevrenyVyber) {
            const koren = stats.querySelector('.stat-vyber')?.closest('.stat-section');
            if (!koren) return;
            e.preventDefault();
            e.stopPropagation();
            const zdroj = /** @type {HTMLElement} */ (koren.querySelector('.vybrany'));
            zavritVyber(koren);
            zdroj?.focus();
        }
    });
}
