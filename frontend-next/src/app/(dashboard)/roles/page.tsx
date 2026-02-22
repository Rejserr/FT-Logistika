"use client"

import { useState, useMemo } from "react"
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
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast"
import { Shield, Pencil, Key, Trash2 } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

interface RoleItem {
  id: number
  name: string
  description: string | null
  is_system: boolean
  permissions: string[]
}

interface PermissionItem {
  id: number
  name: string
  description: string | null
  module: string
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

const MODULE_LABELS: Record<string, string> = {
  orders: "Nalozi",
  routes: "Rute",
  vehicles: "Vozila",
  warehouses: "Skladišta",
  users: "Korisnici",
  roles: "Role",
  settings: "Postavke",
  sync: "Sinkronizacija",
  reports: "Izvještaji",
  audit: "Audit",
  geocoding: "Geokodiranje",
}

export default function RolesPage() {
  const { hasPermission } = useAuth()
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editRole, setEditRole] = useState<RoleItem | null>(null)
  const [form, setForm] = useState({ name: "", description: "" })
  const [permModal, setPermModal] = useState<RoleItem | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set())

  const { data: roles = [], isLoading } = useQuery<RoleItem[]>({
    queryKey: ["roles"],
    queryFn: () => apiFetch("/roles"),
  })

  const { data: allPermissions = [] } = useQuery<PermissionItem[]>({
    queryKey: ["permissions"],
    queryFn: () => apiFetch("/roles/permissions/all"),
  })

  const permsByModule = useMemo(() => {
    const map: Record<string, PermissionItem[]> = {}
    for (const p of allPermissions) {
      if (!map[p.module]) map[p.module] = []
      map[p.module].push(p)
    }
    return map
  }, [allPermissions])

  const createMut = useMutation({
    mutationFn: (body: { name: string; description: string | null }) =>
      apiFetch("/roles", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      setShowModal(false)
      toast.success("Rola kreirana")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const updateMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number
      body: { name?: string; description?: string | null }
    }) =>
      apiFetch(`/roles/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      setShowModal(false)
      setEditRole(null)
      toast.success("Rola ažurirana")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      toast.success("Rola obrisana")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const setPermsMut = useMutation({
    mutationFn: ({ id, perms }: { id: number; perms: string[] }) =>
      apiFetch(`/roles/${id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permission_names: perms }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] })
      setPermModal(null)
      toast.success("Dozvole spremljene")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const openCreate = () => {
    setEditRole(null)
    setForm({ name: "", description: "" })
    setShowModal(true)
  }

  const openEdit = (r: RoleItem) => {
    setEditRole(r)
    setForm({ name: r.name, description: r.description || "" })
    setShowModal(true)
  }

  const openPermissions = (r: RoleItem) => {
    setPermModal(r)
    setSelectedPerms(new Set(r.permissions))
  }

  const handleSubmit = () => {
    if (editRole) {
      updateMut.mutate({
        id: editRole.id,
        body: { name: form.name, description: form.description || null },
      })
    } else {
      createMut.mutate({
        name: form.name,
        description: form.description || null,
      })
    }
  }

  const handleDelete = (r: RoleItem) => {
    if (r.is_system) return
    if (confirm(`Jeste li sigurni da želite obrisati rolu "${r.name}"?`)) {
      deleteMut.mutate(r.id)
    }
  }

  const togglePerm = (pname: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      if (next.has(pname)) next.delete(pname)
      else next.add(pname)
      return next
    })
  }

  const toggleModule = (module: string) => {
    const modulePerms = permsByModule[module] || []
    const allSelected = modulePerms.every((p) => selectedPerms.has(p.name))
    setSelectedPerms((prev) => {
      const next = new Set(prev)
      for (const p of modulePerms) {
        if (allSelected) next.delete(p.name)
        else next.add(p.name)
      }
      return next
    })
  }

  const savePermissions = () => {
    if (!permModal) return
    setPermsMut.mutate({ id: permModal.id, perms: Array.from(selectedPerms) })
  }

  const canManage =
    hasPermission("roles.create") || hasPermission("users.manage_roles")

  return (
    <PermissionGuard permission="roles.view">
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Role i dozvole"
        subtitle="Upravljanje rolama i dozvolama"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Shield className="mr-2 h-4 w-4" />
              Nova rola
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
          roles.map((r) => (
            <Card key={r.id} className="glass">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {r.name}
                    {r.is_system && (
                      <Badge variant="secondary" className="text-xs">
                        Sistemska
                      </Badge>
                    )}
                  </CardTitle>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(r)}
                        title="Uredi"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openPermissions(r)}
                        title="Dozvole"
                      >
                        <Key className="h-3.5 w-3.5" />
                      </Button>
                      {!r.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(r)}
                          title="Obriši"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {r.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {r.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {r.permissions.length} dozvola
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {[...new Set(r.permissions.map((p) => p.split(".")[0]))].map(
                      (mod) => (
                        <Badge
                          key={mod}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {MODULE_LABELS[mod] || mod}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editRole ? "Uredi rolu" : "Nova rola"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Naziv role *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="npr. Skladištar"
                disabled={editRole?.is_system}
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Kratki opis role..."
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
              disabled={
                !form.name || createMut.isPending || updateMut.isPending
              }
            >
              {editRole ? "Spremi" : "Kreiraj"}
            </Button>
          </DialogFooter>
          {(createMut.error || updateMut.error) && (
            <p className="text-sm text-destructive">
              {(createMut.error || updateMut.error)?.message}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!permModal} onOpenChange={() => setPermModal(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Dozvole: {permModal?.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Označite dozvole koje ova rola treba imati.
            </p>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-4">
            <div className="space-y-4 py-4">
              {Object.entries(permsByModule).map(([module, perms]) => {
                const allChecked = perms.every((p) =>
                  selectedPerms.has(p.name)
                )
                const someChecked = perms.some((p) =>
                  selectedPerms.has(p.name)
                )
                return (
                  <div key={module} className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <Checkbox
                        checked={allChecked}
                        ref={(el) => {
                          if (el) (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someChecked && !allChecked
                        }}
                        onCheckedChange={() => toggleModule(module)}
                      />
                      <span>{MODULE_LABELS[module] || module}</span>
                    </label>
                    <div className="pl-6 space-y-1">
                      {perms.map((p) => (
                        <label
                          key={p.name}
                          className="flex items-start gap-2 cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={selectedPerms.has(p.name)}
                            onCheckedChange={() => togglePerm(p.name)}
                          />
                          <div>
                            <span className="font-mono text-xs">
                              {p.name}
                            </span>
                            {p.description && (
                              <span className="block text-muted-foreground text-xs">
                                {p.description}
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <span className="text-sm text-muted-foreground mr-auto">
              {selectedPerms.size} od {allPermissions.length} odabrano
            </span>
            <Button variant="outline" onClick={() => setPermModal(null)}>
              Odustani
            </Button>
            <Button
              onClick={savePermissions}
              disabled={setPermsMut.isPending}
            >
              Spremi dozvole
            </Button>
          </DialogFooter>
          {setPermsMut.error && (
            <p className="text-sm text-destructive">
              {(setPermsMut.error as Error).message}
            </p>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
    </PermissionGuard>
  )
}
