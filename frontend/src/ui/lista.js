import { esc } from '../lib/format';

// Lišta částí: řádek tlačítek, který šipkami a ztrácejícími se okraji ukazuje, že pokračuje mimo okno.
// Používá ji profil modelky (alba), stránka vydání a prohlížeč fotek (alba).
// svisla: sloupec u okraje přehledu (galerie, stěna, covery, kalendář, nejlepší); položky jsou pod sebou
// Zkratka do úzkého svislého pruhu: desetiletí „1970–1979“ jako 1970, měsíc „Březen 2026“ jako Bře 26
export function zkratka(nazev) {
    const desetileti = nazev.match(/^(\d{4})–\d{4}$/);
    if (desetileti) return desetileti[1];
    const mesic = nazev.match(/^(\p{L}{3})\p{L}* \d{2}(\d{2})$/u);
    if (mesic) return `${mesic[1]} ${mesic[2]}`;
    // „Bez data“, „Bez vydání“: do pruhu se nevejde, celý název je v nápovědě
    if (nazev.startsWith('Bez ')) return '—';
    return nazev;
}

export function vytvoritListu(nav, poKliku, { svisla = false } = {}) {
    nav.className = `album-nav${svisla ? ' svisla' : ''} hidden`;
    nav.innerHTML = `
        <button class="album-nav-arrow" data-posun="-1" title="Předchozí">${svisla ? '&#8963;' : '&#8249;'}</button>
        <div class="album-nav-list"></div>
        <button class="album-nav-arrow" data-posun="1" title="Další">${svisla ? '&#8964;' : '&#8250;'}</button>`;
    const seznam = nav.querySelector('.album-nav-list');
    const [sipkaVlevo, sipkaVpravo] = nav.querySelectorAll('.album-nav-arrow');
    // Rozměry ve směru lišty: do stran u vodorovné, nahoru a dolů u svislé
    const delka = () => svisla ? seznam.clientHeight : seznam.clientWidth;
    const posunuto = () => svisla ? seznam.scrollTop : seznam.scrollLeft;

    // Bez přetečení šipky nejsou vůbec
    const upravitSipky = () => {
        const presah = (svisla ? seznam.scrollHeight : seznam.scrollWidth) - delka();
        const vlevo = posunuto() > 1;
        const vpravo = posunuto() < presah - 1;
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
        const krok = sipka && parseInt(sipka.dataset.posun) * delka() * 0.8;
        if (sipka) seznam.scrollBy({ [svisla ? 'top' : 'left']: krok, behavior: 'smooth' });
        else if (skok) poKliku(skok.dataset.skok);
    });

    // Kolečko nad lištou ji posouvá do stran, když se do ní všechno nevejde (svislou posouvá samo)
    nav.addEventListener('wheel', (e) => {
        if (svisla || seznam.scrollWidth <= seznam.clientWidth) return;
        e.preventDefault();
        e.stopPropagation();
        seznam.scrollLeft += e.deltaY || e.deltaX;
    }, { passive: false });

    // Svislá lišta po změně velikosti okna znovu zjistí, zda se do ní všechno vejde
    if (svisla) new ResizeObserver(upravitSipky).observe(seznam);

    return {
        nav,
        svisla,
        upravitSipky,
        // polozky: [{ klic, nazev, pocet }]; lišta má smysl až od dvou položek.
        // Svislý pruh je úzký: ukazuje jen zkratku, celý název a počet jsou v nápovědě.
        naplnit(polozky) {
            seznam.innerHTML = polozky.map(p => {
                const napoveda = p.pocet === undefined ? p.nazev : `${p.nazev} (${p.pocet})`;
                return svisla
                    ? `<button class="chip" data-skok="${esc(p.klic)}" title="${esc(napoveda)}">${esc(zkratka(String(p.nazev)))}</button>`
                    : `<button class="chip" data-skok="${esc(p.klic)}" title="${esc(p.nazev)}"><b>${esc(p.nazev)}</b>${p.pocet === undefined ? '' : `<span>${p.pocet}</span>`}</button>`;
            }).join('');
            nav.classList.toggle('hidden', polozky.length < 2);
            upravitSipky();
        },
        oznacit(klic) {
            seznam.querySelectorAll('[data-skok]').forEach(tlacitko => {
                const aktivni = tlacitko.dataset.skok === String(klic);
                if (aktivni && !tlacitko.classList.contains('active')) {
                    // Zvýrazněná položka má být v liště vidět
                    if (svisla) seznam.scrollTop = tlacitko.offsetTop - (seznam.clientHeight - tlacitko.offsetHeight) / 2;
                    else seznam.scrollLeft = tlacitko.offsetLeft - (seznam.clientWidth - tlacitko.offsetWidth) / 2;
                }
                tlacitko.classList.toggle('active', aktivni);
            });
        },
    };
}
