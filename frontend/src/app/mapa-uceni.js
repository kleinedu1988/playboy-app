// Mapa sbírky 2 (ROADMAP 1.53): souřadnice mapy se pamatují mezi spuštěními (localStorage), nová mapa se na ně
// zarovná, takže body zůstávají na místě; pod mapou je posun. Na pozadí se změří zachování sousedů a zkusí se
// autoenkodér (lib/mapa-sit.js, po epochách bez zaseknutí okna); mapa ho převezme jen tehdy, když zachová sousedy
// aspoň o MIN_ZLEPSENI lépe než PCA. Rozhodnutí platí, dokud se modelky nezmění (otisk).
import { Autoenkoder, MIN_ZLEPSENI, pokracovatSousede, zacitSousedePriznaku, zachovaniSousedu } from '../lib/mapa-sit';
import { vypocitatMapuSbirky } from '../lib/mapa-sbirky';

const KLIC = 'mapaSbirky';

// Otisk modelek mapy: počet, ID a údaje, které mapu mění
export function otiskModelek(modelky) {
    let h = 2166136261;
    const pridat = (t) => { for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } };
    for (const m of modelky) pridat(`${m.id}|${m.vyskaCm}|${m.vahaKg}|${m.obvodPasCm}|${m.vlasyBarva}|${m.narodnost}|${(m.vydani || [])[0] || ''};`);
    return `${modelky.length}:${(h >>> 0).toString(36)}`;
}

/** @returns {{ otisk: string, model: string, body: Map<number, { x: number, y: number }>, zachPca: number | null, zachAe: number | null } | null} */
function ulozena() {
    try {
        const u = JSON.parse(localStorage.getItem(KLIC) || 'null');
        if (!u || typeof u.body !== 'object') return null;
        return { otisk: u.otisk || '', model: u.model || 'pca', zachPca: u.zachPca ?? null, zachAe: u.zachAe ?? null,
            body: new Map(Object.entries(u.body).map(([id, [x, y]]) => [Number(id), { x, y }])) };
    } catch { return null; }
}

function ulozit(vysledek, otisk, rozhodnuti = {}) {
    const body = {};
    for (const b of vysledek.body) body[b.id] = [Math.round(b.x * 1e4) / 1e4, Math.round(b.y * 1e4) / 1e4];
    try { localStorage.setItem(KLIC, JSON.stringify({ otisk, model: vysledek.model, body, ...rozhodnuti })); } catch { /* jen pro toto spuštění */ }
}

let beh = null; // { otisk, zruseno }

// Zapomenout uloženou mapu (Přepočítat od začátku): příští výpočet začne s pevnou orientací os bez zarovnání
export function zapomenoutMapu() {
    try { localStorage.removeItem(KLIC); } catch { /* nic */ }
    if (beh) beh.zruseno = true;
    beh = null;
}

// Mapa z modelek: zarovnaná na minulou (v paměti, jinak uloženou); stejné modelky s rozhodnutým autoenkodérem
// dostanou rovnou jeho uložené souřadnice
export function vypocitatMapu(modelky, predchoziVPameti = null) {
    const ul = ulozena();
    const otisk = otiskModelek(modelky);
    let kody = null;
    if (ul && ul.otisk === otisk && ul.model === 'autoenkoder') {
        const x = new Float64Array(modelky.length), y = new Float64Array(modelky.length);
        kody = { x, y };
        for (let i = 0; i < modelky.length; i++) {
            const b = ul.body.get(modelky[i].id);
            if (!b) { kody = null; break; }
            x[i] = b.x; y[i] = b.y;
        }
    }
    const v = vypocitatMapuSbirky(modelky, { predchozi: predchoziVPameti || ul?.body || null, kody, meritSousedy: false });
    v.otisk = otisk;
    v.novych = ul || predchoziVPameti ? modelky.length - v.spolecnych : 0;
    const stejne = ul?.otisk === otisk;
    if (stejne) {
        v.zachovaniSousedu = v.model === 'autoenkoder' ? ul.zachAe : ul.zachPca;
        v.zachPca = ul.zachPca;
        v.zachAe = ul.zachAe;
    }
    ulozit(v, otisk, stejne ? { zachPca: ul.zachPca, zachAe: ul.zachAe } : {});
    return v;
}

const pauza = (ms) => new Promise(r => setTimeout(r, ms));

// Na pozadí: zachování sousedů a pokus o autoenkodér. zmena() = překreslit řádek pod mapou,
// hotovo(nova) = převzít lepší mapu autoenkodéru. Pro tytéž modelky jen jednou.
export async function zlepsitNaPozadi(modelky, vysledek, { zmena, hotovo }) {
    if (!vysledek?.priznaky || vysledek.body.length < 30 || beh?.otisk === vysledek.otisk) return;
    const muj = { otisk: vysledek.otisk, zruseno: false };
    if (beh) beh.zruseno = true;
    beh = muj;
    if (vysledek.zachAe != null) return; // rozhodnuto dřív (uložené)
    await pauza(400);
    if (muj.zruseno) return;
    const { matice, n, D } = vysledek.priznaky;
    const ref = zacitSousedePriznaku(n);
    while (!pokracovatSousede(ref, matice, n, D, 12)) {
        await pauza(0);
        if (muj.zruseno) return;
    }
    const xs = Float64Array.from(vysledek.body, b => b.x), ys = Float64Array.from(vysledek.body, b => b.y);
    const zachPca = zachovaniSousedu(ref, xs, ys);
    vysledek.zachovaniSousedu = vysledek.zachPca = zachPca;
    vysledek.uciSe = true;
    zmena();
    const ae = new Autoenkoder(matice, n, D);
    let ukazana = 0;
    while (!ae.krok(12)) {
        vysledek.epocha = ae.epocha;
        if (ae.epocha >= ukazana + 5) { ukazana = ae.epocha; zmena(); }
        await pauza(0);
        if (muj.zruseno) return;
    }
    const kody = ae.kody();
    const zachAe = zachovaniSousedu(ref, kody.x, kody.y);
    vysledek.zachAe = zachAe;
    vysledek.uciSe = false;
    if (zachAe >= zachPca + MIN_ZLEPSENI) {
        const nova = vypocitatMapuSbirky(modelky, { predchozi: new Map(vysledek.body.map(b => [b.id, b])), kody, ref });
        Object.assign(nova, { otisk: vysledek.otisk, novych: vysledek.novych, zachPca, zachAe, posun: vysledek.posun });
        ulozit(nova, vysledek.otisk, { zachPca, zachAe });
        hotovo(nova);
    } else {
        ulozit(vysledek, vysledek.otisk, { zachPca, zachAe });
        zmena();
    }
}
