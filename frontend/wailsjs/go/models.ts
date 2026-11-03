export namespace main {
	
	export class OdkazModelky {
	    id: number;
	    jmeno: string;
	
	    static createFrom(source: any = {}) {
	        return new OdkazModelky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.jmeno = source["jmeno"];
	    }
	}
	export class AlbumFronty {
	    modelkaId: number;
	    jmenoModelky: string;
	    album: string;
	    typ: string;
	    vydani?: string;
	    spojit?: boolean;
	    popis?: string;
	    fotograf?: string;
	    datumAlba?: string;
	    dalsiModelky?: OdkazModelky[];
	
	    static createFrom(source: any = {}) {
	        return new AlbumFronty(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.jmenoModelky = source["jmenoModelky"];
	        this.album = source["album"];
	        this.typ = source["typ"];
	        this.vydani = source["vydani"];
	        this.spojit = source["spojit"];
	        this.popis = source["popis"];
	        this.fotograf = source["fotograf"];
	        this.datumAlba = source["datumAlba"];
	        this.dalsiModelky = this.convertValues(source["dalsiModelky"], OdkazModelky);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BodVyvoje {
	    obdobi: number;
	    median: number;
	    dolni: number;
	    horni: number;
	    n: number;
	
	    static createFrom(source: any = {}) {
	        return new BodVyvoje(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.obdobi = source["obdobi"];
	        this.median = source["median"];
	        this.dolni = source["dolni"];
	        this.horni = source["horni"];
	        this.n = source["n"];
	    }
	}
	export class BodySezony {
	    modelkaId: number;
	    body: number;
	    zaSouboje: number;
	    zaZajem: number;
	    vyhry: number;
	    remizy: number;
	    prohry: number;
	    souboju: number;
	    misto: number;
	    trend: number;
	    soutezi: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BodySezony(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.body = source["body"];
	        this.zaSouboje = source["zaSouboje"];
	        this.zaZajem = source["zaZajem"];
	        this.vyhry = source["vyhry"];
	        this.remizy = source["remizy"];
	        this.prohry = source["prohry"];
	        this.souboju = source["souboju"];
	        this.misto = source["misto"];
	        this.trend = source["trend"];
	        this.soutezi = source["soutezi"];
	    }
	}
	export class CekaniNaUroven {
	    uroven: number;
	    porovnani: number;
	    potrebaPorovnani: number;
	    nejistota: number;
	    maxNejistota: number;
	    potrebaVyhry: boolean;
	    maVyhru: boolean;
	    drzitelka?: number;
	
	    static createFrom(source: any = {}) {
	        return new CekaniNaUroven(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uroven = source["uroven"];
	        this.porovnani = source["porovnani"];
	        this.potrebaPorovnani = source["potrebaPorovnani"];
	        this.nejistota = source["nejistota"];
	        this.maxNejistota = source["maxNejistota"];
	        this.potrebaVyhry = source["potrebaVyhry"];
	        this.maVyhru = source["maVyhru"];
	        this.drzitelka = source["drzitelka"];
	    }
	}
	export class Clanek {
	    id: number;
	    vydani: string;
	    strana: number;
	    rubrika: string;
	    nazev: string;
	    autor: string;
	    modelkaId: number;
	    jmenoModelky: string;
	    druh: string;
	    text: string;
	    skeny: string[];
	    skenyUrl: string[];
	    skenyOdkazy: string;
	
	    static createFrom(source: any = {}) {
	        return new Clanek(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.vydani = source["vydani"];
	        this.strana = source["strana"];
	        this.rubrika = source["rubrika"];
	        this.nazev = source["nazev"];
	        this.autor = source["autor"];
	        this.modelkaId = source["modelkaId"];
	        this.jmenoModelky = source["jmenoModelky"];
	        this.druh = source["druh"];
	        this.text = source["text"];
	        this.skeny = source["skeny"];
	        this.skenyUrl = source["skenyUrl"];
	        this.skenyOdkazy = source["skenyOdkazy"];
	    }
	}
	export class DesetiletiStatistiky {
	    desetileti: number;
	    centerfoldy: number;
	    cisla: number;
	    edice: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new DesetiletiStatistiky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.desetileti = source["desetileti"];
	        this.centerfoldy = source["centerfoldy"];
	        this.cisla = source["cisla"];
	        this.edice = source["edice"];
	    }
	}
	export class DvojicePorovnani {
	    a: number;
	    b: number;
	    duvod: string;
	    druh: string;
	
	    static createFrom(source: any = {}) {
	        return new DvojicePorovnani(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.a = source["a"];
	        this.b = source["b"];
	        this.duvod = source["duvod"];
	        this.druh = source["druh"];
	    }
	}
	export class FotkaFronty {
	    id: number;
	    albumId: number;
	    driveId: string;
	    rotace?: number;
	    hodnoceni?: number;
	
	    static createFrom(source: any = {}) {
	        return new FotkaFronty(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.albumId = source["albumId"];
	        this.driveId = source["driveId"];
	        this.rotace = source["rotace"];
	        this.hodnoceni = source["hodnoceni"];
	    }
	}
	export class Fotografie {
	    id: number;
	    modelkaId: number;
	    album: string;
	    typ: string;
	    url: string;
	    rotace: number;
	    spojit: boolean;
	    jmenoModelky: string;
	    vydani: string;
	    popis: string;
	    fotograf: string;
	    datumAlba: string;
	    hodnoceni: number;
	    poradi: number;
	    pridano: string;
	    dalsiModelky: OdkazModelky[];
	    driveId: string;
	    albumId: number;
	
	    static createFrom(source: any = {}) {
	        return new Fotografie(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.modelkaId = source["modelkaId"];
	        this.album = source["album"];
	        this.typ = source["typ"];
	        this.url = source["url"];
	        this.rotace = source["rotace"];
	        this.spojit = source["spojit"];
	        this.jmenoModelky = source["jmenoModelky"];
	        this.vydani = source["vydani"];
	        this.popis = source["popis"];
	        this.fotograf = source["fotograf"];
	        this.datumAlba = source["datumAlba"];
	        this.hodnoceni = source["hodnoceni"];
	        this.poradi = source["poradi"];
	        this.pridano = source["pridano"];
	        this.dalsiModelky = this.convertValues(source["dalsiModelky"], OdkazModelky);
	        this.driveId = source["driveId"];
	        this.albumId = source["albumId"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class FrontaFotek {
	    sablona: string;
	    fotky: FotkaFronty[];
	    alba: Record<number, AlbumFronty>;
	
	    static createFrom(source: any = {}) {
	        return new FrontaFotek(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sablona = source["sablona"];
	        this.fotky = this.convertValues(source["fotky"], FotkaFronty);
	        this.alba = this.convertValues(source["alba"], AlbumFronty, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PodminkaTematu {
	    druh: string;
	    klic: string;
	    hodnoty: string[];
	
	    static createFrom(source: any = {}) {
	        return new PodminkaTematu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.druh = source["druh"];
	        this.klic = source["klic"];
	        this.hodnoty = source["hodnoty"];
	    }
	}
	export class InfoTematu {
	    klic: string;
	    nazev: string;
	    podminky: PodminkaTematu[];
	    ikona: string;
	    skupina: string;
	    popis: string;
	    soutezicich: number;
	    fotek: number;
	    plati: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InfoTematu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.podminky = this.convertValues(source["podminky"], PodminkaTematu);
	        this.ikona = source["ikona"];
	        this.skupina = source["skupina"];
	        this.popis = source["popis"];
	        this.soutezicich = source["soutezicich"];
	        this.fotek = source["fotek"];
	        this.plati = source["plati"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KandidatkaTematu {
	    modelkaId: number;
	    fotek: number;
	    chybi: number;
	    neznamych: number;
	
	    static createFrom(source: any = {}) {
	        return new KandidatkaTematu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.fotek = source["fotek"];
	        this.chybi = source["chybi"];
	        this.neznamych = source["neznamych"];
	    }
	}
	export class PodilVyvoje {
	    obdobi: number;
	    pocty: Record<string, number>;
	    n: number;
	
	    static createFrom(source: any = {}) {
	        return new PodilVyvoje(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.obdobi = source["obdobi"];
	        this.pocty = source["pocty"];
	        this.n = source["n"];
	    }
	}
	export class KategorieVyvoje {
	    klic: string;
	    nazev: string;
	    kategorie: string[];
	    radek: string;
	    nazevRadku: string;
	    znamych: number;
	    chybi: number[];
	    desetileti: PodilVyvoje[];
	
	    static createFrom(source: any = {}) {
	        return new KategorieVyvoje(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.kategorie = source["kategorie"];
	        this.radek = source["radek"];
	        this.nazevRadku = source["nazevRadku"];
	        this.znamych = source["znamych"];
	        this.chybi = source["chybi"];
	        this.desetileti = this.convertValues(source["desetileti"], PodilVyvoje);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NedostupnySoubor {
	    fotoId: number;
	    modelkaId: number;
	    jmeno: string;
	    album: string;
	    typ: string;
	    opakovane: boolean;
	
	    static createFrom(source: any = {}) {
	        return new NedostupnySoubor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fotoId = source["fotoId"];
	        this.modelkaId = source["modelkaId"];
	        this.jmeno = source["jmeno"];
	        this.album = source["album"];
	        this.typ = source["typ"];
	        this.opakovane = source["opakovane"];
	    }
	}
	export class KontrolaSouboru {
	    zkontrolovano: number;
	    nedostupne: NedostupnySoubor[];
	    neovereno: number;
	    davka: boolean;
	
	    static createFrom(source: any = {}) {
	        return new KontrolaSouboru(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.zkontrolovano = source["zkontrolovano"];
	        this.nedostupne = this.convertValues(source["nedostupne"], NedostupnySoubor);
	        this.neovereno = source["neovereno"];
	        this.davka = source["davka"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TlumeniKroku {
	    moznosti: string[];
	    kdyz: PodminkaKroku;
	
	    static createFrom(source: any = {}) {
	        return new TlumeniKroku(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.moznosti = source["moznosti"];
	        this.kdyz = this.convertValues(source["kdyz"], PodminkaKroku);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PodminkaKroku {
	    tagy: string[];
	    ne: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PodminkaKroku(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.tagy = source["tagy"];
	        this.ne = source["ne"];
	    }
	}
	export class MoznostKroku {
	    klic: string;
	    nazev: string;
	    skupina: string;
	    vylucna: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MoznostKroku(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.skupina = source["skupina"];
	        this.vylucna = source["vylucna"];
	    }
	}
	export class KrokPruvodce {
	    klic: string;
	    nazev: string;
	    typ: string;
	    povinny: boolean;
	    nula: string;
	    moznosti: MoznostKroku[];
	    preskocit?: PodminkaKroku;
	    tlumit: TlumeniKroku[];
	    predvyplnit: string[];
	    skupiny: string[];
	
	    static createFrom(source: any = {}) {
	        return new KrokPruvodce(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.typ = source["typ"];
	        this.povinny = source["povinny"];
	        this.nula = source["nula"];
	        this.moznosti = this.convertValues(source["moznosti"], MoznostKroku);
	        this.preskocit = this.convertValues(source["preskocit"], PodminkaKroku);
	        this.tlumit = this.convertValues(source["tlumit"], TlumeniKroku);
	        this.predvyplnit = source["predvyplnit"];
	        this.skupiny = source["skupiny"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KrokyPruvodce {
	    verze: number;
	    kroky: KrokPruvodce[];
	
	    static createFrom(source: any = {}) {
	        return new KrokyPruvodce(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.verze = source["verze"];
	        this.kroky = this.convertValues(source["kroky"], KrokPruvodce);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MinulaSezona {
	    klic: string;
	    nazev: string;
	    kratky: string;
	    obdobi: string;
	    od: string;
	    do: string;
	    tema: string;
	    favoritka: number;
	    milacek: number;
	    body: number;
	    souboju: number;
	
	    static createFrom(source: any = {}) {
	        return new MinulaSezona(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.kratky = source["kratky"];
	        this.obdobi = source["obdobi"];
	        this.od = source["od"];
	        this.do = source["do"];
	        this.tema = source["tema"];
	        this.favoritka = source["favoritka"];
	        this.milacek = source["milacek"];
	        this.body = source["body"];
	        this.souboju = source["souboju"];
	    }
	}
	export class Modelka {
	    id: number;
	    jmeno: string;
	    narozeniDatum: string;
	    umrtiDatum: string;
	    narozeniMisto: string;
	    narodnost: string;
	    etnicita: string;
	    vyskaCm: number;
	    vahaKg: number;
	    vlasyBarva: string;
	    ociBarva: string;
	    miry: string;
	    obvodHrudnikCm: number;
	    obvodPasCm: number;
	    obvodBokyCm: number;
	    velikostPrsou: string;
	    prsaTyp: string;
	    ochlupeni: string;
	    tetovani: number;
	    piercing: number;
	    vystoupeni: string;
	    pictorialVydani: string;
	    role: string;
	    tags: string;
	    coverUrl: string;
	    coverId: string;
	    coverZoom: number;
	    coverX: number;
	    coverY: number;
	    pocetFotek: number;
	    vydani: string[];
	    dalsiJmena: string;
	    poznamka: string;
	    hodnoceni: number;
	    oblibenost: number;
	    odhadHodnoceni: number;
	    poradi: number;
	    zmenaPoradi: number;
	    trendDni: number;
	    urovenTop: number;
	    cekaNaTop: number;
	    obhajujeTop: number;
	    pridano: string;
	    netykaSe: string;
	    odkazy: string;
	    obalky: string[];
	    centerfoldy: string[];
	    onlineAlba: string[];
	    cyberGirl: string;
	    playmateMesice: boolean;
	    playmateRoku: string;
	
	    static createFrom(source: any = {}) {
	        return new Modelka(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.jmeno = source["jmeno"];
	        this.narozeniDatum = source["narozeniDatum"];
	        this.umrtiDatum = source["umrtiDatum"];
	        this.narozeniMisto = source["narozeniMisto"];
	        this.narodnost = source["narodnost"];
	        this.etnicita = source["etnicita"];
	        this.vyskaCm = source["vyskaCm"];
	        this.vahaKg = source["vahaKg"];
	        this.vlasyBarva = source["vlasyBarva"];
	        this.ociBarva = source["ociBarva"];
	        this.miry = source["miry"];
	        this.obvodHrudnikCm = source["obvodHrudnikCm"];
	        this.obvodPasCm = source["obvodPasCm"];
	        this.obvodBokyCm = source["obvodBokyCm"];
	        this.velikostPrsou = source["velikostPrsou"];
	        this.prsaTyp = source["prsaTyp"];
	        this.ochlupeni = source["ochlupeni"];
	        this.tetovani = source["tetovani"];
	        this.piercing = source["piercing"];
	        this.vystoupeni = source["vystoupeni"];
	        this.pictorialVydani = source["pictorialVydani"];
	        this.role = source["role"];
	        this.tags = source["tags"];
	        this.coverUrl = source["coverUrl"];
	        this.coverId = source["coverId"];
	        this.coverZoom = source["coverZoom"];
	        this.coverX = source["coverX"];
	        this.coverY = source["coverY"];
	        this.pocetFotek = source["pocetFotek"];
	        this.vydani = source["vydani"];
	        this.dalsiJmena = source["dalsiJmena"];
	        this.poznamka = source["poznamka"];
	        this.hodnoceni = source["hodnoceni"];
	        this.oblibenost = source["oblibenost"];
	        this.odhadHodnoceni = source["odhadHodnoceni"];
	        this.poradi = source["poradi"];
	        this.zmenaPoradi = source["zmenaPoradi"];
	        this.trendDni = source["trendDni"];
	        this.urovenTop = source["urovenTop"];
	        this.cekaNaTop = source["cekaNaTop"];
	        this.obhajujeTop = source["obhajujeTop"];
	        this.pridano = source["pridano"];
	        this.netykaSe = source["netykaSe"];
	        this.odkazy = source["odkazy"];
	        this.obalky = source["obalky"];
	        this.centerfoldy = source["centerfoldy"];
	        this.onlineAlba = source["onlineAlba"];
	        this.cyberGirl = source["cyberGirl"];
	        this.playmateMesice = source["playmateMesice"];
	        this.playmateRoku = source["playmateRoku"];
	    }
	}
	
	export class NalezClanku {
	    id: number;
	    vydani: string;
	    strana: number;
	    rubrika: string;
	    nazev: string;
	    jmenoModelky: string;
	    ukazka: string;
	
	    static createFrom(source: any = {}) {
	        return new NalezClanku(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.vydani = source["vydani"];
	        this.strana = source["strana"];
	        this.rubrika = source["rubrika"];
	        this.nazev = source["nazev"];
	        this.jmenoModelky = source["jmenoModelky"];
	        this.ukazka = source["ukazka"];
	    }
	}
	export class NalezTextu {
	    druh: string;
	    zdrojId: number;
	    vydani: string;
	    nazev: string;
	    rubrika: string;
	    autor: string;
	    modelkaId: number;
	    ukazka: string;
	    relevance: number;
	
	    static createFrom(source: any = {}) {
	        return new NalezTextu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.druh = source["druh"];
	        this.zdrojId = source["zdrojId"];
	        this.vydani = source["vydani"];
	        this.nazev = source["nazev"];
	        this.rubrika = source["rubrika"];
	        this.autor = source["autor"];
	        this.modelkaId = source["modelkaId"];
	        this.ukazka = source["ukazka"];
	        this.relevance = source["relevance"];
	    }
	}
	export class NavrhDoplneni {
	    modelkaId: number;
	    jmeno: string;
	    album: string;
	    typ: string;
	    pole: string;
	    popis: string;
	    hodnota: string;
	    jistota: number;
	    duvod: string;
	    klic: string;
	    inputId: string;
	    odmitnuto: boolean;
	    zdroj: string;
	    zdrojPopis: string;
	
	    static createFrom(source: any = {}) {
	        return new NavrhDoplneni(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.jmeno = source["jmeno"];
	        this.album = source["album"];
	        this.typ = source["typ"];
	        this.pole = source["pole"];
	        this.popis = source["popis"];
	        this.hodnota = source["hodnota"];
	        this.jistota = source["jistota"];
	        this.duvod = source["duvod"];
	        this.klic = source["klic"];
	        this.inputId = source["inputId"];
	        this.odmitnuto = source["odmitnuto"];
	        this.zdroj = source["zdroj"];
	        this.zdrojPopis = source["zdrojPopis"];
	    }
	}
	export class NavrhTematu {
	    klic: string;
	    nazev: string;
	    podminky: PodminkaTematu[];
	    ikona: string;
	    skupina: string;
	    popis: string;
	    soutezicich: number;
	    fotek: number;
	    plati: boolean;
	    dni: number;
	    souboju: number;
	    duvod: string;
	    ukazky: number[];
	    stitek: string;
	
	    static createFrom(source: any = {}) {
	        return new NavrhTematu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.podminky = this.convertValues(source["podminky"], PodminkaTematu);
	        this.ikona = source["ikona"];
	        this.skupina = source["skupina"];
	        this.popis = source["popis"];
	        this.soutezicich = source["soutezicich"];
	        this.fotek = source["fotek"];
	        this.plati = source["plati"];
	        this.dni = source["dni"];
	        this.souboju = source["souboju"];
	        this.duvod = source["duvod"];
	        this.ukazky = source["ukazky"];
	        this.stitek = source["stitek"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NavrhSezony {
	    klic: string;
	    den: number;
	    tempo: number;
	    navrhy: NavrhTematu[];
	    klasicka: NavrhTematu;
	    vsechna: NavrhTematu[];
	    delky: number[];
	
	    static createFrom(source: any = {}) {
	        return new NavrhSezony(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.den = source["den"];
	        this.tempo = source["tempo"];
	        this.navrhy = this.convertValues(source["navrhy"], NavrhTematu);
	        this.klasicka = this.convertValues(source["klasicka"], NavrhTematu);
	        this.vsechna = this.convertValues(source["vsechna"], NavrhTematu);
	        this.delky = source["delky"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NesouladSrdicek {
	    modelkaId: number;
	    jmeno: string;
	    hodnoceni: number;
	    navrh: number;
	    smer: string;
	    zdroj: string;
	    porovnani: number;
	    vysledky: number;
	    rozdil: number;
	
	    static createFrom(source: any = {}) {
	        return new NesouladSrdicek(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.jmeno = source["jmeno"];
	        this.hodnoceni = source["hodnoceni"];
	        this.navrh = source["navrh"];
	        this.smer = source["smer"];
	        this.zdroj = source["zdroj"];
	        this.porovnani = source["porovnani"];
	        this.vysledky = source["vysledky"];
	        this.rozdil = source["rozdil"];
	    }
	}
	export class NavrhSrdicek {
	    hodnoceni: number;
	    porovnani: number;
	    vyhry: number;
	    nejistota: number;
	    nesoulad?: NesouladSrdicek;
	
	    static createFrom(source: any = {}) {
	        return new NavrhSrdicek(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hodnoceni = source["hodnoceni"];
	        this.porovnani = source["porovnani"];
	        this.vyhry = source["vyhry"];
	        this.nejistota = source["nejistota"];
	        this.nesoulad = this.convertValues(source["nesoulad"], NesouladSrdicek);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	export class ObhajobaUrovne {
	    uroven: number;
	    vyzyvatelka: number;
	
	    static createFrom(source: any = {}) {
	        return new ObhajobaUrovne(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uroven = source["uroven"];
	        this.vyzyvatelka = source["vyzyvatelka"];
	    }
	}
	export class OblibenostModelky {
	    modelkaId: number;
	    jmeno: string;
	    hodnoceni: number;
	    sila: number;
	    nejistota: number;
	    poradi: number;
	    porovnani: number;
	    odhad: number;
	    skoreFotek: number;
	    albFotek: number;
	    fotekHodnocenych: number;
	    jenOdhad: boolean;
	    zdrojOdhadu: string;
	    zajem: number;
	    trend: number;
	    zmenaPoradi: number;
	    duvod: string;
	    mistoPodleSily: number;
	    uroven: number;
	    ceka?: CekaniNaUroven;
	    obhajoba?: ObhajobaUrovne;
	
	    static createFrom(source: any = {}) {
	        return new OblibenostModelky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.jmeno = source["jmeno"];
	        this.hodnoceni = source["hodnoceni"];
	        this.sila = source["sila"];
	        this.nejistota = source["nejistota"];
	        this.poradi = source["poradi"];
	        this.porovnani = source["porovnani"];
	        this.odhad = source["odhad"];
	        this.skoreFotek = source["skoreFotek"];
	        this.albFotek = source["albFotek"];
	        this.fotekHodnocenych = source["fotekHodnocenych"];
	        this.jenOdhad = source["jenOdhad"];
	        this.zdrojOdhadu = source["zdrojOdhadu"];
	        this.zajem = source["zajem"];
	        this.trend = source["trend"];
	        this.zmenaPoradi = source["zmenaPoradi"];
	        this.duvod = source["duvod"];
	        this.mistoPodleSily = source["mistoPodleSily"];
	        this.uroven = source["uroven"];
	        this.ceka = this.convertValues(source["ceka"], CekaniNaUroven);
	        this.obhajoba = this.convertValues(source["obhajoba"], ObhajobaUrovne);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class VyberFotky {
	    vyberId: number;
	    poradi: number;
	
	    static createFrom(source: any = {}) {
	        return new VyberFotky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vyberId = source["vyberId"];
	        this.poradi = source["poradi"];
	    }
	}
	export class ObnovaFotky {
	    vybery: VyberFotky[];
	    dalsiModelky: number[];
	    netykaSe: string;
	    modelkaId: number;
	    album: string;
	    typ: string;
	    driveId: string;
	    vydani: string;
	    datum: string;
	    rotace: number;
	    spojit: boolean;
	    hodnoceni: number;
	    poradi: number;
	    pridano: string;
	    popis: string;
	    fotograf: string;
	
	    static createFrom(source: any = {}) {
	        return new ObnovaFotky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vybery = this.convertValues(source["vybery"], VyberFotky);
	        this.dalsiModelky = source["dalsiModelky"];
	        this.netykaSe = source["netykaSe"];
	        this.modelkaId = source["modelkaId"];
	        this.album = source["album"];
	        this.typ = source["typ"];
	        this.driveId = source["driveId"];
	        this.vydani = source["vydani"];
	        this.datum = source["datum"];
	        this.rotace = source["rotace"];
	        this.spojit = source["spojit"];
	        this.hodnoceni = source["hodnoceni"];
	        this.poradi = source["poradi"];
	        this.pridano = source["pridano"];
	        this.popis = source["popis"];
	        this.fotograf = source["fotograf"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class OdznakModelky {
	    modelkaId: number;
	    odznak: string;
	    stupen: number;
	    ziskan: boolean;
	    hodnota: number;
	    dalsi: number;
	    souperka: number;
	    cas: string;
	
	    static createFrom(source: any = {}) {
	        return new OdznakModelky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.odznak = source["odznak"];
	        this.stupen = source["stupen"];
	        this.ziskan = source["ziskan"];
	        this.hodnota = source["hodnota"];
	        this.dalsi = source["dalsi"];
	        this.souperka = source["souperka"];
	        this.cas = source["cas"];
	    }
	}
	export class PodezrelyUdaj {
	    modelkaId: number;
	    jmeno: string;
	    popis: string;
	    klic: string;
	    album: string;
	    typ: string;
	    pole: string;
	    netykaSe: boolean;
	    zdroj: string;
	
	    static createFrom(source: any = {}) {
	        return new PodezrelyUdaj(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.jmeno = source["jmeno"];
	        this.popis = source["popis"];
	        this.klic = source["klic"];
	        this.album = source["album"];
	        this.typ = source["typ"];
	        this.pole = source["pole"];
	        this.netykaSe = source["netykaSe"];
	        this.zdroj = source["zdroj"];
	    }
	}
	
	
	
	export class PokrytiTematu {
	    klic: string;
	    nazev: string;
	    podminky: PodminkaTematu[];
	    ikona: string;
	    skupina: string;
	    popis: string;
	    soutezicich: number;
	    fotek: number;
	    plati: boolean;
	    chybiModelek: number;
	    fotekKOdemceni: number;
	    kandidatky: KandidatkaTematu[];
	    minFotek: number;
	    minModelek: number;
	
	    static createFrom(source: any = {}) {
	        return new PokrytiTematu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.podminky = this.convertValues(source["podminky"], PodminkaTematu);
	        this.ikona = source["ikona"];
	        this.skupina = source["skupina"];
	        this.popis = source["popis"];
	        this.soutezicich = source["soutezicich"];
	        this.fotek = source["fotek"];
	        this.plati = source["plati"];
	        this.chybiModelek = source["chybiModelek"];
	        this.fotekKOdemceni = source["fotekKOdemceni"];
	        this.kandidatky = this.convertValues(source["kandidatky"], KandidatkaTematu);
	        this.minFotek = source["minFotek"];
	        this.minModelek = source["minModelek"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PolozkaHodnoceni {
	    modelkaId: number;
	    druh: string;
	    odhad: number;
	    nejistota: number;
	    duvod: string;
	    hodnoceni: number;
	    navrh: number;
	    nesoulad?: NesouladSrdicek;
	
	    static createFrom(source: any = {}) {
	        return new PolozkaHodnoceni(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.druh = source["druh"];
	        this.odhad = source["odhad"];
	        this.nejistota = source["nejistota"];
	        this.duvod = source["duvod"];
	        this.hodnoceni = source["hodnoceni"];
	        this.navrh = source["navrh"];
	        this.nesoulad = this.convertValues(source["nesoulad"], NesouladSrdicek);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PolozkaOblibenosti {
	    modelkaId: number;
	    jmeno: string;
	    hodnoceni: number;
	    poradi: number;
	    zmenaPoradi: number;
	    dni: number;
	    uroven: number;
	
	    static createFrom(source: any = {}) {
	        return new PolozkaOblibenosti(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.jmeno = source["jmeno"];
	        this.hodnoceni = source["hodnoceni"];
	        this.poradi = source["poradi"];
	        this.zmenaPoradi = source["zmenaPoradi"];
	        this.dni = source["dni"];
	        this.uroven = source["uroven"];
	    }
	}
	export class PolozkaPrehledu {
	    netykaSe: boolean;
	    modelkaId: number;
	    jmeno: string;
	    album: string;
	    typ: string;
	
	    static createFrom(source: any = {}) {
	        return new PolozkaPrehledu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.netykaSe = source["netykaSe"];
	        this.modelkaId = source["modelkaId"];
	        this.jmeno = source["jmeno"];
	        this.album = source["album"];
	        this.typ = source["typ"];
	    }
	}
	export class PolozkaStatistiky {
	    nazev: string;
	    pocet: number;
	
	    static createFrom(source: any = {}) {
	        return new PolozkaStatistiky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nazev = source["nazev"];
	        this.pocet = source["pocet"];
	    }
	}
	export class StavFotkyPruvodce {
	    id: number;
	    tagy: string[];
	    hodnoceni: number;
	    verze: number;
	    hotovo: string;
	
	    static createFrom(source: any = {}) {
	        return new StavFotkyPruvodce(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tagy = source["tagy"];
	        this.hodnoceni = source["hodnoceni"];
	        this.verze = source["verze"];
	        this.hotovo = source["hotovo"];
	    }
	}
	export class PredchoziPruvodce {
	    ok: boolean;
	    fotky: StavFotkyPruvodce[];
	
	    static createFrom(source: any = {}) {
	        return new PredchoziPruvodce(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.fotky = this.convertValues(source["fotky"], StavFotkyPruvodce);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RocnikPrehledu {
	    rok: number;
	    edice: string;
	    vydani: number;
	    mesice: boolean[];
	
	    static createFrom(source: any = {}) {
	        return new RocnikPrehledu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rok = source["rok"];
	        this.edice = source["edice"];
	        this.vydani = source["vydani"];
	        this.mesice = source["mesice"];
	    }
	}
	export class Prehled {
	    modelek: number;
	    alb: number;
	    albOnline: number;
	    fotek: number;
	    hodnocenychFotek: number;
	    coveru: number;
	    vydani: number;
	    bezTitulni: PolozkaPrehledu[];
	    bezNarozeni: PolozkaPrehledu[];
	    bezCenterfoldu: PolozkaPrehledu[];
	    bezHodnoceni: PolozkaPrehledu[];
	    albaBezPopisu: PolozkaPrehledu[];
	    albaBezVydani: PolozkaPrehledu[];
	    vydaniBezCoveru: string[];
	    vydaniBezCenterfoldu: string[];
	    rocniky: RocnikPrehledu[];
	    podezrele: PodezrelyUdaj[];
	    navrhu: number;
	
	    static createFrom(source: any = {}) {
	        return new Prehled(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelek = source["modelek"];
	        this.alb = source["alb"];
	        this.albOnline = source["albOnline"];
	        this.fotek = source["fotek"];
	        this.hodnocenychFotek = source["hodnocenychFotek"];
	        this.coveru = source["coveru"];
	        this.vydani = source["vydani"];
	        this.bezTitulni = this.convertValues(source["bezTitulni"], PolozkaPrehledu);
	        this.bezNarozeni = this.convertValues(source["bezNarozeni"], PolozkaPrehledu);
	        this.bezCenterfoldu = this.convertValues(source["bezCenterfoldu"], PolozkaPrehledu);
	        this.bezHodnoceni = this.convertValues(source["bezHodnoceni"], PolozkaPrehledu);
	        this.albaBezPopisu = this.convertValues(source["albaBezPopisu"], PolozkaPrehledu);
	        this.albaBezVydani = this.convertValues(source["albaBezVydani"], PolozkaPrehledu);
	        this.vydaniBezCoveru = source["vydaniBezCoveru"];
	        this.vydaniBezCenterfoldu = source["vydaniBezCenterfoldu"];
	        this.rocniky = this.convertValues(source["rocniky"], RocnikPrehledu);
	        this.podezrele = this.convertValues(source["podezrele"], PodezrelyUdaj);
	        this.navrhu = source["navrhu"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PrehledOblibenosti {
	    top: PolozkaOblibenosti[];
	    stoupaji: PolozkaOblibenosti[];
	    klesaji: PolozkaOblibenosti[];
	    dlouhoNevidene: PolozkaOblibenosti[];
	    trendDni: number;
	    zajemDni: number;
	
	    static createFrom(source: any = {}) {
	        return new PrehledOblibenosti(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.top = this.convertValues(source["top"], PolozkaOblibenosti);
	        this.stoupaji = this.convertValues(source["stoupaji"], PolozkaOblibenosti);
	        this.klesaji = this.convertValues(source["klesaji"], PolozkaOblibenosti);
	        this.dlouhoNevidene = this.convertValues(source["dlouhoNevidene"], PolozkaOblibenosti);
	        this.trendDni = source["trendDni"];
	        this.zajemDni = source["zajemDni"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PropadleTema {
	    klic: string;
	    nazev: string;
	    ikona: string;
	    soutezicich: number;
	    minModelek: number;
	
	    static createFrom(source: any = {}) {
	        return new PropadleTema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.ikona = source["ikona"];
	        this.soutezicich = source["soutezicich"];
	        this.minModelek = source["minModelek"];
	    }
	}
	export class RadaVyvoje {
	    klic: string;
	    nazev: string;
	    jednotka: string;
	    odvozene: boolean;
	    desetinna: number;
	    znamych: number;
	    chybi: number[];
	    desetileti: BodVyvoje[];
	    petileti: BodVyvoje[];
	
	    static createFrom(source: any = {}) {
	        return new RadaVyvoje(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.jednotka = source["jednotka"];
	        this.odvozene = source["odvozene"];
	        this.desetinna = source["desetinna"];
	        this.znamych = source["znamych"];
	        this.chybi = source["chybi"];
	        this.desetileti = this.convertValues(source["desetileti"], BodVyvoje);
	        this.petileti = this.convertValues(source["petileti"], BodVyvoje);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class RekordSlavy {
	    druh: string;
	    modelkaId: number;
	    hodnota: number;
	    odZacatku: boolean;
	    cas: string;
	    trva: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RekordSlavy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.druh = source["druh"];
	        this.modelkaId = source["modelkaId"];
	        this.hodnota = source["hodnota"];
	        this.odZacatku = source["odZacatku"];
	        this.cas = source["cas"];
	        this.trva = source["trva"];
	    }
	}
	
	export class Tema {
	    klic: string;
	    nazev: string;
	    podminky: PodminkaTematu[];
	    ikona: string;
	    skupina: string;
	    popis: string;
	
	    static createFrom(source: any = {}) {
	        return new Tema(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.podminky = this.convertValues(source["podminky"], PodminkaTematu);
	        this.ikona = source["ikona"];
	        this.skupina = source["skupina"];
	        this.popis = source["popis"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UzavreniSezony {
	    klic: string;
	    nazev: string;
	    kratky: string;
	    obdobi: string;
	    od: string;
	    do: string;
	    tema: string;
	    poradi: BodySezony[];
	    souboju: number;
	    modelek: number;
	
	    static createFrom(source: any = {}) {
	        return new UzavreniSezony(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.kratky = source["kratky"];
	        this.obdobi = source["obdobi"];
	        this.od = source["od"];
	        this.do = source["do"];
	        this.tema = source["tema"];
	        this.poradi = this.convertValues(source["poradi"], BodySezony);
	        this.souboju = source["souboju"];
	        this.modelek = source["modelek"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Sezona {
	    klic: string;
	    nazev: string;
	    kratky: string;
	    obdobi: string;
	    od: string;
	    do: string;
	    den: number;
	    dni: number;
	    souboju: number;
	    modelek: number;
	    poradi: BodySezony[];
	    minule: MinulaSezona[];
	    kUzavreni?: UzavreniSezony;
	    tema?: Tema;
	    soutezicich: number;
	    zvolene: string;
	    zvoleno: boolean;
	    propadle?: PropadleTema;
	    mozneDelky: number[];
	
	    static createFrom(source: any = {}) {
	        return new Sezona(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.kratky = source["kratky"];
	        this.obdobi = source["obdobi"];
	        this.od = source["od"];
	        this.do = source["do"];
	        this.den = source["den"];
	        this.dni = source["dni"];
	        this.souboju = source["souboju"];
	        this.modelek = source["modelek"];
	        this.poradi = this.convertValues(source["poradi"], BodySezony);
	        this.minule = this.convertValues(source["minule"], MinulaSezona);
	        this.kUzavreni = this.convertValues(source["kUzavreni"], UzavreniSezony);
	        this.tema = this.convertValues(source["tema"], Tema);
	        this.soutezicich = source["soutezicich"];
	        this.zvolene = source["zvolene"];
	        this.zvoleno = source["zvoleno"];
	        this.propadle = this.convertValues(source["propadle"], PropadleTema);
	        this.mozneDelky = source["mozneDelky"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class UdalostSlavy {
	    cas: string;
	    druh: string;
	    modelkaId: number;
	    misto: number;
	    souperka: number;
	    odznak?: string;
	    stupen?: number;
	    sezona?: string;
	
	    static createFrom(source: any = {}) {
	        return new UdalostSlavy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cas = source["cas"];
	        this.druh = source["druh"];
	        this.modelkaId = source["modelkaId"];
	        this.misto = source["misto"];
	        this.souperka = source["souperka"];
	        this.odznak = source["odznak"];
	        this.stupen = source["stupen"];
	        this.sezona = source["sezona"];
	    }
	}
	export class SlavaModelky {
	    modelkaId: number;
	    misto: number;
	    vTop: boolean;
	    od: string;
	    do: string;
	    odZacatku: boolean;
	    dniTed: number;
	    dniCelkem: number;
	    dniNejdele: number;
	    dniNaPrvnim: number;
	    pobytu: number;
	    obhajob: number;
	    nejlepsiMisto: number;
	
	    static createFrom(source: any = {}) {
	        return new SlavaModelky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.misto = source["misto"];
	        this.vTop = source["vTop"];
	        this.od = source["od"];
	        this.do = source["do"];
	        this.odZacatku = source["odZacatku"];
	        this.dniTed = source["dniTed"];
	        this.dniCelkem = source["dniCelkem"];
	        this.dniNejdele = source["dniNejdele"];
	        this.dniNaPrvnim = source["dniNaPrvnim"];
	        this.pobytu = source["pobytu"];
	        this.obhajob = source["obhajob"];
	        this.nejlepsiMisto = source["nejlepsiMisto"];
	    }
	}
	export class SinSlavy {
	    od: string;
	    vitrina: SlavaModelky[];
	    legendy: SlavaModelky[];
	    rekordy: RekordSlavy[];
	    odznaky: OdznakModelky[];
	    kronika: UdalostSlavy[];
	
	    static createFrom(source: any = {}) {
	        return new SinSlavy(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.od = source["od"];
	        this.vitrina = this.convertValues(source["vitrina"], SlavaModelky);
	        this.legendy = this.convertValues(source["legendy"], SlavaModelky);
	        this.rekordy = this.convertValues(source["rekordy"], RekordSlavy);
	        this.odznaky = this.convertValues(source["odznaky"], OdznakModelky);
	        this.kronika = this.convertValues(source["kronika"], UdalostSlavy);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TagFotky {
	    klic: string;
	    nazev: string;
	
	    static createFrom(source: any = {}) {
	        return new TagFotky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	    }
	}
	export class SkupinaTagu {
	    klic: string;
	    nazev: string;
	    vylucna: boolean;
	    tagy: TagFotky[];
	
	    static createFrom(source: any = {}) {
	        return new SkupinaTagu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.vylucna = source["vylucna"];
	        this.tagy = this.convertValues(source["tagy"], TagFotky);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SouhrnAlbaFronty {
	    albumId: number;
	    pocet: number;
	
	    static createFrom(source: any = {}) {
	        return new SouhrnAlbaFronty(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.albumId = source["albumId"];
	        this.pocet = source["pocet"];
	    }
	}
	export class Special {
	    vydani: string;
	    nazev: string;
	
	    static createFrom(source: any = {}) {
	        return new Special(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vydani = source["vydani"];
	        this.nazev = source["nazev"];
	    }
	}
	export class Statistiky {
	    centerfoldu: number;
	    desetileti: DesetiletiStatistiky[];
	    vek: PolozkaStatistiky[];
	    vekMedian: number;
	    vekNejcastejsi: number;
	    vekZnamy: number;
	    fotografove: PolozkaStatistiky[];
	    fotografuCelkem: number;
	    modelkyFotografu: Record<string, Array<number>>;
	    narodnosti: PolozkaStatistiky[];
	    narodnostiCelkem: number;
	    modelekSNarodnosti: number;
	
	    static createFrom(source: any = {}) {
	        return new Statistiky(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.centerfoldu = source["centerfoldu"];
	        this.desetileti = this.convertValues(source["desetileti"], DesetiletiStatistiky);
	        this.vek = this.convertValues(source["vek"], PolozkaStatistiky);
	        this.vekMedian = source["vekMedian"];
	        this.vekNejcastejsi = source["vekNejcastejsi"];
	        this.vekZnamy = source["vekZnamy"];
	        this.fotografove = this.convertValues(source["fotografove"], PolozkaStatistiky);
	        this.fotografuCelkem = source["fotografuCelkem"];
	        this.modelkyFotografu = source["modelkyFotografu"];
	        this.narodnosti = this.convertValues(source["narodnosti"], PolozkaStatistiky);
	        this.narodnostiCelkem = source["narodnostiCelkem"];
	        this.modelekSNarodnosti = source["modelekSNarodnosti"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class UrovenTop {
	    uroven: number;
	    potrebaPorovnani: number;
	    maxNejistota: number;
	    potrebaVyhry: boolean;
	    potvrzenych: number;
	
	    static createFrom(source: any = {}) {
	        return new UrovenTop(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.uroven = source["uroven"];
	        this.potrebaPorovnani = source["potrebaPorovnani"];
	        this.maxNejistota = source["maxNejistota"];
	        this.potrebaVyhry = source["potrebaVyhry"];
	        this.potvrzenych = source["potvrzenych"];
	    }
	}
	export class StavOblibenosti {
	    porovnani: number;
	    modelek: number;
	    hodnocenych: number;
	    presnost: number;
	    odhady: boolean;
	    vahaZajmu: number;
	    zajemNaucen: boolean;
	    porovnaniZajmu: number;
	    zajemDni: number;
	    trendDni: number;
	    poradi: OblibenostModelky[];
	    nesedi: NesouladSrdicek[];
	    urovne: UrovenTop[];
	    cekajicich: number;
	    serieDni: number;
	    serieDnes: boolean;
	
	    static createFrom(source: any = {}) {
	        return new StavOblibenosti(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.porovnani = source["porovnani"];
	        this.modelek = source["modelek"];
	        this.hodnocenych = source["hodnocenych"];
	        this.presnost = source["presnost"];
	        this.odhady = source["odhady"];
	        this.vahaZajmu = source["vahaZajmu"];
	        this.zajemNaucen = source["zajemNaucen"];
	        this.porovnaniZajmu = source["porovnaniZajmu"];
	        this.zajemDni = source["zajemDni"];
	        this.trendDni = source["trendDni"];
	        this.poradi = this.convertValues(source["poradi"], OblibenostModelky);
	        this.nesedi = this.convertValues(source["nesedi"], NesouladSrdicek);
	        this.urovne = this.convertValues(source["urovne"], UrovenTop);
	        this.cekajicich = source["cekajicich"];
	        this.serieDni = source["serieDni"];
	        this.serieDnes = source["serieDnes"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class StavStahovaniNahledu {
	    bezi: boolean;
	    hotovo: number;
	    celkem: number;
	
	    static createFrom(source: any = {}) {
	        return new StavStahovaniNahledu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bezi = source["bezi"];
	        this.hotovo = source["hotovo"];
	        this.celkem = source["celkem"];
	    }
	}
	export class ZdrojUceni {
	    zdroj: string;
	    popis: string;
	    navrhu: number;
	    prijato: number;
	    odmitnuto: number;
	    presnost: number;
	    aktivni: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ZdrojUceni(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.zdroj = source["zdroj"];
	        this.popis = source["popis"];
	        this.navrhu = source["navrhu"];
	        this.prijato = source["prijato"];
	        this.odmitnuto = source["odmitnuto"];
	        this.presnost = source["presnost"];
	        this.aktivni = source["aktivni"];
	    }
	}
	export class StavUceni {
	    soubor: string;
	    velikost: number;
	    udalosti: number;
	    prijato: number;
	    odmitnuto: number;
	    opraveno: number;
	    zdroje: ZdrojUceni[];
	    naposledy: string;
	    porovnani: number;
	
	    static createFrom(source: any = {}) {
	        return new StavUceni(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.soubor = source["soubor"];
	        this.velikost = source["velikost"];
	        this.udalosti = source["udalosti"];
	        this.prijato = source["prijato"];
	        this.odmitnuto = source["odmitnuto"];
	        this.opraveno = source["opraveno"];
	        this.zdroje = this.convertValues(source["zdroje"], ZdrojUceni);
	        this.naposledy = source["naposledy"];
	        this.porovnani = source["porovnani"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class StrankaPruvodce {
	    sablona: string;
	    fotky: FotkaFronty[];
	    alba: Record<number, AlbumFronty>;
	    celkem: number;
	    dalsi: boolean;
	    souhrn: SouhrnAlbaFronty[];
	
	    static createFrom(source: any = {}) {
	        return new StrankaPruvodce(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sablona = source["sablona"];
	        this.fotky = this.convertValues(source["fotky"], FotkaFronty);
	        this.alba = this.convertValues(source["alba"], AlbumFronty, true);
	        this.celkem = source["celkem"];
	        this.dalsi = source["dalsi"];
	        this.souhrn = this.convertValues(source["souhrn"], SouhrnAlbaFronty);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class TitulSezony {
	    klic: string;
	    nazev: string;
	    kratky: string;
	    obdobi: string;
	    od: string;
	    do: string;
	    druh: string;
	
	    static createFrom(source: any = {}) {
	        return new TitulSezony(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.klic = source["klic"];
	        this.nazev = source["nazev"];
	        this.kratky = source["kratky"];
	        this.obdobi = source["obdobi"];
	        this.od = source["od"];
	        this.do = source["do"];
	        this.druh = source["druh"];
	    }
	}
	
	
	
	
	export class Vyber {
	    id: number;
	    nazev: string;
	    pocet: number;
	
	    static createFrom(source: any = {}) {
	        return new Vyber(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.nazev = source["nazev"];
	        this.pocet = source["pocet"];
	    }
	}
	
	export class VydaniInfo {
	    vydani: string;
	    poznamka: string;
	    stav: string;
	    modelkaObalky: number;
	    jmenoObalky: string;
	    naObalce: string;
	    nazev: string;
	
	    static createFrom(source: any = {}) {
	        return new VydaniInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vydani = source["vydani"];
	        this.poznamka = source["poznamka"];
	        this.stav = source["stav"];
	        this.modelkaObalky = source["modelkaObalky"];
	        this.jmenoObalky = source["jmenoObalky"];
	        this.naObalce = source["naObalce"];
	        this.nazev = source["nazev"];
	    }
	}
	export class VydaniKalendare {
	    vydani: string;
	    cover: boolean;
	    centerfold: boolean;
	    pictorial: boolean;
	    nahled: string;
	    modelka: string;
	
	    static createFrom(source: any = {}) {
	        return new VydaniKalendare(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vydani = source["vydani"];
	        this.cover = source["cover"];
	        this.centerfold = source["centerfold"];
	        this.pictorial = source["pictorial"];
	        this.nahled = source["nahled"];
	        this.modelka = source["modelka"];
	    }
	}
	export class VysledekImportu {
	    noveModelky: number;
	    upraveneModelky: number;
	    alba: number;
	    noveFotky: number;
	    chyby: string[];
	    opravy: string[];
	    selhalo: string;
	
	    static createFrom(source: any = {}) {
	        return new VysledekImportu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.noveModelky = source["noveModelky"];
	        this.upraveneModelky = source["upraveneModelky"];
	        this.alba = source["alba"];
	        this.noveFotky = source["noveFotky"];
	        this.chyby = source["chyby"];
	        this.opravy = source["opravy"];
	        this.selhalo = source["selhalo"];
	    }
	}
	export class VysledekPresunu {
	    presunuto: number;
	    duplicitni: number;
	
	    static createFrom(source: any = {}) {
	        return new VysledekPresunu(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.presunuto = source["presunuto"];
	        this.duplicitni = source["duplicitni"];
	    }
	}
	export class VysledekVlozeni {
	    vlozeno: number;
	    nedostupne: number;
	    duplicitni: number;
	    neovereno: number;
	
	    static createFrom(source: any = {}) {
	        return new VysledekVlozeni(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.vlozeno = source["vlozeno"];
	        this.nedostupne = source["nedostupne"];
	        this.duplicitni = source["duplicitni"];
	        this.neovereno = source["neovereno"];
	    }
	}
	export class VyvojVCase {
	    edice: string;
	    desetileti: number[];
	    modelek: number;
	    ciselne: RadaVyvoje[];
	    podily: KategorieVyvoje[];
	
	    static createFrom(source: any = {}) {
	        return new VyvojVCase(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.edice = source["edice"];
	        this.desetileti = source["desetileti"];
	        this.modelek = source["modelek"];
	        this.ciselne = this.convertValues(source["ciselne"], RadaVyvoje);
	        this.podily = this.convertValues(source["podily"], KategorieVyvoje);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Zaloha {
	    soubor: string;
	    cas: string;
	    duvod: string;
	    modelek: number;
	    fotek: number;
	    poskozena: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Zaloha(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.soubor = source["soubor"];
	        this.cas = source["cas"];
	        this.duvod = source["duvod"];
	        this.modelek = source["modelek"];
	        this.fotek = source["fotek"];
	        this.poskozena = source["poskozena"];
	    }
	}
	export class ZapisPruvodce {
	    ids: number[];
	    skupiny: string[];
	    tagy: string[];
	    hodnoceni: number;
	    hotovo: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ZapisPruvodce(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ids = source["ids"];
	        this.skupiny = source["skupiny"];
	        this.tagy = source["tagy"];
	        this.hodnoceni = source["hodnoceni"];
	        this.hotovo = source["hotovo"];
	    }
	}

}

