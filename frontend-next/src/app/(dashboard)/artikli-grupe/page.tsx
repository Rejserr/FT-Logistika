"use client"

import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { PermissionGuard } from "@/components/auth/permission-guard"
import { Card } from "@/components/ui/card"
import { DataTable, type ColumnDef } from "@/components/common/data-table"
import { itemsApi } from "@/services/api"
import type { GrupaArtikla } from "@/types"

const COLUMNS: ColumnDef<GrupaArtikla>[] = [
  { key: "grupa_artikla", header: "Šifra grupe" },
  { key: "grupa_artikla_naziv", header: "Naziv grupe" },
  { key: "nadgrupa_artikla_naziv", header: "Nadgrupa" },
  { key: "supergrupa_artikla_naziv", header: "Supergrupa" },
]

export default function GrupeArtikalaPage() {
  const { data: grupe = [], isLoading } = useQuery({
    queryKey: ["grupe-artikala"],
    queryFn: () => itemsApi.listGrupeArtikala(),
  })

  return (
    <PermissionGuard permission="items.view">
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <PageHeader
            title="Grupe artikala"
            subtitle="Grupe artikala iz ERP-a"
          />
          <Card className="glass p-4">
            <DataTable
              storageKey="ft-grupe-artikala"
              columns={COLUMNS}
              data={grupe}
              loading={isLoading}
              pageSize={50}
              searchPlaceholder="Pretraži grupe..."
              showColumnPicker
              getRowId={(g) => g.grupa_artikla_uid}
              emptyMessage="Nema grupa za prikaz."
            />
          </Card>
        </div>
      </div>
    </PermissionGuard>
  )
}
