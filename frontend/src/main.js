import './style.css';
import { GetModelky, AddModelka, UpdateModelka, DeleteModelka, DeleteVse, SetCoverVyrez, GetFotografieModelky, GetCenterfoldy, AddBulkPhotos, UpdateAlbum, DeleteAlbum, DeleteFotografie, SetRotaceFotek, SetSpojeniAlba, GetCovery, AddCover, UpdateCover, ZkontrolovatSoubory, GetVydani, GetPrehledVydani, SetVydaniAlba, SetPopisAlba, SetHodnoceni, SetHodnoceniFotek, SetPoradiFotek, ZrusitPoradiAlba, ExportovatDoSouboru, VybratSouborImportu, ImportovatZeSouboru, DeleteFotografieHromadne, SeznamZaloh, ObnovitZalohu, GetFotografove, GetPrehled, MaZamek, Odemknout, NastavitHeslo, SetTitulniFotka, OveritOdkaz, VymazatMezipamet, SlozkaZaloh, StavDatabaze } from '../wailsjs/go/main/App';
import { MESICE, nazevAlba, nazevVydani, esc, formatDatum, bezDiakritiky, sjednotit, vekPriVydani, udajChybi, EDICE, VYCHOZI_EDICE, rozlozitVydani, slozitVydani, prevestVysku, prevestVahu, rozlozitMiry } from './lib/format';
import { klicAlba, sestavitAlba, zacatkyAlb, novePoradi } from './lib/alba';
import { WindowMinimise, WindowToggleMaximise, WindowIsMaximised, WindowIsFullscreen, Quit, BrowserOpenURL, EventsOn } from '../wailsjs/runtime/runtime';

let aktualniModelka = null;
let nacteneModelky = [];
let editovanaModelka = null;
let potvrzenaAkce = null;
let zrusenaAkce = null;
let minHodnoceni = 0; // galerie ukazuje jen modelky s aspoň tolika srdíčky; 0 = všechny
let zrusitUpravuVyrezu = null;
let aktualniAlba = [];
let aktualniPolozky = [];
let stenaPolozky = [];
let rezim = 'modelky'; // přehled na hlavní stránce: 'modelky', 'centerfoldy', 'covery', 'kalendar' nebo 'prehled'
let maZamek = false;
// Pořadové číslo posledního načítání pohledu; odpověď, kterou mezitím předběhlo novější načítání, se zahodí
let cisloNacteni = 0;
let zamceno = false;
let coveryPolozky = [];
let vydaniPolozky = [];
let aktualniVydani = null;
let editovanyCover = null;
let editovaneAlbum = null;
// Modelka, ke které se ukládá okno alba; nemusí to být modelka otevřeného profilu
let modelkaAlba = null;


// Google Disk bez přípony vrací nejvýše 1600 px; =s0 je originál, =w600 úsporný náhled
const VELIKOST_NAHLEDU = '=w400';       // dlaždice fotky v albu
const VELIKOST_PLAKATU_MALA = '=w600';  // plakát na stěně, v coverech a v úzkém levém sloupci
const VELIKOST_PLAKATU = '=w1200';      // plakát v širokém sloupci stránky vydání
const VELIKOST_KARTY = '=w400';         // titulní fotka na kartě galerie
// Titulní fotka v profilu a při úpravě výřezu; rezerva pro přiblížení
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

// Karta si vystačí s menším obrázkem, dokud výřez fotku výrazně nepřibližuje
function adresaTitulni(modelka, velka = false) {
    if (!modelka.coverUrl) return BEZ_FOTKY;
    return modelka.coverUrl + (velka || modelka.coverZoom > 1.5 ? VELIKOST_TITULNI : VELIKOST_KARTY);
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
        <button data-rezim="kalendar" data-kratce="Kal">Kalendář</button>
        <button data-rezim="prehled" data-kratce="Př">Přehled</button>
      </div>
      <button id="backBtn" class="nav-back hidden" title="Zpět (Esc)">&larr; Modelky</button>
      <button id="prevModelBtn" class="nav-back nav-step hidden" title="Předchozí modelka (šipka vlevo)">&#8249;</button>
      <button id="nextModelBtn" class="nav-back nav-step hidden" title="Další modelka (šipka vpravo)">&#8250;</button>
    </div>
    <div class="nav-controls">
      <input type="text" id="searchInput" placeholder="Hledat…" title="Modelky: jméno, národnost, vlasy, míry, tagy… Centerfoldy a covery: jméno nebo vydání. Více slov zužuje výběr." />
      <button id="favBtn" class="nav-fav"></button>
      <button id="addBtn" class="nav-fav" title="Přidat…">+</button>
      <button id="menuBtn" class="nav-fav" title="Další akce">&#8943;</button>
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

    <!-- Kalendář vydání -->
    <div id="calendar" class="calendar hidden">
      <nav id="calNav"></nav>
      <div id="calList"></div>
    </div>

    <!-- Přehled sbírky: počty a co chybí doplnit -->
    <div id="stats" class="stats hidden"></div>

    <!-- Covery časopisů po ročnících -->
    <div id="covers" class="covers hidden">
      <nav id="coversNav"></nav>
      <div id="coversList"></div>
    </div>

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
          <div class="album-actions-buttons">
            <button id="editModelBtn" class="btn btn-secondary btn-small">Upravit modelku</button>
            <button id="addAlbumBtn" class="btn btn-secondary btn-small">+ Přidat fotky / album</button>
          </div>
        </div>
        <!-- Lišta alb: zůstává při rolování nahoře a skáče na vybrané album -->
        <nav id="albumNav"></nav>
        <div id="photosGrid"></div>
      </section>
    </div>
  </main>

  <!-- Rychlé přidání modelky: stačí jméno, ostatní se doplní v profilu -->
  <div id="quickModal" class="modal-overlay hidden">
    <div class="modal-card modal-narrow">
      <div class="modal-header">
        <h3>Nová modelka</h3>
        <button id="closeQuickModalBtn" class="close-btn">&times;</button>
      </div>
      <form id="quickForm">
        <div class="form-group">
          <label for="inputQuickJmeno">Jméno</label>
          <input type="text" id="inputQuickJmeno" required autocomplete="off" />
        </div>
        <div class="modal-actions modal-actions-split">
          <button type="button" id="quickMoreBtn" class="btn btn-secondary">Vyplnit další údaje…</button>
          <button type="submit" class="btn btn-primary">Přidat</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal 1: Přidat / upravit modelku -->
  <div id="modelModal" class="modal-overlay hidden">
    <div class="modal-card modal-wide">
      <div class="modal-header">
        <h3 id="modelModalTitle">Přidat novou modelku</h3>
        <button id="closeModalBtn" class="close-btn">&times;</button>
      </div>
      <form id="addModelForm" novalidate>
        <div class="form-layout">
          <nav id="modelTabs" class="form-tabs"></nav>
          <div class="form-body">
          <section class="form-section">
            <h4>Základní údaje</h4>
            <div class="form-grid cols-2">
              <div class="form-group span-2">
                <label for="inputJmeno">Celé jméno</label>
                <input type="text" id="inputJmeno" />
              </div>
              <div class="form-group span-2">
                <label for="inputDalsiJmena">Další jména a pseudonymy (oddělené čárkou)</label>
                <input type="text" id="inputDalsiJmena" />
              </div>
              <div class="form-group">
                <label for="inputNarozeniDatum">Datum narození</label>
                <input type="date" id="inputNarozeniDatum" />
              </div>
              <div class="form-group">
                <label for="inputNarozeniMisto">Místo narození</label>
                <input type="text" id="inputNarozeniMisto" list="seznamMisto" />
              </div>
              <div class="form-group">
                <label for="inputNarodnost">Národnost</label>
                <input type="text" id="inputNarodnost" list="seznamNarodnost" />
              </div>
              <div class="form-group">
                <label for="inputEtnicita">Etnicita</label>
                <input type="text" id="inputEtnicita" list="seznamEtnicita" />
              </div>
              <div class="form-group span-2">
                <label for="inputDriveID">Titulní fotka – odkaz z Google Disku (nepovinné, jde později vybrat z alba)</label>
                <input type="text" id="inputDriveID" />
              </div>
            </div>
          </section>

          <section class="form-section">
            <h4>Vzhled a míry</h4>
            <div class="form-grid cols-4">
              <div class="form-group">
                <label for="inputVyska">Výška (cm)</label>
                <input type="text" id="inputVyska" inputmode="decimal" placeholder="cm nebo 5'7&quot;" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="inputVaha">Váha (kg)</label>
                <input type="text" id="inputVaha" inputmode="decimal" placeholder="kg nebo 115 lbs" autocomplete="off" />
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
              <div class="form-group">
                <label for="selectTetovani">Tetování</label>
                <select id="selectTetovani">
                  <option value="-1">Neuvedeno</option>
                  <option value="1">Ano</option>
                  <option value="0">Ne</option>
                </select>
              </div>
              <div class="form-group">
                <label for="selectPiercing">Piercing</label>
                <select id="selectPiercing">
                  <option value="-1">Neuvedeno</option>
                  <option value="1">Ano</option>
                  <option value="0">Ne</option>
                </select>
              </div>
            </div>
            <h5 class="form-subtitle">Míry</h5>
            <div class="form-grid cols-3">
              <div class="form-group">
                <label for="inputHrudnik">Hrudník (cm)</label>
                <input type="text" id="inputHrudnik" inputmode="decimal" placeholder="cm nebo 34B-24-34" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="inputPas">Pas (cm)</label>
                <input type="text" id="inputPas" inputmode="decimal" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="inputBoky">Boky (cm)</label>
                <input type="text" id="inputBoky" inputmode="decimal" autocomplete="off" />
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
            <h4>Zařazení a poznámky</h4>
            <div class="form-grid cols-2">
              <div class="form-group span-2">
                <label for="inputRole">Role</label>
                <input type="text" id="inputRole" list="seznamRole" />
              </div>
              <div class="form-group span-2">
                <label for="inputTags">Tagy (oddělené čárkou)</label>
                <input type="text" id="inputTags" />
                <div id="tagyNapoveda" class="tag-suggest"></div>
              </div>
              <div class="form-group span-2">
                <label for="inputPoznamka">Poznámka</label>
                <textarea id="inputPoznamka" rows="4"></textarea>
              </div>
            </div>
          </section>


          <!-- Našeptávání hodnot, které už v databázi jsou, aby se stejný údaj psal vždy stejně -->
          <datalist id="seznamVlasy"></datalist>
          <datalist id="seznamOci"></datalist>
          <datalist id="seznamNarodnost"></datalist>
          <datalist id="seznamEtnicita"></datalist>
          <datalist id="seznamMisto"></datalist>
          <datalist id="seznamRole"></datalist>
          </div>
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
        <!-- Modelka se vybírá jen tam, kde není daná (stěna, vydání, kalendář); neznámé jméno založí novou -->
        <div id="albumModelkaGroup" class="form-group hidden">
          <label for="inputAlbumModelka">Modelka</label>
          <input type="text" id="inputAlbumModelka" list="seznamModelekAlba" autocomplete="off" placeholder="Začni psát jméno…" />
          <datalist id="seznamModelekAlba"></datalist>
          <small id="albumModelkaNova" class="field-hint"></small>
        </div>
        <div class="form-row">
          <div id="albumTypGroup" class="form-group">
            <label for="selectTyp">Typ obsahu</label>
            <select id="selectTyp">
              <option value="Pictorial">Pictorial (Fotostory)</option>
              <option value="Centerfold">Centerfold (Plakát)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="inputAlbumFotograf">Fotograf (nepovinné)</label>
            <input type="text" id="inputAlbumFotograf" list="seznamFotografu" autocomplete="off" />
            <datalist id="seznamFotografu"></datalist>
          </div>
        </div>
        <div id="albumNazevGroup" class="form-group">
          <label for="inputAlbumName">Název alba</label>
          <input type="text" id="inputAlbumName" placeholder="např. Pictorial 1995-04" required />
        </div>
        <!-- Centerfold nemá název, určuje ho vydání časopisu; pictorial může k vydání patřit volitelně -->
        <div id="albumVydaniGroup" class="form-row form-row-3 hidden">
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
          <div class="form-group">
            <label for="selectAlbumEdice">Edice</label>
            <select id="selectAlbumEdice">${EDICE.map(e => `<option>${e}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-group">
          <label id="bulkLinksLabel">Vložte odkazy z Google Disku (libovolné množství)</label>
          <textarea id="inputBulkLinks" rows="3" placeholder="Vložte zkopírované odkazy z Disku (můžete vložit více odkazů naráz)..." required></textarea>
        </div>
        <div class="form-group">
          <label for="inputAlbumPopis">Průvodní text alba (nepovinné)</label>
          <textarea id="inputAlbumPopis" rows="3" placeholder="Text, který album v časopise uvádí"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
          <button type="submit" id="albumNextBtn" name="dalsi" value="1" class="btn btn-secondary" title="Okno zůstane otevřené a podrží modelku, fotografa a vydání">Uložit a přidat další</button>
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
        <div class="form-row form-row-3">
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
          <div class="form-group">
            <label for="selectCoverEdice">Edice</label>
            <select id="selectCoverEdice">${EDICE.map(e => `<option>${e}</option>`).join('')}</select>
          </div>
        </div>
        <div class="form-group">
          <label id="coverLinkLabel" for="inputCoverLink">Odkaz na cover z Google Disku</label>
          <input type="text" id="inputCoverLink" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
          <button type="submit" class="btn btn-primary">Uložit cover</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Nastavení, změna nebo zrušení hesla -->
  <div id="passModal" class="modal-overlay hidden">
    <div class="modal-card modal-narrow">
      <div class="modal-header">
        <h3 id="passModalTitle">Nastavit heslo</h3>
        <button id="closePassModalBtn" class="close-btn">&times;</button>
      </div>
      <form id="passForm">
        <div id="passOldGroup" class="form-group">
          <label for="inputPassOld">Stávající heslo</label>
          <input type="password" id="inputPassOld" autocomplete="off" />
        </div>
        <div class="form-group">
          <label id="passNewLabel" for="inputPassNew">Nové heslo</label>
          <input type="password" id="inputPassNew" autocomplete="off" />
        </div>
        <div class="form-group">
          <label for="inputPassNew2">Nové heslo znovu</label>
          <input type="password" id="inputPassNew2" autocomplete="off" />
        </div>
        <p class="pass-hint">Heslo se vyžádá při každém spuštění. Chrání rozhraní programu, soubor databáze na disku šifrovaný není.</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
          <button type="submit" class="btn btn-primary">Uložit</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Zámek: bez hesla se ze sbírky nic nenačte -->
  <div id="lockScreen" class="lock hidden">
    <form id="lockForm">
      <div class="lock-icon">&#128274;</div>
      <h3>Sbírka je zamčená</h3>
      <input type="password" id="inputLock" placeholder="Heslo" autocomplete="off" />
      <button type="submit" class="btn btn-primary">Odemknout</button>
      <p id="lockMsg"></p>
    </form>
  </div>

  <!-- Modal: Obnovení ze zálohy -->
  <div id="backupModal" class="modal-overlay hidden">
    <div class="modal-card modal-backup">
      <div class="modal-header">
        <h3>Obnovit ze zálohy</h3>
        <button class="close-btn" data-zavrit>&times;</button>
      </div>
      <p id="backupModalText" class="pass-hint"></p>
      <ul id="backupModalList" class="backup-list"></ul>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-zavrit>Zavřít</button>
      </div>
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
      <span id="lbHearts" title="Hodnocení fotky (klávesy 1–5, 0 ruší)"></span>
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
    <nav id="lbNav"></nav>
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
const coversList = document.getElementById('coversList');
const calList = document.getElementById('calList');
const issueView = document.getElementById('issueView');
const calendar = document.getElementById('calendar');
const stats = document.getElementById('stats');

// Vždy je vidět jeden pohled; profil modelky a stránka vydání mají v liště tlačítko zpět místo přepínače
function ukazatPohled(pohled) {
    [gallery, wall, covers, calendar, stats, detailView, issueView].forEach(p => p.classList.toggle('hidden', p !== pohled));
    const podstranka = pohled === detailView || pohled === issueView;
    backBtn.classList.toggle('hidden', !podstranka);
    document.getElementById('prevModelBtn').classList.toggle('hidden', pohled !== detailView);
    document.getElementById('nextModelBtn').classList.toggle('hidden', pohled !== detailView);
    document.getElementById('favBtn').classList.toggle('hidden', pohled !== gallery);
    viewToggle.classList.toggle('hidden', podstranka);
    backBtn.innerHTML = `&larr; ${{ modelky: 'Modelky', centerfoldy: 'Centerfoldy', covery: 'Covery', kalendar: 'Kalendář', prehled: 'Přehled' }[rezim]}`;
}
const viewToggle = document.getElementById('viewToggle');


// Dokud obsluha běží, další odeslání téhož formuláře se ignoruje a jeho tlačítko je vypnuté.
// Ukládání čeká na ověření odkazů po síti; druhý klik by jinak vložil fotky nebo modelku dvakrát.
function jednou(obsluha) {
    let bezi = false;
    return async (e) => {
        e?.preventDefault();
        if (bezi) return;
        const zdroj = e?.currentTarget;
        const tlacitko = e?.submitter || (zdroj?.tagName === 'BUTTON' ? zdroj : zdroj?.querySelector('[type="submit"]'));
        bezi = true;
        if (tlacitko) tlacitko.disabled = true;
        try {
            await obsluha(e);
        } finally {
            bezi = false;
            if (tlacitko) tlacitko.disabled = false;
        }
    };
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

// Odkaz na složku Disku program neumí rozbalit na fotky; místo „nefunkčního odkazu" řekne proč
function jeOdkazNaSlozku(text) {
    if (!/\/folders\//.test(text)) return false;
    oznamit('Odkaz vede na složku Disku. Vlož odkazy na jednotlivé fotky – složku program nerozbalí.');
    return true;
}

// Odkaz, který Disk nevrací jako obrázek, se neuloží
async function odkazJeVPoradku(odkaz) {
    if (!odkaz.trim()) return true;
    if (jeOdkazNaSlozku(odkaz)) return false;
    if (await OveritOdkaz(odkaz) !== 0) return true;
    oznamit('Tento odkaz nefunguje – soubor na Google Disku je smazaný, není sdílený „kdokoli s odkazem", nebo to není obrázek.');
    return false;
}




// Výřez titulní fotky: poloha v procentech a přiblížení kolem téhož bodu
function stylVyrezu({ coverZoom, coverX, coverY }) {
    return `object-position: ${coverX}% ${coverY}%; transform-origin: ${coverX}% ${coverY}%; transform: scale(${coverZoom});`;
}


// Každý přehled si pamatuje své hledání; text z Modelek by v kalendáři filtroval roky
const hledaniPodleRezimu = {};

function prepnoutRezim(novy) {
    if (novy !== rezim) {
        hledaniPodleRezimu[rezim] = searchInput.value;
        searchInput.value = hledaniPodleRezimu[novy] || '';
    }
    rezim = novy;
    viewToggle.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.rezim === novy));
    // Při příštím spuštění se program otevře ve stejném přehledu
    try { localStorage.setItem('posledniRezim', novy); } catch { /* bez úložiště se jen nezapamatuje */ }
    document.querySelector('main').scrollTop = 0;
}

// Hodnocení 1–5 srdíček; klik na N-té nastaví N, klik na současné hodnocení ho zruší
function htmlSrdicek(hodnoceni, atribut) {
    const srdicka = [1, 2, 3, 4, 5].map(n => `
        <button class="heart ${n <= hodnoceni ? 'on' : ''}" data-hodnota="${n}"
            title="${n === hodnoceni ? 'Zrušit hodnocení' : `Ohodnotit ${n} z 5`}"></button>`).join('');
    return `<span class="hearts ${hodnoceni ? 'rated' : ''}" ${atribut}>${srdicka}</span>`;
}

function htmlSrdicka(modelka) {
    return htmlSrdicek(modelka.hodnoceni, `data-hodnoceni="${modelka.id}"`);
}

// Srdíčka fotky; index míří do seznamu položek právě zobrazeného pohledu
function htmlSrdickaFotky(polozka, index) {
    return htmlSrdicek(polozka.hodnoceni, `data-hodnoceni-fotky="${index}"`);
}

async function ohodnotitPolozku(polozka, zvoleno) {
    const nove = zvoleno === polozka.hodnoceni ? 0 : zvoleno;
    if (!await SetHodnoceniFotek(polozka.fotky.map(f => f.id), nove)) return false;
    polozka.hodnoceni = nove;
    polozka.fotky.forEach(f => { f.hodnoceni = nove; });
    return true;
}

// Srdíčka na dlaždici fotky v profilu a na stránce vydání
document.querySelector('main').addEventListener('click', async (e) => {
    const srdicko = e.target.closest('[data-hodnoceni-fotky] .heart');
    if (!srdicko) return;
    const rada = srdicko.closest('.hearts');
    const naStranceVydani = Boolean(rada.closest('#issueView'));
    const polozka = (naStranceVydani ? vydaniPolozky : aktualniPolozky)[parseInt(rada.dataset.hodnoceniFotky)];
    if (!polozka || !await ohodnotitPolozku(polozka, parseInt(srdicko.dataset.hodnota))) return;

    // V profilu se fotky podle nového hodnocení hned přeřadí; stránka vydání by přitom odskočila nahoru
    if (naStranceVydani) rada.outerHTML = htmlSrdickaFotky(polozka, parseInt(rada.dataset.hodnoceniFotky));
    else nacistFotkyModelky(aktualniModelka.id);
});

// Srdíčka na kartě i v profilu
document.querySelector('main').addEventListener('click', async (e) => {
    const srdicko = e.target.closest('.hearts .heart');
    if (!srdicko) return;
    const rada = srdicko.closest('.hearts');
    const id = parseInt(rada.dataset.hodnoceni);
    const modelka = [aktualniModelka, ...nacteneModelky].find(m => m && m.id === id);
    if (!modelka) return;

    const zvoleno = parseInt(srdicko.dataset.hodnota);
    const nove = zvoleno === modelka.hodnoceni ? 0 : zvoleno;
    if (!await SetHodnoceni(id, nove)) return;

    // Tatáž modelka může být načtená v galerii i otevřená v profilu
    [aktualniModelka, ...nacteneModelky].filter(m => m && m.id === id).forEach(m => { m.hodnoceni = nove; });
    rada.outerHTML = htmlSrdicka(modelka);
    if (minHodnoceni && !gallery.classList.contains('hidden')) nacistGalerii(searchInput.value);
});

// Tlačítko v liště zvyšuje minimální hodnocení: vše -> 1+ -> … -> 5 -> vše
function vykreslitFiltrHodnoceni() {
    const tlacitko = document.getElementById('favBtn');
    tlacitko.classList.toggle('active', minHodnoceni > 0);
    tlacitko.innerHTML = minHodnoceni ? `&#9829; ${minHodnoceni}${minHodnoceni < 5 ? '+' : ''}` : '&#9825;';
    tlacitko.title = minHodnoceni
        ? `Zobrazeny modelky s hodnocením ${minHodnoceni}${minHodnoceni < 5 ? ' a více' : ''}. Klik: ${minHodnoceni < 5 ? 'přísnější' : 'zobrazit všechny'}.`
        : 'Zobrazit jen hodnocené modelky';
}

document.getElementById('favBtn').onclick = () => {
    minHodnoceni = (minHodnoceni + 1) % 6;
    nacistGalerii(searchInput.value);
};

// Předchozí a další modelka v pořadí, v jakém jsou v galerii
async function krokModelky(smer) {
    if (!aktualniModelka) return;
    let seznam = nacteneModelky;
    if (!seznam.some(m => m.id === aktualniModelka.id)) {
        seznam = nacteneModelky = await GetModelky('') || [];
    }
    const index = seznam.findIndex(m => m.id === aktualniModelka.id);
    if (index < 0 || seznam.length < 2) return;
    otevritDetailModelky(seznam[(index + smer + seznam.length) % seznam.length]);
}
document.getElementById('prevModelBtn').onclick = () => krokModelky(-1);
document.getElementById('nextModelBtn').onclick = () => krokModelky(1);

document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const zamestnano = detailView.classList.contains('hidden')
        || !lightbox.classList.contains('hidden')
        || document.querySelector('.modal-overlay:not(.hidden)')
        || e.target.closest('input, textarea, select');
    if (!zamestnano) krokModelky(e.key === 'ArrowRight' ? 1 : -1);
});


