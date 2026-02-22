/**
 * DataTable – Reusable tablica sa sortiranjem, filtriranjem po koloni,
 * drag & drop premještanjem kolona, resize kolona, column picker i localStorage persistencijom.
 *
 * Korištenje:
 *   <DataTable
 *     storageKey="moja-tablica"
 *     columns={[{ key: 'naziv', label: 'Naziv' }, ...]}
 *     data={items}
 *     rowKey={(item) => item.id}
 *     cellRenderer={(item, key) => item[key]}
 *     onRowClick={(item) => ...}
 *     actions={(item) => <Button>Uredi</Button>}
 *   />
 */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './DataTable.css'

// ============================================================================
// Types
// ============================================================================

export interface DataTableColumn {
  key: string
  label: string
}

export interface DataTableProps<T> {
  /** Unique key for localStorage persistence */
  storageKey: string
  /** All available columns */
  columns: DataTableColumn[]
  /** Default visible column keys (order matters) */
  defaultVisibleKeys?: string[]
  /** Data array */
  data: T[]
  /** Extract unique key from row */
  rowKey: (item: T) => string | number
  /** Get cell value for filtering/sorting. Defaults to (item as any)[key] */
  cellValue?: (item: T, key: string) => unknown
  /** Render cell content. If not provided, uses cellValue + toString */
  cellRenderer?: (item: T, key: string) => React.ReactNode
  /** Actions column renderer */
  actions?: (item: T) => React.ReactNode
  /** Row click handler */
  onRowClick?: (item: T) => void
  /** Active row key (for highlighting) */
  activeRowKey?: string | number | null
  /** Loading state */
  isLoading?: boolean
  /** Empty state message */
  emptyMessage?: string
  /** Extra class on wrapper */
  className?: string
  /** Row class name generator */
  rowClassName?: (item: T) => string
  /** Show column picker button (default true) */
  showColumnPicker?: boolean
  /** Default column width */
  defaultColumnWidth?: number
  /** Minimum column width */
  minColumnWidth?: number
  /** Available page sizes. Pass e.g. [100, 200, 500, 0] where 0 means "Sve". Omit to disable pagination. */
  pageSizes?: number[]
  /** Default page size (must be in pageSizes array). Defaults to first element. */
  defaultPageSize?: number
  /** Set of checked row keys (enables checkbox column). */
  checkedKeys?: Set<string | number>
  /** Called when a single row checkbox is toggled. */
  onToggleCheck?: (key: string | number) => void
  /** Called when header "select all" checkbox is toggled. Receives all visible/filtered row keys. */
  onToggleAll?: (allKeys: (string | number)[]) => void
}

// ============================================================================
// localStorage helpers
// ============================================================================

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore */ }
}

// ============================================================================
// Component
// ============================================================================

