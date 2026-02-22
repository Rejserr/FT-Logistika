import { useState, useRef, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Header } from '../components/layout'
import { Card, Button, toast, DataTable } from '../components/common'
import type { DataTableColumn } from '../components/common'
import { regionsApi } from '../services/api'
import type { Regija, RegijaTree, PostanskiBroj } from '../types'
import './RegionsPage.css'

type TabType = 'regions' | 'postal'

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

// ==============================================================================
// Helper: flatten tree za parent dropdown (s uvlačenjem)
// ==============================================================================
function flattenTree(nodes: RegijaTree[], depth = 0): { region: RegijaTree; depth: number }[] {
  const result: { region: RegijaTree; depth: number }[] = []
  for (const node of nodes) {
    result.push({ region: node, depth })
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1))
    }
  }
  return result
}

// ==============================================================================
// Tree Node Component
// ==============================================================================
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
      <div className="tree-row" style={{ paddingLeft: 16 + depth * 24 }}>
        <button
          type="button"
          className={`tree-toggle ${hasChildren ? '' : 'tree-toggle-hidden'}`}
          onClick={() => onToggle(node.id)}
        >
          {hasChildren ? (isExpanded ? '▾' : '▸') : ''}
        </button>
        <div className="tree-node-content">
          <span className="tree-node-name">{node.naziv}</span>
          <span className="tree-node-count" title="Poštanskih brojeva u ovoj regiji">
            {node.postal_count} PB
          </span>
          <span className={`status-badge ${node.aktivan ? 'active' : 'inactive'}`}>
            {node.aktivan ? 'Aktivna' : 'Neaktivna'}
          </span>
        </div>
        <div className="tree-node-actions">
          <Button size="sm" variant="ghost" onClick={() => onAddChild(node.id)}>
            + Podregija
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(node)}>
            Uredi
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (node.children.length > 0) {
                toast.warning('Nije moguće', 'Regija ima podregije. Prvo ih obriši ili prebaci.')
                return
              }
              if (node.postal_count > 0) {
                toast.warning('Nije moguće', 'Regija ima poštanske brojeve. Prvo ih prebaci u drugu regiju.')
                return
              }
              if (confirm('Obrisati regiju?')) onDelete(node.id)
            }}
          >
            Obriši
          </Button>
        </div>
      </div>
      {isExpanded && hasChildren && (
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
        ))
      )}
    </>
  )
}

