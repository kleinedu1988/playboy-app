// Prohlížeč fotek přes celé okno: lupa, otáčení, slideshow, lišta alb
import { oznamit } from '../ui/oznameni';
import { nazevAlba, obrazek } from '../lib/format';
import { SetRotaceFotek } from './backend';
import { zacatkyAlb } from '../lib/alba';
import { vytvoritListu } from '../ui/lista';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { stav } from './stav';
import { best, covers, detailView, issueView, searchInput, wall } from './prvky';
import { PLNE_ROZLISENI, VELIKOST_NAHLEDU, VELIKOST_PLAKATU_MALA } from './obrazky';
import { hledatHodnotu, htmlSrdicek, ohodnotitPolozku } from './galerie';
import { htmlPlakatu, nacistFotkyModelky, pripravitPlakat } from './profil';
import { nacistCovery, nacistStenu } from './stena';
import { obnovitStranku, otevritFotografa, otevritVydani } from './vydani';
import { nacistNejlepsi } from './nejlepsi';
import { otevritProfilPodleId } from './cover';

// Prohlížeč fotek: šipky vlevo a vpravo listují, nahoru a dolů (PgUp, PgDn) skáčou mezi alby,
// mezerník spouští slideshow, F rozkládá plakát, R otáčí, Esc zavírá
export const lightbox = document.getElementById('lightbox');
export const lbStage = document.getElementById('lbStage');
export const lbProgress = document.getElementById('lbProgress');
export const lbZoomBtn = document.getElementById('lbZoom');
export const lbFillBtn = document.getElementById('lbFill');
export const LB_LISTA = 44; // výška horní lišty prohlížeče

export const lbOmezit = (hodnota, min, max) => Math.min(max, Math.max(min, hodnota));

// Rozměr plakátu ve zdrojových pixelech po otočení
export function lbRozmer() {
    const r = stav.lbPlakat?._rozmer;
    if (!r) return null;
    return stav.lbPolozky[stav.lbIndex].rotace % 180 ? { W: r.H, H: r.W } : r;
}

