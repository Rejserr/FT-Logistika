export interface Partner {
  partner_uid: string
  partner: string | null
  b2b_partner: string | null
  naziv: string | null
  ime: string | null
  prezime: string | null
  enabled: string | null
  tip_komitenta: string | null
  mobitel: string | null
  adresa: string | null
  maticni_broj: string | null
  oib: string | null
  pdv_broj: string | null
  ziro_racun: string | null
  telefon: string | null
  telefax: string | null
  mjesto_uid: string | null
  mjesto: string | null
  naziv_mjesta: string | null
  postanski_broj: string | null
  b2b_mjesto: string | null
  drzava_uid: string | null
  drzava: string | null
  naziv_drzave: string | null
  b2b_drzava: string | null
  valuta: string | null
  b2b_valuta: string | null
  rabat: number | null
  limit_iznos: number | null
  limit_dana: number | null
  odgoda_placanja: number | null
  iznos_zaduznice: number | null
  blokiran: string | null
  kontakt_osoba: string | null
  ugovor: string | null
  banka: string | null
  swift: string | null
  e_mail: string | null
  url: string | null
  napomena: string | null
  upozorenje: string | null
  gln: string | null
  placa_porez: string | null
  cassa_sconto: string | null
  tip_cijene: string | null
  tip_racuna: string | null
  datum_rodenja: string | null
  spol: string | null
  placa_isporuku: string | null
  synced_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PartnerListItem {
  partner_uid: string
  partner: string | null
  naziv: string | null
  ime: string | null
  prezime: string | null
  adresa: string | null
  naziv_mjesta: string | null
  postanski_broj: string | null
  drzava: string | null
  mobitel: string | null
  telefon: string | null
  e_mail: string | null
  blokiran: string | null
}

export interface NalogDetail {
  stavka_uid: string
  nalog_prodaje_uid: string
  artikl: string | null
  artikl_uid: string | null
  artikl_b2b: string | null
  mjesto_troska: string | null
  mjesto_troska_uid: string | null
  mjesto_troska_b2b: string | null
  predmet: string | null
  predmet_uid: string | null
  predmet_b2b: string | null
  opis: string | null
  kolicina: number | null
  pakiranja: number | null
  cijena: number | null
  detaljni_opis: string | null
  specifikacija: string | null
  rabat: number | null
  dodatni_rabat: string | null
  redoslijed: number | null
  synced_at: string | null
  artikl_naziv_kratki: string | null
  artikl_jm: string | null
  artikl_masa: number | null
  artikl_volumen: number | null
  artikl_visina: number | null
}

export interface NalogHeader {
  nalog_prodaje_uid: string
  nalog_prodaje_b2b: string | null
  broj: number | null
  datum: string | null
  rezervacija_od_datuma: string | null
  rezervacija_do_datuma: string | null
  raspored: string | null
  skladiste: string | null
  skladiste_b2b: string | null
  na__skladiste: string | null
  na__skladiste_b2b: string | null
  partner_uid: string | null
  partner: string | null
  partner_b2b: string | null
  korisnik__partner_uid: string | null
  korisnik__partner: string | null
  korisnik__partner_b2b: string | null
  agent__partner_uid: string | null
  agent__partner: string | null
  agent__partner_b2b: string | null
  narudzba: string | null
  kupac_placa_isporuku: string | null
  valuta: string | null
  valuta_b2b: string | null
  tecaj: number | null
  generalni_rabat: string | null
  placa_porez: string | null
  cassa_sconto: string | null
  poruka_gore: string | null
  poruka_dolje: string | null
  napomena: string | null
  na_uvid: string | null
  referenca_isporuke: string | null
  sa__skladiste: string | null
  sa__skladiste_b2b: string | null
  skl_dokument: string | null
  skl_dokument_b2b: string | null
  status: string | null
  status_b2b: string | null
  komercijalist__radnik: string | null
  komercijalist__radnik_b2b: string | null
  dostavljac_uid: string | null
  dostavljac__radnik: string | null
  dostavljac__radnik_b2b: string | null
  kreirao__radnik_uid: string | null
  kreirao__radnik: string | null
  kreirao__radnik_ime: string | null
  vrsta_isporuke: string | null
  vrsta_isporuke_b2b: string | null
  izravna_dostava: string | null
  dropoff_sifra: string | null
  dropoff_naziv: string | null
  user_uid: string | null
  username: string | null
  user_b2b: string | null
  tip_racuna_uid: string | null
  tip_racuna: string | null
  tip_racuna_b2b: string | null
  predmet_uid: string | null
  predmet: string | null
  predmet_b2b: string | null
  za_naplatu: number | null
  zki: string | null
  jir: string | null
  regija_id: number | null
  regija_naziv: string | null
  vozilo_tip: string | null
  total_weight: number | null
  total_volume: number | null
  manual_paleta: number | null
  synced_at: string | null
  created_at: string | null
  updated_at: string | null
  details?: NalogDetail[]
  partner_naziv: string | null
  partner_ime: string | null
  partner_prezime: string | null
  partner_mobitel: string | null
  partner_adresa: string | null
  partner_telefon: string | null
  partner_naziv_mjesta: string | null
  partner_postanski_broj: string | null
  partner_drzava: string | null
  partner_kontakt_osoba: string | null
  partner_e_mail: string | null
}

export interface VrstaIsporuke {
  id: number
  vrsta_isporuke: string
  opis: string | null
  aktivan: boolean
  created_at: string | null
  updated_at: string | null
}

export interface SyncStatus {
  id: number
  status_id: string
  naziv: string | null
  aktivan: boolean
  created_at: string | null
  updated_at: string | null
}

export interface VoziloTip {
  id: number
  naziv: string
  opis: string | null
  aktivan: boolean
}

export interface Vozilo {
  id: number
  oznaka: string | null
  naziv: string | null
  tip_id: number | null
  warehouse_id: number | null
  registracija: string | null
  nosivost_kg: number | null
  volumen_m3: number | null
  profil_rutiranja: string | null
  paleta: number | null
  aktivan: boolean
}

export interface Vozac {
  id: number
  ime: string
  prezime: string
  telefon: string | null
  email: string | null
  warehouse_id: number | null
  vozilo_id: number | null
  aktivan: boolean
}

export interface Regija {
  id: number
  naziv: string
  sifra: string | null
  opis: string | null
  parent_id: number | null
  aktivan: boolean
}

export interface RegijaTree extends Regija {
  children: RegijaTree[]
  postal_count: number
}

export interface PostanskiBroj {
  id: number
  postanski_broj: string
  naziv_mjesta: string | null
  regija_id: number | null
}

export interface Artikl {
  artikl_uid: string
  artikl: string
  naziv: string | null
  naziv_kratki: string | null
  jm: string | null
  vpc: number | null
  mpc: number | null
  duzina: number | null
  sirina: number | null
  visina: number | null
  masa: number | null
  volumen: number | null
  grupa_artikla_uid: string | null
  grupa_artikla: string | null
  grupa_artikla_naziv: string | null
  glavni_dobavljac: string | null
  synced_at: string | null
}

export interface GrupaArtikla {
  grupa_artikla_uid: string
  grupa_artikla: string
  grupa_artikla_naziv: string | null
  nadgrupa_artikla: string | null
  nadgrupa_artikla_naziv: string | null
  supergrupa_artikla: string | null
  supergrupa_artikla_naziv: string | null
}

export interface KriterijaSku {
  id: number
  naziv: string
  opis: string | null
}

export interface ArtiklKriterija {
  id: number
  artikl: string
  artikl_naziv: string | null
  kriterija_id: number
}

export interface RouteStop {
  id: number
  nalog_uid: string
  redoslijed: number
  eta: string | null
  status: string | null
  partner_naziv: string | null
  partner_adresa: string | null
  partner_mjesto: string | null
  lat: number | null
  lng: number | null
}

export interface Route {
  id: number
  datum: string | null
  status: string | null
  algoritam: string | null
  vozilo_id: number | null
  vozilo_oznaka: string | null
  vozac_id: number | null
  driver_user_id: number | null
  driver_name: string | null
  izvor_tip: string | null
  izvor_id: number | null
  distance_km: number | null
  duration_min: number | null
  regije: string | null
  stops: RouteStop[]
  polyline?: [number, number][] | null
}

export interface RouteListItem {
  id: number
  datum: string | null
  raspored: string | null
  status: string | null
  algoritam: string | null
  vozilo_id: number | null
  vozilo_oznaka: string | null
  vozac_id: number | null
  driver_name: string | null
  distance_km: number | null
  duration_min: number | null
  stops_count: number
  wms_paleta: number | null
  regije: string | null
}

export interface CreateRouteRequest {
  nalog_uids: string[]
  vozilo_id?: number
  vozac_id?: number
  driver_user_id?: number
  izvor_tip?: 'depot' | 'store'
  izvor_id?: number
  datum?: string
  raspored?: string
  start_time?: string
  algoritam?: 'nearest_neighbor' | 'ortools' | 'manual'
}

export interface SyncResponse {
  sync_id: number
  status: string
  message: string | null
}

export interface GeocodingResponse {
  lat: number | null
  lng: number | null
  formatted_address: string | null
  from_cache: boolean
}

export interface DistanceResponse {
  distance_m: number | null
  duration_s: number | null
  distance_km: number | null
  duration_min: number | null
  from_cache: boolean
}

export interface GeocodeOrderResult {
  nalog_uid: string
  lat: number | null
  lng: number | null
  address: string | null
  kupac: string | null
  demand_kg: number
  demand_m3: number
  nalog_prodaje: string | null
}

export interface ProviderInfo {
  provider: string
  has_google_key: boolean
  has_ors_key: boolean
  has_tomtom_key: boolean
  tomtom_map_key: string
}

export type RouteStatus = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type StopStatus = 'PENDING' | 'ARRIVED' | 'DELIVERED' | 'FAILED' | 'SKIPPED'

export interface Setting {
  key: string
  value: string | null
}

export interface Prioritet {
  id: number
  naziv: string
  tezina: number
  aktivan: boolean
}

export interface StatusNaloga {
  id: string
  naziv: string
  opis: string | null
  redoslijed: number
  aktivan: boolean
}

export interface MantisSSCCItem {
  id: number
  order_code: string
  product_id: number | null
  product: string | null
  quantity: number | null
  item_status_id: number | null
  item_status: string | null
  sscc: string | null
  psscc: string | null
  location: string | null
  zone: string | null
}

export interface MantisOrderSummary {
  nalog_prodaje_uid: string | null
  order_code: string | null
  items: MantisSSCCItem[]
  total_paleta: number
  is_complete: boolean
  has_data: boolean
  synced_at: string | null
}

export interface RutiranjeNalog {
  nalog_prodaje_uid: string
  broj: number | null
  datum: string | null
  raspored: string | null
  skladiste: string | null
  status: string | null
  partner_uid: string | null
  total_weight: number | null
  total_volume: number | null
  regija_id: number | null
  regija_naziv: string | null
  ruta_id: number | null
  status_rutiranja: string | null
  prebaceno_at: string | null
  partner_naziv: string | null
  partner_ime: string | null
  partner_prezime: string | null
  partner_adresa: string | null
  partner_naziv_mjesta: string | null
  partner_postanski_broj: string | null
  partner_drzava: string | null
  partner_kontakt_osoba: string | null
  partner_mobitel: string | null
  partner_telefon: string | null
  partner_e_mail: string | null
  kupac: string | null
  poruka_gore: string | null
  poruka_dolje: string | null
  napomena: string | null
  na_uvid: string | null
  kreirao__radnik_ime: string | null
  vrsta_isporuke: string | null
}

export interface ImportRegionsResult {
  regije_created: number
  regije_existing: number
  postanski_created: number
  postanski_updated: number
  rows_processed: number
  errors: string[]
}
