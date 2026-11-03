// Rozbalení fronty fotek z backendu (fronta_fotek.go): fotky bez údajů alba a bez adresy obrázku → fotky jako
// z ostatních volání (údaje alba, adresa ze šablony). Pole dalsiModelky je sdílené v rámci alba – neměnit na místě.

const BEZ_DALSICH = Object.freeze([]);

/** @param {{ sablona: string, fotky: any[], alba: Record<string, any> } | null | undefined} fronta */
export function rozbalitFrontu(fronta) {
    if (!fronta?.fotky) return [];
    const alba = fronta.alba || {};
    const sablona = fronta.sablona || '';
    return fronta.fotky.map((f) => {
        const a = alba[f.albumId] || {};
        return {
            id: f.id,
            modelkaId: a.modelkaId || 0,
            jmenoModelky: a.jmenoModelky || '',
            album: a.album || '',
            typ: a.typ || '',
            vydani: a.vydani || '',
            spojit: !!a.spojit,
            popis: a.popis || '',
            fotograf: a.fotograf || '',
            datumAlba: a.datumAlba || '',
            dalsiModelky: a.dalsiModelky || BEZ_DALSICH,
            albumId: f.albumId,
            driveId: f.driveId,
            url: sablona.split('{id}').join(f.driveId),
            rotace: f.rotace || 0,
            hodnoceni: f.hodnoceni || 0,
            poradi: 0,
            pridano: '',
        };
    });
}

/**
 * Položky prohlížeče ze stránky fronty (GetStrankuNehodnocenych): pořadí a seskupení (spojený centerfold je jedna
 * položka) dodává backend; položka má tytéž údaje jako ze sestavitAlba
 * @param {{ sablona: string, fotky: any[], alba: Record<string, any>, polozky: number[][] } | null | undefined} stranka
 */
export function polozkyStranky(stranka) {
    const fotky = rozbalitFrontu(stranka);
    return (stranka?.polozky || []).map((indexy) => {
        const stranky = indexy.map(i => fotky[i]);
        const f = stranky[0];
        return { fotky: stranky, album: f.album, typ: f.typ, modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, rotace: f.rotace, hodnoceni: f.hodnoceni || 0 };
    });
}
