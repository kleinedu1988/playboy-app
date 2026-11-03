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
