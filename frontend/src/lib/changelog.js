// Novinky z CHANGELOG.md: rozdělení po verzích a jednoduchý převod na HTML (nadpisy, odrážky, `kód`)
import { esc } from './format.js';

// „0.14.0-dev" → [0, 14, 0]; neplatné → null
export function cislaVerze(verze) {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(verze || '');
    return m ? m.slice(1).map(Number) : null;
}

// Předběžná verze je nižší než vydaná (1.0.0-alpha.2 < 1.0.0-beta.1 < 1.0.0-rc.1 < 1.0.0); -dev se nepočítá
const PORADI_PREDBEZNYCH = { alpha: 1, beta: 2, rc: 3 };
function predbezna(verze) {
    const m = /^\d+\.\d+\.\d+-(alpha|beta|rc)\.(\d+)/.exec(verze || '');
    return m ? [PORADI_PREDBEZNYCH[m[1]], Number(m[2])] : [9, 0];
}

export function porovnatVerze(a, b) {
    const x = cislaVerze(a) || [0, 0, 0], y = cislaVerze(b) || [0, 0, 0];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    const [pa, na] = predbezna(a), [pb, nb] = predbezna(b);
    return pa !== pb ? pa - pb : na - nb;
}

// [{ verze, datum, telo }] od nejnovější; úvod souboru před první verzí se vynechá
export function verzeZChangelogu(text) {
    const verze = [];
    let aktualni = null;
    for (const radek of String(text || '').split('\n')) {
        const m = /^## \[([^\]]+)\]\s*[–-]\s*(.*)$/.exec(radek);
        if (m) {
            aktualni = { verze: m[1], datum: m[2].trim(), telo: [] };
            verze.push(aktualni);
        } else if (aktualni) {
            aktualni.telo.push(radek);
        }
    }
    return verze.map(v => ({ ...v, telo: v.telo.join('\n').trim() }));
}

// Verze novější než „od" a nejvýš „do" (včetně); bez „od" všechny do „do"
export function novinkyMezi(text, od, doVerze) {
    return verzeZChangelogu(text).filter(v => (!od || porovnatVerze(v.verze, od) > 0) && porovnatVerze(v.verze, doVerze) <= 0);
}

const vradku = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

// Tělo verze na HTML: odstavce, „### Nadpis", odrážky „- " včetně pokračovacích řádků
export function telaNaHtml(verze) {
    return verze.map(v => {
        const casti = [];
        let seznam = null, odstavec = null;
        const ukoncit = () => {
            if (seznam) casti.push(`<ul>${seznam.map(p => `<li>${vradku(p)}</li>`).join('')}</ul>`);
            if (odstavec) casti.push(`<p>${vradku(odstavec)}</p>`);
            seznam = odstavec = null;
        };
        for (const radek of v.telo.split('\n')) {
            const t = radek.trim();
            if (!t) { ukoncit(); continue; }
            if (t.startsWith('### ')) { ukoncit(); casti.push(`<h5>${vradku(t.slice(4))}</h5>`); continue; }
            if (t.startsWith('- ')) {
                if (odstavec) ukoncit();
                (seznam ||= []).push(t.slice(2));
                continue;
            }
            if (seznam) seznam[seznam.length - 1] += ' ' + t;
            else odstavec = odstavec ? `${odstavec} ${t}` : t;
        }
        ukoncit();
        const datum = /^\d{4}-\d{2}-\d{2}$/.test(v.datum) ? v.datum.split('-').reverse().map(Number).join('. ') : v.datum;
        return `<section class="novinky-verze"><h4>Verze ${esc(v.verze)} <span>${esc(datum)}</span></h4>${casti.join('')}</section>`;
    }).join('');
}