// Klik na údaj v profilu vyhledá všechny modelky se stejnou hodnotou
function hledatHodnotu(hodnota) {
    minHodnoceni = 0;
    prepnoutRezim('modelky');
    searchInput.value = hodnota;
    nacistGalerii(hodnota);
}

// Načtení Hlavní Galerie
// zMezipameti = jen přefiltrovat data načtená minule (psaní do hledání), nenačítat je znovu z databáze
async function nacistGalerii(dotaz = '', zMezipameti = false) {
    if (rezim === 'centerfoldy') return nacistStenu(dotaz, zMezipameti);
    if (rezim === 'covery') return nacistCovery(dotaz, zMezipameti);
    if (rezim === 'kalendar') return nacistKalendar(dotaz, zMezipameti);
    if (rezim === 'prehled') return nacistPrehled();

    const moje = ++cisloNacteni;
    const vsechny = await GetModelky(dotaz) || [];
    if (moje !== cisloNacteni) return;
    const modelky = vsechny.filter(m => m.hodnoceni >= minHodnoceni);
    // Se zapnutým filtrem jdou nejlépe hodnocené první, při shodě zůstává pořadí podle jména
    if (minHodnoceni) modelky.sort((a, b) => b.hodnoceni - a.hodnoceni);
    nacteneModelky = modelky;
    vykreslitFiltrHodnoceni();
    zrusitUpravuVyrezu = null;
    ukazatPohled(gallery);

    if (modelky.length === 0) {
        gallery.innerHTML = `<div class="empty-state">${
            minHodnoceni ? `Žádná modelka nemá hodnocení ${minHodnoceni}${minHodnoceni < 5 ? ' nebo vyšší' : ''}. Hodnotí se srdíčky na kartě nebo v profilu.`
            : dotaz.trim() ? 'Hledání neodpovídá žádná modelka.'
            : 'Zatím žádné modelky. Přidej první pravým tlačítkem myši.'}</div>`;
        return;
    }

    gallery.innerHTML = modelky.map(m => `
        <div class="card" data-id="${m.id}">
            <div class="card-image-wrap">
                <img src="${esc(adresaTitulni(m))}" alt="${esc(m.jmeno)}" style="${stylVyrezu(m)}" draggable="false" loading="lazy" />
                ${htmlSrdicka(m)}
            </div>
            <div class="card-info">
                <h3>${esc(m.jmeno)}</h3>
            </div>
        </div>
    `).join('');

    // Přidání kliku na kartu -> Otevření profilu modelky
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (card.classList.contains('editing') || e.target.closest('.hearts')) return;
            const id = parseInt(card.getAttribute('data-id'));
            const modelka = modelky.find(item => item.id === id);
            otevritDetailModelky(modelka);
        });
    });
}

// Otevření profilu modelky s fotogalerií
async function otevritDetailModelky(modelka) {
    // Opožděná odpověď přehledu, ze kterého se sem přišlo, už profil nesmí přepsat
    cisloNacteni++;
    aktualniModelka = modelka;
    ukazatPohled(detailView);
    // Dokud nejsou načtené fotky, není jasné, zda se ukáže titulní fotka, nebo centerfold
    document.getElementById('centerfoldsSide').innerHTML = '';
    detailView.classList.add('bez-titulni');
    document.querySelector('main').scrollTop = 0;

    const anoNe = hodnota => hodnota === 1 ? 'Ano' : hodnota === 0 ? 'Ne' : '';
    const hledatelne = hodnota => hodnota
        ? `<button class="link" data-hledat="${esc(hodnota)}" title="Vyhledat modelky se stejnou hodnotou">${esc(hodnota)}</button>`
        : '';
    // Vydání se odvozují z alb a centerfoldů; starší ručně psané údaje se ukážou, jen když odvozená chybí
    const prvniVydani = modelka.vydani.find(v => rozlozitVydani(v)?.mesic) || (rozlozitVydani(modelka.vystoupeni)?.mesic ? modelka.vystoupeni : '');
    const vydani = modelka.vydani.length
        ? modelka.vydani.map(v => `<button class="chip" data-vydani="${esc(v)}" title="Otevřít vydání">${esc(nazevVydani(v))}</button>`).join(' ')
        : esc([modelka.vystoupeni, ...modelka.pictorialVydani.split('\n')].map(v => v.trim()).filter(Boolean).join(', '));

    // [popisek, hotové HTML hodnoty]; prázdné řádky se nezobrazují
    const udaje = [
        ['Narození', esc([formatDatum(modelka.narozeniDatum), modelka.narozeniMisto].filter(Boolean).join(', '))],
        ['Věk při prvním vydání', esc(vekPriVydani(modelka.narozeniDatum, prvniVydani))],
        ['Národnost', hledatelne(modelka.narodnost)],
        ['Etnicita', esc(modelka.etnicita)],
        ['Výška', modelka.vyskaCm ? `${modelka.vyskaCm} cm` : ''],
        ['Váha', modelka.vahaKg ? `${modelka.vahaKg} kg` : ''],
        ['Vlasy', hledatelne(modelka.vlasyBarva)],
        ['Oči', hledatelne(modelka.ociBarva)],
        ['Míry', esc(modelka.miry)],
        ['Prsa', esc([modelka.velikostPrsou, modelka.prsaTyp].filter(Boolean).join(', '))],
        ['Ochlupení', esc(modelka.ochlupeni)],
        ['Tetování', anoNe(modelka.tetovani)],
        ['Piercing', anoNe(modelka.piercing)],
        ['Vydání', vydani],
        ['Role', esc(modelka.role)],
    ].filter(([, hodnota]) => hodnota);

    const tagy = modelka.tags.split(',').map(t => t.trim()).filter(Boolean);
    const dalsiJmena = modelka.dalsiJmena.split(',').map(j => j.trim()).filter(Boolean);

    document.getElementById('modelHeader').innerHTML = `
        <div class="profile-cover"><img src="${esc(adresaTitulni(modelka, true))}" alt="${esc(modelka.jmeno)}" style="${stylVyrezu(modelka)}" draggable="false" /></div>
        <h2>${esc(modelka.jmeno)}</h2>
        ${htmlSrdicka(modelka)}
        ${dalsiJmena.length ? `<p class="profile-aliases">také ${esc(dalsiJmena.join(', '))}</p>` : ''}
        <div class="profile-tags">${tagy.map(t => `<button class="tag" data-hledat="${esc(t)}" title="Vyhledat modelky s tímto tagem">${esc(t)}</button>`).join('')}</div>
        <dl class="profile-info">
            ${udaje.map(([nazev, hodnota]) => `<div><dt>${nazev}</dt><dd>${hodnota}</dd></div>`).join('')}
        </dl>
        ${modelka.poznamka ? `<p class="profile-note">${esc(modelka.poznamka)}</p>` : ''}
    `;

    nacistFotkyModelky(modelka.id);
}


// Průvodní text alba a fotograf; delší text je zkrácený a rozbaluje se kliknutím
function htmlPopisuAlba(a) {
    if (!a.popis && !a.fotograf) return '';
    return `
        <div class="album-desc">
            ${a.popis ? `<p class="album-desc-text">${esc(a.popis)}</p>
            <button class="link album-desc-more hidden" data-rozbalit>více</button>` : ''}
            ${a.fotograf ? `<p class="album-credit">Foto: <button class="link" data-hledat="${esc(a.fotograf)}" title="Vyhledat modelky, které fotil">${esc(a.fotograf)}</button></p>` : ''}
        </div>
    `;
}

// Tlačítko „více" má smysl jen u textu, který se do zkrácené podoby nevešel
function pripravitPopisy(pohled) {
    pohled.querySelectorAll('.album-desc-text').forEach(text => {
        text.nextElementSibling.classList.toggle('hidden', text.scrollHeight <= text.clientHeight + 1);
    });
}

