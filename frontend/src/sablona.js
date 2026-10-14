// Kostra okna: hlavička, pohledy, modální okna, prohlížeč fotek. Obsah pohledů se vykresluje v main.js.
import { MESICE, EDICE } from './lib/format';

export const SABLONA_OKNA = `
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
      <input type="text" id="searchInput" placeholder="Hledat…" title="Modelky: jméno, národnost, vlasy, míry, tagy… Více slov zužuje výběr. Cíleně: vlasy:blond, oci:, narodnost:, tag:, role:, fotograf:&quot;arny freytag&quot;, rok:1975, narozena:1990, edice:CZ. Centerfoldy a covery: jméno nebo vydání." />
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
    <!-- Lišta písmen: skok na první modelku daného písmene -->
    <nav id="galleryNav"></nav>
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
          <button type="submit" id="modelNextBtn" class="btn btn-secondary hidden" title="Uloží a otevře další modelku z tabulky Přehledu na stejné záložce">Uložit a další</button>
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

  <!-- Modal: výběr nebo zadání jedné hodnoty (modelka, album, nové jméno) -->
  <div id="pickModal" class="modal-overlay hidden">
    <div class="modal-card modal-narrow">
      <div class="modal-header">
        <h3 id="pickModalTitle"></h3>
        <button class="close-btn" data-zavrit>&times;</button>
      </div>
      <form id="pickForm">
        <p id="pickModalText" class="pass-hint"></p>
        <div class="form-group">
          <label id="pickModalLabel" for="inputPick"></label>
          <input type="text" id="inputPick" list="seznamPick" autocomplete="off" />
          <datalist id="seznamPick"></datalist>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
          <button type="submit" id="pickSubmitBtn" class="btn btn-primary"></button>
        </div>
      </form>
    </div>
  </div>

  <!-- Lišta s akcemi pro vybrané fotky (Ctrl nebo Shift + klik) -->
  <div id="selectionBar" class="selection-bar hidden">
    <span id="selectionCount"></span>
    <span class="selection-hearts">${[1, 2, 3, 4, 5].map(n => `<button class="heart on" data-vyber-hodnoceni="${n}" title="Ohodnotit vybrané ${n} z 5"></button>`).join('')}</span>
    <button class="btn btn-secondary btn-small" data-vyber="presunout">Přesunout do alba…</button>
    <button class="btn btn-secondary btn-small" data-vyber="odebrat">Odebrat</button>
    <button class="btn btn-secondary btn-small" data-vyber="zrusit">Zrušit výběr</button>
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
