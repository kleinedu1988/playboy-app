// Společné okno pro psaní textu v markdownu (průvodní text alba, text článku). Editor ukazuje text rovnou
// naformátovaný: značky (**, *, ~~, #, >) jsou schované a objeví se, jen když je kurzor ve formátovaném místě.
import { EditorState, EditorSelection } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo } from '@codemirror/commands';
import { Language, LanguageSupport, defineLanguageFacet, syntaxTree } from '@codemirror/language';
import { Strikethrough, parser } from '@lezer/markdown';

// Jen parser markdownu (bez @codemirror/lang-markdown, který s sebou táhne HTML, CSS a JavaScript pro bloky kódu)
const markdown = () => new LanguageSupport(new Language(defineLanguageFacet(), parser.configure([Strikethrough]), [], 'markdown'));

// Formátovaný úsek → třída obsahu; značky uvnitř se schovají, pokud v úseku není kurzor
const UPRAVY_V_RADKU = {
    StrongEmphasis: 'md-tucne',
    Emphasis: 'md-kurziva',
    Strikethrough: 'md-preskrtnute',
    InlineCode: 'md-kod',
};
const ZNACKY_V_RADKU = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark']);
const NADPISY = { ATXHeading1: 'md-h1', ATXHeading2: 'md-h2', ATXHeading3: 'md-h3' };

const skryt = Decoration.replace({});
// Mluvčí v rozhovoru („PLAYBOY:“ na začátku řádku) jako v hotovém článku (formatMarkdown s mluvci)
const vzorMluvciho = /^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ .'-]{1,30}):/;
const mluvci = Decoration.mark({ class: 'md-tucne' });

// Kurzor (nebo výběr) zasahuje do úseku od–do včetně okrajů
const kurzorV = (stav, od, do_) => stav.selection.ranges.some(r => r.from <= do_ && r.to >= od);

function ozdobit(view) {
    const stav = view.state;
    const ozdoby = [];
    for (const { from, to } of view.visibleRanges) {
        syntaxTree(stav).iterate({
            from, to,
            enter: (uzel) => {
                const nazev = uzel.name;
                if (UPRAVY_V_RADKU[nazev]) {
                    ozdoby.push(Decoration.mark({ class: UPRAVY_V_RADKU[nazev] }).range(uzel.from, uzel.to));
                    if (kurzorV(stav, uzel.from, uzel.to)) return;
                    // Značky jsou přímé potomky úseku
                    const kurzor = uzel.node.cursor();
                    if (kurzor.firstChild()) {
                        do {
                            if (ZNACKY_V_RADKU.has(kurzor.name)) ozdoby.push(skryt.range(kurzor.from, kurzor.to));
                        } while (kurzor.nextSibling());
                    }
                } else if (NADPISY[nazev] || nazev === 'Blockquote') {
                    const trida = NADPISY[nazev] || 'md-citat';
                    for (let pozice = uzel.from; pozice <= uzel.to;) {
                        const radek = stav.doc.lineAt(pozice);
                        ozdoby.push(Decoration.line({ class: trida }).range(radek.from));
                        pozice = radek.to + 1;
                    }
                } else if (nazev === 'HeaderMark' || nazev === 'QuoteMark') {
                    // Značka i mezera za ní; na řádku s kurzorem zůstane vidět
                    const radek = stav.doc.lineAt(uzel.from);
                    if (kurzorV(stav, radek.from, radek.to)) return;
                    const konec = Math.min(radek.to, uzel.to + (stav.doc.sliceString(uzel.to, uzel.to + 1) === ' ' ? 1 : 0));
                    ozdoby.push(skryt.range(uzel.from, konec));
                } else if (nazev === 'ListMark') {
                    ozdoby.push(Decoration.mark({ class: 'md-odrazka' }).range(uzel.from, uzel.to));
                }
            },
        });
    }
    for (const { from, to } of zvyraznitMluvci ? view.visibleRanges : []) {
        for (let pozice = from; pozice <= to;) {
            const radek = stav.doc.lineAt(pozice);
            const shoda = vzorMluvciho.exec(radek.text);
            if (shoda) ozdoby.push(mluvci.range(radek.from, radek.from + shoda[0].length));
            pozice = radek.to + 1;
        }
    }
    return Decoration.set(ozdoby, true);
}

const zivyNahled = ViewPlugin.fromClass(class {
    constructor(view) { this.decorations = ozdobit(view); }
    update(u) {
        if (u.docChanged || u.selectionSet || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
            this.decorations = ozdobit(u.view);
        }
    }
}, { decorations: p => p.decorations });

// Obalí výběr značkou (tučné, kurzíva); bez výběru vloží dvojici značek s kurzorem mezi nimi
function obalit(view, znacka) {
    view.dispatch(view.state.changeByRange(r => {
        const text = view.state.sliceDoc(r.from, r.to);
        const obaleno = text.startsWith(znacka) && text.endsWith(znacka) && text.length >= 2 * znacka.length;
        const novy = obaleno ? text.slice(znacka.length, -znacka.length) : znacka + text + znacka;
        return {
            changes: { from: r.from, to: r.to, insert: novy },
            range: r.empty ? EditorSelection.cursor(r.from + znacka.length) : EditorSelection.range(r.from, r.from + novy.length),
        };
    }));
    view.focus();
    return true;
}

