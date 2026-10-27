// Velikosti obrázků z Disku a zástupný obrázek pro chybějící fotku
import { idOdkazuDisku, obrazek } from '../lib/format';
import { oznamit } from '../ui/oznameni';
import { GetSablonaObrazku } from './backend';

// Google Disk bez přípony vrací nejvýše 1600 px; =s0 je originál, =w600 úsporný náhled
export const VELIKOST_NAHLEDU = 'w400';       // dlaždice fotky v albu
export const VELIKOST_PLAKATU_MALA = 'w600';  // plakát na stěně, v coverech a v úzkém levém sloupci
export const VELIKOST_PLAKATU = 'w1200';      // plakát v širokém sloupci stránky vydání
export const VELIKOST_KARTY = 'w400';         // titulní fotka na kartě galerie
// Titulní fotka v profilu a při úpravě výřezu; rezerva pro přiblížení
export const VELIKOST_TITULNI = 'w800';

// Zástupný obrázek: „Bez fotky“ u modelky bez titulní fotky, „Nenačteno“ u fotky, která se nenačetla
// (bez připojení, smazaná nebo nesdílená na Disku)
const zastupny = text => 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
        <rect width="300" height="400" fill="#18181c"/>
        <g fill="none" stroke="#3a3a42" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="95" y="150" width="110" height="90" rx="10"/>
            <circle cx="130" cy="182" r="10"/>
            <path d="M102 232l34-30 22 18 18-14 22 26"/>
        </g>
        <text x="150" y="275" fill="#5a5a62" font-family="sans-serif" font-size="16" text-anchor="middle">${text}</text>
    </svg>`);
export const BEZ_FOTKY = zastupny('Bez fotky');
const NENACTENO = zastupny('Nenačteno');

// Karta si vystačí s menším obrázkem, dokud výřez fotku výrazně nepřibližuje
export function adresaTitulni(modelka, velka = false) {
    if (!modelka.coverUrl) return BEZ_FOTKY;
    return obrazek(modelka.coverUrl, velka || modelka.coverZoom > 1.5 ? VELIKOST_TITULNI : VELIKOST_KARTY);
}
export const PLNE_ROZLISENI = 's0';

// Adresy obrázků k souborům z vložených odkazů na Disk (náhled v oknech coveru a článku). Šablonu adresy
// skládá backend a jde změnit v nastavení, proto se pokaždé načte znovu (je to jen přečtení hodnoty).
export async function adresyOdkazu(text, velikost) {
    const ids = idOdkazuDisku(text);
    if (!ids.length) return [];
    const sablona = await GetSablonaObrazku().catch(() => '');
    return sablona ? ids.map(id => obrazek(sablona.replaceAll('{id}', id), velikost)) : [];
}

// Postupné načítání fotek ve velké mřížce: obrázek s data-src dostane adresu, až se přiblíží k zobrazené části
// (asi dvě obrazovky dopředu). Když z ní odroluje dřív, než se načetl, jeho požadavek se zruší, aby při rychlém
// rolování nečekaly fotky na obrazovce ve frontě za těmi, které už jsou pryč. Vestavěné loading="lazy"
// ve WebKitGTK začíná načítat pozdě a odrolované fotky neruší. Každý kontejner má vlastního pozorovatele,
// při novém vykreslení se starý odpojí (karty, které už nejsou v okně, se nehlídají dál).
const pozorovatele = new WeakMap();
export function nacitatPostupne(kontejner) {
    pozorovatele.get(kontejner)?.disconnect();
    const pozorovatel = new IntersectionObserver(zaznamy => zaznamy.forEach(z => {
        const img = /** @type {HTMLImageElement} */ (z.target);
        if (z.isIntersecting) {
            // Jen obrázek bez adresy; nenačtená fotka nahrazená zástupným obrázkem se znovu nestahuje
            if (img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src;
        } else if (img.getAttribute('src')) {
            if (!img.complete) img.removeAttribute('src');
            // Načtenou fotku už hlídat netřeba; každý hlídaný obrázek prodlužuje výpočet při každém posunu stránky
            else pozorovatel.unobserve(img);
        }
    }), { root: document.querySelector('main'), rootMargin: '1500px 0px' });
    kontejner.querySelectorAll('img[data-src]').forEach(img => pozorovatel.observe(img));
    pozorovatele.set(kontejner, pozorovatel);
}

// Kontejner, jehož obsah se zahazuje, se přestane hlídat (pozorovatel by jinak držel odpojené obrázky)
export function prestatNacitat(kontejner) {
    pozorovatele.get(kontejner)?.disconnect();
    pozorovatele.delete(kontejner);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Fotka, která se nenačte (smazaná na Disku, bez připojení), se nahradí zástupným obrázkem „Nenačteno“;
    // původní adresa zůstane u obrázku, aby se po návratu připojení dala načíst znovu
    document.addEventListener('error', (e) => {
        const img = /** @type {HTMLImageElement} */ (e.target);
        // Obrázek bez adresy (postupné načítání ho ještě nenačetlo nebo ho zrušilo) chybou není
        if (img.tagName !== 'IMG' || !img.getAttribute('src') || img.src.startsWith('data:') || img.closest('.lightbox')) return;
        img.dataset.nenacteno = img.getAttribute('src');
        img.src = NENACTENO;
    }, true);

    // Výpadek připojení se ohlásí jednou; po návratu se nenačtené fotky načtou znovu
    const bezPripojeni = () => oznamit('Bez připojení k internetu. Fotky z Google Disku se nenačtou, dokud se připojení nevrátí; sbírku jde dál prohlížet a upravovat.');
    window.addEventListener('offline', bezPripojeni);
    window.addEventListener('online', () => {
        const nenactene = [...document.querySelectorAll('img[data-nenacteno]')];
        nenactene.forEach(img => {
            img.src = img.dataset.nenacteno;
            delete img.dataset.nenacteno;
        });
        oznamit(nenactene.length ? 'Připojení je zpět, fotky se načítají.' : 'Připojení je zpět.');
    });
    if (!navigator.onLine) bezPripojeni();
}
