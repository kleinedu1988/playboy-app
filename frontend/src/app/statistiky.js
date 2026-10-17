// Statistiky sbírky v Přehledu: nahoře řádek velkých čísel s větou, pod ním karty s grafy (sloupce, pruhy,
// srovnání edic). Grafy jsou SVG; najetí myší na sloupec nebo řádek ukáže bublinu s hodnotou.
import { GetStatistiky } from './backend';
import { EDICE, esc, sklonovat } from '../lib/format';

// Jedna řada má barvu akcentu; edice US a CZ růžová a modrá (dvojice ověřená na čitelnost i pro barvoslepé)
const BARVY_EDIC = { US: '#d81b60', CZ: '#2f8fe0' };
const BARVA = BARVY_EDIC.US;

const dekadaKratce = d => `${String(d).slice(2)}.`;
const dekadaCela = d => `${d}–${d + 9}`;
const cislo = n => String(n).replace('.', ',');

// Zaoblený jen horní konec sloupce (4 px), dno sedí na ose
const sloupec = (x, y, sirka, vyska) => vyska <= 0 ? ''
    : `M${x},${y + vyska} V${y + Math.min(4, vyska)} q0,-${Math.min(4, vyska)} ${Math.min(4, sirka / 2)},-${Math.min(4, vyska)} h${sirka - 2 * Math.min(4, sirka / 2)} q${Math.min(4, sirka / 2)},0 ${Math.min(4, sirka / 2)},${Math.min(4, vyska)} V${y + vyska}Z`;