// Umístění plakátu: buď se vejde celý, nebo (rozložený) vyplní okno a přesahuje po délce
export function lbRozvrhnout() {
    const r = lbRozmer();
    if (!r) return;
    const sw = lightbox.clientWidth;
    const sh = lightbox.clientHeight;
    const okrajX = sw > 560 ? 70 : 0;
    // Fotka, která se má vejít celá, nesmí zajíždět pod lištu alb
    const spodek = lbLista.nav.classList.contains('hidden') ? 16 : lbLista.nav.offsetHeight + 4;
    const meritko = stav.lbRozlozeno
        ? Math.max(sw / r.W, sh / r.H)
        : Math.min((sw - 2 * okrajX) / r.W, (sh - LB_LISTA - spodek) / r.H);

    const w = r.W * meritko;
    const h = r.H * meritko;
    const presahX = Math.max(0, w - sw);
    const presahY = Math.max(0, h - sh);
    const left = presahX > 1 ? -stav.lbPosun * presahX : (sw - w) / 2;
    const top = stav.lbRozlozeno
        ? (presahY > 1 ? -stav.lbPosun * presahY : (sh - h) / 2)
        : LB_LISTA + (sh - LB_LISTA - spodek - h) / 2;

    Object.assign(stav.lbPlakat.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    stav.lbZobrazeno = { sirka: w, presah: Math.max(presahX, presahY), osa: presahX > presahY ? 'x' : 'y' };
    lbAktualizovatTlacitka();
}

// Kolikrát jde plakát zvětšit, než se zobrazí ve skutečném rozlišení
export function lbMeritkoLupy() {
    const r = lbRozmer();
    return stav.lbPlne && r && stav.lbZobrazeno.sirka ? r.W / stav.lbZobrazeno.sirka : 1;
}

// Lupa je dostupná jen tehdy, když má fotka výrazně vyšší rozlišení, než v jakém je zobrazená
export function lbAktualizovatTlacitka() {
    // Dokud není stažený originál, není známo, zda má fotka vyšší rozlišení; lupa ho na vyžádání načte
    const lupaDostupna = !stav.lbPlne || lbMeritkoLupy() >= 1.15;
    lbZoomBtn.disabled = !lupaDostupna;
    lbZoomBtn.title = lupaDostupna ? 'Lupa (klik na fotku)' : 'Fotka nemá vyšší rozlišení';
    stav.lbPlakat?.classList.toggle('zoomable', lupaDostupna);
    lbFillBtn.classList.toggle('active', stav.lbRozlozeno);
    lightbox.classList.toggle('filled', stav.lbRozlozeno && stav.lbZobrazeno.presah > 1);
}

export function lbPosunoutLupu(e) {
    if (!stav.lbLupa) return;
    const x = lbOmezit((e.clientX - stav.lbLupa.left) / stav.lbLupa.width * 100, 0, 100);
    const y = lbOmezit((e.clientY - stav.lbLupa.top) / stav.lbLupa.height * 100, 0, 100);
    stav.lbPlakat.style.transformOrigin = `${x}% ${y}%`;
}

// Velikost obrázku pro prohlížení: podle delší strany okna, po krocích, aby drobná změna okna nestahovala znovu.
// Originál (často mnohonásobně větší) se stahuje až pro lupu.
export function lbVelikost(polozka) {
    const strana = Math.max(lightbox.clientWidth, lightbox.clientHeight) * (window.devicePixelRatio || 1);
    // Rozložený centerfold přesahuje okno po délce
    const cil = polozka.typ === 'Centerfold' ? strana * 2 : strana;
    return `s${Math.min(3200, Math.max(800, Math.ceil(cil / 400) * 400))}`;
}

export function lbNacistOriginal() {
    const plakat = stav.lbPlakat;
    if (!plakat || plakat.dataset.original) return;
    plakat.dataset.original = '1';
    const obrazky = [...plakat.querySelectorAll('img')];
    stav.lbPolozky[stav.lbIndex].fotky.forEach((f, i) => {
        const plna = new Image();
        plna.onload = () => {
            if (stav.lbPlakat !== plakat) return;
            obrazky[i].dataset.plne = '1';
            obrazky[i].src = plna.src;
        };
        plna.onerror = () => {
            if (stav.lbPlakat !== plakat) return;
            stav.lbCekaNaOriginal = null;
            delete plakat.dataset.original;
            lightbox.classList.remove('nacita');
            oznamit('Originál fotky se nepodařilo načíst.');
        };
        plna.src = obrazek(f.url, PLNE_ROZLISENI);
    });
}

export function lbPrepnoutLupu(zapnout, e) {
    if (!stav.lbPlakat) return;
    if (zapnout && !stav.lbPlne) {
        // Bez události myši (tlačítko v liště) se zvětší střed okna
        stav.lbCekaNaOriginal = e ? { clientX: e.clientX, clientY: e.clientY } : { clientX: lightbox.clientWidth / 2, clientY: lightbox.clientHeight / 2 };
        lightbox.classList.add('nacita');
        lbNacistOriginal();
        return;
    }
    if (zapnout && lbMeritkoLupy() < 1.15) return;

    if (zapnout) {
        lbPrepnoutSlideshow(false);
        stav.lbLupa = stav.lbPlakat.getBoundingClientRect();
        // Bez události myši (tlačítko v liště) se zvětší střed okna
        lbPosunoutLupu(e || { clientX: lightbox.clientWidth / 2, clientY: lightbox.clientHeight / 2 });
        stav.lbPlakat.style.transform = `scale(${lbMeritkoLupy()})`;
    } else {
        stav.lbLupa = null;
        stav.lbPlakat.style.transform = '';
    }
    lightbox.classList.toggle('zoomed', zapnout);
}

export function lbPrepnoutRozlozeni(zapnout = !stav.lbRozlozeno) {
    lbPrepnoutLupu(false);
    stav.lbRozlozeno = zapnout;
    stav.lbPosun = 0;
    lbRozvrhnout();
}

export async function lbOtocit() {
    const polozka = stav.lbPolozky[stav.lbIndex];
    if (!polozka || !stav.lbPlakat) return;
    lbPrepnoutLupu(false);
    polozka.rotace = (polozka.rotace + 90) % 360;
    polozka.fotky.forEach(f => { f.rotace = polozka.rotace; });
    stav.lbPlakat.dataset.rot = polozka.rotace;
    stav.lbPosun = 0;
    lbRozvrhnout();
    stav.lbZmeneno = true;
    await SetRotaceFotek(polozka.fotky.map(f => f.id), polozka.rotace);
}

export function lbZobrazit(index) {
    const pocet = stav.lbPolozky.length;
    if (pocet === 0) {
        zavritLightbox();
        return;
    }
    stav.lbIndex = (index + pocet) % pocet;
    const polozka = stav.lbPolozky[stav.lbIndex];

    stav.lbLupa = null;
    stav.lbPlne = false;
    stav.lbCekaNaOriginal = null;
    stav.lbPosun = 0;
    lightbox.classList.remove('zoomed', 'nacita');
    // Centerfold se otevírá rovnou rozložený přes celé okno
    stav.lbRozlozeno = polozka.typ === 'Centerfold';

    // Nejdřív náhled z mezipaměti, obrázek ve velikosti okna se doplní po načtení
    lbStage.innerHTML = htmlPlakatu(polozka, polozka.typ === 'Centerfold' ? VELIKOST_PLAKATU_MALA : VELIKOST_NAHLEDU);
    const plakat = lbStage.firstElementChild;
    stav.lbPlakat = plakat;
    const obrazky = [...plakat.querySelectorAll('img')];

    pripravitPlakat(plakat, () => {
        if (stav.lbPlakat !== plakat) return;
        stav.lbPlne = obrazky.every(o => o.dataset.plne && o.complete && o.naturalWidth);
        // Lupa se po výměně za ostřejší obrázek nesmí rozhodit
        if (!stav.lbLupa) lbRozvrhnout();
        // Lupa vyžádaná dřív, než dorazil originál, se zapne teď
        if (stav.lbPlne && stav.lbCekaNaOriginal) {
            const kde = stav.lbCekaNaOriginal;
            stav.lbCekaNaOriginal = null;
            lightbox.classList.remove('nacita');
            if (lbMeritkoLupy() >= 1.15) lbPrepnoutLupu(true, kde);
            else oznamit('Fotka nemá vyšší rozlišení, než v jakém je zobrazená.');
        }
    });

    const velikost = lbVelikost(polozka);
    polozka.fotky.forEach((f, i) => {
        const vetsi = new Image();
        vetsi.onload = () => {
            // Originál, který mezitím dorazil kvůli lupě, se menším obrázkem nepřepisuje
            if (stav.lbPlakat !== plakat || obrazky[i].dataset.plne) return;
            obrazky[i].src = vetsi.src;
        };
        vetsi.src = obrazek(f.url, velikost);
    });

    document.getElementById('lbCaption').textContent =
        [polozka.jmenoModelky, nazevAlba(polozka.album, polozka.typ), polozka.typ].filter(Boolean).join(' · ');
    document.getElementById('lbCounter').textContent = `${stav.lbIndex + 1} / ${pocet}`;
    lbVykreslitSrdicka();
    lbLista.oznacit(lbZacatkyAlb().filter(i => i <= stav.lbIndex).pop());
    lbAktualizovatTlacitka();

    // Přednačtení další položky, aby listování neproblikávalo
    const dalsi = stav.lbPolozky[(stav.lbIndex + 1) % pocet];
    dalsi.fotky.forEach(f => { new Image().src = obrazek(f.url, lbVelikost(dalsi)); });

    if (stav.lbCasovac) lbSpustitCasovac();
}

export function lbVykreslitSrdicka() {
    document.getElementById('lbHearts').innerHTML = htmlSrdicek(stav.lbPolozky[stav.lbIndex].hodnoceni, '');
}

// Hodnocení právě zobrazené fotky; pořadí v přehledu se podle něj upraví po zavření prohlížeče
export async function lbOhodnotit(zvoleno) {
    const polozka = stav.lbPolozky[stav.lbIndex];
    if (!polozka || !await ohodnotitPolozku(polozka, zvoleno)) return;
    stav.lbZmeneno = true;
    if (stav.lbPolozky[stav.lbIndex] === polozka) lbVykreslitSrdicka();
}

// Indexy prvních fotek jednotlivých alb v právě prohlíženém seznamu
export function lbZacatkyAlb() {
    return zacatkyAlb(stav.lbPolozky);
}

// Skok na první fotku předchozího nebo dalšího alba
export function lbSkokAlba(smer) {
    const zacatky = lbZacatkyAlb();
    if (zacatky.length < 2) return;
    const soucasne = zacatky.filter(i => i <= stav.lbIndex).length - 1;
    lbZobrazit(zacatky[(soucasne + smer + zacatky.length) % zacatky.length]);
}

// Lišta alb dole v prohlížeči: ukazuje, ve kterém albu listování je, a skáče na jiné
export const lbLista = vytvoritListu(document.getElementById('lbNav'), klic => lbZobrazit(parseInt(klic)));

export function lbNaplnitListu() {
    const zacatky = lbZacatkyAlb();
    // Kde je každá položka vlastním albem (stěna centerfoldů, covery) nebo je pořadí zamíchané, lišta nemá smysl
    const maSmysl = !stav.lbPuvodniPoradi && zacatky.length > 1 && zacatky.length < stav.lbPolozky.length;
    lbLista.naplnit(maSmysl ? zacatky.map((zacatek, i) => ({
        klic: zacatek,
        nazev: nazevAlba(stav.lbPolozky[zacatek].album, stav.lbPolozky[zacatek].typ),
        pocet: (zacatky[i + 1] ?? stav.lbPolozky.length) - zacatek,
    })) : []);
}

export function lbSpustitCasovac() {
    clearTimeout(stav.lbCasovac);
    stav.lbCasovac = setTimeout(() => lbZobrazit(stav.lbIndex + 1), stav.intervalSlideshow);
    lbProgress.style.animationDuration = `${stav.intervalSlideshow}ms`;
    // Restart animace ukazatele průběhu
    lbProgress.classList.remove('running');
    void lbProgress.offsetWidth;
    lbProgress.classList.add('running');
}

export function lbPrepnoutSlideshow(zapnout = !stav.lbCasovac) {
    clearTimeout(stav.lbCasovac);
    stav.lbCasovac = null;
    lbProgress.classList.remove('running');
    if (zapnout) lbSpustitCasovac();
    document.getElementById('lbPlay').innerHTML = zapnout ? '&#10074;&#10074;' : '&#9654;';
}

export function lbZamichat() {
    const aktualni = stav.lbPolozky[stav.lbIndex];
    if (stav.lbPuvodniPoradi) {
        stav.lbPolozky = stav.lbPuvodniPoradi;
        stav.lbPuvodniPoradi = null;
    } else {
        stav.lbPuvodniPoradi = stav.lbPolozky;
        const ostatni = stav.lbPolozky.filter(p => p !== aktualni);
        for (let i = ostatni.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ostatni[i], ostatni[j]] = [ostatni[j], ostatni[i]];
        }
        stav.lbPolozky = [aktualni, ...ostatni];
    }
    document.getElementById('lbShuffle').classList.toggle('active', Boolean(stav.lbPuvodniPoradi));
    lbNaplnitListu();
    lbZobrazit(stav.lbPolozky.indexOf(aktualni));
}

