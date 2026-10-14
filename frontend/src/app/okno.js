// Tlačítko Zpět, zavírání oken a ovládání okna programu
import { Quit, WindowIsFullscreen, WindowIsMaximised, WindowMinimise, WindowToggleMaximise } from '../../wailsjs/runtime/runtime';
import { stav } from './stav';
import { backBtn } from './prvky';
import { zpet } from './navigace';
import { otevritAlbumModal } from './formular-alba';

// Ovládání Modalů
export const modelModal = document.getElementById('modelModal');
export const albumModal = document.getElementById('albumModal');

// Okno přes celou obrazovku má ostré rohy, zakulacení by v rozích ukazovalo plochu
export async function upravitRohyOkna() {
    const cele = await WindowIsMaximised() || await WindowIsFullscreen();
    document.getElementById('app').classList.toggle('cele-okno', cele);
}

// Obsluha událostí; volá ji main.js po načtení všech modulů
export function pripravit() {
    // Tlačítko Zpět
    backBtn.addEventListener('click', zpet);

    // Alt + šipka vlevo jako v prohlížeči
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'ArrowLeft' && !backBtn.classList.contains('hidden')) {
            e.preventDefault();
            zpet();
        }
    });

    document.getElementById('closeModalBtn').onclick = () => modelModal.classList.add('hidden');

    document.getElementById('cancelModelBtn').onclick = () => modelModal.classList.add('hidden');

    document.getElementById('addAlbumBtn').onclick = () => otevritAlbumModal(stav.aktualniModelka);

    document.getElementById('closeAlbumModalBtn').onclick = () => albumModal.classList.add('hidden');

    // Ovládání okna (náhrada za systémovou lištu)
    document.getElementById('winMinBtn').onclick = () => WindowMinimise();

    document.getElementById('winMaxBtn').onclick = () => WindowToggleMaximise();

    document.getElementById('winCloseBtn').onclick = () => Quit();

    window.addEventListener('resize', () => {
        upravitRohyOkna();
        // Stav okna se někdy změní až po události změny velikosti
        setTimeout(upravitRohyOkna, 250);
    });

    upravitRohyOkna();

    document.querySelector('.navbar').addEventListener('dblclick', (e) => {
        if (!e.target.closest('input, button')) WindowToggleMaximise();
    });
}
