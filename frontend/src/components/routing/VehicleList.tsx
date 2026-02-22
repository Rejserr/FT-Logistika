import { useQuery } from '@tanstack/react-query'
import { vehiclesApi, driversApi } from '../../services/api'
import { useRoutingStore } from '../../store/routingStore'
import { Card } from '../common'
import type { Vozilo } from '../../types'
import './VehicleList.css'

export default function VehicleList() {
  const { selectedVehicle, setSelectedVehicle } = useRoutingStore()

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: vehiclesApi.list,
  })

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: driversApi.list,
  })

  const handleSelectVehicle = (vehicle: Vozilo) => {
    if (selectedVehicle?.id === vehicle.id) {
      setSelectedVehicle(null)
    } else {
      setSelectedVehicle(vehicle)
    }
  }

  const activeVehicles = vehicles?.filter((v) => v.aktivan) ?? []

  return (
    <Card title="Vozila" className="vehicle-list-card">
      {isLoading ? (
        <div className="loading-state">Ucitavanje...</div>
      ) : activeVehicles.length === 0 ? (
        <div className="empty-state">Nema dostupnih vozila</div>
      ) : (
        <ul className="vehicle-list">
          {activeVehicles.map((vehicle) => (
            <li
              key={vehicle.id}
              className={`vehicle-item ${
                selectedVehicle?.id === vehicle.id ? 'is-selected' : ''
              }`}
              onClick={() => handleSelectVehicle(vehicle)}
            >
              <div className="vehicle-icon">🚚</div>
              <div className="vehicle-info">
                <div className="vehicle-name">
                  {vehicle.oznaka || vehicle.naziv || `Vozilo #${vehicle.id}`}
                </div>
                <div className="vehicle-meta">
                  {vehicle.nosivost_kg && (
                    <span>{vehicle.nosivost_kg} kg</span>
                  )}
                  {vehicle.volumen_m3 && (
                    <span>{vehicle.volumen_m3} m³</span>
                  )}
                </div>
              </div>
              <div className="vehicle-checkbox">
                <input
                  type="radio"
                  checked={selectedVehicle?.id === vehicle.id}
                  onChange={() => handleSelectVehicle(vehicle)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {drivers && drivers.length > 0 && (
        <div className="drivers-section">
          <h4>Vozaci</h4>
          <ul className="driver-list">
            {drivers.filter((d) => d.aktivan).map((driver) => (
              <li key={driver.id} className="driver-item">
                <span className="driver-icon">👤</span>
                <span>{driver.ime} {driver.prezime}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
