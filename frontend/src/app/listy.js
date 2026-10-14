// Lišty nad rolovanými stránkami: skok na část a zvýraznění té, která je nahoře
import { vytvoritListu } from '../ui/lista';
import { best, calendar, covers, gallery, wall } from './prvky';

// Lišta nad rolovanou stránkou: skáče na její části (prvky s data-cast) a zvýrazňuje tu, která je právě nahoře
export const hlavniOblast = document.querySelector('main');
export const listyStranky = [];

export function vytvoritListuStranky(nav, pohled) {
    const casti = () => [...pohled.querySelectorAll('[data-cast]')];
    const lista = vytvoritListu(nav, (klic) => {
        const cast = casti().find(c => c.dataset.cast === klic);
        if (!cast) return;
        const posun = cast.getBoundingClientRect().top - hlavniOblast.getBoundingClientRect().top - nav.offsetHeight - 8;
        hlavniOblast.scrollTo({ top: hlavniOblast.scrollTop + posun, behavior: 'smooth' });
    });
    lista.sledovat = () => {
        // Skrytá lišta ani lišta ve skrytém pohledu se nesleduje
        if (!nav.offsetParent) return;
        const hranice = nav.getBoundingClientRect().bottom + 40;
        const vsechny = casti();
        // Na konci stránky už poslední část výš nevyjede, i tak je to ta aktuální
        const naKonci = hlavniOblast.scrollTop > 0 && hlavniOblast.scrollTop >= hlavniOblast.scrollHeight - hlavniOblast.clientHeight - 1;
        const aktualni = naKonci ? vsechny.at(-1) : vsechny.filter(c => c.getBoundingClientRect().top <= hranice).pop() || vsechny[0];
        lista.oznacit(aktualni?.dataset.cast);
    };
    listyStranky.push(lista);
    return lista;
}

export const listaAlb = vytvoritListuStranky(document.getElementById('albumNav'), document.getElementById('photosGrid'));
export const listaCoveru = vytvoritListuStranky(document.getElementById('coversNav'), covers);
export const listaKalendare = vytvoritListuStranky(document.getElementById('calNav'), calendar);
export const listaGalerie = vytvoritListuStranky(document.getElementById('galleryNav'), gallery);
export const listaSteny = vytvoritListuStranky(document.getElementById('wallNav'), wall);
export const listaStranky = vytvoritListuStranky(document.getElementById('issueNav'), document.getElementById('issueMain'));
export const listaNejlepsich = vytvoritListuStranky(document.getElementById('bestNav'), best);