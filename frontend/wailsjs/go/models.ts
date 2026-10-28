export namespace main {
	
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
	
	export class UdalostSlavy {
	    cas: string;
	    druh: string;
	    modelkaId: number;
	    misto: number;
	    souperka: number;
	
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

}

