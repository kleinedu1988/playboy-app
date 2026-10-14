// Lišty nad rolovanými stránkami: skok na část a zvýraznění té, která je nahoře
import { vytvoritListu } from '../ui/lista';
import { best, calendar, covers, gallery, wall } from './prvky';

// Lišta nad rolovanou stránkou: skáče na její části (prvky s data-cast) a zvýrazňuje tu, která je právě nahoře
export const hlavniOblast = document.querySelector('main');
export const listyStranky = [];

// svisla: lišta je sloupec vedle obsahu, ne řádek nad ním
export function vytvoritListuStranky(nav, pohled, { svisla = false } = {}) {
    const casti = () => [...pohled.querySelectorAll('[data-cast]')];
    // Kde začíná viditelný obsah: pod vodorovnou lištou, u svislé hned nahoře
    const horniOkraj = () => svisla ? hlavniOblast.getBoundingClientRect().top : nav.getBoundingClientRect().bottom;
    const lista = vytvoritListu(nav, (klic) => {
        const cast = casti().find(c => c.dataset.cast === klic);
        if (!cast) return;
        const posun = cast.getBoundingClientRect().top - hlavniOblast.getBoundingClientRect().top - (svisla ? 0 : nav.offsetHeight) - 8;
        hlavniOblast.scrollTo({ top: hlavniOblast.scrollTop + posun, behavior: 'smooth' });
    }, { svisla });
    lista.sledovat = () => {
        // Skrytá lišta ani lišta ve skrytém pohledu se nesleduje
        if (!nav.getClientRects().length) return;
        const hranice = horniOkraj() + 40;
        const vsechny = casti();
        // Na konci stránky už poslední část výš nevyjede, i tak je to ta aktuální
        const naKonci = hlavniOblast.scrollTop > 0 && hlavniOblast.scrollTop >= hlavniOblast.scrollHeight - hlavniOblast.clientHeight - 1;
        const aktualni = naKonci ? vsechny.at(-1) : vsechny.filter(c => c.getBoundingClientRect().top <= hranice).pop() || vsechny[0];
        lista.oznacit(aktualni?.dataset.cast);
    };
    listyStranky.push(lista);
    return lista;
}

// Svislý rejstřík u pravého okraje se ukáže při rolování (a chvíli po něm) a když je myš u pravého okraje
const svisleListy = () => listyStranky.filter(l => l.svisla && l.nav.getClientRects().length);
let skrytiPoRolovani = null;
hlavniOblast.addEventListener('scroll', () => {
    svisleListy().forEach(l => l.nav.classList.add('rolovani'));
    clearTimeout(skrytiPoRolovani);
    skrytiPoRolovani = setTimeout(() => listyStranky.forEach(l => l.nav.classList.remove('rolovani')), 1200);
}, { passive: true });
document.addEventListener('mousemove', (e) => {
    const blizko = e.clientX > window.innerWidth - 80 && e.clientY > hlavniOblast.getBoundingClientRect().top;
    listyStranky.forEach(l => { if (l.svisla) l.nav.classList.toggle('blizko', blizko); });
}, { passive: true });

export const listaAlb = vytvoritListuStranky(document.getElementById('albumNav'), document.getElementById('photosGrid'));
export const listaCoveru = vytvoritListuStranky(document.getElementById('coversNav'), covers, { svisla: true });
export const listaKalendare = vytvoritListuStranky(document.getElementById('calNav'), calendar, { svisla: true });
export const listaGalerie = vytvoritListuStranky(document.getElementById('galleryNav'), gallery, { svisla: true });
export const listaSteny = vytvoritListuStranky(document.getElementById('wallNav'), wall, { svisla: true });
export const listaStranky = vytvoritListuStranky(document.getElementById('issueNav'), document.getElementById('issueMain'));
export const listaNejlepsich = vytvoritListuStranky(document.getElementById('bestNav'), best);