import { KATEGORIE, esc, rozlozitKategorie, slozitKategorie } from '../lib/format';

// Výběr kategorií modelky: přepínací štítky ze seznamu KATEGORIE, u Playmate roku rok, u Cyber Girl a Coed
// úroveň (týdne, měsíce, roku), vlastní kategorie textem. Hodnota se drží ve skrytém poli `vstup` (pole role),
// takže ukládání formuláře zůstává stejné. Používá ji formulář modelky i okno Doplnit modelku.
// odvozene: názvy kategorií, které program zná z dat (centerfold, obálka) – ukážou se zapnuté a nejdou vypnout.
export function pripojitVyberKategorii(vstup, kontejner, odvozene = []) {
    kontejner.classList.add('kategorie-vyber');
    let polozky = rozlozitKategorie(vstup.value);

    const zapsat = () => {
        vstup.value = slozitKategorie(polozky);
        vstup.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const vykreslit = () => {
        const volby = KATEGORIE.map(k => {
            const polozka = polozky.find(p => p.nazev === k.nazev);
            const odvozena = odvozene.includes(k.nazev);
            const zapnuta = Boolean(polozka) || odvozena;
            const title = odvozena ? { 'Playmate měsíce': 'Odvozeno z centerfoldu modelky', 'Cyber Girl': 'Odvozeno z online alba modelky' }[k.nazev] || 'Odvozeno z obálky ve sbírce' : '';
            let detail = '';
            if (polozka && k.rok) {
                detail = `<input type="text" class="kategorie-detail" data-kategorie-rok="${esc(k.nazev)}" value="${esc(polozka.detail)}" placeholder="rok" inputmode="numeric" maxlength="4" aria-label="Rok – ${esc(k.nazev)}" />`;
            } else if (polozka && k.urovne) {
                detail = `<select class="kategorie-detail" data-kategorie-uroven="${esc(k.nazev)}" aria-label="Úroveň – ${esc(k.nazev)}">
                    <option value="">bez úrovně</option>${k.urovne.map(u => `<option ${u === polozka.detail ? 'selected' : ''}>${u}</option>`).join('')}</select>`;
            }
            return `<span class="kategorie-polozka"><button type="button" class="chip ${zapnuta ? 'active' : ''} ${odvozena ? 'odvozena' : ''}"
                data-kategorie="${esc(k.nazev)}" aria-pressed="${zapnuta}" ${odvozena && !polozka ? 'aria-disabled="true"' : ''} ${title ? `title="${title}"` : ''}>${esc(k.nazev)}</button>${detail}</span>`;
        });
        const vlastni = polozky.filter(p => p.vlastni).map(p =>
            `<span class="kategorie-polozka"><button type="button" class="chip active" data-kategorie="${esc(p.nazev)}" aria-pressed="true" title="Vlastní kategorie – klik ji odebere">${esc(p.nazev)} ×</button></span>`);
        kontejner.innerHTML = [...volby, ...vlastni].join('')
            + '<input type="text" class="kategorie-jina" placeholder="Jiná…" aria-label="Jiná kategorie (Enter přidá)" />';
    };

    kontejner.addEventListener('click', e => {
        const tlacitko = /** @type {HTMLElement} */ (e.target).closest('[data-kategorie]');
        if (!tlacitko || tlacitko.getAttribute('aria-disabled') === 'true') return;
        const nazev = tlacitko.dataset.kategorie;
        if (polozky.some(p => p.nazev === nazev)) polozky = polozky.filter(p => p.nazev !== nazev);
        else polozky.push({ nazev, detail: '', zbytek: '', vlastni: false });
        zapsat();
        vykreslit();
        // Fokus zůstane na stejném štítku (nebo na poli roku, které se právě objevilo)
        const znovu = kontejner.querySelector(`[data-kategorie="${CSS.escape(nazev)}"]`);
        const detail = znovu?.nextElementSibling;
        /** @type {HTMLElement} */ (detail instanceof HTMLInputElement && !detail.value ? detail : znovu)?.focus();
    });
    kontejner.addEventListener('change', e => {
        const prvek = /** @type {HTMLInputElement | HTMLSelectElement} */ (e.target);
        const nazev = prvek.dataset.kategorieRok || prvek.dataset.kategorieUroven;
        const polozka = nazev && polozky.find(p => p.nazev === nazev);
        if (!polozka) return;
        polozka.detail = prvek.value.trim();
        zapsat();
    });
    kontejner.addEventListener('keydown', e => {
        const prvek = /** @type {HTMLInputElement} */ (e.target);
        if (!prvek.classList.contains('kategorie-jina') || e.key !== 'Enter') return;
        e.preventDefault();
        pridatJinou(prvek);
    });
    kontejner.addEventListener('focusout', e => {
        const prvek = /** @type {HTMLInputElement} */ (e.target);
        if (prvek.classList.contains('kategorie-jina') && prvek.value.trim()) pridatJinou(prvek);
    });
    // Napsaný text se rozpozná: „pmoy 1998“ přidá Playmate roku 1998, neznámý zůstane jako vlastní kategorie
    function pridatJinou(prvek) {
        const nove = rozlozitKategorie(prvek.value).filter(n => !polozky.some(p => p.nazev === n.nazev));
        prvek.value = '';
        if (!nove.length) return;
        polozky.push(...nove);
        zapsat();
        vykreslit();
        /** @type {HTMLElement} */ (kontejner.querySelector('.kategorie-jina'))?.focus();
    }

    vykreslit();
    return {
        // Po změně hodnoty pole zvenčí (otevření formuláře pro jinou modelku)
        obnovit(noveOdvozene = []) {
            odvozene = noveOdvozene;
            polozky = rozlozitKategorie(vstup.value);
            vykreslit();
        },
    };
}