export default function DataTable<T>({
  storageKey,
  columns,
  defaultVisibleKeys,
  data,
  rowKey,
  cellValue: cellValueProp,
  cellRenderer,
  actions,
  onRowClick,
  activeRowKey,
  isLoading = false,
  emptyMessage = 'Nema podataka za prikaz.',
  className = '',
  rowClassName,
  showColumnPicker = true,
  defaultColumnWidth = 150,
  minColumnWidth = 80,
  pageSizes,
  defaultPageSize,
  checkedKeys,
  onToggleCheck,
  onToggleAll,
}: DataTableProps<T>) {
  // ---- State ----
  const defaultKeys = defaultVisibleKeys ?? columns.map((c) => c.key)
  const [visibleKeys, setVisibleKeys] = useState<string[]>(
    () => loadJson<string[]>(`${storageKey}-cols`) ?? defaultKeys
  )
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => loadJson<Record<string, number>>(`${storageKey}-widths`) ?? {}
  )
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const [draggedKey, setDraggedKey] = useState<string | null>(null)

  // Dropdowns
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const [filterKey, setFilterKey] = useState<string | null>(null)
  const [filterPos, setFilterPos] = useState<{ top: number; left: number } | null>(null)

  // Refs
  const pickerBtnRef = useRef<HTMLSpanElement>(null)
  const pickerDropRef = useRef<HTMLDivElement>(null)
  const filterBtnRef = useRef<HTMLDivElement>(null)
  const filterDropRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null)
  const [resizingKey, setResizingKey] = useState<string | null>(null)

  // Pagination
  const hasPagination = !!pageSizes && pageSizes.length > 0
  const [pageSize, setPageSize] = useState<number>(
    () => defaultPageSize ?? (pageSizes?.[0] ?? 0)
  )
  const [currentPage, setCurrentPage] = useState(1)

  // ---- Persist ----
  useEffect(() => { saveJson(`${storageKey}-cols`, visibleKeys) }, [storageKey, visibleKeys])
  useEffect(() => { saveJson(`${storageKey}-widths`, columnWidths) }, [storageKey, columnWidths])

  // ---- Helpers ----
  const getCellValue = useCallback(
    (item: T, key: string): unknown => {
      if (cellValueProp) return cellValueProp(item, key)
      return (item as unknown as Record<string, unknown>)[key]
    },
    [cellValueProp]
  )

  const getCellString = useCallback(
    (item: T, key: string): string => {
      const v = getCellValue(item, key)
      return v === null || v === undefined ? '' : String(v).trim()
    },
    [getCellValue]
  )

  // ---- Visible columns ----
  const visibleCols = useMemo(
    () =>
      visibleKeys
        .map((k) => columns.find((c) => c.key === k))
        .filter((c): c is DataTableColumn => !!c),
    [visibleKeys, columns]
  )

  // ---- Distinct values per column (respecting other filters) ----
  const distinctByColumn = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    columns.forEach(({ key: targetKey }) => {
      map[targetKey] = new Set()
      const relevant = data.filter((item) => {
        for (const colKey of visibleKeys) {
          if (colKey === targetKey) continue
          const sel = columnFilters[colKey]
          if (!sel || sel.length === 0) continue
          const val = getCellString(item, colKey)
          if (!sel.includes(val)) return false
        }
        return true
      })
      relevant.forEach((item) => {
        map[targetKey].add(getCellString(item, targetKey))
      })
    })
    return map
  }, [data, columns, visibleKeys, columnFilters, getCellString])

  // ---- Filtering ----
  const filtered = useMemo(() => {
    return data.filter((item) => {
      for (const colKey of visibleKeys) {
        const sel = columnFilters[colKey]
        if (!sel || sel.length === 0) continue
        const val = getCellString(item, colKey)
        if (!sel.includes(val)) return false
      }
      return true
    })
  }, [data, visibleKeys, columnFilters, getCellString])

  // ---- Sorting ----
  const sorted = useMemo(() => {
    if (!sortBy) return filtered
    const key = sortBy
    return [...filtered].sort((a, b) => {
      const rawA = getCellValue(a, key)
      const rawB = getCellValue(b, key)
      const aVal = rawA ?? ''
      const bVal = rawB ?? ''
      const numA = typeof aVal === 'number' ? aVal : Number(aVal)
      const numB = typeof bVal === 'number' ? bVal : Number(bVal)
      if (!Number.isNaN(numA) && !Number.isNaN(numB) && String(aVal) !== '' && String(bVal) !== '')
        return sortDir === 'asc' ? numA - numB : numB - numA
      const strA = String(aVal)
      const strB = String(bVal)
      const cmp = strA.localeCompare(strB, 'hr', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortBy, sortDir, getCellValue])

  // ---- Pagination ----
  // Reset to page 1 when filters or sorting change
  const filterSignature = JSON.stringify(columnFilters)
  useEffect(() => { setCurrentPage(1) }, [filterSignature, sortBy, sortDir])

  const totalPages = hasPagination && pageSize > 0 ? Math.ceil(sorted.length / pageSize) : 1
  const paginatedData = useMemo(() => {
    if (!hasPagination || pageSize === 0) return sorted // 0 = "Sve"
    const start = (currentPage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, hasPagination, pageSize, currentPage])

  // ---- Handlers ----
  const handleSort = (key: string) => {
    setSortBy((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return key
      }
      setSortDir('asc')
      return key
    })
  }

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    })
  }

  const reorderColumns = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return
    setVisibleKeys((prev) => {
      const fi = prev.indexOf(fromKey)
      const ti = prev.indexOf(toKey)
      if (fi === -1 || ti === -1) return prev
      const next = [...prev]
      const [removed] = next.splice(fi, 1)
      next.splice(ti, 0, removed)
      return next
    })
  }

  const toggleFilterValue = (colKey: string, value: string) => {
    setColumnFilters((prev) => {
      const arr = prev[colKey] ?? []
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      return { ...prev, [colKey]: next }
    })
  }

  const clearColumnFilter = (colKey: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev }
      delete next[colKey]
      return next
    })
    setFilterKey(null)
  }

  // ---- Resize ----
  const handleResizeStart = (colKey: string, currentWidth: number, clientX: number) => {
    resizeRef.current = { key: colKey, startX: clientX, startW: currentWidth }
    setResizingKey(colKey)
  }

  useEffect(() => {
    if (!resizingKey) return
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current
      if (!r) return
      const next = Math.max(minColumnWidth, r.startW + (e.clientX - r.startX))
      setColumnWidths((prev) => ({ ...prev, [r.key]: next }))
    }
    const onUp = () => {
      resizeRef.current = null
      setResizingKey(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return onUp
  }, [resizingKey, minColumnWidth])

  // ---- Dropdown positioning ----
  useEffect(() => {
    if (pickerOpen && pickerBtnRef.current) {
      const r = pickerBtnRef.current.getBoundingClientRect()
      setPickerPos({ top: r.bottom + 4, left: r.left })
    } else {
      setPickerPos(null)
    }
  }, [pickerOpen])

  useEffect(() => {
    if (filterKey && filterBtnRef.current) {
      const r = filterBtnRef.current.getBoundingClientRect()
      setFilterPos({ top: r.bottom + 4, left: r.left })
    } else {
      setFilterPos(null)
    }
  }, [filterKey])

  // ---- Click outside ----
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as Node
      if (!pickerBtnRef.current?.contains(t) && !pickerDropRef.current?.contains(t)) {
        setPickerOpen(false)
      }
      if (!filterBtnRef.current?.contains(t) && !filterDropRef.current?.contains(t)) {
        setFilterKey(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ---- Checkbox ----
  const hasCheckbox = !!checkedKeys && !!onToggleCheck
  const allPageKeys = useMemo(
    () => paginatedData.map((item) => rowKey(item)),
    [paginatedData, rowKey]
  )
  const allChecked = hasCheckbox && allPageKeys.length > 0 && allPageKeys.every((k) => checkedKeys!.has(k))
  const someChecked = hasCheckbox && !allChecked && allPageKeys.some((k) => checkedKeys!.has(k))

  // ---- Render ----
  const hasActions = !!actions

  return (
    <div className={`dt-wrapper ${className}`}>
      {/* Toolbar */}
      {showColumnPicker && (
        <div className="dt-toolbar">
          <span className="dt-row-count">
            {hasPagination && pageSize > 0
              ? `${Math.min((currentPage - 1) * pageSize + 1, sorted.length)}–${Math.min(currentPage * pageSize, sorted.length)} od ${sorted.length}`
              : `${sorted.length} redaka`}
          </span>
          <span ref={pickerBtnRef}>
            <button
              type="button"
              className="dt-picker-btn"
              onClick={() => setPickerOpen((o) => !o)}
            >
              Kolone
            </button>
          </span>
          {Object.keys(columnFilters).some((k) => (columnFilters[k]?.length ?? 0) > 0) && (
            <button
              type="button"
              className="dt-clear-filters-btn"
              onClick={() => setColumnFilters({})}
            >
              Poništi filtere
            </button>
          )}
        </div>
      )}

      {/* Table scroll area */}
      <div className="dt-scroll">
        {isLoading ? (
          <div className="dt-loading">Učitavanje...</div>
        ) : sorted.length === 0 ? (
          <div className="dt-empty">{emptyMessage}</div>
        ) : (
          <table className="dt-table">
            <thead>
              <tr>
                {hasCheckbox && (
                  <th className="dt-th dt-th-check" style={{ width: 36, minWidth: 36 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = !!someChecked }}
                      onChange={() => onToggleAll?.(allPageKeys)}
                      title="Označi/odznači sve"
                    />
                  </th>
                )}
                {visibleCols.map(({ key, label }: { key: string; label: string }) => {
                  const w = columnWidths[key] ?? defaultColumnWidth
                  const hasFilter = (columnFilters[key]?.length ?? 0) > 0
                  return (
                    <th
                      key={key}
                      className={`dt-th ${hasFilter ? 'dt-th-filtered' : ''}`}
                      style={{ width: w, minWidth: w }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (draggedKey && draggedKey !== key) e.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        const from = e.dataTransfer.getData('text/plain')
                        if (from && from !== key) reorderColumns(from, key)
                        setDraggedKey(null)
                      }}
                    >
                      <div className="dt-th-inner">
                        <span
                          className="dt-drag-handle"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', key)
                            e.dataTransfer.effectAllowed = 'move'
                            setDraggedKey(key)
                          }}
                          onDragEnd={() => setDraggedKey(null)}
                          title="Povuci za promjenu redoslijeda"
                        >
                          ⋮⋮
                        </span>
                        <div className="dt-th-content">
                          <button
                            type="button"
                            className="dt-sort-btn"
                            onClick={() => handleSort(key)}
                            title="Sortiraj"
                          >
                            <span>{label}</span>
                            {sortBy === key && (
                              <span className="dt-sort-icon">
                                {sortDir === 'asc' ? ' ↑' : ' ↓'}
                              </span>
                            )}
                          </button>
                          <div
                            className="dt-filter-wrap"
                            ref={filterKey === key ? filterBtnRef : undefined}
                          >
                            <button
                              type="button"
                              className={`dt-filter-btn ${hasFilter ? 'active' : ''}`}
                              onClick={() => setFilterKey((prev) => (prev === key ? null : key))}
                              title="Filter"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </div>
                      <div
                        className="dt-resize-handle"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleResizeStart(key, w, e.clientX)
                        }}
                      />
                    </th>
                  )
                })}
                {hasActions && <th className="dt-th dt-th-actions">Akcije</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => {
                const rk = rowKey(item)
                const isActive = activeRowKey != null && rk === activeRowKey
                const extraClass = rowClassName ? rowClassName(item) : ''
                return (
                  <tr
                    key={rk}
                    className={`${isActive ? 'dt-row-active' : ''} ${extraClass}`}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    {hasCheckbox && (
                      <td className="dt-td-check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checkedKeys!.has(rk)}
                          onChange={() => onToggleCheck!(rk)}
                        />
                      </td>
                    )}
                    {visibleCols.map(({ key }) => {
                      const w = columnWidths[key] ?? defaultColumnWidth
                      const content = cellRenderer
                        ? cellRenderer(item, key)
                        : getCellString(item, key) || '—'
                      return (
                        <td key={key} style={{ width: w, minWidth: w }}>
                          {content}
                        </td>
                      )
                    })}
                    {hasActions && (
                      <td className="dt-td-actions" onClick={(e) => e.stopPropagation()}>
                        {actions(item)}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination footer */}
      {hasPagination && sorted.length > 0 && (
        <div className="dt-pagination">
          <div className="dt-pagination-sizes">
            <span className="dt-pagination-label">Po stranici:</span>
            {pageSizes!.map((size) => (
              <button
                key={size}
                type="button"
                className={`dt-page-size-btn ${pageSize === size ? 'active' : ''}`}
                onClick={() => { setPageSize(size); setCurrentPage(1) }}
              >
                {size === 0 ? 'Sve' : size}
              </button>
            ))}
          </div>
          {pageSize > 0 && totalPages > 1 && (
            <div className="dt-pagination-nav">
              <button
                type="button"
                className="dt-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                title="Prva stranica"
              >
                «
              </button>
              <button
                type="button"
                className="dt-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="Prethodna"
              >
                ‹
              </button>
              <span className="dt-page-info">
                Stranica {currentPage} od {totalPages}
              </span>
              <button
                type="button"
                className="dt-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                title="Sljedeća"
              >
                ›
              </button>
              <button
                type="button"
                className="dt-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                title="Zadnja stranica"
              >
                »
              </button>
            </div>
          )}
        </div>
      )}

      {/* Column picker portal */}
      {pickerOpen &&
        pickerPos &&
        createPortal(
          <div
            ref={pickerDropRef}
            className="dt-picker-dropdown"
            style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 9999 }}
          >
            <div className="dt-picker-header">Prikaži kolone</div>
            {columns.map(({ key, label }) => (
              <label key={key} className="dt-picker-item">
                <input
                  type="checkbox"
                  checked={visibleKeys.includes(key)}
                  onChange={() => toggleColumn(key)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>,
          document.body
        )}

      {/* Filter dropdown portal */}
      {filterKey &&
        filterPos &&
        createPortal(
          <div
            ref={filterDropRef}
            className="dt-filter-dropdown"
            style={{ position: 'fixed', top: filterPos.top, left: filterPos.left, zIndex: 9999 }}
          >
            <button
              type="button"
              className="dt-filter-item dt-filter-all"
              onClick={() => clearColumnFilter(filterKey)}
            >
              (Sve)
            </button>
            {Array.from(distinctByColumn[filterKey] || [])
              .sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b, 'hr')))
              .slice(0, 200)
              .map((val) => (
                <label key={val || '(prazno)'} className="dt-filter-item">
                  <input
                    type="checkbox"
                    checked={(columnFilters[filterKey] ?? []).includes(val)}
                    onChange={() => toggleFilterValue(filterKey, val)}
                  />
                  <span>{val || '(prazno)'}</span>
                </label>
              ))}
            {(distinctByColumn[filterKey]?.size ?? 0) > 200 && (
              <div className="dt-filter-more">
                + još {(distinctByColumn[filterKey]?.size ?? 0) - 200} vrijednosti
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
