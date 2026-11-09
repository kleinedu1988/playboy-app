// Kontext čísla pro profil modelky (app/kontext-cisla.js): sousední čísla a modelky sbírky v čísle
import { rozlozitVydani } from './format.js';

// Sousední čísla téže edice (jen měsíční; speciály a ročníky se přeskočí)
export function sousedniCisla(seznam, vydani) {
    const casti = rozlozitVydani(vydani);
    if (!casti) return { predchozi: '', dalsi: '' };
    const stejne = seznam.map(k => k.vydani)
        .filter(v => { const c = rozlozitVydani(v); return c && c.edice === casti.edice && /^\d{2}$/.test(c.mesic); });
    if (!stejne.includes(vydani)) stejne.push(vydani);
    const klic = v => { const c = rozlozitVydani(v); return `${c.rok}-${c.mesic || '00'}`; };
    const serazene = [...new Set(stejne)].sort((a, b) => klic(a).localeCompare(klic(b)));
    const i = serazene.indexOf(vydani);
    return { predchozi: serazene[i - 1] || '', dalsi: serazene[i + 1] || '' };
}

// Modelky sbírky v čísle s rolí (Playmate, obálka, pictorial)
export function modelkyVCisle(modelky, vydani, krome = 0) {
    const v = [];
    for (const m of modelky) {
        if (m.id === krome) continue;
        const role = [];
        if ((m.vydani || []).includes(vydani)) role.push('centerfold');
        if ((m.obalky || []).includes(vydani)) role.push('obálka');
        if (String(m.pictorialVydani || '').split('\n').map(x => x.trim()).includes(vydani)) role.push('pictorial');
        if (role.length) v.push({ id: m.id, jmeno: m.jmeno, role });
    }
    return v.sort((a, b) => Number(b.role.includes('centerfold')) - Number(a.role.includes('centerfold')) || a.jmeno.localeCompare(b.jmeno, 'cs'));
}
