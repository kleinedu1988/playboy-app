// Přehled klávesových zkratek (klávesa ?): skleněný panel uprostřed okna nad ztmavenou stránkou. V prohlížeči fotek
// a ve čtečce stran (i v režimech Údržby) jde jejich část první a je zvýrazněná. Celá nápověda
// se otevře tlačítkem v patičce.
import { otevritNapovedu } from './napoveda';
import { lightbox } from './prohlizec';
import { stav } from './stav';
import { otevreneOkno } from '../ui/dom';

const k = (...klavesy) => klavesy.map(x => `<kbd>${x}</kbd>`).join('');
const nebo = '<span class="zkratky-nebo">/</span>';

const CASTI = [
    { klic: 'vse', nazev: 'Kdekoli', radky: [
        [k('Ctrl', 'F'), 'Hledat'],
        [`${k('Ctrl', '1')}–${k('5')}`, 'Sekce Modelky, Čísla, Hodnocení, Síň slávy, Sbírka (klik na zvolenou sekci otevře mapu všech částí)'],
        [`${k('Alt', '←')}${nebo}${k('Esc')}`, 'Zpět (z profilu, čísla)'],
        [k('?'), 'Klávesové zkratky'],
        [k('Esc'), 'Zavřít okno, zpět'],
        [k('Ctrl', 'Enter'), 'Uložit modelku (i v Doplnit modelku), použít text v editoru'],
        [`${k('Tab')}${nebo}${k('Enter')}`, 'Procházet a otevřít karty'],
        [`${k('1')}–${k('5')}${nebo}${k('0')}`, 'Srdíčka zaměřené karty nebo fotky, zrušit'],
        [`${k('3')} ${k('3')}`, 'U modelky stejná číslice znovu přidá půlku (3½; u pětky 4½)'],
        [k('←', '→'), 'Zaměřená srdíčka modelky po půlce (profil, Hodnocení)'],
        [k('←', '→'), 'Části stránky, když je zaměřená pilulka pásu (Hodnocení, Síň slávy, Sbírka) nebo volba pod hledáním'],
        [k('←', '↑', '→', '↓'), 'Pohyb v mapě edice (Sbírka › panel Čísla a sháním)'],
        [`${k('Shift', 'F10')}`, 'Nabídka akcí (jako pravé tlačítko)'],
    ] },
    { klic: 'hledani', nazev: 'Výsledky hledání', radky: [
        [k('↑', '↓'), 'Vybrat'],
        [k('Enter'), 'Otevřít'],
        [k('Esc'), 'Zavřít výsledky'],
    ] },
    { klic: 'profil', nazev: 'Profil modelky', radky: [
        [k('←', '→'), 'Předchozí a další modelka'],
        [`${k('Alt', '←')}${nebo}${k('Esc')}`, 'Zpět'],
        [k('I'), 'Panel Údaje (otevřít, zavřít)'],
        [k('T'), 'Tagy vybraných fotek'],
        [k('Esc'), 'V režimu Vybrat: ukončit výběr'],
    ] },
    { klic: 'udrzba-udaje', nazev: 'Údržba – Po údajích', radky: [
        [k('Enter'), 'Uložit řádek a jít na další'],
        [k('Tab'), 'Přeskočit na další pole'],
        [k('Esc'), 'Vrátit hodnotu řádku'],
        [`${k('Delete')}${nebo}${k('Ctrl', 'Delete')}`, 'Netýká se (v prázdném poli; V pořádku u kontroly, jde vrátit)'],
        [`${k('1')}–${k('5')}`, 'Srdíčka v řádku hodnocení (stejná znovu = půlka, ← → po půlce)'],
    ] },
    { klic: 'udrzba-modelky', nazev: 'Údržba – Po modelkách', radky: [
        [k('Enter'), 'Další pole na kartě'],
        [k('Ctrl', 'Enter'), 'Uložit změny a otevřít další modelku'],
        [`${k('PageDown')}${nebo}${k('Alt', '→')}`, 'Další ve frontě (přeskočit)'],
        [`${k('PageUp')}${nebo}${k('Alt', '←')}`, 'Předchozí ve frontě'],
        [k('Esc'), 'Vrátit hodnotu pole'],
        [`${k('1')}–${k('5')}`, 'Srdíčka, když je zaměřené hodnocení (stejná znovu = půlka)'],
    ] },
    { klic: 'porovnat', nazev: 'Hodnocení – Porovnat', radky: [
        [`${k('←', '→')}${nebo}kolečko`, 'Listovat pásem fotek pod myší'],
        [k('Tab'), 'Přepnout horní a dolní pás'],
        [k('Enter'), 'Líbí se mi víc modelka aktivního pásu'],
        [`${k('↓')}${nebo}${k('Mezerník')}`, 'Obě stejně (remíza)'],
        [`${k('1')}–${k('5')}${nebo}${k('0')}`, 'Srdíčka zvýrazněné fotce, 0 je zruší'],
        ['klik na fotku', 'Prohlížeč fotek jako u alb (všechny fotky modelky), Esc zpět'],
        [k('S'), 'Přeskočit dvojici'],
        [k('T'), 'V tematické sezóně přepnout režim: téma sezóny ↔ Klasické'],
        [k('Backspace'), 'Vrátit poslední porovnání'],
        [k('I'), 'Panel vpravo: Tipy, Trendy, Jak počítám (Esc zavře; i ve Fotkách a Pořadí)'],
    ] },
    { klic: 'slava', nazev: 'Síň slávy', radky: [
        [k('Enter'), 'Na kartě v Top 10 otevřít vitrínu modelky, v Legendách profil'],
        [k('Esc'), 'Zavřít vitrínu (nebo panel vpravo)'],
        [k('I'), 'Panel vpravo: Na dosah, Minulé sezóny, Pravidla'],
    ] },
    { klic: 'udrzba-souhrn', nazev: 'Údržba – Souhrn', radky: [
        [k('I'), 'Panel vpravo: Čísla a sháním, Statistiky, Učení (Esc zavře)'],
        [k('↑', '↓'), 'Předchozí a další řádek (i položky rozbalené skupiny)'],
        [k('→', '←'), 'Rozbalit a sbalit skupinu'],
        [k('Enter'), 'Hlavní akce: doplnit, opravit, přijmout návrh'],
        [k('Delete'), 'Netýká se, V pořádku, Odmítnout (jde vrátit)'],
        [k('E'), 'Upravit návrh ve formuláři'],
        [k('S'), 'Vyřídit modelku v režimu Po modelkách'],
        [`${k('Ctrl', 'F')}${nebo}${k('/')}`, 'Hledat ve frontě (hledání nahoře), ↓ skočí do fronty'],
    ] },
    { klic: 'vyber', nazev: 'Výběr fotek', radky: [
        [`${k('Ctrl')} + klik`, 'Přidat do výběru'],
        [`${k('Shift')} + klik`, 'Vybrat úsek'],
        [k('Ctrl', 'A'), 'Vybrat vše'],
        [k('Delete'), 'Odebrat vybrané (jde vrátit)'],
        [k('Esc'), 'Zrušit výběr'],
    ] },
    { klic: 'prohlizec', nazev: 'Prohlížeč fotek', radky: [
        [k('←', '→'), 'Listovat'],
        [k('↑', '↓'), 'Skok na další album'],
        [k('Mezerník'), 'Slideshow'],
        [k('S'), 'Zamíchat'],
        [k('F'), 'Rozložit plakát přes okno'],
        [k('R'), 'Otočit'],
        [`${k('1')}–${k('5')}`, 'Srdíčka'],
        [k('0'), 'Zrušit srdíčka'],
        [k('Backspace'), 'Ve frontě nehodnocených (Hodnocení › Fotky): vrátit poslední hodnocení'],
        [k('Esc'), 'Zavřít'],
    ] },
    { klic: 'poradi', nazev: 'Hodnocení – Pořadí', radky: [
        [k('↑', '↓'), 'Vybrat modelku (podrobnosti ve stavové liště)'],
        ['písmena', 'Skok na jméno (víc písmen rychle za sebou upřesní)'],
        [k('Enter'), 'Profil vybrané modelky'],
        [k('R'), 'Rozhodnout: souboje o úroveň vybrané čekající nebo obhajující'],
    ] },
    { klic: 'fotky', nazev: 'Hodnocení – Hodnotit', radky: [
        [k('Enter'), 'Fotky: začít hodnotit · Modelky: první karta bez srdíček'],
        [k('Mezerník'), 'Promítat nehodnocené fotky'],
        [`${k('1')}–${k('5')}`, 'Modelky: srdíčka zaměřené karty (stejná znovu = půlka), pak se fokus posune na další'],
        [k('Backspace'), 'Modelky: vrátit poslední hodnocení'],
        [`${k('1')}–${k('9')}${nebo}${k('0')}`, 'Průvodce: volba v kroku (i numerická klávesnice), 0 = žádná; výlučný krok jde rovnou dál'],
        [`${k('Enter')}${nebo}${k('→')}`, 'Průvodce: potvrdit krok (i předvyplněný z alba) a dál'],
        [`${k('Backspace')}${nebo}${k('←')}`, 'Průvodce: o krok zpět; na prvním kroku vrátit minulou fotku'],
        [`${k('Shift', 'Enter')}`, 'Průvodce: tagy jako minulá fotka a rovnou srdíčka'],
        [`${k('S')} · ${k('H')}`, 'Průvodce: přeskočit fotku (potvrzené kroky se uloží) · skrýt pásek'],
        [k('J'), 'Průvodce: jen srdíčka (1–5 uloží jen srdíčka, tagy počkají) a zpět'],
    ] },
    { klic: 'ctecka', nazev: 'Čtečka stran', radky: [
        [`${k('←', '→')}${nebo}${k('Mezerník')}`, 'Listovat'],
        [k('Home', 'End'), 'První a poslední strana'],
        [`${k('1')}${nebo}${k('2')}`, 'Jedna strana a dvojstrana'],
        [k('Esc'), 'Zavřít'],
    ] },
];

