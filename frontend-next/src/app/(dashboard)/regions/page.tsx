"use client"

import { useState, useRef, useMemo, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { Card } from "@/components/ui/card"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable, type ColumnDef } from "@/components/common/data-table"
import { Badge } from "@/components/ui/badge"
import { regionsApi } from "@/services/api"
import type { Regija, RegijaTree, PostanskiBroj } from "@/types"
import { toast } from "@/lib/toast"
import {
  MapPin,
  Mail,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  FolderPlus,
} from "lucide-react"

type TabType = "regions" | "postal"

interface RegionFormData {
  naziv: string
  sifra: string
  parent_id: number | null
  aktivan: boolean
}

interface PostalFormData {
  postanski_broj: string
  naziv_mjesta: string
  regija_id: number | null
}

function flattenTree(
  nodes: RegijaTree[],
  depth = 0
): { region: RegijaTree; depth: number }[] {
  const result: { region: RegijaTree; depth: number }[] = []
  for (const node of nodes) {
    result.push({ region: node, depth })
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

function RegionTreeNode({
  node,
  expanded,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  depth,
}: {
  node: RegijaTree
  expanded: Set<number>
  onToggle: (id: number) => void
  onEdit: (region: RegijaTree) => void
  onAddChild: (parentId: number) => void
  onDelete: (id: number) => void
  depth: number
}) {
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0

  return (
    <>
      <div
        className="flex items-center gap-2 py-2 border-b border-border/50"
        style={{ paddingLeft: 16 + depth * 24 }}
      >
        <button
          type="button"
          className={`p-0.5 rounded hover:bg-muted/50 ${!hasChildren ? "invisible" : ""}`}
          onClick={() => onToggle(node.id)}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : null}
        </button>
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <span className="font-medium truncate">{node.naziv}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {node.postal_count} PB
          </span>
          <Badge
            variant="outline"
            className={
              node.aktivan
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                : "bg-muted text-muted-foreground border-border"
            }
          >
            {node.aktivan ? "Aktivna" : "Neaktivna"}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAddChild(node.id)}
          >
            <FolderPlus className="h-3.5 w-3.5 mr-1" />
            Podregija
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(node)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Uredi
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (node.children.length > 0) {
                toast.warning(
                  "Nije moguće",
                  "Regija ima podregije. Prvo ih obriši ili prebaci."
                )
                return
              }
              if (node.postal_count > 0) {
                toast.warning(
                  "Nije moguće",
                  "Regija ima poštanske brojeve. Prvo ih prebaci u drugu regiju."
                )
                return
              }
              if (confirm("Obrisati regiju?")) onDelete(node.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Obriši
          </Button>
        </div>
      </div>
      {isExpanded &&
        hasChildren &&
        node.children.map((child) => (
          <RegionTreeNode
            key={child.id}
            node={child}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={onEdit}
            onAddChild={onAddChild}
            onDelete={onDelete}
            depth={depth + 1}
          />
        ))}
    </>
  )
}

export default function RegionsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>("regions")
  const [showRegionModal, setShowRegionModal] = useState(false)
  const [showPostalModal, setShowPostalModal] = useState(false)
  const [editingRegion, setEditingRegion] = useState<Regija | null>(null)
  const [editingPostal, setEditingPostal] = useState<PostanskiBroj | null>(null)
  const [postalSearch, setPostalSearch] = useState("")
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
  const [checkedPostalIds, setCheckedPostalIds] = useState<Set<string>>(
    new Set()
  )
  const [reassignRegijaId, setReassignRegijaId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [regionForm, setRegionForm] = useState<RegionFormData>({
    naziv: "",
    sifra: "",
    parent_id: null,
    aktivan: true,
  })

  const [postalForm, setPostalForm] = useState<PostalFormData>({
    postanski_broj: "",
    naziv_mjesta: "",
    regija_id: null,
  })

  const { data: regions = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: regionsApi.list,
  })

  const { data: regionsTree = [], isLoading: treeLoading } = useQuery({
    queryKey: ["regions-tree"],
    queryFn: regionsApi.tree,
  })

  const { data: postalCodes = [], isLoading: postalLoading } = useQuery({
    queryKey: ["postal-codes"],
    queryFn: regionsApi.listPostalCodes,
  })

  const flatRegions = useMemo(() => flattenTree(regionsTree), [regionsTree])

  const createRegionMutation = useMutation({
    mutationFn: regionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] })
      queryClient.invalidateQueries({ queryKey: ["regions-tree"] })
      closeRegionModal()
    },
  })

  const updateRegionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Regija> }) =>
      regionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] })
      queryClient.invalidateQueries({ queryKey: ["regions-tree"] })
      closeRegionModal()
    },
  })

  const deleteRegionMutation = useMutation({
    mutationFn: regionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regions"] })
      queryClient.invalidateQueries({ queryKey: ["regions-tree"] })
    },
    onError: (err: Error) => {
      toast.error("Brisanje nije uspjelo", err.message)
    },
  })

  const createPostalMutation = useMutation({
    mutationFn: regionsApi.createPostalCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postal-codes"] })
      queryClient.invalidateQueries({ queryKey: ["regions-tree"] })
      closePostalModal()
    },
  })

  const updatePostalMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: Partial<PostanskiBroj>
    }) => regionsApi.updatePostalCode(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postal-codes"] })
      queryClient.invalidateQueries({ queryKey: ["regions-tree"] })
      closePostalModal()
    },
  })

  const deletePostalMutation = useMutation({
    mutationFn: regionsApi.deletePostalCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["postal-codes"] })
      queryClient.invalidateQueries({ queryKey: ["regions-tree"] })
    },
  })

  const bulkReassignMutation = useMutation({
    mutationFn: () =>
      regionsApi.bulkReassign(
        Array.from(checkedPostalIds).map(Number),
        reassignRegijaId!
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["postal-codes"] })
      queryClient.invalidateQueries({ queryKey: ["regions-tree"] })
      queryClient.invalidateQueries({ queryKey: ["orders"] })
      toast.success(
        "Prebacivanje završeno",
        `Ažurirano ${data.updated_postal_codes} PB i ${data.updated_orders} naloga.`
      )
      setCheckedPostalIds(new Set())
      setReassignRegijaId(null)
    },
    onError: (err: Error) => {
      toast.error("Prebacivanje nije uspjelo", err.message)
    },
  })

  const importRegionsMutation = useMutation({
    mutationFn: (file: File) => regionsApi.importRegions(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["regions"] })
      queryClient.invalidateQueries({ queryKey: ["regions-tree"] })
      queryClient.invalidateQueries({ queryKey: ["postal-codes"] })
      toast.success(
        "Import završen",
        `Regije: ${data.regije_created} nova, ${data.regije_existing} postojećih. Poštanski brojevi: ${data.postanski_created} novih, ${data.postanski_updated} ažurirano. (${data.rows_processed} redaka)`
      )
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    onError: (err: Error) => {
      toast.error("Import nije uspio", err.message)
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
  })

  const toggleExpanded = useCallback((id: number) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    const allIds = new Set<number>()
    const collect = (nodes: RegijaTree[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) {
          allIds.add(n.id)
          collect(n.children)
        }
      }
    }
    collect(regionsTree)
    setExpandedNodes(allIds)
  }, [regionsTree])

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set())
  }, [])

  const openRegionModal = (region?: Regija | RegijaTree, parentId?: number) => {
    if (region && !parentId) {
      setEditingRegion(region as Regija)
      setRegionForm({
        naziv: region.naziv,
        sifra: region.sifra || "",
        parent_id: region.parent_id ?? null,
        aktivan: region.aktivan ?? true,
      })
    } else {
      setEditingRegion(null)
      setRegionForm({
        naziv: "",
        sifra: "",
        parent_id: parentId ?? null,
        aktivan: true,
      })
    }
    setShowRegionModal(true)
  }

  const closeRegionModal = () => {
    setShowRegionModal(false)
    setEditingRegion(null)
  }

  const openPostalModal = (postal?: PostanskiBroj) => {
    if (postal) {
      setEditingPostal(postal)
      setPostalForm({
        postanski_broj: postal.postanski_broj,
        naziv_mjesta: postal.naziv_mjesta || "",
        regija_id: postal.regija_id,
      })
    } else {
      setEditingPostal(null)
      setPostalForm({
        postanski_broj: "",
        naziv_mjesta: "",
        regija_id: null,
      })
    }
    setShowPostalModal(true)
  }

  const closePostalModal = () => {
    setShowPostalModal(false)
    setEditingPostal(null)
  }

  const handleRegionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      naziv: regionForm.naziv,
      parent_id: regionForm.parent_id,
      aktivan: regionForm.aktivan,
    }
    if (editingRegion) {
      updateRegionMutation.mutate({ id: editingRegion.id, data: payload })
    } else {
      createRegionMutation.mutate(payload)
    }
  }

  const handlePostalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      postanski_broj: postalForm.postanski_broj,
      naziv_mjesta: postalForm.naziv_mjesta || null,
      regija_id: postalForm.regija_id,
    }
    if (editingPostal) {
      updatePostalMutation.mutate({ id: editingPostal.id, data: payload })
    } else {
      createPostalMutation.mutate(payload)
    }
  }

  const getRegionName = (regionId: number | null) => {
    if (!regionId) return "—"
    const region = regions.find((r: Regija) => r.id === regionId)
    return region?.naziv || "—"
  }

  const filteredPostalCodes = postalCodes.filter((pc: PostanskiBroj) => {
    if (!postalSearch) return true
    const search = postalSearch.toLowerCase()
    return (
      pc.postanski_broj.toLowerCase().includes(search) ||
      (pc.naziv_mjesta?.toLowerCase().includes(search) ?? false)
    )
  })

  const togglePostalCheck = (id: string) => {
    setCheckedPostalIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.toLowerCase().slice(-4)
    if (ext !== ".csv" && file.name.toLowerCase().slice(-5) !== ".xlsx") {
      toast.warning("Neispravan format", "Odaberite .csv ili .xlsx datoteku.")
      return
    }
    importRegionsMutation.mutate(file)
  }

  const postalColumns: ColumnDef<PostanskiBroj>[] = [
    { key: "postanski_broj", header: "Poštanski broj" },
    {
      key: "naziv_mjesta",
      header: "Mjesto",
      getValue: (p) => p.naziv_mjesta || "",
      render: (p) => p.naziv_mjesta || "—",
    },
    {
      key: "regija",
      header: "Regija",
      getValue: (p) => getRegionName(p.regija_id),
      render: (p) => getRegionName(p.regija_id),
    },
    {
      key: "akcije",
      header: "Akcije",
      sortable: false,
      filterable: false,
      render: (postal) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              openPostalModal(postal)
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
              if (confirm("Obrisati poštanski broj?"))
                deletePostalMutation.mutate(postal.id)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <PermissionGuard permission="regions.view">
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Regije i poštanski brojevi"
        subtitle="Upravljanje geografskim podacima"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleImportFile}
              className="hidden"
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importRegionsMutation.isPending}
            >
              {importRegionsMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Učitaj regije (CSV/XLSX)
            </Button>
            {activeTab === "regions" ? (
              <Button onClick={() => openRegionModal()}>
                <MapPin className="mr-2 h-4 w-4" />
                Nova regija
              </Button>
            ) : (
              <Button onClick={() => openPostalModal()}>
                <Mail className="mr-2 h-4 w-4" />
                Novi poštanski broj
              </Button>
            )}
          </div>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabType)}
        className="w-full"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-secondary/50 border border-border">
          <TabsTrigger value="regions" className="gap-2">
            <MapPin className="h-4 w-4" />
            Regije ({regions.length})
          </TabsTrigger>
          <TabsTrigger value="postal" className="gap-2">
            <Mail className="h-4 w-4" />
            Poštanski brojevi ({postalCodes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="regions" className="mt-4">
          <Card className="glass p-4">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-muted-foreground">
                {regions.length} regija
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={expandAll}
              >
                Proširi sve
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={collapseAll}
              >
                Sažmi sve
              </Button>
            </div>
            {treeLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Učitavanje...
              </div>
            ) : regionsTree.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Nema regija.
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {regionsTree.map((node) => (
                  <RegionTreeNode
                    key={node.id}
                    node={node}
                    expanded={expandedNodes}
                    onToggle={toggleExpanded}
                    onEdit={(r) => openRegionModal(r)}
                    onAddChild={(parentId) =>
                      openRegionModal(undefined, parentId)
                    }
                    onDelete={(id) => deleteRegionMutation.mutate(id)}
                    depth={0}
                  />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="postal" className="mt-4">
          <Card className="glass p-4 space-y-4">
            {checkedPostalIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border">
                <span className="text-sm">
                  Odabrano: <strong>{checkedPostalIds.size}</strong> poštanskih
                  brojeva
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">
                    Prebaci u regiju:
                  </Label>
                  <Select
                    value={reassignRegijaId?.toString() ?? "__none__"}
                    onValueChange={(v) =>
                      setReassignRegijaId(
                        v && v !== "__none__" ? Number(v) : null
                      )
                    }
                  >
                    <SelectTrigger className="w-[220px] bg-secondary/50 border-border">
                      <SelectValue placeholder="Odaberi regiju" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        — Odaberi regiju —
                      </SelectItem>
                      {flatRegions.map(({ region, depth }) => (
                        <SelectItem key={region.id} value={String(region.id)}>
                          {"  ".repeat(depth)}
                          {depth > 0 ? "└ " : ""}
                          {region.naziv}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!reassignRegijaId) {
                        toast.warning(
                          "Odaberi regiju",
                          "Moraš odabrati ciljnu regiju."
                        )
                        return
                      }
                      if (
                        confirm(
                          `Prebaciti ${checkedPostalIds.size} poštanskih brojeva?`
                        )
                      ) {
                        bulkReassignMutation.mutate()
                      }
                    }}
                    disabled={bulkReassignMutation.isPending}
                  >
                    {bulkReassignMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Prebaci
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCheckedPostalIds(new Set())
                    setReassignRegijaId(null)
                  }}
                >
                  Poništi odabir
                </Button>
              </div>
            )}

            <div className="relative max-w-sm mb-4">
              <Input
                placeholder="Pretraži po broju ili mjestu..."
                value={postalSearch}
                onChange={(e) => setPostalSearch(e.target.value)}
                className="pl-9 bg-secondary/50 border-border"
              />
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <DataTable<PostanskiBroj>
              storageKey="ft-postal-codes"
              columns={postalColumns}
              data={filteredPostalCodes}
              loading={postalLoading}
              pageSize={100}
              searchPlaceholder="Pretraži u tablici..."
              showColumnPicker
              getRowId={(p) => String(p.id)}
              selectedRows={checkedPostalIds}
              onSelectRows={setCheckedPostalIds}
              emptyMessage={
                postalSearch ? "Nema rezultata." : "Nema poštanskih brojeva."
              }
            />
          </Card>
        </TabsContent>
      </Tabs>

      {/* Region Modal */}
      <Dialog
        open={showRegionModal}
        onOpenChange={(open) => !open && closeRegionModal()}
      >
        <DialogContent className="sm:max-w-md bg-popover border-border">
          <DialogHeader>
            <DialogTitle>
              {editingRegion ? "Uredi regiju" : "Nova regija"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegionSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Naziv *</Label>
              <Input
                className="bg-secondary/50 border-border"
                value={regionForm.naziv}
                onChange={(e) =>
                  setRegionForm({ ...regionForm, naziv: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nadređena regija</Label>
              <Select
                value={regionForm.parent_id?.toString() ?? "__none__"}
                onValueChange={(v) =>
                  setRegionForm({
                    ...regionForm,
                    parent_id:
                      v && v !== "__none__" ? Number(v) : null,
                  })
                }
              >
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Odaberi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    — Nema (root regija) —
                  </SelectItem>
                  {flatRegions
                    .filter(({ region }) =>
                      editingRegion ? region.id !== editingRegion.id : true
                    )
                    .map(({ region, depth }) => (
                      <SelectItem key={region.id} value={String(region.id)}>
                        {"  ".repeat(depth)}
                        {depth > 0 ? "└ " : ""}
                        {region.naziv}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="r-aktivan"
                checked={regionForm.aktivan}
                onCheckedChange={(checked) =>
                  setRegionForm({ ...regionForm, aktivan: !!checked })
                }
              />
              <Label htmlFor="r-aktivan">Aktivna regija</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeRegionModal}>
                Odustani
              </Button>
              <Button
                type="submit"
                disabled={
                  createRegionMutation.isPending ||
                  updateRegionMutation.isPending
                }
              >
                {(createRegionMutation.isPending ||
                  updateRegionMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingRegion ? "Spremi" : "Dodaj"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Postal Modal */}
      <Dialog
        open={showPostalModal}
        onOpenChange={(open) => !open && closePostalModal()}
      >
        <DialogContent className="sm:max-w-md bg-popover border-border">
          <DialogHeader>
            <DialogTitle>
              {editingPostal
                ? "Uredi poštanski broj"
                : "Novi poštanski broj"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePostalSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Poštanski broj *</Label>
                <Input
                  className="bg-secondary/50 border-border"
                  value={postalForm.postanski_broj}
                  onChange={(e) =>
                    setPostalForm({
                      ...postalForm,
                      postanski_broj: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Naziv mjesta</Label>
                <Input
                  className="bg-secondary/50 border-border"
                  value={postalForm.naziv_mjesta}
                  onChange={(e) =>
                    setPostalForm({
                      ...postalForm,
                      naziv_mjesta: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Regija</Label>
              <Select
                value={postalForm.regija_id?.toString() ?? "__none__"}
                onValueChange={(v) =>
                  setPostalForm({
                    ...postalForm,
                    regija_id:
                      v && v !== "__none__" ? Number(v) : null,
                  })
                }
              >
                <SelectTrigger className="bg-secondary/50 border-border">
                  <SelectValue placeholder="Odaberi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Bez regije —</SelectItem>
                  {flatRegions.map(({ region, depth }) => (
                    <SelectItem key={region.id} value={String(region.id)}>
                      {"  ".repeat(depth)}
                      {depth > 0 ? "└ " : ""}
                      {region.naziv}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closePostalModal}>
                Odustani
              </Button>
              <Button
                type="submit"
                disabled={
                  createPostalMutation.isPending ||
                  updatePostalMutation.isPending
                }
              >
                {(createPostalMutation.isPending ||
                  updatePostalMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingPostal ? "Spremi" : "Dodaj"}
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
