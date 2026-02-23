"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast"
import { Warehouse, Pencil, Building2, Clock, Phone, Mail, Truck, RefreshCw } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

interface WarehouseType {
  id: number
  code: string | null
  naziv: string
  adresa: string | null
  mjesto: string | null
  postanski_broj: string | null
  drzava: string | null
  lat: number | null
  lng: number | null
  tip: string
  is_central: boolean
  radno_vrijeme_od: string | null
  radno_vrijeme_do: string | null
  kontakt_telefon: string | null
  kontakt_email: string | null
  max_vozila: number | null
  aktivan: boolean
  sync_naloga: boolean
}

async function apiFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${API_BASE}${url}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...opts.headers },
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Greška" }))
    throw new Error(err.detail || `HTTP ${resp.status}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json()
}

const emptyForm = {
  code: "",
  naziv: "",
  adresa: "",
  mjesto: "",
  postanski_broj: "",
  drzava: "Hrvatska",
  lat: "",
  lng: "",
  tip: "store",
  is_central: false,
  aktivan: true,
  sync_naloga: false,
  radno_vrijeme_od: "07:00",
  radno_vrijeme_do: "15:00",
  kontakt_telefon: "",
  kontakt_email: "",
  max_vozila: "",
}

export default function WarehousesPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editWh, setEditWh] = useState<WarehouseType | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: warehouses = [], isLoading } = useQuery<WarehouseType[]>({
    queryKey: ["warehouses"],
    queryFn: () => apiFetch("/v1/warehouses"),
  })

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (editWh) {
        return apiFetch(`/v1/warehouses/${editWh.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        })
      }
      return apiFetch("/v1/warehouses", {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] })
      setShowModal(false)
      toast.success(editWh ? "Skladište ažurirano" : "Skladište kreirano")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const openCreate = () => {
    setEditWh(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (w: WarehouseType) => {
    setEditWh(w)
    setForm({
      code: w.code || "",
      naziv: w.naziv,
      adresa: w.adresa || "",
      mjesto: w.mjesto || "",
      postanski_broj: w.postanski_broj || "",
      drzava: w.drzava || "Hrvatska",
      lat: w.lat?.toString() || "",
      lng: w.lng?.toString() || "",
      tip: w.tip,
      is_central: w.is_central,
      aktivan: w.aktivan,
      sync_naloga: w.sync_naloga,
      radno_vrijeme_od: w.radno_vrijeme_od || "",
      radno_vrijeme_do: w.radno_vrijeme_do || "",
      kontakt_telefon: w.kontakt_telefon || "",
      kontakt_email: w.kontakt_email || "",
      max_vozila: w.max_vozila?.toString() || "",
    })
    setShowModal(true)
  }

  const handleSubmit = () => {
    saveMut.mutate({
      code: form.code || null,
      naziv: form.naziv,
      adresa: form.adresa || null,
      mjesto: form.mjesto || null,
      postanski_broj: form.postanski_broj || null,
      drzava: form.drzava || null,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      tip: form.tip,
      is_central: form.is_central,
      aktivan: form.aktivan,
      sync_naloga: form.sync_naloga,
      radno_vrijeme_od: form.radno_vrijeme_od || null,
      radno_vrijeme_do: form.radno_vrijeme_do || null,
      kontakt_telefon: form.kontakt_telefon || null,
      kontakt_email: form.kontakt_email || null,
      max_vozila: form.max_vozila ? parseInt(form.max_vozila) : null,
    })
  }

  const canManage = hasPermission("warehouses.create")

  return (
    <PermissionGuard permission="warehouses.view">
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Skladišta"
        subtitle="Upravljanje skladištima"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Warehouse className="mr-2 h-4 w-4" />
              Novo skladište
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center h-32 text-muted-foreground">
            Učitavanje...
          </div>
        ) : (
          [...warehouses]
            .sort((a, b) =>
              (a.naziv || "").localeCompare(b.naziv || "", "hr")
            )
            .map((w) => (
              <Card
                key={w.id}
                className={`glass transition-colors ${
                  !w.aktivan ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={w.is_central ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {w.is_central ? (
                        <>
                          <Building2 className="mr-1 h-3 w-3" />
                          Centralno
                        </>
                      ) : (
                        <>
                          <Warehouse className="mr-1 h-3 w-3" />
                          Poslovnica
                        </>
                      )}
                    </Badge>
                    {w.code && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {w.code}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base mt-2">{w.naziv}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    {w.adresa || "—"}, {w.mjesto || ""} {w.postanski_broj || ""}
                  </p>
                  <div className="flex flex-wrap gap-3 text-muted-foreground">
                    {w.radno_vrijeme_od && w.radno_vrijeme_do && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {w.radno_vrijeme_od}–{w.radno_vrijeme_do}
                      </span>
                    )}
                    {w.kontakt_telefon && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {w.kontakt_telefon}
                      </span>
                    )}
                    {w.max_vozila && (
                      <span className="flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5" />
                        Max {w.max_vozila} vozila
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-muted-foreground text-xs flex-1">
                      {w.lat && w.lng ? (
                        <>Koordinate: {w.lat}, {w.lng}</>
                      ) : (
                        "Bez koordinata"
                      )}
                    </div>
                    {w.sync_naloga && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30">
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Sync
                      </Badge>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 border-border"
                      onClick={() => openEdit(w)}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Uredi
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editWh ? "Uredi skladište" : "Novo skladište"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kod (npr. 01, 100)</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Naziv *</Label>
              <Input
                value={form.naziv}
                onChange={(e) => setForm({ ...form, naziv: e.target.value })}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Tip</Label>
              <Select
                value={form.tip}
                onValueChange={(v) => setForm({ ...form, tip: v })}
              >
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Poslovnica</SelectItem>
                  <SelectItem value="central">Centralno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="is_central"
                checked={form.is_central}
                onCheckedChange={(c) =>
                  setForm({ ...form, is_central: !!c })
                }
              />
              <Label htmlFor="is_central">Centralno skladište</Label>
            </div>
            <div className="space-y-2">
              <Label>Država</Label>
              <Input
                value={form.drzava}
                onChange={(e) => setForm({ ...form, drzava: e.target.value })}
                className="bg-secondary/50 border-border"
              />
            </div>
            {editWh && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="aktivan"
                  checked={form.aktivan}
                  onCheckedChange={(c) => setForm({ ...form, aktivan: !!c })}
                />
                <Label htmlFor="aktivan">Aktivno skladište</Label>
              </div>
            )}
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="sync_naloga"
                checked={form.sync_naloga}
                onCheckedChange={(c) => setForm({ ...form, sync_naloga: !!c })}
              />
              <Label htmlFor="sync_naloga" className="flex items-center gap-1">
                <RefreshCw className="h-3.5 w-3.5 text-green-600" />
                Sinkronizacija naloga
              </Label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Adresa</Label>
              <Input
                value={form.adresa}
                onChange={(e) => setForm({ ...form, adresa: e.target.value })}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Mjesto</Label>
              <Input
                value={form.mjesto}
                onChange={(e) => setForm({ ...form, mjesto: e.target.value })}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Poštanski broj</Label>
              <Input
                value={form.postanski_broj}
                onChange={(e) =>
                  setForm({ ...form, postanski_broj: e.target.value })
                }
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Lat</Label>
              <Input
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder="45.xxxx"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Lng</Label>
              <Input
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                placeholder="15.xxxx"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Radno vrijeme od</Label>
              <Input
                value={form.radno_vrijeme_od}
                onChange={(e) =>
                  setForm({ ...form, radno_vrijeme_od: e.target.value })
                }
                placeholder="07:00"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Radno vrijeme do</Label>
              <Input
                value={form.radno_vrijeme_do}
                onChange={(e) =>
                  setForm({ ...form, radno_vrijeme_do: e.target.value })
                }
                placeholder="15:00"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Kontakt telefon</Label>
              <Input
                value={form.kontakt_telefon}
                onChange={(e) =>
                  setForm({ ...form, kontakt_telefon: e.target.value })
                }
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Kontakt email</Label>
              <Input
                type="email"
                value={form.kontakt_email}
                onChange={(e) =>
                  setForm({ ...form, kontakt_email: e.target.value })
                }
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Max vozila</Label>
              <Input
                type="number"
                value={form.max_vozila}
                onChange={(e) =>
                  setForm({ ...form, max_vozila: e.target.value })
                }
                className="bg-secondary/50 border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Odustani
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.naziv || saveMut.isPending}
            >
              {editWh ? "Spremi" : "Kreiraj"}
            </Button>
          </DialogFooter>
          {saveMut.error && (
            <p className="text-sm text-destructive">
              {(saveMut.error as Error).message}
            </p>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
    </PermissionGuard>
  )
}
