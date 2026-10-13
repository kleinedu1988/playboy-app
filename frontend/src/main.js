import './style.css';
import { GetModelky, AddModelka, UpdateModelka, DeleteModelka, DeleteVse, SetCoverVyrez, GetFotografieModelky, GetCenterfoldy, AddBulkPhotos, UpdateAlbum, DeleteAlbum, DeleteFotografie, SetRotaceFotek, SetSpojeniAlba, GetCovery, AddCover, UpdateCover, ZkontrolovatSoubory, GetVydani, SetVydaniAlba, OveritOdkaz, VymazatMezipamet, SlozkaZaloh, StavDatabaze } from '../wailsjs/go/main/App';
import { WindowMinimise, WindowToggleMaximise, Quit, BrowserOpenURL, EventsOn } from '../wailsjs/runtime/runtime';

let aktualniModelka = null;
let nacteneModelky = [];
let editovanaModelka = null;
let potvrzenaAkce = null;
let zrusitUpravuVyrezu = null;
let aktualniAlba = [];
let aktualniPolozky = [];
let stenaPolozky = [];
let rezim = 'modelky'; // přehled na hlavní stránce: 'modelky', 'centerfoldy' nebo 'covery'
let coveryPolozky = [];
let vydaniPolozky = [];
let aktualniVydani = null;
let editovanyCover = null;
let editovaneAlbum = null;

const MESICE = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

// Google Disk bez přípony vrací nejvýše 1600 px; =s0 je originál, =w600 úsporný náhled
const VELIKOST_NAHLEDU = '=w600';
const VELIKOST_PLAKATU = '=w1200';
// Titulní fotka na kartě; rezerva pro přiblížení výřezu
const VELIKOST_TITULNI = '=w800';

