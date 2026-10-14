// Čisté funkce nad alby a fotkami: seskupení, řazení a pořadí

// Album je určeno modelkou, názvem a typem
export const klicAlba = a => `${a.modelkaId}\n${a.album}\n${a.typ}`;

// Seskupení fotek do alb a do položek prohlížeče. Spojený centerfold je jedna položka o více stránkách.
export function sestavitAlba(fotky) {
    const mapa = new Map();
    fotky.forEach(f => {
        const klic = `${f.modelkaId}\n${f.album}\n${f.typ}`;
        if (!mapa.has(klic)) {
            mapa.set(klic, { modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, album: f.album, typ: f.typ, vydani: f.vydani, popis: f.popis || '', fotograf: f.fotograf || '', dalsiModelky: f.dalsiModelky || [], fotky: [] });
        }
        mapa.get(klic).fotky.push(f);
    });

    // Centerfoldy patří nahoru, ostatní alba zůstávají v původním pořadí
    const alba = [...mapa.values()].sort((a, b) => Number(b.typ === 'Centerfold') - Number(a.typ === 'Centerfold'));
    alba.forEach(a => {
        a.spojit = a.typ === 'Centerfold' && a.fotky.length > 1 && a.fotky.some(f => f.spojit);
        const skupiny = a.spojit ? [a.fotky] : a.fotky.map(f => [f]);
        a.polozky = skupiny.map(stranky => ({
            fotky: stranky,
            album: a.album,
            typ: a.typ,
            modelkaId: a.modelkaId,
            jmenoModelky: a.jmenoModelky,
            rotace: stranky[0].rotace,
            hodnoceni: stranky[0].hodnoceni || 0,
        }));
        // Lépe hodnocené fotky jdou v albu první, takže právě ony jsou vidět ve zkráceném náhledu;
        // při stejném hodnocení zůstává původní pořadí. Ručně seřazené album se podle srdíček nepřeskupuje.
        a.rucniPoradi = a.fotky.some(f => f.poradi > 0);
        if (!a.rucniPoradi) a.polozky.sort((x, y) => y.hodnoceni - x.hodnoceni);
    });
    return alba;
}

// Indexy prvních položek jednotlivých alb v seznamu položek prohlížeče
export function zacatkyAlb(polozky) {
    return polozky.map((p, i) => i).filter(i => i === 0 || klicAlba(polozky[i]) !== klicAlba(polozky[i - 1]));
}

// Nové pořadí po přetažení: tažená fotka se vloží před cílovou, nebo za ni
export function novePoradi(ids, tazena, cilova, pred) {
    const poradi = ids.filter(id => id !== tazena);
    poradi.splice(poradi.indexOf(cilova) + (pred ? 0 : 1), 0, tazena);
    return poradi;
}
