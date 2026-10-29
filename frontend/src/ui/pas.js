// Plovoucí pás stránky (Hodnocení, Síň slávy, Sbírka): při rolování drží nahoře (CSS sticky). Přilepený dostane
// třídu .prilepeny – schová informace vpravo a zůstanou jen pilulky částí. Jeho výšku dostanou další lepivé prvky
// pod ním (lišta nástrojů a bok Údržby) v proměnné --vyska-pasu, aby se pod něj neschovaly.
export function pripravitPasy() {
    const hlavni = document.querySelector('main');
    if (!hlavni) return;
    let ceka = false;
    const obnovit = () => {
        ceka = false;
        const horni = hlavni.getBoundingClientRect().top;
        hlavni.querySelectorAll('.plovouci-pas').forEach((pas) => {
            if (!pas.getClientRects().length) return;
            pas.classList.toggle('prilepeny', hlavni.scrollTop > 0 && pas.getBoundingClientRect().top <= horni + 1);
            hlavni.style.setProperty('--vyska-pasu', `${pas.offsetHeight}px`);
        });
    };
    const naplanovat = () => {
        if (ceka) return;
        ceka = true;
        requestAnimationFrame(obnovit);
    };
    hlavni.addEventListener('scroll', naplanovat, { passive: true });
    // Pás se při změně části nebo filtru vykreslí znovu (bez třídy): stav se obnoví hned
    document.addEventListener('volby-prehledu', naplanovat);
    window.addEventListener('resize', naplanovat);
}