// ==============================================================================
// Main Page
// ==============================================================================
export default function RegionsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('regions')
  const [showRegionModal, setShowRegionModal] = useState(false)
  const [showPostalModal, setShowPostalModal] = useState(false)
  const [editingRegion, setEditingRegion] = useState<Regija | null>(null)
  const [editingPostal, setEditingPostal] = useState<PostanskiBroj | null>(null)
  const [postalSearch, setPostalSearch] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())

  // Bulk reassign state
  const [checkedPostalIds, setCheckedPostalIds] = useState<Set<number>>(new Set())
  const [reassignRegijaId, setReassignRegijaId] = useState<number | null>(null)

  const [regionForm, setRegionForm] = useState<RegionFormData>({
    naziv: '',
    sifra: '',
    parent_id: null,
    aktivan: true,
  })

  const [postalForm, setPostalForm] = useState<PostalFormData>({
    postanski_broj: '',
    naziv_mjesta: '',
    regija_id: null,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Queries
  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: regionsApi.list,
  })

  const { data: regionsTree = [], isLoading: treeLoading } = useQuery({
    queryKey: ['regions-tree'],
    queryFn: regionsApi.tree,
  })

  const { data: postalCodes = [], isLoading: postalLoading } = useQuery({
    queryKey: ['postal-codes'],
    queryFn: regionsApi.listPostalCodes,
  })

  // Flattened tree za dropdowne
  const flatRegions = useMemo(() => flattenTree(regionsTree), [regionsTree])

  // Region mutations
  const createRegionMutation = useMutation({
    mutationFn: regionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions'] })
      queryClient.invalidateQueries({ queryKey: ['regions-tree'] })
      closeRegionModal()
    },
  })

  const updateRegionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Regija> }) =>
      regionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions'] })
      queryClient.invalidateQueries({ queryKey: ['regions-tree'] })
      closeRegionModal()
    },
  })

  const deleteRegionMutation = useMutation({
    mutationFn: regionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions'] })
      queryClient.invalidateQueries({ queryKey: ['regions-tree'] })
    },
    onError: (err: Error) => {
      toast.error('Brisanje nije uspjelo', err.message)
    },
  })

  // Postal mutations
  const createPostalMutation = useMutation({
    mutationFn: regionsApi.createPostalCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postal-codes'] })
      queryClient.invalidateQueries({ queryKey: ['regions-tree'] })
      closePostalModal()
    },
  })

  const updatePostalMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PostanskiBroj> }) =>
      regionsApi.updatePostalCode(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postal-codes'] })
      queryClient.invalidateQueries({ queryKey: ['regions-tree'] })
      closePostalModal()
    },
  })

  const deletePostalMutation = useMutation({
    mutationFn: regionsApi.deletePostalCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postal-codes'] })
      queryClient.invalidateQueries({ queryKey: ['regions-tree'] })
    },
  })

  // Bulk reassign mutation
  const bulkReassignMutation = useMutation({
    mutationFn: () => regionsApi.bulkReassign(Array.from(checkedPostalIds), reassignRegijaId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['postal-codes'] })
      queryClient.invalidateQueries({ queryKey: ['regions-tree'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success(
        'Prebacivanje završeno',
        `Ažurirano ${data.updated_postal_codes} PB i ${data.updated_orders} naloga.`
      )
      setCheckedPostalIds(new Set())
      setReassignRegijaId(null)
    },
    onError: (err: Error) => {
      toast.error('Prebacivanje nije uspjelo', err.message)
    },
  })

  // Import
  const importRegionsMutation = useMutation({
    mutationFn: (file: File) => regionsApi.importRegions(file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['regions'] })
      queryClient.invalidateQueries({ queryKey: ['regions-tree'] })
      queryClient.invalidateQueries({ queryKey: ['postal-codes'] })
      toast.success(
        'Import završen',
        `Regije: ${data.regije_created} nova, ${data.regije_existing} postojećih. Poštanski brojevi: ${data.postanski_created} novih, ${data.postanski_updated} ažurirano. (${data.rows_processed} redaka)`
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (err: Error) => {
      toast.error('Import nije uspio', err.message)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  // ---- Tree handlers ----
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

  // ---- Modal handlers ----
  const openRegionModal = (region?: Regija | RegijaTree, parentId?: number) => {
    if (region && !parentId) {
      // Editing existing region
      setEditingRegion(region as Regija)
      setRegionForm({
        naziv: region.naziv,
        sifra: region.sifra || '',
        parent_id: region.parent_id ?? null,
        aktivan: region.aktivan ?? true,
      })
    } else {
      // Creating new region (optionally under a parent)
      setEditingRegion(null)
      setRegionForm({
        naziv: '',
        sifra: '',
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
        naziv_mjesta: postal.naziv_mjesta || '',
        regija_id: postal.regija_id,
      })
    } else {
      setEditingPostal(null)
      setPostalForm({
        postanski_broj: '',
        naziv_mjesta: '',
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
    if (!regionId) return '—'
    const region = regions.find((r: Regija) => r.id === regionId)
    return region?.naziv || '—'
  }

  const filteredPostalCodes = postalCodes.filter((pc: PostanskiBroj) => {
    if (!postalSearch) return true
    const search = postalSearch.toLowerCase()
    return (
      pc.postanski_broj.toLowerCase().includes(search) ||
      pc.naziv_mjesta?.toLowerCase().includes(search)
    )
  })

  // Bulk checkbox handlers
  const togglePostalCheck = (id: number) => {
    setCheckedPostalIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllPostal = (allIds: number[]) => {
    setCheckedPostalIds((prev) => {
      const allChecked = allIds.every((id) => prev.has(id))
      if (allChecked) {
        // Odznači sve na trenutnoj stranici
        const next = new Set(prev)
        allIds.forEach((id) => next.delete(id))
        return next
      }
      // Označi sve na trenutnoj stranici
      const next = new Set(prev)
      allIds.forEach((id) => next.add(id))
      return next
    })
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.toLowerCase().slice(-4)
    if (ext !== '.csv' && file.name.toLowerCase().slice(-5) !== '.xlsx') {
      toast.warning('Neispravan format', 'Odaberite .csv ili .xlsx datoteku.')
      return
    }
    importRegionsMutation.mutate(file)
  }

  return (
    <div className="regions-page">
      <Header
        title="Regije i postanski brojevi"
        subtitle="Upravljanje geografskim podacima"
        actions={
          <div className="header-actions-row">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              isLoading={importRegionsMutation.isPending}
            >
              Ucitaj regije (CSV/XLSX)
            </Button>
            {activeTab === 'regions' ? (
              <Button onClick={() => openRegionModal()}>Nova regija</Button>
            ) : (
              <Button onClick={() => openPostalModal()}>Novi postanski broj</Button>
            )}
          </div>
        }
      />

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'regions' ? 'active' : ''}`}
          onClick={() => setActiveTab('regions')}
        >
          Regije ({regions.length})
        </button>
        <button
          className={`tab ${activeTab === 'postal' ? 'active' : ''}`}
          onClick={() => setActiveTab('postal')}
        >
          Postanski brojevi ({postalCodes.length})
        </button>
      </div>

      {/* ================================================================
          Tab: Regije (Tree View)
          ================================================================ */}
      {activeTab === 'regions' && (
        <Card className="data-card">
          <div className="tree-toolbar">
            <span className="tree-info">{regions.length} regija</span>
            <button type="button" className="tree-expand-btn" onClick={expandAll}>
              Proširi sve
            </button>
            <button type="button" className="tree-expand-btn" onClick={collapseAll}>
              Sažmi sve
            </button>
          </div>
          {treeLoading ? (
            <div className="dt-loading">Učitavanje...</div>
          ) : regionsTree.length === 0 ? (
            <div className="dt-empty">Nema regija.</div>
          ) : (
            <div className="tree-container">
              {regionsTree.map((node) => (
                <RegionTreeNode
                  key={node.id}
                  node={node}
                  expanded={expandedNodes}
                  onToggle={toggleExpanded}
                  onEdit={(r) => openRegionModal(r)}
                  onAddChild={(parentId) => openRegionModal(undefined, parentId)}
                  onDelete={(id) => deleteRegionMutation.mutate(id)}
                  depth={0}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ================================================================
          Tab: Poštanski brojevi (DataTable + bulk reassign)
          ================================================================ */}
      {activeTab === 'postal' && (
        <Card className="data-card">
          {/* Bulk reassign bar */}
          {checkedPostalIds.size > 0 && (
            <div className="bulk-bar">
              <span className="bulk-bar-info">
                Odabrano: <strong>{checkedPostalIds.size}</strong> poštanskih brojeva
              </span>
              <div className="bulk-bar-action">
                <label>Prebaci u regiju:</label>
                <select
                  value={reassignRegijaId ?? ''}
                  onChange={(e) =>
                    setReassignRegijaId(e.target.value ? Number(e.target.value) : null)
                  }
                >
                  <option value="">-- Odaberi regiju --</option>
                  {flatRegions.map(({ region, depth }) => (
                    <option key={region.id} value={region.id}>
                      {'  '.repeat(depth)}{depth > 0 ? '└ ' : ''}{region.naziv}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!reassignRegijaId) {
                      toast.warning('Odaberi regiju', 'Moraš odabrati ciljnu regiju.')
                      return
                    }
                    if (confirm(`Prebaciti ${checkedPostalIds.size} poštanskih brojeva?`)) {
                      bulkReassignMutation.mutate()
                    }
                  }}
                  isLoading={bulkReassignMutation.isPending}
                >
                  Prebaci
                </Button>
              </div>
              <button
                type="button"
                className="bulk-bar-clear"
                onClick={() => { setCheckedPostalIds(new Set()); setReassignRegijaId(null) }}
              >
                Poništi odabir
              </button>
            </div>
          )}

          <div className="search-bar">
            <input
              type="text"
              placeholder="Pretraži po broju ili mjestu..."
              value={postalSearch}
              onChange={(e) => setPostalSearch(e.target.value)}
            />
          </div>
          <DataTable<PostanskiBroj>
            storageKey="ft-postal-codes"
            columns={[
              { key: 'postanski_broj', label: 'Poštanski broj' },
              { key: 'naziv_mjesta', label: 'Mjesto' },
              { key: 'regija', label: 'Regija' },
            ] as DataTableColumn[]}
            data={filteredPostalCodes}
            rowKey={(p) => p.id}
            isLoading={postalLoading}
            emptyMessage={postalSearch ? 'Nema rezultata.' : 'Nema poštanskih brojeva.'}
            pageSizes={[100, 200, 500, 0]}
            defaultPageSize={100}
            checkedKeys={checkedPostalIds}
            onToggleCheck={(key) => togglePostalCheck(key as number)}
            onToggleAll={(allKeys) => toggleAllPostal(allKeys as number[])}
            cellValue={(p, key) => {
              if (key === 'regija') return getRegionName(p.regija_id)
              return (p as unknown as Record<string, unknown>)[key]
            }}
            cellRenderer={(p, key) => {
              if (key === 'naziv_mjesta') return p.naziv_mjesta || '—'
              if (key === 'regija') return getRegionName(p.regija_id)
              return String((p as unknown as Record<string, unknown>)[key] ?? '—')
            }}
            actions={(postal) => (
              <div className="action-buttons">
                <Button size="sm" variant="ghost" onClick={() => openPostalModal(postal)}>Uredi</Button>
                <Button size="sm" variant="danger" onClick={() => { if (confirm('Obrisati poštanski broj?')) deletePostalMutation.mutate(postal.id) }}>Obriši</Button>
              </div>
            )}
          />
        </Card>
      )}

      {/* ================================================================
          Region Modal (create / edit)
          ================================================================ */}
      {showRegionModal && (
        <div className="modal-overlay" onClick={closeRegionModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingRegion ? 'Uredi regiju' : 'Nova regija'}</h2>
            <form onSubmit={handleRegionSubmit}>
              <div className="form-group">
                <label>Naziv *</label>
                <input
                  type="text"
                  value={regionForm.naziv}
                  onChange={(e) => setRegionForm({ ...regionForm, naziv: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Nadređena regija</label>
                <select
                  value={regionForm.parent_id ?? ''}
                  onChange={(e) =>
                    setRegionForm({ ...regionForm, parent_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">-- Nema (root regija) --</option>
                  {flatRegions
                    .filter(({ region }) => editingRegion ? region.id !== editingRegion.id : true)
                    .map(({ region, depth }) => (
                      <option key={region.id} value={region.id}>
                        {'  '.repeat(depth)}{depth > 0 ? '└ ' : ''}{region.naziv}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={regionForm.aktivan}
                    onChange={(e) => setRegionForm({ ...regionForm, aktivan: e.target.checked })}
                  />
                  Aktivna regija
                </label>
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={closeRegionModal}>
                  Odustani
                </Button>
                <Button
                  type="submit"
                  isLoading={createRegionMutation.isPending || updateRegionMutation.isPending}
                >
                  {editingRegion ? 'Spremi' : 'Dodaj'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================
          Postal Modal (create / edit)
          ================================================================ */}
      {showPostalModal && (
        <div className="modal-overlay" onClick={closePostalModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingPostal ? 'Uredi postanski broj' : 'Novi postanski broj'}</h2>
            <form onSubmit={handlePostalSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Postanski broj *</label>
                  <input
                    type="text"
                    value={postalForm.postanski_broj}
                    onChange={(e) => setPostalForm({ ...postalForm, postanski_broj: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Naziv mjesta</label>
                  <input
                    type="text"
                    value={postalForm.naziv_mjesta}
                    onChange={(e) => setPostalForm({ ...postalForm, naziv_mjesta: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Regija</label>
                <select
                  value={postalForm.regija_id || ''}
                  onChange={(e) =>
                    setPostalForm({ ...postalForm, regija_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">-- Bez regije --</option>
                  {flatRegions.map(({ region, depth }) => (
                    <option key={region.id} value={region.id}>
                      {'  '.repeat(depth)}{depth > 0 ? '└ ' : ''}{region.naziv}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={closePostalModal}>
                  Odustani
                </Button>
                <Button
                  type="submit"
                  isLoading={createPostalMutation.isPending || updatePostalMutation.isPending}
                >
                  {editingPostal ? 'Spremi' : 'Dodaj'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
