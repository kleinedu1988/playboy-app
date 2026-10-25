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
