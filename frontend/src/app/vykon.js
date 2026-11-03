// Přehled výkonu (nabídka ⋯ › Nápověda): jak dlouho trvala volání backendu v tomto spuštění a jak dlouho trval
// start. Slouží k měření na skutečném počítači – text jde zkopírovat a poslat. Data jsou jen v paměti okna.
import { esc } from '../lib/format';
import { oznamit } from '../ui/oznameni';

/** @type {Map<string, { n: number, soucet: number, max: number }>} */
const volani = new Map();
/** @type {{ jmeno: string, ms: number, cas: number }[]} */
const pomala = [];
const POMALE_MS = 100;
let start = 0;
let panel = null;

// Volá backend.js u každého volání backendu
export function zaznamenatVolani(jmeno, ms) {
    const x = volani.get(jmeno) || { n: 0, soucet: 0, max: 0 };
    x.n++;
    x.soucet += ms;
    x.max = Math.max(x.max, ms);
    volani.set(jmeno, x);
    if (ms >= POMALE_MS) {
        pomala.push({ jmeno, ms, cas: performance.now() });
        if (pomala.length > 40) pomala.shift();
    }
}

// Konec úvodní obrazovky (main.js)
export function zaznamenatStart() {
    start = performance.now();
}

const ms = n => `${Math.round(n).toLocaleString('cs-CZ')} ms`;

function radky() {
    return [...volani].sort((a, b) => b[1].soucet - a[1].soucet);
}

function text() {
    const r = [`Playboy Database – přehled výkonu (${new Date().toLocaleString('cs-CZ')})`, `Start do zobrazení: ${ms(start)}`, '',
        'Volání: počet · průměr · nejdéle · celkem'];
    radky().forEach(([j, x]) => r.push(`${j}: ${x.n} · ${ms(x.soucet / x.n)} · ${ms(x.max)} · ${ms(x.soucet)}`));
    if (pomala.length) {
        r.push('', `Pomalá volání (nad ${POMALE_MS} ms), od startu:`);
        pomala.forEach(p => r.push(`${(p.cas / 1000).toFixed(1)} s: ${p.jmeno} ${ms(p.ms)}`));
    }
    return r.join('\n');
}

function vykreslit() {
    const telo = panel.querySelector('.vykon-telo');
    const tabulka = radky().slice(0, 40).map(([j, x]) => `<tr><td>${esc(j)}</td><td>${x.n}</td><td>${ms(x.soucet / x.n)}</td><td>${ms(x.max)}</td><td>${ms(x.soucet)}</td></tr>`).join('');
    telo.innerHTML = `
        <p class="vykon-start">Start do zobrazení: <b>${ms(start)}</b> · volání backendu: <b>${[...volani.values()].reduce((s, x) => s + x.n, 0)}</b></p>
        ${tabulka ? `<table class="vykon-tabulka"><thead><tr><th>Volání</th><th>Počet</th><th>Průměr</th><th>Nejdéle</th><th>Celkem</th></tr></thead><tbody>${tabulka}</tbody></table>` : '<p class="prazdno-male">Zatím žádná volání.</p>'}
        ${pomala.length ? `<h4>Pomalá volání (nad ${POMALE_MS} ms)</h4><ul class="vykon-pomala">${pomala.slice(-15).reverse().map(p => `<li><span>${(p.cas / 1000).toFixed(1)} s</span> ${esc(p.jmeno)} <b>${ms(p.ms)}</b></li>`).join('')}</ul>` : ''}`;
}

function pripravitPanel() {
    panel = document.createElement('div');
    panel.className = 'zkratky-zavoj hidden';
    panel.innerHTML = `
        <div class="zkratky vykon" role="dialog" aria-modal="true" aria-labelledby="vykonNadpis" tabindex="-1">
            <h3 id="vykonNadpis">Přehled výkonu</h3>
            <div class="vykon-telo"></div>
            <div class="zkratky-pata">
                <span>Časy v tomto spuštění · <kbd>Esc</kbd> zavře</span>
                <span><button type="button" class="link" data-vykon-vynulovat>Vynulovat</button>
                <button type="button" class="btn btn-secondary btn-small" data-vykon-kopirovat>Kopírovat jako text</button></span>
            </div>
        </div>`;
    document.body.append(panel);
    panel.addEventListener('click', async (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (t.closest('[data-vykon-kopirovat]')) {
            try {
                await navigator.clipboard.writeText(text());
                oznamit('Přehled výkonu je ve schránce.');
            } catch { oznamit('Text se nepodařilo zkopírovat.'); }
        } else if (t.closest('[data-vykon-vynulovat]')) {
            volani.clear();
            pomala.length = 0;
            vykreslit();
        } else if (!t.closest('.zkratky')) zavrit();
    });
    panel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            zavrit();
        }
    });
}

export function otevritVykon() {
    if (!panel) pripravitPanel();
    vykreslit();
    panel.classList.remove('hidden');
    /** @type {HTMLElement} */ (panel.querySelector('.zkratky')).focus({ preventScroll: true });
}

function zavrit() {
    panel?.classList.add('hidden');
}
