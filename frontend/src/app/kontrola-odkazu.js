// Živá kontrola odkazů na fotky (zásobník v profilu, okno alba, rychlé okno Nová modelka): kolik odkazů je platných
// a které soubory už ve sbírce jsou – s náhledem a místem, kde jsou. Vkládá se pak jen to nové, pokud uživatel
// nezaškrtne „Vložit i ty, které už ve sbírce jsou“ (ZkontrolovatOdkazy v rychle_pridani.go).
import { ZkontrolovatOdkazy } from './backend';
import { esc, nazevAlba, odkazyDisku, sklonovat } from '../lib/format';

const NEJVIC_UKAZAT = 6;

/** @typedef {{ ids: string[], nove: string[], existujici: { driveId: string, mista: { modelkaId: number, jmenoModelky: string, album: string, typ: string, url: string }[] }[], slozka: boolean }} Kontrola */

// Stav kontroly jako HTML; vkladatVse = zaškrtnuté „i ty, které už ve sbírce jsou“ (jen když nějaké jsou)
export function htmlKontroly(/** @type {Kontrola | null} */ k, { vkladatVse = false, idPole = '' } = {}) {
    if (!k || !k.ids.length) return k?.slozka ? '<span class="ko-varovani">Odkaz na složku Disku program nerozbalí – vlož odkazy na jednotlivé fotky.</span>' : '';
    const casti = [`<b>${sklonovat(k.ids.length, 'platný odkaz', 'platné odkazy', 'platných odkazů')}</b>`];
    if (k.existujici.length) casti.push(`<span class="ko-uz">${sklonovat(k.existujici.length, 'už je', 'už jsou', 'už je')} ve sbírce</span>`, `${sklonovat(k.nove.length, 'nová', 'nové', 'nových')}`);
    if (k.slozka) casti.push('<span class="ko-varovani">odkaz na složku se přeskočí</span>');
    if (!k.existujici.length) return `<span class="ko-radek">${casti.join(' · ')}</span>`;
    const polozky = k.existujici.slice(0, NEJVIC_UKAZAT).map(e => {
        const m = e.mista[0];
        const kde = `${m.jmenoModelky || 'bez modelky'} · ${nazevAlba(m.album, m.typ)}${e.mista.length > 1 ? ` a ${e.mista.length - 1} další` : ''}`;
        return `<li><img src="${esc(String(m.url || '').replace('{velikost}', 'w200'))}" alt="" loading="lazy" draggable="false" />
            <span class="ko-kde">${esc(kde)}</span></li>`;
    }).join('');
    const dalsi = k.existujici.length > NEJVIC_UKAZAT ? `<li class="ko-dalsi">a ${k.existujici.length - NEJVIC_UKAZAT} další</li>` : '';
    return `<span class="ko-radek">${casti.join(' · ')}</span>
        <ul class="ko-seznam">${polozky}${dalsi}</ul>
        <label class="ko-vse"><input type="checkbox" data-ko-vse${idPole ? ` data-ko-pole="${esc(idPole)}"` : ''}${vkladatVse ? ' checked' : ''} /> Vložit i ty, které už ve sbírce jsou</label>`;
}

// Sleduje textové pole a výsledek kontroly ukazuje v prvku vystup; poZmene(kontrola) po každé kontrole.
// Vrací { kontrola(): poslední kontrola, zkontrolovat(): hned (await), idsKVlozeni(): co vložit, obnovit() }.
export function sledovatOdkazy(/** @type {HTMLTextAreaElement | HTMLInputElement} */ pole, /** @type {HTMLElement} */ vystup, { poZmene = (_k) => {} } = {}) {
    /** @type {Kontrola | null} */
    let posledni = null;
    let text = null;
    let casovac = null;
    let vkladatVse = false;
    let poradi = 0;
    const vykreslit = () => {
        vystup.innerHTML = htmlKontroly(posledni, { vkladatVse });
        vystup.hidden = !vystup.innerHTML;
    };
    const zkontrolovat = async () => {
        clearTimeout(casovac);
        if (pole.value === text && posledni) return posledni;
        text = pole.value;
        const moje = ++poradi;
        // Bez odkazu se backend nevolá
        const k = odkazyDisku(text).length || /\/folders\//.test(text) ? await ZkontrolovatOdkazy(text) : { ids: [], nove: [], existujici: [], slozka: false };
        if (moje !== poradi) return posledni;
        posledni = k;
        if (!k.existujici.length) vkladatVse = false;
        vykreslit();
        poZmene(k);
        return k;
    };
    pole.addEventListener('input', () => {
        clearTimeout(casovac);
        casovac = setTimeout(zkontrolovat, 250);
    });
    vystup.addEventListener('change', (e) => {
        const volba = /** @type {HTMLInputElement} */ (e.target);
        if (!volba.matches('[data-ko-vse]')) return;
        vkladatVse = volba.checked;
        poZmene(posledni);
    });
    return {
        kontrola: () => posledni,
        zkontrolovat,
        vkladatVse: () => vkladatVse,
        // Soubory k vložení: nové, nebo všechny (zaškrtnuto)
        idsKVlozeni: async () => {
            const k = await zkontrolovat();
            return vkladatVse ? k.ids : k.nove;
        },
        obnovit: () => {
            text = null;
            posledni = null;
            vkladatVse = false;
            vystup.innerHTML = '';
            vystup.hidden = true;
            if (pole.value.trim()) zkontrolovat();
        },
    };
}
