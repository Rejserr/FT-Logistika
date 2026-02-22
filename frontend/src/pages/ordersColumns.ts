/**
 * Definicija kolona za tablicu naloga – odabrana polja za pregled.
 * key = polje u NalogHeader, label = prikaz u headeru.
 */
export const ORDER_TABLE_COLUMNS: { key: string; label: string }[] = [
  // Osnovno
  { key: 'broj', label: 'Broj' },
  { key: 'datum', label: 'Datum' },
  { key: 'raspored', label: 'Raspored' },
  { key: 'skladiste', label: 'Skladište' },
  { key: 'sa__skladiste', label: 'Sa skladište' },
  { key: 'na__skladiste', label: 'Na skladište' },
  // Partner šifre
  { key: 'partner', label: 'Partner (šifra)' },
  { key: 'korisnik__partner', label: 'Korisnik partner' },
  /* Kupac (virtualna kolona: naziv => ime prezime, ili samo ime prezime ako nema naziva) */
  { key: 'partner_kupac', label: 'Kupac' },
  // Polja iz tablice partneri
  { key: 'partner_mobitel', label: 'Mobitel' },
  { key: 'partner_adresa', label: 'Adresa' },
  { key: 'partner_telefon', label: 'Telefon' },
  { key: 'partner_postanski_broj', label: 'Poštanski broj' },
  { key: 'partner_drzava', label: 'Država' },
  { key: 'partner_kontakt_osoba', label: 'Kontakt osoba' },
  { key: 'partner_naziv_mjesta', label: 'Mjesto' },
  // Tekstualna polja iz headera
  { key: 'poruka_gore', label: 'Poruka gore' },
  { key: 'poruka_dolje', label: 'Poruka dolje' },
  { key: 'napomena', label: 'Napomena' },
  { key: 'na_uvid', label: 'Na uvid' },
  { key: 'referenca_isporuke', label: 'Referenca isporuke' },
  { key: 'skl_dokument', label: 'Skl. dokument' },
  // Status / meta
  { key: 'status', label: 'Status' },
  { key: 'vrsta_isporuke', label: 'Vrsta isporuke' },
  { key: 'kreirao__radnik_ime', label: 'Kreirao' },
  { key: 'regija_naziv', label: 'Regija' },
  // Financije i logistika
  { key: 'za_naplatu', label: 'Za naplatu' },
  { key: 'valuta', label: 'Valuta' },
  { key: 'total_weight', label: 'Težina (kg)' },
  { key: 'total_volume', label: 'Volumen (m³)' },
  // WMS
  { key: 'wms_status', label: 'WMS' },
]

export const DEFAULT_VISIBLE_COLUMN_KEYS = [
  'broj',
  'partner_kupac',
  'datum',
  'raspored',
  'vrsta_isporuke',
  'regija_naziv',
  'total_weight',
  'total_volume',
  'za_naplatu',
  'status',
]

/** Ključ virtualne kolone Kupac: partner_naziv => ime prezime, ili samo ime prezime ako nema naziva. */
export const VIRTUAL_COLUMN_PARTNER_KUPAC = 'partner_kupac'

const VISIBLE_COLUMNS_STORAGE_KEY = 'ft-logistika-orders-visible-columns'

export function loadVisibleColumnKeys(): string[] | null {
  try {
    const raw = localStorage.getItem(VISIBLE_COLUMNS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export function saveVisibleColumnKeys(keys: string[]) {
  try {
    localStorage.setItem(VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(keys))
  } catch {
    /* ignore */
  }
}
