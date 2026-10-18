// Vývoj v čase ve Statistikách: tabulka údajů po desetiletích (medián nebo podíl, pod ním počet modelek) a pod ní
// graf vybraného řádku. Číselný údaj má čáru mediánu po pětiletích s pásmem prostřední poloviny modelek, podíl
// sloupce po desetiletích rozdělené na sto procent. Sytost buňky ukazuje, kde je hodnota v řádku nejvyšší.
import { GetVyvojVCase } from './backend';
import { esc } from '../lib/format';

// Kategorie podílů: barvy v pevném pořadí (ověřené na tmavém pozadí i pro barvoslepé), „Ne“ a „Jiné“ jsou šedé
const BARVY = ['#d81b60', '#3987e5', '#c98500', '#199e70'];
const SEDA = '#5f5f66';
// Období s menším počtem modelek je v tabulce tlumené (málo dat)
const MALO_DAT = 5;

let edice = 'US';
let vybrany = 'vek';
let data = null;

const cislo = n => (Math.round(n * 10) / 10).toLocaleString('cs-CZ');
const dekada = d => `${String(d).slice(2)}. léta`;
const procent = (pocet, n) => Math.round(pocet / n * 100);
const barva = (kategorie, i) => kategorie === 'Ne' || kategorie === 'Jiné' ? SEDA : BARVY[i % BARVY.length];

// Řádky tabulky: { klic, nazev, jednotka, bunky: [{ hodnota, text, n } | null] }
function radkyTabulky(v) {
    const ciselne = v.ciselne.map(r => ({
        klic: r.klic, nazev: r.nazev, jednotka: r.jednotka,
        bunky: v.desetileti.map(d => {
            const b = r.desetileti.find(x => x.obdobi === d);
            return b ? { hodnota: b.median, text: cislo(b.median), n: b.n } : null;
        }),
    }));
    const podily = v.podily.map(p => ({
        klic: p.klic, nazev: p.nazevRadku, jednotka: '% modelek',
        bunky: p.desetileti.map(b => b.n ? { hodnota: procent(b.pocty[p.radek] || 0, b.n), text: `${procent(b.pocty[p.radek] || 0, b.n)} %`, n: b.n } : null),
    }));
    return [...ciselne, ...podily];
}

// Buňka: sytost podle hodnoty v řádku (jen období s dostatkem dat), malý počet modelek pod hodnotou
function htmlRadku(r) {
    const hodnoty = r.bunky.filter(b => b && b.n >= MALO_DAT).map(b => b.hodnota);
    const min = Math.min(...hodnoty), max = Math.max(...hodnoty);
    return `<tr class="${r.klic === vybrany ? 'active' : ''}" data-vyvoj-radek="${r.klic}" title="Ukázat graf">
        <td>${esc(r.nazev)}<small>${esc(r.jednotka)}</small></td>
        ${r.bunky.map(b => {
            if (!b) return '<td class="prazdna">—</td>';
            const malo = b.n < MALO_DAT;
            const sytost = malo || max === min ? 0.05 : 0.05 + (b.hodnota - min) / (max - min) * 0.32;
            return `<td class="${malo ? 'malo' : ''}" style="background-color: rgba(216, 27, 96, ${sytost.toFixed(2)})" ${malo ? 'title="Málo dat"' : ''}>${b.text}<small>n ${b.n}</small></td>`;
        }).join('')}
    </tr>`;
}

