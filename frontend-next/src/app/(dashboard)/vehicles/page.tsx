"use client"

import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { PageHeader } from "@/components/layout/page-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Badge } from "@/components/ui/badge"
import { vehiclesApi, driversApi, regionsApi } from "@/services/api"
import type { Vozilo, Vozac, VoziloTip, Regija } from "@/types"
import { Truck, Users, Layers, ChevronDown, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

interface WarehouseItem {
  id: number
  code: string | null
  naziv: string
}

type TabType = "vehicles" | "drivers" | "vehicleTypes"

interface VehicleFormData {
  oznaka: string
  tip_id: number | null
  warehouse_id: number | null
  nosivost_kg: number | null
  volumen_m3: number | null
  profil_rutiranja: string
  paleta: number | null
  aktivan: boolean
}

interface VehicleTypeFormData {
  naziv: string
  opis: string
  aktivan: boolean
}

interface DriverFormData {
  ime: string
  prezime: string
  telefon: string
  warehouse_id: number | null
  vozilo_id: number | null
  aktivan: boolean
}

function parseProfilRegije(profil: string | null): number[] {
  if (!profil) return []
  return profil
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !isNaN(n) && n > 0)
}

export default function VehiclesPage() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === "Admin"
  const [activeTab, setActiveTab] = useState<TabType>("vehicles")
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vozilo | null>(null)
  const [editingDriver, setEditingDriver] = useState<Vozac | null>(null)
  const [editingType, setEditingType] = useState<VoziloTip | null>(null)
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false)
  const regionDropdownRef = useRef<HTMLDivElement>(null)

  const [vehicleForm, setVehicleForm] = useState<VehicleFormData>({
    oznaka: "",
    tip_id: null,
    warehouse_id: currentUser?.warehouse_id ?? null,
    nosivost_kg: null,
    volumen_m3: null,
    profil_rutiranja: "",
    paleta: null,
    aktivan: true,
  })

  const [typeForm, setTypeForm] = useState<VehicleTypeFormData>({
    naziv: "",
    opis: "",
    aktivan: true,
  })

  const [driverForm, setDriverForm] = useState<DriverFormData>({
    ime: "",
    prezime: "",
    telefon: "",
    warehouse_id: currentUser?.warehouse_id ?? null,
    vozilo_id: null,
    aktivan: true,
  })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        regionDropdownRef.current &&
        !regionDropdownRef.current.contains(e.target as Node)
      ) {
        setRegionDropdownOpen(false)
      }
    }
    if (regionDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [regionDropdownOpen])

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: vehiclesApi.list,
  })

  const { data: vehicleTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ["vehicle-types"],
    queryFn: vehiclesApi.listTypes,
  })

  const { data: regions = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: regionsApi.list,
  })

  const { data: warehouses = [] } = useQuery<WarehouseItem[]>({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const resp = await fetch(`${API_BASE}/v1/warehouses`, {
        credentials: "include",
      })
      if (!resp.ok) throw new Error("Greška pri dohvatu skladišta")
      return resp.json()
    },
  })

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: driversApi.list,
  })

  const getWarehouseName = (whId: number | null | undefined) => {
    if (!whId) return "—"
    const wh = warehouses.find((w) => w.id === whId)
    return wh ? `${wh.code || ""} - ${wh.naziv}`.trim() : `ID: ${whId}`
  }

  const getRegionNames = (profil: string | null): string => {
    const ids = parseProfilRegije(profil)
    if (ids.length === 0) return "—"
    return (
      ids
        .map((id) => regions.find((r: Regija) => r.id === id)?.naziv)
        .filter(Boolean)
        .join(", ") || "—"
    )
  }

  const getVehicleTypeName = (tipId: number | null) => {
    if (!tipId) return "—"
    const tip = vehicleTypes.find((t: VoziloTip) => t.id === tipId)
    return tip?.naziv || "—"
  }

  const getVehicleLabel = (vehicleId: number | null) => {
    if (!vehicleId) return "—"
    const vehicle = vehicles.find((v: Vozilo) => v.id === vehicleId)
    return vehicle?.oznaka || "—"
  }

  const selectedRegionIds = parseProfilRegije(vehicleForm.profil_rutiranja)
  const toggleRegion = (regionId: number) => {
    const current = selectedRegionIds
    const next = current.includes(regionId)
      ? current.filter((id) => id !== regionId)
      : [...current, regionId]
    setVehicleForm({ ...vehicleForm, profil_rutiranja: next.join(",") })
  }

  const createVehicleMutation = useMutation({
    mutationFn: vehiclesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
      closeVehicleModal()
    },
  })

  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Vozilo> }) =>
      vehiclesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
      closeVehicleModal()
    },
  })

  const deleteVehicleMutation = useMutation({
    mutationFn: vehiclesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] })
    },
  })

  const createDriverMutation = useMutation({
    mutationFn: driversApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] })
      closeDriverModal()
    },
  })

  const updateDriverMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Vozac> }) =>
      driversApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] })
      closeDriverModal()
    },
  })

  const deleteDriverMutation = useMutation({
    mutationFn: driversApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] })
    },
  })

  const createTypeMutation = useMutation({
    mutationFn: vehiclesApi.createType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle-types"] })
      closeTypeModal()
    },
  })

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<VoziloTip> }) =>
      vehiclesApi.updateType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle-types"] })
      closeTypeModal()
    },
  })

  const deleteTypeMutation = useMutation({
    mutationFn: vehiclesApi.deleteType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle-types"] })
    },
  })

  const openVehicleModal = (vehicle?: Vozilo) => {
    if (vehicle) {
      setEditingVehicle(vehicle)
      setVehicleForm({
        oznaka: vehicle.oznaka || "",
        tip_id: vehicle.tip_id,
        warehouse_id: vehicle.warehouse_id ?? null,
        nosivost_kg: vehicle.nosivost_kg,
        volumen_m3: vehicle.volumen_m3,
        profil_rutiranja: vehicle.profil_rutiranja || "",
        paleta: vehicle.paleta,
        aktivan: vehicle.aktivan ?? true,
      })
    } else {
      setEditingVehicle(null)
      setVehicleForm({
        oznaka: "",
        tip_id: null,
        warehouse_id: currentUser?.warehouse_id ?? null,
        nosivost_kg: null,
        volumen_m3: null,
        profil_rutiranja: "",
        paleta: null,
        aktivan: true,
      })
    }
    setShowVehicleModal(true)
  }

  const closeVehicleModal = () => {
    setShowVehicleModal(false)
    setEditingVehicle(null)
  }

  const openDriverModal = (driver?: Vozac) => {
    if (driver) {
      setEditingDriver(driver)
      setDriverForm({
        ime: driver.ime,
        prezime: driver.prezime,
        telefon: driver.telefon || "",
        warehouse_id: driver.warehouse_id ?? null,
        vozilo_id: driver.vozilo_id,
        aktivan: driver.aktivan ?? true,
      })
    } else {
      setEditingDriver(null)
      setDriverForm({
        ime: "",
        prezime: "",
        telefon: "",
        warehouse_id: currentUser?.warehouse_id ?? null,
        vozilo_id: null,
        aktivan: true,
      })
    }
    setShowDriverModal(true)
  }

  const closeDriverModal = () => {
    setShowDriverModal(false)
    setEditingDriver(null)
  }

  const openTypeModal = (type?: VoziloTip) => {
    if (type) {
      setEditingType(type)
      setTypeForm({
        naziv: type.naziv,
        opis: type.opis || "",
        aktivan: type.aktivan ?? true,
      })
    } else {
      setEditingType(null)
      setTypeForm({ naziv: "", opis: "", aktivan: true })
    }
    setShowTypeModal(true)
  }

  const closeTypeModal = () => {
    setShowTypeModal(false)
    setEditingType(null)
  }

  const handleVehicleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingVehicle) {
      updateVehicleMutation.mutate({
        id: editingVehicle.id,
        data: vehicleForm,
      })
    } else {
      createVehicleMutation.mutate(vehicleForm)
    }
  }

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingDriver) {
      updateDriverMutation.mutate({
        id: editingDriver.id,
        data: driverForm,
      })
    } else {
      createDriverMutation.mutate(driverForm)
    }
  }

  const handleTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingType) {
      updateTypeMutation.mutate({ id: editingType.id, data: typeForm })
    } else {
      createTypeMutation.mutate(typeForm)
    }
  }

  const vehicleColumns: ColumnDef<Vozilo>[] = [
    { key: "oznaka", header: "Oznaka" },
    {
      key: "tip",
      header: "Tip",
      getValue: (v) => getVehicleTypeName(v.tip_id),
    },
    {
      key: "skladiste",
      header: "Skladište",
      getValue: (v) => getWarehouseName(v.warehouse_id),
    },
    {
      key: "nosivost_kg",
      header: "Nosivost (kg)",
      getValue: (v) => (v.nosivost_kg != null ? String(v.nosivost_kg) : ""),
      render: (v) =>
        v.nosivost_kg != null ? v.nosivost_kg.toLocaleString() : "—",
    },
    {
      key: "volumen_m3",
      header: "Volumen (m³)",
      getValue: (v) => (v.volumen_m3 != null ? String(v.volumen_m3) : ""),
      render: (v) => (v.volumen_m3 != null ? String(v.volumen_m3) : "—"),
    },
    {
      key: "profil_rutiranja",
      header: "Profil rutiranja",
      getValue: (v) => getRegionNames(v.profil_rutiranja),
      render: (v) => getRegionNames(v.profil_rutiranja),
    },
    {
      key: "paleta",
      header: "Paleta",
      getValue: (v) => (v.paleta != null ? String(v.paleta) : ""),
      render: (v) => (v.paleta != null ? String(v.paleta) : "—"),
    },
    {
      key: "aktivan",
      header: "Status",
      getValue: (v) => (v.aktivan ? "Aktivan" : "Neaktivan"),
      render: (v) => (
        <Badge
          variant="outline"
          className={
            v.aktivan
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
              : "bg-muted text-muted-foreground border-border"
          }
        >
          {v.aktivan ? "Aktivan" : "Neaktivan"}
        </Badge>
      ),
    },
    {
      key: "akcije",
      header: "Akcije",
      sortable: false,
      filterable: false,
      render: (vehicle) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              openVehicleModal(vehicle)
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
              if (confirm("Obrisati vozilo?"))
                deleteVehicleMutation.mutate(vehicle.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const driverColumns: ColumnDef<Vozac>[] = [
    {
      key: "ime_prezime",
      header: "Ime i prezime",
      getValue: (d) => `${d.ime} ${d.prezime}`,
      render: (d) => `${d.ime} ${d.prezime}`,
    },
    {
      key: "telefon",
      header: "Telefon",
      getValue: (d) => d.telefon || "",
      render: (d) => d.telefon || "—",
    },
    {
      key: "skladiste",
      header: "Skladište",
      getValue: (d) => getWarehouseName(d.warehouse_id),
      render: (d) => getWarehouseName(d.warehouse_id),
    },
    {
      key: "vozilo",
      header: "Vozilo",
      getValue: (d) => getVehicleLabel(d.vozilo_id),
      render: (d) => getVehicleLabel(d.vozilo_id),
    },
    {
      key: "aktivan",
      header: "Status",
      getValue: (d) => (d.aktivan ? "Aktivan" : "Neaktivan"),
      render: (d) => (
        <Badge
          variant="outline"
          className={
            d.aktivan
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
              : "bg-muted text-muted-foreground border-border"
          }
        >
          {d.aktivan ? "Aktivan" : "Neaktivan"}
        </Badge>
      ),
    },
    {
      key: "akcije",
      header: "Akcije",
      sortable: false,
      filterable: false,
      render: (driver) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              openDriverModal(driver)
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
              if (confirm("Obrisati vozača?"))
                deleteDriverMutation.mutate(driver.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  const typeColumns: ColumnDef<VoziloTip>[] = [
    { key: "id", header: "ID" },
    { key: "naziv", header: "Naziv" },
    {
      key: "opis",
      header: "Opis",
      getValue: (t) => t.opis || "",
      render: (t) => t.opis || "—",
    },
    {
      key: "aktivan",
      header: "Status",
      getValue: (t) => (t.aktivan ? "Aktivan" : "Neaktivan"),
      render: (t) => (
        <Badge
          variant="outline"
          className={
            t.aktivan
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
              : "bg-muted text-muted-foreground border-border"
          }
        >
          {t.aktivan ? "Aktivan" : "Neaktivan"}
        </Badge>
      ),
    },
    {
      key: "akcije",
      header: "Akcije",
      sortable: false,
      filterable: false,
      render: (type) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              openTypeModal(type)
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
              if (confirm("Obrisati tip vozila?"))
                deleteTypeMutation.mutate(type.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PermissionGuard permission="vehicles.view">
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Vozila i vozači"
        subtitle="Upravljanje voznim parkom"
        actions={
          activeTab === "vehicles" ? (
            <Button onClick={() => openVehicleModal()}>
              <Truck className="mr-2 h-4 w-4" />
              Novo vozilo
            </Button>
          ) : activeTab === "drivers" ? (
            <Button onClick={() => openDriverModal()}>
              <Users className="mr-2 h-4 w-4" />
              Novi vozač
            </Button>
          ) : (
            <Button onClick={() => openTypeModal()}>
              <Layers className="mr-2 h-4 w-4" />
              Novi tip vozila
            </Button>
          )
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabType)}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-secondary/50 border border-border">
          <TabsTrigger value="vehicles" className="gap-2">
            <Truck className="h-4 w-4" />
            Vozila ({vehicles.length})
          </TabsTrigger>
          <TabsTrigger value="drivers" className="gap-2">
            <Users className="h-4 w-4" />
            Vozači ({drivers.length})
          </TabsTrigger>
          <TabsTrigger value="vehicleTypes" className="gap-2">
            <Layers className="h-4 w-4" />
            Tipovi vozila ({vehicleTypes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="mt-4">
          <Card className="glass p-4">
            <DataTable<Vozilo>
              storageKey="ft-vehicles"
              columns={vehicleColumns}
              data={vehicles}
              loading={vehiclesLoading}
              pageSize={50}
              searchPlaceholder="Pretraži vozila..."
              showColumnPicker
              getRowId={(v) => String(v.id)}
              emptyMessage="Nema vozila."
            />
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <Card className="glass p-4">
            <DataTable<Vozac>
              storageKey="ft-drivers"
              columns={driverColumns}
              data={drivers}
              loading={driversLoading}
              pageSize={50}
              searchPlaceholder="Pretraži vozače..."
              showColumnPicker
              getRowId={(d) => String(d.id)}
              emptyMessage="Nema vozača."
            />
          </Card>
        </TabsContent>

        <TabsContent value="vehicleTypes" className="mt-4">
          <Card className="glass p-4">
            <DataTable<VoziloTip>
              storageKey="ft-vehicle-types"
              columns={typeColumns}
              data={vehicleTypes}
              loading={typesLoading}
              pageSize={50}
              searchPlaceholder="Pretraži tipove..."
              showColumnPicker
              getRowId={(t) => String(t.id)}
              emptyMessage="Nema tipova vozila."
            />
          </Card>
        </TabsContent>
      </Tabs>

      {/* Vehicle Modal */}
      <Dialog open={showVehicleModal} onOpenChange={(open) => !open && closeVehicleModal()}>
        <DialogContent className="sm:max-w-lg bg-popover border-border" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {editingVehicle ? "Uredi vozilo" : "Novo vozilo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVehicleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Oznaka *</Label>
              <Input
                className="bg-secondary/50 border-border"
                value={vehicleForm.oznaka}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, oznaka: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tip vozila</Label>
              <Select
                value={vehicleForm.tip_id?.toString() ?? "__none__"}
                onValueChange={(v) =>
                  setVehicleForm({
                    ...vehicleForm,
                    tip_id: v && v !== "__none__" ? Number(v) : null,
                  })
                }
              >
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Odaberi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Odaberi —</SelectItem>
                  {vehicleTypes.map((tip: VoziloTip) => (
                    <SelectItem key={tip.id} value={String(tip.id)}>
                      {tip.naziv}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Skladište</Label>
              <Select
                value={vehicleForm.warehouse_id?.toString() ?? "__none__"}
                onValueChange={(v) =>
                  setVehicleForm({
                    ...vehicleForm,
                    warehouse_id: v && v !== "__none__" ? Number(v) : null,
                  })
                }
                disabled={!isAdmin && !!currentUser?.warehouse_id}
              >
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Odaberi" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && (
                    <SelectItem value="__none__">— Sva skladišta —</SelectItem>
                  )}
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.code ? `${w.code} - ` : ""}
                      {w.naziv}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nosivost (kg)</Label>
                <Input
                  type="number"
                  className="bg-secondary/50 border-border"
                  value={vehicleForm.nosivost_kg ?? ""}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      nosivost_kg: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Volumen (m³)</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="bg-secondary/50 border-border"
                  value={vehicleForm.volumen_m3 ?? ""}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      volumen_m3: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Profil rutiranja (regije)</Label>
              <div className="relative" ref={regionDropdownRef}>
                <button
                  type="button"
                  onClick={() => setRegionDropdownOpen(!regionDropdownOpen)}
                  className="flex min-h-9 w-full items-center justify-between rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm ring-offset-background"
                >
                  {selectedRegionIds.length === 0 ? (
                    <span className="text-muted-foreground">
                      Odaberi regije...
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {selectedRegionIds.map((id) => {
                        const reg = regions.find((r: Regija) => r.id === id)
                        if (!reg) return null
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded bg-primary/20 px-2 py-0.5 text-xs"
                          >
                            {reg.naziv}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleRegion(id)
                              }}
                              className="hover:text-destructive"
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  {regionDropdownOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {regionDropdownOpen && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover py-1 shadow-lg">
                    {regions.filter((r: Regija) => r.aktivan).length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Nema aktivnih regija
                      </div>
                    ) : (
                      regions
                        .filter((r: Regija) => r.aktivan)
                        .map((r: Regija) => (
                          <label
                            key={r.id}
                            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={selectedRegionIds.includes(r.id)}
                              onCheckedChange={() => toggleRegion(r.id)}
                            />
                            <span>{r.naziv}</span>
                          </label>
                        ))
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Broj paleta</Label>
              <Input
                type="number"
                className="bg-secondary/50 border-border"
                value={vehicleForm.paleta ?? ""}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    paleta: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Max paleta"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="v-aktivan"
                checked={vehicleForm.aktivan}
                onCheckedChange={(checked) =>
                  setVehicleForm({ ...vehicleForm, aktivan: !!checked })
                }
              />
              <Label htmlFor="v-aktivan">Aktivno vozilo</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeVehicleModal}>
                Odustani
              </Button>
              <Button
                type="submit"
                disabled={
                  createVehicleMutation.isPending ||
                  updateVehicleMutation.isPending
                }
              >
                {(createVehicleMutation.isPending ||
                  updateVehicleMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingVehicle ? "Spremi" : "Dodaj"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Driver Modal */}
      <Dialog open={showDriverModal} onOpenChange={(open) => !open && closeDriverModal()}>
        <DialogContent className="sm:max-w-lg bg-popover border-border">
          <DialogHeader>
            <DialogTitle>
              {editingDriver ? "Uredi vozača" : "Novi vozač"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDriverSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ime *</Label>
                <Input
                  className="bg-secondary/50 border-border"
                  value={driverForm.ime}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, ime: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Prezime *</Label>
                <Input
                  className="bg-secondary/50 border-border"
                  value={driverForm.prezime}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, prezime: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                className="bg-secondary/50 border-border"
                value={driverForm.telefon}
                onChange={(e) =>
                  setDriverForm({ ...driverForm, telefon: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Skladište</Label>
              <Select
                value={driverForm.warehouse_id?.toString() ?? "__none__"}
                onValueChange={(v) =>
                  setDriverForm({
                    ...driverForm,
                    warehouse_id: v && v !== "__none__" ? Number(v) : null,
                  })
                }
                disabled={!isAdmin && !!currentUser?.warehouse_id}
              >
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Odaberi" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && (
                    <SelectItem value="__none__">— Sva skladišta —</SelectItem>
                  )}
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.code ? `${w.code} - ` : ""}
                      {w.naziv}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vozilo</Label>
              <Select
                value={driverForm.vozilo_id?.toString() ?? "__none__"}
                onValueChange={(v) =>
                  setDriverForm({
                    ...driverForm,
                    vozilo_id: v && v !== "__none__" ? Number(v) : null,
                  })
                }
              >
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Odaberi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Bez vozila —</SelectItem>
                  {vehicles
                    .filter((v: Vozilo) => v.aktivan)
                    .map((vehicle: Vozilo) => (
                      <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                        {vehicle.oznaka}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="d-aktivan"
                checked={driverForm.aktivan}
                onCheckedChange={(checked) =>
                  setDriverForm({ ...driverForm, aktivan: !!checked })
                }
              />
              <Label htmlFor="d-aktivan">Aktivan vozač</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDriverModal}>
                Odustani
              </Button>
              <Button
                type="submit"
                disabled={
                  createDriverMutation.isPending ||
                  updateDriverMutation.isPending
                }
              >
                {(createDriverMutation.isPending ||
                  updateDriverMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingDriver ? "Spremi" : "Dodaj"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vehicle Type Modal */}
      <Dialog open={showTypeModal} onOpenChange={(open) => !open && closeTypeModal()}>
        <DialogContent className="sm:max-w-lg bg-popover border-border">
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Uredi tip vozila" : "Novi tip vozila"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTypeSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Naziv *</Label>
              <Input
                className="bg-secondary/50 border-border"
                value={typeForm.naziv}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, naziv: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Textarea
                className="bg-secondary/50 border-border min-h-[80px]"
                value={typeForm.opis}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, opis: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="t-aktivan"
                checked={typeForm.aktivan}
                onCheckedChange={(checked) =>
                  setTypeForm({ ...typeForm, aktivan: !!checked })
                }
              />
              <Label htmlFor="t-aktivan">Aktivan</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeTypeModal}>
                Odustani
              </Button>
              <Button
                type="submit"
                disabled={
                  createTypeMutation.isPending ||
                  updateTypeMutation.isPending
                }
              >
                {(createTypeMutation.isPending ||
                  updateTypeMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingType ? "Spremi" : "Dodaj"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
    </PermissionGuard>
  )
}