let panel = null;
let fokusPredOtevrenim = null;

function pripravitPanel() {
    panel = document.createElement('div');
    panel.id = 'zkratky';
    panel.className = 'zkratky-zavoj hidden';
    panel.innerHTML = `
        <div class="zkratky" role="dialog" aria-modal="true" aria-labelledby="zkratkyNadpis" tabindex="-1">
            <h3 id="zkratkyNadpis">Klávesové zkratky</h3>
            <div class="zkratky-casti"></div>
            <div class="zkratky-pata">
                <span>${k('?')} nebo ${k('Esc')} zavře</span>
                <button type="button" class="link" data-cela-napoveda>Celá nápověda →</button>
            </div>
        </div>`;
    document.body.append(panel);
    panel.addEventListener('click', (e) => {
        if (e.target.closest('[data-cela-napoveda]')) {
            zavritZkratky();
            otevritNapovedu();
        } else if (!e.target.closest('.zkratky')) zavritZkratky();
    });
}

export function otevritZkratky() {
    if (!panel) pripravitPanel();
    // Část toho, co je právě otevřené, jde první a je zvýrazněná
    const ctecka = document.getElementById('ctecka');
    const prehledVidet = stav.rezim === 'prehled' && !document.getElementById('stats')?.classList.contains('hidden');
    const udrzba = prehledVidet && stav.prehledSekce === 'udrzba';
    const aktivni = !lightbox.classList.contains('hidden') ? 'prohlizec' : ctecka && !ctecka.classList.contains('hidden') ? 'ctecka'
        : udrzba ? `udrzba-${stav.udrzbaRezim}`
            : prehledVidet && stav.prehledSekce === 'oblibenost' ? (stav.oblibenostCast === 'slava' ? 'slava' : ['porovnat', 'fotky', 'poradi'].includes(stav.hodnoceniPohled) ? stav.hodnoceniPohled : '') : '';
    const casti = aktivni ? [CASTI.find(c => c.klic === aktivni), ...CASTI.filter(c => c.klic !== aktivni)] : CASTI;
    panel.querySelector('.zkratky-casti').innerHTML = casti.map(c => `
        <section class="${c.klic === aktivni ? 'aktivni' : ''}">
            <h4>${c.nazev}</h4>
            <dl>${c.radky.map(([klavesy, popis]) => `<dt>${klavesy}</dt><dd>${popis}</dd>`).join('')}</dl>
        </section>`).join('');
    panel.classList.remove('hidden');
    // Fokus do panelu: Enter ani mezerník nesmí kliknout na tlačítko pod ním, Tab zůstává v panelu
    fokusPredOtevrenim = document.activeElement;
    panel.querySelector('.zkratky').focus({ preventScroll: true });
}