// Čára mediánu po pětiletích s pásmem kvartilů; popisky hodnot jen na začátku a konci, ostatní v bublině
function grafCary(r) {
    const body = r.petileti;
    if (body.length < 2) return '<p class="stat-prazdne">Na graf je málo dat.</p>';
    const W = 900, H = 260, L = 44, P = 70, T = 16, D = 44;
    const lo = Math.floor(Math.min(...body.map(b => b.dolni)) - 1), hi = Math.ceil(Math.max(...body.map(b => b.horni)) + 1);
    const od = body[0].obdobi, doR = body.at(-1).obdobi;
    const x = obdobi => L + (doR === od ? 0 : (obdobi - od) / (doR - od)) * (W - L - P);
    const y = h => T + (hi - h) / (hi - lo || 1) * (H - T - D);
    const krok = Math.max(1, Math.ceil((hi - lo) / 4));
    const mrizka = [];
    for (let h = Math.ceil(lo / krok) * krok; h <= hi; h += krok) {
        mrizka.push(`<line class="graf-mrizka" x1="${L}" x2="${W - P}" y1="${y(h)}" y2="${y(h)}"/><text class="graf-popisek" x="${L - 8}" y="${y(h) + 4}" text-anchor="end">${h}</text>`);
    }
    const pasmo = body.map(b => `${x(b.obdobi)},${y(b.horni)}`).concat(body.slice().reverse().map(b => `${x(b.obdobi)},${y(b.dolni)}`)).join(' ');
    const sirkaCile = (W - L - P) / Math.max(1, body.length - 1);
    return `<svg class="graf vyvoj-graf" viewBox="0 0 ${W} ${H}" role="img">
        ${mrizka.join('')}
        <line class="graf-osa" x1="${L}" x2="${W - P}" y1="${H - D}" y2="${H - D}"/>
        <polygon points="${pasmo}" fill="rgba(216, 27, 96, 0.16)"/>
        <polyline points="${body.map(b => `${x(b.obdobi)},${y(b.median)}`).join(' ')}" fill="none" stroke="#d81b60" stroke-width="2" stroke-linejoin="round"/>
        ${body.map((b, i) => `<g data-tip="${esc(`${b.obdobi}–${b.obdobi + 4}: medián ${cislo(b.median)} ${r.jednotka}, polovina modelek ${cislo(b.dolni)}–${cislo(b.horni)} · n ${b.n}`)}">
            <rect class="graf-cil" x="${x(b.obdobi) - sirkaCile / 2}" y="0" width="${sirkaCile}" height="${H}"/>
            <circle cx="${x(b.obdobi)}" cy="${y(b.median)}" r="4" fill="#d81b60" stroke="#202024" stroke-width="2"/>
            <text class="graf-popisek" x="${x(b.obdobi)}" y="${H - D + 17}" text-anchor="middle">${b.obdobi % 10 === 0 ? b.obdobi : `'${String(b.obdobi).slice(2)}`}</text>
            <text class="graf-popisek vyvoj-n" x="${x(b.obdobi)}" y="${H - D + 32}" text-anchor="middle">n ${b.n}</text>
            ${i === 0 || i === body.length - 1 ? `<text class="graf-hodnota" x="${x(b.obdobi) + (i ? 10 : 0)}" y="${y(b.median) + (i ? 4 : -10)}" text-anchor="${i ? 'start' : 'middle'}">${cislo(b.median)}${i ? ` ${r.jednotka}` : ''}</text>` : ''}
        </g>`).join('')}
    </svg>
    <div class="vyvoj-legenda"><span><i class="cara"></i>medián</span><span><i class="pasmo"></i>prostřední polovina modelek</span><span>n = modelek se známým údajem</span></div>`;
}

// Sloupce po desetiletích rozdělené na sto procent; popisek podílu jen u úseků od 12 %
function grafPodilu(p) {
    const body = p.desetileti.filter(b => b.n);
    if (!body.length) return '<p class="stat-prazdne">Na graf je málo dat.</p>';
    const W = 900, H = 240, L = 44, T = 10, D = 26;
    const krok = (W - L) / body.length, sirka = Math.min(90, krok * 0.62);
    const v = H - T - D;
    return `<svg class="graf vyvoj-graf" viewBox="0 0 ${W} ${H}" role="img">
        ${[0, 50, 100].map(h => `<text class="graf-popisek" x="${L - 8}" y="${T + (100 - h) / 100 * v + 4}" text-anchor="end">${h} %</text>`).join('')}
        ${body.map((b, i) => {
            const x0 = L + i * krok + (krok - sirka) / 2;
            let y0 = H - D;
            return p.kategorie.map((k, j) => {
                const podil = (b.pocty[k] || 0) / b.n;
                if (!podil) return '';
                const vyska = podil * v;
                y0 -= vyska;
                const pct = Math.round(podil * 100);
                return `<g data-tip="${esc(`${dekada(b.obdobi)}: ${k} ${pct} % (${b.pocty[k]} z ${b.n})`)}">
                    <rect x="${x0}" y="${y0 + 1}" width="${sirka}" height="${Math.max(0, vyska - 2)}" rx="3" fill="${barva(k, j)}"/>
                    ${pct >= 12 ? `<text class="vyvoj-podil" x="${x0 + sirka / 2}" y="${y0 + vyska / 2 + 4}" text-anchor="middle">${pct} %</text>` : ''}
                </g>`;
            }).join('') + `<text class="graf-popisek" x="${x0 + sirka / 2}" y="${H - D + 17}" text-anchor="middle">${String(b.obdobi).slice(2)}. · n ${b.n}</text>`;
        }).join('')}
    </svg>
    <div class="vyvoj-legenda">${p.kategorie.map((k, j) => `<span><i style="background-color: ${barva(k, j)}"></i>${esc(k)}</span>`).join('')}</div>`;
}

