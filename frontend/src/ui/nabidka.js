// Kontextová nabídka (pravé tlačítko, tlačítka ⋯ a +). Prvek existuje až po vložení kostry okna.
// Ovládá se i klávesnicí: šipky, Home, End, Enter; Esc ji zavře a fokus se vrátí tam, kde byl.
export let contextMenu = null;
let fokusPredOtevrenim = null;
// Co udělat, až se nabídka zavře (volby v liště zruší zvýraznění)
let priZavreni = null;

export function pripravitNabidku() {
    contextMenu = document.getElementById('contextMenu');
    contextMenu.setAttribute('role', 'menu');
    contextMenu.addEventListener('keydown', (e) => {
        const polozky = [...contextMenu.querySelectorAll('.context-item')];
        const kde = polozky.indexOf(document.activeElement);
        let cil = null;
        if (e.key === 'ArrowDown') cil = polozky[(kde + 1) % polozky.length];
        else if (e.key === 'ArrowUp') cil = polozky[(kde - 1 + polozky.length) % polozky.length];
        else if (e.key === 'Home') cil = polozky[0];
        else if (e.key === 'End') cil = polozky.at(-1);
        else if (e.key === 'Escape' || e.key === 'Tab') zavritKontextovouNabidku();
        else return;
        // Šipky ani Esc nesmí dojít k obsluze stránky (přepnutí modelky, prohlížeč, Zpět)
        e.preventDefault();
        e.stopPropagation();
        cil?.focus();
    });
}

export function zavritKontextovouNabidku() {
    if (contextMenu.classList.contains('hidden')) return;
    const meloFokus = contextMenu.contains(document.activeElement);
    contextMenu.classList.add('hidden');
    const zavreni = priZavreni;
    priZavreni = null;
    zavreni?.();
    if (meloFokus && fokusPredOtevrenim?.isConnected) fokusPredOtevrenim.focus({ preventScroll: true });
    fokusPredOtevrenim = null;
}

// Položky s příznakem nebezpecne (mazání) jdou vždy na konec za oddělovač a jsou červené,
// aby nestály uprostřed běžných akcí. Oddělovače na začátku, na konci a dva za sebou se vynechají.
function seraditPolozky(polozky) {
    const bezne = polozky.filter(p => !p?.nebezpecne);
    const nebezpecne = polozky.filter(p => p?.nebezpecne);
    const vse = nebezpecne.length ? [...bezne, null, ...nebezpecne] : bezne;
    return vse.filter((p, i) => p !== null || (i > 0 && i < vse.length - 1 && vse[i - 1] !== null));
}

export function otevritKontextovouNabidku(x, y, polozky, { poZavreni = null } = {}) {
    if (contextMenu.classList.contains('hidden')) fokusPredOtevrenim = document.activeElement;
    else priZavreni?.();
    priZavreni = poZavreni;
    contextMenu.innerHTML = '';
    seraditPolozky(polozky).forEach(p => {
        if (p === null) {
            contextMenu.appendChild(document.createElement('hr'));
            return;
        }
        const btn = document.createElement('button');
        btn.className = p.nebezpecne ? 'context-item nebezpecne' : 'context-item';
        btn.setAttribute('role', 'menuitem');
        btn.textContent = p.text;
        btn.onclick = () => {
            zavritKontextovouNabidku();
            p.akce();
        };
        contextMenu.appendChild(btn);
    });

    // Nabídka nesmí vyjet mimo okno
    contextMenu.classList.remove('hidden');
    const sirka = contextMenu.offsetWidth;
    const vyska = contextMenu.offsetHeight;
    contextMenu.style.left = Math.max(4, Math.min(x, window.innerWidth - sirka - 4)) + 'px';
    contextMenu.style.top = Math.max(4, Math.min(y, window.innerHeight - vyska - 4)) + 'px';
    contextMenu.querySelector('.context-item')?.focus({ preventScroll: true });
}
