/**
 * ERP document service for QR scanning functionality.
 * Handles document type detection, fetching from ERP, and status updates.
 */

import { apiFetch } from './api';

export type DocumentType = 'MP' | 'SKL';

export interface DocumentResponse {
  document_type: DocumentType;
  barcode: string;
  data: any;
}

export interface ParsedDocument {
  type: DocumentType;
  typeLabel: string;
  uid: string;
  broj: number | string;
  datum: string;
  kupac: string;
  skladiste: string;
  skladisteNaziv: string;
  vrstaIsporuke: string;
  status: string | null;
  statusNaziv: string | null;
  statusUid: string | null;
  nalogProdajeUid: string | null;
  stavke: ParsedStavka[];
  rawJson: any;
}

export interface ParsedStavka {
  artikl: string;
  naziv: string;
  kolicina: number;
  barcode: string | null;
  cijena: number | null;
  iznos: number | null;
  rabat: number | null;
}

export interface StatusOption {
  status_id: string;
  naziv: string;
}

export function detectDocumentType(barcode: string): DocumentType | null {
  if (barcode.includes('.LUCEED.04.')) return 'MP';
  if (barcode.includes('.LUCEED.01.')) return 'SKL';
  return null;
}

export async function fetchDocument(barcode: string): Promise<DocumentResponse> {
  return apiFetch<DocumentResponse>(`/qr/document/${encodeURIComponent(barcode)}`);
}

export function parseDocument(resp: DocumentResponse): ParsedDocument {
  if (resp.document_type === 'MP') return parseMpRacun(resp);
  return parseSkladisniDokument(resp);
}

function parseMpRacun(resp: DocumentResponse): ParsedDocument {
  const result = resp.data?.result;
  const mprac = result?.[0]?.mprac?.[0];
  if (!mprac) throw new Error('MP račun nije pronađen u ERP odgovoru.');

  const vezaniNP = mprac.vezani_dokumenti?.find((d: any) => d.dokument === 'NP');

  const stavke: ParsedStavka[] = (mprac.stavke || []).map((s: any) => ({
    artikl: s.artikl || '',
    naziv: s.artikl_naziv || '',
    kolicina: s.kolicina ?? 0,
    barcode: s.barcode || null,
    cijena: s.cijena ?? null,
    iznos: s.iznos ?? null,
    rabat: s.rabat ?? null,
  }));

  return {
    type: 'MP',
    typeLabel: 'MP Račun',
    uid: mprac.mprac_uid || '',
    broj: mprac.broj || mprac.broj_fiskalni || '',
    datum: mprac.datum || '',
    kupac: mprac.partner_naziv || mprac.korisnik__partner_naziv || '',
    skladiste: '',
    skladisteNaziv: mprac.ime_prodavaca || '',
    vrstaIsporuke: mprac.vrsta_isporuke_naziv || mprac.vrsta_isporuke || '',
    status: vezaniNP?.status || null,
    statusNaziv: vezaniNP?.status_naziv || null,
    statusUid: vezaniNP?.status_uid || null,
    nalogProdajeUid: vezaniNP?.dokument_uid || null,
    stavke,
    rawJson: resp.data,
  };
}

function parseSkladisniDokument(resp: DocumentResponse): ParsedDocument {
  const result = resp.data?.result;
  const skl = result?.[0]?.skladisni_dokumenti?.[0];
  if (!skl) throw new Error('Skladišni dokument nije pronađen u ERP odgovoru.');

  const vezaniNP = skl.vezani_dokumenti?.find((d: any) => d.dokument === 'NP');

  const stavke: ParsedStavka[] = (skl.stavke || []).map((s: any) => ({
    artikl: s.artikl || s.artikl_uid || '',
    naziv: s.artikl_naziv || s.artikl_naziv_kratki || '',
    kolicina: s.kolicina ?? 0,
    barcode: s.barcode || null,
    cijena: null,
    iznos: null,
    rabat: null,
  }));

  return {
    type: 'SKL',
    typeLabel: `Skladišni dok. (${skl.skl_dokument || ''})`,
    uid: skl.skladisni_dokument_uid || '',
    broj: skl.broj || '',
    datum: skl.datum || '',
    kupac: skl.kupac__partner_naziv || skl.korisnik__partner_naziv || '',
    skladiste: skl.skladiste || '',
    skladisteNaziv: skl.skladiste_naziv || '',
    vrstaIsporuke: skl.vrsta_isporuke_naziv || skl.vrsta_isporuke || '',
    status: vezaniNP?.status || null,
    statusNaziv: vezaniNP?.status_naziv || null,
    statusUid: vezaniNP?.status_uid || null,
    nalogProdajeUid: vezaniNP?.dokument_uid || null,
    stavke,
    rawJson: resp.data,
  };
}

export async function updateDocumentStatus(
  nalogProdajeUid: string,
  statusId: string,
  statusUid: string,
): Promise<any> {
  return apiFetch('/qr/status', {
    method: 'POST',
    body: JSON.stringify({
      statusi: [{
        nalog_prodaje_uid: nalogProdajeUid,
        status: statusId,
        status_uid: statusUid,
      }],
    }),
  });
}

export async function fetchStatusi(): Promise<StatusOption[]> {
  return apiFetch<StatusOption[]>('/qr/statusi');
}
