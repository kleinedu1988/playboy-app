// Kontextové nabídky pravého tlačítka
import { contextMenu, otevritKontextovouNabidku, zavritKontextovouNabidku } from '../ui/nabidka';
import { OdebratModelkuZAlba, OdebratZVyberu, SetSpojeniAlba, SetTitulniFotka, ZrusitPoradiAlba } from './backend';
import { nazevVydani } from '../lib/format';
import { oznamit } from '../ui/oznameni';
import { stav } from './stav';
import { calendar, covers, detailView, issueView, searchInput, wall } from './prvky';
import { zpet } from './navigace';
import { nacistGalerii } from './galerie';
import { nacistFotkyModelky, posunoutStranku, prepnoutRozbaleniAlba } from './profil';
import { otevritVydani, upravitVydani } from './vydani';
import { oznacitCislo, pridatKVydani } from './kalendar';
import { oznacitNetykaSe } from './prehled';
import { nacistNejlepsi } from './nejlepsi';
import { otevritCoverModal, otevritProfilPodleId } from './cover';
import { lbPrepnoutLupu, lightbox, otevritLightbox, zavritLightbox } from './prohlizec';
import { selectionBar, zrusitVyber } from './vyber';
import { upravitVyrez } from './vyrez';
import { otevritModelModal, otevritRychlePridani, smazatModelku } from './formular-modelky';
import { otevritAlbumModal, pridatCenterfold, smazatAlbum } from './formular-alba';
import { polozkySpravy, presunoutAlbum, pridatModelkuKAlbu, sloucitAlbum, smazatCover, zkontrolovatSoubory } from './sprava';
import { zavritOkno } from './ulozeni';
import { akceFotky } from './akce-fotky';