document.querySelector('main').addEventListener('click', (e) => {
    const tlacitko = e.target.closest('[data-rozbalit]');
    if (!tlacitko) return;
    const rozbaleno = tlacitko.previousElementSibling.classList.toggle('open');
    tlacitko.textContent = rozbaleno ? 'méně' : 'více';
});

// Plakát: jedna nebo více stránek spojených bez mezer, volitelně otočený
// line = načíst až při přiblížení k oknu (dlouhé přehledy, kde je plakátů mnoho)
function htmlPlakatu(polozka, velikost, atributy = '', line = false) {
    return `
        <div class="poster" data-rot="${polozka.rotace}" ${atributy}>
            <div class="poster-inner">
                ${polozka.fotky.map(f => `<img src="${esc(f.url)}${velikost}" data-foto-id="${f.id}" draggable="false" ${line ? 'loading="lazy"' : ''} />`).join('')}
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
    // Při rychlém listování mezi modelkami může dorazit odpověď pro tu předchozí; její alba se nesmí ukázat
    // pod jménem jiné modelky, úpravy by pak šly na špatnou
    if (aktualniModelka?.id !== modelkaId) return;
    const photosGrid = document.getElementById('photosGrid');

    const centerfoldsSide = document.getElementById('centerfoldsSide');
    const prazdno = '<p class="empty-state">Tato modelka zatím nemá nahraná žádná alba. Přidej je pravým tlačítkem myši.</p>';

    aktualniAlba = sestavitAlba(fotky || []);
    // Alba v profilu chronologicky podle vydání, bez vydání na konci v pořadí, jak přibyla;
    // ruční přeřazení fotek uvnitř alba tak pořadí alb nemění
    const klicPoradi = a => {
        const v = rozlozitVydani(a.typ === 'Centerfold' ? a.album : a.vydani);
        return v ? `0${v.rok}${v.mesic || '00'}${v.edice}` : '1';
    };
    const prvniFotka = a => Math.min(...a.fotky.map(f => f.id));
    aktualniAlba.sort((x, y) => (y.typ === 'Centerfold') - (x.typ === 'Centerfold')
        || klicPoradi(x).localeCompare(klicPoradi(y)) || prvniFotka(x) - prvniFotka(y));
    // Pořadí pro prohlížeč: nejdřív centerfoldy z levého sloupce, potom alba
    aktualniPolozky = aktualniAlba.flatMap(a => a.polozky);

    const sklonovat = (n, jedna, dve, pet) => `${n} ${n === 1 ? jedna : n < 5 ? dve : pet}`;

    const htmlAlba = (a) => {
        const centerfold = a.typ === 'Centerfold';
        const popis = sklonovat(a.fotky.length, 'fotka', 'fotky', 'fotek');

        return `
            <section class="album" data-album="${aktualniAlba.indexOf(a)}" data-cast="${aktualniAlba.indexOf(a)}">
                ${centerfold ? '' : `
                    <div class="album-header">
                        <h4>${esc(nazevAlba(a.album, a.typ))}</h4>
                        <span>${esc(a.typ)} · ${popis}</span>
                        ${a.vydani ? `<button class="chip" data-vydani="${esc(a.vydani)}" title="Otevřít vydání">${esc(nazevVydani(a.vydani))}</button>` : ''}
                        <button class="album-more" data-nabidka-alba title="Akce alba (také pravým tlačítkem)">&#8943;</button>
                    </div>
                    ${htmlPopisuAlba(a)}
                `}
                <div class="${centerfold ? 'posters' : 'photos-grid'}" ${centerfold ? '' : atributyMrizky(a)}>
                    ${a.polozky.map(p => {
                        const index = aktualniPolozky.indexOf(p);
                        // Centerfold se zobrazuje celý jako plakát, ostatní fotky jako oříznuté dlaždice
                        return centerfold
                            ? htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index}"`)
                            : `<div class="photo-item" data-index="${index}" data-foto-id="${p.fotky[0].id}">
                                   <img src="${esc(p.fotky[0].url)}${VELIKOST_NAHLEDU}" loading="lazy" draggable="false" />
                                   ${htmlSrdickaFotky(p, index)}
                               </div>`;
                    }).join('')}
                </div>
                ${centerfold ? htmlPopisuAlba(a) : ''}
            </section>
        `;
    };

    const centerfoldy = aktualniAlba.filter(a => a.typ === 'Centerfold');
    const ostatni = aktualniAlba.filter(a => a.typ !== 'Centerfold');
    centerfoldsSide.innerHTML = centerfoldy.map(htmlAlba).join('');
    detailView.classList.toggle('bez-titulni', centerfoldy.length > 0);
    photosGrid.innerHTML = ostatni.map(htmlAlba).join('') || prazdno;

    // Lišta má smysl až od dvou alb; centerfoldy jsou v levém sloupci stále vidět
    listaAlb.naplnit(ostatni.map(a => ({ klic: aktualniAlba.indexOf(a), nazev: nazevAlba(a.album, a.typ), pocet: a.fotky.length })));

    detailView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(detailView);
    zkratitAlba(detailView);
    listaAlb.sledovat();
}

// Ruční pořadí fotek: dlaždice se v albu profilu přetáhne na nové místo
let tazenaFotka = null;
let praveTazeno = false;

function zrusitZnackyVlozeni() {
    document.querySelectorAll('.vlozit-pred, .vlozit-za').forEach(d => d.classList.remove('vlozit-pred', 'vlozit-za'));
}

document.getElementById('photosGrid').addEventListener('pointerdown', (e) => {
    const dlazdice = e.target.closest('.photo-item');
    if (e.button !== 0 || !dlazdice || dlazdice.classList.contains('dalsi') || e.target.closest('.hearts')) return;
    tazenaFotka = { dlazdice, x: e.clientX, y: e.clientY, tahne: false, cil: null, pred: false };
});

window.addEventListener('pointermove', (e) => {
    const t = tazenaFotka;
    if (!t) return;
    // Malý pohyb při kliknutí ještě není tažení
    if (!t.tahne) {
        if (Math.hypot(e.clientX - t.x, e.clientY - t.y) < 8) return;
        t.tahne = true;
        t.dlazdice.classList.add('tazena');
        document.body.classList.add('razeni');
    }
    zrusitZnackyVlozeni();
    const pod = document.elementFromPoint(e.clientX, e.clientY)?.closest('.photo-item');
    // Přesouvá se jen uvnitř téhož alba
    t.cil = pod && pod !== t.dlazdice && pod.parentElement === t.dlazdice.parentElement ? pod : null;
    if (!t.cil) return;
    const obdelnik = t.cil.getBoundingClientRect();
    t.pred = e.clientX < obdelnik.left + obdelnik.width / 2;
    t.cil.classList.add(t.pred ? 'vlozit-pred' : 'vlozit-za');
});

async function dokoncitTazeniFotky(zrusit = false) {
    const t = tazenaFotka;
    tazenaFotka = null;
    if (!t || !t.tahne) return;
    zrusitZnackyVlozeni();
    t.dlazdice.classList.remove('tazena');
    document.body.classList.remove('razeni');
    // Uvolnění tlačítka po tažení nesmí fotku otevřít
    praveTazeno = true;
    setTimeout(() => { praveTazeno = false; }, 0);
    if (zrusit || !t.cil) return;

    // Výchozí je pořadí, v jakém jsou fotky právě vidět; tím se z alba stává ručně seřazené
    const album = aktualniAlba[parseInt(t.dlazdice.closest('.album').dataset.album)];
    const ids = novePoradi(album.polozky.map(p => p.fotky[0].id),
        parseInt(t.dlazdice.dataset.fotoId), parseInt(t.cil.dataset.fotoId), t.pred);

    if (!await SetPoradiFotek(ids)) return;
    if (!album.rucniPoradi) oznamit('Album má teď ruční pořadí a podle srdíček se už nepřeskupuje. Zpět: pravé tlačítko na albu → Řadit album podle srdíček.');
    nacistFotkyModelky(aktualniModelka.id);
}
window.addEventListener('pointerup', () => dokoncitTazeniFotky());
window.addEventListener('pointercancel', () => dokoncitTazeniFotky(true));
window.addEventListener('blur', () => dokoncitTazeniFotky(true));

document.getElementById('photosGrid').addEventListener('click', (e) => {
    if (!praveTazeno) return;
    e.stopPropagation();
    e.preventDefault();
}, true);

// Posun stránky spojeného plakátu o jedno místo; smer -1 = dřív, 1 = později
async function posunoutStranku(album, fotka, smer) {
    const ids = album.fotky.map(f => f.id);
    const odkud = ids.indexOf(fotka.id);
    const kam = odkud + smer;
    if (kam < 0 || kam >= ids.length) return;
    [ids[odkud], ids[kam]] = [ids[kam], ids[odkud]];
    if (await SetPoradiFotek(ids)) nacistFotkyModelky(aktualniModelka.id);
}

// Dlouhé album ukazuje jen první řádky; poslední viditelná dlaždice nese počet skrytých fotek a album rozbalí
const RADKU_NAHLEDU = 2;
const rozbalenaAlba = new Set();
const atributyMrizky = a => `data-klic="${esc(klicAlba(a))}"`;

function zkratitAlba(pohled) {
    pohled.querySelectorAll('.photos-grid').forEach(mrizka => {
        // Počet sloupců jde zjistit jen u mřížky, která je vidět
        if (!mrizka.offsetParent) return;
        const dlazdice = [...mrizka.children];
        const limit = getComputedStyle(mrizka).gridTemplateColumns.split(' ').length * RADKU_NAHLEDU;
        const zkratit = dlazdice.length > limit && !rozbalenaAlba.has(mrizka.dataset.klic);

        dlazdice.forEach((d, i) => {
            d.classList.toggle('skryta', zkratit && i >= limit);
            d.classList.toggle('dalsi', zkratit && i === limit - 1);
            if (zkratit && i === limit - 1) d.dataset.dalsich = `+${dlazdice.length - limit}`;
        });
        mrizka.classList.toggle('zkracena', zkratit);
        mrizka.classList.toggle('rozbalena', dlazdice.length > limit && !zkratit);
    });
}

function prepnoutRozbaleniAlba(mrizka, rozbalit) {
    if (rozbalit) rozbalenaAlba.add(mrizka.dataset.klic);
    else rozbalenaAlba.delete(mrizka.dataset.klic);
    zkratitAlba(mrizka.parentElement);
    listaAlb.sledovat();
}

// Klik na dlaždici s počtem skrytých fotek album rozbalí, místo aby otevřel fotku
function rozbalitKliknute(e) {
    const dlazdice = e.target.closest('.photo-item.dalsi');
    if (dlazdice) prepnoutRozbaleniAlba(dlazdice.parentElement, true);
    return Boolean(dlazdice);
}

// Lišta částí: řádek tlačítek, který šipkami a ztrácejícími se okraji ukazuje, že pokračuje mimo okno.
// Používá ji profil modelky (alba), přehled coverů (ročníky), kalendář (desetiletí) a prohlížeč fotek (alba).
function vytvoritListu(nav, poKliku) {
    nav.className = 'album-nav hidden';
    nav.innerHTML = `
        <button class="album-nav-arrow" data-posun="-1" title="Předchozí">&#8249;</button>
        <div class="album-nav-list"></div>
        <button class="album-nav-arrow" data-posun="1" title="Další">&#8250;</button>`;
    const seznam = nav.querySelector('.album-nav-list');
    const [sipkaVlevo, sipkaVpravo] = nav.querySelectorAll('.album-nav-arrow');

    // Bez přetečení šipky nejsou vůbec
    const upravitSipky = () => {
        const presah = seznam.scrollWidth - seznam.clientWidth;
        const vlevo = seznam.scrollLeft > 1;
        const vpravo = seznam.scrollLeft < presah - 1;
        nav.classList.toggle('pretekla', presah > 1);
        seznam.classList.toggle('dalsi-vlevo', vlevo);
        seznam.classList.toggle('dalsi-vpravo', vpravo);
        sipkaVlevo.disabled = !vlevo;
        sipkaVpravo.disabled = !vpravo;
    };
    seznam.addEventListener('scroll', upravitSipky, { passive: true });

    nav.addEventListener('click', (e) => {
        const sipka = e.target.closest('[data-posun]');
        const skok = e.target.closest('[data-skok]');
        if (sipka) seznam.scrollBy({ left: parseInt(sipka.dataset.posun) * seznam.clientWidth * 0.8, behavior: 'smooth' });
        else if (skok) poKliku(skok.dataset.skok);
    });

    // Kolečko nad lištou ji posouvá do stran, když se do ní všechno nevejde
    nav.addEventListener('wheel', (e) => {
        if (seznam.scrollWidth <= seznam.clientWidth) return;
        e.preventDefault();
        e.stopPropagation();
        seznam.scrollLeft += e.deltaY || e.deltaX;
    }, { passive: false });

    return {
        nav,
        upravitSipky,
        // polozky: [{ klic, nazev, pocet }]; lišta má smysl až od dvou položek
        naplnit(polozky) {
            seznam.innerHTML = polozky.map(p => `
                <button class="chip" data-skok="${esc(p.klic)}" title="${esc(p.nazev)}"><b>${esc(p.nazev)}</b>${p.pocet === undefined ? '' : `<span>${p.pocet}</span>`}</button>`).join('');
            nav.classList.toggle('hidden', polozky.length < 2);
            upravitSipky();
        },
        oznacit(klic) {
            seznam.querySelectorAll('[data-skok]').forEach(tlacitko => {
                const aktivni = tlacitko.dataset.skok === String(klic);
                if (aktivni && !tlacitko.classList.contains('active')) {
                    // Zvýrazněná položka má být v liště vidět
                    seznam.scrollLeft = tlacitko.offsetLeft - (seznam.clientWidth - tlacitko.offsetWidth) / 2;
                }
                tlacitko.classList.toggle('active', aktivni);
            });
        },
    };
}

// Lišta nad rolovanou stránkou: skáče na její části (prvky s data-cast) a zvýrazňuje tu, která je právě nahoře
const hlavniOblast = document.querySelector('main');
const listyStranky = [];

function vytvoritListuStranky(nav, pohled) {
    const casti = () => [...pohled.querySelectorAll('[data-cast]')];
    const lista = vytvoritListu(nav, (klic) => {
        const cast = casti().find(c => c.dataset.cast === klic);
        if (!cast) return;
        const posun = cast.getBoundingClientRect().top - hlavniOblast.getBoundingClientRect().top - nav.offsetHeight - 8;
        hlavniOblast.scrollTo({ top: hlavniOblast.scrollTop + posun, behavior: 'smooth' });
    });
    lista.sledovat = () => {
        // Skrytá lišta ani lišta ve skrytém pohledu se nesleduje
        if (!nav.offsetParent) return;
        const hranice = nav.getBoundingClientRect().bottom + 40;
        const vsechny = casti();
        // Na konci stránky už poslední část výš nevyjede, i tak je to ta aktuální
        const naKonci = hlavniOblast.scrollTop > 0 && hlavniOblast.scrollTop >= hlavniOblast.scrollHeight - hlavniOblast.clientHeight - 1;
        const aktualni = naKonci ? vsechny.at(-1) : vsechny.filter(c => c.getBoundingClientRect().top <= hranice).pop() || vsechny[0];
        lista.oznacit(aktualni?.dataset.cast);
    };
    listyStranky.push(lista);
    return lista;
}

const listaAlb = vytvoritListuStranky(document.getElementById('albumNav'), document.getElementById('photosGrid'));
const listaCoveru = vytvoritListuStranky(document.getElementById('coversNav'), covers);
const listaKalendare = vytvoritListuStranky(document.getElementById('calNav'), calendar);

let cekaNaOznaceni = false;
hlavniOblast.addEventListener('scroll', () => {
    if (cekaNaOznaceni) return;
    cekaNaOznaceni = true;
    requestAnimationFrame(() => {
        cekaNaOznaceni = false;
        listyStranky.forEach(l => l.sledovat());
    });
}, { passive: true });

// Počet sloupců mřížky, a tím i počet fotek v náhledu, závisí na šířce okna
window.addEventListener('resize', () => {
    zkratitAlba(detailView);
    zkratitAlba(issueView);
    listyStranky.forEach(l => { l.sledovat(); l.upravitSipky(); });
});

