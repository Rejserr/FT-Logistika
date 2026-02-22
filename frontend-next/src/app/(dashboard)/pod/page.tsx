"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { podApi } from "@/services/api"
import {
  Search,
  Camera,
  FileSignature,
  Check,
  X,
  Send,
  Loader2,
  XCircle,
} from "lucide-react"

const API_BASE = "/api"

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

export default function PodPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSearch, setActiveSearch] = useState("")
  const [selectedPodId, setSelectedPodId] = useState<number | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: pods = [], isLoading: listLoading } = useQuery<PodListItem[]>({
    queryKey: ["pods", activeSearch],
    queryFn: () => podApi.list(activeSearch || undefined) as Promise<PodListItem[]>,
  })

  const { data: podDetail, isLoading: detailLoading } = useQuery<PodDetail>({
    queryKey: ["pod-detail", selectedPodId],
    queryFn: () => podApi.detail(selectedPodId!) as Promise<PodDetail>,
    enabled: !!selectedPodId,
  })

  const sendMutation = useMutation({
    mutationFn: (podId: number) => podApi.sendToLuceed(podId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pods"] })
      queryClient.invalidateQueries({
        queryKey: ["pod-detail", selectedPodId],
      })
    },
  })

  const handleSearch = useCallback(() => {
    setActiveSearch(searchQuery.trim())
    setSelectedPodId(null)
  }, [searchQuery])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch()
    },
    [handleSearch]
  )

  const formatDate = (d: string | null) => {
    if (!d) return "—"
    try {
      return new Date(d).toLocaleDateString("hr-HR")
    } catch {
      return d
    }
  }

  const formatDateTime = (d: string | null) => {
    if (!d) return "—"
    try {
      return new Date(d).toLocaleString("hr-HR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return d
    }
  }

  const formatNalog = (
    uid: string | null,
    broj: number | null,
    skladiste: string | null
  ) => {
    if (broj && skladiste) return `${broj}-${skladiste}`
    return uid || "—"
  }

  return (
    <PermissionGuard permission="pod.view">
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Proof of Delivery"
        subtitle="Pregled i slanje POD dokumenata u Luceed"
      />

      <Card className="glass p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pretraži po nalog_prodaje_uid ili broj-skladište..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex h-9 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button onClick={handleSearch}>Pretraži</Button>
          {pods.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {pods.length} POD zapisa
            </span>
          )}
        </div>
      </Card>

      <Card className="glass overflow-hidden">
        {listLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Učitavanje...
          </div>
        ) : pods.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            {activeSearch
              ? "Nema rezultata za zadanu pretragu."
              : "Nema POD zapisa."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Nalog</TableHead>
                  <TableHead className="text-muted-foreground">Partner</TableHead>
                  <TableHead className="text-muted-foreground">Vozač</TableHead>
                  <TableHead className="text-muted-foreground">Ruta</TableHead>
                  <TableHead className="text-muted-foreground">Primio</TableHead>
                  <TableHead className="text-muted-foreground">Dokumenti</TableHead>
                  <TableHead className="text-muted-foreground">Luceed</TableHead>
                  <TableHead className="text-muted-foreground">Datum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pods.map((pod) => (
                  <TableRow
                    key={pod.id}
                    className={`cursor-pointer border-border transition-colors ${
                      selectedPodId === pod.id
                        ? "bg-primary/10"
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() => setSelectedPodId(pod.id)}
                  >
                    <TableCell className="font-medium">
                      {formatNalog(
                        pod.nalog_prodaje_uid,
                        pod.nalog_broj,
                        pod.skladiste
                      )}
                    </TableCell>
                    <TableCell>{pod.partner_naziv || "—"}</TableCell>
                    <TableCell>{pod.driver_name || "—"}</TableCell>
                    <TableCell>
                      {pod.ruta_id ? `#${pod.ruta_id}` : "—"}
                    </TableCell>
                    <TableCell>{pod.recipient_name || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {pod.has_photos && (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-blue-500/15 text-blue-400 border-blue-500/20"
                          >
                            <Camera className="h-3 w-3" />
                            {pod.photo_count}
                          </Badge>
                        )}
                        {pod.has_signature && (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                          >
                            <FileSignature className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {pod.sent_to_luceed ? (
                        <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                          <Check className="h-3 w-3" />
                          Poslano
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">
                          Nije poslano
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(pod.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {selectedPodId && (
        <Card className="glass p-6 space-y-6">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Učitavanje detalja...
            </div>
          ) : podDetail ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">
                  POD —{" "}
                  {formatNalog(
                    podDetail.nalog_prodaje_uid,
                    podDetail.nalog_broj,
                    podDetail.skladiste
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant={podDetail.sent_to_luceed ? "secondary" : "default"}
                    onClick={() => sendMutation.mutate(podDetail.id)}
                    disabled={sendMutation.isPending}
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {sendMutation.isPending
                      ? "Šaljem..."
                      : podDetail.sent_to_luceed
                        ? "Ponovno pošalji u Luceed"
                        : "Pošalji u Luceed"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedPodId(null)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {sendMutation.isSuccess && (
                <div className="rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-4 py-3 text-sm">
                  <Check className="inline h-4 w-4 mr-2" />
                  {(sendMutation.data as { message?: string })?.message ||
                    "Uspješno poslano u Luceed."}
                </div>
              )}
              {sendMutation.isError && (
                <div className="rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 px-4 py-3 text-sm">
                  <X className="inline h-4 w-4 mr-2" />
                  {(sendMutation.error as Error)?.message ||
                    "Greška pri slanju u Luceed."}
                </div>
              )}

              <div className="flex flex-wrap gap-6">
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-center min-w-[80px]">
                  <div className="text-2xl font-semibold">
                    {podDetail.photo_count}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Fotografija
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-center min-w-[80px]">
                  <div className="text-2xl font-semibold">
                    {podDetail.has_signature ? (
                      <Check className="inline h-6 w-6 text-emerald-400" />
                    ) : (
                      <X className="inline h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Potpis</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-center min-w-[80px]">
                  <div className="text-2xl font-semibold">
                    {podDetail.sent_to_luceed ? (
                      <Check className="inline h-6 w-6 text-emerald-400" />
                    ) : (
                      <X className="inline h-6 w-6 text-amber-400" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Luceed</div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {podDetail.nalog_header && (
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <h3 className="font-medium">Nalog prodaje</h3>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Broj-Skladište</dt>
                        <dd className="font-medium">
                          {podDetail.nalog_header.broj}-
                          {podDetail.nalog_header.skladiste}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">UID</dt>
                        <dd className="truncate">
                          {podDetail.nalog_header.nalog_prodaje_uid}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Datum</dt>
                        <dd>{formatDate(podDetail.nalog_header.datum)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Datum isporuke</dt>
                        <dd>{formatDate(podDetail.nalog_header.raspored)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Status</dt>
                        <dd>{podDetail.nalog_header.status || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Vrsta isporuke</dt>
                        <dd>
                          {podDetail.nalog_header.vrsta_isporuke || "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Za naplatu</dt>
                        <dd className="font-medium">
                          {podDetail.nalog_header.za_naplatu
                            ? `${podDetail.nalog_header.za_naplatu.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} €`
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Težina</dt>
                        <dd>
                          {podDetail.nalog_header.total_weight
                            ? `${podDetail.nalog_header.total_weight.toFixed(1)} kg`
                            : "—"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Kreirao</dt>
                        <dd>
                          {podDetail.nalog_header.kreirao__radnik_ime || "—"}
                        </dd>
                      </div>
                      {podDetail.nalog_header.napomena && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Napomena</dt>
                          <dd>{podDetail.nalog_header.napomena}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <h3 className="font-medium">Partner / Kupac</h3>
                  {podDetail.partner ? (
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Naziv</dt>
                        <dd className="font-medium">
                          {podDetail.partner.naziv || "—"}
                        </dd>
                      </div>
                      {podDetail.partner.ime && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Kontakt</dt>
                          <dd>
                            {podDetail.partner.ime}{" "}
                            {podDetail.partner.prezime}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Adresa</dt>
                        <dd>{podDetail.partner.adresa || "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Mjesto</dt>
                        <dd>
                          {podDetail.partner.postanski_broj}{" "}
                          {podDetail.partner.naziv_mjesta}
                        </dd>
                      </div>
                      {podDetail.partner.mobitel && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Mobitel</dt>
                          <dd>{podDetail.partner.mobitel}</dd>
                        </div>
                      )}
                      {podDetail.partner.telefon && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Telefon</dt>
                          <dd>{podDetail.partner.telefon}</dd>
                        </div>
                      )}
                      {podDetail.partner.e_mail && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Email</dt>
                          <dd>{podDetail.partner.e_mail}</dd>
                        </div>
                      )}
                      {podDetail.partner.oib && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">OIB</dt>
                          <dd>{podDetail.partner.oib}</dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nema podataka o partneru.
                    </p>
                  )}

                  <h3 className="font-medium pt-4">Dostava</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Vozač</dt>
                      <dd>{podDetail.driver_name || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Primio</dt>
                      <dd>{podDetail.recipient_name || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Ruta</dt>
                      <dd>
                        {podDetail.ruta_id ? `#${podDetail.ruta_id}` : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Datum dostave</dt>
                      <dd>{formatDateTime(podDetail.created_at)}</dd>
                    </div>
                    {podDetail.comment && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Komentar</dt>
                        <dd>{podDetail.comment}</dd>
                      </div>
                    )}
                    {podDetail.gps_lat != null && podDetail.gps_lng != null && (
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">GPS</dt>
                        <dd>
                          {podDetail.gps_lat.toFixed(6)},{" "}
                          {podDetail.gps_lng.toFixed(6)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {podDetail.nalog_details.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <h3 className="font-medium mb-3">
                    Stavke naloga ({podDetail.nalog_details.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground">#</TableHead>
                          <TableHead className="text-muted-foreground">Šifra</TableHead>
                          <TableHead className="text-muted-foreground">
                            Naziv artikla
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Količina
                          </TableHead>
                          <TableHead className="text-muted-foreground">JM</TableHead>
                          <TableHead className="text-muted-foreground">
                            Cijena
                          </TableHead>
                          <TableHead className="text-muted-foreground">
                            Rabat
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {podDetail.nalog_details.map((d, i) => (
                          <TableRow key={d.stavka_uid} className="border-border">
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{d.artikl || "—"}</TableCell>
                            <TableCell>
                              {d.artikl_naziv || d.opis || "—"}
                            </TableCell>
                            <TableCell className="font-medium">
                              {d.kolicina ?? "—"}
                            </TableCell>
                            <TableCell>{d.artikl_jm || "—"}</TableCell>
                            <TableCell>
                              {d.cijena != null
                                ? `${d.cijena.toFixed(2)} €`
                                : "—"}
                            </TableCell>
                            <TableCell>
                              {d.rabat != null ? `${d.rabat}%` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {(podDetail.photo_urls?.length > 0 || podDetail.signature_url) && (
                <div className="space-y-3">
                  <h3 className="font-medium">Dokumenti / Slike</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {podDetail.photo_urls?.map((url, i) => (
                      <div
                        key={`photo-${i}`}
                        className="rounded-lg border border-border overflow-hidden bg-muted/20"
                      >
                        <img
                          src={`${API_BASE}${url}`}
                          alt={`Fotografija ${i + 1}`}
                          className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setLightboxUrl(`${API_BASE}${url}`)}
                        />
                        <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          Fotografija {i + 1}
                        </div>
                      </div>
                    ))}
                    {podDetail.signature_url && (
                      <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
                        <img
                          src={`${API_BASE}${podDetail.signature_url}`}
                          alt="Potpis"
                          className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() =>
                            setLightboxUrl(
                              `${API_BASE}${podDetail.signature_url!}`
                            )
                          }
                        />
                        <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
                          <FileSignature className="h-3 w-3" />
                          Potpis
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              Nije pronađen POD detalj.
            </div>
          )}
        </Card>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="POD slika"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      </div>
      </div>
    </PermissionGuard>
  )
}