// Nabídka akcí pro prvek pod kurzorem; otevírá ji pravé tlačítko i tlačítko ⋯ na dlaždici a v prohlížeči
export function otevritNabidku(cil, x, y) {
    if (stav.zamceno) return;

    // Tlačítko ⋯ v prohlížeči (i klávesa nabídky nad otevřeným prohlížečem): akce s fotkou, která je vidět
    if (cil.closest('#lbMore') || (!lightbox.classList.contains('hidden') && !cil.closest('.modal-overlay'))) {
        const polozka = stav.lbPolozky[stav.lbIndex];
        if (polozka) otevritKontextovouNabidku(x, y, akceFotky(polozka, null, { poOdebrani: zavritLightbox }));
        return;
    }

    // Buňka přehledu: označit údaj „netýká se", nebo označení zrušit
    const bunkaPrehledu = cil.closest('#stats td[data-klic]');
    if (bunkaPrehledu) {
        const oznacena = Boolean(bunkaPrehledu.dataset.netyka);
        otevritKontextovouNabidku(x, y, oznacena
            ? [{ text: 'Znovu sledovat (týká se)', akce: () => oznacitNetykaSe(bunkaPrehledu, false) }]
            : [
                { text: 'Doplnit', akce: () => bunkaPrehledu.click() },
                { text: 'Netýká se – přestat sledovat', akce: () => oznacitNetykaSe(bunkaPrehledu, true) },
            ]);
        return;
    }
    if (cil.closest('.modal-overlay, .lightbox')) {
        zavritKontextovouNabidku();
        return;
    }

    const card = cil.closest('.card');
    let polozky;

    // Fotka v Nejlepších nebo ve vlastním výběru
    const dlazdiceNejlepsich = cil.closest('#best [data-index]');
    if (dlazdiceNejlepsich) {
        const polozka = stav.nejlepsiPolozky[parseInt(dlazdiceNejlepsich.dataset.index)];
        const fotka = polozka.fotky[0];
        otevritKontextovouNabidku(x, y, [
            { text: 'Otevřít fotku', akce: () => otevritLightbox(parseInt(dlazdiceNejlepsich.dataset.index), false, stav.nejlepsiPolozky) },
            ...akceFotky(polozka, fotka),
            ...(stav.nejlepsiVyber ? [{ text: 'Odebrat z tohoto výběru', akce: async () => { await OdebratZVyberu(stav.nejlepsiVyber, [fotka.id]); nacistNejlepsi(searchInput.value); } }] : []),
        ]);
        return;
    }

    if (card) {
        const id = parseInt(card.getAttribute('data-id'));
        const modelka = stav.nacteneModelky.find(item => item.id === id);
        if (!modelka) return;
        polozky = [
            { text: 'Upravit modelku', akce: () => otevritModelModal(modelka) },
            { text: 'Upravit výřez titulní fotky', akce: () => upravitVyrez(modelka) },
            { text: 'Smazat modelku', akce: () => smazatModelku(modelka), nebezpecne: true },
            { text: 'Přidat fotky / album', akce: () => otevritAlbumModal(modelka) },
        ];
    } else if (cil.closest('.wall-item')) {
        // Centerfold na stěně plakátů
        const index = parseInt(cil.closest('.wall-item').dataset.index);
        polozky = [
            { text: 'Otevřít centerfold', akce: () => otevritLightbox(index, false, stav.stenaPolozky) },
            { text: 'Otevřít profil modelky', akce: () => otevritProfilPodleId(stav.stenaPolozky[index].modelkaId) },
            { text: `Otevřít vydání ${nazevVydani(stav.stenaPolozky[index].album)}`, akce: () => otevritVydani(stav.stenaPolozky[index].album) },
            null,
            ...akceFotky(stav.stenaPolozky[index], null, { profil: false, odebrat: false }),
        ];
    } else if (cil.closest('.album')) {
        // Album v profilu modelky, případně konkrétní fotka v něm
        const album = stav.aktualniAlba[parseInt(cil.closest('.album').dataset.album)];
        const centerfold = album.typ === 'Centerfold';
        const prvekPolozky = cil.closest('[data-index]');
        const prvekFotky = cil.closest('[data-foto-id]');

        polozky = [];
        if (prvekPolozky) {
            const index = parseInt(prvekPolozky.dataset.index);
            polozky.push({ text: centerfold ? 'Otevřít centerfold' : 'Otevřít fotku', akce: () => otevritLightbox(index) });

            const fotka = prvekFotky && album.fotky.find(f => f.id === parseInt(prvekFotky.dataset.fotoId));
            if (fotka) {
                polozky.push({
                    text: 'Nastavit jako titulní fotku',
                    akce: async () => {
                        if (!await SetTitulniFotka(stav.aktualniModelka.id, fotka.id)) return;
                        oznamit('Titulní fotka změněna. Výřez na kartě se vrátil na výchozí.');
                        otevritProfilPodleId(stav.aktualniModelka.id);
                    },
                });
                polozky.push(...akceFotky(stav.aktualniPolozky[index], fotka, { profil: false }));
                // Stránky spojeného plakátu se nedají přetáhnout, řadí se po jedné
                if (album.spojit) {
                    const misto = album.fotky.indexOf(fotka);
                    if (misto > 0) polozky.push({ text: 'Posunout stránku dřív', akce: () => posunoutStranku(album, fotka, -1) });
                    if (misto < album.fotky.length - 1) polozky.push({ text: 'Posunout stránku později', akce: () => posunoutStranku(album, fotka, 1) });
                }
            } else {
                // Plakát jako celek (tlačítko ⋯, klávesa nabídky): akce se všemi jeho stránkami
                polozky.push(...akceFotky(stav.aktualniPolozky[index], null, { profil: false }));
            }
            polozky.push(null);
        }
        if (album.vydani) {
            polozky.push({ text: `Otevřít vydání ${nazevVydani(album.vydani)}`, akce: () => otevritVydani(album.vydani) });
        }
        if (centerfold && album.fotky.length > 1) {
            polozky.push({
                text: album.spojit ? 'Rozdělit plakát na samostatné fotky' : 'Spojit stránky do jednoho plakátu',
                akce: async () => {
                    await SetSpojeniAlba(album.modelkaId, album.album, album.typ, !album.spojit);
                    nacistFotkyModelky(stav.aktualniModelka.id);
                },
            });
        }
        if (album.rucniPoradi && !centerfold) {
            polozky.push({
                text: 'Řadit album podle srdíček',
                akce: async () => {
                    await ZrusitPoradiAlba(album.modelkaId, album.album, album.typ);
                    nacistFotkyModelky(stav.aktualniModelka.id);
                },
            });
        }
        const mrizka = cil.closest('.album').querySelector('.photos-grid.zkracena, .photos-grid.rozbalena');
        if (mrizka) {
            const zkracena = mrizka.classList.contains('zkracena');
            polozky.push({ text: zkracena ? 'Rozbalit album' : 'Sbalit album', akce: () => prepnoutRozbaleniAlba(mrizka, zkracena) });
        }
        // Úpravy alba jdou vždy na jeho hlavní modelku, i když je otevřený profil další modelky
        const vlastnik = { id: album.modelkaId, jmeno: '' };
        polozky.push(
            { text: 'Spustit slideshow alba', akce: () => otevritLightbox(stav.aktualniPolozky.indexOf(album.polozky[0]), true) },
            { text: 'Upravit album / přidat fotky', akce: () => otevritAlbumModal(vlastnik, album) },
            null,
            { text: 'Přidat další modelku k albu…', akce: () => pridatModelkuKAlbu(album) },
            ...album.dalsiModelky.map(m => ({ text: `Odebrat z alba: ${m.jmeno}`, akce: async () => {
                await OdebratModelkuZAlba(album.modelkaId, album.album, album.typ, m.id);
                nacistFotkyModelky(stav.aktualniModelka.id);
            } })),
            { text: 'Přesunout k jiné modelce…', akce: () => presunoutAlbum(album) },
            ...(stav.aktualniAlba.some(a => a !== album && a.modelkaId === album.modelkaId)
                ? [{ text: 'Sloučit s jiným albem…', akce: () => sloucitAlbum(album) }] : []),
            { text: 'Smazat album', akce: () => smazatAlbum(album, album.fotky.length), nebezpecne: true },
            null,
            { text: 'Upravit modelku', akce: () => otevritModelModal(stav.aktualniModelka) }
        );
    } else if (!issueView.classList.contains('hidden')) {
        // Stránka vydání: úpravy se dělají v profilu modelky a v přehledu coverů
        const prvekPolozky = cil.closest('[data-index]');
        polozky = [];
        if (prvekPolozky) {
            const index = parseInt(prvekPolozky.dataset.index);
            const polozka = stav.vydaniPolozky[index];
            const prvekFotky = cil.closest('[data-foto-id]');
            const fotka = prvekFotky && polozka.fotky.find(f => f.id === parseInt(prvekFotky.dataset.fotoId));
            polozky.push({ text: 'Otevřít fotku', akce: () => otevritLightbox(index, false, stav.vydaniPolozky) });
            polozky.push(...akceFotky(polozka, fotka || null), null);
        }
        polozky.push(
            { text: 'Spustit slideshow vydání', akce: () => otevritLightbox(0, true, stav.vydaniPolozky) },
            { text: 'Zpět', akce: zpet }
        );
    } else if (!detailView.classList.contains('hidden')) {
        polozky = [
            { text: 'Upravit modelku', akce: () => otevritModelModal(stav.aktualniModelka) },
            { text: 'Přidat fotky / album', akce: () => otevritAlbumModal(stav.aktualniModelka) },
            { text: 'Zpět', akce: zpet },
        ];
    } else if (cil.closest('.cover-item')) {
        // Cover časopisu
        const index = parseInt(cil.closest('.cover-item').dataset.index);
        const cover = stav.coveryPolozky[index];
        polozky = [
            { text: 'Otevřít vydání', akce: () => otevritVydani(cover.album) },
            { text: 'Zobrazit cover', akce: () => otevritLightbox(index, false, stav.coveryPolozky) },
            { text: 'Upravit cover', akce: () => otevritCoverModal(cover) },
            { text: 'Smazat cover', akce: () => smazatCover(cover), nebezpecne: true },
        ];
    } else if (!calendar.classList.contains('hidden')) {
        // Kalendář vydání
        const obsazene = cil.closest('[data-vydani]');
        const prazdne = cil.closest('[data-prazdne]');
        polozky = [];
        if (obsazene) polozky.push({ text: `Otevřít vydání ${nazevVydani(obsazene.dataset.vydani)}`, akce: () => otevritVydani(obsazene.dataset.vydani) });
        if (obsazene || prazdne) {
            const klic = (obsazene || prazdne).dataset.vydani || prazdne.dataset.prazdne;
            polozky.push(...pridatKVydani(klic), null,
                ...oznacitCislo(klic),
                { text: 'Upravit číslo…', akce: () => upravitVydani(klic) },
                null);
        }
        polozky.push(
            { text: 'Přidat cover', akce: () => otevritCoverModal() },
            { text: 'Obnovit', akce: () => nacistGalerii(searchInput.value) }
        );
    } else if (!covers.classList.contains('hidden')) {
        // Volný prostor v přehledu coverů
        polozky = [
            { text: 'Přidat cover', akce: () => otevritCoverModal() },
            { text: 'Obnovit', akce: () => nacistGalerii(searchInput.value) },
            { text: 'Zkontrolovat soubory na Disku', akce: () => zkontrolovatSoubory() },
        ];
    } else if (!wall.classList.contains('hidden')) {
        // Volný prostor na stěně centerfoldů
        polozky = [
            { text: 'Přidat centerfold', akce: pridatCenterfold },
            { text: 'Obnovit', akce: () => nacistGalerii(searchInput.value) },
            { text: 'Zkontrolovat soubory na Disku', akce: () => zkontrolovatSoubory() },
        ];
    } else {
        polozky = [{ text: 'Přidat modelku', akce: otevritRychlePridani }, ...polozkySpravy()];
    }

    otevritKontextovouNabidku(x, y, polozky);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    document.addEventListener('contextmenu', (e) => {
        // V textových polích a v modálních oknech vlastní nabídku nezobrazujeme
        if (e.target.closest('input, textarea, select')) return;
        e.preventDefault();
        otevritNabidku(e.target, e.clientX, e.clientY);
    });

    // Tlačítko ⋯ otevře tutéž nabídku jako pravé tlačítko; zachytí se dřív, než klik otevře fotku
    document.addEventListener('click', (e) => {
        const tlacitko = e.target.closest('.tile-more');
        if (!tlacitko) return;
        e.stopPropagation();
        e.preventDefault();
        const r = tlacitko.getBoundingClientRect();
        otevritNabidku(tlacitko, r.left, r.bottom + 4);
    }, true);

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#contextMenu')) zavritKontextovouNabidku();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        // Esc zavře nabídku, jinak se z profilu vrátí na výběr modelek
        const okno = [...document.querySelectorAll('.modal-overlay:not(.hidden)')].pop();
        if (!contextMenu.classList.contains('hidden')) {
            zavritKontextovouNabidku();
        } else if (okno) {
            zavritOkno(okno);
        } else if (!lightbox.classList.contains('hidden')) {
            // Esc nejdřív vypne lupu, teprve potom zavře prohlížeč; výběr pod ním zůstane
            if (stav.lbLupa) lbPrepnoutLupu(false);
            else zavritLightbox();
        } else if (!selectionBar.classList.contains('hidden')) {
            zrusitVyber();
        } else if (stav.zrusitUpravuVyrezu) {
            stav.zrusitUpravuVyrezu();
        } else if ((!detailView.classList.contains('hidden') || !issueView.classList.contains('hidden')) && !document.querySelector('.modal-overlay:not(.hidden)')) {
            zpet();
        }
    });

    window.addEventListener('blur', zavritKontextovouNabidku);

    window.addEventListener('resize', zavritKontextovouNabidku);
}
