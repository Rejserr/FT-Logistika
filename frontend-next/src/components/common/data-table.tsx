"use client"

import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Search,
  X,
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Columns3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
} from "lucide-react"
import { useTablePreferences } from "@/hooks/useTablePreferences"

export interface ColumnDef<T> {
  key: string
  header: string
  visible?: boolean
  sortable?: boolean
  filterable?: boolean
  width?: string
  render?: (row: T) => ReactNode
  getValue?: (row: T) => string | number | null | undefined
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  pageSize?: number
  searchPlaceholder?: string
  storageKey?: string
  showColumnPicker?: boolean
  onRowClick?: (row: T) => void
  selectedRows?: Set<string>
  onSelectRows?: (rows: Set<string>) => void
  getRowId?: (row: T) => string
  actions?: ReactNode
  emptyMessage?: string
  fillHeight?: boolean
  rowClassName?: (row: T) => string
}

type SortDir = "asc" | "desc" | null
const MIN_COL_WIDTH = 50
const DEFAULT_COL_WIDTH = 150

export function DataTable<T>({
  columns: columnDefs,
  data,
  loading = false,
  pageSize: defaultPageSize = 50,
  searchPlaceholder = "Pretraži...",
  storageKey,
  showColumnPicker = false,
  onRowClick,
  selectedRows,
  onSelectRows,
  getRowId,
  actions,
  emptyMessage = "Nema podataka.",
  fillHeight = false,
  rowClassName,
}: DataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState("")
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({})
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({})
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [page, setPage] = useState(0)

  // Defaults for preference hook
  const defaultVisibleCols = useMemo(() => {
    const initial: Record<string, boolean> = {}
    columnDefs.forEach((c) => { initial[c.key] = c.visible !== false })
    return initial
  }, [columnDefs])

  const defaultColumnOrder = useMemo(() => columnDefs.map((c) => c.key), [columnDefs])

  const { prefs, update: updatePrefs } = useTablePreferences(storageKey, {
    visibleCols: defaultVisibleCols,
    columnOrder: defaultColumnOrder,
    pageSize: defaultPageSize,
  })

  const visibleCols = prefs.visibleCols
  const columnOrder = prefs.columnOrder
  const columnWidths = prefs.columnWidths
  const pageSize = prefs.pageSize

  const setVisibleCols = useCallback((updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    updatePrefs({ visibleCols: updater(prefs.visibleCols) })
  }, [updatePrefs, prefs.visibleCols])

  const setColumnOrder = useCallback((updater: (prev: string[]) => string[]) => {
    updatePrefs({ columnOrder: updater(prefs.columnOrder) })
  }, [updatePrefs, prefs.columnOrder])

  const setColumnWidths = useCallback((updater: (prev: Record<string, number>) => Record<string, number>) => {
    updatePrefs({ columnWidths: updater(prefs.columnWidths) })
  }, [updatePrefs, prefs.columnWidths])

  const setPageSize = useCallback((size: number) => {
    updatePrefs({ pageSize: size })
  }, [updatePrefs])

  // Sync new columns to order
  useEffect(() => {
    const allKeys = columnDefs.map((c) => c.key)
    const missing = allKeys.filter((k) => !columnOrder.includes(k))
    if (missing.length > 0) setColumnOrder((prev) => [...prev, ...missing])
  }, [columnDefs, columnOrder])

  // Ordered visible columns
  const columns = useMemo(() => {
    const visible = columnDefs.filter((c) => visibleCols[c.key] !== false)
    return columnOrder
      .map((key) => visible.find((c) => c.key === key))
      .filter(Boolean) as ColumnDef<T>[]
  }, [columnDefs, visibleCols, columnOrder])

  const getCellValue = useCallback(
    (row: T, col: ColumnDef<T>): string => {
      if (col.getValue) {
        const v = col.getValue(row)
        return v != null ? String(v) : ""
      }
      const v = (row as Record<string, unknown>)[col.key]
      return v != null ? String(v) : ""
    },
    []
  )

  // Distinct values per column (cascading: each column sees data filtered by ALL OTHER active filters)
  const distinctValues = useMemo(() => {
    const map: Record<string, string[]> = {}
    const filterableColumns = columnDefs.filter((col) => col.filterable !== false)

    filterableColumns.forEach((col) => {
      let subset = globalFilter.trim()
        ? data.filter((row) =>
            columnDefs.some((c) => {
              if (visibleCols[c.key] === false) return false
              return getCellValue(row, c).toLowerCase().includes(globalFilter.toLowerCase())
            })
          )
        : data

      Object.entries(columnFilters).forEach(([filterKey, selectedVals]) => {
        if (filterKey === col.key || selectedVals.size === 0) return
        const filterCol = columnDefs.find((c) => c.key === filterKey)
        if (!filterCol) return
        subset = subset.filter((row) => selectedVals.has(getCellValue(row, filterCol)))
      })

      const valSet = new Set<string>()
      subset.forEach((row) => {
        const v = getCellValue(row, col)
        if (v) valSet.add(v)
      })
      const sorted = Array.from(valSet).sort((a, b) => {
        const na = Number(a)
        const nb = Number(b)
        if (!isNaN(na) && !isNaN(nb)) return na - nb
        return a.localeCompare(b, "hr")
      })
      map[col.key] = sorted
    })
    return map
  }, [data, columnDefs, getCellValue, columnFilters, globalFilter, visibleCols])

  // Filtering: empty set = no filter (show all), non-empty set = include only selected
  const filtered = useMemo(() => {
    let result = data

    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase()
      result = result.filter((row) =>
        columnDefs.some((col) => {
          if (visibleCols[col.key] === false) return false
          return getCellValue(row, col).toLowerCase().includes(q)
        })
      )
    }

    Object.entries(columnFilters).forEach(([key, selectedVals]) => {
      if (selectedVals.size === 0) return
      const col = columnDefs.find((c) => c.key === key)
      if (!col) return
      result = result.filter((row) => selectedVals.has(getCellValue(row, col)))
    })

    return result
  }, [data, globalFilter, columnFilters, columnDefs, getCellValue, visibleCols])

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered
    const col = columnDefs.find((c) => c.key === sortKey)
    if (!col) return filtered
    return [...filtered].sort((a, b) => {
      const va = getCellValue(a, col)
      const vb = getCellValue(b, col)
      const na = Number(va)
      const nb = Number(vb)
      let cmp: number
      if (!isNaN(na) && !isNaN(nb) && va !== "" && vb !== "") cmp = na - nb
      else cmp = va.localeCompare(vb, "hr")
      return sortDir === "desc" ? -cmp : cmp
    })
  }, [filtered, sortKey, sortDir, columnDefs, getCellValue])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc")
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null) }
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const activeFilterCount = Object.values(columnFilters).filter((s) => s.size > 0).length

  // Column drag reorder
  const dragColRef = useRef<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  const handleColDragStart = (key: string) => { dragColRef.current = key }
  const handleColDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    if (dragColRef.current && dragColRef.current !== key) setDragOverCol(key)
  }
  const handleColDrop = (key: string) => {
    if (!dragColRef.current || dragColRef.current === key) {
      setDragOverCol(null); dragColRef.current = null; return
    }
    setColumnOrder((prev) => {
      const arr = [...prev]
      const fromIdx = arr.indexOf(dragColRef.current!)
      const toIdx = arr.indexOf(key)
      if (fromIdx === -1 || toIdx === -1) return prev
      arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, dragColRef.current!)
      return arr
    })
    setDragOverCol(null); dragColRef.current = null
  }
  const handleColDragEnd = () => { setDragOverCol(null); dragColRef.current = null }

  // Column resize
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null)
  const [resizingKey, setResizingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!resizingKey) return
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current
      if (!r) return
      const delta = e.clientX - r.startX
      const next = Math.max(MIN_COL_WIDTH, r.startW + delta)
      setColumnWidths((prev) => ({ ...prev, [r.key]: next }))
    }
    const onUp = () => {
      resizingRef.current = null
      setResizingKey(null)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [resizingKey])

  const handleResizeStart = (colKey: string, e: React.MouseEvent) => {
    const th = (e.target as HTMLElement).closest("th")
    const currentW = th ? th.getBoundingClientRect().width : (columnWidths[colKey] ?? DEFAULT_COL_WIDTH)
    resizingRef.current = { key: colKey, startX: e.clientX, startW: currentW }
    setResizingKey(colKey)
  }

  const getColStyle = (col: ColumnDef<T>): React.CSSProperties => {
    const manualW = columnWidths[col.key]
    if (manualW) return { width: manualW, minWidth: MIN_COL_WIDTH, maxWidth: manualW }
    const defW = col.width ? parseInt(col.width) : undefined
    return { minWidth: defW || MIN_COL_WIDTH }
  }

  // Select all on current page
  const allPageSelected =
    selectedRows && getRowId && paged.length > 0 && paged.every((r) => selectedRows.has(getRowId(r)))

  // Filter actions
  const toggleFilterValue = (colKey: string, val: string) => {
    setColumnFilters((prev) => {
      const cur = prev[colKey] ? new Set(prev[colKey]) : new Set<string>()
      if (cur.has(val)) cur.delete(val)
      else cur.add(val)
      return { ...prev, [colKey]: cur }
    })
    setPage(0)
  }

  const clearFilter = (colKey: string) => {
    setColumnFilters((prev) => ({ ...prev, [colKey]: new Set<string>() }))
    setPage(0)
  }

  const isFilterActive = (colKey: string) => {
    const f = columnFilters[colKey]
    return f != null && f.size > 0
  }

  return (
    <div className={`flex flex-col gap-3 ${fillHeight ? "flex-1 min-h-0 overflow-hidden" : ""}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => { setGlobalFilter(e.target.value); setPage(0) }}
            className="pl-9 bg-secondary/50 border-border"
          />
        </div>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setColumnFilters({}); setPage(0) }}
            className="text-muted-foreground"
          >
            <X className="mr-1 h-3 w-3" />
            Očisti filtere ({activeFilterCount})
          </Button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {showColumnPicker && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="border-border">
                  <Columns3 className="mr-1 h-4 w-4" />
                  Kolone
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-0" sideOffset={4}>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-medium">Prikaži kolone</span>
                  <PopoverClose asChild>
                    <button className="rounded-sm p-0.5 hover:bg-accent transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </PopoverClose>
                </div>
                <div className="overflow-y-auto max-h-[360px] p-1">
                  {[...columnDefs].sort((a, b) => a.header.localeCompare(b.header, "hr")).map((col) => {
                    const checked = visibleCols[col.key] !== false
                    return (
                      <div
                        key={col.key}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer ${checked ? "bg-primary/5" : ""}`}
                        onClick={() => setVisibleCols((prev) => ({ ...prev, [col.key]: !checked }))}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => setVisibleCols((prev) => ({ ...prev, [col.key]: !!v }))}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs">{col.header}</span>
                      </div>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {actions}
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-2xl border-none bg-white dark:bg-card dark:border dark:border-border overflow-auto shadow-premium ${fillHeight ? "flex-1 min-h-0" : ""}`}>
        <table className="w-full caption-bottom text-sm" style={{ minWidth: "max-content" }}>
          <TableHeader className={fillHeight ? "[&_tr]:border-b" : ""}>
            <TableRow className="border-slate-100 dark:border-border hover:bg-transparent">
              {selectedRows && onSelectRows && getRowId && (
                <TableHead className={`w-10 ${fillHeight ? "sticky top-0 z-20 bg-white dark:bg-card" : ""}`} style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    checked={allPageSelected || false}
                    onChange={(e) => {
                      const newSet = new Set(selectedRows)
                      paged.forEach((r) => {
                        const id = getRowId(r)
                        if (e.target.checked) newSet.add(id)
                        else newSet.delete(id)
                      })
                      onSelectRows(newSet)
                    }}
                    className="rounded border-border"
                  />
                </TableHead>
              )}
              {columns.map((col) => {
                const colStyle = getColStyle(col)
                return (
                  <TableHead
                    key={col.key}
                    style={colStyle}
                    className={`text-xs font-medium text-muted-foreground uppercase tracking-wider select-none relative whitespace-nowrap ${
                      fillHeight ? "sticky top-0 z-20 bg-white dark:bg-card" : ""
                    } ${dragOverCol === col.key ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                    draggable
                    onDragStart={() => handleColDragStart(col.key)}
                    onDragOver={(e) => handleColDragOver(e, col.key)}
                    onDrop={() => handleColDrop(col.key)}
                    onDragEnd={handleColDragEnd}
                  >
                    <div className="flex items-center gap-1 pr-2">
                      <GripVertical className="h-3 w-3 opacity-20 cursor-grab shrink-0" />

                      {col.sortable !== false ? (
                        <button
                          onClick={() => handleSort(col.key)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors truncate"
                        >
                          <span className="truncate">{col.header}</span>
                          {sortKey === col.key ? (
                            sortDir === "asc" ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-30 shrink-0" />
                          )}
                        </button>
                      ) : (
                        <span className="truncate">{col.header}</span>
                      )}

                      {col.filterable !== false && (distinctValues[col.key]?.length || 0) > 0 && (
                        <ColumnFilter
                          colKey={col.key}
                          header={col.header}
                          distinctValues={distinctValues[col.key] || []}
                          selectedValues={columnFilters[col.key] || new Set()}
                          isActive={isFilterActive(col.key)}
                          filterSearch={filterSearch[col.key] || ""}
                          onFilterSearchChange={(v) => setFilterSearch((p) => ({ ...p, [col.key]: v }))}
                          onToggle={(val) => toggleFilterValue(col.key, val)}
                          onClear={() => clearFilter(col.key)}
                        />
                      )}
                    </div>

                    {/* Resize handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-20"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleResizeStart(col.key, e)
                      }}
                    />
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectedRows ? 1 : 0)}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Učitavanje...
                  </div>
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectedRows ? 1 : 0)}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row, i) => {
                const rowId = getRowId?.(row) ?? String(i)
                const isSelected = selectedRows?.has(rowId)
                const extraClass = rowClassName?.(row) ?? ""
                const hasHighlight = extraClass.length > 0
                return (
                  <TableRow
                    key={rowId}
                    onClick={() => onRowClick?.(row)}
                    className={`
                      border-border transition-colors
                      ${onRowClick ? "cursor-pointer" : ""}
                      ${hasHighlight ? extraClass : isSelected ? "bg-primary/5" : "hover:bg-muted/30"}
                    `}
                  >
                    {selectedRows && onSelectRows && getRowId && (
                      <TableCell className="w-10" style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={isSelected || false}
                          onChange={(e) => {
                            e.stopPropagation()
                            const newSet = new Set(selectedRows)
                            if (e.target.checked) newSet.add(rowId)
                            else newSet.delete(rowId)
                            onSelectRows(newSet)
                          }}
                          className="rounded border-border"
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => {
                      const colStyle = getColStyle(col)
                      return (
                        <TableCell
                          key={col.key}
                          className="text-sm truncate"
                          style={colStyle}
                        >
                          {col.render ? col.render(row) : getCellValue(row, col) || "—"}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground shrink-0">
        <div className="flex items-center gap-4">
          <span>
            {sorted.length > 0
              ? `${safePage * pageSize + 1}-${Math.min((safePage + 1) * pageSize, sorted.length)} od ${sorted.length}`
              : "0 rezultata"}
          </span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0) }}
            className="h-8 rounded-md border border-border bg-secondary/50 px-2 text-sm text-foreground"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n} / str.</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === 0} onClick={() => setPage(0)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-3 text-foreground font-medium">{safePage + 1} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Column Filter (include-based)
   Empty set = no filter (show all)
   Non-empty set = show ONLY selected values
   ═══════════════════════════════════════════ */
function ColumnFilter({
  colKey,
  header,
  distinctValues,
  selectedValues,
  isActive,
  filterSearch,
  onFilterSearchChange,
  onToggle,
  onClear,
}: {
  colKey: string
  header: string
  distinctValues: string[]
  selectedValues: Set<string>
  isActive: boolean
  filterSearch: string
  onFilterSearchChange: (v: string) => void
  onToggle: (val: string) => void
  onClear: () => void
}) {
  const visibleValues = useMemo(() => {
    if (!filterSearch.trim()) return distinctValues
    const q = filterSearch.toLowerCase()
    return distinctValues.filter((v) => v.toLowerCase().includes(q))
  }, [distinctValues, filterSearch])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="ml-auto p-0.5 rounded hover:bg-accent transition-colors shrink-0">
          <Filter className={`h-3 w-3 ${isActive ? "text-primary" : "opacity-30"}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start" side="bottom" collisionPadding={8} sideOffset={4}>
        <div className="p-2 border-b border-border">
          <Input
            placeholder={`Traži ${header}...`}
            value={filterSearch}
            onChange={(e) => onFilterSearchChange(e.target.value)}
            className="h-7 text-xs"
            autoFocus
          />
        </div>

        {isActive && (
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-primary/5">
            <span className="text-[10px] text-primary font-medium">
              Filter aktivan ({selectedValues.size})
            </span>
            <button
              onClick={onClear}
              className="text-[10px] text-primary hover:underline font-medium"
            >
              Pokaži sve
            </button>
          </div>
        )}

        <div className="overflow-y-auto max-h-[240px] p-1">
          {visibleValues.map((val) => {
            const checked = selectedValues.has(val)
            return (
              <div
                key={val}
                className={`flex items-center gap-2 rounded px-2 py-1 hover:bg-accent cursor-pointer ${checked ? "bg-primary/5" : ""}`}
                onClick={() => onToggle(val)}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(val)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs truncate">{val}</span>
              </div>
            )
          })}
          {visibleValues.length === 0 && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              Nema rezultata
            </div>
          )}
        </div>

        {!isActive && (
          <div className="px-3 py-1.5 border-t border-border">
            <span className="text-[10px] text-muted-foreground">
              Označite vrijednosti za filtriranje
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
