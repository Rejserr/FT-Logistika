"use client"

import { useState, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, type ColumnDef } from "@/components/common/data-table"
import { itemsApi, syncApi } from "@/services/api"
import type { Artikl, KriterijaSku } from "@/types"
import { toast } from "@/lib/toast"
import {
  Package,
  Tags,
  RefreshCw,
  Upload,
  Download,
  Settings,
  Pencil,
  Trash2,
  Loader2,
  Plus,
} from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

type TabType = "artikli" | "kriterija"

export default function ArtikliPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>("artikli")
  const [search, setSearch] = useState("")

  const [showAddModal, setShowAddModal] = useState(false)
  const [addArtikl, setAddArtikl] = useState("")
  const [addKriterijaId, setAddKriterijaId] = useState<number | "">("")

  const [showSkuModal, setShowSkuModal] = useState(false)
  const [skuEditId, setSkuEditId] = useState<number | null>(null)
  const [skuNaziv, setSkuNaziv] = useState("")
  const [skuOpis, setSkuOpis] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: artikli = [], isLoading: artikliLoading } = useQuery({
    queryKey: ["artikli", search],
    queryFn: () =>
      itemsApi.listArtikli({ search: search || undefined, limit: 10000 }),
  })

  const { data: kriterije = [] } = useQuery({
    queryKey: ["kriterije-sku"],
    queryFn: () => itemsApi.listKriterije(),
  })

  const { data: artikliKriterija = [], isLoading: akLoading } = useQuery({
    queryKey: ["artikli-kriterija"],
    queryFn: () => itemsApi.listArtikliKriterija(),
  })

  const syncMutation = useMutation({
    mutationFn: () => syncApi.syncArtikli(),
    onSuccess: (data) =>
      toast.success(
        `Sinkronizacija artikala pokrenuta (ID: ${data.sync_id})`
      ),
    onError: (error: Error) =>
      toast.error(`Sinkronizacija nije uspjela: ${error.message}`),
  })

  const createAkMutation = useMutation({
    mutationFn: (data: { artikl: string; kriterija_id: number }) =>
      itemsApi.createArtiklKriterija(data),
    onSuccess: () => {
      toast.success("Artikl-kriterija dodana.")
      queryClient.invalidateQueries({ queryKey: ["artikli-kriterija"] })
      queryClient.invalidateQueries({ queryKey: ["artikli-kriterija-sifre"] })
      setShowAddModal(false)
      setAddArtikl("")
      setAddKriterijaId("")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteAkMutation = useMutation({
    mutationFn: (id: number) => itemsApi.deleteArtiklKriterija(id),
    onSuccess: () => {
      toast.success("Artikl-kriterija obrisana.")
      queryClient.invalidateQueries({ queryKey: ["artikli-kriterija"] })
      queryClient.invalidateQueries({ queryKey: ["artikli-kriterija-sifre"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const createSkuMutation = useMutation({
    mutationFn: (data: { naziv: string; opis?: string }) =>
      itemsApi.createKriterija(data),
    onSuccess: () => {
      toast.success("Kriterij kreiran.")
      queryClient.invalidateQueries({ queryKey: ["kriterije-sku"] })
      closeSkuModal()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateSkuMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: { naziv?: string; opis?: string }
    }) => itemsApi.updateKriterija(id, data),
    onSuccess: () => {
      toast.success("Kriterij ažuriran.")
      queryClient.invalidateQueries({ queryKey: ["kriterije-sku"] })
      closeSkuModal()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteSkuMutation = useMutation({
    mutationFn: (id: number) => itemsApi.deleteKriterija(id),
    onSuccess: () => {
      toast.success("Kriterij obrisan.")
      queryClient.invalidateQueries({ queryKey: ["kriterije-sku"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => itemsApi.importArtikliKriterija(file),
    onSuccess: (data) => {
      toast.success(
        `Import završen: ${data.imported} dodano, ${data.skipped} preskočeno.`
      )
      if (data.errors.length > 0) {
        toast.error(`Greške: ${data.errors.slice(0, 3).join("; ")}`)
      }
      queryClient.invalidateQueries({ queryKey: ["artikli-kriterija"] })
      queryClient.invalidateQueries({ queryKey: ["artikli-kriterija-sifre"] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const kriterijaMap = new Map(kriterije.map((k) => [k.id, k.naziv]))
  const akWithKriterija = artikliKriterija.map((ak) => ({
    ...ak,
    kriterija_naziv:
      kriterijaMap.get(ak.kriterija_id) || `#${ak.kriterija_id}`,
  }))

  const closeSkuModal = () => {
    setShowSkuModal(false)
    setSkuEditId(null)
    setSkuNaziv("")
    setSkuOpis("")
  }

  const openSkuEdit = (sku: KriterijaSku) => {
    setSkuEditId(sku.id)
    setSkuNaziv(sku.naziv)
    setSkuOpis(sku.opis || "")
    setShowSkuModal(true)
  }

  const handleSkuSubmit = () => {
    if (!skuNaziv.trim()) return
    if (skuEditId) {
      updateSkuMutation.mutate({
        id: skuEditId,
        data: { naziv: skuNaziv, opis: skuOpis },
      })
    } else {
      createSkuMutation.mutate({ naziv: skuNaziv, opis: skuOpis || undefined })
    }
  }

  const handleAddAk = () => {
    if (!addArtikl.trim() || !addKriterijaId) return
    createAkMutation.mutate({
      artikl: addArtikl.trim(),
      kriterija_id: Number(addKriterijaId),
    })
  }

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        importMutation.mutate(file)
        e.target.value = ""
      }
    },
    [importMutation]
  )

  const artikliColumns: ColumnDef<Artikl>[] = [
    { key: "artikl", header: "Šifra" },
    { key: "naziv", header: "Naziv" },
    { key: "naziv_kratki", header: "Kratki naziv", visible: false },
    { key: "jm", header: "JM" },
    { key: "grupa_artikla", header: "Grupa" },
    { key: "grupa_artikla_naziv", header: "Naziv grupe", visible: false },
    { key: "duzina", header: "Dužina (mm)", visible: false },
    { key: "sirina", header: "Širina (mm)", visible: false },
    { key: "visina", header: "Visina (mm)", visible: false },
    { key: "masa", header: "Masa (kg)" },
    {
      key: "volumen_m3",
      header: "Volumen (m³)",
      getValue: (a) =>
        a.volumen != null ? (a.volumen / 1_000_000).toFixed(6) : "",
      render: (a) =>
        a.volumen != null ? (a.volumen / 1_000_000).toFixed(6) : "—",
    },
  ]

  const kriterijaColumns: ColumnDef<(typeof akWithKriterija)[number]>[] = [
    { key: "artikl", header: "Šifra artikla" },
    { key: "artikl_naziv", header: "Naziv artikla" },
    { key: "kriterija_naziv", header: "Kriterija" },
    {
      key: "akcije",
      header: "Akcije",
      sortable: false,
      filterable: false,
      render: (ak) => (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm("Obrisati ovu vezu?")) deleteAkMutation.mutate(ak.id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  const kriterijeSkuColumns: ColumnDef<KriterijaSku>[] = [
    { key: "id", header: "ID" },
    { key: "naziv", header: "Naziv" },
    {
      key: "opis",
      header: "Opis",
      getValue: (k) => k.opis || "",
      render: (k) => k.opis || "—",
    },
    {
      key: "akcije",
      header: "Akcije",
      sortable: false,
      filterable: false,
      render: (k) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              openSkuEdit(k)
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm("Obrisati kriterij?")) deleteSkuMutation.mutate(k.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PermissionGuard permission="items.view">
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Artikli"
        subtitle="Artikli i kriterija artikala iz ERP-a"
      />
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabType)}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-secondary/50 border border-border">
          <TabsTrigger value="artikli" className="gap-2">
            <Package className="h-4 w-4" />
            Artikli ({artikli.length})
          </TabsTrigger>
          <TabsTrigger value="kriterija" className="gap-2">
            <Tags className="h-4 w-4" />
            Kriterija artikala ({artikliKriterija.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="artikli" className="mt-4 space-y-4">
          <Card className="glass p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2 min-w-[200px]">
                <Label>Pretraga</Label>
                <Input
                  placeholder="Šifra ili naziv artikla..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="flex-1" />
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sinkroniziraj artikle iz ERP-a
              </Button>
            </div>
          </Card>

          <Card className="glass p-4">
            <DataTable<Artikl>
              storageKey="ft-artikli"
              columns={artikliColumns}
              data={artikli}
              loading={artikliLoading}
              pageSize={500}
              searchPlaceholder="Pretraži artikle..."
              showColumnPicker
              getRowId={(a) => a.artikl_uid}
              emptyMessage="Nema artikala za prikaz."
            />
          </Card>
        </TabsContent>

        <TabsContent value="kriterija" className="mt-4 space-y-4">
          <Card className="glass p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Dodaj kriterij artikla
              </Button>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
              >
                {importMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Uvezi iz XLSX
              </Button>
              <a
                href={`${API_BASE}/artikli-kriterija/example-xlsx`}
                download
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-secondary/50 hover:bg-secondary px-4 py-2"
              >
                <Download className="mr-2 h-4 w-4" />
                Preuzmi primjer XLSX
              </a>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex-1" />
              <Button
                variant="outline"
                onClick={() => {
                  setSkuEditId(null)
                  setSkuNaziv("")
                  setSkuOpis("")
                  setShowSkuModal(true)
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Upravljaj kriterijima
              </Button>
            </div>
          </Card>

          <Card className="glass p-4">
            <DataTable
              storageKey="ft-artikli-kriterija"
              columns={kriterijaColumns}
              data={akWithKriterija}
              loading={akLoading}
              pageSize={50}
              searchPlaceholder="Pretraži..."
              showColumnPicker
              getRowId={(ak) => String(ak.id)}
              emptyMessage="Nema artikala s dodijeljenim kriterijima."
            />
          </Card>

          <Card className="glass p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Tipovi kriterija</h3>
              <Button
                size="sm"
                onClick={() => {
                  setSkuEditId(null)
                  setSkuNaziv("")
                  setSkuOpis("")
                  setShowSkuModal(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Novi kriterij
              </Button>
            </div>
            <DataTable<KriterijaSku>
              storageKey="ft-kriterije-sku"
              columns={kriterijeSkuColumns}
              data={kriterije}
              loading={false}
              pageSize={50}
              searchPlaceholder="Pretraži kriterije..."
              showColumnPicker
              getRowId={(k) => String(k.id)}
              emptyMessage="Nema kriterija."
            />
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md bg-popover border-border">
          <DialogHeader>
            <DialogTitle>Dodaj artikl-kriterija vezu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Šifra artikla</Label>
              <Input
                placeholder="Unesite šifru artikla..."
                value={addArtikl}
                onChange={(e) => setAddArtikl(e.target.value)}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Kriterija</Label>
              <Select
                value={addKriterijaId === "" ? "__none__" : String(addKriterijaId)}
                onValueChange={(v) =>
                  setAddKriterijaId(
                    v && v !== "__none__" ? Number(v) : ("" as number | "")
                  )
                }
              >
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Odaberite kriterij" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Odaberite kriterij —</SelectItem>
                  {kriterije.map((k) => (
                    <SelectItem key={k.id} value={String(k.id)}>
                      {k.naziv}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              Odustani
            </Button>
            <Button
              onClick={handleAddAk}
              disabled={
                createAkMutation.isPending ||
                !addArtikl.trim() ||
                !addKriterijaId
              }
            >
              {createAkMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Spremi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSkuModal} onOpenChange={(open) => !open && closeSkuModal()}>
        <DialogContent className="sm:max-w-md bg-popover border-border">
          <DialogHeader>
            <DialogTitle>
              {skuEditId ? "Uredi kriterij" : "Novi kriterij"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Naziv</Label>
              <Input
                placeholder="Naziv kriterija..."
                value={skuNaziv}
                onChange={(e) => setSkuNaziv(e.target.value)}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Textarea
                placeholder="Opis kriterija..."
                value={skuOpis}
                onChange={(e) => setSkuOpis(e.target.value)}
                rows={3}
                className="bg-secondary/50 border-border min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeSkuModal}>
              Odustani
            </Button>
            <Button
              onClick={handleSkuSubmit}
              disabled={
                createSkuMutation.isPending ||
                updateSkuMutation.isPending ||
                !skuNaziv.trim()
              }
            >
              {(createSkuMutation.isPending ||
                updateSkuMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Spremi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
    </PermissionGuard>
  )
}
