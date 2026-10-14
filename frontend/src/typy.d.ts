// Kontrola typů (npm run typy) hlídá vlastní kód a volání backendu. Prvky stránky se hledají podle id a
// selektorů z šablony, jejich přesný typ by kontrola neznala, proto se berou volně.
interface Document {
    getElementById(id: string): any;
}
interface ParentNode {
    querySelector(selektor: string): any;
    querySelectorAll(selektor: string): NodeListOf<any>;
}
interface EventTarget {
    closest(selektor: string): any;
    tagName?: string;
    dataset?: DOMStringMap;
}
