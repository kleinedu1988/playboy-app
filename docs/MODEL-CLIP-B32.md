# Model pro obsah fotek: CLIP ViT-B/32

Zjištění z prototypu (krok 0 v [NAVRH-OBSAH-FOTEK.md](NAVRH-OBSAH-FOTEK.md)), stav k 6. 11. 2026.
**Rozhodnuto 6. 11. 2026: CLIP ViT-B/32 (int8), vektor pro každou fotku sbírky** – ne jen titulní fotky
a plakáty, ale každá fotka každého alba každé modelky (dnes 18 045 fotek, 580 modelek).

## 1. Zvolený model

| Údaj | Hodnota |
|---|---|
| Model | OpenAI CLIP ViT-B/32, obrazová věž, export do ONNX od Xenova (transformers.js) |
| Repozitář | `Xenova/clip-vit-base-patch32`, revize `6b7c523703ae26e39be4b03774966f8571c7f523` |
| Soubor | `onnx/vision_model_int8.onnx`, 88 648 877 B |
| SHA-256 | `0ab0c1b3ace708e539633af1744d5a95247fe4e14d3e08ff197ef82a6cb9bd93` (ověřeno, shoduje se s LFS oid na HF) |
| Adresa | `https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/6b7c523703ae26e39be4b03774966f8571c7f523/onnx/vision_model_int8.onnx` |
| Licence | MIT |
| Vstup | `pixel_values`, float32 `[1, 3, 224, 224]` (rozměry v modelu dynamické `[-1 -1 -1 -1]`) |
| Výstup | `image_embeds`, float32 `[1, 512]` – po normalizaci na délku 1 se podobnost počítá skalárním součinem |

### Předzpracování (musí se dodržet, jinak vektory neodpovídají modelu)

1. Náhled `w400` z mezipaměti programu (`internal/nahledy`), JPEG.
2. **Celá fotka zmenšená na 224 × 224** (bez ořezu). Oficiální CLIP ořezává střed čtverce, ale u portrétů
   s poměrem ~2:3 tím přijde o hlavu nebo nohy; měřením vyšla celá fotka lépe (oddíl 3).
3. RGB, `x / 255`, pak po kanálech `(x − průměr) / odchylka`:
   průměr `[0.48145466, 0.4578275, 0.40821073]`, odchylka `[0.26862954, 0.26130258, 0.27577711]`.
4. Pořadí v tenzoru CHW (nejdřív celý kanál R, pak G, pak B).
5. Výstup normalizovat (L2) a uložit kvantovaný na int8 + měřítko (512 B na fotku).

### Běhové prostředí

| Údaj | Hodnota |
|---|---|
| Vazba v Go | `github.com/yalue/onnxruntime_go` v1.38.0 (cgo, knihovnu otevírá za běhu) |
| ONNX Runtime | 1.31.1, `onnxruntime-linux-x64-1.31.1.tgz` (11,4 MB) z GitHub releases `microsoft/onnxruntime`; potřeba jen `lib/libonnxruntime.so.1.31.1` |
| Načtení | `ort.SetSharedLibraryPath(cesta)` + `ort.InitializeEnvironment()`; když knihovna chybí, funkce je vypnutá, program běží dál |
| Sezení | `NewDynamicAdvancedSession(model, ["pixel_values"], ["image_embeds"], opt)`, `IntraOpNumThreads = 2`, `InterOpNumThreads = 1` |

## 2. Výkon (Intel i7-8565U, 4 jádra / 8 vláken, AVX2 bez VNNI, 7 GB RAM)

| Měření | CLIP B/32 int8 |
|---|---|
| Načtení modelu | 0,4 s |
| Paměť procesu (RSS) | ~195 MB |
| Inference | 100–150 ms na fotku (2 vlákna) |
| Předzpracování v Go | 30–55 ms (dekódování JPEG + CatmullRom); bilineární zmenšení bude rychlejší |
| Stažení náhledu z Disku | ~3 fotky/s při souběhu 3 (400 fotek za ~2 min) |
| **Celá sbírka 18 045 fotek** | výpočet ~1 h, stahování chybějících náhledů ~1,5 h; běží souběžně → **~1,5 h jednorázově** |
| Vektory celé sbírky | 18 045 × 512 B ≈ **9 MB** (na disku i v paměti) |
| Hledání hrubou silou | 60 ms na 64 000 vektorů v neoptimalizované smyčce → na 18 000 int8 vektorů jednotky ms |

Počet vláken: 2 → 4 → 8 zrychlí jen málo (int8 u SigLIP: 497 / 404 / 452 ms), proto 2 vlákna a počítač zůstane volný.

## 3. Kvalita

Měřeno na dvou vzorcích. Ukazatel: kolik procent fotek má jako nejpodobnější fotku jinou fotku **téže modelky**
(jen podle obrazu, model jména nezná).

**Vzorek A – 200 titulních fotek a plakátů** (z mezipaměti náhledů):

| Model | Nejbližší = táž modelka | Totéž album | Náhoda |
|---|---|---|---|
| SigLIP base int8 | 52 % | 39 % | 1,1 % |
| **CLIP B/32 int8, celá fotka** | **42 %** | **35 %** | 1,1 % |
| CLIP B/32 int8, střed čtverce | 38 % | 28 % | 1,1 % |
| MobileCLIP S0 fp32 | 32 % | 23 % | 1,1 % |
| MobileCLIP S0 int8 | 3 % | 3 % | 1,1 % (kvantizace rozbitá) |

