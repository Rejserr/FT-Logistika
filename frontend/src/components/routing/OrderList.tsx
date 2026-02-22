/**
 * @deprecated Ova komponenta se više ne koristi.
 * Nalozi se sada prebacuju iz OrdersPage u RoutingPage preko routing store-a.
 */
import { Card } from '../common'

export default function OrderList() {
  return (
    <Card title="Nalozi" className="order-list-card">
      <div className="empty-state">
        Koristite stranicu Nalozi za odabir i prebacivanje naloga u rutiranje.
      </div>
    </Card>
  )
}
