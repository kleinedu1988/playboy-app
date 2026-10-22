// Kostra okna: hlavička, pohledy, modální okna, prohlížeč fotek. Obsah pohledů se vykresluje v main.js.
import { MESICE, EDICE } from './lib/format';
import { htmlKostryKaret } from './ui/kostra';

export const SABLONA_OKNA = `
  <header class="navbar">
    <!-- Horní řádek: šipky na další modelku, hledání a tlačítka okna; slouží i k přesouvání okna -->
    <div class="titulek-okna">
      <div class="logo">
        <button id="backBtn" class="nav-back hidden" title="Zpět (Esc)">&larr; Modelky</button>
        <button id="prevModelBtn" class="nav-back nav-step hidden" title="Předchozí modelka (šipka vlevo)">&#8249;</button>
        <button id="nextModelBtn" class="nav-back nav-step hidden" title="Další modelka (šipka vpravo)">&#8250;</button>
      </div>
      <!-- Hledání přesně uprostřed šířky okna -->
      <div class="nav-controls">
        <label class="hledani">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
          <input type="text" id="searchInput" placeholder="Hledat modelku…" title="Modelky: jméno, národnost, vlasy, míry, tagy… Více slov zužuje výběr. Cíleně: vlasy:blond, oci:, narodnost:, tag:, kategorie:muse, fotograf:&quot;arny freytag&quot;, rok:1975, narozena:1990, edice:CZ, vyska:175, tetovani:ano, obalka:1995, hodnoceni:5. Do hledání skočíš klávesami Ctrl+F." />
          <kbd class="hledani-zkratka" aria-hidden="true">Ctrl F</kbd>
          <button type="button" id="searchClearBtn" class="hledani-smazat" title="Smazat hledání" aria-label="Smazat hledání">&times;</button>
        </label>
        <!-- Rychlé výsledky pod hledáním: modelky, články (i v textu) a čísla; plní je app/naseptavac.js -->
        <div id="naseptavac" class="naseptavac hidden" role="listbox" aria-label="Výsledky hledání"></div>
      </div>
      <div class="window-controls">
        <button id="winMinBtn" class="win-btn" title="Minimalizovat">&#8211;</button>
        <button id="winMaxBtn" class="win-btn" title="Maximalizovat">&#9633;</button>
        <button id="winCloseBtn" class="win-btn win-close" title="Zavřít">&times;</button>
      </div>
    </div>
    <!-- Hlavní lišta: přehledy jako záložky, volby přehledu a akce -->
    <div class="hlavni-lista">
      <!-- Hlavní přehledy jako záložky vlevo -->
      <div id="viewToggle" class="view-toggle">
        <button data-rezim="modelky" title="Modelky" data-kratce="Mod" class="active">Modelky</button>
        <button data-rezim="covery" title="Čísla časopisu" data-kratce="Čís">Čísla</button>
        <button data-rezim="centerfoldy" title="Centerfoldy" data-kratce="Cf">Centerfoldy</button>
      </div>
      <!-- Volby otevřeného přehledu (Řazení ▾, Srdíčka ▾…) uprostřed pod hledáním; plní je ui/volby.js -->
      <div id="volbyPrehledu" class="volby-prehledu hidden"></div>
      <!-- Další přehledy jako ikonová tlačítka, za čárou akce -->
      <div class="nav-akce">
        <button data-rezim="nejlepsi" class="nav-fav nav-rezim" title="Nejlepší" aria-label="Nejlepší"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/></svg></button>
        <button data-rezim="prehled" class="nav-fav nav-rezim" title="Přehled" aria-label="Přehled"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6"/></svg></button>
        <span class="nav-oddelovac" aria-hidden="true"></span>
        <button id="addBtn" class="nav-fav" title="Přidat…">+</button>
        <button id="menuBtn" class="nav-fav" title="Další akce">&#8943;</button>
      </div>
    </div>
  </header>

  <main>
    <!-- Přehledy mají lištu pro skákání jako svislý sloupec vlevo; obsah je vedle ní -->
    <div class="se-sloupcem">
      <!-- Lišta písmen: skok na první modelku daného písmene. Přehledy mají do prvního načtení obrysy karet (ui/kostra.js) -->
      <nav id="galleryNav"></nav>
      <div id="gallery" class="gallery-grid">${htmlKostryKaret(15)}</div>
    </div>

    <!-- Stěna centerfoldů -->
    <div class="se-sloupcem">
      <nav id="wallNav"></nav>
      <div id="wall" class="wall hidden">${htmlKostryKaret(15)}</div>
    </div>

    <!-- Nejlépe hodnocené fotky napříč sbírkou -->
    <div id="best" class="best hidden">
      <nav id="bestNav"></nav>
      <div id="bestList">${htmlKostryKaret(15, { sPopisem: false })}</div>
    </div>

    <!-- Stránka vydání časopisu: cover, centerfold a pictorialy -->
    <div id="issueView" class="detail-container hidden">
      <aside id="issueSide" class="profile-side"></aside>
      <section class="profile-main">
        <!-- Lišta měsíců ročníku nebo alb fotografa -->
        <nav id="issueNav"></nav>
        <div id="issueMain"></div>
      </section>
    </div>

    <!-- Kalendář vydání -->
    <div id="calendar" class="calendar se-sloupcem hidden">
      <nav id="calNav"></nav>
      <div id="calList">${htmlKostryKaret(12, { sPopisem: false })}</div>
    </div>

    <!-- Přehled sbírky: počty a co chybí doplnit -->
    <div id="stats" class="stats hidden"></div>

    <!-- Čísla časopisu po ročnících (data-rezim „covery“) -->
    <div id="covers" class="covers se-sloupcem hidden">
      <nav id="coversNav"></nav>
      <div id="coversList">${htmlKostryKaret(12)}</div>
    </div>

    <!-- Detailní profil modelky -->
    <div id="detailView" class="detail-container hidden">
      <aside class="profile-side">
        <div id="modelHeader"></div>
        <!-- Tlačítka se při vykreslení profilu přesunou pod jméno modelky -->
        <div id="profileActions" class="profile-actions">
          <button id="editModelBtn" class="volba" title="Upravit údaje modelky"><span aria-hidden="true">✎</span>Upravit</button>
          <button id="addAlbumBtn" class="volba" title="Přidat fotky nebo album"><span aria-hidden="true">+</span>Přidat fotky</button>
        </div>
        <!-- Centerfoldy modelky jsou v levém panelu pod údaji -->
        <div id="centerfoldsSide"></div>
      </aside>

      <section class="profile-main">
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
                <input type="text" id="inputNarozeniDatum" placeholder="RRRR-MM-DD, RRRR-MM nebo RRRR" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="inputUmrtiDatum">Datum úmrtí</label>
                <input type="text" id="inputUmrtiDatum" placeholder="RRRR-MM-DD, RRRR-MM nebo RRRR" autocomplete="off" />
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
                <label id="kategorieLabel">Kategorie</label>
                <div id="kategorieVyber" role="group" aria-labelledby="kategorieLabel"></div>
                <input type="hidden" id="inputRole" />
              </div>
              <div class="form-group span-2">
                <label for="inputTags">Tagy (oddělené čárkou)</label>
                <input type="text" id="inputTags" />
                <div id="tagyNapoveda" class="tag-suggest"></div>
              </div>
              <div class="form-group span-2">
                <label for="inputPoznamka">Poznámka</label>
                <textarea id="inputPoznamka" rows="3" placeholder="Markdown: **tučné**, *kurzíva*, odrážky"></textarea>
              </div>
              <div class="form-group span-2">
                <label for="inputOdkazy">Odkazy (Wikipedie a podobně, jeden na řádek)</label>
                <textarea id="inputOdkazy" rows="2" placeholder="https://…"></textarea>
              </div>
            </div>
          </section>


          <!-- Našeptávání hodnot, které už v databázi jsou, aby se stejný údaj psal vždy stejně -->
          <datalist id="seznamVlasy"></datalist>
          <datalist id="seznamOci"></datalist>
          <datalist id="seznamNarodnost"></datalist>
          <datalist id="seznamEtnicita"></datalist>
          <datalist id="seznamMisto"></datalist>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" id="cancelModelBtn" class="btn btn-secondary">Zrušit</button>
          <button type="submit" id="modelNextBtn" class="btn btn-secondary hidden" title="Uloží a otevře další modelku z fronty (Údržba nebo Vývoj v čase)">Uložit a další</button>
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
          <label id="bulkLinksLabel">Vlož odkazy z Google Disku (libovolné množství)</label>
          <textarea id="inputBulkLinks" rows="3" placeholder="Vlož zkopírované odkazy z Disku (i více naráz)…" required></textarea>
        </div>
        <div class="form-group">
          <label for="inputAlbumPopis">Průvodní text alba (nepovinné)</label>
          <textarea id="inputAlbumPopis" rows="3" placeholder="Text, který album v časopise uvádí (markdown: **tučné**, *kurzíva*, odrážky)"></textarea>
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
            <label for="selectCoverMesic">Měsíc nebo speciál</label>
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
  <div id="selectionBar" class="selection-bar plovouci-panel hidden">
    <span id="selectionCount"></span>
    <span class="panel-oddelovac"></span>
    <span class="hearts selection-hearts" title="Ohodnotit vybrané">${[1, 2, 3, 4, 5].map(n => `<button class="heart" data-vyber-hodnoceni="${n}" title="Ohodnotit vybrané ${n} z 5"></button>`).join('')}</span>
    <span class="panel-oddelovac"></span>
    <button class="panel-btn" data-vyber="presunout" title="Přesunout do alba…">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M10 13h6M13 10l3 3-3 3"/></svg>
    </button>
    <button class="panel-btn" data-vyber="dovyberu" title="Přidat do výběru…">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/><path d="M12 7v6M9 10h6"/></svg>
    </button>
    <button class="panel-btn" data-vyber="vse" title="Vybrat vše (Ctrl+A)">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/></svg>
    </button>
    <span class="panel-oddelovac"></span>
    <button class="panel-btn nebezpecne" data-vyber="odebrat" title="Odebrat (Delete)">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>
    </button>
    <button class="panel-btn" data-vyber="zrusit" title="Zrušit výběr (Esc)">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>

  <!-- Modal: údaje vydání (poznámka, stav, modelka z obálky) -->
  <div id="issueModal" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="issueModalTitle">Číslo časopisu</h3>
        <button class="close-btn" data-zavrit>&times;</button>
      </div>
      <form id="issueForm">
        <div id="issueNazevGroup" class="form-group hidden">
          <label for="inputIssueNazev">Název speciálu</label>
          <input type="text" id="inputIssueNazev" placeholder="např. Playmate Review" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="selectIssueStav">Stav ve sbírce</label>
            <select id="selectIssueStav">
              <option value="">Běžné</option>
              <option value="mam">Mám výtisk</option>
              <option value="shanim">Sháním</option>
              <option value="nezajima">Nezajímá mě</option>
            </select>
          </div>
          <div class="form-group">
            <label for="inputIssueObalka">Na obálce</label>
            <input type="text" id="inputIssueObalka" list="seznamModelekObalky" autocomplete="off" placeholder="Jméno modelky (i mimo sbírku)" />
            <datalist id="seznamModelekObalky"></datalist>
          </div>
        </div>
        <div class="form-group">
          <label for="inputIssuePoznamka">Poznámka</label>
          <textarea id="inputIssuePoznamka" rows="4" placeholder="Markdown: **tučné**, *kurzíva*, odrážky"></textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
          <button type="submit" class="btn btn-primary">Uložit</button>
        </div>
      </form>
    </div>
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
        <button id="checkRemoveBtn" class="btn btn-danger hidden">Odebrat nedostupné z databáze</button>
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
      <!-- U nevratných hromadných akcí se smazání potvrzuje napsáním slova -->
      <div id="deleteSlovoGroup" class="form-group hidden">
        <label id="deleteSlovoLabel" for="inputDeleteSlovo"></label>
        <input type="text" id="inputDeleteSlovo" autocomplete="off" spellcheck="false" />
      </div>
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
      <!-- Jedna průhledná pilulka přes celou šířku: na krajích šipky, vlevo vydání a jméno, uprostřed nástroje, vpravo pořadí a zavření -->
      <div class="lb-lista">
        <button id="lbPrev" class="lb-btn lb-sipka" title="Předchozí (šipka vlevo)">&#8249;</button>
        <div class="lb-popis">
          <span id="lbPaska" class="lb-paska hidden"></span>
          <span id="lbCaption" class="lb-caption"></span>
        </div>
        <div class="lb-panel">
          <span id="lbHearts" title="Hodnocení fotky (klávesy 1–5, 0 ruší)"></span>
          <span class="lb-oddelovac"></span>
          <button id="lbFill" class="lb-btn" title="Rozložit přes celé okno (F)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
          </button>
          <button id="lbRot" class="lb-btn" title="Otočit o 90° (R)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 6.3"/><path d="M20 4v7h-7"/></svg>
          </button>
          <button id="lbZoom" class="lb-btn" disabled>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>
          </button>
          <span class="lb-oddelovac"></span>
          <button id="lbShuffle" class="lb-btn" title="Zamíchat pořadí (S)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h3c4 0 6 10 10 10h5M3 17h3c1.6 0 2.8-1.5 4-3.5M14 9.5C15.2 8 16.4 7 18 7h3M18 4l3 3-3 3M18 14l3 3-3 3"/></svg>
          </button>
          <button id="lbPlay" class="lb-btn" title="Slideshow (mezerník)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5l12 7-12 7z"/></svg>
          </button>
          <button id="lbMore" class="lb-btn tile-more" title="Akce s fotkou: profil, titulní fotka, do výběru, Google Disk, odkaz, odebrat">&#8943;</button>
        </div>
        <div class="lb-vpravo">
          <span id="lbCounter" class="lb-counter"></span>
          <span class="lb-oddelovac"></span>
          <button id="lbClose" class="lb-btn lb-zavrit" title="Zavřít (Esc)">&times;</button>
        </div>
        <button id="lbNext" class="lb-btn lb-sipka" title="Další (šipka vpravo)">&#8250;</button>
      </div>
    </div>
    <nav id="lbNav"></nav>
    <div id="lbProgress" class="lb-progress"></div>
  </div>

  <!-- Ztmavená stránka pod rychlými výsledky hledání; klik do ní výsledky zavře -->
  <div id="naseptavacZavoj" class="naseptavac-zavoj hidden"></div>

  <!-- Prohlížeč stran článku: jedna strana nebo dvojstrana jako rozevřený časopis, dole pás náhledů -->
  <div id="ctecka" class="modal-overlay ctecka hidden" tabindex="-1" role="dialog" aria-label="Prohlížeč stran">
    <div class="ctecka-hlava">
      <span id="cteckaNazev" class="ctecka-nazev"></span>
      <span id="cteckaStrany" class="ctecka-strany"></span>
      <span class="ctecka-mezera"></span>
      <div class="ctecka-rezim" role="group" aria-label="Rozložení">
        <button type="button" data-rezim-ctecky="1" title="Jedna strana (1)">Jedna strana</button>
        <button type="button" data-rezim-ctecky="2" title="Dvojstrana (2)">Dvojstrana</button>
      </div>
      <button type="button" class="ctecka-zavrit" data-zavrit title="Zavřít (Esc)">&times;</button>
    </div>
    <div class="ctecka-plocha">
      <button type="button" class="ctecka-sipka" data-krok-ctecky="-1" title="Předchozí (šipka vlevo)">&#8249;</button>
      <div id="cteckaStrana" class="ctecka-dvojstrana"></div>
      <button type="button" class="ctecka-sipka" data-krok-ctecky="1" title="Další (šipka vpravo)">&#8250;</button>
    </div>
    <nav id="cteckaPas" class="ctecka-pas"></nav>
  </div>

  <!-- Krátké oznámení, když je hlavní oznámení obsazené nabídkou akce (Vrátit) -->
  <div id="toastInfo" class="toast toast-info hidden"><span id="toastInfoText"></span></div>

  <!-- Oznámení o výsledku akce -->
  <div id="toast" class="toast hidden">
    <span id="toastText"></span>
    <button id="toastAction" class="btn btn-primary btn-small hidden"></button>
    <button id="toastClose" class="close-btn" title="Zavřít">&times;</button>
  </div>

  <!-- Nápověda (nabídka ⋯ a přehled zkratek pod klávesou ?) -->
  <div id="helpModal" class="modal-overlay hidden">
    <div class="modal-card modal-siroky">
      <div class="modal-header">
        <h3>Nápověda</h3>
        <button class="close-btn" data-zavrit>&times;</button>
      </div>
      <div class="napoveda">
        <h4>Prohlížení</h4>
        <ul>
          <li><strong>Rychlé výsledky</strong>: při psaní do hledání se pod ním ukážou modelky, články (i podle textu) a čísla. Šipky vybírají, Enter otevře, Esc výsledky zavře.</li>
          <li><strong>Přepínač v hlavičce</strong>: vlevo záložky Modelky, Čísla, Centerfoldy; vpravo ikony Nejlepší a Přehled. Čísla mají dvě zobrazení, volba <strong>Obálky ▾ / Kalendář ▾</strong> je první v liště voleb: Obálky ukazují čísla ve sbírce jako velké dlaždice, Kalendář všechny měsíce včetně chybějících; přepnutím zůstaneš na stejném roce a záložka Čísla otevře naposledy zvolené zobrazení. Volby přehledu (řazení, filtry) a počet položek jsou uprostřed pod hledáním.</li>
          <li><strong>Volby přehledu</strong> pod hledáním: <strong>⇅ řazení ▾</strong>, tlačítko <strong>Filtry</strong> (panel se srdíčky, edicí, kategorií, výskytem…; číslo v odznaku je počet zapnutých filtrů) a zapnuté filtry jako štítky, které <strong>×</strong> zruší; <strong>Zrušit filtry</strong> v panelu zruší všechny. V Nejlepších je vedle srdíček <strong>Výběr ▾</strong> a <strong>▶</strong> spustí slideshow. <strong>Rejstřík</strong> písmen nebo roků se ukáže u pravého okraje při rolování nebo po najetí myší.</li>
          <li>V profilu <kbd>←</kbd> <kbd>→</kbd> předchozí a další modelka, <kbd>Alt</kbd>+<kbd>←</kbd> nebo <kbd>Esc</kbd> zpět.</li>
          <li>Klávesa <kbd>?</kbd> kdekoli (i v prohlížeči fotek a ve čtečce stran) ukáže přehled všech klávesových zkratek.</li>
          <li>Klik na štítek čísla, rok v kalendáři nebo „Foto:“ u alba otevře stránku čísla, ročníku nebo fotografa.</li>
        </ul>
        <h4>Prohlížeč fotek</h4>
        <ul>
          <li><kbd>←</kbd> <kbd>→</kbd> listování, <kbd>↑</kbd> <kbd>↓</kbd> skok mezi alby, <kbd>mezerník</kbd> slideshow, <kbd>S</kbd> zamíchat.</li>
          <li><kbd>F</kbd> rozložit plakát přes okno, <kbd>R</kbd> otočit, klik na fotku lupa, <kbd>1</kbd>–<kbd>5</kbd> srdíčka, <kbd>0</kbd> zrušit, <kbd>Esc</kbd> zavřít.</li>
          <li>Tlačítko <strong>⋯</strong> nahoře: profil, titulní fotka, do výběru, Google Disk, odkaz, odebrat.</li>
        </ul>
        <h4>Akce a výběr</h4>
        <ul>
          <li>Akce s fotkou, albem, modelkou nebo číslem: tlačítko <strong>⋯</strong>, pravé tlačítko myši nebo klávesa nabídky. Na fotce jsou jen akce fotky, akce alba jsou pod ⋯ v hlavičce alba (nebo položkou „Album …“). Číslo má všude stejnou nabídku; současný stav čísla má ✓ a druhý klik ho zruší.</li>
          <li>Výběr více fotek (profil, vydání, ročník, fotograf, Nejlepší): <kbd>Ctrl</kbd>+klik, <kbd>Shift</kbd>+klik úsek, <kbd>Ctrl</kbd>+<kbd>A</kbd> vše, <kbd>Delete</kbd> odebrat (jde vrátit), <kbd>Esc</kbd> zrušit.</li>
          <li><kbd>Tab</kbd> prochází karty a fotky, <kbd>Enter</kbd> otevírá, <kbd>1</kbd>–<kbd>5</kbd> dá zaměřené kartě nebo fotce srdíčka (<kbd>0</kbd> je zruší); Zpět vrátí fokus na kartu, ze které se odešlo. V nabídce fungují šipky, v mapě edice v Přehledu šipky chodí po měsících a rocích.</li>
          <li>Odebraná fotka jde vrátit tlačítkem Vrátit v oznámení; soubor na Disku zůstává vždy.</li>
        </ul>
        <h4>Hledání</h4>
        <ul>
          <li>Více slov zužuje výběr: jméno, národnost, vlasy, míry, tagy…</li>
          <li>Cíleně: <code>vlasy:blond</code>, <code>oci:</code>, <code>narodnost:</code>, <code>tag:</code>, <code>kategorie:muse</code>, <code>fotograf:"arny freytag"</code>, <code>rok:1975</code>, <code>narozena:1990</code>, <code>edice:CZ</code>, <code>vyska:175</code>, <code>tetovani:ano</code>, <code>hodnoceni:5</code>, <code>obalka:1995</code>.</li>
        </ul>
        <h4>Čísla časopisu</h4>
        <ul>
          <li>Kalendář ukazuje jednu edici (US nebo CZ). Tři linky na spodní hraně obálky: cover, centerfold, pictorial (růžová = číslo ho má); když myš chvíli zůstane na kartě, střídá se na ní cover, centerfold a nejlépe hodnocená fotka z pictorialu a bílá linka ukazuje, co je právě vidět; prázdné políčko = číslo chybí, klik nabídne přidání.</li>
          <li>Stav čísla: <strong>mám výtisk</strong> (zelený rámeček), <strong>sháním</strong>, <strong>nezajímá mě</strong> – jen u české edice, v nabídce políčka nebo v „Upravit číslo…“.</li>
          <li><strong>Speciály</strong> (Playmate Review, Lingerie…) jsou štítky pod měsíci roku; nový založíš v okně alba nebo coveru („Nový speciál…“) nebo pravým tlačítkem na nadpis roku v kalendáři.</li>
        </ul>
        <h4>Přehled a hodnocení</h4>
        <ul>
          <li><strong>Statistiky</strong> v Přehledu (poslední část v liště nahoře), ve skupinách Zařazení (kategorie, centerfoldy podle desetiletí a edic, věk v době centerfoldu), Vzhled a původ (národnosti, barva vlasů a očí, hodnocení) a Sbírka (přibývání po měsících, nejčastější fotografové, čísla edic US a CZ); grafy bez údajů se nezobrazují. Najetí myší na sloupec ukáže hodnotu. Klik (nebo Enter) na sloupec či řádek vybere modelky; další kliky výběr zúží (v jednom grafu platí jedna hodnota, klik na tutéž ji zruší). Grafy i čísla nahoře pak ukazují tlumeně celou sbírku a jasně výběr, lišta výběru jeho podmínky (křížek podmínku odebere). „Zobrazit modelky“ ukáže jejich fotky – klik otevře profil, „Otevřít v galerii“ výběr převede na hledání (když ho jde vyjádřit hledáním). Esc zavře fotky, další Esc zruší výběr. Pod nimi <strong>Vývoj v čase</strong>: tabulka údajů po desetiletích podle roku centerfoldu (medián věku, výšky, váhy a měr, podíl blond vlasů, oholeného ochlupení, silikonových prsou, tetování a piercingu; pod hodnotou počet modelek se známým údajem), klik na řádek ukáže pod tabulkou graf. Přepínač US/CZ vybere edici.</li>
          <li><strong>Kategorie</strong> modelky (Playmate roku, Cyber Girl, Coed, Muse, Celebrita, Jen ve speciálu, Creator, Online) se volí štítky v „Upravit modelku…“; Playmate měsíce a Modelku obálky program pozná sám z centerfoldu a obálky. Podle kategorie filtruje galerie (Filtry) a hledání <code>kategorie:</code>.</li>
          <li><strong>Výskyt</strong>: <em>v časopise</em> má modelka s centerfoldem, obálkou nebo albem u konkrétního čísla; <em>jen online</em> modelka bez čísla s online kategorií (Cyber Girl, Coed, Muse, Creator nebo Online); ostatní jsou <em>neurčené</em>. Je v profilu, ve Filtrech galerie, ve Statistikách a v hledání <code>vyskyt:online</code>, <code>vyskyt:casopis</code>.</li>
          <li>Srdíčka u modelky i u fotky; lépe hodnocené fotky jdou v albu první, Nejlepší je ukáže napříč sbírkou jako jednu mozaiku od nejvíce srdíček; po najetí myší se ukáže jméno modelky a odkud fotka je.</li>
          <li>Číslo časopisu má vlevo obsah: články podle stran, centerfold a pictorialy. Články jdou vpravo pod sebou; klik v obsahu na článek doroluje, „+ článek“ a „✎ upravit“ otevřou okno článku.</li>
          <li><strong>Skeny stran</strong> článku se otevřou v prohlížeči stran: dvojstrana jako rozevřený časopis, nebo jedna strana (klávesy 1 a 2). Listuje se šipkami, klikem na stranu nebo v pásu náhledů; Esc zavře.</li>
          <li><strong>Články modelky</strong> (rozhovor, 20 otázek…) jsou v jejím profilu jako poslední blok vlevo; klik otevře číslo rovnou na článku.</li>
          <li><strong>Přehled</strong> má nahoře čtyři části. <strong>Přehled</strong>: hlavní čísla, mapa české edice (vlastní výtisky: mám, sháním, chybí) a mapa americké edice (úplnost dat: kompletní číslo má cover, centerfold i pictorial); klik na políčko otevře číslo, prázdné nabídne přidání, pravým tlačítkem se nastaví stav. <strong>Údržba</strong>: jedna fronta úkolů (modelky, čísla i údaje ke kontrole) seřazená podle toho, kolik toho chybí; filtry nahoře ukážou jen jeden druh úkolu. „Doplnit“ otevře místo, kde se úkol doplňuje, štítek na řádku otevře právě ten údaj, „Doplňovat postupně“ jde s „Uložit a další“ modelku po modelce. Pod ⋯ na řádku je „Netýká se: …“ a „Doplnit vše v jednom okně“. <strong>Sháním CZ</strong>: sháněná čísla české edice po letech, „Kopírovat seznam“ je dá do schránky jako text.</li>
          <li>Vlastní výběry fotek jsou v Nejlepších vedle prahů srdíček.</li>
        </ul>
        <h4>Import a zálohy</h4>
        <ul>
          <li>Nabídka ⋯ → Importovat: jeden nebo více souborů <code>.yaml</code>, <code>.yml</code> nebo <code>.md</code>; soubor může obsahovat i jen jednu modelku. Údaje se doplňují a opravují; smaže se jen údaj s hodnotou „-“. Modelky, alba ani fotky import nemaže.</li>
          <li>Zálohy vznikají denně a před každou hromadnou změnou; obnovení v ⋯ → Obnovit ze zálohy.</li>
          <li>Fotky musí být na Google Disku sdílené „kdokoli s odkazem“.</li>
        </ul>
      </div>
      <div class="modal-actions">
        <button type="button" id="helpNewsBtn" class="btn btn-secondary">Co je nového</button>
        <button type="button" class="btn btn-primary" data-zavrit>Zavřít</button>
      </div>
    </div>
  </div>

  <!-- Co je nového (po aktualizaci a z nabídky ⋯) -->
  <div id="newsModal" class="modal-overlay hidden">
    <div class="modal-card modal-siroky">
      <div class="modal-header">
        <h3 id="newsModalTitle">Co je nového</h3>
        <button class="close-btn" data-zavrit>&times;</button>
      </div>
      <div id="newsModalBody" class="napoveda"></div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-zavrit>Zavřít</button>
      </div>
    </div>
  </div>

  <!-- Článek čísla: rubrika, název, autor, strana, modelka, text a skeny; obsluha v app/clanky.js -->
  <div id="clanekModal" class="modal-overlay hidden">
    <div class="modal-card doplnit-okno clanek-okno">
      <form id="clanekForm" novalidate>
        <header class="doplnit-hlavicka"><div>
          <h3 id="clanekModalTitle">Nový článek</h3>
          <p id="clanekModalCislo"></p>
        </div></header>
        <div class="doplnit-telo">
          <section class="doplnit-blok">
            <h4>Článek</h4>
            <div class="clanek-mrizka-3">
              <div class="doplnit-pole"><label for="inputClanekRubrika">Rubrika</label><input id="inputClanekRubrika" list="seznamRubrik" autocomplete="off" /></div>
              <div class="doplnit-pole"><label for="inputClanekAutor">Autor</label><input id="inputClanekAutor" list="seznamAutoru" autocomplete="off" /></div>
              <div class="doplnit-pole"><label for="inputClanekStrana">Strana</label><input id="inputClanekStrana" inputmode="numeric" autocomplete="off" /></div>
            </div>
            <div class="clanek-mrizka-2">
              <div class="doplnit-pole"><label for="inputClanekNazev">Název</label><input id="inputClanekNazev" autocomplete="off" /></div>
              <div class="doplnit-pole"><label for="inputClanekModelka">Modelka (nepovinné, propojí s profilem)</label><input id="inputClanekModelka" list="seznamModelekClanku" autocomplete="off" /></div>
            </div>
          </section>
          <section class="doplnit-blok">
            <h4>Text</h4>
            <div class="clanek-mrizka-2">
              <div class="doplnit-pole"><label for="selectClanekDruh">Druh textu</label>
                <select id="selectClanekDruh"><option value="">Neuvedeno</option><option value="prepis">Přepis</option><option value="shrnuti">Shrnutí</option></select></div>
            </div>
            <div class="doplnit-pole"><textarea id="inputClanekText" rows="10"></textarea></div>
            <p class="doplnit-napoveda">Markdown: **tučné**, *kurzíva*, odrážky (* nebo -), citát (&gt;). První odstavec je perex, dvojtečka za jménem (PLAYBOY:) zvýrazní mluvčího.</p>
          </section>
          <section class="doplnit-blok">
            <h4>Skeny stran (nepovinné)</h4>
            <div class="doplnit-pole"><textarea id="inputClanekSkeny" rows="3" placeholder="Odkazy na skeny z Google Disku, jeden na řádek"></textarea></div>
          </section>
        </div>
        <div class="doplnit-pata">
          <button type="button" class="btn btn-secondary" id="clanekSmazatBtn">Smazat článek</button>
          <span></span>
          <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
          <button type="submit" class="btn btn-primary">Uložit</button>
        </div>
      </form>
      <datalist id="seznamRubrik"></datalist>
      <datalist id="seznamAutoru"></datalist>
      <datalist id="seznamModelekClanku"></datalist>
    </div>
  </div>

  <!-- Doplnit modelku: vše, co jí podle Přehledu chybí; obsah skládá app/doplneni.js -->
  <div id="doplnitModal" class="modal-overlay hidden">
    <div class="modal-card doplnit-okno">
      <div id="doplnitObsah"></div>
      <div class="doplnit-pata">
        <span id="doplnitPozice"></span>
        <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
        <button type="button" class="btn btn-secondary" id="doplnitProfilBtn">Otevřít profil</button>
        <button type="button" class="btn btn-secondary" id="doplnitDalsiBtn">Uložit a další →</button>
        <button type="button" class="btn btn-primary" id="doplnitUlozitBtn">Uložit</button>
      </div>
    </div>
  </div>

  <!-- Kontextová nabídka (pravé tlačítko) -->
  <div id="contextMenu" class="context-menu hidden"></div>
`;