// Stěna centerfoldů napříč všemi modelkami
let stenaData = null;

async function nacistStenu(dotaz = '', zMezipameti = false) {
    const moje = ++cisloNacteni;
    const fotky = zMezipameti && stenaData ? stenaData : await GetCenterfoldy() || [];
    stenaData = fotky;
    if (moje !== cisloNacteni) return;
    zrusitUpravuVyrezu = null;
    ukazatPohled(wall);

    const hledat = sjednotit(dotaz);
    const vyhovuje = f => !hledat || [f.jmenoModelky, f.album, nazevAlba(f.album, f.typ)].some(t => bezDiakritiky(t).includes(hledat));
    stenaPolozky = sestavitAlba(fotky.filter(vyhovuje)).flatMap(a => a.polozky);

    if (stenaPolozky.length === 0) {
        wall.innerHTML = `<div class="empty-state">${fotky.length ? 'Hledání neodpovídá žádný centerfold.' : 'Zatím žádné centerfoldy. Přidej je pravým tlačítkem myši.'}</div>`;
        return;
    }

    wall.innerHTML = stenaPolozky.map((p, i) => `
        <figure class="wall-item" data-index="${i}">
            ${htmlPlakatu(p, VELIKOST_PLAKATU_MALA, '', true)}
            <figcaption>
                <strong>${esc(p.jmenoModelky)}</strong>
                <span>${esc(nazevAlba(p.album, p.typ))}</span>
            </figcaption>
        </figure>
    `).join('');
    wall.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
}

// Covery časopisů seřazené od nejnovějšího vydání, po ročnících
let coveryData = null;

async function nacistCovery(dotaz = '', zMezipameti = false) {
    const moje = ++cisloNacteni;
    const [fotky, centerfoldy] = zMezipameti && coveryData ? coveryData : await Promise.all([GetCovery(), GetCenterfoldy()]);
    coveryData = [fotky, centerfoldy];
    if (moje !== cisloNacteni) return;
    zrusitUpravuVyrezu = null;
    ukazatPohled(covers);

    // Modelka z centerfoldu téhož vydání, pokud už je v databázi
    const playmate = new Map((centerfoldy || []).map(f => [f.album, f.jmenoModelky]));

    const hledat = sjednotit(dotaz);
    const vyhovuje = f => !hledat || [f.album, nazevAlba(f.album, f.typ), playmate.get(f.album) || ''].some(t => bezDiakritiky(t).includes(hledat));
    coveryPolozky = sestavitAlba((fotky || []).filter(vyhovuje)).flatMap(a => a.polozky);

    if (coveryPolozky.length === 0) {
        listaCoveru.naplnit([]);
        coversList.innerHTML = `<div class="empty-state">${fotky?.length ? 'Hledání neodpovídá žádný cover.' : 'Zatím žádné covery. Přidej je pravým tlačítkem myši.'}</div>`;
        return;
    }

    const rocniky = new Map();
    coveryPolozky.forEach((p, i) => {
        const rok = /^\d{4}/.exec(p.album)?.[0] || 'Ostatní';
        if (!rocniky.has(rok)) rocniky.set(rok, []);
        rocniky.get(rok).push(i);
    });

    listaCoveru.naplnit([...rocniky].map(([rok, indexy]) => ({ klic: rok, nazev: rok, pocet: indexy.length })));
    coversList.innerHTML = [...rocniky].map(([rok, indexy]) => `
        <section class="cover-year" data-cast="${esc(rok)}">
            <h3>${esc(rok)}</h3>
            <div class="covers-grid">
                ${indexy.map(i => {
                    const p = coveryPolozky[i];
                    return `
                        <figure class="cover-item" data-index="${i}">
                            ${htmlPlakatu(p, VELIKOST_PLAKATU_MALA, '', true)}
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
    listaCoveru.sledovat();
}

covers.addEventListener('click', (e) => {
    const polozka = e.target.closest('.cover-item');
    if (polozka) otevritVydani(coveryPolozky[parseInt(polozka.dataset.index)].album);
});

// Stránka vydání: vlevo cover, vpravo centerfold a pictorialy všech modelek z tohoto čísla
async function otevritVydani(vydani) {
    const moje = ++cisloNacteni;
    const fotky = await GetVydani(vydani) || [];
    if (moje !== cisloNacteni) return;
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
    // Ročník bez měsíce sdružuje jen pictorialy; cover ani centerfold nemá
    const jenRocnik = !rozlozitVydani(vydani)?.mesic;
    const odkazNaModelku = a => `<button class="chip" data-modelka="${a.modelkaId}" title="Otevřít profil modelky">${esc(a.jmenoModelky)}</button>`;
    const sklonovat = (n, jedna, dve, pet) => `${n} ${n === 1 ? jedna : n < 5 ? dve : pet}`;

    document.getElementById('issueSide').innerHTML = `
        <div class="posters">
            ${coveryVydani.flatMap(a => a.polozky).map(p => htmlPlakatu(p, VELIKOST_PLAKATU_MALA, `data-index="${index(p)}"`)).join('')
                || `<div class="profile-cover"><img src="${BEZ_FOTKY}" alt="Bez coveru" draggable="false" /></div>`}
        </div>
        <h2>${jenRocnik ? 'Ročník ' : ''}${esc(nazevVydani(vydani))}</h2>
        <div class="issue-add">
            ${jenRocnik ? '' : '<button class="chip" data-pridat="cover">+ cover</button><button class="chip" data-pridat="centerfold">+ centerfold</button>'}
            <button class="chip" data-pridat="pictorial">+ pictorial</button>
        </div>
        <dl class="profile-info">
            ${jenRocnik ? '' : `
            <div><dt>Cover</dt><dd>${coveryVydani.length ? 'Ano' : 'Zatím chybí'}</dd></div>
            <div><dt>Centerfold</dt><dd>${centerfoldy.map(a => esc(a.jmenoModelky)).join(', ') || 'Zatím chybí'}</dd></div>`}
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
                ${htmlPopisuAlba(a)}
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
                ${htmlPopisuAlba(a)}
                <div class="photos-grid" ${atributyMrizky(a)}>
                    ${a.polozky.map(p => `
                        <div class="photo-item" data-index="${index(p)}">
                            <img src="${esc(p.fotky[0].url)}${VELIKOST_NAHLEDU}" loading="lazy" draggable="false" />
                            ${htmlSrdickaFotky(p, index(p))}
                        </div>
                    `).join('')}
                </div>
            </section>
        `),
    ].join('') || '<p class="empty-state">K tomuto vydání zatím není přiřazený žádný centerfold ani pictorial. Centerfold se přiřadí měsícem a rokem, pictorial v úpravě alba.</p>';

    issueView.querySelectorAll('.poster').forEach(p => pripravitPlakat(p));
    pripravitPopisy(issueView);
    zkratitAlba(issueView);
}

// Přidávání přímo ze stránky vydání: vydání je předvyplněné, vybírá se jen modelka
issueView.addEventListener('click', (e) => {
    const pridat = e.target.closest('[data-pridat]')?.dataset.pridat;
    if (!pridat) return;
    e.stopPropagation();
    if (pridat === 'cover') otevritCoverModal(null, aktualniVydani);
    else if (pridat === 'centerfold') pridatCenterfold(aktualniVydani);
    else pridatPictorial(aktualniVydani);
});

issueView.addEventListener('click', (e) => {
    if (e.target.closest('[data-modelka], [data-vydani], .hearts') || rozbalitKliknute(e)) return;
    const polozka = e.target.closest('[data-index]');
    if (polozka) otevritLightbox(parseInt(polozka.dataset.index), false, vydaniPolozky);
});

// Kalendář vydání: roky × měsíce. Prázdná políčka ukazují, co ve sbírce chybí.
const ZKRATKY_MESICU = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

let kalendarData = null;

async function nacistKalendar(dotaz = '', zMezipameti = false) {
    const moje = ++cisloNacteni;
    const fotky = zMezipameti && kalendarData ? kalendarData : await GetPrehledVydani() || [];
    kalendarData = fotky;
    if (moje !== cisloNacteni) return;
    zrusitUpravuVyrezu = null;
    ukazatPohled(calendar);

    // Co je ke kterému vydání zvolené edice k dispozici
    const vydani = new Map();
    fotky.forEach(f => {
        // Pictorial přiřazený jen k ročníku nemá v kalendáři své políčko
        const casti = rozlozitVydani(f.vydani);
        if (!casti?.mesic || casti.edice !== kalendarEdice) return;
        const v = vydani.get(f.vydani) || { cover: null, centerfold: null, pictorial: null };
        if (f.typ === 'Cover') v.cover ??= f;
        else if (f.typ === 'Centerfold') v.centerfold ??= f;
        else v.pictorial ??= f;
        vydani.set(f.vydani, v);
    });

    const prepinacEdic = `<div class="cal-editions">${EDICE.map(e => `<button class="chip ${e === kalendarEdice ? 'active' : ''}" data-edice="${e}">${e}</button>`).join('')}</div>`;
    if (vydani.size === 0) {
        listaKalendare.naplnit([]);
        calList.innerHTML = prepinacEdic + `<div class="empty-state">V edici ${kalendarEdice} zatím nic není. Kalendář se naplní covery, centerfoldy a pictorialy, které mají měsíc a rok vydání; prázdné políčko se objeví u prvního přidaného čísla.</div>`;
        return;
    }

    const roky = [...vydani.keys()].map(v => parseInt(v.slice(0, 4)));
    const hledat = dotaz.trim();
    const radky = [];
    // Desetiletí pro lištu: kolik vydání v něm je; skáče se na jeho nejnovější rok
    const desetileti = new Map();
    for (let rok = Math.max(...roky); rok >= Math.min(...roky); rok--) {
        if (hledat && !String(rok).includes(hledat)) continue;

        let obsazeno = 0;
        const policka = ZKRATKY_MESICU.map((zkratka, i) => {
            const klic = slozitVydani(String(rok), String(i + 1).padStart(2, '0'), kalendarEdice);
            const v = vydani.get(klic);
            if (!v) {
                return `<button class="cal-cell empty" data-prazdne="${klic}" title="${nazevVydani(klic)} – chybí, klikni pro přidání"><span class="cal-month">${zkratka}</span></button>`;
            }
            obsazeno++;
            const obrazek = v.cover || v.centerfold || v.pictorial;
            const popis = [
                v.cover && 'cover',
                v.centerfold && `centerfold: ${v.centerfold.jmenoModelky}`,
                v.pictorial && 'pictorial',
            ].filter(Boolean).join(', ');
            return `
                <button class="cal-cell" data-vydani="${klic}" title="${esc(nazevVydani(klic))} – ${esc(popis)}">
                    <img src="${esc(obrazek.url)}=w300" loading="lazy" draggable="false" />
                    <span class="cal-month">${zkratka}</span>
                    <span class="cal-dots">
                        <i class="${v.cover ? 'on' : ''}"></i><i class="${v.centerfold ? 'on' : ''}"></i><i class="${v.pictorial ? 'on' : ''}"></i>
                    </span>
                </button>
            `;
        }).join('');

        const dekada = Math.floor(rok / 10) * 10;
        const prvniVDekade = !desetileti.has(dekada);
        desetileti.set(dekada, (desetileti.get(dekada) || 0) + obsazeno);

        radky.push(`
            <section class="cal-year" ${prvniVDekade ? `data-cast="${dekada}"` : ''}>
                <div class="cal-year-label"><strong>${rok}</strong><span>${obsazeno} z 12</span></div>
                <div class="cal-months">${policka}</div>
            </section>
        `);
    }

    listaKalendare.naplnit([...desetileti].map(([dekada, pocet]) => ({ klic: dekada, nazev: `${dekada}–${dekada + 9}`, pocet })));
    calList.innerHTML = prepinacEdic + `
        <p class="cal-legend">Tečky v políčku: <i class="on"></i> cover <i class="on"></i> centerfold <i class="on"></i> pictorial. Prázdné políčko = vydání ve sbírce chybí.</p>
        ${radky.join('') || '<div class="empty-state">Hledanému roku neodpovídá žádné vydání.</div>'}
    `;
    listaKalendare.sledovat();
}

// Kalendář ukazuje jednu edici; volba se pamatuje
let kalendarEdice = VYCHOZI_EDICE;
try { kalendarEdice = EDICE.includes(localStorage.getItem('kalendarEdice')) ? localStorage.getItem('kalendarEdice') : VYCHOZI_EDICE; } catch { /* výchozí edice */ }

function nastavitEdiciKalendare(edice) {
    if (!EDICE.includes(edice)) return;
    kalendarEdice = edice;
    try { localStorage.setItem('kalendarEdice', edice); } catch { /* jen se nezapamatuje */ }
}

// Co jde přidat k jednomu vydání; nabízí prázdné políčko kalendáře i pravé tlačítko na něm
const pridatKVydani = klic => [
    { text: `Přidat cover: ${nazevVydani(klic)}`, akce: () => otevritCoverModal(null, klic) },
    { text: `Přidat centerfold: ${nazevVydani(klic)}`, akce: () => pridatCenterfold(klic) },
    { text: `Přidat pictorial: ${nazevVydani(klic)}`, akce: () => pridatPictorial(klic) },
];

calendar.addEventListener('click', (e) => {
    const edice = e.target.closest('[data-edice]');
    if (edice) {
        nastavitEdiciKalendare(edice.dataset.edice);
        nacistKalendar(searchInput.value, true);
        return;
    }
    const prazdne = e.target.closest('[data-prazdne]');
    if (!prazdne) return;
    e.stopPropagation();
    const misto = prazdne.getBoundingClientRect();
    otevritKontextovouNabidku(misto.left, misto.bottom + 4, pridatKVydani(prazdne.dataset.prazdne));
});

// Přehled sbírky: kolik čeho je a co ještě chybí doplnit.
// Každá modelka a každé vydání má jeden řádek, sloupce říkají, co u nich chybí.
const NEJVYS_V_PREHLEDU = 60;
// Údaje modelky, které přehled hlídá, po skupinách shodných se záložkami formuláře: [vlastnost, název, pole formuláře].
// Další jména a poznámka se nehlídají, většina modelek je mít nemusí.
const SKUPINY_UDAJU = [
    { nazev: 'Základní údaje', zalozka: 0, udaje: [
        ['narozeniDatum', 'datum narození', 'inputNarozeniDatum'],
        ['narozeniMisto', 'místo narození', 'inputNarozeniMisto'],
        ['narodnost', 'národnost', 'inputNarodnost'],
        ['etnicita', 'etnicita', 'inputEtnicita'],
    ] },
    { nazev: 'Vzhled a míry', zalozka: 1, udaje: [
        ['vyskaCm', 'výška', 'inputVyska'],
        ['vahaKg', 'váha', 'inputVaha'],
        ['vlasyBarva', 'barva vlasů', 'inputVlasy'],
        ['ociBarva', 'barva očí', 'inputOci'],
        ['ochlupeni', 'ochlupení', 'selectOchlupeni'],
        ['tetovani', 'tetování', 'selectTetovani'],
        ['piercing', 'piercing', 'selectPiercing'],
        ['obvodHrudnikCm', 'hrudník', 'inputHrudnik'],
        ['obvodPasCm', 'pas', 'inputPas'],
        ['obvodBokyCm', 'boky', 'inputBoky'],
        ['velikostPrsou', 'velikost prsou', 'inputVelikost'],
        ['prsaTyp', 'typ prsou', 'selectPrsaTyp'],
    ] },
    { nazev: 'Zařazení', zalozka: 2, udaje: [
        ['role', 'role', 'inputRole'],
        ['tags', 'tagy', 'inputTags'],
    ] },
];


// Modelky a jejich nedoplněná alba pro akce v buňkách přehledu
let prehledModelky = new Map();
let prehledAlba = new Map();

