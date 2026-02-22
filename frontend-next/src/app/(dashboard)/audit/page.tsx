"use client"

import { useState, useMemo, Fragment } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, ChevronDown, ChevronRight } from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"

interface AuditEntry {
  id: number
  user_id: number | null
  username: string | null
  action: string
  entity: string | null
  entity_id: string | null
  old_values: string | null
  new_values: string | null
  ip_address: string | null
  warehouse_id: number | null
  correlation_id: string | null
  created_at: string | null
}

async function apiFetch<T>(url: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${url}`, { credentials: "include" })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

function safeParse(json: string | null): Record<string, unknown> | null {
  if (!json) return null
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "null"
  if (typeof val === "object") return JSON.stringify(val)
  return String(val)
}

function DiffView({
  oldValues,
  newValues,
}: {
  oldValues: string | null
  newValues: string | null
}) {
  const oldObj = useMemo(() => safeParse(oldValues), [oldValues])
  const newObj = useMemo(() => safeParse(newValues), [newValues])

  const allKeys = useMemo(() => {
    const keys = new Set<string>()
    if (oldObj) Object.keys(oldObj).forEach((k) => keys.add(k))
    if (newObj) Object.keys(newObj).forEach((k) => keys.add(k))
    return Array.from(keys).sort()
  }, [oldObj, newObj])

  const getChangeType = (
    key: string
  ): "added" | "removed" | "changed" | "unchanged" => {
    const inOld = oldObj && key in oldObj
    const inNew = newObj && key in newObj
    if (!inOld && inNew) return "added"
    if (inOld && !inNew) return "removed"
    if (
      inOld &&
      inNew &&
      formatValue(oldObj![key]) !== formatValue(newObj![key])
    )
      return "changed"
    return "unchanged"
  }

  if (!oldObj && !newObj) return null

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="bg-muted/50">Polje</TableHead>
            <TableHead className="bg-muted/50">Stara vrijednost</TableHead>
            <TableHead className="bg-muted/50">Nova vrijednost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allKeys.map((key) => {
            const change = getChangeType(key)
            return (
              <TableRow
                key={key}
                className={`border-border ${
                  change === "added"
                    ? "bg-green-500/10"
                    : change === "removed"
                      ? "bg-red-500/10"
                      : change === "changed"
                        ? "bg-amber-500/10"
                        : ""
                }`}
              >
                <TableCell className="font-mono text-xs">{key}</TableCell>
                <TableCell
                  className={`text-xs ${
                    change === "changed" || change === "removed"
                      ? "text-red-400 font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {oldObj && key in oldObj ? formatValue(oldObj[key]) : "—"}
                </TableCell>
                <TableCell
                  className={`text-xs ${
                    change === "changed" || change === "added"
                      ? "text-green-400 font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {newObj && key in newObj ? formatValue(newObj[key]) : "—"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState("")
  const [entityFilter, setEntityFilter] = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const params = new URLSearchParams()
  if (actionFilter) params.set("action", actionFilter)
  if (entityFilter) params.set("entity", entityFilter)
  params.set("limit", "200")

  const { data: logs = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["audit", actionFilter, entityFilter],
    queryFn: () => apiFetch(`/audit?${params.toString()}`),
  })

  return (
    <PermissionGuard permission="audit.view">
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Pregled promjena i akcija u sustavu"
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Filtriraj po akciji..."
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="max-w-xs bg-secondary/50 border-border"
        />
        <Input
          placeholder="Filtriraj po entitetu..."
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="max-w-xs bg-secondary/50 border-border"
        />
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Zapisnik
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-2">Učitavanje...</span>
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Vrijeme</TableHead>
                    <TableHead>Korisnik</TableHead>
                    <TableHead>Akcija</TableHead>
                    <TableHead>Entitet</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <Fragment key={log.id}>
                      <TableRow
                        key={log.id}
                        className={`border-border cursor-pointer transition-colors hover:bg-muted/30 ${
                          expandedId === log.id ? "bg-muted/20" : ""
                        }`}
                        onClick={() =>
                          setExpandedId(
                            expandedId === log.id ? null : log.id
                          )
                          }
                        style={{
                          cursor:
                            log.old_values || log.new_values
                              ? "pointer"
                              : "default",
                        }}
                      >
                        <TableCell className="w-8 text-muted-foreground">
                          {log.old_values || log.new_values ? (
                            expandedId === log.id ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )
                          ) : (
                            ""
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString("hr-HR")
                            : "—"}
                        </TableCell>
                        <TableCell>{log.username || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.entity || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.entity_id || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.ip_address || "—"}
                        </TableCell>
                      </TableRow>
                      {expandedId === log.id &&
                        (log.old_values || log.new_values) && (
                          <TableRow
                            key={`${log.id}-detail`}
                            className="border-border bg-muted/10"
                          >
                            <TableCell
                              colSpan={7}
                              className="p-4 border-l-4 border-primary/50"
                            >
                              <DiffView
                                oldValues={log.old_values}
                                newValues={log.new_values}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
    </PermissionGuard>
  )
}
