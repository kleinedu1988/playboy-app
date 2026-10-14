import { esc } from '../lib/format';

// Lišta částí: řádek tlačítek, který šipkami a ztrácejícími se okraji ukazuje, že pokračuje mimo okno.
// Používá ji profil modelky (alba), přehled coverů (ročníky), kalendář (desetiletí) a prohlížeč fotek (alba).
export function vytvoritListu(nav, poKliku) {
    nav.className = 'album-nav hidden';
    nav.innerHTML = `
        <button class="album-nav-arrow" data-posun="-1" title="Předchozí">&#8249;</button>
        <div class="album-nav-list"></div>
        <button class="album-nav-arrow" data-posun="1" title="Další">&#8250;</button>`;
    const seznam = nav.querySelector('.album-nav-list');
    const [sipkaVlevo, sipkaVpravo] = nav.querySelectorAll('.album-nav-arrow');

    // Bez přetečení šipky nejsou vůbec
    const upravitSipky = () => {
        const presah = seznam.scrollWidth - seznam.clientWidth;
        const vlevo = seznam.scrollLeft > 1;
        const vpravo = seznam.scrollLeft < presah - 1;
        nav.classList.toggle('pretekla', presah > 1);
        seznam.classList.toggle('dalsi-vlevo', vlevo);
        seznam.classList.toggle('dalsi-vpravo', vpravo);
        sipkaVlevo.disabled = !vlevo;
        sipkaVpravo.disabled = !vpravo;
    };
    seznam.addEventListener('scroll', upravitSipky, { passive: true });

    nav.addEventListener('click', (e) => {
        const sipka = e.target.closest('[data-posun]');
        const skok = e.target.closest('[data-skok]');
        if (sipka) seznam.scrollBy({ left: parseInt(sipka.dataset.posun) * seznam.clientWidth * 0.8, behavior: 'smooth' });
        else if (skok) poKliku(skok.dataset.skok);
    });

    // Kolečko nad lištou ji posouvá do stran, když se do ní všechno nevejde
    nav.addEventListener('wheel', (e) => {
        if (seznam.scrollWidth <= seznam.clientWidth) return;
        e.preventDefault();
        e.stopPropagation();
        seznam.scrollLeft += e.deltaY || e.deltaX;
    }, { passive: false });

    return {
        nav,
        upravitSipky,
        // polozky: [{ klic, nazev, pocet }]; lišta má smysl až od dvou položek
        naplnit(polozky) {
            seznam.innerHTML = polozky.map(p => `
                <button class="chip" data-skok="${esc(p.klic)}" title="${esc(p.nazev)}"><b>${esc(p.nazev)}</b>${p.pocet === undefined ? '' : `<span>${p.pocet}</span>`}</button>`).join('');
            nav.classList.toggle('hidden', polozky.length < 2);
            upravitSipky();
        },
        oznacit(klic) {
            seznam.querySelectorAll('[data-skok]').forEach(tlacitko => {
                const aktivni = tlacitko.dataset.skok === String(klic);
                if (aktivni && !tlacitko.classList.contains('active')) {
                    // Zvýrazněná položka má být v liště vidět
                    seznam.scrollLeft = tlacitko.offsetLeft - (seznam.clientWidth - tlacitko.offsetWidth) / 2;
                }
                tlacitko.classList.toggle('active', aktivni);
            });
        },
    };
}