async function nacistPrehled() {
    const moje = ++cisloNacteni;
    const [p, vsechnyModelky] = await Promise.all([GetPrehled(), GetModelky('')]);
    if (moje !== cisloNacteni) return;
    prehledModelky = new Map((vsechnyModelky || []).map(m => [m.id, m]));
    zrusitUpravuVyrezu = null;
    ukazatPohled(stats);

    const dlazdice = (cislo, popis) => `<div class="stat-tile"><strong>${cislo}</strong><span>${popis}</span></div>`;
    const ano = '<td class="ok" title="V pořádku">&#10003;</td>';
    // Buňka s chybějícím údajem je zároveň tlačítko, které ho nabídne doplnit
    const chybi = (akce, napoveda) => `<td class="chybi" data-akce="${akce}" title="${napoveda}">chybí</td>`;
    const NAPOVEDY = {
        titulni: 'Doplnit titulní fotku',
        centerfold: 'Přidat centerfold',
        hodnoceni: 'Otevřít profil a ohodnotit',
    };
    const zbytek = (pocet) => pocet > NEJVYS_V_PREHLEDU ? `<p class="stat-note">Zobrazeno prvních ${NEJVYS_V_PREHLEDU}, dalších ${pocet - NEJVYS_V_PREHLEDU} se ukáže, až tyto doplníš.</p>` : '';

    // Modelky: co chybí přímo u nich a kolik jejich alb nemá text nebo vydání
    const modelky = new Map();
    const radek = (m) => {
        if (!modelky.has(m.modelkaId)) modelky.set(m.modelkaId, { id: m.modelkaId, jmeno: m.jmeno, chybi: new Set(), bezPopisu: [], bezVydani: [] });
        return modelky.get(m.modelkaId);
    };
    [['titulni', p.bezTitulni], ['centerfold', p.bezCenterfoldu], ['hodnoceni', p.bezHodnoceni]]
        .forEach(([co, seznam]) => seznam.forEach(m => radek(m).chybi.add(co)));
    // Údaje z formuláře: které v každé skupině chybí
    prehledModelky.forEach(m => {
        const chybejici = SKUPINY_UDAJU.map(s => s.udaje.filter(([vlastnost]) => udajChybi(m, vlastnost)));
        if (chybejici.some(skupina => skupina.length)) radek({ modelkaId: m.id, jmeno: m.jmeno }).udaje = chybejici;
    });
    p.albaBezPopisu.forEach(a => radek(a).bezPopisu.push(a));
    p.albaBezVydani.forEach(a => radek(a).bezVydani.push(a));
    prehledAlba = new Map([...modelky].map(([id, m]) => [id, { popis: m.bezPopisu, vydani: m.bezVydani }]));

    const vaha = m => m.chybi.size + (m.bezPopisu.length ? 1 : 0) + (m.bezVydani.length ? 1 : 0)
        + (m.udaje || []).reduce((soucet, skupina) => soucet + skupina.length, 0);
    // Skupina údajů: počet chybějících, v nápovědě jejich výčet; klik otevře formulář na první z nich
    const skupina = (m, i) => {
        const chybejici = m.udaje?.[i] || [];
        if (!chybejici.length) return ano;
        const vse = chybejici.length === SKUPINY_UDAJU[i].udaje.length;
        return `<td class="chybi" data-akce="udaje" data-zalozka="${SKUPINY_UDAJU[i].zalozka}" data-pole="${chybejici[0][2]}"
            title="Chybí: ${esc(chybejici.map(u => u[1]).join(', '))}">${vse ? 'chybí vše' : `chybí ${chybejici.length} z ${SKUPINY_UDAJU[i].udaje.length}`}</td>`;
    };
    const radkyModelek = [...modelky.values()].sort((a, b) => vaha(b) - vaha(a) || a.jmeno.localeCompare(b.jmeno, 'cs'));
    const alba = (seznam, akce) => seznam.length
        ? `<td class="chybi" data-akce="${akce}" title="Doplnit: ${esc(seznam.map(a => nazevAlba(a.album, a.typ)).join(', '))}">${seznam.length}</td>`
        : ano;

    // Vydání, kterým chybí cover nebo centerfold
    const vydani = new Map();
    p.vydaniBezCoveru.forEach(v => vydani.set(v, { cover: true }));
    p.vydaniBezCenterfoldu.forEach(v => vydani.set(v, { ...vydani.get(v), centerfold: true }));
    const radkyVydani = [...vydani].sort(([a], [b]) => b.localeCompare(a));

    stats.innerHTML = `
        <div class="stat-tiles">
            ${dlazdice(p.modelek, 'modelek')}
            ${dlazdice(p.alb, 'alb')}
            ${dlazdice(p.fotek, 'fotek')}
            ${dlazdice(p.hodnocenychFotek, 'fotek se srdíčky')}
            ${dlazdice(p.coveru, 'coverů')}
            ${dlazdice(p.vydani, 'vydání')}
        </div>

        <section class="stat-section">
            <h3>Modelky <span>${p.modelek - radkyModelek.length} z ${p.modelek} má vše vyplněné</span></h3>
            ${radkyModelek.length ? `
            <table class="stat-table">
                <thead><tr>
                    <th>Modelka</th><th>Titulní fotka</th>${SKUPINY_UDAJU.map(s => `<th title="${esc(s.udaje.map(u => u[1]).join(', '))}">${s.nazev}</th>`).join('')}<th>Centerfold</th><th>Hodnocení</th>
                    <th title="Počet alb bez průvodního textu">Alba bez textu</th><th title="Počet alb bez přiřazeného vydání">Alba bez vydání</th>
                </tr></thead>
                <tbody>
                    ${radkyModelek.slice(0, NEJVYS_V_PREHLEDU).map(m => `
                        <tr data-modelka="${m.id}" title="Otevřít profil">
                            <th>${esc(m.jmeno)}</th>
                            ${m.chybi.has('titulni') ? chybi('titulni', NAPOVEDY.titulni) : ano}
                            ${SKUPINY_UDAJU.map((s, i) => skupina(m, i)).join('')}
                            ${['centerfold', 'hodnoceni'].map(co => m.chybi.has(co) ? chybi(co, NAPOVEDY[co]) : ano).join('')}
                            ${alba(m.bezPopisu, 'popis')}${alba(m.bezVydani, 'vydani')}
                        </tr>`).join('')}
                </tbody>
            </table>${zbytek(radkyModelek.length)}` : ''}
        </section>

        <section class="stat-section">
            <h3>Vydání <span>${p.vydani - radkyVydani.length} z ${p.vydani} má cover i centerfold</span></h3>
            ${radkyVydani.length ? `
            <table class="stat-table stat-table-narrow">
                <thead><tr><th>Vydání</th><th>Cover</th><th>Centerfold</th></tr></thead>
                <tbody>
                    ${radkyVydani.slice(0, NEJVYS_V_PREHLEDU).map(([v, co]) => `
                        <tr data-vydani="${esc(v)}" title="Otevřít vydání">
                            <th>${esc(nazevVydani(v))}</th>${co.cover ? chybi('cover', 'Přidat cover') : ano}${co.centerfold ? chybi('centerfold', 'Přidat centerfold') : ano}
                        </tr>`).join('')}
                </tbody>
            </table>${zbytek(radkyVydani.length)}` : ''}
        </section>

        ${p.rocniky.length ? `
        <section class="stat-section">
            <h3>Ročníky <span>které měsíce ve sbírce jsou</span></h3>
            <div class="stat-years">
                ${p.rocniky.map(r => `
                    <button class="stat-year" data-rocnik="${r.rok}" data-edice="${esc(r.edice)}" title="Zobrazit ročník ${r.rok} (${esc(r.edice)}) v kalendáři">
                        <strong>${r.rok}${r.edice !== VYCHOZI_EDICE ? ` <em>${esc(r.edice)}</em>` : ''}</strong><span>${r.vydani} z 12</span>
                        <span class="stat-months">${r.mesice.map((je, i) => `<i class="${je ? 'on' : ''}" title="${MESICE[i]}${je ? '' : ' – chybí'}"></i>`).join('')}</span>
                    </button>`).join('')}
            </div>
        </section>` : ''}

        ${p.podezrele.length ? `
        <section class="stat-section">
            <h3>Ke kontrole <span>údaje, které vypadají jako chyba při zadávání</span></h3>
            <table class="stat-table stat-table-text">
                <thead><tr><th>Modelka</th><th>Co zkontrolovat</th></tr></thead>
                <tbody>
                    ${p.podezrele.slice(0, NEJVYS_V_PREHLEDU).map(u => `
                        <tr data-modelka="${u.modelkaId}" title="Otevřít profil">
                            <th>${esc(u.jmeno)}</th><td class="stat-text">${esc(u.popis)}</td>
                        </tr>`).join('')}
                </tbody>
            </table>${zbytek(p.podezrele.length)}
        </section>` : ''}
    `;
}

// Klik na ročník ho ukáže v kalendáři
stats.addEventListener('click', (e) => {
    const dlazdice = e.target.closest('[data-rocnik]');
    if (!dlazdice) return;
    nastavitEdiciKalendare(dlazdice.dataset.edice);
    prepnoutRezim('kalendar');
    searchInput.value = dlazdice.dataset.rocnik;
    nacistGalerii(dlazdice.dataset.rocnik);
});

// Klik na buňku „chybí" otevře rovnou místo, kde se údaj doplňuje; klik jinam do řádku otevírá profil nebo vydání
stats.addEventListener('click', async (e) => {
    const bunka = e.target.closest('td[data-akce]');
    if (!bunka) return;
    e.stopPropagation();
    const radek = bunka.closest('tr');
    const akce = bunka.dataset.akce;

    if (radek.dataset.vydani) {
        // Vydání je dané, u centerfoldu se vybírá jen modelka
        if (akce === 'cover') otevritCoverModal(null, radek.dataset.vydani);
        else pridatCenterfold(radek.dataset.vydani);
        return;
    }

    const modelka = prehledModelky.get(parseInt(radek.dataset.modelka));
    if (!modelka) return;
    if (akce === 'titulni') {
        otevritModelModal(modelka);
        document.getElementById('inputDriveID').focus();
    } else if (akce === 'udaje') {
        // Formulář se otevře na záložce skupiny, s kurzorem v prvním chybějícím poli
        otevritModelModal(modelka);
        ukazatZalozku(parseInt(bunka.dataset.zalozka));
        document.getElementById(bunka.dataset.pole).focus();
    } else if (akce === 'centerfold') {
        otevritAlbumModal(modelka, null, { typ: 'Centerfold' });
        document.getElementById('selectAlbumMesic').focus();
    } else if (akce === 'hodnoceni') {
        otevritDetailModelky(modelka);
    } else {
        // První album, kterému text nebo vydání chybí, se otevře k úpravě v profilu modelky
        const cil = prehledAlba.get(modelka.id)?.[akce][0];
        await otevritDetailModelky(modelka);
        await nacistFotkyModelky(modelka.id);
        const album = cil && aktualniAlba.find(a => a.album === cil.album && a.typ === cil.typ);
        if (!album) return;
        otevritAlbumModal(modelka, album);
        document.getElementById(akce === 'popis' ? 'inputAlbumPopis' : 'selectAlbumMesic').focus();
    }
});

// Formulář coveru slouží pro přidání (polozka = null) i úpravu vydání
const coverModal = document.getElementById('coverModal');

function otevritCoverModal(polozka = null, predvyplnitVydani = '') {
    editovanyCover = polozka;
    document.getElementById('coverForm').reset();
    document.getElementById('coverModalTitle').textContent = polozka ? 'Upravit cover' : 'Přidat cover';
    document.getElementById('coverLinkLabel').textContent = polozka
        ? 'Nový odkaz z Google Disku (nepovinné, jinak zůstane původní obrázek)'
        : 'Odkaz na cover z Google Disku';
    document.getElementById('inputCoverLink').required = !polozka;

    const vydani = rozlozitVydani(polozka ? polozka.album : predvyplnitVydani);
    if (vydani?.mesic) {
        document.getElementById('inputCoverRok').value = vydani.rok;
        document.getElementById('selectCoverMesic').value = vydani.mesic;
    }
    // Bez předvyplněného vydání se nabídne edice zobrazená v kalendáři
    document.getElementById('selectCoverEdice').value = vydani?.edice || kalendarEdice;
    coverModal.classList.remove('hidden');
    // S předvyplněným vydáním zbývá jen vložit odkaz
    document.getElementById(vydani && !polozka ? 'inputCoverLink' : 'selectCoverMesic').focus();
}

document.getElementById('closeCoverModalBtn').onclick = () => coverModal.classList.add('hidden');
document.getElementById('coverForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    const vydani = slozitVydani(document.getElementById('inputCoverRok').value, document.getElementById('selectCoverMesic').value, document.getElementById('selectCoverEdice').value);
    const odkaz = document.getElementById('inputCoverLink').value;
    if (jeOdkazNaSlozku(odkaz)) return;

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
    stenaData = coveryData = kalendarData = null;
    // Cover se přidává z přehledu coverů, z kalendáře, z přehledu sbírky a ze stránky vydání
    if (!issueView.classList.contains('hidden')) otevritVydani(aktualniVydani);
    else nacistGalerii(searchInput.value);
});

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
    prepnoutRezim(tlacitko.dataset.rezim);
    nacistGalerii(searchInput.value);
});

// Prohlížeč fotek: šipky vlevo a vpravo listují, nahoru a dolů (PgUp, PgDn) skáčou mezi alby,
// mezerník spouští slideshow, F rozkládá plakát, R otáčí, Esc zavírá
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
    // Fotka, která se má vejít celá, nesmí zajíždět pod lištu alb
    const spodek = lbLista.nav.classList.contains('hidden') ? 16 : lbLista.nav.offsetHeight + 4;
    const meritko = lbRozlozeno
        ? Math.max(sw / r.W, sh / r.H)
        : Math.min((sw - 2 * okrajX) / r.W, (sh - LB_LISTA - spodek) / r.H);

    const w = r.W * meritko;
    const h = r.H * meritko;
    const presahX = Math.max(0, w - sw);
    const presahY = Math.max(0, h - sh);
    const left = presahX > 1 ? -lbPosun * presahX : (sw - w) / 2;
    const top = lbRozlozeno
        ? (presahY > 1 ? -lbPosun * presahY : (sh - h) / 2)
        : LB_LISTA + (sh - LB_LISTA - spodek - h) / 2;

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
    // Dokud není stažený originál, není známo, zda má fotka vyšší rozlišení; lupa ho na vyžádání načte
    const lupaDostupna = !lbPlne || lbMeritkoLupy() >= 1.15;
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

// Velikost obrázku pro prohlížení: podle delší strany okna, po krocích, aby drobná změna okna nestahovala znovu.
// Originál (často mnohonásobně větší) se stahuje až pro lupu.
function lbVelikost(polozka) {
    const strana = Math.max(lightbox.clientWidth, lightbox.clientHeight) * (window.devicePixelRatio || 1);
    // Rozložený centerfold přesahuje okno po délce
    const cil = polozka.typ === 'Centerfold' ? strana * 2 : strana;
    return `=s${Math.min(3200, Math.max(800, Math.ceil(cil / 400) * 400))}`;
}

let lbCekaNaOriginal = null; // místo, kde se má zapnout lupa, až dorazí originál

function lbNacistOriginal() {
    const plakat = lbPlakat;
    if (!plakat || plakat.dataset.original) return;
    plakat.dataset.original = '1';
    const obrazky = [...plakat.querySelectorAll('img')];
    lbPolozky[lbIndex].fotky.forEach((f, i) => {
        const plna = new Image();
        plna.onload = () => {
            if (lbPlakat !== plakat) return;
            obrazky[i].dataset.plne = '1';
            obrazky[i].src = plna.src;
        };
        plna.onerror = () => {
            if (lbPlakat !== plakat) return;
            lbCekaNaOriginal = null;
            delete plakat.dataset.original;
            lightbox.classList.remove('nacita');
            oznamit('Originál fotky se nepodařilo načíst.');
        };
        plna.src = f.url + PLNE_ROZLISENI;
    });
}

