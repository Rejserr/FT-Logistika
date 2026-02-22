import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { podApi } from '../services/api'
import './PodPage.css'

interface PodListItem {
  id: number
  stop_id: number
  nalog_prodaje_uid: string | null
  nalog_broj: number | null
  skladiste: string | null
  partner_naziv: string | null
  recipient_name: string | null
  has_signature: boolean
  has_photos: boolean
  photo_count: number
  gps_lat: number | null
  gps_lng: number | null
  created_at: string | null
  ruta_id: number | null
  driver_name: string | null
  sent_to_luceed: boolean
  luceed_sent_at: string | null
}

interface PodDetail extends PodListItem {
  comment: string | null
  signature_path: string | null
  photo_paths: string[]
  signature_url: string | null
  photo_urls: string[]
  nalog_header: {
    nalog_prodaje_uid: string
    broj: number | null
    datum: string | null
    raspored: string | null
    skladiste: string | null
    status: string | null
    partner_uid: string | null
    vrsta_isporuke: string | null
    napomena: string | null
    poruka_gore: string | null
    poruka_dolje: string | null
    za_naplatu: number | null
    kreirao__radnik_ime: string | null
    total_weight: number | null
    total_volume: number | null
  } | null
  nalog_details: {
    stavka_uid: string
    artikl: string | null
    artikl_uid: string | null
    opis: string | null
    kolicina: number | null
    pakiranja: number | null
    cijena: number | null
    rabat: number | null
    redoslijed: number | null
    artikl_naziv: string | null
    artikl_jm: string | null
    artikl_masa: number | null
  }[]
  partner: {
    partner_uid: string
    naziv: string | null
    ime: string | null
    prezime: string | null
    adresa: string | null
    naziv_mjesta: string | null
    postanski_broj: string | null
    mobitel: string | null
    telefon: string | null
    e_mail: string | null
    kontakt_osoba: string | null
    oib: string | null
  } | null
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export default function PodPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [selectedPodId, setSelectedPodId] = useState<number | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: pods = [], isLoading: listLoading } = useQuery<PodListItem[]>({
    queryKey: ['pods', activeSearch],
    queryFn: () => podApi.list(activeSearch || undefined),
  })

  const { data: podDetail, isLoading: detailLoading } = useQuery<PodDetail>({
    queryKey: ['pod-detail', selectedPodId],
    queryFn: () => podApi.detail(selectedPodId!),
    enabled: !!selectedPodId,
  })

  const sendMutation = useMutation({
    mutationFn: (podId: number) => podApi.sendToLuceed(podId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pods'] })
      queryClient.invalidateQueries({ queryKey: ['pod-detail', selectedPodId] })
    },
  })

  const handleSearch = useCallback(() => {
    setActiveSearch(searchQuery.trim())
    setSelectedPodId(null)
  }, [searchQuery])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }, [handleSearch])

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('hr-HR') } catch { return d }
  }

  const formatDateTime = (d: string | null) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleString('hr-HR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return d }
  }

  const formatNalog = (uid: string | null, broj: number | null, skladiste: string | null) => {
    if (broj && skladiste) return `${broj}-${skladiste}`
    return uid || '—'
  }

  return (
    <div className="pod-page">
      <h1>Proof of Delivery</h1>

      {/* Search */}
      <div className="pod-search-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div className="pod-search-row">
            <input
              type="text"
              placeholder="Pretraži po nalog_prodaje_uid ili broj-skladište..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn-search" onClick={handleSearch}>Pretraži</button>
            {pods.length > 0 && (
              <span className="pod-count">{pods.length} POD zapisa</span>
            )}
          </div>
        </div>
      </div>

      {/* POD List */}
      <div className="pod-table-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
        <div className="card-body">
          {listLoading ? (
            <div className="pod-loading">Učitavanje...</div>
          ) : pods.length === 0 ? (
            <div className="pod-empty">
              {activeSearch ? 'Nema rezultata za zadanu pretragu.' : 'Nema POD zapisa.'}
            </div>
          ) : (
            <table className="pod-table">
              <thead>
                <tr>
                  <th>Nalog</th>
                  <th>Partner</th>
                  <th>Vozač</th>
                  <th>Ruta</th>
                  <th>Primio</th>
                  <th>Dokumenti</th>
                  <th>Luceed</th>
                  <th>Datum</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((pod) => (
                  <tr
                    key={pod.id}
                    className={selectedPodId === pod.id ? 'selected' : ''}
                    onClick={() => setSelectedPodId(pod.id)}
                  >
                    <td>
                      <span className="pod-nalog-link">
                        {formatNalog(pod.nalog_prodaje_uid, pod.nalog_broj, pod.skladiste)}
                      </span>
                    </td>
                    <td>{pod.partner_naziv || '—'}</td>
                    <td>{pod.driver_name || '—'}</td>
                    <td>{pod.ruta_id ? `#${pod.ruta_id}` : '—'}</td>
                    <td>{pod.recipient_name || '—'}</td>
                    <td>
                      {pod.has_photos && (
                        <span className="pod-badge has-photo">📷 {pod.photo_count}</span>
                      )}
                      {pod.has_signature && (
                        <span className="pod-badge has-signature">✍️</span>
                      )}
                    </td>
                    <td>
                      {pod.sent_to_luceed ? (
                        <span className="pod-badge sent">✓ Poslano</span>
                      ) : (
                        <span className="pod-badge not-sent">Nije poslano</span>
                      )}
                    </td>
                    <td>{formatDateTime(pod.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedPodId && (
        <div className="pod-detail-panel">
          {detailLoading ? (
            <div className="pod-loading">Učitavanje detalja...</div>
          ) : podDetail ? (
            <>
              <div className="pod-detail-header">
                <h2>
                  POD — {formatNalog(podDetail.nalog_prodaje_uid, podDetail.nalog_broj, podDetail.skladiste)}
                </h2>
                <div className="pod-detail-actions">
                  <button
                    className={`btn-luceed ${podDetail.sent_to_luceed ? 'sent' : ''}`}
                    onClick={() => sendMutation.mutate(podDetail.id)}
                    disabled={sendMutation.isPending}
                  >
                    {sendMutation.isPending
                      ? '⏳ Šaljem...'
                      : podDetail.sent_to_luceed
                        ? '✓ Ponovno pošalji u Luceed'
                        : '📤 Pošalji u Luceed'}
                  </button>
                  <button className="btn-close-detail" onClick={() => setSelectedPodId(null)}>
                    Zatvori
                  </button>
                </div>
              </div>

              {sendMutation.isSuccess && (
                <div style={{ padding: '10px 16px', background: '#dcfce7', color: '#166534', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
                  ✓ {(sendMutation.data as { message?: string })?.message || 'Uspješno poslano u Luceed.'}
                </div>
              )}
              {sendMutation.isError && (
                <div style={{ padding: '10px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
                  ✗ {(sendMutation.error as Error)?.message || 'Greška pri slanju u Luceed.'}
                </div>
              )}

              {/* Delivery stats */}
              <div className="pod-delivery-info">
                <div className="delivery-stat success">
                  <div className="stat-value">{podDetail.photo_count}</div>
                  <div className="stat-label">Fotografija</div>
                </div>
                <div className="delivery-stat">
                  <div className="stat-value">{podDetail.has_signature ? '✓' : '✗'}</div>
                  <div className="stat-label">Potpis</div>
                </div>
                <div className={`delivery-stat ${podDetail.sent_to_luceed ? 'success' : 'warning'}`}>
                  <div className="stat-value">{podDetail.sent_to_luceed ? '✓' : '✗'}</div>
                  <div className="stat-label">Luceed</div>
                </div>
              </div>

              {/* Info grid */}
              <div className="pod-info-grid">
                {/* Order header */}
                {podDetail.nalog_header && (
                  <div className="pod-info-card">
                    <h3>Nalog prodaje</h3>
                    <div className="info-row">
                      <span className="info-label">Broj-Skladište</span>
                      <span className="info-value highlight">
                        {podDetail.nalog_header.broj}-{podDetail.nalog_header.skladiste}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">UID</span>
                      <span className="info-value">{podDetail.nalog_header.nalog_prodaje_uid}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Datum</span>
                      <span className="info-value">{formatDate(podDetail.nalog_header.datum)}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Datum isporuke</span>
                      <span className="info-value">{formatDate(podDetail.nalog_header.raspored)}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Status</span>
                      <span className="info-value">{podDetail.nalog_header.status || '—'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Vrsta isporuke</span>
                      <span className="info-value">{podDetail.nalog_header.vrsta_isporuke || '—'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Za naplatu</span>
                      <span className="info-value highlight">
                        {podDetail.nalog_header.za_naplatu
                          ? `${podDetail.nalog_header.za_naplatu.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €`
                          : '—'}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Težina</span>
                      <span className="info-value">
                        {podDetail.nalog_header.total_weight
                          ? `${podDetail.nalog_header.total_weight.toFixed(1)} kg`
                          : '—'}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Kreirao</span>
                      <span className="info-value">{podDetail.nalog_header.kreirao__radnik_ime || '—'}</span>
                    </div>
                    {podDetail.nalog_header.napomena && (
                      <div className="info-row">
                        <span className="info-label">Napomena</span>
                        <span className="info-value">{podDetail.nalog_header.napomena}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Partner + Delivery info */}
                <div className="pod-info-card">
                  <h3>Partner / Kupac</h3>
                  {podDetail.partner ? (
                    <>
                      <div className="info-row">
                        <span className="info-label">Naziv</span>
                        <span className="info-value highlight">{podDetail.partner.naziv || '—'}</span>
                      </div>
                      {podDetail.partner.ime && (
                        <div className="info-row">
                          <span className="info-label">Kontakt</span>
                          <span className="info-value">{podDetail.partner.ime} {podDetail.partner.prezime}</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span className="info-label">Adresa</span>
                        <span className="info-value">{podDetail.partner.adresa || '—'}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Mjesto</span>
                        <span className="info-value">
                          {podDetail.partner.postanski_broj} {podDetail.partner.naziv_mjesta}
                        </span>
                      </div>
                      {podDetail.partner.mobitel && (
                        <div className="info-row">
                          <span className="info-label">Mobitel</span>
                          <span className="info-value">{podDetail.partner.mobitel}</span>
                        </div>
                      )}
                      {podDetail.partner.telefon && (
                        <div className="info-row">
                          <span className="info-label">Telefon</span>
                          <span className="info-value">{podDetail.partner.telefon}</span>
                        </div>
                      )}
                      {podDetail.partner.e_mail && (
                        <div className="info-row">
                          <span className="info-label">Email</span>
                          <span className="info-value">{podDetail.partner.e_mail}</span>
                        </div>
                      )}
                      {podDetail.partner.oib && (
                        <div className="info-row">
                          <span className="info-label">OIB</span>
                          <span className="info-value">{podDetail.partner.oib}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>Nema podataka o partneru.</div>
                  )}

                  <h3 style={{ marginTop: 20 }}>Dostava</h3>
                  <div className="info-row">
                    <span className="info-label">Vozač</span>
                    <span className="info-value">{podDetail.driver_name || '—'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Primio</span>
                    <span className="info-value">{podDetail.recipient_name || '—'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Ruta</span>
                    <span className="info-value">{podDetail.ruta_id ? `#${podDetail.ruta_id}` : '—'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Datum dostave</span>
                    <span className="info-value">{formatDateTime(podDetail.created_at)}</span>
                  </div>
                  {podDetail.comment && (
                    <div className="info-row">
                      <span className="info-label">Komentar</span>
                      <span className="info-value">{podDetail.comment}</span>
                    </div>
                  )}
                  {podDetail.gps_lat && podDetail.gps_lng && (
                    <div className="info-row">
                      <span className="info-label">GPS</span>
                      <span className="info-value">{podDetail.gps_lat.toFixed(6)}, {podDetail.gps_lng.toFixed(6)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order details (stavke) */}
              {podDetail.nalog_details.length > 0 && (
                <div className="pod-info-card" style={{ marginBottom: 20 }}>
                  <h3>Stavke naloga ({podDetail.nalog_details.length})</h3>
                  <table className="pod-details-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Šifra</th>
                        <th>Naziv artikla</th>
                        <th>Količina</th>
                        <th>JM</th>
                        <th>Cijena</th>
                        <th>Rabat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {podDetail.nalog_details.map((d, i) => (
                        <tr key={d.stavka_uid}>
                          <td>{i + 1}</td>
                          <td>{d.artikl || '—'}</td>
                          <td>{d.artikl_naziv || d.opis || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{d.kolicina ?? '—'}</td>
                          <td>{d.artikl_jm || '—'}</td>
                          <td>{d.cijena != null ? `${d.cijena.toFixed(2)} €` : '—'}</td>
                          <td>{d.rabat != null ? `${d.rabat}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Images */}
              {(podDetail.photo_urls.length > 0 || podDetail.signature_url) && (
                <div className="pod-images-section">
                  <h3>Dokumenti / Slike</h3>
                  <div className="pod-images-grid">
                    {podDetail.photo_urls.map((url, i) => (
                      <div className="pod-image-card" key={`photo-${i}`}>
                        <img
                          src={`${API_BASE}${url}`}
                          alt={`Fotografija ${i + 1}`}
                          onClick={() => setLightboxUrl(`${API_BASE}${url}`)}
                        />
                        <div className="image-label">📷 Fotografija {i + 1}</div>
                      </div>
                    ))}
                    {podDetail.signature_url && (
                      <div className="pod-image-card">
                        <img
                          src={`${API_BASE}${podDetail.signature_url}`}
                          alt="Potpis"
                          onClick={() => setLightboxUrl(`${API_BASE}${podDetail.signature_url!}`)}
                        />
                        <div className="image-label">✍️ Potpis</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="pod-empty">Nije pronađen POD detalj.</div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="pod-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="POD slika" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