export function otevritLightbox(index, slideshow = false, polozky = stav.aktualniPolozky) {
    if (polozky.length === 0) return;
    stav.lbPuvodniPoradi = null;
    document.getElementById('lbShuffle').classList.remove('active');
    stav.lbPolozky = polozky;
    stav.lbZmeneno = false;
    lightbox.classList.remove('hidden');
    lbNaplnitListu();
    lbPrepnoutSlideshow(slideshow);
    lbZobrazit(index);
}

export function zavritLightbox() {
    lbPrepnoutSlideshow(false);
    lightbox.classList.add('hidden');
    lightbox.classList.remove('zoomed', 'filled');
    lbStage.innerHTML = '';
    stav.lbPlakat = null;
    stav.lbLupa = null;

    // Otočení se má projevit i v přehledu pod prohlížečem
    if (stav.lbZmeneno) {
        if (!detailView.classList.contains('hidden')) nacistFotkyModelky(stav.aktualniModelka.id);
        else if (!wall.classList.contains('hidden')) nacistStenu(searchInput.value);
        else if (!covers.classList.contains('hidden')) nacistCovery(searchInput.value);
        else if (!issueView.classList.contains('hidden')) obnovitStranku();
        else if (!best.classList.contains('hidden')) nacistNejlepsi(searchInput.value);
    }
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    try { stav.intervalSlideshow = parseInt(localStorage.getItem('intervalSlideshow')) || 4000; } catch { /* výchozí 4 s */ }

    document.getElementById('lbHearts').addEventListener('click', (e) => {
        const srdicko = e.target.closest('.heart');
        if (srdicko) lbOhodnotit(parseInt(srdicko.dataset.hodnota));
    });

    document.getElementById('lbShuffle').onclick = lbZamichat;

    document.getElementById('lbPrev').onclick = () => lbZobrazit(stav.lbIndex - 1);

    document.getElementById('lbNext').onclick = () => lbZobrazit(stav.lbIndex + 1);

    document.getElementById('lbPlay').onclick = () => lbPrepnoutSlideshow();

    document.getElementById('lbRot').onclick = lbOtocit;

    document.getElementById('lbClose').onclick = zavritLightbox;

    lbFillBtn.onclick = () => lbPrepnoutRozlozeni();

    lbZoomBtn.onclick = () => lbPrepnoutLupu(!stav.lbLupa);

    window.addEventListener('resize', () => {
        if (lightbox.classList.contains('hidden')) return;
        lbPrepnoutLupu(false);
        lbLista.upravitSipky();
        lbRozvrhnout();
    });

    // Rozložený plakát se posouvá tažením nebo kolečkem, lupa pohybem myši
    lbStage.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !e.target.closest('.poster')) return;
        stav.lbTazeni = { x: e.clientX, y: e.clientY, posunuto: false };
    });

    window.addEventListener('pointermove', (e) => {
        if (stav.lbLupa) {
            lbPosunoutLupu(e);
            return;
        }
        if (!stav.lbTazeni || !stav.lbRozlozeno || stav.lbZobrazeno.presah <= 1) return;
        const rozdil = stav.lbZobrazeno.osa === 'x' ? e.clientX - stav.lbTazeni.x : e.clientY - stav.lbTazeni.y;
        if (Math.abs(rozdil) < 4 && !stav.lbTazeni.posunuto) return;
        stav.lbPosun = lbOmezit(stav.lbPosun - rozdil / stav.lbZobrazeno.presah, 0, 1);
        stav.lbTazeni = { x: e.clientX, y: e.clientY, posunuto: true };
        lbRozvrhnout();
    });

    lightbox.addEventListener('click', (e) => {
        const tazeno = stav.lbTazeni?.posunuto;
        stav.lbTazeni = null;
        // Tlačítko nesmí zůstat zaměřené, jinak by ho mezerník stiskl podruhé
        e.target.closest('button')?.blur();

        if (e.target.closest('.poster')) {
            // Klik na fotku přepíná lupu, konec tažení se za klik nepočítá
            if (!tazeno) lbPrepnoutLupu(!stav.lbLupa, e);
        } else if (e.target === lightbox || e.target === lbStage) {
            zavritLightbox();
        }
    });

    lightbox.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (stav.lbLupa) return;
        if (stav.lbRozlozeno && stav.lbZobrazeno.presah > 1) {
            stav.lbPosun = lbOmezit(stav.lbPosun + (e.deltaY || e.deltaX) / stav.lbZobrazeno.presah, 0, 1);
            lbRozvrhnout();
        } else {
            // Touchpad posílá desítky událostí na jedno gesto; listuje se nejvýš jednou za čtvrt vteřiny
            if (Date.now() - stav.lbPosledniKrokKoleckem < 250) return;
            stav.lbPosledniKrokKoleckem = Date.now();
            lbZobrazit(stav.lbIndex + (e.deltaY > 0 ? 1 : -1));
        }
    }, { passive: false });

    // Odkazy na vydání a na modelku fungují v profilu i na stránce vydání
    document.querySelector('main').addEventListener('click', (e) => {
        const vydani = e.target.closest('[data-vydani]');
        const modelka = e.target.closest('[data-modelka]');
        const hodnota = e.target.closest('[data-hledat]');
        const fotograf = e.target.closest('[data-fotograf]');
        const odkaz = e.target.closest('[data-odkaz]');
        if (odkaz) BrowserOpenURL(odkaz.dataset.odkaz);
        else if (fotograf) otevritFotografa(fotograf.dataset.fotograf);
        else if (vydani) otevritVydani(vydani.dataset.vydani);
        else if (modelka) otevritProfilPodleId(parseInt(modelka.dataset.modelka));
        else if (hodnota) hledatHodnotu(hodnota.dataset.hledat);
    });
}