function lbPrepnoutLupu(zapnout, e) {
    if (!lbPlakat) return;
    if (zapnout && !lbPlne) {
        // Bez události myši (tlačítko v liště) se zvětší střed okna
        lbCekaNaOriginal = e ? { clientX: e.clientX, clientY: e.clientY } : { clientX: lightbox.clientWidth / 2, clientY: lightbox.clientHeight / 2 };
        lightbox.classList.add('nacita');
        lbNacistOriginal();
        return;
    }
    if (zapnout && lbMeritkoLupy() < 1.15) return;

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
    lbCekaNaOriginal = null;
    lbPosun = 0;
    lightbox.classList.remove('zoomed', 'nacita');
    // Centerfold se otevírá rovnou rozložený přes celé okno
    lbRozlozeno = polozka.typ === 'Centerfold';

    // Nejdřív náhled z mezipaměti, obrázek ve velikosti okna se doplní po načtení
    lbStage.innerHTML = htmlPlakatu(polozka, polozka.typ === 'Centerfold' ? VELIKOST_PLAKATU_MALA : VELIKOST_NAHLEDU);
    const plakat = lbStage.firstElementChild;
    lbPlakat = plakat;
    const obrazky = [...plakat.querySelectorAll('img')];

    pripravitPlakat(plakat, () => {
        if (lbPlakat !== plakat) return;
        lbPlne = obrazky.every(o => o.dataset.plne && o.complete && o.naturalWidth);
        // Lupa se po výměně za ostřejší obrázek nesmí rozhodit
        if (!lbLupa) lbRozvrhnout();
        // Lupa vyžádaná dřív, než dorazil originál, se zapne teď
        if (lbPlne && lbCekaNaOriginal) {
            const kde = lbCekaNaOriginal;
            lbCekaNaOriginal = null;
            lightbox.classList.remove('nacita');
            if (lbMeritkoLupy() >= 1.15) lbPrepnoutLupu(true, kde);
            else oznamit('Fotka nemá vyšší rozlišení, než v jakém je zobrazená.');
        }
    });

    const velikost = lbVelikost(polozka);
    polozka.fotky.forEach((f, i) => {
        const vetsi = new Image();
        vetsi.onload = () => {
            // Originál, který mezitím dorazil kvůli lupě, se menším obrázkem nepřepisuje
            if (lbPlakat !== plakat || obrazky[i].dataset.plne) return;
            obrazky[i].src = vetsi.src;
        };
        vetsi.src = f.url + velikost;
    });

    document.getElementById('lbCaption').textContent =
        [polozka.jmenoModelky, nazevAlba(polozka.album, polozka.typ), polozka.typ].filter(Boolean).join(' · ');
    document.getElementById('lbCounter').textContent = `${lbIndex + 1} / ${pocet}`;
    lbVykreslitSrdicka();
    lbLista.oznacit(lbZacatkyAlb().filter(i => i <= lbIndex).pop());
    lbAktualizovatTlacitka();

    // Přednačtení další položky, aby listování neproblikávalo
    const dalsi = lbPolozky[(lbIndex + 1) % pocet];
    dalsi.fotky.forEach(f => { new Image().src = f.url + lbVelikost(dalsi); });

    if (lbCasovac) lbSpustitCasovac();
}

function lbVykreslitSrdicka() {
    document.getElementById('lbHearts').innerHTML = htmlSrdicek(lbPolozky[lbIndex].hodnoceni, '');
}

// Hodnocení právě zobrazené fotky; pořadí v přehledu se podle něj upraví po zavření prohlížeče
async function lbOhodnotit(zvoleno) {
    const polozka = lbPolozky[lbIndex];
    if (!polozka || !await ohodnotitPolozku(polozka, zvoleno)) return;
    lbZmeneno = true;
    if (lbPolozky[lbIndex] === polozka) lbVykreslitSrdicka();
}

document.getElementById('lbHearts').addEventListener('click', (e) => {
    const srdicko = e.target.closest('.heart');
    if (srdicko) lbOhodnotit(parseInt(srdicko.dataset.hodnota));
});

// Indexy prvních fotek jednotlivých alb v právě prohlíženém seznamu
function lbZacatkyAlb() {
    return zacatkyAlb(lbPolozky);
}

// Skok na první fotku předchozího nebo dalšího alba
function lbSkokAlba(smer) {
    const zacatky = lbZacatkyAlb();
    if (zacatky.length < 2) return;
    const soucasne = zacatky.filter(i => i <= lbIndex).length - 1;
    lbZobrazit(zacatky[(soucasne + smer + zacatky.length) % zacatky.length]);
}

// Lišta alb dole v prohlížeči: ukazuje, ve kterém albu listování je, a skáče na jiné
const lbLista = vytvoritListu(document.getElementById('lbNav'), klic => lbZobrazit(parseInt(klic)));

function lbNaplnitListu() {
    const zacatky = lbZacatkyAlb();
    // Kde je každá položka vlastním albem (stěna centerfoldů, covery), by lišta jen opakovala fotky
    const maSmysl = zacatky.length > 1 && zacatky.length < lbPolozky.length;
    lbLista.naplnit(maSmysl ? zacatky.map((zacatek, i) => ({
        klic: zacatek,
        nazev: nazevAlba(lbPolozky[zacatek].album, lbPolozky[zacatek].typ),
        pocet: (zacatky[i + 1] ?? lbPolozky.length) - zacatek,
    })) : []);
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
    lbNaplnitListu();
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
    lbLista.upravitSipky();
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
        // Touchpad posílá desítky událostí na jedno gesto; listuje se nejvýš jednou za čtvrt vteřiny
        if (Date.now() - lbPosledniKrokKoleckem < 250) return;
        lbPosledniKrokKoleckem = Date.now();
        lbZobrazit(lbIndex + (e.deltaY > 0 ? 1 : -1));
    }
}, { passive: false });
let lbPosledniKrokKoleckem = 0;

// Odkazy na vydání a na modelku fungují v profilu i na stránce vydání
document.querySelector('main').addEventListener('click', (e) => {
    const vydani = e.target.closest('[data-vydani]');
    const modelka = e.target.closest('[data-modelka]');
    const hodnota = e.target.closest('[data-hledat]');
    if (vydani) otevritVydani(vydani.dataset.vydani);
    else if (modelka) otevritProfilPodleId(parseInt(modelka.dataset.modelka));
    else if (hodnota) hledatHodnotu(hodnota.dataset.hledat);
});

detailView.addEventListener('click', (e) => {
    if (e.target.closest('[data-vydani], .hearts') || rozbalitKliknute(e)) return;
    const polozka = e.target.closest('[data-index]');
    if (polozka) otevritLightbox(parseInt(polozka.dataset.index));
});

document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('hidden') || e.ctrlKey || e.altKey || e.metaKey) return;
    const klavesa = e.key.toLowerCase();
    if (klavesa === 'arrowright') lbZobrazit(lbIndex + 1);
    else if (klavesa === 'arrowleft') lbZobrazit(lbIndex - 1);
    else if (klavesa === 'arrowdown' || klavesa === 'pagedown') lbSkokAlba(1);
    else if (klavesa === 'arrowup' || klavesa === 'pageup') lbSkokAlba(-1);
    else if (/^[1-5]$/.test(klavesa)) lbOhodnotit(parseInt(klavesa));
    else if (klavesa === '0') lbOhodnotit(lbPolozky[lbIndex].hodnoceni);
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

// Okno přes celou obrazovku má ostré rohy, zakulacení by v rozích ukazovalo plochu
async function upravitRohyOkna() {
    const cele = await WindowIsMaximised() || await WindowIsFullscreen();
    document.getElementById('app').classList.toggle('cele-okno', cele);
}
window.addEventListener('resize', () => {
    upravitRohyOkna();
    // Stav okna se někdy změní až po události změny velikosti
    setTimeout(upravitRohyOkna, 250);
});
upravitRohyOkna();
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
    // Při úpravě se přibližuje až čtyřikrát, karta proto dostane větší obrázek
    if (modelka.coverUrl) img.src = modelka.coverUrl + VELIKOST_TITULNI;
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

// Stejná modelka se nemá omylem založit dvakrát; vrací, zda se má pokračovat
async function neniDuplicitni(modelka) {
    const jmena = m => [m.jmeno, ...(m.dalsiJmena || '').split(',')].map(sjednotit).filter(Boolean);
    const nova = jmena(modelka);
    const stejna = (await GetModelky('') || []).find(m => jmena(m).some(j => nova.includes(j)));
    return !stejna || potvrdit('Modelka už existuje', `V databázi už je modelka „${stejna.jmeno}" se stejným jménem nebo pseudonymem. Opravdu přidat další?`, 'Přesto přidat');
}

// Rychlé přidání: jen jméno, po uložení se rovnou otevře profil, kde se doplní fotky a údaje
const quickModal = document.getElementById('quickModal');

function otevritRychlePridani() {
    document.getElementById('quickForm').reset();
    quickModal.classList.remove('hidden');
    document.getElementById('inputQuickJmeno').focus();
}

document.getElementById('closeQuickModalBtn').onclick = () => quickModal.classList.add('hidden');
document.getElementById('quickMoreBtn').onclick = () => {
    const jmeno = document.getElementById('inputQuickJmeno').value;
    quickModal.classList.add('hidden');
    otevritModelModal(null);
    document.getElementById('inputJmeno').value = jmeno;
    oznacitVyplneneZalozky();
};
document.getElementById('quickForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    const modelka = { jmeno: document.getElementById('inputQuickJmeno').value.trim(), tetovani: -1, piercing: -1 };
    if (!modelka.jmeno || !await neniDuplicitni(modelka)) return;
    if (!await AddModelka(modelka)) {
        oznamit('Modelku se nepodařilo uložit do databáze.');
        return;
    }
    quickModal.classList.add('hidden');

    // Nově přidaná modelka má nejvyšší ID
    const nova = (await GetModelky('') || []).reduce((a, b) => (a && a.id > b.id ? a : b), null);
    if (nova) {
        prepnoutRezim('modelky');
        otevritDetailModelky(nova);
    }
});

// Pole formuláře modelky: [vlastnost modelky, id prvku, typ]
const poleModelky = [
    ['jmeno', 'inputJmeno', 'text'],
    ['dalsiJmena', 'inputDalsiJmena', 'text'],
    ['poznamka', 'inputPoznamka', 'text'],
    ['narozeniDatum', 'inputNarozeniDatum', 'text'],
    ['narozeniMisto', 'inputNarozeniMisto', 'text'],
    ['narodnost', 'inputNarodnost', 'text'],
    ['etnicita', 'inputEtnicita', 'text'],
    ['vyskaCm', 'inputVyska', 'cislo'],
    ['vahaKg', 'inputVaha', 'cislo'],
    ['vlasyBarva', 'inputVlasy', 'text'],
    ['ociBarva', 'inputOci', 'text'],
    ['ochlupeni', 'selectOchlupeni', 'text'],
    ['tetovani', 'selectTetovani', 'cislo'],
    ['piercing', 'selectPiercing', 'cislo'],
    ['obvodHrudnikCm', 'inputHrudnik', 'cislo'],
    ['obvodPasCm', 'inputPas', 'cislo'],
    ['obvodBokyCm', 'inputBoky', 'cislo'],
    ['velikostPrsou', 'inputVelikost', 'text'],
    ['prsaTyp', 'selectPrsaTyp', 'text'],
    ['role', 'inputRole', 'text'],
    ['tags', 'inputTags', 'text'],
    ['coverId', 'inputDriveID', 'text'],
];

// Míry z amerických zdrojů se po opuštění pole převedou na centimetry a kilogramy
document.getElementById('inputVyska').addEventListener('change', (e) => {
    const cm = prevestVysku(e.target.value);
    if (cm !== null) e.target.value = cm;
});
document.getElementById('inputVaha').addEventListener('change', (e) => {
    const kg = prevestVahu(e.target.value);
    if (kg !== null) e.target.value = kg;
});
// „34B-24-34" vložené do hrudníku nebo velikosti prsou vyplní všechny tři obvody i velikost
['inputHrudnik', 'inputVelikost'].forEach(id => document.getElementById(id).addEventListener('change', (e) => {
    const miry = rozlozitMiry(e.target.value);
    if (!miry) return;
    document.getElementById('inputHrudnik').value = miry.hrudnik;
    document.getElementById('inputPas').value = miry.pas;
    document.getElementById('inputBoky').value = miry.boky;
    if (miry.velikost) document.getElementById('inputVelikost').value = miry.velikost;
    else if (id === 'inputVelikost') document.getElementById('inputVelikost').value = '';
    oznacitVyplneneZalozky();
}));

// Formulář modelky slouží pro přidání (modelka = null) i úpravu
function otevritModelModal(modelka) {
    editovanaModelka = modelka;
    document.getElementById('addModelForm').reset();
    document.getElementById('modelModalTitle').textContent = modelka ? 'Upravit modelku' : 'Přidat novou modelku';
    document.querySelectorAll('#addModelForm option[data-puvodni]').forEach(o => o.remove());

    if (modelka) {
        poleModelky.forEach(([vlastnost, id, typ]) => {
            const prvek = document.getElementById(id);
            // Hodnota, kterou výběr nenabízí (typicky z importu), se do něj doplní; jinak by se zobrazila
            // jako prázdná a uložením by se smazala
            if (prvek.tagName === 'SELECT' && modelka[vlastnost] !== '' && ![...prvek.options].some(o => o.value === String(modelka[vlastnost]))) {
                prvek.add(new Option(String(modelka[vlastnost]), String(modelka[vlastnost])));
                prvek.lastElementChild.dataset.puvodni = '1';
            }
            // Výběr ano/ne/neuvedeno potřebuje i nulu, číselné pole nulu zobrazuje jako prázdné
            if (prvek.tagName === 'SELECT') prvek.value = String(modelka[vlastnost]);
            else if (typ === 'cislo') prvek.value = modelka[vlastnost] || '';
            else prvek.value = modelka[vlastnost];
        });
    }
    modelModal.classList.remove('hidden');
    ukazatZalozku(0);
    oznacitVyplneneZalozky();
    document.getElementById('inputJmeno').focus();
    naplnitNapovedu();
}

// Formulář modelky je rozdělený do záložek, aby se nemusel rolovat
const sekceFormulare = [...document.querySelectorAll('#addModelForm .form-section')];
const modelTabs = document.getElementById('modelTabs');
modelTabs.innerHTML = sekceFormulare.map((sekce, i) =>
    `<button type="button" data-zalozka="${i}">${esc(sekce.querySelector('h4').textContent)}<i></i></button>`).join('');

function ukazatZalozku(index) {
    sekceFormulare.forEach((sekce, i) => sekce.classList.toggle('active', i === index));
    modelTabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === index));
    document.querySelector('#modelModal .form-body').scrollTop = 0;
}

// Tečka u záložky, ve které už je něco vyplněno
function oznacitVyplneneZalozky() {
    sekceFormulare.forEach((sekce, i) => {
        const vyplneno = [...sekce.querySelectorAll('input, select, textarea')]
            .some(p => p.value.trim() && p.value !== '-1');
        modelTabs.children[i].classList.toggle('filled', vyplneno);
    });
}

modelTabs.addEventListener('click', (e) => {
    const zalozka = e.target.closest('[data-zalozka]');
    if (zalozka) ukazatZalozku(parseInt(zalozka.dataset.zalozka));
});
document.getElementById('addModelForm').addEventListener('input', oznacitVyplneneZalozky);

