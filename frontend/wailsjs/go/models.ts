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
	    hodnoceni: number;
	    poradi: number;
	    pridano: string;
	    dalsiModelky: OdkazModelky[];
	    driveId: string;
	
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
	        this.hodnoceni = source["hodnoceni"];
	        this.poradi = source["poradi"];
	        this.pridano = source["pridano"];
	        this.dalsiModelky = this.convertValues(source["dalsiModelky"], OdkazModelky);
	        this.driveId = source["driveId"];
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
	    pridano: string;
	    netykaSe: string;
	
	    static createFrom(source: any = {}) {
	        return new Modelka(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.jmeno = source["jmeno"];
	        this.narozeniDatum = source["narozeniDatum"];
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
	        this.pridano = source["pridano"];
	        this.netykaSe = source["netykaSe"];
	    }
	}
	
	export class ObnovaFotky {
	    modelkaId: number;
	    album: string;
	    typ: string;
	    driveId: string;
	    vydani: string;
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
	        this.modelkaId = source["modelkaId"];
	        this.album = source["album"];
	        this.typ = source["typ"];
	        this.driveId = source["driveId"];
	        this.vydani = source["vydani"];
	        this.rotace = source["rotace"];
	        this.spojit = source["spojit"];
	        this.hodnoceni = source["hodnoceni"];
	        this.poradi = source["poradi"];
	        this.pridano = source["pridano"];
	        this.popis = source["popis"];
	        this.fotograf = source["fotograf"];
	    }
	}
	
	export class PodezrelyUdaj {
	    modelkaId: number;
	    jmeno: string;
	    popis: string;
	
	    static createFrom(source: any = {}) {
	        return new PodezrelyUdaj(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelkaId = source["modelkaId"];
	        this.jmeno = source["jmeno"];
	        this.popis = source["popis"];
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
	
	    static createFrom(source: any = {}) {
	        return new Prehled(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modelek = source["modelek"];
	        this.alb = source["alb"];
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

