// Graf ven (ROADMAP 1.53): tabulka grafu jako CSV pro český Excel (středník, desetinná čárka, BOM) a obrázek
// SVG (i s plátnem mapy pod ním) jako PNG. Styly z CSS se do kopie SVG vepíšou, aby obrázek vypadal jako graf.

// Hodnota buňky: čísla s desetinnou čárkou, text v uvozovkách, když obsahuje středník, uvozovky nebo nový řádek
export function bunkaCsv(h) {
    if (h === null || h === undefined) return '';
    if (typeof h === 'number') return Number.isFinite(h) ? String(Math.round(h * 1000) / 1000).replace('.', ',') : '';
    const t = String(h);
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** @param {any[][]} radky */
export const csv = radky => `﻿${radky.map(r => r.map(bunkaCsv).join(';')).join('\r\n')}\r\n`;

// Bezpečný název souboru z názvu grafu
export const nazevSouboru = (nazev, pripona) => `${String(nazev || 'graf').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'graf'}.${pripona}`;

const STYLY = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'opacity', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline'];

// Kopie SVG s vepsanými styly
export function svgSeStyly(svg) {
    const kopie = /** @type {SVGSVGElement} */ (svg.cloneNode(true));
    const puvodni = [svg, ...svg.querySelectorAll('*')];
    const nove = [kopie, ...kopie.querySelectorAll('*')];
    puvodni.forEach((el, i) => {
        const cs = getComputedStyle(el);
        const styl = STYLY.map(k => `${k}:${cs.getPropertyValue(k)}`).join(';');
        nove[i].setAttribute('style', `${nove[i].getAttribute('style') || ''};${styl}`);
    });
    kopie.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return new XMLSerializer().serializeToString(kopie);
}

// Graf v místě (SVG, případně plátno mapy pod ním) jako data URL PNG ve dvojnásobném rozlišení
export async function pngGrafu(misto, pozadi = '#141416') {
    const svg = misto.querySelector('svg');
    if (!svg) return null;
    const W = svg.width.baseVal.value || svg.clientWidth, H = svg.height.baseVal.value || svg.clientHeight;
    const meritko = 2;
    const platno = document.createElement('canvas');
    platno.width = W * meritko;
    platno.height = H * meritko;
    const c = platno.getContext('2d');
    c.fillStyle = pozadi;
    c.fillRect(0, 0, platno.width, platno.height);
    const mapa = /** @type {HTMLCanvasElement | null} */ (misto.querySelector('canvas'));
    if (mapa) c.drawImage(mapa, 0, 0, platno.width, platno.height);
    const url = URL.createObjectURL(new Blob([svgSeStyly(svg)], { type: 'image/svg+xml' }));
    try {
        const img = new Image();
        await new Promise((ok, chyba) => { img.onload = ok; img.onerror = chyba; img.src = url; });
        c.drawImage(img, 0, 0, platno.width, platno.height);
    } finally {
        URL.revokeObjectURL(url);
    }
    return platno.toDataURL('image/png');
}