// Zástupný obrázek pro modelku bez titulní fotky nebo pro fotku, která se nenačetla
const BEZ_FOTKY = 'data:image/svg+xml,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
        <rect width="300" height="400" fill="#18181c"/>
        <g fill="none" stroke="#3a3a42" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="95" y="150" width="110" height="90" rx="10"/>
            <circle cx="130" cy="182" r="10"/>
            <path d="M102 232l34-30 22 18 18-14 22 26"/>
        </g>
        <text x="150" y="275" fill="#5a5a62" font-family="sans-serif" font-size="16" text-anchor="middle">Bez fotky</text>
    </svg>`);

function adresaTitulni(modelka) {
    return modelka.coverUrl ? modelka.coverUrl + VELIKOST_TITULNI : BEZ_FOTKY;
}

// Fotka, která se nenačte (smazaná na Disku, bez připojení), se nahradí zástupným obrázkem
document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || img.src === BEZ_FOTKY || img.closest('.lightbox')) return;
    img.src = BEZ_FOTKY;
}, true);
const PLNE_ROZLISENI = '=s0';

document.querySelector('#app').innerHTML = `
  <header class="navbar">
    <div class="logo">
      <span class="logo-icon">🔥</span>
      <h2>Playboy Database</h2>
      <div id="viewToggle" class="view-toggle">
        <button data-rezim="modelky" data-kratce="Mod" class="active">Modelky</button>
        <button data-rezim="centerfoldy" data-kratce="Cf">Centerfoldy</button>
        <button data-rezim="covery" data-kratce="Cov">Covery</button>
      </div>
      <button id="backBtn" class="nav-back hidden" title="Zpět (Esc)">&larr; Modelky</button>
    </div>
    <div class="nav-controls">
      <input type="text" id="searchInput" placeholder="Hledat (jméno, košíčky)..." />
    </div>
    <div class="window-controls">
      <button id="winMinBtn" class="win-btn" title="Minimalizovat">&#8211;</button>
      <button id="winMaxBtn" class="win-btn" title="Maximalizovat">&#9633;</button>
      <button id="winCloseBtn" class="win-btn win-close" title="Zavřít">&times;</button>
    </div>
  </header>

  <main>
    <div id="gallery" class="gallery-grid"></div>

    <!-- Stěna centerfoldů -->
    <div id="wall" class="wall hidden"></div>

    <!-- Stránka vydání časopisu: cover, centerfold a pictorialy -->
    <div id="issueView" class="detail-container hidden">
      <aside id="issueSide" class="profile-side"></aside>
      <section id="issueMain" class="profile-main"></section>
    </div>

    <!-- Covery časopisů po ročnících -->
    <div id="covers" class="covers hidden"></div>

    <!-- Detailní profil modelky -->
    <div id="detailView" class="detail-container hidden">
      <aside class="profile-side">
        <!-- Má-li modelka centerfold, nahrazuje titulní fotku -->
        <div id="centerfoldsSide"></div>
        <div id="modelHeader"></div>
      </aside>

      <section class="profile-main">
        <div class="album-actions">
          <h3>Alba a fotogalerie</h3>
          <button id="addAlbumBtn" class="btn btn-secondary btn-small">+ Přidat fotky / album</button>
        </div>
        <div id="photosGrid"></div>
      </section>
    </div>
  </main>

  <!-- Modal 1: Přidat / upravit modelku -->
  <div id="modelModal" class="modal-overlay hidden">
    <div class="modal-card modal-wide">
      <div class="modal-header">
        <h3 id="modelModalTitle">Přidat novou modelku</h3>
        <button id="closeModalBtn" class="close-btn">&times;</button>
      </div>
      <form id="addModelForm">
        <div class="form-body">
          <section class="form-section">
            <h4>Základní údaje</h4>
            <div class="form-grid cols-2">
              <div class="form-group span-2">
                <label for="inputJmeno">Celé jméno</label>
                <input type="text" id="inputJmeno" required />
              </div>
              <div class="form-group">
                <label for="inputNarozeniDatum">Datum narození</label>
                <input type="date" id="inputNarozeniDatum" />
              </div>
              <div class="form-group">
                <label for="inputNarozeniMisto">Místo narození</label>
                <input type="text" id="inputNarozeniMisto" />
              </div>
              <div class="form-group">
                <label for="inputNarodnost">Národnost</label>
                <input type="text" id="inputNarodnost" />
              </div>
              <div class="form-group">
                <label for="inputEtnicita">Etnicita</label>
                <input type="text" id="inputEtnicita" />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h4>Vzhled</h4>
            <div class="form-grid cols-4">
              <div class="form-group">
                <label for="inputVyska">Výška (cm)</label>
                <input type="number" id="inputVyska" min="0" />
              </div>
              <div class="form-group">
                <label for="inputVaha">Váha (kg)</label>
                <input type="number" id="inputVaha" min="0" />
              </div>
              <div class="form-group">
                <label for="inputVlasy">Barva vlasů</label>
                <input type="text" id="inputVlasy" list="seznamVlasy" />
              </div>
              <div class="form-group">
                <label for="inputOci">Barva očí</label>
                <input type="text" id="inputOci" list="seznamOci" />
              </div>
              <div class="form-group span-2">
                <label for="selectOchlupeni">Ochlupení</label>
                <select id="selectOchlupeni">
                  <option value="">Neuvedeno</option>
                  <option>Oholené</option>
                  <option>Zastřižené</option>
                  <option>Přírodní</option>
                </select>
              </div>
              <label class="switch">
                <input type="checkbox" id="inputTetovani" />
                <span class="switch-track"></span>
                <span>Tetování</span>
              </label>
              <label class="switch">
                <input type="checkbox" id="inputPiercing" />
                <span class="switch-track"></span>
                <span>Piercing</span>
              </label>
            </div>
          </section>

          <section class="form-section">
            <h4>Míry</h4>
            <div class="form-grid cols-3">
              <div class="form-group">
                <label for="inputHrudnik">Hrudník (cm)</label>
                <input type="number" id="inputHrudnik" min="0" />
              </div>
              <div class="form-group">
                <label for="inputPas">Pas (cm)</label>
                <input type="number" id="inputPas" min="0" />
              </div>
              <div class="form-group">
                <label for="inputBoky">Boky (cm)</label>
                <input type="number" id="inputBoky" min="0" />
              </div>
              <div class="form-group">
                <label for="inputVelikost">Velikost prsou (např. 34B)</label>
                <input type="text" id="inputVelikost" />
              </div>
              <div class="form-group">
                <label for="selectPrsaTyp">Typ prsou</label>
                <select id="selectPrsaTyp">
                  <option value="">Neuvedeno</option>
                  <option>Přírodní</option>
                  <option>Silikonová</option>
                </select>
              </div>
            </div>
          </section>

          <section class="form-section">
            <h4>Playboy</h4>
            <div class="form-grid cols-2">
              <div class="form-group">
                <label for="inputVystoupeni">První vydání</label>
                <input type="text" id="inputVystoupeni" placeholder="RRRR-MM" />
              </div>
              <div class="form-group">
                <label for="inputRole">Role</label>
                <input type="text" id="inputRole" />
              </div>
              <div class="form-group span-2">
                <label for="inputPictorial">Pictorial vydání (jedno na řádek)</label>
                <textarea id="inputPictorial" rows="3"></textarea>
              </div>
              <div class="form-group span-2">
                <label for="inputTags">Tagy (oddělené čárkou)</label>
                <input type="text" id="inputTags" />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h4>Titulní fotka</h4>
            <div class="form-group">
              <label for="inputDriveID">Google Drive ID nebo odkaz</label>
              <input type="text" id="inputDriveID" required />
            </div>
          </section>

          <datalist id="seznamVlasy">
            <option>Blond</option><option>Hnědá</option><option>Černá</option><option>Zrzavá</option>
          </datalist>
          <datalist id="seznamOci">
            <option>Modrá</option><option>Hnědá</option><option>Zelená</option><option>Šedá</option>
          </datalist>
        </div>
        <div class="modal-actions">
          <button type="button" id="cancelModelBtn" class="btn btn-secondary">Zrušit</button>
          <button type="submit" class="btn btn-primary">Uložit modelku</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal 2: Hromadné nahrání fotek do alba -->
  <div id="albumModal" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="albumModalTitle">Přidat fotky do alba</h3>
        <button id="closeAlbumModalBtn" class="close-btn">&times;</button>
      </div>
      <form id="addAlbumForm">
        <div id="albumModelkaGroup" class="form-group hidden">
          <label for="selectAlbumModelka">Modelka</label>
          <select id="selectAlbumModelka"></select>
        </div>
        <div id="albumTypGroup" class="form-group">
          <label for="selectTyp">Typ obsahu</label>
          <select id="selectTyp">
            <option value="Pictorial">Pictorial (Fotostory)</option>
            <option value="Centerfold">Centerfold (Plakát)</option>
          </select>
        </div>
        <div id="albumNazevGroup" class="form-group">
          <label for="inputAlbumName">Název alba</label>
          <input type="text" id="inputAlbumName" placeholder="např. Pictorial 1995-04" required />
        </div>
        <!-- Centerfold nemá název, určuje ho vydání časopisu; pictorial může k vydání patřit volitelně -->
        <div id="albumVydaniGroup" class="form-row hidden">
          <div class="form-group">
            <label id="albumMesicLabel" for="selectAlbumMesic">Měsíc vydání</label>
            <select id="selectAlbumMesic">
              <option value="">Vyber měsíc</option>
              ${MESICE.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label id="albumRokLabel" for="inputAlbumRok">Rok vydání</label>
            <input type="number" id="inputAlbumRok" min="1953" max="2100" placeholder="RRRR" />
          </div>
        </div>
        <div class="form-group">
          <label id="bulkLinksLabel">Vložte odkazy z Google Disku (libovolné množství)</label>
          <textarea id="inputBulkLinks" rows="6" placeholder="Vložte zkopírované odkazy z Disku (můžete vložit více odkazů naráz)..." required></textarea>
        </div>
        <div class="modal-actions">
          <button type="submit" id="albumSubmitBtn" class="btn btn-primary">Uložit fotky</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Přidat / upravit cover časopisu -->
  <div id="coverModal" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="coverModalTitle">Přidat cover</h3>
        <button id="closeCoverModalBtn" class="close-btn">&times;</button>
      </div>
      <form id="coverForm">
        <div class="form-row">
          <div class="form-group">
            <label for="selectCoverMesic">Měsíc vydání</label>
            <select id="selectCoverMesic" required>
              <option value="">Vyber měsíc</option>
              ${MESICE.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="inputCoverRok">Rok vydání</label>
            <input type="number" id="inputCoverRok" min="1953" max="2100" placeholder="RRRR" required />
          </div>
        </div>
        <div class="form-group">
          <label id="coverLinkLabel" for="inputCoverLink">Odkaz na cover z Google Disku</label>
          <input type="text" id="inputCoverLink" />
        </div>
        <div class="modal-actions">
          <button type="submit" class="btn btn-primary">Uložit cover</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Kontrola souborů na Google Disku -->
  <div id="checkModal" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3>Kontrola souborů na Google Disku</h3>
        <button id="closeCheckModalBtn" class="close-btn">&times;</button>
      </div>
      <p id="checkModalText"></p>
      <ul id="checkModalList" class="check-list"></ul>
      <div class="modal-actions">
        <button id="checkCloseBtn" class="btn btn-secondary">Zavřít</button>
        <button id="checkRemoveBtn" class="btn btn-primary hidden">Odebrat nedostupné z databáze</button>
      </div>
    </div>
  </div>

  <!-- Modal 3: Potvrzení smazání modelky -->
  <div id="deleteModal" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="deleteModalTitle">Smazat modelku</h3>
        <button id="closeDeleteModalBtn" class="close-btn">&times;</button>
      </div>
      <p id="deleteModalText"></p>
      <div class="modal-actions">
        <button id="cancelDeleteBtn" class="btn btn-secondary">Zrušit</button>
        <button id="confirmDeleteBtn" class="btn btn-primary">Smazat</button>
      </div>
    </div>
  </div>

  <!-- Prohlížeč fotek / slideshow -->
  <div id="lightbox" class="lightbox hidden">
    <div id="lbStage"></div>
    <div class="lightbox-top">
      <span id="lbCaption" class="lb-caption"></span>
      <span id="lbCounter" class="lb-counter"></span>
      <button id="lbFill" class="lb-btn" title="Rozložit přes celé okno (F)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
      </button>
      <button id="lbRot" class="lb-btn" title="Otočit o 90° (R)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/></svg>
      </button>
      <button id="lbZoom" class="lb-btn" disabled>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>
      </button>
      <button id="lbPlay" class="lb-btn" title="Slideshow (mezerník)">&#9654;</button>
      <button id="lbClose" class="lb-btn" title="Zavřít (Esc)">&times;</button>
    </div>
    <button id="lbPrev" class="lb-nav lb-prev" title="Předchozí (šipka vlevo)">&#8249;</button>
    <button id="lbNext" class="lb-nav lb-next" title="Další (šipka vpravo)">&#8250;</button>
    <div id="lbProgress" class="lb-progress"></div>
  </div>

  <!-- Oznámení o výsledku akce -->
  <div id="toast" class="toast hidden">
    <span id="toastText"></span>
    <button id="toastAction" class="btn btn-primary btn-small hidden"></button>
    <button id="toastClose" class="close-btn" title="Zavřít">&times;</button>
  </div>

  <!-- Kontextová nabídka (pravé tlačítko) -->
  <div id="contextMenu" class="context-menu hidden"></div>
`;

// Elementy
const gallery = document.getElementById('gallery');
const detailView = document.getElementById('detailView');
const searchInput = document.getElementById('searchInput');
const backBtn = document.getElementById('backBtn');
const wall = document.getElementById('wall');
const covers = document.getElementById('covers');
const issueView = document.getElementById('issueView');

// Vždy je vidět jeden pohled; profil modelky a stránka vydání mají v liště tlačítko zpět místo přepínače
function ukazatPohled(pohled) {
    [gallery, wall, covers, detailView, issueView].forEach(p => p.classList.toggle('hidden', p !== pohled));
    const podstranka = pohled === detailView || pohled === issueView;
    backBtn.classList.toggle('hidden', !podstranka);
    viewToggle.classList.toggle('hidden', podstranka);
    backBtn.innerHTML = `&larr; ${{ modelky: 'Modelky', centerfoldy: 'Centerfoldy', covery: 'Covery' }[rezim]}`;
}
const viewToggle = document.getElementById('viewToggle');

// Album centerfoldu a coveru je uložené jako vydání časopisu RRRR-MM; zobrazuje se jako „Listopad 2009"
function nazevAlba(album, typ) {
    const vydani = (typ === 'Centerfold' || typ === 'Cover') && /^(\d{4})-(\d{2})$/.exec(album);
    return vydani && MESICE[parseInt(vydani[2]) - 1] ? `${MESICE[parseInt(vydani[2]) - 1]} ${vydani[1]}` : album;
}

// Krátké oznámení dole v okně; s akcí zůstane, dokud ho uživatel nezavře
let toastCasovac = null;
function oznamit(text, akce = null) {
    const toast = document.getElementById('toast');
    const tlacitko = document.getElementById('toastAction');
    document.getElementById('toastText').textContent = text;
    tlacitko.classList.toggle('hidden', !akce);
    if (akce) {
        tlacitko.textContent = akce.text;
        tlacitko.onclick = () => {
            toast.classList.add('hidden');
            akce.akce();
        };
    }
    toast.classList.remove('hidden');
    clearTimeout(toastCasovac);
    if (!akce) toastCasovac = setTimeout(() => toast.classList.add('hidden'), 7000);
}
document.getElementById('toastClose').onclick = () => document.getElementById('toast').classList.add('hidden');

// Shrnutí vložení odkazů: co se uložilo a co bylo odmítnuto
function oznamitVlozeni(v, co) {
    const casti = [`Přidáno ${co}: ${v.vlozeno}.`];
    if (v.nedostupne) casti.push(`Nefunkčních odkazů (smazané nebo nesdílené soubory): ${v.nedostupne} – neuloženy.`);
    if (v.duplicitni) casti.push(`Už uložených: ${v.duplicitni} – přeskočeny.`);
    if (v.neovereno) casti.push(`Bez ověření kvůli připojení: ${v.neovereno}.`);
    if (v.vlozeno === 0 && !v.nedostupne && !v.duplicitni) casti[0] = 'Ve vloženém textu nebyl žádný odkaz na Google Disk.';
    oznamit(casti.join(' '));
}

// Odkaz, který Disk nevrací jako obrázek, se neuloží
async function odkazJeVPoradku(odkaz) {
    if (!odkaz.trim()) return true;
    if (await OveritOdkaz(odkaz) !== 0) return true;
    oznamit('Tento odkaz nefunguje – soubor na Google Disku je smazaný, není sdílený „kdokoli s odkazem", nebo to není obrázek.');
    return false;
}

function nazevVydani(vydani) {
    return nazevAlba(vydani, 'Cover');
}

// Ošetření textu vkládaného do HTML
function esc(text) {
    return String(text ?? '').replace(/[&<>"']/g, z => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]));
}

// RRRR-MM-DD -> D. M. RRRR
function formatDatum(datum) {
    const casti = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum || '');
    return casti ? `${parseInt(casti[3])}. ${parseInt(casti[2])}. ${casti[1]}` : (datum || '');
}

// Výřez titulní fotky: poloha v procentech a přiblížení kolem téhož bodu
function stylVyrezu({ coverZoom, coverX, coverY }) {
    return `object-position: ${coverX}% ${coverY}%; transform-origin: ${coverX}% ${coverY}%; transform: scale(${coverZoom});`;
}

// Načtení Hlavní Galerie
async function nacistGalerii(dotaz = '') {
    if (rezim === 'centerfoldy') return nacistStenu(dotaz);
    if (rezim === 'covery') return nacistCovery(dotaz);

    const modelky = await GetModelky(dotaz);
    nacteneModelky = modelky || [];
    zrusitUpravuVyrezu = null;
    ukazatPohled(gallery);

    if (!modelky || modelky.length === 0) {
        gallery.innerHTML = '<div class="empty-state">Žádné modelky v DB.</div>';
        return;
    }

    gallery.innerHTML = modelky.map(m => `
        <div class="card" data-id="${m.id}">
            <div class="card-image-wrap">
                <img src="${esc(adresaTitulni(m))}" alt="${esc(m.jmeno)}" style="${stylVyrezu(m)}" draggable="false" loading="lazy" />
            </div>
            <div class="card-info">
                <h3>${esc(m.jmeno)}</h3>
            </div>
        </div>
    `).join('');

    // Přidání kliku na kartu -> Otevření profilu modelky
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.classList.contains('editing')) return;
            const id = parseInt(card.getAttribute('data-id'));
            const modelka = modelky.find(item => item.id === id);
            otevritDetailModelky(modelka);
        });
    });
}

// Otevření profilu modelky s fotogalerií
async function otevritDetailModelky(modelka) {
    aktualniModelka = modelka;
    ukazatPohled(detailView);
    // Dokud nejsou načtené fotky, není jasné, zda se ukáže titulní fotka, nebo centerfold
    document.getElementById('centerfoldsSide').innerHTML = '';
    detailView.classList.add('bez-titulni');
    document.querySelector('main').scrollTop = 0;

    const udaje = [
        ['Narození', [formatDatum(modelka.narozeniDatum), modelka.narozeniMisto].filter(Boolean).join(', ')],
        ['Národnost', modelka.narodnost],
        ['Etnicita', modelka.etnicita],
        ['Výška', modelka.vyskaCm ? `${modelka.vyskaCm} cm` : ''],
        ['Váha', modelka.vahaKg ? `${modelka.vahaKg} kg` : ''],
        ['Vlasy', modelka.vlasyBarva],
        ['Oči', modelka.ociBarva],
        ['Míry', modelka.miry],
        ['Prsa', [modelka.velikostPrsou, modelka.prsaTyp].filter(Boolean).join(', ')],
        ['Ochlupení', modelka.ochlupeni],
        ['Tetování', modelka.tetovani ? 'Ano' : 'Ne'],
        ['Piercing', modelka.piercing ? 'Ano' : 'Ne'],
        ['První vydání', modelka.vystoupeni],
        ['Pictorial vydání', modelka.pictorialVydani.split('\n').map(v => v.trim()).filter(Boolean).join(', ')],
        ['Role', modelka.role],
    ].filter(([, hodnota]) => hodnota);

    const tagy = modelka.tags.split(',').map(t => t.trim()).filter(Boolean);

    document.getElementById('modelHeader').innerHTML = `
        <div class="profile-cover"><img src="${esc(adresaTitulni(modelka))}" alt="${esc(modelka.jmeno)}" style="${stylVyrezu(modelka)}" draggable="false" /></div>
        <h2>${esc(modelka.jmeno)}</h2>
        <div class="profile-tags">${tagy.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <dl class="profile-info">
            ${udaje.map(([nazev, hodnota]) => `<div><dt>${nazev}</dt><dd>${esc(hodnota)}</dd></div>`).join('')}
        </dl>
    `;

    nacistFotkyModelky(modelka.id);
}

// Seskupení fotek do alb a do položek prohlížeče. Spojený centerfold je jedna položka o více stránkách.
function sestavitAlba(fotky) {
    const mapa = new Map();
    fotky.forEach(f => {
        const klic = `${f.modelkaId}\n${f.album}\n${f.typ}`;
        if (!mapa.has(klic)) {
            mapa.set(klic, { modelkaId: f.modelkaId, jmenoModelky: f.jmenoModelky, album: f.album, typ: f.typ, vydani: f.vydani, fotky: [] });
        }
        mapa.get(klic).fotky.push(f);
    });

    // Centerfoldy patří nahoru, ostatní alba zůstávají v původním pořadí
    const alba = [...mapa.values()].sort((a, b) => (b.typ === 'Centerfold') - (a.typ === 'Centerfold'));
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
        }));
    });
    return alba;
}

// Plakát: jedna nebo více stránek spojených bez mezer, volitelně otočený
function htmlPlakatu(polozka, velikost, atributy = '') {
    return `
        <div class="poster" data-rot="${polozka.rotace}" ${atributy}>
            <div class="poster-inner">
                ${polozka.fotky.map(f => `<img src="${esc(f.url)}${velikost}" data-foto-id="${f.id}" draggable="false" />`).join('')}
            </div>
        </div>
    `;
}

// Po načtení stránek nastaví plakátu poměr stran a rozložení stránek
function pripravitPlakat(plakat, poZmene = () => {}) {
    const vnitrek = plakat.querySelector('.poster-inner');
    const obrazky = [...vnitrek.querySelectorAll('img')];

    const prepocitat = () => {
        if (obrazky.some(o => !o.naturalWidth)) return;
        const pomery = obrazky.map(o => o.naturalWidth / o.naturalHeight);
        // Stránky na výšku se řadí vedle sebe, stránky na šířku pod sebe
        const sloupec = obrazky.length > 1 && pomery[0] > 1;
        vnitrek.classList.toggle('column', sloupec);
        // Podíl stránky na délce plakátu; násobek drží součet nad 1, jinak by flex nevyplnil celý plakát
        obrazky.forEach((o, i) => { o.style.flex = `${(sloupec ? 1 / pomery[i] : pomery[i]) * 100} 1 0px`; });

        // Rozměr celého plakátu v pixelech zdrojových obrázků (před otočením)
        const W = sloupec ? Math.max(...obrazky.map(o => o.naturalWidth)) : null;
        const H = sloupec ? null : Math.max(...obrazky.map(o => o.naturalHeight));
        plakat._rozmer = sloupec
            ? { W, H: W * pomery.reduce((s, p) => s + 1 / p, 0) }
            : { W: H * pomery.reduce((s, p) => s + p, 0), H };

        const pomer = plakat._rozmer.W / plakat._rozmer.H;
        plakat.style.setProperty('--ar', parseInt(plakat.dataset.rot) % 180 ? 1 / pomer : pomer);
        poZmene();
    };

    obrazky.forEach(o => o.addEventListener('load', prepocitat));
    prepocitat();
}

// Načtení fotografií v detailu
async function nacistFotkyModelky(modelkaId) {
    const fotky = await GetFotografieModelky(modelkaId);
    const photosGrid = document.getElementById('photosGrid');

    const centerfoldsSide = document.getElementById('centerfoldsSide');
    const prazdno = '<p class="empty-state">Tato modelka zatím nemá nahraná žádná alba. Přidej je pravým tlačítkem myši.</p>';

    aktualniAlba = sestavitAlba(fotky || []);
    // Pořadí pro prohlížeč: nejdřív centerfoldy z levého sloupce, potom alba
    aktualniPolozky = aktualniAlba.flatMap(a => a.polozky);

    const sklonovat = (n, jedna, dve, pet) => `${n} ${n === 1 ? jedna : n < 5 ? dve : pet}`;

    const htmlAlba = (a) => {
        const centerfold = a.typ === 'Centerfold';
        const popis = sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek');

        return `
            <section class="album" data-album="${aktualniAlba.indexOf(a)}">
                ${centerfold ? '' : `
                    <div class="album-header">
                        <h4>${esc(nazevAlba(a.album, a.typ))}</h4>
                        <span>${esc(a.typ)} · ${popis}</span>
                        ${a.vydani ? `<button class="chip" data-vydani="${esc(a.vydani)}" title="Otevřít vydání">${esc(nazevVydani(a.vydani))}</button>` : ''}
                    </div>
                `}
                <div class="${centerfold ? 'posters' : 'photos-grid'}">
                    ${a.polozky.map(p => {
                        const index = aktualniPolozky.indexOf(p);
                        // Centerfold se zobrazuje celý jako plakát, ostatní fotky jako oříznuté dlaždice
                        return centerfold
                            ? htmlPlakatu(p, VELIKOST_PLAKATU, `data-index="${index}"`)
                            : `<div class="photo-item" data-index="${index}" data-foto-id="${p.fotky[0].id}">
                                   <img src="${esc(p.fotky[0].url)}${VELIKOST_NAHLEDU}" loading="lazy" draggable="false" />
                               </div>`;
                    }).join('')}
                </div>
            </section>
        `;
    };

    const centerfoldy = aktualniAlba.filter(a => a.typ === 'Centerfold');
    const ostatni = aktualniAlba.filter(a => a.typ !== 'Centerfold');
    centerfoldsSide.innerHTML = centerfoldy.map(htmlAlba).join('');
    detailView.classList.toggle('bez-titulni', centerfoldy.length > 0);
    photosGrid.innerHTML = ostatni.map(htmlAlba).join('') || prazdno;

    detailView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
}

// Stěna centerfoldů napříč všemi modelkami
async function nacistStenu(dotaz = '') {
    const fotky = await GetCenterfoldy() || [];
    zrusitUpravuVyrezu = null;
    ukazatPohled(wall);

    const hledat = dotaz.trim().toLowerCase();
    const vyhovuje = f => !hledat || [f.jmenoModelky, f.album, nazevAlba(f.album, f.typ)].some(t => t.toLowerCase().includes(hledat));
    stenaPolozky = sestavitAlba(fotky.filter(vyhovuje)).flatMap(a => a.polozky);

    if (stenaPolozky.length === 0) {
        wall.innerHTML = `<div class="empty-state">${fotky.length ? 'Hledání neodpovídá žádný centerfold.' : 'Zatím žádné centerfoldy. Přidej je pravým tlačítkem myši.'}</div>`;
        return;
    }

    wall.innerHTML = stenaPolozky.map((p, i) => `
        <figure class="wall-item" data-index="${i}">
            ${htmlPlakatu(p, VELIKOST_NAHLEDU)}
            <figcaption>
                <strong>${esc(p.jmenoModelky)}</strong>
                <span>${esc(nazevAlba(p.album, p.typ))}</span>
            </figcaption>
        </figure>
    `).join('');
    wall.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
}

// Covery časopisů seřazené od nejnovějšího vydání, po ročnících
async function nacistCovery(dotaz = '') {
    const [fotky, centerfoldy] = await Promise.all([GetCovery(), GetCenterfoldy()]);
    zrusitUpravuVyrezu = null;
    ukazatPohled(covers);

    // Modelka z centerfoldu téhož vydání, pokud už je v databázi
    const playmate = new Map((centerfoldy || []).map(f => [f.album, f.jmenoModelky]));

    const hledat = dotaz.trim().toLowerCase();
    const vyhovuje = f => !hledat || [f.album, nazevAlba(f.album, f.typ), playmate.get(f.album) || ''].some(t => t.toLowerCase().includes(hledat));
    coveryPolozky = sestavitAlba((fotky || []).filter(vyhovuje)).flatMap(a => a.polozky);

    if (coveryPolozky.length === 0) {
        covers.innerHTML = `<div class="empty-state">${fotky?.length ? 'Hledání neodpovídá žádný cover.' : 'Zatím žádné covery. Přidej je pravým tlačítkem myši.'}</div>`;
        return;
    }

    const rocniky = new Map();
    coveryPolozky.forEach((p, i) => {
        const rok = /^\d{4}/.exec(p.album)?.[0] || 'Ostatní';
        if (!rocniky.has(rok)) rocniky.set(rok, []);
        rocniky.get(rok).push(i);
    });

    covers.innerHTML = [...rocniky].map(([rok, indexy]) => `
        <section class="cover-year">
            <h3>${esc(rok)}</h3>
            <div class="covers-grid">
                ${indexy.map(i => {
                    const p = coveryPolozky[i];
                    return `
                        <figure class="cover-item" data-index="${i}">
                            ${htmlPlakatu(p, VELIKOST_NAHLEDU)}
                            <figcaption>
                                <strong>${esc(nazevAlba(p.album, p.typ))}</strong>
                                ${playmate.has(p.album) ? `<span>Centerfold: ${esc(playmate.get(p.album))}</span>` : ''}
                            </figcaption>
                        </figure>
                    `;
                }).join('')}
            </div>
        </section>
    `).join('');
    covers.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
}

covers.addEventListener('click', (e) => {
    const polozka = e.target.closest('.cover-item');
    if (polozka) otevritVydani(coveryPolozky[parseInt(polozka.dataset.index)].album);
});

// Stránka vydání: vlevo cover, vpravo centerfold a pictorialy všech modelek z tohoto čísla
async function otevritVydani(vydani) {
    const fotky = await GetVydani(vydani) || [];
    aktualniVydani = vydani;
    ukazatPohled(issueView);
    document.querySelector('main').scrollTop = 0;

    const alba = sestavitAlba(fotky);
    const coveryVydani = alba.filter(a => a.typ === 'Cover');
    const centerfoldy = alba.filter(a => a.typ === 'Centerfold');
    const ostatni = alba.filter(a => a.typ !== 'Cover' && a.typ !== 'Centerfold');
    // Pořadí pro prohlížeč: cover, centerfold, pictorialy
    vydaniPolozky = [...coveryVydani, ...centerfoldy, ...ostatni].flatMap(a => a.polozky);
    const index = p => vydaniPolozky.indexOf(p);
    const odkazNaModelku = a => `<button class="chip" data-modelka="${a.modelkaId}" title="Otevřít profil modelky">${esc(a.jmenoModelky)}</button>`;
    const sklonovat = (n, jedna, dve, pet) => `${n} ${n === 1 ? jedna : n < 5 ? dve : pet}`;

    document.getElementById('issueSide').innerHTML = `
        <div class="posters">
            ${coveryVydani.flatMap(a => a.polozky).map(p => htmlPlakatu(p, VELIKOST_PLAKATU, `data-index="${index(p)}"`)).join('')
                || `<div class="profile-cover"><img src="${BEZ_FOTKY}" alt="Bez coveru" draggable="false" /></div>`}
        </div>
        <h2>${esc(nazevVydani(vydani))}</h2>
        <dl class="profile-info">
            <div><dt>Cover</dt><dd>${coveryVydani.length ? 'Ano' : 'Zatím chybí'}</dd></div>
            <div><dt>Centerfold</dt><dd>${centerfoldy.map(a => esc(a.jmenoModelky)).join(', ') || 'Zatím chybí'}</dd></div>
            <div><dt>Pictorialy</dt><dd>${ostatni.length}</dd></div>
            <div><dt>Fotek celkem</dt><dd>${fotky.length}</dd></div>
        </dl>
    `;

    document.getElementById('issueMain').innerHTML = [
        ...centerfoldy.map(a => `
            <section class="issue-album">
                <div class="album-header">
                    <h4>Centerfold</h4>
                    ${odkazNaModelku(a)}
                </div>
                <div class="posters">${a.polozky.map(p => htmlPlakatu(p, VELIKOST_PLAKATU, `data-index="${index(p)}"`)).join('')}</div>
            </section>
        `),
        ...ostatni.map(a => `
            <section class="issue-album">
                <div class="album-header">
                    <h4>${esc(a.album)}</h4>
                    <span>${esc(a.typ)} · ${sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek')}</span>
                    ${odkazNaModelku(a)}
                </div>
                <div class="photos-grid">
                    ${a.polozky.map(p => `
                        <div class="photo-item" data-index="${index(p)}">
                            <img src="${esc(p.fotky[0].url)}${VELIKOST_NAHLEDU}" loading="lazy" draggable="false" />
                        </div>
                    `).join('')}
                </div>
            </section>
        `),
    ].join('') || '<p class="empty-state">K tomuto vydání zatím není přiřazený žádný centerfold ani pictorial. Centerfold se přiřadí měsícem a rokem, pictorial v úpravě alba.</p>';

    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
}

issueView.addEventListener('click', (e) => {
    if (e.target.closest('[data-modelka], [data-vydani]')) return;
    const polozka = e.target.closest('[data-index]');
    if (polozka) otevritLightbox(parseInt(polozka.dataset.index), false, vydaniPolozky);
});

// Formulář coveru slouží pro přidání (polozka = null) i úpravu vydání
const coverModal = document.getElementById('coverModal');

function otevritCoverModal(polozka = null) {
    editovanyCover = polozka;
    document.getElementById('coverForm').reset();
    document.getElementById('coverModalTitle').textContent = polozka ? 'Upravit cover' : 'Přidat cover';
    document.getElementById('coverLinkLabel').textContent = polozka
        ? 'Nový odkaz z Google Disku (nepovinné, jinak zůstane původní obrázek)'
        : 'Odkaz na cover z Google Disku';
    document.getElementById('inputCoverLink').required = !polozka;

    const vydani = polozka && /^(\d{4})-(\d{2})$/.exec(polozka.album);
    if (vydani) {
        document.getElementById('inputCoverRok').value = vydani[1];
        document.getElementById('selectCoverMesic').value = vydani[2];
    }
    coverModal.classList.remove('hidden');
    document.getElementById('selectCoverMesic').focus();
}

document.getElementById('closeCoverModalBtn').onclick = () => coverModal.classList.add('hidden');
document.getElementById('coverForm').onsubmit = async (e) => {
    e.preventDefault();
    const vydani = `${document.getElementById('inputCoverRok').value}-${document.getElementById('selectCoverMesic').value}`;
    const odkaz = document.getElementById('inputCoverLink').value;

    if (editovanyCover) {
        if (!await odkazJeVPoradku(odkaz)) return;
        if (!await UpdateCover(editovanyCover.fotky[0].id, vydani, odkaz)) {
            oznamit('Cover se nepodařilo uložit do databáze.');
            return;
        }
    } else {
        oznamitVlozeni(await AddCover(vydani, odkaz), 'coverů');
    }
    coverModal.classList.add('hidden');
    nacistCovery(searchInput.value);
};

async function otevritProfilPodleId(modelkaId) {
    const modelka = (await GetModelky('') || []).find(m => m.id === modelkaId);
    if (modelka) otevritDetailModelky(modelka);
}

wall.addEventListener('click', (e) => {
    const polozka = e.target.closest('.wall-item');
    if (polozka) otevritLightbox(parseInt(polozka.dataset.index), false, stenaPolozky);
});

viewToggle.addEventListener('click', (e) => {
    const tlacitko = e.target.closest('[data-rezim]');
    if (!tlacitko) return;
    rezim = tlacitko.dataset.rezim;
    viewToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === tlacitko));
    document.querySelector('main').scrollTop = 0;
    nacistGalerii(searchInput.value);
});

// Prohlížeč fotek: šipky listují, mezerník spouští slideshow, F rozkládá plakát, R otáčí, Esc zavírá
const lightbox = document.getElementById('lightbox');
const lbStage = document.getElementById('lbStage');
const lbProgress = document.getElementById('lbProgress');
const lbZoomBtn = document.getElementById('lbZoom');
const lbFillBtn = document.getElementById('lbFill');
const SLIDESHOW_INTERVAL = 4000;
const LB_LISTA = 44; // výška horní lišty prohlížeče
let lbPolozky = [];
let lbIndex = 0;
let lbCasovac = null;
let lbPlakat = null;     // prvek .poster právě zobrazené položky
let lbPlne = false;      // všechny stránky jsou načtené v plném rozlišení
let lbRozlozeno = false; // plakát vyplní celé okno a posouvá se po délce
let lbPosun = 0;         // poloha rozloženého plakátu po délce (0–1)
let lbZobrazeno = { sirka: 0, presah: 0, osa: 'y' };
let lbLupa = null;       // obdélník plakátu v okamžiku zapnutí lupy
let lbTazeni = null;
let lbZmeneno = false;   // po zavření je potřeba překreslit přehled (změna otočení)

const lbOmezit = (hodnota, min, max) => Math.min(max, Math.max(min, hodnota));

// Rozměr plakátu ve zdrojových pixelech po otočení
function lbRozmer() {
    const r = lbPlakat?._rozmer;
    if (!r) return null;
    return lbPolozky[lbIndex].rotace % 180 ? { W: r.H, H: r.W } : r;
}

// Umístění plakátu: buď se vejde celý, nebo (rozložený) vyplní okno a přesahuje po délce
function lbRozvrhnout() {
    const r = lbRozmer();
    if (!r) return;
    const sw = lightbox.clientWidth;
    const sh = lightbox.clientHeight;
    const okrajX = sw > 560 ? 70 : 0;
    const meritko = lbRozlozeno
        ? Math.max(sw / r.W, sh / r.H)
        : Math.min((sw - 2 * okrajX) / r.W, (sh - LB_LISTA - 16) / r.H);

    const w = r.W * meritko;
    const h = r.H * meritko;
    const presahX = Math.max(0, w - sw);
    const presahY = Math.max(0, h - sh);
    const left = presahX > 1 ? -lbPosun * presahX : (sw - w) / 2;
    const top = lbRozlozeno
        ? (presahY > 1 ? -lbPosun * presahY : (sh - h) / 2)
        : LB_LISTA + (sh - LB_LISTA - 16 - h) / 2;

    Object.assign(lbPlakat.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    lbZobrazeno = { sirka: w, presah: Math.max(presahX, presahY), osa: presahX > presahY ? 'x' : 'y' };
    lbAktualizovatTlacitka();
}

// Kolikrát jde plakát zvětšit, než se zobrazí ve skutečném rozlišení
function lbMeritkoLupy() {
    const r = lbRozmer();
    return lbPlne && r && lbZobrazeno.sirka ? r.W / lbZobrazeno.sirka : 1;
}

// Lupa je dostupná jen tehdy, když má fotka výrazně vyšší rozlišení, než v jakém je zobrazená
function lbAktualizovatTlacitka() {
    const lupaDostupna = lbMeritkoLupy() >= 1.15;
    lbZoomBtn.disabled = !lupaDostupna;
    lbZoomBtn.title = lupaDostupna ? 'Lupa (klik na fotku)' : 'Fotka nemá vyšší rozlišení';
    lbPlakat?.classList.toggle('zoomable', lupaDostupna);
    lbFillBtn.classList.toggle('active', lbRozlozeno);
    lightbox.classList.toggle('filled', lbRozlozeno && lbZobrazeno.presah > 1);
}

function lbPosunoutLupu(e) {
    if (!lbLupa) return;
    const x = lbOmezit((e.clientX - lbLupa.left) / lbLupa.width * 100, 0, 100);
    const y = lbOmezit((e.clientY - lbLupa.top) / lbLupa.height * 100, 0, 100);
    lbPlakat.style.transformOrigin = `${x}% ${y}%`;
}

function lbPrepnoutLupu(zapnout, e) {
    if (!lbPlakat || (zapnout && lbMeritkoLupy() < 1.15)) return;

    if (zapnout) {
        lbPrepnoutSlideshow(false);
        lbLupa = lbPlakat.getBoundingClientRect();
        // Bez události myši (tlačítko v liště) se zvětší střed okna
        lbPosunoutLupu(e || { clientX: lightbox.clientWidth / 2, clientY: lightbox.clientHeight / 2 });
        lbPlakat.style.transform = `scale(${lbMeritkoLupy()})`;
    } else {
        lbLupa = null;
        lbPlakat.style.transform = '';
    }
    lightbox.classList.toggle('zoomed', zapnout);
}

function lbPrepnoutRozlozeni(zapnout = !lbRozlozeno) {
    lbPrepnoutLupu(false);
    lbRozlozeno = zapnout;
    lbPosun = 0;
    lbRozvrhnout();
}

async function lbOtocit() {
    const polozka = lbPolozky[lbIndex];
    if (!polozka || !lbPlakat) return;
    lbPrepnoutLupu(false);
    polozka.rotace = (polozka.rotace + 90) % 360;
    polozka.fotky.forEach(f => { f.rotace = polozka.rotace; });
    lbPlakat.dataset.rot = polozka.rotace;
    lbPosun = 0;
    lbRozvrhnout();
    lbZmeneno = true;
    await SetRotaceFotek(polozka.fotky.map(f => f.id), polozka.rotace);
}

function lbZobrazit(index) {
    const pocet = lbPolozky.length;
    if (pocet === 0) {
        zavritLightbox();
        return;
    }
    lbIndex = (index + pocet) % pocet;
    const polozka = lbPolozky[lbIndex];

    lbLupa = null;
    lbPlne = false;
    lbPosun = 0;
    lightbox.classList.remove('zoomed');
    // Centerfold se otevírá rovnou rozložený přes celé okno
    lbRozlozeno = polozka.typ === 'Centerfold';

    // Nejdřív náhled z mezipaměti, plné rozlišení se doplní po načtení
    lbStage.innerHTML = htmlPlakatu(polozka, polozka.typ === 'Centerfold' ? VELIKOST_PLAKATU : VELIKOST_NAHLEDU);
    const plakat = lbStage.firstElementChild;
    lbPlakat = plakat;
    const obrazky = [...plakat.querySelectorAll('img')];

    pripravitPlakat(plakat, () => {
        if (lbPlakat !== plakat) return;
        lbPlne = obrazky.every(o => o.dataset.plne && o.complete && o.naturalWidth);
        // Lupa se po výměně za ostřejší obrázek nesmí rozhodit
        if (!lbLupa) lbRozvrhnout();
    });

    polozka.fotky.forEach((f, i) => {
        const plna = new Image();
        plna.onload = () => {
            if (lbPlakat !== plakat) return;
            obrazky[i].dataset.plne = '1';
            obrazky[i].src = plna.src;
        };
        plna.src = f.url + PLNE_ROZLISENI;
    });

    document.getElementById('lbCaption').textContent =
        [polozka.jmenoModelky, nazevAlba(polozka.album, polozka.typ), polozka.typ].filter(Boolean).join(' · ');
    document.getElementById('lbCounter').textContent = `${lbIndex + 1} / ${pocet}`;
    lbAktualizovatTlacitka();

    // Přednačtení další položky, aby listování neproblikávalo
    lbPolozky[(lbIndex + 1) % pocet].fotky.forEach(f => { new Image().src = f.url + PLNE_ROZLISENI; });

    if (lbCasovac) lbSpustitCasovac();
}

function lbSpustitCasovac() {
    clearTimeout(lbCasovac);
    lbCasovac = setTimeout(() => lbZobrazit(lbIndex + 1), SLIDESHOW_INTERVAL);
    // Restart animace ukazatele průběhu
    lbProgress.classList.remove('running');
    void lbProgress.offsetWidth;
    lbProgress.classList.add('running');
}

function lbPrepnoutSlideshow(zapnout = !lbCasovac) {
    clearTimeout(lbCasovac);
    lbCasovac = null;
    lbProgress.classList.remove('running');
    if (zapnout) lbSpustitCasovac();
    document.getElementById('lbPlay').innerHTML = zapnout ? '&#10074;&#10074;' : '&#9654;';
}

function otevritLightbox(index, slideshow = false, polozky = aktualniPolozky) {
    if (polozky.length === 0) return;
    lbPolozky = polozky;
    lbZmeneno = false;
    lightbox.classList.remove('hidden');
    lbPrepnoutSlideshow(slideshow);
    lbZobrazit(index);
}

function zavritLightbox() {
    lbPrepnoutSlideshow(false);
    lightbox.classList.add('hidden');
    lightbox.classList.remove('zoomed', 'filled');
    lbStage.innerHTML = '';
    lbPlakat = null;
    lbLupa = null;

    // Otočení se má projevit i v přehledu pod prohlížečem
    if (lbZmeneno) {
        if (!detailView.classList.contains('hidden')) nacistFotkyModelky(aktualniModelka.id);
        else if (!wall.classList.contains('hidden')) nacistStenu(searchInput.value);
        else if (!covers.classList.contains('hidden')) nacistCovery(searchInput.value);
        else if (!issueView.classList.contains('hidden')) otevritVydani(aktualniVydani);
    }
}

document.getElementById('lbPrev').onclick = () => lbZobrazit(lbIndex - 1);
document.getElementById('lbNext').onclick = () => lbZobrazit(lbIndex + 1);
document.getElementById('lbPlay').onclick = () => lbPrepnoutSlideshow();
document.getElementById('lbRot').onclick = lbOtocit;
document.getElementById('lbClose').onclick = zavritLightbox;
lbFillBtn.onclick = () => lbPrepnoutRozlozeni();
lbZoomBtn.onclick = () => lbPrepnoutLupu(!lbLupa);

window.addEventListener('resize', () => {
    if (lightbox.classList.contains('hidden')) return;
    lbPrepnoutLupu(false);
    lbRozvrhnout();
});

// Rozložený plakát se posouvá tažením nebo kolečkem, lupa pohybem myši
lbStage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.target.closest('.poster')) return;
    lbTazeni = { x: e.clientX, y: e.clientY, posunuto: false };
});
window.addEventListener('pointermove', (e) => {
    if (lbLupa) {
        lbPosunoutLupu(e);
        return;
    }
    if (!lbTazeni || !lbRozlozeno || lbZobrazeno.presah <= 1) return;
    const rozdil = lbZobrazeno.osa === 'x' ? e.clientX - lbTazeni.x : e.clientY - lbTazeni.y;
    if (Math.abs(rozdil) < 4 && !lbTazeni.posunuto) return;
    lbPosun = lbOmezit(lbPosun - rozdil / lbZobrazeno.presah, 0, 1);
    lbTazeni = { x: e.clientX, y: e.clientY, posunuto: true };
    lbRozvrhnout();
});

lightbox.addEventListener('click', (e) => {
    const tazeno = lbTazeni?.posunuto;
    lbTazeni = null;
    // Tlačítko nesmí zůstat zaměřené, jinak by ho mezerník stiskl podruhé
    e.target.closest('button')?.blur();

    if (e.target.closest('.poster')) {
        // Klik na fotku přepíná lupu, konec tažení se za klik nepočítá
        if (!tazeno) lbPrepnoutLupu(!lbLupa, e);
    } else if (e.target === lightbox || e.target === lbStage) {
        zavritLightbox();
    }
});

lightbox.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (lbLupa) return;
    if (lbRozlozeno && lbZobrazeno.presah > 1) {
        lbPosun = lbOmezit(lbPosun + (e.deltaY || e.deltaX) / lbZobrazeno.presah, 0, 1);
        lbRozvrhnout();
    } else {
        lbZobrazit(lbIndex + (e.deltaY > 0 ? 1 : -1));
    }
}, { passive: false });

// Odkazy na vydání a na modelku fungují v profilu i na stránce vydání
document.querySelector('main').addEventListener('click', (e) => {
    const vydani = e.target.closest('[data-vydani]');
    const modelka = e.target.closest('[data-modelka]');
    if (vydani) otevritVydani(vydani.dataset.vydani);
    else if (modelka) otevritProfilPodleId(parseInt(modelka.dataset.modelka));
});

detailView.addEventListener('click', (e) => {
    if (e.target.closest('[data-vydani]')) return;
    const polozka = e.target.closest('[data-index]');
    if (polozka) otevritLightbox(parseInt(polozka.dataset.index));
});

document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('hidden') || e.ctrlKey || e.altKey || e.metaKey) return;
    const klavesa = e.key.toLowerCase();
    if (klavesa === 'arrowright') lbZobrazit(lbIndex + 1);
    else if (klavesa === 'arrowleft') lbZobrazit(lbIndex - 1);
    else if (klavesa === ' ') lbPrepnoutSlideshow();
    else if (klavesa === 'f') lbPrepnoutRozlozeni();
    else if (klavesa === 'r') lbOtocit();
    else return;
    e.preventDefault();
});

// Tlačítko Zpět
backBtn.addEventListener('click', () => {
    nacistGalerii(searchInput.value);
});

// Ovládání Modalů
const modelModal = document.getElementById('modelModal');
const albumModal = document.getElementById('albumModal');

document.getElementById('closeModalBtn').onclick = () => modelModal.classList.add('hidden');
document.getElementById('cancelModelBtn').onclick = () => modelModal.classList.add('hidden');
document.getElementById('addAlbumBtn').onclick = () => otevritAlbumModal(aktualniModelka);
document.getElementById('closeAlbumModalBtn').onclick = () => albumModal.classList.add('hidden');

// Ovládání okna (náhrada za systémovou lištu)
document.getElementById('winMinBtn').onclick = () => WindowMinimise();
document.getElementById('winMaxBtn').onclick = () => WindowToggleMaximise();
document.getElementById('winCloseBtn').onclick = () => Quit();
document.querySelector('.navbar').addEventListener('dblclick', (e) => {
    if (!e.target.closest('input, button')) WindowToggleMaximise();
});

// Kontextová nabídka: jiná pro kartu modelky, jiná pro volný prostor aplikace
const contextMenu = document.getElementById('contextMenu');

function zavritKontextovouNabidku() {
    contextMenu.classList.add('hidden');
}

function otevritKontextovouNabidku(x, y, polozky) {
    contextMenu.innerHTML = '';
    polozky.forEach(p => {
        if (p === null) {
            contextMenu.appendChild(document.createElement('hr'));
            return;
        }
        const btn = document.createElement('button');
        btn.className = 'context-item';
        btn.textContent = p.text;
        btn.onclick = () => {
            zavritKontextovouNabidku();
            p.akce();
        };
        contextMenu.appendChild(btn);
    });

    // Nabídka nesmí vyjet mimo okno
    contextMenu.classList.remove('hidden');
    const sirka = contextMenu.offsetWidth;
    const vyska = contextMenu.offsetHeight;
    contextMenu.style.left = Math.max(4, Math.min(x, window.innerWidth - sirka - 4)) + 'px';
    contextMenu.style.top = Math.max(4, Math.min(y, window.innerHeight - vyska - 4)) + 'px';
}

// Úprava výřezu titulní fotky přímo na kartě: tažením posun, kolečkem nebo posuvníkem přiblížení
function upravitVyrez(modelka) {
    if (zrusitUpravuVyrezu) zrusitUpravuVyrezu();

    const card = gallery.querySelector(`.card[data-id="${modelka.id}"]`);
    if (!card) return;
    const ram = card.querySelector('.card-image-wrap');
    const img = ram.querySelector('img');
    const info = card.querySelector('.card-info');
    const puvodniInfo = info.innerHTML;
    const vyrez = { coverZoom: modelka.coverZoom, coverX: modelka.coverX, coverY: modelka.coverY };

    card.classList.add('editing');
    info.innerHTML = `
        <p class="crop-hint">Tažením posuň, kolečkem přibliž</p>
        <input type="range" class="crop-zoom" min="1" max="4" step="0.01" title="Přiblížení" />
        <div class="crop-actions">
            <button type="button" class="btn btn-secondary btn-small" data-akce="reset">Výchozí</button>
            <button type="button" class="btn btn-secondary btn-small" data-akce="zrusit">Zrušit</button>
            <button type="button" class="btn btn-primary btn-small" data-akce="ulozit">Uložit</button>
        </div>
    `;
    const posuvnik = info.querySelector('.crop-zoom');

    const omezit = (hodnota, min, max) => Math.min(max, Math.max(min, hodnota));
    const vykreslit = () => {
        img.style.cssText = stylVyrezu(vyrez);
        posuvnik.value = vyrez.coverZoom;
    };
    vykreslit();

    // O kolik pixelů fotka po přiblížení přesahuje rám v každé ose
    const presah = () => {
        const sirka = ram.clientWidth;
        const vyska = ram.clientHeight;
        const pomer = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : sirka / vyska;
        return {
            x: Math.max(sirka, vyska * pomer) * vyrez.coverZoom - sirka,
            y: Math.max(vyska, sirka / pomer) * vyrez.coverZoom - vyska,
        };
    };

    let tazeni = null;
    const naStisk = (e) => {
        if (e.button !== 0) return;
        tazeni = { x: e.clientX, y: e.clientY };
        ram.setPointerCapture(e.pointerId);
    };
    const naPohyb = (e) => {
        if (!tazeni) return;
        const p = presah();
        if (p.x > 0) vyrez.coverX = omezit(vyrez.coverX - (e.clientX - tazeni.x) / p.x * 100, 0, 100);
        if (p.y > 0) vyrez.coverY = omezit(vyrez.coverY - (e.clientY - tazeni.y) / p.y * 100, 0, 100);
        tazeni = { x: e.clientX, y: e.clientY };
        vykreslit();
    };
    const naUvolneni = () => { tazeni = null; };
    const naKolecko = (e) => {
        e.preventDefault();
        vyrez.coverZoom = omezit(vyrez.coverZoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 4);
        vykreslit();
    };

    ram.addEventListener('pointerdown', naStisk);
    ram.addEventListener('pointermove', naPohyb);
    ram.addEventListener('pointerup', naUvolneni);
    ram.addEventListener('pointercancel', naUvolneni);
    ram.addEventListener('wheel', naKolecko, { passive: false });
    posuvnik.addEventListener('input', () => {
        vyrez.coverZoom = parseFloat(posuvnik.value);
        vykreslit();
    });

    let naAkci = null;
    const ukoncit = () => {
        info.removeEventListener('click', naAkci);
        ram.removeEventListener('pointerdown', naStisk);
        ram.removeEventListener('pointermove', naPohyb);
        ram.removeEventListener('pointerup', naUvolneni);
        ram.removeEventListener('pointercancel', naUvolneni);
        ram.removeEventListener('wheel', naKolecko);
        card.classList.remove('editing');
        info.innerHTML = puvodniInfo;
        img.style.cssText = stylVyrezu(modelka);
        zrusitUpravuVyrezu = null;
    };
    zrusitUpravuVyrezu = ukoncit;

    naAkci = async (e) => {
        const akce = e.target.closest('[data-akce]')?.dataset.akce;
        if (!akce) return;
        e.stopPropagation();

        if (akce === 'reset') {
            Object.assign(vyrez, { coverZoom: 1, coverX: 50, coverY: 50 });
            vykreslit();
        } else if (akce === 'zrusit') {
            ukoncit();
        } else if (akce === 'ulozit') {
            if (await SetCoverVyrez(modelka.id, vyrez.coverZoom, vyrez.coverX, vyrez.coverY)) {
                Object.assign(modelka, vyrez);
            }
            ukoncit();
        }
    };
    info.addEventListener('click', naAkci);
}

// Pole formuláře modelky: [vlastnost modelky, id prvku, typ]
const poleModelky = [
    ['jmeno', 'inputJmeno', 'text'],
    ['narozeniDatum', 'inputNarozeniDatum', 'text'],
    ['narozeniMisto', 'inputNarozeniMisto', 'text'],
    ['narodnost', 'inputNarodnost', 'text'],
    ['etnicita', 'inputEtnicita', 'text'],
    ['vyskaCm', 'inputVyska', 'cislo'],
    ['vahaKg', 'inputVaha', 'cislo'],
    ['vlasyBarva', 'inputVlasy', 'text'],
    ['ociBarva', 'inputOci', 'text'],
    ['ochlupeni', 'selectOchlupeni', 'text'],
    ['tetovani', 'inputTetovani', 'prepinac'],
    ['piercing', 'inputPiercing', 'prepinac'],
    ['obvodHrudnikCm', 'inputHrudnik', 'cislo'],
    ['obvodPasCm', 'inputPas', 'cislo'],
    ['obvodBokyCm', 'inputBoky', 'cislo'],
    ['velikostPrsou', 'inputVelikost', 'text'],
    ['prsaTyp', 'selectPrsaTyp', 'text'],
    ['vystoupeni', 'inputVystoupeni', 'text'],
    ['role', 'inputRole', 'text'],
    ['pictorialVydani', 'inputPictorial', 'text'],
    ['tags', 'inputTags', 'text'],
    ['coverId', 'inputDriveID', 'text'],
];

// Formulář modelky slouží pro přidání (modelka = null) i úpravu
function otevritModelModal(modelka) {
    editovanaModelka = modelka;
    document.getElementById('addModelForm').reset();
    document.getElementById('modelModalTitle').textContent = modelka ? 'Upravit modelku' : 'Přidat novou modelku';
    // Při úpravě lze titulní fotku nechat prázdnou – zůstane původní
    document.getElementById('inputDriveID').required = !modelka;

    if (modelka) {
        poleModelky.forEach(([vlastnost, id, typ]) => {
            const prvek = document.getElementById(id);
            if (typ === 'prepinac') prvek.checked = modelka[vlastnost];
            else if (typ === 'cislo') prvek.value = modelka[vlastnost] || '';
            else prvek.value = modelka[vlastnost];
        });
    }
    modelModal.classList.remove('hidden');
    document.querySelector('#modelModal .form-body').scrollTop = 0;
    document.getElementById('inputJmeno').focus();
}

const deleteModal = document.getElementById('deleteModal');

// Potvrzovací okno pro nevratné mazání; akce se provede až po potvrzení
function otevritDeleteModal(nadpis, text, akce, poDokonceni = () => nacistGalerii(searchInput.value)) {
    potvrzenaAkce = async () => {
        if (await akce() === false) oznamit('Smazání se nepodařilo, nic se nezměnilo.');
        poDokonceni();
    };
    document.getElementById('deleteModalTitle').textContent = nadpis;
    document.getElementById('deleteModalText').textContent = text;
    deleteModal.classList.remove('hidden');
}

function zavritDeleteModal() {
    potvrzenaAkce = null;
    deleteModal.classList.add('hidden');
}

function smazatModelku(modelka) {
    otevritDeleteModal(
        'Smazat modelku',
        `Opravdu smazat modelku „${modelka.jmeno}" včetně všech jejích fotek a alb? Před smazáním se uloží záloha.`,
        () => DeleteModelka(modelka.id)
    );
}

function smazatDatabazi() {
    otevritDeleteModal(
        'Smazat celou databázi',
        `Opravdu smazat celou databázi? Odstraní se všechny modelky, jejich fotky a alba i covery. Před smazáním se uloží záloha.`,
        async () => {
            const smazano = await DeleteVse();
            if (smazano) oznamit(`Databáze smazána. Záloha před smazáním je ve složce ${await SlozkaZaloh()}`);
            return smazano;
        }
    );
}

document.getElementById('closeDeleteModalBtn').onclick = zavritDeleteModal;
document.getElementById('cancelDeleteBtn').onclick = zavritDeleteModal;
document.getElementById('confirmDeleteBtn').onclick = async () => {
    if (!potvrzenaAkce) return;
    await potvrzenaAkce();
    zavritDeleteModal();
};

// Formulář alba slouží pro přidání fotek (album = null) i úpravu alba ({ album, typ })
// Přidání centerfoldu ze stěny plakátů: modelka se jen vybere ze seznamu už zadaných
async function pridatCenterfold() {
    const modelky = await GetModelky('') || [];
    if (modelky.length === 0) {
        otevritModelModal(null);
        return;
    }
    modelky.sort((a, b) => a.jmeno.localeCompare(b.jmeno, 'cs'));

    otevritAlbumModal(modelky[0]);
    const vyber = document.getElementById('selectAlbumModelka');
    vyber.innerHTML = modelky.map(m => `<option value="${m.id}">${esc(m.jmeno)}</option>`).join('');
    vyber.onchange = () => { aktualniModelka = modelky.find(m => m.id === parseInt(vyber.value)); };
    document.getElementById('albumModelkaGroup').classList.remove('hidden');
    document.getElementById('albumModalTitle').textContent = 'Přidat centerfold';
    // Typ je daný, na stěnu patří jen centerfoldy
    document.getElementById('albumTypGroup').classList.add('hidden');
    document.getElementById('selectTyp').value = 'Centerfold';
    prepnoutPoleAlba();
    vyber.focus();
}

// Centerfold se místo názvu určuje měsícem a rokem vydání
function prepnoutPoleAlba() {
    const centerfold = document.getElementById('selectTyp').value === 'Centerfold';
    document.getElementById('albumNazevGroup').classList.toggle('hidden', centerfold);
    document.getElementById('albumVydaniGroup').classList.remove('hidden');
    // U pictorialu je vydání nepovinné
    document.getElementById('albumMesicLabel').textContent = centerfold ? 'Měsíc vydání' : 'Měsíc vydání (nepovinné)';
    document.getElementById('albumRokLabel').textContent = centerfold ? 'Rok vydání' : 'Rok vydání (nepovinné)';
    document.getElementById('inputAlbumName').required = !centerfold;
    document.getElementById('selectAlbumMesic').required = centerfold;
    document.getElementById('inputAlbumRok').required = centerfold;
}

document.getElementById('selectTyp').addEventListener('change', prepnoutPoleAlba);

function otevritAlbumModal(modelka, album = null) {
    aktualniModelka = modelka;
    editovaneAlbum = album;
    document.getElementById('addAlbumForm').reset();
    document.getElementById('albumModelkaGroup').classList.add('hidden');
    document.getElementById('albumModalTitle').textContent = album ? 'Upravit album' : 'Přidat fotky do alba';
    document.getElementById('albumSubmitBtn').textContent = album ? 'Uložit album' : 'Uložit fotky';
    document.getElementById('bulkLinksLabel').textContent = album
        ? 'Přidat další fotky – odkazy z Google Disku (nepovinné)'
        : 'Vložte odkazy z Google Disku (libovolné množství)';
    // Při úpravě alba není nutné přidávat další fotky
    document.getElementById('inputBulkLinks').required = !album;

    document.getElementById('albumTypGroup').classList.remove('hidden');

    // Starší album jiného typu (např. Cover) si svůj typ při úpravě ponechá
    const vyberTypu = document.getElementById('selectTyp');
    vyberTypu.querySelectorAll('[data-puvodni]').forEach(o => o.remove());

    if (album) {
        if (![...vyberTypu.options].some(o => o.value === album.typ)) {
            vyberTypu.add(new Option(album.typ, album.typ));
            vyberTypu.lastElementChild.dataset.puvodni = '1';
        }
        vyberTypu.value = album.typ;
        document.getElementById('inputAlbumName').value = album.album;

        const vydani = /^(\d{4})-(\d{2})$/.exec(album.vydani || album.album);
        if (vydani) {
            document.getElementById('inputAlbumRok').value = vydani[1];
            document.getElementById('selectAlbumMesic').value = vydani[2];
        }
    }
    prepnoutPoleAlba();
    albumModal.classList.remove('hidden');
    vyberTypu.focus();
}

function smazatAlbum(album, pocet) {
    otevritDeleteModal(
        'Smazat album',
        `Opravdu smazat album „${nazevAlba(album.album, album.typ)}" (${album.typ}, počet fotek: ${pocet})? Fotky na Google Disku zůstanou. Před smazáním se uloží záloha.`,
        () => DeleteAlbum(aktualniModelka.id, album.album, album.typ),
        () => nacistFotkyModelky(aktualniModelka.id)
    );
}

// Kontrola, že Google Disk všechny uložené soubory stále vrací
const checkModal = document.getElementById('checkModal');
let nedostupneFotky = [];

async function zkontrolovatSoubory(hotovyVysledek = null) {
    const text = document.getElementById('checkModalText');
    const seznam = document.getElementById('checkModalList');
    const odebrat = document.getElementById('checkRemoveBtn');
    text.textContent = 'Ověřuji soubory na Google Disku…';
    seznam.innerHTML = '';
    odebrat.classList.add('hidden');
    checkModal.classList.remove('hidden');

    const vysledek = hotovyVysledek || await ZkontrolovatSoubory();
    localStorage.setItem('posledniKontrola', String(Date.now()));
    const neovereno = vysledek.neovereno
        ? ` U ${vysledek.neovereno} se kontrola nepovedla (zřejmě připojení), zkus to později znovu.`
        : '';

    if (vysledek.nedostupne.length === 0) {
        text.textContent = `Zkontrolováno souborů: ${vysledek.zkontrolovano}. Všechny ověřené jsou dostupné.${neovereno}`;
        return;
    }

    text.textContent = `Zkontrolováno souborů: ${vysledek.zkontrolovano}. Nedostupných: ${vysledek.nedostupne.length} – na Disku jsou smazané nebo už nejsou sdílené.${neovereno}`;
    seznam.innerHTML = vysledek.nedostupne.map(n => {
        const kde = n.fotoId === 0
            ? `titulní fotka (změň ji přes Editovat)`
            : `${n.typ} · ${nazevAlba(n.album, n.typ)}`;
        return `<li><strong>${esc(n.jmeno || 'Cover časopisu')}</strong><span>${esc(kde)}</span></li>`;
    }).join('');

    // Titulní fotky se neodebírají, modelka by zůstala bez obrázku bez vědomí uživatele
    nedostupneFotky = vysledek.nedostupne.filter(n => n.fotoId !== 0);
    odebrat.classList.toggle('hidden', nedostupneFotky.length === 0);
    odebrat.textContent = `Odebrat nedostupné z databáze (${nedostupneFotky.length})`;
}

function zavritKontrolu() {
    checkModal.classList.add('hidden');
}

document.getElementById('closeCheckModalBtn').onclick = zavritKontrolu;
document.getElementById('checkCloseBtn').onclick = zavritKontrolu;
document.getElementById('checkRemoveBtn').onclick = async () => {
    for (const n of nedostupneFotky) {
        await DeleteFotografie(n.fotoId);
    }
    nedostupneFotky = [];
    zavritKontrolu();
    if (!detailView.classList.contains('hidden')) nacistFotkyModelky(aktualniModelka.id);
    else nacistGalerii(searchInput.value);
};

// Mezipaměť jsou jen kopie obrázků stažené z Disku; po vymazání se načtou znovu
async function vymazatMezipamet() {
    const bajty = await VymazatMezipamet();
    oznamit(`Mezipaměť obrázků vymazána (uvolněno ${(bajty / 1024 / 1024).toFixed(1)} MB). Obrázky se načtou znovu z Disku.`);
    setTimeout(() => window.location.reload(), 2500);
}

// Jednou denně na pozadí ověří, že soubory na Disku stále existují
async function kontrolaPoSpusteni() {
    const DEN = 24 * 60 * 60 * 1000;
    if (Date.now() - Number(localStorage.getItem('posledniKontrola') || 0) < DEN) return;

    const vysledek = await ZkontrolovatSoubory();
    // Při výpadku připojení se kontrola zopakuje při dalším spuštění
    if (vysledek.zkontrolovano > 0 && vysledek.neovereno === vysledek.zkontrolovano) return;
    localStorage.setItem('posledniKontrola', String(Date.now()));

    if (vysledek.nedostupne.length > 0) {
        oznamit(`Souborů, které už na Google Disku nejsou dostupné: ${vysledek.nedostupne.length}.`,
            { text: 'Zobrazit', akce: () => zkontrolovatSoubory(vysledek) });
    }
}

function smazatCover(cover) {
    otevritDeleteModal(
        'Smazat cover',
        `Opravdu smazat cover vydání „${nazevAlba(cover.album, cover.typ)}"? Soubor na Google Disku zůstane.`,
        () => DeleteFotografie(cover.fotky[0].id),
        () => nacistCovery(searchInput.value)
    );
}

function smazatFotku(fotka) {
    otevritDeleteModal(
        'Odebrat fotku',
        `Opravdu odebrat tuto fotku z alba „${nazevAlba(fotka.album, fotka.typ)}"? Soubor na Google Disku zůstane.`,
        () => DeleteFotografie(fotka.id),
        () => nacistFotkyModelky(aktualniModelka.id)
    );
}

document.addEventListener('contextmenu', (e) => {
    // V textových polích a v modálních oknech vlastní nabídku nezobrazujeme
    if (e.target.closest('input, textarea, select')) return;
    e.preventDefault();
    if (e.target.closest('.modal-overlay, .lightbox')) {
        zavritKontextovouNabidku();
        return;
    }

    const card = e.target.closest('.card');
    let polozky;

    if (card) {
        const id = parseInt(card.getAttribute('data-id'));
        const modelka = nacteneModelky.find(item => item.id === id);
        if (!modelka) return;
        polozky = [
            { text: 'Editovat', akce: () => otevritModelModal(modelka) },
            { text: 'Upravit výřez titulní fotky', akce: () => upravitVyrez(modelka) },
            { text: 'Smazat', akce: () => smazatModelku(modelka) },
            { text: 'Přidat fotky / album', akce: () => otevritAlbumModal(modelka) },
        ];
    } else if (e.target.closest('.wall-item')) {
        // Centerfold na stěně plakátů
        const index = parseInt(e.target.closest('.wall-item').dataset.index);
        polozky = [
            { text: 'Otevřít centerfold', akce: () => otevritLightbox(index, false, stenaPolozky) },
            { text: 'Otevřít profil modelky', akce: () => otevritProfilPodleId(stenaPolozky[index].modelkaId) },
            { text: `Otevřít vydání ${nazevVydani(stenaPolozky[index].album)}`, akce: () => otevritVydani(stenaPolozky[index].album) },
        ];
    } else if (e.target.closest('.album')) {
        // Album v profilu modelky, případně konkrétní fotka v něm
        const album = aktualniAlba[parseInt(e.target.closest('.album').dataset.album)];
        const centerfold = album.typ === 'Centerfold';
        const prvekPolozky = e.target.closest('[data-index]');
        const prvekFotky = e.target.closest('[data-foto-id]');

        polozky = [];
        if (prvekPolozky) {
            const index = parseInt(prvekPolozky.dataset.index);
            polozky.push({ text: centerfold ? 'Otevřít centerfold' : 'Otevřít fotku', akce: () => otevritLightbox(index) });

            const fotka = prvekFotky && album.fotky.find(f => f.id === parseInt(prvekFotky.dataset.fotoId));
            if (fotka) {
                polozky.push({ text: album.spojit ? 'Odebrat tuto stránku' : 'Odebrat fotku', akce: () => smazatFotku(fotka) });
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
                    await SetSpojeniAlba(aktualniModelka.id, album.album, album.typ, !album.spojit);
                    nacistFotkyModelky(aktualniModelka.id);
                },
            });
        }
        polozky.push(
            { text: 'Spustit slideshow alba', akce: () => otevritLightbox(aktualniPolozky.indexOf(album.polozky[0]), true) },
            { text: 'Upravit album / přidat fotky', akce: () => otevritAlbumModal(aktualniModelka, album) },
            { text: 'Smazat album', akce: () => smazatAlbum(album, album.fotky.length) }
        );
    } else if (!issueView.classList.contains('hidden')) {
        // Stránka vydání: úpravy se dělají v profilu modelky a v přehledu coverů
        const prvekPolozky = e.target.closest('[data-index]');
        polozky = [];
        if (prvekPolozky) {
            const index = parseInt(prvekPolozky.dataset.index);
            const polozka = vydaniPolozky[index];
            polozky.push({ text: 'Otevřít fotku', akce: () => otevritLightbox(index, false, vydaniPolozky) });
            if (polozka.modelkaId) {
                polozky.push({ text: `Otevřít profil: ${polozka.jmenoModelky}`, akce: () => otevritProfilPodleId(polozka.modelkaId) });
            }
            polozky.push(null);
        }
        polozky.push(
            { text: 'Spustit slideshow vydání', akce: () => otevritLightbox(0, true, vydaniPolozky) },
            { text: 'Zpět', akce: () => nacistGalerii(searchInput.value) }
        );
    } else if (!detailView.classList.contains('hidden')) {
        polozky = [
            { text: 'Přidat fotky / album', akce: () => otevritAlbumModal(aktualniModelka) },
            { text: 'Zpět', akce: () => nacistGalerii(searchInput.value) },
        ];
    } else if (e.target.closest('.cover-item')) {
        // Cover časopisu
        const index = parseInt(e.target.closest('.cover-item').dataset.index);
        const cover = coveryPolozky[index];
        polozky = [
            { text: 'Otevřít vydání', akce: () => otevritVydani(cover.album) },
            { text: 'Zobrazit cover', akce: () => otevritLightbox(index, false, coveryPolozky) },
            { text: 'Upravit cover', akce: () => otevritCoverModal(cover) },
            { text: 'Smazat cover', akce: () => smazatCover(cover) },
        ];
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
        polozky = [
            { text: 'Přidat modelku', akce: () => otevritModelModal(null) },
            { text: 'Obnovit galerii', akce: () => nacistGalerii(searchInput.value) },
            { text: 'Zkontrolovat soubory na Disku', akce: () => zkontrolovatSoubory() },
            { text: 'Vymazat mezipaměť obrázků', akce: vymazatMezipamet },
            { text: 'Otevřít složku se zálohami', akce: async () => BrowserOpenURL('file://' + await SlozkaZaloh()) },
            null,
            { text: 'Smazat celou databázi', akce: smazatDatabazi },
        ];
    }

    otevritKontextovouNabidku(e.clientX, e.clientY, polozky);
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#contextMenu')) zavritKontextovouNabidku();
});
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Esc zavře nabídku, jinak se z profilu vrátí na výběr modelek
    if (!contextMenu.classList.contains('hidden')) {
        zavritKontextovouNabidku();
    } else if (!lightbox.classList.contains('hidden')) {
        // Esc nejdřív vypne lupu, teprve potom zavře prohlížeč
        if (lbLupa) lbPrepnoutLupu(false);
        else zavritLightbox();
    } else if (zrusitUpravuVyrezu) {
        zrusitUpravuVyrezu();
    } else if ((!detailView.classList.contains('hidden') || !issueView.classList.contains('hidden')) && !document.querySelector('.modal-overlay:not(.hidden)')) {
        nacistGalerii(searchInput.value);
    }
});
window.addEventListener('blur', zavritKontextovouNabidku);
window.addEventListener('resize', zavritKontextovouNabidku);

