// Zápis do stránky jen při skutečné změně. WebKitGTK zahodí klik, když se mezi stisknutím a puštěním tlačítka myši
// vymění obsah prvku pod kurzorem – třeba když opuštění pole (událost change) přepíše náhled nebo text tlačítka Uložit.
const zapsaneHtml = new WeakMap();

export function nastavitText(prvek, text) {
    if (prvek && prvek.textContent !== text) prvek.textContent = text;
}

export function nastavitHtml(prvek, html) {
    if (!prvek || zapsaneHtml.get(prvek) === html) return;
    prvek.innerHTML = html;
    zapsaneHtml.set(prvek, html);
}

// Seznam prvků podle klíče (data-klic): prvek se stejným HTML zůstane (i s fokusem), změněný se nahradí, chybějící
// přidá, přebytečný odebere. polozky = [{ klic, html }], html má jeden kořenový prvek s data-klic.
const htmlPrvku = new WeakMap();
let sablona = null;
function vytvorit(html) {
    sablona ||= document.createElement('template');
    sablona.innerHTML = html;
    const prvek = /** @type {HTMLElement} */ (sablona.content.firstElementChild);
    htmlPrvku.set(prvek, html);
    return prvek;
}

export function srovnatSeznam(kontejner, polozky) {
    const stare = new Map([...kontejner.children].map(e => [/** @type {HTMLElement} */ (e).dataset.klic, e]));
    polozky.forEach(({ klic, html }, i) => {
        let prvek = stare.get(klic);
        stare.delete(klic);
        if (prvek && htmlPrvku.get(prvek) !== html) {
            const novy = vytvorit(html);
            prvek.replaceWith(novy);
            prvek = novy;
        } else if (!prvek) prvek = vytvorit(html);
        if (kontejner.children[i] !== prvek) kontejner.insertBefore(prvek, kontejner.children[i] || null);
    });
    stare.forEach(e => e.remove());
}
