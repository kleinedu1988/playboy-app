// Kostra okna: hlavička, pohledy, modální okna, prohlížeč fotek. Obsah pohledů se vykresluje v main.js.
import { EDICE, moznostiMesicu } from './lib/format';
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
          <input type="text" id="searchInput" placeholder="Hledat modelku…" title="Modelky: jméno, národnost, vlasy, míry, tagy… Více slov zužuje výběr. Cíleně: vlasy:blond, oci:, narodnost:, tag:, kategorie:muse, fotograf:&quot;arny freytag&quot;, rok:1975, narozena:1990, nafoceno:2004, edice:CZ, vyska:175, tetovani:ano, obalka:1995, hodnoceni:5. Do hledání skočíš klávesami Ctrl+F." />
          <kbd class="hledani-zkratka" aria-hidden="true">Ctrl F</kbd>
          <button type="button" id="searchClearBtn" class="hledani-smazat" title="Smazat hledání" aria-label="Smazat hledání">&times;</button>
        </label>
        <!-- Rychlé výsledky pod hledáním: modelky, články (i v textu) a čísla; plní je app/naseptavac.js -->
        <div id="naseptavac" class="naseptavac hidden" role="listbox" aria-label="Výsledky hledání"></div>
      </div>
      <div class="window-controls">
        <button id="winMinBtn" class="win-btn" title="Minimalizovat">&#8211;</button>
        <button id="winMaxBtn" class="win-btn" title="Maximalizovat">&#9633;</button>
        <button id="winCloseBtn" class="win-btn win-close" title="Zavřít" aria-label="Zavřít program">&times;</button>
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
        <button data-rezim="prehled" data-cast-prehledu="oblibenost" class="nav-fav nav-rezim" title="Oblíbenost – porovnávání a pořadí modelek" aria-label="Oblíbenost"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6"/></svg></button>
        <!-- Přehled sbírky: úvod, Údržba, Sháním CZ a Statistiky (přepínají se volbou pod hledáním) -->
        <button data-rezim="prehled" data-cast-prehledu="sprava" class="nav-fav nav-rezim" title="Přehled sbírky – Údržba, Sháním CZ, Statistiky" aria-label="Přehled sbírky"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg></button>
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
        <button id="closeQuickModalBtn" class="close-btn" title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
      </div>
      <form id="quickForm">
        <div class="form-group">
          <label for="inputQuickJmeno">Jméno</label>
          <input type="text" id="inputQuickJmeno" required autocomplete="off" aria-describedby="quickJmenoInfo quickNapoveda" />
          <!-- Živá kontrola, zda modelka se stejným jménem nebo pseudonymem už ve sbírce není -->
          <small id="quickJmenoInfo" class="field-hint" aria-live="polite"></small>
        </div>
        <p id="quickNapoveda" class="quick-napoveda">Enter přidá modelku a otevře její profil, kde se přidají fotky a údaje.</p>
        <div class="modal-actions modal-actions-split">
          <button type="button" id="quickMoreBtn" class="btn btn-secondary">Vyplnit další údaje…</button>
          <button type="submit" class="btn btn-primary">Přidat</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Přidat / upravit modelku: vlevo nadpis, části formuláře a náhled profilu, vpravo pole pod sebou -->
  <div id="modelModal" class="modal-overlay hidden">
    <div class="modal-card modelka-okno">
      <form id="addModelForm" class="modelka-mrizka" novalidate>
        <aside class="modelka-bok">
          <h3 id="modelModalTitle">Přidat novou modelku</h3>
          <!-- Části formuláře: klik posune na část, tečka značí, že je v ní něco vyplněno (app/formular-modelky.js) -->
          <nav id="modelTabs" class="modelka-casti" aria-label="Části formuláře"></nav>
          <div class="modelka-nahled" aria-live="polite">
            <span>V profilu bude:</span>
            <b id="modelNahledJmeno"></b>
            <span id="modelNahledDalsi"></span>
            <ul id="modelNahledUdaje"></ul>
            <div class="modelka-pruh" aria-hidden="true"><i id="modelNahledPruh"></i></div>
            <small id="modelNahledVyplneno"></small>
          </div>
        </aside>
        <div class="modelka-pole">
          <button type="button" id="closeModalBtn" class="close-btn" title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
          <div class="form-body">
          <section class="form-section" aria-labelledby="modelCast0">
            <h4 id="modelCast0">Základní údaje</h4>
            <div class="modelka-radek">
              <div class="form-group siroke">
                <label for="inputJmeno">Celé jméno</label>
                <input type="text" id="inputJmeno" autocomplete="off" aria-describedby="modelJmenoInfo" />
                <small id="modelJmenoInfo" class="field-hint" aria-live="polite"></small>
              </div>
              <div class="form-group siroke">
                <label for="inputDalsiJmena">Další jména a pseudonymy</label>
                <input type="text" id="inputDalsiJmena" autocomplete="off" placeholder="oddělené čárkou" />
              </div>
              <div class="form-group">
                <label for="inputNarozeniDatum">Datum narození</label>
                <input type="text" id="inputNarozeniDatum" placeholder="RRRR-MM-DD nebo rok" autocomplete="off" aria-describedby="modelNarozeniInfo" />
                <small id="modelNarozeniInfo" class="field-hint" aria-live="polite"></small>
              </div>
              <div class="form-group">
                <label for="inputUmrtiDatum">Datum úmrtí</label>
                <input type="text" id="inputUmrtiDatum" placeholder="RRRR-MM-DD nebo rok" autocomplete="off" aria-describedby="modelUmrtiInfo" />
                <small id="modelUmrtiInfo" class="field-hint" aria-live="polite"></small>
              </div>
              <div class="form-group">
                <label for="inputNarozeniMisto">Místo narození</label>
                <input type="text" id="inputNarozeniMisto" list="seznamMisto" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="inputNarodnost">Národnost</label>
                <input type="text" id="inputNarodnost" list="seznamNarodnost" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="inputEtnicita">Etnicita</label>
                <input type="text" id="inputEtnicita" list="seznamEtnicita" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="inputDriveID">Titulní fotka</label>
                <input type="text" id="inputDriveID" autocomplete="off" placeholder="odkaz z Disku (nepovinné)" title="Odkaz na fotku z Google Disku; titulní fotku jde později vybrat i z alba" />
              </div>
            </div>
          </section>

          <section class="form-section" aria-labelledby="modelCast1">
            <h4 id="modelCast1">Vzhled a míry</h4>
            <div class="modelka-radek ctyri">
              <div class="form-group">
                <label for="inputVyska">Výška (cm)</label>
                <input type="text" id="inputVyska" inputmode="decimal" placeholder="cm nebo 5'7&quot;" autocomplete="off" aria-describedby="modelVyskaInfo" />
                <small id="modelVyskaInfo" class="field-hint" aria-live="polite"></small>
              </div>
              <div class="form-group">
                <label for="inputVaha">Váha (kg)</label>
                <input type="text" id="inputVaha" inputmode="decimal" placeholder="kg nebo 115 lbs" autocomplete="off" aria-describedby="modelVahaInfo" />
                <small id="modelVahaInfo" class="field-hint" aria-live="polite"></small>
              </div>
              <div class="form-group">
                <label for="inputVlasy">Barva vlasů</label>
                <input type="text" id="inputVlasy" list="seznamVlasy" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="inputOci">Barva očí</label>
                <input type="text" id="inputOci" list="seznamOci" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="inputHrudnik">Hrudník (cm)</label>
                <input type="text" id="inputHrudnik" inputmode="decimal" placeholder="cm nebo 34B-24-34" autocomplete="off" aria-describedby="modelMiryInfo" />
                <small id="modelMiryInfo" class="field-hint" aria-live="polite"></small>
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
                <label for="inputVelikost">Velikost prsou</label>
                <input type="text" id="inputVelikost" placeholder="např. 34B" autocomplete="off" />
              </div>
              <div class="form-group">
                <label for="selectPrsaTyp">Typ prsou</label>
                <select id="selectPrsaTyp">
                  <option value="">Neuvedeno</option>
                  <option>Přírodní</option>
                  <option>Silikonová</option>
                </select>
              </div>
              <div class="form-group">
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
          </section>

          <section class="form-section" aria-labelledby="modelCast2">
            <h4 id="modelCast2">Zařazení a poznámky</h4>
            <div class="form-group">
              <label id="kategorieLabel">Kategorie</label>
              <div id="kategorieVyber" role="group" aria-labelledby="kategorieLabel"></div>
              <input type="hidden" id="inputRole" />
            </div>
            <div class="form-group">
              <label for="inputTags">Tagy</label>
              <input type="text" id="inputTags" autocomplete="off" placeholder="oddělené čárkou" />
              <!-- Už použité tagy: klik tag přidá, druhý klik ho odebere -->
              <div id="tagyNapoveda" class="tag-suggest" role="group" aria-label="Už použité tagy"></div>
            </div>
            <div class="modelka-radek">
              <!-- Poznámka se píše ve společném okně s formátováním (ui/editor-textu.js); hodnota je ve skrytém poli -->
              <div class="form-group siroke">
                <span class="modelka-label" id="modelPoznamkaLabel">Poznámka</span>
                <button type="button" id="modelPoznamkaBtn" class="text-nahled" data-editor-textu title="Upravit poznámku" aria-labelledby="modelPoznamkaLabel modelPoznamkaNahled"><span id="modelPoznamkaNahled"></span></button>
                <textarea id="inputPoznamka" class="hidden" aria-hidden="true" tabindex="-1"></textarea>
              </div>
              <div class="form-group siroke">
                <label for="inputOdkazy">Odkazy (jeden na řádek)</label>
                <textarea id="inputOdkazy" rows="3" placeholder="Wikipedie a podobně: https://…"></textarea>
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
          <div class="modal-actions">
            <span class="modelka-zkratka">Ctrl+Enter uloží</span>
            <button type="button" id="cancelModelBtn" class="btn btn-secondary">Zrušit</button>
            <button type="submit" id="modelNextBtn" class="btn btn-secondary hidden" title="Uloží a otevře další modelku z fronty Údržby">Uložit a další</button>
            <button type="submit" id="modelUlozitBtn" class="btn btn-primary">Uložit modelku</button>
          </div>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal 2: Hromadné nahrání fotek do alba -->
  <div id="albumModal" class="modal-overlay hidden">
    <!-- Varianta A: vlevo typ alba a náhled, vpravo jen pole, která zvolený typ potřebuje -->
    <div class="modal-card album-okno">
      <form id="addAlbumForm" class="album-mrizka">
        <aside class="album-bok">
          <h3 id="albumModalTitle">Přidat fotky do alba</h3>
          <!-- Typ alba ve krocích: kde vyšlo (časopis, online, nikde), druh a u časopisu číslo; skutečný typ drží skrytý výběr -->
          <div id="albumTypGroup" class="typ-alba">
            <!-- Volby se chovají jako přepínače: Tab skočí na skupinu, šipky v ní mění volbu -->
            <span class="album-krok" id="albumKdeNadpis">Kde vyšlo</span>
            <div role="radiogroup" aria-labelledby="albumKdeNadpis">
              <button type="button" role="radio" class="album-volba" data-kde="casopis" title="Album patří k číslu časopisu">Časopis</button>
              <button type="button" role="radio" class="album-volba" data-kde="online" title="Pictorial jen na webu (Cyber Girl, Coed…)">Online</button>
              <button type="button" role="radio" class="album-volba" data-kde="nikde" title="Album bez čísla i bez data">Nikde</button>
            </div>
            <span class="album-krok" id="albumDruhNadpis">Druh</span>
            <div id="albumDruhy" role="radiogroup" aria-labelledby="albumDruhNadpis"></div>
            <div id="albumCisloGroup">
              <span class="album-krok" id="albumCisloNadpis">Číslo</span>
              <div role="radiogroup" aria-labelledby="albumCisloNadpis">
                <button type="button" role="radio" class="album-volba" data-cislo="mesic" title="Řádné měsíční číslo">Měsíční</button>
                <button type="button" role="radio" class="album-volba" data-cislo="special" title="Zvláštní číslo mimo měsíční řadu (Playmate Review, Lingerie…)">Speciál</button>
              </div>
            </div>
            <select id="selectTyp" class="hidden" tabindex="-1" aria-hidden="true">
              <option value="Pictorial">Pictorial</option>
              <option value="Centerfold">Centerfold</option>
              <option value="Pictorial online">Pictorial online</option>
              <option value="Cyber Girl týdne">Cyber Girl týdne</option>
              <option value="Cyber Girl měsíce">Cyber Girl měsíce</option>
            </select>
          </div>
          <!-- Náhled hlavičky alba v profilu; obrázek je první vložená fotka (nebo první fotka upravovaného alba) -->
          <div class="album-nahled" aria-live="polite">
            <span class="album-nahled-obrazek" id="albumNahledObrazek" aria-hidden="true"></span>
            <div class="album-nahled-text">
              <span class="album-nahled-stitek">V profilu bude</span>
              <b id="albumNahledNazev"></b>
              <span id="albumNahledPopis"></span>
              <span id="albumNahledPocet" class="album-nahled-pocet"></span>
            </div>
          </div>
        </aside>
        <div class="album-pole">
          <button type="button" id="closeAlbumModalBtn" class="close-btn" title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
          <!-- Modelka se vybírá jen tam, kde není daná (stěna, vydání, kalendář); neznámé jméno založí novou -->
          <div id="albumModelkaGroup" class="form-group hidden">
            <label for="inputAlbumModelka">Modelka</label>
            <input type="text" id="inputAlbumModelka" list="seznamModelekAlba" autocomplete="off" placeholder="Začni psát jméno…" />
            <datalist id="seznamModelekAlba"></datalist>
            <small id="albumModelkaNova" class="field-hint"></small>
          </div>
          <div class="form-row">
            <div id="albumNazevGroup" class="form-group">
              <label for="inputAlbumName">Název alba</label>
              <input type="text" id="inputAlbumName" placeholder="např. Summer Heat" required />
            </div>
            <div class="form-group">
              <label for="inputAlbumFotograf">Fotograf (nepovinné)</label>
              <input type="text" id="inputAlbumFotograf" list="seznamFotografu" autocomplete="off" />
              <datalist id="seznamFotografu"></datalist>
            </div>
          </div>
          <!-- Centerfold nemá název, určuje ho vydání časopisu; pictorial může k vydání patřit volitelně -->
          <div id="albumVydaniGroup" class="form-row form-row-3 hidden">
            <div class="form-group">
              <label id="albumMesicLabel" for="selectAlbumMesic">Měsíc vydání</label>
              <select id="selectAlbumMesic">
                <option value="">Vyber měsíc</option>
                ${moznostiMesicu()}
              </select>
              <select id="selectAlbumSpecial" class="hidden">
                <option value="">Vyber speciál</option>
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
          <!-- Online album nepatří k číslu časopisu; datum nafocení je jen údaj alba (ne vydání ani titulní fotka) -->
          <div id="albumDatumGroup" class="form-group hidden">
            <label for="inputAlbumDatum">Nafoceno (nepovinné)</label>
            <div class="pole-s-info">
              <input type="text" id="inputAlbumDatum" placeholder="RRRR-MM-DD" autocomplete="off" />
              <small id="albumTydenInfo" class="typ-alba-obdobi"></small>
            </div>
            <small class="album-tip">RRRR-MM-DD, RRRR-MM nebo rok. Jen údaj u alba – k číslu časopisu ho nepřiřadí.</small>
          </div>
          <div class="form-group">
            <label id="bulkLinksLabel" for="inputBulkLinks">Vlož odkazy z Google Disku (libovolné množství)</label>
            <textarea id="inputBulkLinks" rows="4" placeholder="Vlož zkopírované odkazy z Disku (i více naráz)…" required></textarea>
            <small id="albumPocetOdkazu" class="album-tip"></small>
          </div>
          <!-- Průvodní text se píše ve společném okně s formátováním (ui/editor-textu.js); hodnota je ve skrytém poli -->
          <div class="form-group">
            <span class="album-label">Průvodní text (nepovinné)</span>
            <button type="button" id="albumPopisBtn" class="text-nahled" data-editor-textu title="Upravit průvodní text"><span id="albumPopisNahled"></span></button>
            <textarea id="inputAlbumPopis" class="hidden" aria-hidden="true" tabindex="-1"></textarea>
          </div>
          <div class="modal-actions album-akce">
            <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
            <button type="submit" id="albumNextBtn" name="dalsi" value="1" class="btn btn-secondary" title="Okno zůstane otevřené a podrží modelku, fotografa a vydání">Uložit a přidat další</button>
            <button type="submit" id="albumSubmitBtn" class="btn btn-primary">Uložit fotky</button>
          </div>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Přidat / upravit cover časopisu -->
  <div id="coverModal" class="modal-overlay hidden">
    <!-- Rozložení okna alba: vlevo druh čísla a náhled obálky, vpravo pole; obsluha v app/cover.js -->
    <div class="modal-card album-okno cislo-okno">
      <form id="coverForm" class="album-mrizka">
        <aside class="album-bok">
          <h3 id="coverModalTitle">Přidat cover</h3>
          <span class="album-krok" id="coverCisloNadpis">Číslo</span>
          <div class="cislo-volby" role="group" aria-labelledby="coverCisloNadpis">
            <button type="button" class="album-volba" data-cislo-coveru="mesic" title="Řádné měsíční číslo">Měsíční</button>
            <button type="button" class="album-volba" data-cislo-coveru="special" title="Zvláštní číslo mimo měsíční řadu (Playmate Review, Lingerie…)">Speciál</button>
          </div>
          <!-- Náhled: obálka z vloženého odkazu (u úpravy původní) s páskou čísla jako v Číslech -->
          <div class="cislo-nahled" aria-live="polite">
            <span class="cislo-nahled-obalka">
              <img id="coverNahledObrazek" class="hidden" alt="Náhled coveru" draggable="false" />
              <span id="coverNahledPrazdny" class="cislo-nahled-prazdny">Náhled se ukáže po vložení odkazu</span>
              <span id="coverNahledPaska" class="rocnik-paska hidden"></span>
            </span>
            <b id="coverNahledNazev"></b>
          </div>
        </aside>
        <div class="album-pole">
          <button type="button" id="closeCoverModalBtn" class="close-btn" title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
          <div class="form-row form-row-3">
            <div class="form-group">
              <label id="coverMesicLabel" for="selectCoverMesic">Měsíc</label>
              <select id="selectCoverMesic" required>
                <option value="">Vyber měsíc</option>
                ${moznostiMesicu()}
              </select>
              <select id="selectCoverSpecial" class="hidden">
                <option value="">Vyber speciál</option>
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
          <small id="coverSpecialInfo" class="field-hint cislo-info"></small>
          <div class="form-group">
            <label id="coverLinkLabel" for="inputCoverLink">Odkaz na cover z Google Disku</label>
            <input type="text" id="inputCoverLink" autocomplete="off" spellcheck="false" placeholder="https://drive.google.com/file/d/…" />
            <small class="cislo-napoveda">Soubor musí být na Disku sdílený „kdokoli s odkazem“. Náhled obálky ukáže, jestli se obrázek načte.</small>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
            <button type="submit" class="btn btn-primary">Uložit cover</button>
          </div>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Nastavení, změna nebo zrušení hesla -->
  <div id="passModal" class="modal-overlay hidden">
    <div class="modal-card modal-narrow">
      <div class="modal-header">
        <h3 id="passModalTitle">Nastavit heslo</h3>
        <button id="closePassModalBtn" class="close-btn" title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
      <input type="password" id="inputLock" placeholder="Heslo" aria-label="Heslo" autocomplete="off" />
      <button type="submit" class="btn btn-primary">Odemknout</button>
      <p id="lockMsg"></p>
    </form>
  </div>

  <!-- Modal: výběr nebo zadání jedné hodnoty (modelka, album, nové jméno) -->
  <div id="pickModal" class="modal-overlay hidden">
    <div class="modal-card modal-narrow">
      <div class="modal-header">
        <h3 id="pickModalTitle"></h3>
        <button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
    <!-- Rozložení okna alba: vlevo obálka čísla a stav ve sbírce, vpravo údaje; obsluha v app/vydani.js -->
    <div class="modal-card album-okno cislo-okno">
      <form id="issueForm" class="album-mrizka">
        <aside class="album-bok">
          <h3 id="issueModalTitle">Číslo časopisu</h3>
          <p class="cislo-podnadpis">Údaje čísla</p>
          <div class="cislo-nahled">
            <span id="issueNahledObalka" class="cislo-nahled-obalka">
              <img id="issueNahledObrazek" class="hidden" alt="Obálka čísla" draggable="false" />
              <span id="issueNahledPrazdny" class="cislo-nahled-prazdny">Číslo zatím nemá cover</span>
              <span id="issueNahledPaska" class="rocnik-paska"></span>
              <span id="issueNahledStav" class="rocnik-stav hidden"></span>
            </span>
          </div>
          <!-- Stav ve sbírce: volby vlevo, hodnotu drží skrytý výběr (u americké edice jsou výtisk a sháním skryté) -->
          <span class="album-krok" id="issueStavNadpis">Stav ve sbírce</span>
          <div id="issueStavVolby" class="cislo-volby" role="group" aria-labelledby="issueStavNadpis">
            <button type="button" class="album-volba" data-stav-cisla="">Běžné</button>
            <button type="button" class="album-volba" data-stav-cisla="mam" title="Výtisk je ve sbírce (zelený rámeček v kalendáři)">Mám výtisk</button>
            <button type="button" class="album-volba" data-stav-cisla="shanim" title="Číslo se objeví v seznamu Sháním CZ">Sháním</button>
            <button type="button" class="album-volba" data-stav-cisla="nezajima" title="Číslo se v kalendáři ztlumí">Nezajímá mě</button>
          </div>
          <small id="issueStavInfo" class="cislo-napoveda"></small>
          <select id="selectIssueStav" class="hidden" tabindex="-1" aria-hidden="true">
            <option value="">Běžné</option>
            <option value="mam">Mám výtisk</option>
            <option value="shanim">Sháním</option>
            <option value="nezajima">Nezajímá mě</option>
          </select>
        </aside>
        <div class="album-pole">
          <button type="button" class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
          <div id="issueNazevGroup" class="form-group hidden">
            <label for="inputIssueNazev">Název speciálu</label>
            <input type="text" id="inputIssueNazev" placeholder="např. Playmate Review" autocomplete="off" />
          </div>
          <div class="form-group">
            <label for="inputIssueObalka">Na obálce</label>
            <input type="text" id="inputIssueObalka" list="seznamModelekObalky" autocomplete="off" placeholder="Jméno modelky (i mimo sbírku)" />
            <datalist id="seznamModelekObalky"></datalist>
            <small id="issueObalkaInfo" class="cislo-napoveda"></small>
          </div>
          <!-- Poznámka se píše ve společném okně s formátováním (ui/editor-textu.js); hodnota je ve skrytém poli -->
          <div class="form-group">
            <span class="album-label">Poznámka</span>
            <button type="button" id="issuePoznamkaBtn" class="text-nahled text-nahled-velky" data-editor-textu title="Upravit poznámku"><span id="issuePoznamkaNahled"></span></button>
            <textarea id="inputIssuePoznamka" class="hidden" aria-hidden="true" tabindex="-1"></textarea>
            <small class="cislo-napoveda">Kde je výtisk, stav, co v čísle chybí… Ukáže se v levém panelu stránky čísla.</small>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
            <button type="submit" class="btn btn-primary">Uložit</button>
          </div>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: Obnovení ze zálohy -->
  <div id="backupModal" class="modal-overlay hidden">
    <div class="modal-card modal-backup">
      <div class="modal-header">
        <h3>Obnovit ze zálohy</h3>
        <button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
        <button id="closeCheckModalBtn" class="close-btn" title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
        <button id="closeDeleteModalBtn" class="close-btn" title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
          <button id="lbClose" class="lb-btn lb-zavrit" title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
      <button type="button" class="ctecka-zavrit" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
    <button id="toastClose" class="close-btn" title="Zavřít" aria-label="Zavřít oznámení">&times;</button>
  </div>

  <!-- Nápověda (nabídka ⋯ a přehled zkratek pod klávesou ?) -->
  <div id="helpModal" class="modal-overlay hidden">
    <div class="modal-card modal-siroky">
      <div class="modal-header">
        <h3>Nápověda</h3>
        <button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
          <li><kbd>Tab</kbd> prochází karty a fotky, <kbd>Enter</kbd> otevírá, <kbd>1</kbd>–<kbd>5</kbd> dá zaměřené kartě nebo fotce srdíčka (<kbd>0</kbd> je zruší; u karty modelky stejná číslice znovu přidá půlku); Zpět vrátí fokus na kartu, ze které se odešlo. V nabídce fungují šipky, v mapě edice v Přehledu šipky chodí po měsících a rocích.</li>
          <li>Odebraná fotka jde vrátit tlačítkem Vrátit v oznámení; soubor na Disku zůstává vždy.</li>
        </ul>
        <h4>Hledání</h4>
        <ul>
          <li>Více slov zužuje výběr: jméno, národnost, vlasy, míry, tagy…</li>
          <li>Cíleně: <code>vlasy:blond</code>, <code>oci:</code>, <code>narodnost:</code>, <code>tag:</code>, <code>kategorie:muse</code>, <code>fotograf:"arny freytag"</code>, <code>rok:1975</code>, <code>narozena:1990</code>, <code>edice:CZ</code>, <code>vyska:175</code>, <code>tetovani:ano</code>, <code>hodnoceni:5</code>, <code>obalka:1995</code>, <code>nafoceno:2004</code> nebo <code>nafoceno:2004-06</code> (kdy bylo online album nafoceno).</li>
        </ul>
        <h4>Čísla časopisu</h4>
        <ul>
          <li>Kalendář ukazuje jednu edici (US nebo CZ). Tři linky na spodní hraně obálky: cover, centerfold, pictorial (růžová = číslo ho má); když myš chvíli zůstane na kartě, střídá se na ní cover, centerfold a nejlépe hodnocená fotka z pictorialu a bílá linka ukazuje, co je právě vidět; prázdné políčko = číslo chybí, klik nabídne přidání.</li>
          <li>Stav čísla: <strong>mám výtisk</strong> (zelený rámeček), <strong>sháním</strong>, <strong>nezajímá mě</strong> – jen u české edice, v nabídce políčka nebo v „Upravit číslo…“. Okno čísla má vlevo obálku čísla a volby stavu, vpravo kdo je na obálce (jméno ze sbírky se propojí s profilem, jiné se uloží jako text) a poznámku.</li>
          <li>Okno <strong>Přidat cover</strong> ukazuje vlevo náhled obálky z vloženého odkazu s páskou čísla, takže hned poznáš, jestli se obrázek z Disku načte; u úpravy coveru je tam původní obálka, dokud nevložíš nový odkaz.</li>
          <li><strong>Speciály</strong> (Playmate Review, Lingerie…) jsou štítky pod měsíci roku; nový založíš v okně alba nebo coveru („Nový speciál…“) nebo pravým tlačítkem na nadpis roku v kalendáři.</li>
        </ul>
        <h4>Přehled a hodnocení</h4>
        <ul>
          <li><strong>Statistiky</strong> v Přehledu (poslední část v nabídce tlačítka Přehled): jeden graf, který vybereš z rozvinutého seznamu, a vedle něj modelky výběru. <em>V čase</em> podle roku prvního výskytu modelky v časopise (centerfold, obálka nebo pictorial u čísla; přepínač Vše / Centerfold / Obálka / Pictorial / Online vybere, který výskyt se počítá; Online je rok nafocení prvního online alba, album bez data v grafech v čase není): počty (modelky podle roku; přibývání sbírky po měsících), údaje (věk při prvním výskytu, výška, váha, BMI, hrudník, pas, boky, poměr pas : boky – medián roku a pásmo prostřední poloviny modelek) a podíly (blond vlasy, silikonová prsa, oholené ochlupení, tetování, piercing – procento ze známých hodnot); bílá křivka je klouzavý průměr. Klik na sloupec vybere rok, tažení myší období; šipky ← → výběr posouvají, se Shiftem ho rozšíří. Přepínač Vše / US / CZ vybere edici. Modelky bez čísla (jen online) rok nemají a v grafech v čase nejsou; rozložení počítá se všemi. <em>Rozložení</em>: kategorie, národnosti, barva vlasů a očí, hodnocení, výskyt a nejčastější fotografové; klik na řádek vybere hodnotu. <strong>Výběr platí pro všechny grafy</strong>: vyber třeba 90. léta, přepni na Národnosti a uvidíš jasně jen modelky z 90. let, tlumeně celou sbírku; další výběr v jiném grafu ho zúží. Podmínky jsou štítky pod lištou (křížek podmínku odebere), Esc zruší celý výběr. Seznam vpravo ukazuje modelky výběru, klik otevře profil; „Otevřít v galerii“ převede výběr na hledání, když ho jde hledáním vyjádřit. Vybraný graf si program pamatuje.</li>
          <li><strong>Formulář modelky</strong> („Upravit modelku…“, „Vyplnit další údaje…“): vlevo části formuláře – klik na část k ní doroluje, plná tečka značí, že je v ní něco vyplněno – a náhled, jak bude modelka v profilu, s pruhem vyplněných údajů, které hlídá Údržba. Pod poli se hned při psaní ukazují nápovědy: datum narození a věk, neplatné datum nebo úmrtí před narozením (červeně), převod amerických měr na cm a kg (<code>5'7"</code>, <code>115 lbs</code>, <code>34B-24-34</code> rozepíše hrudník, pas, boky i velikost), BMI a upozornění, že modelka se stejným jménem nebo pseudonymem už ve sbírce je (to i v rychlém přidání). Klik na už použitý tag pod polem Tagy ho přidá, druhý klik ho odebere. Poznámka se píše v okně editoru textu. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> uloží (ve frontě Údržby uloží a otevře další modelku), stejně i v okně Doplnit modelku; <kbd>Esc</kbd> okno zavře, u rozepsaných změn se nejdřív zeptá.</li>
          <li><strong>Kategorie</strong> modelky (Playmate roku, Cyber Girl, Coed, Muse, Celebrita, Jen ve speciálu, Creator, Online) se volí štítky v „Upravit modelku…“; Playmate měsíce, Cyber Girl a Modelku obálky program pozná sám z centerfoldu, alba Cyber Girl of the Week či of the Month a obálky (obyčejný Pictorial online kategorii nedává). Proužek v rohu fotky profilu ukáže u centerfoldu „Playmate · měsíc“, u online alb „Cyber Girl“, nebo „Online“, když modelka Cyber Girl není (klik přejde na album). Podle kategorie filtruje galerie (Filtry) a hledání <code>kategorie:</code>.</li>
          <li><strong>Výskyt</strong>: <em>v časopise</em> má modelka s centerfoldem, obálkou nebo albem u konkrétního čísla; <em>jen online</em> modelka bez čísla s online kategorií (Cyber Girl, Coed, Muse, Creator nebo Online) nebo s online albem; ostatní jsou <em>neurčené</em>. Album typu <em>Pictorial online</em> je pictorial jen na webu: v okně alba nemá vydání, ale pole <em>Nafoceno</em> (RRRR-MM-DD, RRRR-MM nebo rok). Typ alba se v okně volí ve dvou řadách: <em>Kde vyšlo</em> (Časopis, Online, Nikde) a <em>Druh</em> – u časopisu Pictorial nebo Centerfold a řada <em>Číslo</em> (Měsíční, nebo Speciál s vlastním výběrem speciálů roku a volbou „Nový speciál…“), u online Pictorial, Cyber Girl of the Week nebo of the Month, „Nikde“ je pictorial bez čísla i data. <em>Cyber Girl of the Week</em> spočítá z celého data týden v roce (nadpis alba „Cyber Girl týdne · 24. týden 2004“), <em>of the Month</em> vezme z data měsíc („Cyber Girl měsíce · červen 2004“); modelka dostane kategorii Cyber Girl týdne, nebo měsíce. Datum je jen informace u alba – album nepřiřadí k vydání ani do kalendáře a nemění titulní fotku modelky. Je v profilu, ve Filtrech galerie, ve Statistikách a v hledání <code>vyskyt:online</code>, <code>vyskyt:casopis</code>.</li>
          <li><strong>Srdíčka modelky jdou po půlkách</strong> (0–5, třeba 3,5): klik na levou půlku srdíčka dá půl, na pravou celé, klik na současnou hodnotu hodnocení zruší; najetí myší ukáže, co klik nastaví. Klávesy (zaměřená karta, srdíčka v profilu, řádek Údržby): <kbd>1</kbd>–<kbd>5</kbd> celá srdíčka, stejná číslice znovu přidá půlku (<kbd>3</kbd> <kbd>3</kbd> = 3½, u pětky 4½), <kbd>0</kbd> zruší; zaměřená srdíčka v profilu a Údržbě mění i <kbd>←</kbd> <kbd>→</kbd> po půlce. Fotky mají dál celá srdíčka 1–5. Filtr „♥ 3+“ zahrnuje i 3,5.</li>
          <li><strong>Oblíbenost</strong> (část Přehledu): „Která se ti líbí víc?“ ukazuje dvě modelky vedle sebe – <kbd>←</kbd> / <kbd>→</kbd> nebo klik na fotku vybere, <kbd>↓</kbd> nebo mezerník znamená stejně, <kbd>S</kbd> přeskočí, <kbd>Backspace</kbd> vrátí poslední porovnání. Pod velkou fotkou je řada až osmi náhledů z jejích alb (nejlépe hodnocené fotky, z každého alba aspoň jedna): najetí myší ukáže náhled velký, <kbd>1</kbd>–<kbd>8</kbd> ukáže n-tý náhled na obou stranách najednou, <kbd>↑</kbd> / <kbd>Shift</kbd>+<kbd>↑</kbd> jimi listuje, <kbd>0</kbd> vrátí titulní fotky; klik na náhled otevře prohlížeč na té fotce mezi fotkami modelky a zavření prohlížeče vrátí k porovnání. Okruh volí, které dvojice přijdou: Stejné srdíčko (zpřesní pořadí uvnitř úrovně), Všechny, I nehodnocené. Když volba hodně odporuje srdíčkům, nabídne se srovnat je. Pod tím <em>Pořadí</em> podle síly (pruh, světlá linka = nejistota, počet porovnání): vychází ze srdíček modelky, ze skóre jejích fotek (každé album jeden hlas, album hodnotí jeho nejlepší fotky, málo fotek se počítá opatrně) a z porovnání; kolik fotky váží, se program učí z tvých porovnání modelek se stejnými srdíčky. Pořadí se tak může přehodit o půl srdíčka, o celé ne. Nehodnocené modelky s hodnocenými fotkami jsou v Pořadí tlumeně se štítkem „odhad z fotek“, dokud je neohodnotíš nebo neporovnáš. U řádku je „fotky 4,3“, podrobnosti v bublině, <em>Mohlo by se ti líbit</em> – nehodnocené modelky s odhadem hodnocení a důvodem, srdíčky je jde rovnou ohodnotit – a věta o přesnosti modelu vkusu. Galerie řazená <em>Podle srdíček</em> řadí modelky se stejnými srdíčky podle oblíbenosti (i s filtrem ♥ 4+), nehodnocené jsou na konci podle odhadu z fotek. Nehodnocená modelka má na kartě a v profilu tlumený štítek „odhad 3½“; je to jen odhad, ne hodnocení.</li>
          <li>Srdíčka u modelky i u fotky; lépe hodnocené fotky jdou v albu první, Nejlepší je ukáže napříč sbírkou jako jednu mozaiku od nejvíce srdíček; po najetí myší se ukáže jméno modelky a odkud fotka je.</li>
          <li><strong>Psaní textu</strong> (průvodní text alba, text článku, poznámka modelky a čísla): klik na náhled textu otevře okno editoru. Text se ukazuje rovnou naformátovaný – tučně, kurzívou, nadpisy, citáty; značky markdownu (<code>**</code>, <code>*</code>, <code>#</code>, <code>&gt;</code>) se objeví, jen když je kurzor v daném místě. Tlačítka nahoře nebo Ctrl+B / Ctrl+I formátují výběr a ukazují, který formát je v místě kurzoru (opakovaný klik ho vypne). Enter v odrážkách a číslovaném seznamu pokračuje další položkou (čísla pod ní se přečíslují), Enter na prázdné položce seznam ukončí. U článku se první odstavec (perex) a mluvčí („PLAYBOY:“) ukazují jako ve čtečce. Tlačítko <em>Náhled</em> ukáže text přesně tak, jak bude v profilu nebo ve čtečce; dole je počet slov a znaků. Ctrl+Enter text použije.</li>
          <li><strong>Okno alba</strong>: vlevo se volí, kde album vyšlo, jeho druh a číslo (Tab skočí na skupinu, šipky v ní mění volbu); náhled pod volbami ukazuje, jak bude album v profilu vypadat, i s obrázkem první vložené fotky a počtem fotek. Na malé obrazovce se pole posouvají a tlačítka Uložit zůstávají dole.</li>
          <li>Číslo časopisu má vlevo obsah: články podle stran, centerfold a pictorialy. Články jdou vpravo pod sebou; klik v obsahu na článek doroluje, „+ článek“ a „✎ upravit“ otevřou okno článku. V hlavičce okna je záhlaví článku tak, jak bude v čísle (rubrika · strana · druh textu), pod skeny jejich počet a náhledy.</li>
          <li><strong>Skeny stran</strong> článku se otevřou v prohlížeči stran: dvojstrana jako rozevřený časopis, nebo jedna strana (klávesy 1 a 2). Listuje se šipkami, klikem na stranu nebo v pásu náhledů; Esc zavře.</li>
          <li><strong>Články modelky</strong> (rozhovor, 20 otázek…) jsou v jejím profilu jako poslední blok vlevo; klik otevře číslo rovnou na článku.</li>
          <li><strong>Přehled</strong> má dvě tlačítka vpravo v liště: <strong>graf</strong> otevře Oblíbenost (porovnávání a pořadí modelek), <strong>Přehled sbírky</strong> (deska se seznamem) otevře naposledy zvolenou ze čtyř částí – Přehled, Údržba, Sháním CZ, Statistiky – a mezi nimi se přepíná volbou pod hledáním (stejně jako Obálky / Kalendář u Čísel), u Údržby s počtem úkolů. <strong>Přehled</strong>: hlavní čísla, mapa české edice (vlastní výtisky: mám, sháním, chybí) a mapa americké edice (úplnost dat: kompletní číslo má cover, centerfold i pictorial); klik na políčko otevře číslo, prázdné nabídne přidání, pravým tlačítkem se nastaví stav. „Co zbývá doplnit“ otevře Údržbu rovnou na dané položce. <strong>Sháním CZ</strong>: sháněná čísla české edice po letech, „Kopírovat seznam“ je dá do schránky jako text.</li>
          <li><strong>Údržba</strong> ukazuje, co sbírce chybí nebo co je potřeba zkontrolovat. Nahoře je jeden řádek: prstenec s tím, na kolik procent je sbírka doplněná, počty úkolů, údajů ke kontrole a návrhů a přepínač tří režimů – <em>Po údajích</em>, <em>Po modelkách</em> a <em>Souhrn</em>. Program si pamatuje naposledy zvolený režim (poprvé Po údajích).</li>
          <li><strong>Po údajích</strong>: vlevo jsou údaje, které někde chybí – Ke kontrole (nálezy kontroly), údaje modelek (datum narození, národnost, místo narození, výška a váha, kategorie, etnicita, barvy, míry, velikost a typ prsou, ochlupení, tetování, piercing, tagy, hodnocení), fotky a alba (titulní fotka, centerfold, vydání alb, texty alb, další návrhy) a čísla (cover, centerfold) – s počtem a ✦ počtem návrhů; pořadí je pevné, od nejcennějších. Vpravo je karta zvoleného údaje s řádkem pro každou modelku (album, číslo), které chybí, a do řádku se píše rovnou: pole je stejného druhu jako ve formuláři modelky (našeptávání z hodnot ve sbírce, výběr u ochlupení nebo tetování, datum s kontrolou, převod <code>5'7"</code>, <code>115 lbs</code> a <code>34B-24-34</code>), u hodnocení srdíčka (klávesy 1–5, klik uloží hned), u titulní fotky odkaz z Disku, u vydání alba RRRR-MM. Návrh je v poli předvyplněný a vedle je jistota a důvod („návrh 97 % · místo narození Texas“). Pod jménem je nápověda, která pomůže (místo narození u národnosti, míry u velikosti prsou). <kbd>Enter</kbd> řádek uloží a skočí na další – nezměněný návrh se přijme, opravený se uloží a program si opravu zapamatuje, jinak se zapíše jen ten údaj; <kbd>Tab</kbd> řádek přeskočí, <kbd>Esc</kbd> vrátí jeho hodnotu, <kbd>Delete</kbd> v prázdném poli (nebo <kbd>Ctrl</kbd>+<kbd>Delete</kbd>) dá „Netýká se“ (u kontroly „V pořádku“), s Vrátit v oznámení. Uložený řádek zůstane na místě ztlumený („✓ uloženo“), aby nic neposkočilo. Text alba se píše v okně editoru, cover a centerfold otevřou svá okna. V hlavičce karty je „✓ Přijmout N návrhů“ (návrhy v řádcích, které jsi neměnil, s potvrzením) a „Netýká se všem…“. „Netýká se“ u údaje modelky platí pro celou část formuláře (základní údaje, vzhled a míry, zařazení) – tak se ukládá.</li>
          <li><strong>Po modelkách</strong>: jedna modelka (nebo číslo) na kartě se všemi úkoly a vpravo fronta „Na řadě“ s jedním výběrem – Vše, Návrhy, Ke kontrole, oblasti a jednotlivé údaje (klik na položku fronty na ni skočí; v úzkém okně je fronta nad kartou za tlačítkem). Úkoly se vyřizují na místě: chybějící údaj má pole jako formulář modelky, titulní fotka pole pro odkaz z Disku, hodnocení srdíčka (klávesy 1–5, když jsou zaměřená); nález kontroly ukáže hodnotu k opravě s důvodem v poli a „V pořádku“; návrh má hodnotu předvyplněnou – ✓ ji uloží (opravenou si program zapamatuje), ✕ ji odmítne. Text a vydání alba, cover a centerfold otevřou své okno. <kbd>Enter</kbd> jde na další pole, <kbd>Esc</kbd> vrátí hodnotu pole, „Uložit a další“ (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>) uloží jen změněná pole a otevře další modelku; „← Zpět“ a „Přeskočit“ (<kbd>PageUp</kbd>, <kbd>PageDown</kbd> nebo <kbd>Alt</kbd>+<kbd>←</kbd> <kbd>→</kbd>) jdou po frontě – u rozepsaných změn se vždy nejdřív zeptá.</li>
          <li><strong>Souhrn</strong>: nahoře <em>pokrok sbírky</em> – celkové procento a pruhy po oblastech (klik na pruh ukáže jen ty úkoly) – a panel „Co se program naučil“, pod nimi celá fronta. Vlevo je seznam filtrů po oblastech s počty – Fronta (Vše, ✦ Návrhy, ⚠ Ke kontrole), Modelky, Alba, Čísla – a dole přepínač „Vyřízené“ (ukáže i „netýká se“, „v pořádku“ a odmítnuté návrhy, aby šly vrátit); u Návrhů a Ke kontrole se pod filtrem ukážou zdroje. V úzkém okně je místo seznamu výběr v liště. Fronta je seřazená podle priority (Playmate bez data narození, titulní fotky a údaje ke kontrole první), jde řadit i podle toho, kolik chybí, nebo podle jména; v liště je hledání (<kbd>Ctrl</kbd>+<kbd>F</kbd> nebo <kbd>/</kbd>) a „⋯ Hromadně“ (rozbalit nebo sbalit vše, přijmout jisté návrhy, „Netýká se“ nebo „V pořádku“ celému výběru – vždy s potvrzením a s Vrátit v oznámení).</li>
          <li>Řádek fronty v Souhrnu je modelka nebo číslo se souhrnem: nejvýš tři štítky („⚠ 2 ke kontrole“, „4 chybí“, „✦ 1 návrh“, u jediné položky přímo ona) a tlačítko hlavního úkolu (Opravit, Přijmout, Doplnit, Přidat cover). Klik na štítek jedné položky ji otevře, šipka vlevo (nebo klik do řádku) řádek rozbalí: každá položka na vlastním řádku s akcemi – <em>Doplnit</em> a <em>Netýká se</em>, <em>Opravit</em> a <em>V pořádku</em>, <em>Přijmout</em>, <em>Upravit…</em> a <em>Odmítnout</em>, ve Vyřízených <em>Vrátit</em>. Pod ⋯ nebo pravým tlačítkem je totéž a navíc „Vyřídit po modelkách“, „Doplnit vše v jednom okně“, „Upravit modelku…“ a profil. Klávesnice: <kbd>Tab</kbd> skočí do fronty, <kbd>↑</kbd> <kbd>↓</kbd> řádky, <kbd>→</kbd> <kbd>←</kbd> rozbalí a sbalí, <kbd>Enter</kbd> hlavní akce, <kbd>Delete</kbd> Netýká se / V pořádku / Odmítnout (jde vrátit), <kbd>E</kbd> upraví návrh, <kbd>S</kbd> otevře modelku v režimu Po modelkách. Po každé akci se fronta překreslí na místě: stránka neposkočí a fokus přejde na další položku.</li>
          <li><strong>Kontrola</strong> hlásí údaje, které vypadají jako překlep: věk při prvním vydání pod 18 nebo nad 45 let, narození a úmrtí v nesmyslném pořadí, výšku, váhu, BMI a míry mimo běžný rozsah (pas širší než boky), Playmate roku dřív než centerfold, dvě centerfoldová alba v jednom čísle, stejné jméno u dvou modelek, album s jednou fotkou s podobným názvem jako jiné album a stejnou fotku ve dvou albech. Kontrola se učí ze sbírky: když je údajů dost, rozsahy výšky, váhy, BMI, měr a věku odvodí z tvých modelek místo pevných hranic, hlásí neobvyklé kombinace údajů (každý zvlášť v pořádku, dohromady ne – např. pas 70 cm při váze 44 kg) a skoro stejná jména dvou modelek (překlep, prohozené jméno a příjmení). Štítek otevře formulář přímo na poli s údajem. Když je údaj pravdivý (modelce opravdu bylo 16 let), dej „V pořádku“ – nález se už nehlásí a kontrola se z toho učí (tři potvrzené podobné hodnoty za hranicí ji posunou, podobné kombinace se přestanou hlásit); u nálezu je vidět, odkud pochází (rozsah z tvé sbírky, pevné pravidlo…), a filtr Kontrola jde zúžit podle zdroje.</li>
          <li><strong>Návrhy</strong> (✦ u údajů v Po údajích, filtr v Souhrnu) nabízejí hodnoty chybějících údajů, které program odhadne z tvé vlastní sbírky: národnost podle místa narození, velikost prsou podle měr, etnicitu, vydání alba nebo fotografa podle podobných modelek a alb. Učí se jen z toho, co máš vyplněné, a nic z počítače neodchází. Procento je jistota odhadu: <em>jisté</em> (od 90 %) u podobných modelek platí skoro vždy, <em>pravděpodobné</em> (od 70 %) většinou, <em>odhad</em> je spíš nápověda k ověření; pod hodnotou je zdroj (✦ Místo narození → národnost…) a důvod a podle zdroje jde návrhy filtrovat. „Přijmout“ údaj rovnou uloží a jde hned vrátit v oznámení, „Upravit…“ otevře formulář na tom poli s předvyplněnou hodnotou – když ji opravíš a uložíš, program si opravu zapamatuje. „Odmítnout“ skryje jen tuto hodnotu (jiná se může nabídnout později); „Vyřízené“ ji ukáže a jde vrátit. „Přijmout jisté (≥ 90 %)“ a „Přijmout vše u modelky“ se před uložením zeptají a vypíšou, co se doplní.</li>
          <li><strong>Co se program naučil</strong> (panel v Souhrnu Údržby): kolik návrhů jsi přijal, odmítl a opravil, a u každého zdroje návrhů jeho přesnost (podíl přijatých); klik na zdroj ukáže jeho návrhy, neaktivní zdroj se teď nepoužívá. Dole je velikost souboru učení a „Zapomenout naučené…“: smaže jen to, co se program naučil z tvých rozhodnutí – sbírka (modelky, alba, fotky ani vyplněné údaje) zůstane beze změny a návrhy se budou zase počítat jen ze sbírky.</li>
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
        <button class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
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
          <!-- Živý náhled záhlaví článku tak, jak bude na stránce čísla (rubrika · strana · druh textu) -->
          <p id="clanekNahledZahlavi" class="clanek-nahled-zahlavi" aria-live="polite"></p>
        </div></header>
        <div class="doplnit-telo">
          <section class="doplnit-blok">
            <h4>Článek</h4>
            <div class="clanek-mrizka-rubrika">
              <div class="doplnit-pole"><label for="inputClanekRubrika">Rubrika</label><input id="inputClanekRubrika" list="seznamRubrik" autocomplete="off" placeholder="např. Playboy Interview" /></div>
              <div class="doplnit-pole"><label for="inputClanekStrana">Strana</label><input id="inputClanekStrana" inputmode="numeric" autocomplete="off" placeholder="27" /></div>
            </div>
            <div class="doplnit-pole clanek-nazev"><label for="inputClanekNazev">Název</label><input id="inputClanekNazev" autocomplete="off" required /></div>
            <div class="clanek-mrizka-2">
              <div class="doplnit-pole"><label for="inputClanekAutor">Autor</label><input id="inputClanekAutor" list="seznamAutoru" autocomplete="off" /></div>
              <div class="doplnit-pole"><label for="inputClanekModelka">Modelka (nepovinné, propojí s profilem)</label><input id="inputClanekModelka" list="seznamModelekClanku" autocomplete="off" placeholder="Jméno ze sbírky" />
                <small id="clanekModelkaInfo" class="cislo-napoveda"></small></div>
            </div>
          </section>
          <section class="doplnit-blok">
            <h4>Text</h4>
            <!-- Text se píše ve společném okně s formátováním (ui/editor-textu.js); hodnota je ve skrytém poli -->
            <div class="doplnit-pole">
              <button type="button" id="clanekTextBtn" class="text-nahled text-nahled-velky" data-editor-textu title="Upravit text článku"><span id="clanekTextNahled"></span></button>
              <textarea id="inputClanekText" class="hidden" aria-hidden="true" tabindex="-1"></textarea>
            </div>
            <div class="clanek-druh">
              <p class="doplnit-napoveda">Klik na text otevře editor. První odstavec je perex, dvojtečka za jménem (PLAYBOY:) zvýrazní mluvčího.</p>
              <div class="doplnit-pole"><label for="selectClanekDruh">Druh textu</label>
                <select id="selectClanekDruh"><option value="">Neuvedeno</option><option value="prepis">Přepis</option><option value="shrnuti">Shrnutí</option></select></div>
            </div>
          </section>
          <section class="doplnit-blok">
            <h4>Skeny stran (nepovinné)</h4>
            <div class="doplnit-pole"><textarea id="inputClanekSkeny" rows="3" aria-label="Skeny stran" aria-describedby="clanekSkenyInfo" placeholder="Odkazy na skeny z Google Disku, jeden na řádek" spellcheck="false"></textarea></div>
            <small id="clanekSkenyInfo" class="cislo-napoveda"></small>
            <div id="clanekSkenyNahled" class="clanek-skeny-nahled"></div>
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

  <!-- Společné okno pro text v markdownu (průvodní text alba, text článku); editor ukazuje text naformátovaný -->
  <div id="textModal" class="modal-overlay hidden">
    <div class="modal-card text-okno">
      <div class="modal-header">
        <h3 id="textModalTitle">Text</h3>
        <button type="button" class="close-btn" data-zavrit title="Zavřít (Esc)" aria-label="Zavřít">&times;</button>
      </div>
      <div class="text-nastroje" role="toolbar" aria-label="Formátování">
        <button type="button" data-nastroj="tucne" title="Tučné (Ctrl+B)" aria-label="Tučné" aria-pressed="false"><b>B</b></button>
        <button type="button" data-nastroj="kurziva" title="Kurzíva (Ctrl+I)" aria-label="Kurzíva" aria-pressed="false"><i>I</i></button>
        <button type="button" data-nastroj="preskrtnute" title="Přeškrtnuté" aria-label="Přeškrtnuté" aria-pressed="false"><s>S</s></button>
        <span class="text-oddelovac"></span>
        <button type="button" data-nastroj="nadpis" title="Nadpis" aria-label="Nadpis" aria-pressed="false">H</button>
        <button type="button" data-nastroj="odrazky" title="Odrážky" aria-label="Odrážky" aria-pressed="false">•</button>
        <button type="button" data-nastroj="cisla" title="Číslovaný seznam" aria-label="Číslovaný seznam" aria-pressed="false">1.</button>
        <button type="button" data-nastroj="citat" title="Citát" aria-label="Citát" aria-pressed="false">„“</button>
        <span class="text-oddelovac"></span>
        <button type="button" data-nastroj="zpet" title="Zpět (Ctrl+Z)" aria-label="Zpět">↶</button>
        <!-- Náhled ukáže text přesně tak, jak bude v profilu nebo ve čtečce -->
        <button type="button" id="textNahledBtn" class="text-nahled-prepinac" title="Ukázat text tak, jak bude vypadat" aria-pressed="false">Náhled</button>
      </div>
      <div id="textEditor" class="text-editor"></div>
      <div id="textNahledCely" class="text-nahled-cely hidden" tabindex="-1"></div>
      <div class="text-pata">
        <p id="textModalNapoveda" class="text-napoveda"></p>
        <span id="textPocet" class="text-pocet" aria-live="polite"></span>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-zavrit>Zrušit</button>
        <button type="button" id="textUlozitBtn" class="btn btn-primary" title="Ctrl+Enter">Použít</button>
      </div>
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