// Přepne předponu řádků ve výběru („# “, „- “, „> “, „1. “)
function predpona(view, znak) {
    const stav = view.state;
    const zmeny = [];
    const radky = new Set();
    for (const r of stav.selection.ranges) {
        for (let pozice = r.from; pozice <= r.to;) {
            const radek = stav.doc.lineAt(pozice);
            if (!radky.has(radek.number)) {
                radky.add(radek.number);
                const stara = /^(#{1,3} |[-*•–] |> |\d+\. )/.exec(radek.text)?.[0] || '';
                zmeny.push({ from: radek.from, to: radek.from + stara.length, insert: stara === znak ? '' : znak });
            }
            pozice = radek.to + 1;
        }
    }
    view.dispatch({ changes: zmeny });
    view.focus();
    return true;
}

// Enter v seznamu nebo citátu pokračuje stejnou značkou; na prázdné položce značku smaže (konec seznamu)
function novyRadek(view) {
    const r = view.state.selection.main;
    if (!r.empty) return false;
    const radek = view.state.doc.lineAt(r.head);
    const shoda = /^(\s*)([-*•–]|\d+\.|>)\s/.exec(radek.text);
    if (!shoda || r.head < radek.from + shoda[0].length) return false;
    if (radek.text.trim() === shoda[0].trim()) {
        view.dispatch({ changes: { from: radek.from, to: radek.to, insert: '' } });
        return true;
    }
    const znacka = /^\d+\.$/.test(shoda[2]) ? `${parseInt(shoda[2]) + 1}.` : shoda[2];
    const vlozit = `\n${shoda[1]}${znacka} `;
    view.dispatch({ changes: { from: r.head, insert: vlozit }, selection: { anchor: r.head + vlozit.length }, scrollIntoView: true });
    return true;
}

const NASTROJE = {
    tucne: v => obalit(v, '**'),
    kurziva: v => obalit(v, '*'),
    preskrtnute: v => obalit(v, '~~'),
    nadpis: v => predpona(v, '## '),
    odrazky: v => predpona(v, '- '),
    cisla: v => predpona(v, '1. '),
    citat: v => predpona(v, '> '),
    zpet: v => undo(v),
};

let editor = null;
let vyreseni = null;
let zvyraznitMluvci = false;
const okno = () => document.getElementById('textModal');

function vytvoritEditor() {
    editor = new EditorView({
        parent: document.getElementById('textEditor'),
        state: EditorState.create({ extensions: rozsireni() }),
    });
}

const rozsireni = (zastupny = '') => [
    history(),
    keymap.of([
        { key: 'Mod-b', run: NASTROJE.tucne },
        { key: 'Mod-i', run: NASTROJE.kurziva },
        { key: 'Mod-Enter', run: () => { pouzit(); return true; } },
        { key: 'Enter', run: novyRadek },
        ...defaultKeymap, ...historyKeymap,
    ]),
    markdown(),
    zivyNahled,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'Text', spellcheck: 'true', lang: 'cs' }),
    placeholder(zastupny),
];

function pouzit() {
    const text = editor.state.doc.toString().replace(/\s+$/, '');
    okno().classList.add('hidden');
    vyreseni?.(text);
    vyreseni = null;
}

/**
 * Otevře okno s textem; vrátí upravený text (Použít), nebo null (Zrušit, Esc).
 * @param {{ nadpis?: string, text?: string, napoveda?: string, zastupny?: string, mluvci?: boolean }} moznosti
 * @returns {Promise<string|null>}
 */
export function upravitText({ nadpis = 'Text', text = '', napoveda = '', zastupny = '', mluvci = false } = {}) {
    if (!editor) vytvoritEditor();
    zvyraznitMluvci = mluvci;
    vyreseni?.(null);
    document.getElementById('textModalTitle').textContent = nadpis;
    document.getElementById('textModalNapoveda').textContent = napoveda;
    editor.setState(EditorState.create({ doc: text, extensions: rozsireni(zastupny), selection: EditorSelection.cursor(text.length) }));
    // Okno je vždy navrchu, i nad oknem, ze kterého se otevřelo
    okno().parentElement.append(okno());
    okno().classList.remove('hidden');
    editor.focus();
    return new Promise(vyresit => { vyreseni = vyresit; });
}

// Obsluha okna; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.getElementById('textUlozitBtn').addEventListener('click', pouzit);
    document.querySelector('#textModal .text-nastroje').addEventListener('click', (e) => {
        const tlacitko = /** @type {HTMLElement} */ (e.target).closest('[data-nastroj]');
        if (tlacitko && editor) NASTROJE[tlacitko.dataset.nastroj](editor);
    });
    // Zavření bez Použít (křížek, Zrušit, Esc) vrátí null
    new MutationObserver(() => {
        if (okno().classList.contains('hidden') && vyreseni) {
            vyreseni(null);
            vyreseni = null;
        }
    }).observe(okno(), { attributes: true, attributeFilter: ['class'] });
}