**Vzorek B – fotky z alb: 40 náhodných modelek × 10 náhodných fotek** (pictorialy, centerfoldy, online alba):

| Model | Nejbližší = táž modelka | Totéž album | Z 5 nejpodobnějších táž modelka | Uvnitř modelky: nejpodobnější ze stejného alba |
|---|---|---|---|---|
| SigLIP base int8 | 63 % | 60 % | 37 % | 78 % |
| **CLIP B/32 int8, celá fotka** | **50 %** | **48 %** | **30 %** | **77 %** |
| CLIP B/32 int8, střed čtverce | 45 % | 42 % | 26 % | 71 % |
| Náhoda | 2,3 % | – | 2,3 % | 53 % |

Co z toho plyne:

- **Model poznává hlavně focení, ne osobu.** Když je nejbližší fotka téže modelky, je skoro vždy ze stejného alba
  (50 % proti 48 %). Podobnost = stejná scéna, světlo, oblečení, pozadí, póza. Napříč různými focení téže modelky
  model shodu skoro nenajde – na to by byl potřeba model obličejů, a ten zůstává v „Nedělat“.
- **Uvnitř jedné modelky** třídí fotky podle focení dobře (77 % proti náhodě 53 %): hodí se na „podobné fotky
  téže modelky“, seskupení fotek po focení a hledání téměř stejných fotek (duplikáty, různé ořezy téhož snímku).
- **Napříč sbírkou** najde fotky se stejnou scénou nebo stylem u jiných modelek (pláž, studio, černobílá, stejné
  prostředí) – to je smysl „Podobných fotek“ a později hledání slovy.
- SigLIP je o ~13 bodů lepší napříč sbírkou, uvnitř modelky je stejný (78 % proti 77 %). Za 3–4× delší výpočet,
  1,5× větší vektory (768 proti 512 rozměrům) a horší češtinu to nestojí.
- Ořez na střed vždy uškodil (−4 až −7 bodů) → **celá fotka**.

## 4. Textová věž pro etapu 2 (hledání slovy česky)

| Údaj | Hodnota |
|---|---|
| Model | `sentence-transformers/clip-ViT-B-32-multilingual-v1` (Apache-2.0), revize `58edf8cada9e398793dca955574a48cbb7f18be2` |
| Princip | vícejazyčný DistilBERT naučený mapovat věty (50+ jazyků včetně češtiny) do **stejného prostoru jako obrazová věž CLIP B/32** → vektory fotek z etapy 1 platí beze změny |
| ONNX | `onnx/model_quint8_avx2.onnx`, 135 MB (je i `model.onnx` 539 MB) |
| Tokenizace | WordPiece (`vocab.txt`, ~1 MB) – jednoduchá, napíše se v Go bez knihovny (SentencePiece není potřeba) |
| Ověřit | ONNX obsahuje jen transformer (výstup 768 na token); **průměrování tokenů (`1_Pooling`) a lineární vrstva 768 → 512 (`2_Dense`)** se dopočítají v Go – váhy Dense (~1,5 MB) bude potřeba vyexportovat a hashovat zvlášť |

Alternativa bez dalšího modelu: anglická textová věž `Xenova/clip-vit-base-patch32` `onnx/text_model_int8.onnx`
(64 MB, SHA-256 `18845f2ccc35223bb7fec403383a131154b11ac0918df25cf51986df5efd3a21`) + český slovník → angličtina.

## 5. Zamítnuté varianty

| Model | Proč ne |
|---|---|
| SigLIP base 224 int8 (`Xenova/siglip-base-patch16-224`, 94 MB) | 400–500 ms na fotku (4× pomalejší), čeština jen přes slovník nebo vícejazyčný model 370 MB |
| SigLIP fp32 (372 MB) | pomalejší než int8 a 600–1 200 MB RAM |
| MobileCLIP S0 fp32 (46 MB) | stejně rychlý jako CLIP B/32, ale znatelně horší (32 % proti 42 %) a bez české textové věže |
| MobileCLIP S0 int8 (12 MB) | kvantizace konvolucí v ONNX Runtime na CPU: 890 ms a nepoužitelné vektory |
| Ořez na střed čtverce | horší ve všech měřeních |

## 6. Postup měření (k zopakování)

Prototyp v Go (mimo repozitář): načte `libonnxruntime.so` přes `SetSharedLibraryPath`, předzpracuje náhledy
podle oddílu 1, uloží vektory do TSV. Kvalita se počítá skriptem v Pythonu nad **kopií** databáze otevřenou jen
pro čtení (`fotky` → `alba.modelka_id`, `alba.id`). Vzorek B: náhodné modelky s ≥ 20 dostupnými fotkami
(`nedostupne_od IS NULL`), semínko 7, náhledy `https://lh3.googleusercontent.com/d/<id>=w400` se souběhem 3.

Ukazatele:

- **Nejbližší = táž modelka:** podíl fotek, jejichž nejpodobnější jiná fotka ve vzorku patří téže modelce.
- **Z 5 nejpodobnějších:** průměrný podíl fotek téže modelky mezi pěti nejpodobnějšími.
- **Uvnitř modelky:** jen mezi fotkami téže modelky, která má ve vzorku fotky z víc alb – podíl, kdy je
  nejpodobnější fotka ze stejného alba; náhoda = podíl fotek z téhož alba mezi jejími fotkami.
