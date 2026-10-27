// Rychlé hodnocení (Oblíbenost › Hodnocení): fronta nehodnocených modelek a klávesy. Data posílá backend
// (GetMohloByTeLibit – odhad modelu vkusu s důvodem, GetModelky – odhadHodnoceni); tady jen čisté funkce.

// Fronta nehodnocených: napřed tipy modelu vkusu v jeho pořadí (nejvyšší odhad, s důvodem), pak ostatní podle odhadu
// srdíček, počtu fotek a jména. Vrací [{ id, odhad, duvod }]; modelky bez fotek i titulky až úplně nakonec.
export function frontaHodnoceni(modelky, tipy = []) {
    const nehodnocene = new Map((modelky || []).filter(m => !(Number(m.hodnoceni) > 0)).map(m => [m.id, m]));
    const fronta = [];
    (tipy || []).forEach(t => {
        if (!nehodnocene.has(t.modelkaId)) return;
        fronta.push({ id: t.modelkaId, odhad: Number(t.odhad) || 0, duvod: String(t.duvod || '') });
        nehodnocene.delete(t.modelkaId);
    });
    const bezObrazku = m => !(Number(m.pocetFotek) > 0) && !m.coverUrl;
    const zbytek = [...nehodnocene.values()].sort((a, b) =>
        Number(bezObrazku(a)) - Number(bezObrazku(b))
        || (Number(b.odhadHodnoceni) || 0) - (Number(a.odhadHodnoceni) || 0)
        || (Number(b.pocetFotek) || 0) - (Number(a.pocetFotek) || 0)
        || String(a.jmeno || '').localeCompare(String(b.jmeno || ''), 'cs'));
    zbytek.forEach(m => fronta.push({ id: m.id, odhad: Number(m.odhadHodnoceni) || 0, duvod: '' }));
    return fronta;
}

// Srdíčka z klávesy: 1–5 nad písmeny i na numerické klávesnici (podle polohy klávesy, takže i v české klávesnici bez
// Shiftu); jinak 0
export function srdickaKlavesy(e) {
    const m = /^(?:Digit|Numpad)([1-5])$/.exec(String(e?.code || ''));
    return m ? Number(m[1]) : 0;
}
