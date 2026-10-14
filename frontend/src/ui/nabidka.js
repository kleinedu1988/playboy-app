// Kontextová nabídka (pravé tlačítko, tlačítka ⋯ a +). Prvek existuje až po vložení kostry okna.
export let contextMenu = null;

export function pripravitNabidku() {
    contextMenu = document.getElementById('contextMenu');
}

export function zavritKontextovouNabidku() {
    contextMenu.classList.add('hidden');
}

export function otevritKontextovouNabidku(x, y, polozky) {
    contextMenu.innerHTML = '';
    polozky.forEach(p => {
        if (p === null) {
            contextMenu.appendChild(document.createElement('hr'));
            return;
        }
        const btn = document.createElement('button');
        btn.className = 'context-item';
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
}