// Věta se závěrem: první a poslední desetiletí s dostatkem dat
function veta(radek) {
    const s = radek.bunky.map((b, i) => b && b.n >= MALO_DAT ? { ...b, d: data.desetileti[i] } : null).filter(Boolean);
    if (s.length < 2) return 'Na srovnání desetiletí je zatím málo dat.';
    const [a, b] = [s[0], s.at(-1)];
    const jednotka = radek.jednotka === '% modelek' ? '' : ` ${radek.jednotka}`;
    const smer = b.hodnota > a.hodnota ? 'vzrostl' : b.hodnota < a.hodnota ? 'klesl' : 'zůstal';
    return radek.jednotka === '% modelek'
        ? `${esc(radek.nazev)}: <b>${a.text}</b> modelek v ${dekada(a.d).replace(' léta', ' letech')}, <b>${b.text}</b> v ${dekada(b.d).replace(' léta', ' letech')}.`
        : `${esc(radek.nazev)}: medián ${smer} z <b>${a.text}${jednotka}</b> v ${dekada(a.d).replace(' léta', ' letech')} na <b>${b.text}${jednotka}</b> v ${dekada(b.d).replace(' léta', ' letech')}.`;
}

function vykreslit(koren) {
    if (!data.modelek) {
        koren.innerHTML = htmlHlavicky() + `<p class="stat-prazdne">V edici ${edice} zatím žádná modelka nemá centerfold, podle kterého by se dala zařadit do období.</p>`;
        return;
    }
    const radky = radkyTabulky(data);
    const radek = radky.find(r => r.klic === vybrany) || radky[0];
    vybrany = radek.klic;
    const rada = data.ciselne.find(r => r.klic === vybrany);
    const podil = data.podily.find(p => p.klic === vybrany);
    koren.innerHTML = htmlHlavicky() + `
        <div class="stat-karta siroka vyvoj-tabulka">
            <table>
                <thead><tr><th>Údaj</th>${data.desetileti.map(d => `<th>${dekada(d)}</th>`).join('')}</tr></thead>
                <tbody>${radky.map(htmlRadku).join('')}</tbody>
            </table>
        </div>
        <div class="stat-karta siroka">
            <div class="stat-karta-nadpis">${esc(radek.nazev)}${rada ? ' · medián po pětiletích' : ' · podíl po desetiletích'}</div>
            <p class="vyvoj-veta">${veta(radek)}</p>
            ${rada ? grafCary(rada) : grafPodilu(podil)}
        </div>`;
}

const htmlHlavicky = () => `
    <h3>Vývoj v čase <span>podle roku centerfoldu · ${data?.modelek || 0} modelek · klik na řádek ukáže graf</span>
        <span class="vyvoj-edice">${['US', 'CZ'].map(e => `<button type="button" class="${e === edice ? 'active' : ''}" data-vyvoj-edice="${e}">${e}</button>`).join('')}</span></h3>`;

export async function nacistVyvoj(koren) {
    if (!koren) return;
    data = await GetVyvojVCase(edice);
    if (koren.isConnected) vykreslit(koren);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit(stats) {
    stats.addEventListener('click', (e) => {
        const koren = e.target.closest('[data-vyvoj]');
        if (!koren) return;
        const radek = e.target.closest('[data-vyvoj-radek]');
        const tlacitkoEdice = e.target.closest('[data-vyvoj-edice]');
        if (radek) {
            vybrany = radek.dataset.vyvojRadek;
            vykreslit(koren);
        } else if (tlacitkoEdice && tlacitkoEdice.dataset.vyvojEdice !== edice) {
            edice = tlacitkoEdice.dataset.vyvojEdice;
            nacistVyvoj(koren);
        }
    });
}
