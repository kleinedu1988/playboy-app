// Mapa sbírky na <canvas> (ROADMAP 1.53): nad PRAH_PLATNA bodů se body nekreslí jako prvky SVG, ale do plátna.
// Nad plátnem zůstává průhledná vrstva SVG (laso, zvýrazněná modelka) se stejnými rozměry, takže výběr lasem
// funguje beze změny; bublinu a klik najde bodNaMiste() přes mřížku.

export const PRAH_PLATNA = 2000;
const BUNKA = 12;

/** @typedef {{ cx: number, cy: number, r: number, barva: string, dute: boolean, tlum: boolean, id: number, tip: string }} BodKresby */
/** @type {{ W: number, H: number, body: BodKresby[], mrizka: Map<number, BodKresby[]> } | null} */
let kresba = null;

/** @param {number} W @param {number} H @param {BodKresby[]} body */
export function pripravitKresbu(W, H, body) {
    const mrizka = new Map();
    for (const b of body) {
        const k = Math.floor(b.cy / BUNKA) * 10000 + Math.floor(b.cx / BUNKA);
        if (!mrizka.has(k)) mrizka.set(k, []);
        mrizka.get(k).push(b);
    }
    kresba = { W, H, body, mrizka };
}

export const htmlPlatna = (W, H, vrstva) => `<div class="sp-mapa-platno" style="width:${W}px;height:${H}px">
    <canvas data-mapa-platno width="${W}" height="${H}" style="width:${W}px;height:${H}px" aria-hidden="true"></canvas>
    <svg class="sp-svg sp-mapa-vrstva" width="${W}" height="${H}" data-mapa-w="${W}" data-mapa-h="${H}" role="img" aria-label="Mapa sbírky">${vrstva}</svg></div>`;

// Vykreslí body do plátna v místě grafu (po vložení HTML)
export function nakreslit(misto) {
    const platno = /** @type {HTMLCanvasElement | null} */ (misto.querySelector('canvas[data-mapa-platno]'));
    if (!platno || !kresba) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    platno.width = Math.round(kresba.W * dpr);
    platno.height = Math.round(kresba.H * dpr);
    const c = platno.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, kresba.W, kresba.H);
    // Utlumené napřed, aby vybrané byly nahoře
    for (const tlum of [true, false]) {
        c.globalAlpha = tlum ? 0.16 : 0.78;
        for (const b of kresba.body) {
            if (b.tlum !== tlum) continue;
            c.beginPath();
            c.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);
            if (b.dute) { c.strokeStyle = b.barva; c.lineWidth = 1.5; c.stroke(); } else { c.fillStyle = b.barva; c.fill(); }
        }
    }
    c.globalAlpha = 1;
}

// Bod plátna pod ukazatelem (nejbližší do 6 px), nebo null
export function bodNaMiste(svg, clientX, clientY) {
    if (!kresba || !svg?.classList.contains('sp-mapa-vrstva')) return null;
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) * kresba.W / (rect.width || 1), y = (clientY - rect.top) * kresba.H / (rect.height || 1);
    let nej = null, nejD = 36;
    for (let gy = Math.floor(y / BUNKA) - 1; gy <= Math.floor(y / BUNKA) + 1; gy++) {
        for (let gx = Math.floor(x / BUNKA) - 1; gx <= Math.floor(x / BUNKA) + 1; gx++) {
            for (const b of kresba.mrizka.get(gy * 10000 + gx) || []) {
                const d = (b.cx - x) ** 2 + (b.cy - y) ** 2;
                if (d < nejD) { nejD = d; nej = b; }
            }
        }
    }
    return nej;
}
