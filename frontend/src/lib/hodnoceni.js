// Rychlé hodnocení (Oblíbenost › Hodnocení): úprava fronty z backendu (GetFrontaHodnoceni – nově přidané, nehodnocené
// podle užitku pro pořadí, nesoulad se srdíčky) o přeskočené a skryté návrhy, a klávesy. Jen čisté funkce.
import { klicNavrhu } from './srdicka.js';

// Fronta pro rozhraní: nesoulad s návrhem, který uživatel v Pořadí nechal („Nechat“), vypadne; přeskočené (id v pořadí
// přeskočení) jdou na konec a nesou preskocena = true. Položky jsou kopie (fronta z backendu zůstane).
export function upravitFrontu(polozky, { preskocene = [], skryte = new Set() } = {}) {
    const poradiPreskoku = new Map((preskocene || []).map((id, i) => [id, i]));
    const viditelne = (polozky || []).filter(p => !(p.druh === 'nesedi' && skryte.has(klicNavrhu(p.modelkaId, p.hodnoceni, p.navrh))));
    const napred = viditelne.filter(p => !poradiPreskoku.has(p.modelkaId)).map(p => ({ ...p, preskocena: false }));
    const nakonec = viditelne.filter(p => poradiPreskoku.has(p.modelkaId))
        .sort((a, b) => poradiPreskoku.get(a.modelkaId) - poradiPreskoku.get(b.modelkaId))
        .map(p => ({ ...p, preskocena: true }));
    return [...napred, ...nakonec];
}

// Paměť přeskočených: přidá id na konec (bez opakování), nejvýš posledních 500
export const pridatPreskocenou = (preskocene, id) => [...(preskocene || []).filter(x => x !== id), id].slice(-500);

// Srdíčka z klávesy: 1–5 nad písmeny i na numerické klávesnici (podle polohy klávesy, takže i v české klávesnici bez
// Shiftu); jinak 0
export function srdickaKlavesy(e) {
    const m = /^(?:Digit|Numpad)([1-5])$/.exec(String(e?.code || ''));
    return m ? Number(m[1]) : 0;
}
