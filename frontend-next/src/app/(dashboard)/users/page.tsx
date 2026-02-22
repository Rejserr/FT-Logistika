"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/AuthContext"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent } from "@/components/ui/card"
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
import { DataTable, type ColumnDef } from "@/components/common/data-table"
import { toast } from "@/lib/toast"
import { UserPlus, Pencil, Lock, Unlock, Key, UserX } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

interface UserItem {
  id: number
  username: string
  ime: string | null
  prezime: string | null
  email: string | null
  full_name: string
  aktivan: boolean
  locked: boolean
  role_id: number | null
  role_name: string | null
  warehouse_id: number | null
  warehouse_name?: string | null
  vozac_id: number | null
  force_password_change: boolean
  failed_login_attempts: number
  last_login: string | null
  created_at: string | null
}

interface RoleItem {
  id: number
  name: string
  description: string | null
  is_system: boolean
  permissions: string[]
}

interface WarehouseItem {
  id: number
  naziv: string
  code: string | null
  tip: string
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

export default function UsersPage() {
  const { hasPermission, user: currentUser } = useAuth()
  const isAdmin = currentUser?.role === "Admin"
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [form, setForm] = useState({
    username: "",
    password: "",
    ime: "",
    prezime: "",
    email: "",
    role_id: 0,
    warehouse_id: 0,
    force_password_change: true,
  })
  const [resetPwModal, setResetPwModal] = useState<UserItem | null>(null)
  const [newPassword, setNewPassword] = useState("")

  const { data: users = [], isLoading } = useQuery<UserItem[]>({
    queryKey: ["users"],
    queryFn: () => apiFetch("/users"),
  })

  const { data: roles = [] } = useQuery<RoleItem[]>({
    queryKey: ["roles"],
    queryFn: () => apiFetch("/roles"),
  })

  const { data: warehouses = [] } = useQuery<WarehouseItem[]>({
    queryKey: ["warehouses"],
    queryFn: () => apiFetch("/v1/warehouses"),
  })

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch("/users", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      setShowModal(false)
      toast.success("Korisnik kreiran")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const updateMut = useMutation({
    mutationFn: ({
      id,
      body,
    }: { id: number; body: Record<string, unknown> }) =>
      apiFetch(`/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      setShowModal(false)
      setEditUser(null)
      toast.success("Korisnik ažuriran")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const lockMut = useMutation({
    mutationFn: ({
      id,
      action,
    }: { id: number; action: "lock" | "unlock" }) =>
      apiFetch(`/users/${id}/${action}`, { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      toast.success("Status ažuriran")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const deactivateMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      toast.success("Korisnik deaktiviran")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const resetPwMut = useMutation({
    mutationFn: ({ id, pw }: { id: number; pw: string }) =>
      apiFetch(`/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ new_password: pw }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      setResetPwModal(null)
      setNewPassword("")
      toast.success("Lozinka resetirana")
    },
    onError: (err) => toast.error("Greška", (err as Error).message),
  })

  const getWarehouseName = (whId: number | null) => {
    if (!whId) return "—"
    const wh = warehouses.find((w) => w.id === whId)
    return wh ? `${wh.code || ""} ${wh.naziv}`.trim() : `ID: ${whId}`
  }

  const openCreate = () => {
    setEditUser(null)
    const defaultWhId =
      !isAdmin && currentUser?.warehouse_id ? currentUser.warehouse_id : 0
    setForm({
      username: "",
      password: "",
      ime: "",
      prezime: "",
      email: "",
      role_id: 0,
      warehouse_id: defaultWhId,
      force_password_change: true,
    })
    setShowModal(true)
  }

  const openEdit = (u: UserItem) => {
    setEditUser(u)
    setForm({
      username: u.username,
      password: "",
      ime: u.ime || "",
      prezime: u.prezime || "",
      email: u.email || "",
      role_id: u.role_id || 0,
      warehouse_id: u.warehouse_id || 0,
      force_password_change: u.force_password_change,
    })
    setShowModal(true)
  }

  const handleSubmit = () => {
    if (editUser) {
      updateMut.mutate({
        id: editUser.id,
        body: {
          ime: form.ime || null,
          prezime: form.prezime || null,
          email: form.email || null,
          role_id: form.role_id || null,
          warehouse_id: form.warehouse_id || null,
          aktivan: editUser.aktivan,
        },
      })
    } else {
      if (form.password.length < 5) {
        toast.warning("Lozinka mora imati najmanje 5 znakova")
        return
      }
      createMut.mutate({
        username: form.username,
        password: form.password,
        ime: form.ime || null,
        prezime: form.prezime || null,
        email: form.email || null,
        role_id: form.role_id || null,
        warehouse_id: form.warehouse_id || null,
        force_password_change: form.force_password_change,
      })
    }
  }

  const canManage = hasPermission("users.create")

  const columns: ColumnDef<UserItem>[] = [
    {
      key: "username",
      header: "Korisničko ime",
      getValue: (r) => r.username,
    },
    {
      key: "full_name",
      header: "Ime i prezime",
      getValue: (r) => r.full_name,
    },
    {
      key: "email",
      header: "Email",
      getValue: (r) => r.email ?? "",
      render: (r) => r.email || "—",
    },
    {
      key: "role_name",
      header: "Rola",
      getValue: (r) => r.role_name ?? "",
      render: (r) => (
        <Badge
          variant="secondary"
          className={`font-normal ${
            (r.role_name || "none").toLowerCase() === "admin"
              ? "bg-primary/20"
              : ""
          }`}
        >
          {r.role_name || "—"}
        </Badge>
      ),
    },
    {
      key: "warehouse_name",
      header: "Skladište",
      getValue: (r) => getWarehouseName(r.warehouse_id),
      render: (r) => getWarehouseName(r.warehouse_id),
    },
    {
      key: "status",
      header: "Status",
      getValue: (r) => {
        if (!r.aktivan) return "Neaktivan"
        if (r.locked) return "Zaključan"
        return "Aktivan"
      },
      render: (r) => (
        <>
          {!r.aktivan && (
            <Badge variant="secondary" className="bg-muted text-muted-foreground">
              Neaktivan
            </Badge>
          )}
          {r.locked && (
            <Badge variant="secondary" className="bg-amber-500/15">
              Zaključan
            </Badge>
          )}
          {r.aktivan && !r.locked && (
            <Badge variant="secondary" className="bg-green-500/15">
              Aktivan
            </Badge>
          )}
        </>
      ),
    },
    {
      key: "last_login",
      header: "Zadnji login",
      getValue: (r) =>
        r.last_login
          ? new Date(r.last_login).toLocaleString("hr-HR")
          : "",
      render: (r) =>
        r.last_login
          ? new Date(r.last_login).toLocaleString("hr-HR")
          : "—",
    },
  ]

  return (
    <PermissionGuard permission="users.view">
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Korisnici"
        subtitle="Upravljanje korisnicima sustava"
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <UserPlus className="mr-2 h-4 w-4" />
              Novi korisnik
            </Button>
          ) : undefined
        }
      />

