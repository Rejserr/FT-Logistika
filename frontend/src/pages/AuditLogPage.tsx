import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '../components/common'
import './AuditLogPage.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

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
  const resp = await fetch(`${API_BASE}${url}`, { credentials: 'include' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

function safeParse(json: string | null): Record<string, unknown> | null {
  if (!json) return null
  try { return JSON.parse(json) } catch { return null }
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function DiffView({ oldValues, newValues }: { oldValues: string | null; newValues: string | null }) {
  const oldObj = useMemo(() => safeParse(oldValues), [oldValues])
  const newObj = useMemo(() => safeParse(newValues), [newValues])

  const allKeys = useMemo(() => {
    const keys = new Set<string>()
    if (oldObj) Object.keys(oldObj).forEach(k => keys.add(k))
    if (newObj) Object.keys(newObj).forEach(k => keys.add(k))
    return Array.from(keys).sort()
  }, [oldObj, newObj])

  const getChangeType = (key: string): 'added' | 'removed' | 'changed' | 'unchanged' => {
    const inOld = oldObj && key in oldObj
    const inNew = newObj && key in newObj
    if (!inOld && inNew) return 'added'
    if (inOld && !inNew) return 'removed'
    if (inOld && inNew && formatValue(oldObj![key]) !== formatValue(newObj![key])) return 'changed'
    return 'unchanged'
  }

  if (!oldObj && !newObj) return null

  return (
    <div className="audit-diff-table">
      <table className="diff-table">
        <thead>
          <tr>
            <th>Polje</th>
            <th>Stara vrijednost</th>
            <th>Nova vrijednost</th>
          </tr>
        </thead>
        <tbody>
          {allKeys.map(key => {
            const change = getChangeType(key)
            return (
              <tr key={key} className={`diff-row diff-${change}`}>
                <td className="diff-key">{key}</td>
                <td className={`diff-val ${change === 'changed' || change === 'removed' ? 'diff-old-val' : ''}`}>
                  {oldObj && key in oldObj ? formatValue(oldObj[key]) : '—'}
                </td>
                <td className={`diff-val ${change === 'changed' || change === 'added' ? 'diff-new-val' : ''}`}>
                  {newObj && key in newObj ? formatValue(newObj[key]) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const params = new URLSearchParams()
  if (actionFilter) params.set('action', actionFilter)
  if (entityFilter) params.set('entity', entityFilter)
  params.set('limit', '200')

  const { data: logs = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ['audit', actionFilter, entityFilter],
    queryFn: () => apiFetch(`/audit?${params.toString()}`),
  })

  return (
    <div className="audit-page">
      <h1>Audit Log</h1>

      <div className="audit-filters">
        <input
          placeholder="Filtriraj po akciji..."
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        />
        <input
          placeholder="Filtriraj po entitetu..."
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
        />
      </div>

      <Card>
        {isLoading ? (
          <p>Učitavanje...</p>
        ) : (
          <table className="audit-table">
            <thead>
              <tr>
                <th>Vrijeme</th>
                <th>Korisnik</th>
                <th>Akcija</th>
                <th>Entitet</th>
                <th>ID</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <>
                  <tr
                    key={log.id}
                    className={expandedId === log.id ? 'expanded' : ''}
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    style={{ cursor: log.old_values || log.new_values ? 'pointer' : 'default' }}
                  >
                    <td className="audit-time">
                      {log.created_at ? new Date(log.created_at).toLocaleString('hr-HR') : '—'}
                    </td>
                    <td>{log.username || '—'}</td>
                    <td><span className="audit-action">{log.action}</span></td>
                    <td>{log.entity || '—'}</td>
                    <td className="audit-entity-id">{log.entity_id || '—'}</td>
                    <td className="audit-ip">{log.ip_address || '—'}</td>
                  </tr>
                  {expandedId === log.id && (log.old_values || log.new_values) && (
                    <tr key={`${log.id}-detail`} className="audit-detail-row">
                      <td colSpan={6}>
                        <DiffView oldValues={log.old_values} newValues={log.new_values} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