// Formulář: Přidat Modelku
document.getElementById('addModelForm').onsubmit = async (e) => {
    e.preventDefault();
    // Míry bez vyplněných obvodů zůstávají při úpravě původní
    const modelka = { id: editovanaModelka ? editovanaModelka.id : 0, miry: editovanaModelka ? editovanaModelka.miry : '' };
    poleModelky.forEach(([vlastnost, id, typ]) => {
        const prvek = document.getElementById(id);
        if (typ === 'prepinac') modelka[vlastnost] = prvek.checked;
        else if (typ === 'cislo') modelka[vlastnost] = parseInt(prvek.value) || 0;
        else modelka[vlastnost] = prvek.value.trim();
    });

    if (!await odkazJeVPoradku(modelka.coverId)) return;

    const ulozeno = editovanaModelka ? await UpdateModelka(modelka) : await AddModelka(modelka);
    if (!ulozeno) {
        oznamit('Modelku se nepodařilo uložit do databáze.');
        return;
    }
    modelModal.classList.add('hidden');
    nacistGalerii(searchInput.value);
};

// Formulář: Hromadné fotky do alba
document.getElementById('addAlbumForm').onsubmit = async (e) => {
    e.preventDefault();
    const typ = document.getElementById('selectTyp').value;
    const rok = document.getElementById('inputAlbumRok').value;
    const mesic = document.getElementById('selectAlbumMesic').value;
    if (Boolean(rok) !== Boolean(mesic)) {
        oznamit('Vydání potřebuje měsíc i rok. Vyplň obojí, nebo nech obojí prázdné.');
        return;
    }
    const vydani = rok ? `${rok}-${mesic}` : '';
    const album = typ === 'Centerfold' ? vydani : document.getElementById('inputAlbumName').value.trim();
    const links = document.getElementById('inputBulkLinks').value;

    if (editovaneAlbum && !await UpdateAlbum(aktualniModelka.id, editovaneAlbum.album, editovaneAlbum.typ, album, typ)) {
        oznamit('Album se nepodařilo uložit do databáze.');
        return;
    }
    if (links.trim()) {
        oznamitVlozeni(await AddBulkPhotos(aktualniModelka.id, album, typ, links), 'fotek');
    }
    // Centerfold má vydání přímo v názvu alba, ostatním se přiřazuje zvlášť
    if (typ !== 'Centerfold') {
        await SetVydaniAlba(aktualniModelka.id, album, typ, vydani);
    }
    albumModal.classList.add('hidden');
    document.getElementById('addAlbumForm').reset();
    // Na stěně centerfoldů se obnoví stěna, jinak alba modelky
    if (!wall.classList.contains('hidden')) nacistStenu(searchInput.value);
    else nacistFotkyModelky(aktualniModelka.id);
};

searchInput.addEventListener('input', (e) => nacistGalerii(e.target.value));
// Chyby z backendu se ukazují v okně, ne jen v konzoli
EventsOn('chyba', (zprava) => oznamit(zprava));
StavDatabaze().then((chyba) => {
    if (chyba) oznamit(chyba, { text: 'Rozumím', akce: () => {} });
});

nacistGalerii();
kontrolaPoSpusteni();