      <Card className="glass">
        <CardContent className="pt-6">
          <DataTable
            columns={[
              ...columns,
              ...(canManage
                ? [
                    {
                      key: "actions",
                      header: "Akcije",
                      sortable: false as const,
                      filterable: false as const,
                      render: (u: UserItem) => (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(u)}
                            title="Uredi"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              lockMut.mutate({
                                id: u.id,
                                action: u.locked ? "unlock" : "lock",
                              })
                            }
                            title={u.locked ? "Otključaj" : "Zaključaj"}
                          >
                            {u.locked ? (
                              <Unlock className="h-3.5 w-3.5" />
                            ) : (
                              <Lock className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setResetPwModal(u)}
                            title="Reset lozinke"
                          >
                            <Key className="h-3.5 w-3.5" />
                          </Button>
                          {u.aktivan && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deactivateMut.mutate(u.id)}
                              title="Deaktiviraj"
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ),
                    } as ColumnDef<UserItem>,
                  ]
                : []),
            ]}
            data={users}
            loading={isLoading}
            searchPlaceholder="Pretraži korisnike..."
            emptyMessage="Nema rezultata"
            getRowId={(r) => String(r.id)}
            actions={
              canManage ? (
                <Button onClick={openCreate}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Novi korisnik
                </Button>
              ) : undefined
            }
          />
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editUser ? "Uredi korisnika" : "Novi korisnik"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!editUser && (
              <>
                <div className="space-y-2">
                  <Label>Korisničko ime *</Label>
                  <Input
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    placeholder="npr. ivic.ivica"
                    className="bg-secondary/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lozinka * (min. 5 znakova)</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="Min. 5 znakova"
                    className="bg-secondary/50 border-border"
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ime</Label>
                <Input
                  value={form.ime}
                  onChange={(e) => setForm({ ...form, ime: e.target.value })}
                  placeholder="Ime"
                  className="bg-secondary/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Prezime</Label>
                <Input
                  value={form.prezime}
                  onChange={(e) =>
                    setForm({ ...form, prezime: e.target.value })
                  }
                  placeholder="Prezime"
                  className="bg-secondary/50 border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@primjer.hr"
                className="bg-secondary/50 border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rola *</Label>
                <Select
                  value={form.role_id ? String(form.role_id) : "0"}
                  onValueChange={(v) =>
                    setForm({ ...form, role_id: Number(v) })
                  }
                >
                  <SelectTrigger className="bg-secondary/50 border-border">
                    <SelectValue placeholder="— Odaberi rolu —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">— Odaberi rolu —</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name}
                        {r.description ? ` (${r.description})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {roles.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    Nema definiranih rola. Kreirajte ih u "Role" sekciji.
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <Label>Skladište</Label>
                <Select
                  value={form.warehouse_id ? String(form.warehouse_id) : "0"}
                  onValueChange={(v) =>
                    setForm({ ...form, warehouse_id: Number(v) })
                  }
                  disabled={!isAdmin && !!currentUser?.warehouse_id}
                >
                  <SelectTrigger className="bg-secondary/50 border-border">
                    <SelectValue placeholder="— Skladište —" />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin && (
                      <SelectItem value="0">— Sva skladišta —</SelectItem>
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
            </div>
            {!editUser && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="force_password_change"
                  checked={form.force_password_change}
                  onCheckedChange={(c) =>
                    setForm({ ...form, force_password_change: !!c })
                  }
                />
                <Label htmlFor="force_password_change">
                  Zahtijevaj promjenu lozinke pri prvoj prijavi
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Odustani
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMut.isPending ||
                updateMut.isPending ||
                (!editUser && (!form.username || form.password.length < 5))
              }
            >
              {editUser ? "Spremi" : "Kreiraj"}
            </Button>
          </DialogFooter>
          {(createMut.error || updateMut.error) && (
            <p className="text-sm text-destructive">
              {(createMut.error || updateMut.error)?.message}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetPwModal} onOpenChange={() => setResetPwModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reset lozinke: {resetPwModal?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nova lozinka (min. 5 znakova)</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-secondary/50 border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwModal(null)}>
              Odustani
            </Button>
            <Button
              onClick={() =>
                resetPwModal &&
                resetPwMut.mutate({ id: resetPwModal.id, pw: newPassword })
              }
              disabled={newPassword.length < 5 || resetPwMut.isPending}
            >
              Resetiraj
            </Button>
          </DialogFooter>
          {resetPwMut.error && (
            <p className="text-sm text-destructive">
              {(resetPwMut.error as Error).message}
            </p>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
    </PermissionGuard>
  )
}
