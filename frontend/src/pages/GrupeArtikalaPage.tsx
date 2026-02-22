import { useQuery } from '@tanstack/react-query'
import { Header } from '../components/layout'
import { Card, DataTable } from '../components/common'
import type { DataTableColumn } from '../components/common'
import { itemsApi } from '../services/api'
import type { GrupaArtikla } from '../types'
import './ArtikliPage.css'

const COLUMNS: DataTableColumn[] = [
  { key: 'grupa_artikla', label: 'Šifra grupe' },
  { key: 'grupa_artikla_naziv', label: 'Naziv grupe' },
  { key: 'nadgrupa_artikla_naziv', label: 'Nadgrupa' },
  { key: 'supergrupa_artikla_naziv', label: 'Supergrupa' },
]

export default function GrupeArtikalaPage() {
  const { data: grupe = [], isLoading } = useQuery({
    queryKey: ['grupe-artikala'],
    queryFn: () => itemsApi.listGrupeArtikala(),
  })

  return (
    <div className="artikli-page">
      <Header
        title="Grupe artikala"
        subtitle="Grupe artikala iz ERP-a"
      />

      <Card className="artikli-table-card">
        <DataTable<GrupaArtikla>
          storageKey="ft-grupe-artikala"
          columns={COLUMNS}
          data={grupe}
          rowKey={(g) => g.grupa_artikla_uid}
          isLoading={isLoading}
          emptyMessage="Nema grupa za prikaz."
        />
      </Card>
    </div>
  )
}
