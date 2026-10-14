// Přepínání pohledů, historie pro Zpět a společné pomocné funkce
import { esc, nazevVydani } from '../lib/format';
import { oznamit } from '../ui/oznameni';
import { OveritOdkaz } from './backend';
import { stav } from './stav';
import { backBtn, best, calendar, covers, detailView, gallery, issueView, searchInput, stats, wall } from './prvky';
import { nacistGalerii } from './galerie';
import { otevritDetailModelky } from './profil';
import { otevritFotografa, otevritVydani } from './vydani';
import { zrusitVyber } from './vyber';

// Vždy je vidět jeden pohled; profil modelky a stránka vydání mají v liště tlačítko zpět místo přepínače
export function ukazatPohled(pohled) {
    // Výběr fotek patří k pohledu, ve kterém vznikl; při odchodu se zruší, aby neovlivňoval Esc, šipky ani Delete
    if (document.querySelector('.photo-item.vybrana, .poster.vybrana')) zrusitVyber();
    [gallery, wall, covers, calendar, stats, best, detailView, issueView].forEach(p => p.classList.toggle('hidden', p !== pohled));
    const podstranka = pohled === detailView || pohled === issueView;
    // Zpět je vidět na podstránkách a v přehledu, kam se přešlo hledáním z profilu nebo vydání
    backBtn.classList.toggle('hidden', !podstranka && !historie.length);
    document.getElementById('prevModelBtn').classList.toggle('hidden', pohled !== detailView);
    document.getElementById('nextModelBtn').classList.toggle('hidden', pohled !== detailView);
    viewToggle.classList.toggle('hidden', podstranka);
    backBtn.innerHTML = `&larr; ${esc(popisZpet())}`;
    // Lišta písmen patří jen ke galerii modelek, lišta desetiletí jen ke stěně
    if (pohled !== gallery) document.getElementById('galleryNav')?.classList.add('hidden');
    if (pohled !== wall) document.getElementById('wallNav')?.classList.add('hidden');
}

// Historie pro Zpět: kam se vrátit a na jaké místo stránky
export const historie = [];
export const NAZVY_REZIMU = { modelky: 'Modelky', centerfoldy: 'Centerfoldy', covery: 'Covery', kalendar: 'Kalendář', nejlepsi: 'Nejlepší', prehled: 'Přehled' };

export function popisZpet() {
    const misto = historie[historie.length - 1];
    if (misto?.typ === 'profil') return misto.modelka.jmeno;
    if (misto?.typ === 'vydani') return nazevVydani(misto.vydani);
    if (misto?.typ === 'fotograf') return misto.jmeno;
    return NAZVY_REZIMU[misto?.rezim || stav.rezim];
}

export function soucasneMisto() {
    const scroll = document.querySelector('main').scrollTop;
    if (!detailView.classList.contains('hidden')) return { typ: 'profil', modelka: stav.aktualniModelka, scroll };
    if (!issueView.classList.contains('hidden')) return stav.aktualniFotograf ? { typ: 'fotograf', jmeno: stav.aktualniFotograf, scroll } : { typ: 'vydani', vydani: stav.aktualniVydani, scroll };
    return { typ: 'prehled', rezim: stav.rezim, scroll };
}

// Před otevřením profilu nebo vydání se zapamatuje, odkud se přišlo (ne při návratu na totéž místo)
export function zapamatovatMisto(cil) {
    const misto = soucasneMisto();
    if ((misto.typ === 'profil' && cil.modelka?.id === misto.modelka?.id) || (misto.typ === 'vydani' && cil.vydani === misto.vydani)
        || (misto.typ === 'fotograf' && cil.fotograf === misto.jmeno)) return;
    historie.push(misto);
    if (historie.length > 50) historie.shift();
}

export async function zpet() {
    const misto = historie.pop();
    const hlavni = document.querySelector('main');
    if (misto?.typ === 'profil') {
        await otevritDetailModelky(misto.modelka, { bezHistorie: true });
    } else if (misto?.typ === 'vydani') {
        await otevritVydani(misto.vydani, { bezHistorie: true });
    } else if (misto?.typ === 'fotograf') {
        await otevritFotografa(misto.jmeno, { bezHistorie: true });
    } else {
        if (misto) prepnoutRezim(misto.rezim);
        await nacistGalerii(searchInput.value);
    }
    // Stejné místo stránky, ze kterého se odešlo
    if (misto) requestAnimationFrame(() => { hlavni.scrollTop = misto.scroll; });
}
export const viewToggle = document.getElementById('viewToggle');

// Shrnutí vložení odkazů: co se uložilo a co bylo odmítnuto
export function oznamitVlozeni(v, co) {
    const casti = [`Přidáno ${co}: ${v.vlozeno}.`];
    if (v.nedostupne) casti.push(`Nefunkčních odkazů (smazané nebo nesdílené soubory): ${v.nedostupne} – neuloženy.`);
    if (v.duplicitni) casti.push(`Už uložených: ${v.duplicitni} – přeskočeny.`);
    if (v.neovereno) casti.push(`Bez ověření kvůli připojení: ${v.neovereno}.`);
    if (v.vlozeno === 0 && !v.nedostupne && !v.duplicitni) casti[0] = 'Ve vloženém textu nebyl žádný odkaz na Google Disk.';
    oznamit(casti.join(' '));
}

// Odkaz na složku Disku program neumí rozbalit na fotky; místo „nefunkčního odkazu" řekne proč
export function jeOdkazNaSlozku(text) {
    if (!/\/folders\//.test(text)) return false;
    oznamit('Odkaz vede na složku Disku. Vlož odkazy na jednotlivé fotky – složku program nerozbalí.');
    return true;
}

// Odkaz, který Disk nevrací jako obrázek, se neuloží
export async function odkazJeVPoradku(odkaz) {
    if (!odkaz.trim()) return true;
    if (jeOdkazNaSlozku(odkaz)) return false;
    if (await OveritOdkaz(odkaz) !== 0) return true;
    oznamit('Tento odkaz nefunguje – soubor na Google Disku je smazaný, není sdílený „kdokoli s odkazem", nebo to není obrázek.');
    return false;
}

// Výřez titulní fotky: poloha v procentech a přiblížení kolem téhož bodu
export function stylVyrezu({ coverZoom, coverX, coverY }) {
    return `object-position: ${coverX}% ${coverY}%; transform-origin: ${coverX}% ${coverY}%; transform: scale(${coverZoom});`;
}

// Každý přehled si pamatuje své hledání; text z Modelek by v kalendáři filtroval roky
export const hledaniPodleRezimu = {};

export function prepnoutRezim(novy) {
    if (novy !== stav.rezim) {
        hledaniPodleRezimu[stav.rezim] = searchInput.value;
        searchInput.value = hledaniPodleRezimu[novy] || '';
    }
    stav.rezim = novy;
    viewToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.rezim === novy));
    // Při příštím spuštění se program otevře ve stejném přehledu
    try { localStorage.setItem('posledniRezim', novy); } catch { /* bez úložiště se jen nezapamatuje */ }
    document.querySelector('main').scrollTop = 0;
}