// Svislé sloupce jedné řady; popisek hodnoty jen u maxima (ostatní v bublině)
function grafSloupcu(polozky, { sirka = 460, vyska = 190 } = {}) {
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

// Vodorovné pruhy žebříčku: název vlevo, hodnota za pruhem; nejkratší pruh je jen zaoblený konec (4 px)
function grafPruhu(polozky, { sirka = 460, radek = 26, prostor = 128 } = {}) {
    const max = Math.max(1, ...polozky.map(p => p.pocet));
    return `<svg class="graf" viewBox="0 0 ${sirka} ${polozky.length * radek}" role="img">
        ${polozky.map((p, i) => {
            const y = i * radek + 7, d = Math.max(4, (sirka - prostor - 44) * p.pocet / max);
            return `<g data-tip="${esc(`${p.nazev}: ${p.tip}`)}">
                <rect class="graf-cil" x="0" y="${i * radek}" width="${sirka}" height="${radek}"/>
                <text class="graf-nazev" x="${prostor - 10}" y="${y + 9}" text-anchor="end">${esc(p.nazev.length > 20 ? p.nazev.slice(0, 19) + '…' : p.nazev)}</text>
                <path d="M${prostor},${y} h${d - 4} q4,0 4,4 v4 q0,4 -4,4 h-${d - 4}Z" fill="${BARVA}"/>
                <text class="graf-popisek" x="${prostor + d + 8}" y="${y + 9}">${p.pocet}</text>
            </g>`;
        }).join('')}</svg>`;
}

// Seskupené sloupce edic po desetiletích; mezi sloupci páru mezera 2 px, hodnoty přímo nad sloupci
function grafEdic(radky, edice, { sirka = 900, vyska = 200 } = {}) {
    const max = Math.max(1, ...radky.flatMap(r => edice.map(e => r.edice[e] || 0)));
    const dole = 22, nahore = 18, krok = sirka / radky.length, sl = Math.min(26, krok / (edice.length + 1));
    const vyskaPlochy = vyska - dole - nahore;
    return `<svg class="graf" viewBox="0 0 ${sirka} ${vyska}" role="img">
        <line class="graf-osa" x1="0" x2="${sirka}" y1="${vyska - dole}" y2="${vyska - dole}"/>
        ${radky.map((r, i) => {
            const stred = i * krok + krok / 2, zacatek = stred - (edice.length * sl + (edice.length - 1) * 2) / 2;
            const tip = `${dekadaCela(r.desetileti)}: ${edice.map(e => `${e} ${r.edice[e] || 0}`).join(' · ')}`;
            return `<g data-tip="${esc(tip)}">
                <rect class="graf-cil" x="${i * krok}" y="0" width="${krok}" height="${vyska}"/>
                ${edice.map((e, k) => {
                    const h = r.edice[e] || 0, v = vyskaPlochy * h / max, x = zacatek + k * (sl + 2), y = vyska - dole - v;
                    return `<path d="${sloupec(x, y, sl, v)}" fill="${BARVY_EDIC[e] || BARVA}"/>`
                        + (h ? `<text class="graf-hodnota" x="${x + sl / 2}" y="${y - 6}" text-anchor="middle">${h}</text>` : '');
                }).join('')}
                <text class="graf-popisek" x="${stred}" y="${vyska - 6}" text-anchor="middle">${dekadaKratce(r.desetileti)}</text>
            </g>`;
        }).join('')}</svg>`;
}

const karta = (nadpis, obsah, siroka = false) => `<div class="stat-karta ${siroka ? 'siroka' : ''}"><div class="stat-karta-nadpis">${nadpis}</div>${obsah}</div>`;
const prazdne = text => `<p class="stat-prazdne">${text}</p>`;

function htmlStatistik(s) {
    const dek = s.desetileti.filter(d => d.centerfoldy);
    const nejvic = Math.max(0, ...dek.map(d => d.centerfoldy));
    const nejlepsiDekady = dek.filter(d => d.centerfoldy === nejvic).map(d => `${dekadaKratce(d.desetileti)}`);
    const prvniFotograf = s.fotografove[0];
    const prvniNarodnost = s.narodnosti[0];
    const podil = prvniNarodnost && s.modelekSNarodnosti ? Math.round(prvniNarodnost.pocet / s.modelekSNarodnosti * 100) : 0;

    const cisla = [
        ['Centerfoldy', s.centerfoldu, dek.length ? `${sklonovat(s.centerfoldu, 'centerfold', 'centerfoldy', 'centerfoldů').replace(/^\d+\s/, '')}, nejvíc z <strong>${nejlepsiDekady.join(' a ')} let</strong>` : 'zatím žádný centerfold s vydáním'],
        ['Věk', s.vekZnamy ? cislo(s.vekMedian) : '–', s.vekZnamy ? `let medián, nejčastěji <strong>${s.vekNejcastejsi}</strong>` : 'chybí data narození modelek'],
        ['Fotograf', prvniFotograf ? prvniFotograf.pocet : '–', prvniFotograf ? `alb, nejčastěji <strong>${esc(prvniFotograf.nazev)}</strong>` : 'u alb zatím není fotograf'],
        ['Národnosti', s.narodnostiCelkem || '–', prvniNarodnost ? `${sklonovat(s.narodnostiCelkem, 'země', 'země', 'zemí').replace(/^\d+\s/, '')}, <strong>${esc(prvniNarodnost.nazev)} ${podil} %</strong>` : 'u modelek zatím není národnost'],
    ];

    // Srovnání edic jen tehdy, když jsou ve sbírce čísla aspoň dvou edic
    const edice = EDICE.filter(e => s.desetileti.some(d => d.edice?.[e]));
    const radkyEdic = s.desetileti.filter(d => edice.some(e => d.edice?.[e]));

    return `
        <h3>Statistiky sbírky</h3>
        <div class="stat-cisla">${cisla.map(([nadpis, hodnota, veta]) => `
            <div><div class="stat-karta-nadpis">${nadpis}</div><div class="stat-velke">${hodnota}</div><p>${veta}</p></div>`).join('')}
        </div>
        <div class="stat-grafy">
            ${karta('Centerfoldy podle desetiletí', dek.length ? grafSloupcu(s.desetileti.map(d => ({
                popisek: dekadaKratce(d.desetileti), hodnota: d.centerfoldy,
                tip: `${dekadaCela(d.desetileti)}: ${sklonovat(d.centerfoldy, 'centerfold', 'centerfoldy', 'centerfoldů')} · ${sklonovat(d.cisla, 'číslo', 'čísla', 'čísel')}`,
            }))) : prazdne('Centerfoldy se počítají podle vydání.'))}
            ${karta('Věk v době centerfoldu', s.vekZnamy ? grafSloupcu(s.vek.map(v => ({
                popisek: v.nazev, hodnota: v.pocet, tip: `${v.nazev} let: ${sklonovat(v.pocet, 'centerfold', 'centerfoldy', 'centerfoldů')}`,
            }))) + `<p class="stat-pozn">Z ${sklonovat(s.vekZnamy, 'centerfoldu', 'centerfoldů', 'centerfoldů')}, u kterých je známý aspoň měsíc a rok narození modelky.</p>`
                : prazdne('Věk se počítá z data narození modelky (aspoň rok a měsíc) a vydání centerfoldu.'))}
            ${karta('Nejčastější fotografové', s.fotografove.length ? grafPruhu(s.fotografove.map(f => ({ ...f, tip: sklonovat(f.pocet, 'album', 'alba', 'alb') })))
                + (s.fotografuCelkem > s.fotografove.length ? `<p class="stat-pozn">${s.fotografove.length} nejčastějších z ${sklonovat(s.fotografuCelkem, 'fotografa', 'fotografů', 'fotografů')}.</p>` : '')
                : prazdne('Fotograf se zapisuje u alba (Upravit album).'))}
            ${karta('Národnosti', s.narodnosti.length ? grafPruhu(s.narodnosti.map(n => ({ ...n, tip: sklonovat(n.pocet, 'modelka', 'modelky', 'modelek') })))
                + (s.narodnostiCelkem > s.narodnosti.length ? `<p class="stat-pozn">${s.narodnosti.length} nejčastějších z ${sklonovat(s.narodnostiCelkem, 'země', 'zemí', 'zemí')}.</p>` : '')
                : prazdne('Národnost se zapisuje u modelky.'))}
            ${edice.length > 1 ? karta('Čísla ve sbírce podle edic a desetiletí',
                `<div class="stat-legenda">${edice.map(e => `<span><i style="background:${BARVY_EDIC[e] || BARVA}"></i>${e}</span>`).join('')}</div>` + grafEdic(radkyEdic, edice), true) : ''}
        </div>
        <div class="graf-bublina hidden"></div>`;
}

// Načtení a vykreslení do oddílu Přehledu; volá se při prvním zobrazení oddílu
export async function nacistStatistiky(koren) {
    if (!koren || koren.dataset.nacteno) return;
    koren.dataset.nacteno = '1';
    const s = await GetStatistiky();
    if (!koren.isConnected) return;
    koren.innerHTML = htmlStatistik(s);
}

// Bublina u sloupce nebo řádku grafu pod myší
export function pripravit(stats) {
    stats.addEventListener('mousemove', (e) => {
        const bublina = stats.querySelector('.graf-bublina');
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
    stats.addEventListener('mouseleave', () => stats.querySelector('.graf-bublina')?.classList.add('hidden'));
}