// Našeptávání: hodnoty už zapsané u jiných modelek, doplněné o několik obvyklých
async function naplnitNapovedu() {
    const modelky = await GetModelky('') || [];
    const seznamy = [
        ['seznamVlasy', m => m.vlasyBarva, ['Blond', 'Hnědá', 'Černá', 'Zrzavá']],
        ['seznamOci', m => m.ociBarva, ['Modrá', 'Hnědá', 'Zelená', 'Šedá']],
        ['seznamNarodnost', m => m.narodnost, []],
        ['seznamEtnicita', m => m.etnicita, []],
        ['seznamMisto', m => m.narozeniMisto, []],
        ['seznamRole', m => m.role, []],
    ];
    seznamy.forEach(([id, hodnota, obvykle]) => {
        const hodnoty = new Map();
        [...modelky.map(hodnota), ...obvykle].forEach(h => {
            if (sjednotit(h) && !hodnoty.has(sjednotit(h))) hodnoty.set(sjednotit(h), h.trim());
        });
        document.getElementById(id).innerHTML = [...hodnoty.values()]
            .sort((a, b) => a.localeCompare(b, 'cs'))
            .map(h => `<option value="${esc(h)}"></option>`).join('');
    });

    // Tagy se přidávají kliknutím, protože pole jich obsahuje víc najednou
    const tagy = new Map();
    modelky.flatMap(m => m.tags.split(',')).forEach(t => {
        if (sjednotit(t) && !tagy.has(sjednotit(t))) tagy.set(sjednotit(t), t.trim());
    });
    document.getElementById('tagyNapoveda').innerHTML = [...tagy.values()]
        .sort((a, b) => a.localeCompare(b, 'cs'))
        .map(t => `<button type="button" class="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('');
}

document.getElementById('tagyNapoveda').addEventListener('click', (e) => {
    const tag = e.target.closest('[data-tag]')?.dataset.tag;
    if (!tag) return;
    const pole = document.getElementById('inputTags');
    const soucasne = pole.value.split(',').map(t => t.trim()).filter(Boolean);
    if (!soucasne.some(t => sjednotit(t) === sjednotit(tag))) soucasne.push(tag);
    pole.value = soucasne.join(', ');
});

const deleteModal = document.getElementById('deleteModal');

// Potvrzovací okno pro nevratné mazání; akce se provede až po potvrzení
function otevritDeleteModal(nadpis, text, akce, poDokonceni = () => nacistGalerii(searchInput.value)) {
    potvrzenaAkce = async () => {
        if (await akce() === false) oznamit('Smazání se nepodařilo, nic se nezměnilo.');
        poDokonceni();
    };
    document.getElementById('confirmDeleteBtn').textContent = 'Smazat';
    document.getElementById('deleteModalTitle').textContent = nadpis;
    document.getElementById('deleteModalText').textContent = text;
    deleteModal.classList.remove('hidden');
}

// Obecná otázka ano/ne ve stejném okně; vrací, zda uživatel potvrdil
function potvrdit(nadpis, text, popisTlacitka) {
    return new Promise((vyreseno) => {
        potvrzenaAkce = () => { zrusenaAkce = null; vyreseno(true); };
        zrusenaAkce = () => vyreseno(false);
        document.getElementById('confirmDeleteBtn').textContent = popisTlacitka;
        document.getElementById('deleteModalTitle').textContent = nadpis;
        document.getElementById('deleteModalText').textContent = text;
        deleteModal.classList.remove('hidden');
    });
}

function zavritDeleteModal() {
    zrusenaAkce?.();
    zrusenaAkce = null;
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
document.getElementById('confirmDeleteBtn').onclick = jednou(async () => {
    if (!potvrzenaAkce) return;
    // Potvrzeno: zavření okna už nesmí akci ohlásit jako zrušenou
    const akce = potvrzenaAkce;
    zrusenaAkce = null;
    await akce();
    zavritDeleteModal();
});

// Formulář alba slouží pro přidání fotek (album = null) i úpravu alba ({ album, typ })
// Přidání centerfoldu ze stěny plakátů: modelka se jen vybere ze seznamu už zadaných
// Centerfold mimo profil (stěna, vydání, kalendář, přehled): modelka se vybírá v okně, vydání může být dané
function pridatCenterfold(vydani = '') {
    otevritAlbumModal(null, null, { vyberModelky: true, typ: 'Centerfold', vydani, nadpis: 'Přidat centerfold' });
}

function pridatPictorial(vydani = '') {
    otevritAlbumModal(null, null, { vyberModelky: true, typ: 'Pictorial', vydani, nadpis: 'Přidat pictorial' });
}

// Modelka podle jména z okna alba; neznámé jméno založí novou
async function vybratNeboZalozitModelku(jmeno) {
    jmeno = jmeno.trim();
    if (!jmeno) {
        oznamit('Napiš jméno modelky.');
        return null;
    }
    const najit = async () => (await GetModelky('') || []).filter(m => sjednotit(m.jmeno) === sjednotit(jmeno)).sort((a, b) => b.id - a.id)[0];
    const znama = await najit();
    if (znama) return znama;
    if (!await AddModelka({ jmeno, tetovani: -1, piercing: -1 })) {
        oznamit('Modelku se nepodařilo založit.');
        return null;
    }
    return await najit();
}

// Centerfold se místo názvu určuje měsícem a rokem vydání
function prepnoutPoleAlba() {
    const centerfold = document.getElementById('selectTyp').value === 'Centerfold';
    document.getElementById('albumNazevGroup').classList.toggle('hidden', centerfold);
    document.getElementById('albumVydaniGroup').classList.remove('hidden');
    // U pictorialu je vydání nepovinné
    // U pictorialu stačí i samotný rok
    document.getElementById('albumMesicLabel').textContent = centerfold ? 'Měsíc vydání' : 'Měsíc (nepovinné)';
    document.getElementById('albumRokLabel').textContent = centerfold ? 'Rok vydání' : 'Rok (nepovinné)';
    document.getElementById('inputAlbumName').required = !centerfold;
    document.getElementById('selectAlbumMesic').required = centerfold;
    document.getElementById('inputAlbumRok').required = centerfold;
}

document.getElementById('selectTyp').addEventListener('change', prepnoutPoleAlba);

// moznosti: vyberModelky (modelka se vybírá v okně), typ a vydani (předvyplnění), nadpis
function otevritAlbumModal(modelka, album = null, moznosti = {}) {
    modelkaAlba = modelka;
    editovaneAlbum = album;
    document.getElementById('addAlbumForm').reset();
    document.getElementById('albumModelkaGroup').classList.toggle('hidden', !moznosti.vyberModelky);
    document.getElementById('albumModelkaNova').textContent = '';
    // „Uložit a přidat další" má smysl jen při přidávání
    document.getElementById('albumNextBtn').classList.toggle('hidden', Boolean(album));
    document.getElementById('albumModalTitle').textContent = moznosti.nadpis || (album ? 'Upravit album' : 'Přidat fotky do alba');
    document.getElementById('albumSubmitBtn').textContent = album ? 'Uložit album' : 'Uložit fotky';
    document.getElementById('bulkLinksLabel').textContent = album
        ? 'Přidat další fotky – odkazy z Google Disku (nepovinné)'
        : 'Vložte odkazy z Google Disku (libovolné množství)';
    // Při úpravě alba není nutné přidávat další fotky
    document.getElementById('inputBulkLinks').required = !album;

    // S předem daným typem (centerfold, pictorial) se typ nevybírá
    document.getElementById('albumTypGroup').classList.toggle('hidden', Boolean(moznosti.typ));

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
        document.getElementById('inputAlbumFotograf').value = album.fotograf || '';
        document.getElementById('inputAlbumPopis').value = album.popis || '';

    }
    if (moznosti.typ) vyberTypu.value = moznosti.typ;
    const vydani = rozlozitVydani(album ? (album.vydani || (album.typ === 'Centerfold' ? album.album : '')) : moznosti.vydani);
    document.getElementById('inputAlbumRok').value = vydani?.rok || '';
    document.getElementById('selectAlbumMesic').value = vydani?.mesic || '';
    document.getElementById('selectAlbumEdice').value = vydani?.edice || kalendarEdice;
    prepnoutPoleAlba();

    // Našeptávání fotografů z celé sbírky, aby se stejné jméno psalo vždy stejně
    GetFotografove().then(fotografove => {
        document.getElementById('seznamFotografu').innerHTML = (fotografove || []).map(f => `<option value="${esc(f)}"></option>`).join('');
    });
    if (moznosti.vyberModelky) {
        GetModelky('').then(modelky => {
            document.getElementById('seznamModelekAlba').innerHTML = (modelky || []).map(m => `<option value="${esc(m.jmeno)}"></option>`).join('');
        });
        document.getElementById('inputAlbumModelka').value = modelka?.jmeno || '';
    }
    albumModal.classList.remove('hidden');
    document.getElementById(moznosti.vyberModelky ? 'inputAlbumModelka' : moznosti.typ ? (moznosti.typ === 'Centerfold' ? 'selectAlbumMesic' : 'inputAlbumName') : 'selectTyp').focus();
}

// Nápověda, že napsané jméno zatím ve sbírce není a uložením vznikne nová modelka
document.getElementById('inputAlbumModelka').addEventListener('input', (e) => {
    const jmeno = sjednotit(e.target.value);
    const znama = [...document.querySelectorAll('#seznamModelekAlba option')].some(o => sjednotit(o.value) === jmeno);
    document.getElementById('albumModelkaNova').textContent = jmeno && !znama ? 'Nová modelka – uložením se založí.' : '';
});

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
let nedostupnychPodezreleMnoho = false;

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

    // Mnoho nedostupných najednou bývá výpadek nebo omezení požadavků na straně Googlu, ne smazané soubory
    nedostupnychPodezreleMnoho = vysledek.nedostupne.length >= 10 && vysledek.nedostupne.length > vysledek.zkontrolovano * 0.1;
    text.textContent = `Zkontrolováno souborů: ${vysledek.zkontrolovano}. Nedostupných: ${vysledek.nedostupne.length} – na Disku jsou smazané nebo už nejsou sdílené.${neovereno}`
        + (nedostupnychPodezreleMnoho ? ' To je podezřele mnoho najednou: vypadá to spíš na výpadek nebo omezení ze strany Googlu. Zkus kontrolu později znovu, než něco odebereš.' : '');
    seznam.innerHTML = vysledek.nedostupne.map(n => {
        const kde = n.fotoId === 0
            ? `titulní fotka (změň ji přes Editovat)`
            : `${n.typ} · ${nazevAlba(n.album, n.typ)}`;
        return `<li><strong>${esc(n.jmeno || 'Cover časopisu')}</strong><span>${esc(kde)}</span></li>`;
    }).join('');

    // Titulní fotky se neodebírají, modelka by zůstala bez obrázku bez vědomí uživatele
    nedostupneFotky = vysledek.nedostupne.filter(n => n.fotoId !== 0);
    odebrat.classList.toggle('hidden', nedostupneFotky.length === 0);
    odebrat.textContent = nedostupnychPodezreleMnoho
        ? `Přesto odebrat z databáze (${nedostupneFotky.length})…`
        : `Odebrat nedostupné z databáze (${nedostupneFotky.length})`;
}

function zavritKontrolu() {
    checkModal.classList.add('hidden');
}

document.getElementById('closeCheckModalBtn').onclick = zavritKontrolu;
document.getElementById('checkCloseBtn').onclick = zavritKontrolu;
document.getElementById('checkRemoveBtn').onclick = jednou(async () => {
    if (nedostupnychPodezreleMnoho && !await potvrdit('Odebrat nedostupné fotky',
        `Opravdu odebrat ${nedostupneFotky.length} fotek z databáze? Je jich podezřele mnoho najednou; pokud jde jen o výpadek Disku, přijdeš o jejich zařazení do alb, pořadí i srdíčka. Před odebráním se uloží záloha.`, 'Přesto odebrat')) return;

    // Jedna záloha a jedno odebrání pro všechny
    if (!await DeleteFotografieHromadne(nedostupneFotky.map(n => n.fotoId))) {
        oznamit('Odebrání se nepodařilo, nic se nezměnilo.');
        return;
    }
    oznamit(`Odebráno fotek: ${nedostupneFotky.length}. Záloha před odebráním je ve složce ${await SlozkaZaloh()}`);
    nedostupneFotky = [];
    zavritKontrolu();
    if (!detailView.classList.contains('hidden')) nacistFotkyModelky(aktualniModelka.id);
    else nacistGalerii(searchInput.value);
});

// Export celé sbírky do souboru YAML, který jde upravovat v textovém editoru
async function exportovatData() {
    const cesta = await ExportovatDoSouboru();
    if (cesta) oznamit(`Sbírka je uložená v souboru ${cesta}`);
}

// Import ze souboru YAML: doplňuje a opravuje, nic nemaže
async function importovatData() {
    const cesta = await VybratSouborImportu();
    if (!cesta) return;
    const soubor = cesta.split('/').pop();
    if (!await potvrdit('Importovat sbírku', `Načíst data ze souboru „${soubor}“? Stávající modelky a alba se doplní a opraví, nové se přidají, nic se nemaže. Před importem se uloží záloha.`, 'Importovat')) return;

    const v = await ImportovatZeSouboru(cesta);
    if (v.selhalo) {
        oznamit(v.selhalo, { text: 'Rozumím', akce: () => {} });
        return;
    }
    const shrnuti = `Import hotov. Nové modelky: ${v.noveModelky}, upravené: ${v.upraveneModelky}, alba: ${v.alba}, nové fotky: ${v.noveFotky}.`;
    // Co se nepodařilo převzít, zůstane vidět, dokud to uživatel nezavře
    if (v.chyby.length) oznamit(`${shrnuti} Přeskočeno (${v.chyby.length}): ${v.chyby.slice(0, 5).join('; ')}${v.chyby.length > 5 ? '; …' : ''}`, { text: 'Rozumím', akce: () => {} });
    else oznamit(shrnuti);
    prepnoutRezim('modelky');
    nacistGalerii(searchInput.value);
}

// Heslo: nastavení, změna a zrušení. Chrání rozhraní, databáze na disku šifrovaná není.
const passModal = document.getElementById('passModal');

function otevritHeslo() {
    document.getElementById('passForm').reset();
    document.getElementById('passModalTitle').textContent = maZamek ? 'Změnit nebo zrušit heslo' : 'Nastavit heslo';
    document.getElementById('passOldGroup').classList.toggle('hidden', !maZamek);
    document.getElementById('passNewLabel').textContent = maZamek ? 'Nové heslo (prázdné zámek zruší)' : 'Nové heslo';
    passModal.classList.remove('hidden');
    document.getElementById(maZamek ? 'inputPassOld' : 'inputPassNew').focus();
}

document.getElementById('closePassModalBtn').onclick = () => passModal.classList.add('hidden');
document.getElementById('passForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    const nove = document.getElementById('inputPassNew').value;
    if (nove !== document.getElementById('inputPassNew2').value) {
        oznamit('Nové heslo a jeho zopakování se liší.');
        return;
    }
    if (!nove && !maZamek) {
        oznamit('Zadej heslo, kterým se má program zamykat.');
        return;
    }
    if (!await NastavitHeslo(document.getElementById('inputPassOld').value, nove)) {
        oznamit('Stávající heslo nesouhlasí, nic se nezměnilo.');
        return;
    }
    maZamek = Boolean(nove);
    passModal.classList.add('hidden');
    oznamit(maZamek ? 'Heslo je nastavené, vyžádá se při příštím spuštění.' : 'Zámek je zrušený.');
});

// Zamčený program neukáže nic ze sbírky, dokud heslo nesouhlasí
function odemknoutPriStartu() {
    const obrazovka = document.getElementById('lockScreen');
    const pole = document.getElementById('inputLock');
    const zprava = document.getElementById('lockMsg');
    zamceno = true;
    document.getElementById('app').classList.add('zamceno');
    obrazovka.classList.remove('hidden');
    pole.focus();

    return new Promise((odemceno) => {
        document.getElementById('lockForm').onsubmit = async (e) => {
            e.preventDefault();
            zprava.textContent = 'Ověřuji…';
            if (!await Odemknout(pole.value)) {
                zprava.textContent = 'Heslo nesouhlasí.';
                pole.select();
                return;
            }
            pole.value = '';
            zamceno = false;
            document.getElementById('app').classList.remove('zamceno');
            obrazovka.classList.add('hidden');
            odemceno();
        };
    });
}

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

// Správa sbírky: stejné položky nabízí pravé tlačítko na volném místě galerie i tlačítko ⋯ v hlavičce
function polozkySpravy() {
    return [
        { text: 'Obnovit zobrazení', akce: () => nacistGalerii(searchInput.value) },
        { text: 'Zkontrolovat soubory na Disku', akce: () => zkontrolovatSoubory() },
        { text: 'Vymazat mezipaměť obrázků', akce: vymazatMezipamet },
        null,
        { text: 'Obnovit ze zálohy…', akce: otevritZalohy },
        { text: 'Otevřít složku se zálohami', akce: async () => BrowserOpenURL('file://' + await SlozkaZaloh()) },
        { text: 'Exportovat sbírku (YAML)…', akce: exportovatData },
        { text: 'Importovat sbírku (YAML)…', akce: importovatData },
        null,
        { text: maZamek ? 'Změnit nebo zrušit heslo…' : 'Nastavit heslo…', akce: otevritHeslo },
        // Nové načtení okna znovu vyžádá heslo
        ...(maZamek ? [{ text: 'Zamknout', akce: () => window.location.reload() }] : []),
        null,
        { text: 'Smazat celou databázi', akce: smazatDatabazi },
    ];
}

// Tlačítka v hlavičce otevírají tutéž nabídku jako pravé tlačítko, jen pod sebou
function nabidkaPodTlacitkem(e, polozky) {
    e.stopPropagation();
    const misto = e.currentTarget.getBoundingClientRect();
    otevritKontextovouNabidku(misto.left, misto.bottom + 4, polozky);
}

document.getElementById('addBtn').onclick = (e) => {
    const vProfilu = !detailView.classList.contains('hidden');
    const naVydani = !issueView.classList.contains('hidden');
    nabidkaPodTlacitkem(e, [
        ...(vProfilu ? [{ text: `Přidat fotky / album: ${aktualniModelka.jmeno}`, akce: () => otevritAlbumModal(aktualniModelka) }, null] : []),
        { text: 'Přidat modelku', akce: otevritRychlePridani },
        // Centerfold a cover se po uložení vracejí do přehledu, proto se z profilu a ze stránky vydání nenabízejí
        ...(vProfilu || naVydani ? [] : [
            { text: 'Přidat centerfold', akce: pridatCenterfold },
            { text: 'Přidat cover', akce: () => otevritCoverModal() },
        ]),
    ]);
};

document.getElementById('menuBtn').onclick = (e) => {
    const vProfilu = !detailView.classList.contains('hidden');
    nabidkaPodTlacitkem(e, [
        ...(vProfilu ? [
            { text: `Upravit modelku: ${aktualniModelka.jmeno}`, akce: () => otevritModelModal(aktualniModelka) },
            { text: 'Smazat modelku', akce: () => smazatModelku(aktualniModelka) },
            null,
        ] : []),
        ...polozkySpravy(),
    ]);
};

document.getElementById('editModelBtn').onclick = () => otevritModelModal(aktualniModelka);

// Tlačítko ⋯ v hlavičce alba otevře tutéž nabídku jako pravé tlačítko na albu
document.getElementById('photosGrid').addEventListener('click', (e) => {
    const tlacitko = e.target.closest('[data-nabidka-alba]');
    if (!tlacitko) return;
    e.stopPropagation();
    const misto = tlacitko.getBoundingClientRect();
    tlacitko.parentElement.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: misto.left, clientY: misto.bottom + 4 }));
});

// Obnovení ze zálohy: seznam záloh s počty, aby šlo poznat, ke které se vrátit
const NAZVY_ZALOH = {
    'denni': 'Denní záloha',
    'pred-smazanim-alba': 'Před smazáním alba',
    'pred-smazanim-modelky': 'Před smazáním modelky',
    'pred-smazanim-databaze': 'Před smazáním databáze',
    'pred-odebranim-fotek': 'Před odebráním fotek',
    'pred-importem': 'Před importem',
    'pred-obnovenim': 'Před obnovením',
    'pred-migraci': 'Před úpravou databáze',
};
const backupModal = document.getElementById('backupModal');
const casZalohy = z => `${formatDatum(z.cas.slice(0, 10))} ${z.cas.slice(11, 16)}`;

async function otevritZalohy() {
    const zalohy = await SeznamZaloh() || [];
    document.getElementById('backupModalText').textContent = zalohy.length
        ? 'Databáze se vrátí do stavu vybrané zálohy. Současný stav se předtím uloží jako další záloha, takže jde vrátit i obnovení. Heslo zůstane současné.'
        : 'Zatím není žádná záloha. Vzniká jednou denně při spuštění a před každým mazáním a importem.';
    document.getElementById('backupModalList').innerHTML = zalohy.map(z => `
        <li>
            <strong>${esc(casZalohy(z))}</strong>
            <span>${esc(NAZVY_ZALOH[z.duvod] || z.duvod)} · ${z.poskozena ? 'nejde přečíst' : `modelek ${z.modelek}, fotek ${z.fotek}`}</span>
            <button class="btn btn-secondary btn-small" data-obnovit="${esc(z.soubor)}" data-popis="${esc(casZalohy(z))}" ${z.poskozena ? 'disabled' : ''}>Obnovit</button>
        </li>`).join('');
    backupModal.classList.remove('hidden');
}

document.getElementById('backupModalList').addEventListener('click', async (e) => {
    const tlacitko = e.target.closest('[data-obnovit]');
    if (!tlacitko || tlacitko.disabled) return;
    if (!await potvrdit('Obnovit ze zálohy', `Vrátit databázi do stavu z ${tlacitko.dataset.popis}? Vše, co bylo změněno potom, zmizí; současný stav se ale předtím uloží jako záloha „Před obnovením“.`, 'Obnovit')) return;

    // Druhý klik během obnovování nesmí spustit další
    tlacitko.disabled = true;
    const chyba = await ObnovitZalohu(tlacitko.dataset.obnovit);
    if (chyba) {
        tlacitko.disabled = false;
        oznamit(chyba, { text: 'Rozumím', akce: () => {} });
        return;
    }
    backupModal.classList.add('hidden');
    stenaData = coveryData = kalendarData = null;
    prepnoutRezim('modelky');
    searchInput.value = '';
    nacistGalerii();
    oznamit(`Databáze je obnovená do stavu z ${tlacitko.dataset.popis}.`);
});

document.addEventListener('contextmenu', (e) => {
    // V textových polích a v modálních oknech vlastní nabídku nezobrazujeme
    if (e.target.closest('input, textarea, select')) return;
    e.preventDefault();
    if (zamceno) return;
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
                polozky.push({
                    text: 'Nastavit jako titulní fotku',
                    akce: async () => {
                        if (!await SetTitulniFotka(aktualniModelka.id, fotka.id)) return;
                        oznamit('Titulní fotka změněna. Výřez na kartě se vrátil na výchozí.');
                        otevritProfilPodleId(aktualniModelka.id);
                    },
                });
                polozky.push({ text: album.spojit ? 'Odebrat tuto stránku' : 'Odebrat fotku', akce: () => smazatFotku(fotka) });
                // Stránky spojeného plakátu se nedají přetáhnout, řadí se po jedné
                if (album.spojit) {
                    const misto = album.fotky.indexOf(fotka);
                    if (misto > 0) polozky.push({ text: 'Posunout stránku dřív', akce: () => posunoutStranku(album, fotka, -1) });
                    if (misto < album.fotky.length - 1) polozky.push({ text: 'Posunout stránku později', akce: () => posunoutStranku(album, fotka, 1) });
                }
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
        if (album.rucniPoradi && !centerfold) {
            polozky.push({
                text: 'Řadit album podle srdíček',
                akce: async () => {
                    await ZrusitPoradiAlba(aktualniModelka.id, album.album, album.typ);
                    nacistFotkyModelky(aktualniModelka.id);
                },
            });
        }
        const mrizka = e.target.closest('.album').querySelector('.photos-grid.zkracena, .photos-grid.rozbalena');
        if (mrizka) {
            const zkracena = mrizka.classList.contains('zkracena');
            polozky.push({ text: zkracena ? 'Rozbalit album' : 'Sbalit album', akce: () => prepnoutRozbaleniAlba(mrizka, zkracena) });
        }
        polozky.push(
            { text: 'Spustit slideshow alba', akce: () => otevritLightbox(aktualniPolozky.indexOf(album.polozky[0]), true) },
            { text: 'Upravit album / přidat fotky', akce: () => otevritAlbumModal(aktualniModelka, album) },
            { text: 'Smazat album', akce: () => smazatAlbum(album, album.fotky.length) },
            null,
            { text: 'Editovat modelku', akce: () => otevritModelModal(aktualniModelka) }
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
            { text: 'Editovat modelku', akce: () => otevritModelModal(aktualniModelka) },
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
    } else if (!calendar.classList.contains('hidden')) {
        // Kalendář vydání
        const obsazene = e.target.closest('[data-vydani]');
        const prazdne = e.target.closest('[data-prazdne]');
        polozky = [];
        if (obsazene) polozky.push({ text: `Otevřít vydání ${nazevVydani(obsazene.dataset.vydani)}`, akce: () => otevritVydani(obsazene.dataset.vydani) });
        if (obsazene || prazdne) {
            const klic = (obsazene || prazdne).dataset.vydani || prazdne.dataset.prazdne;
            polozky.push(...pridatKVydani(klic), null);
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

    otevritKontextovouNabidku(e.clientX, e.clientY, polozky);
});

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

// Zavření modálního okna klávesou Esc nebo tlačítkem Zrušit; potvrzovací okno přitom ohlásí zrušení
function zavritOkno(okno) {
    if (okno === deleteModal) zavritDeleteModal();
    else okno.classList.add('hidden');
}
document.addEventListener('click', (e) => {
    const zrusit = e.target.closest('[data-zavrit]');
    if (zrusit) zavritOkno(zrusit.closest('.modal-overlay'));
});

// Formulář: Přidat Modelku
document.getElementById('addModelForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    // Údaje, které ve formuláři nejsou (míry bez obvodů, starší textová vydání), zůstávají při úpravě původní
    const modelka = editovanaModelka
        ? { ...editovanaModelka }
        : { id: 0, miry: '', vystoupeni: '', pictorialVydani: '' };
    poleModelky.forEach(([vlastnost, id, typ]) => {
        const prvek = document.getElementById(id);
        if (typ === 'cislo') modelka[vlastnost] = parseInt(prvek.value) || 0;
        else modelka[vlastnost] = prvek.value.trim();
    });
    // Pole, které neopustil (a nepřevedlo se), se převede teď
    modelka.vyskaCm = prevestVysku(document.getElementById('inputVyska').value) ?? modelka.vyskaCm;
    modelka.vahaKg = prevestVahu(document.getElementById('inputVaha').value) ?? modelka.vahaKg;
    // Neúplné datum narození (jen rok) pole pro datum neumí zobrazit; prázdné pole ho proto nesmí smazat
    const puvodniDatum = editovanaModelka?.narozeniDatum || '';
    if (!modelka.narozeniDatum && puvodniDatum && !/^\d{4}-\d{2}-\d{2}$/.test(puvodniDatum)) modelka.narozeniDatum = puvodniDatum;

    // Jméno je jediný povinný údaj; leží na první záložce, která nemusí být zrovna vidět
    if (!modelka.jmeno) {
        ukazatZalozku(0);
        document.getElementById('inputJmeno').focus();
        oznamit('Vyplň jméno modelky.');
        return;
    }
    if (!await odkazJeVPoradku(modelka.coverId)) {
        ukazatZalozku(0);
        return;
    }

    if (!editovanaModelka && !await neniDuplicitni(modelka)) return;

    const ulozeno = editovanaModelka ? await UpdateModelka(modelka) : await AddModelka(modelka);
    if (!ulozeno) {
        oznamit('Modelku se nepodařilo uložit do databáze.');
        return;
    }
    modelModal.classList.add('hidden');
    // Úprava z profilu se vrací do profilu, jinak do přehledu
    if (editovanaModelka && !detailView.classList.contains('hidden')) otevritProfilPodleId(editovanaModelka.id);
    else nacistGalerii(searchInput.value);
});

// Formulář: Hromadné fotky do alba
document.getElementById('addAlbumForm').onsubmit = jednou(async (e) => {
    e.preventDefault();
    const typ = document.getElementById('selectTyp').value;
    const rok = document.getElementById('inputAlbumRok').value;
    const mesic = document.getElementById('selectAlbumMesic').value;
    // Pictorialu stačí ročník, měsíc bez roku ale nedává smysl
    if (mesic && !rok) {
        oznamit('K měsíci vydání chybí rok.');
        return;
    }
    const links = document.getElementById('inputBulkLinks').value;
    if (jeOdkazNaSlozku(links)) return;

    // Modelka vybraná v okně; neznámé jméno založí novou
    if (!document.getElementById('albumModelkaGroup').classList.contains('hidden')) {
        const vybrana = await vybratNeboZalozitModelku(document.getElementById('inputAlbumModelka').value);
        if (!vybrana) return;
        modelkaAlba = vybrana;
    }
    const modelka = modelkaAlba;
    const vydani = slozitVydani(rok, mesic, document.getElementById('selectAlbumEdice').value);
    const album = typ === 'Centerfold' ? vydani : document.getElementById('inputAlbumName').value.trim();

    if (editovaneAlbum && !await UpdateAlbum(modelka.id, editovaneAlbum.album, editovaneAlbum.typ, album, typ)) {
        oznamit('Album se nepodařilo uložit. Modelka už nejspíš má jiné album se stejným názvem a typem.');
        return;
    }
    if (links.trim()) {
        oznamitVlozeni(await AddBulkPhotos(modelka.id, album, typ, links), 'fotek');
    }
    // Centerfold má vydání přímo v názvu alba, ostatním se přiřazuje zvlášť
    // Při přidávání fotek do existujícího alba prázdné pole jeho vydání nemaže; zrušit ho jde jen úpravou alba
    if (typ !== 'Centerfold' && (editovaneAlbum || vydani)) {
        await SetVydaniAlba(modelka.id, album, typ, vydani);
    }
    // Při přidávání fotek do existujícího alba prázdná pole jeho text nemažou
    const popis = document.getElementById('inputAlbumPopis').value;
    const fotograf = document.getElementById('inputAlbumFotograf').value;
    if (editovaneAlbum || popis.trim() || fotograf.trim()) {
        await SetPopisAlba(modelka.id, album, typ, popis, fotograf);
    }

    if (e.submitter?.name === 'dalsi' && !editovaneAlbum) {
        // Další album téže modelky: modelka, typ, fotograf a vydání zůstávají, vyprázdní se jen název, odkazy a text
        ['inputAlbumName', 'inputBulkLinks', 'inputAlbumPopis'].forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById(typ === 'Centerfold' ? 'inputBulkLinks' : 'inputAlbumName').focus();
    } else {
        albumModal.classList.add('hidden');
        document.getElementById('addAlbumForm').reset();
    }
    obnovitPoUlozeniAlba(modelka);
});

// Po uložení alba se obnoví to, co je vidět
function obnovitPoUlozeniAlba(modelka) {
    stenaData = coveryData = kalendarData = null;
    if (!detailView.classList.contains('hidden')) {
        if (aktualniModelka?.id === modelka.id) nacistFotkyModelky(modelka.id);
    } else if (!wall.classList.contains('hidden')) nacistStenu(searchInput.value);
    // Z přehledu se doplňuje centerfold; po uložení má z tabulky zmizet
    else if (!stats.classList.contains('hidden')) nacistPrehled();
    else if (!issueView.classList.contains('hidden')) otevritVydani(aktualniVydani);
    else if (!calendar.classList.contains('hidden')) nacistKalendar(searchInput.value);
}

// Hledání se spouští až po krátké pauze v psaní; v Přehledu se nehledá
let casovacHledani = null;
searchInput.addEventListener('input', () => {
    clearTimeout(casovacHledani);
    casovacHledani = setTimeout(() => {
        if (rezim !== 'prehled') nacistGalerii(searchInput.value, true);
    }, 180);
});
// Chyby z backendu se ukazují v okně, ne jen v konzoli
EventsOn('chyba', (zprava) => oznamit(zprava));
StavDatabaze().then((chyba) => {
    if (chyba) oznamit(chyba, { text: 'Rozumím', akce: () => {} });
});

// Spuštění: nejdřív případný zámek, potom přehled, ve kterém se program naposledy zavřel
(async () => {
    maZamek = await MaZamek();
    if (maZamek) await odemknoutPriStartu();

    let posledni = null;
    try { posledni = localStorage.getItem('posledniRezim'); } catch { /* bez úložiště začne galerií */ }
    if (viewToggle.querySelector(`[data-rezim="${posledni}"]`)) prepnoutRezim(posledni);
    nacistGalerii();
    kontrolaPoSpusteni();
})();