export function zavritZkratky() {
    if (!panel || panel.classList.contains('hidden')) return;
    panel.classList.add('hidden');
    if (fokusPredOtevrenim?.isConnected) fokusPredOtevrenim.focus({ preventScroll: true });
    fokusPredOtevrenim = null;
}

const otevreno = () => panel && !panel.classList.contains('hidden');

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // ? otevře a zavře přehled (ne při psaní a nad okny kromě čtečky stran); Esc ho zavře a dál nejde
    document.addEventListener('keydown', (e) => {
        if (otevreno()) {
            // Žádná klávesa nepatří stránce pod panelem (listování, srdíčka, Esc filtrů); obsluha zkratek je
            // registrovaná první, takže zastaví i ostatní obsluhy na dokumentu. Tab a Enter na tlačítku
            // „Celá nápověda“ zůstávají panelu.
            if (e.key === 'Tab') return;
            e.stopImmediatePropagation();
            if (e.key === 'Escape' || e.key === '?') {
                e.preventDefault();
                zavritZkratky();
            } else if (!(e.target.closest?.('.zkratky button') && (e.key === 'Enter' || e.key === ' '))) {
                e.preventDefault();
            }
            return;
        }
        if (e.key !== '?' || stav.zamceno || e.ctrlKey || e.altKey || e.metaKey || e.target.closest('input, textarea, select')
            || otevreneOkno('ctecka')) return;
        e.preventDefault();
        e.stopPropagation();
        otevritZkratky();
    }, true);
}
