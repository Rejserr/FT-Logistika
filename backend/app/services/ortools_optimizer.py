"""
OR-Tools VRP (Vehicle Routing Problem) optimizer.

Koristi Google OR-Tools za optimizaciju ruta s:
- Kapacitetima vozila (masa, volumen)
- Time windows (prozori isporuke)
- Više vozila simultano
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

logger = logging.getLogger(__name__)


@dataclass
class Location:
    """Lokacija s koordinatama i dodatnim podacima."""
    id: str  # nalog_uid ili depot_id
    lat: float
    lng: float
    demand_kg: float = 0
    demand_m3: float = 0
    time_window_start: int = 0  # minuta od ponoći
    time_window_end: int = 1440  # 24h
    service_time: int = 10  # minuta


@dataclass
class Vehicle:
    """Vozilo s kapacitetima."""
    id: int
    capacity_kg: float = 1000
    capacity_m3: float = 10
    start_location_idx: int = 0  # index depota


@dataclass
class OptimizationResult:
    """Rezultat optimizacije."""
    success: bool
    routes: list[list[str]]  # lista ruta, svaka ruta je lista location_id-ova
    total_distance_m: int
    total_duration_s: int
    vehicle_assignments: dict[int, int]  # location_id -> vehicle_id
    dropped_locations: list[str]
    message: str


class ORToolsOptimizer:
    """VRP optimizer koristeći Google OR-Tools."""

    def __init__(self) -> None:
        self.time_limit_seconds = 30

    def optimize(
        self,
        locations: list[Location],
        vehicles: list[Vehicle],
        distance_matrix: list[list[int]],  # matrica udaljenosti u metrima
        duration_matrix: list[list[int]],  # matrica trajanja u sekundama
    ) -> OptimizationResult:
        """
        Optimiziraj rute za dane lokacije i vozila.

        Args:
            locations: Lista lokacija (prva je depot)
            vehicles: Lista vozila
            distance_matrix: NxN matrica udaljenosti
            duration_matrix: NxN matrica trajanja

        Returns:
            OptimizationResult s optimiziranim rutama
        """
        if len(locations) < 2:
            return OptimizationResult(
                success=False,
                routes=[],
                total_distance_m=0,
                total_duration_s=0,
                vehicle_assignments={},
                dropped_locations=[],
                message="Potrebne su barem 2 lokacije (depot + 1 stop)",
            )

        if not vehicles:
            return OptimizationResult(
                success=False,
                routes=[],
                total_distance_m=0,
                total_duration_s=0,
                vehicle_assignments={},
                dropped_locations=[],
                message="Potrebno je barem jedno vozilo",
            )

        num_locations = len(locations)
        num_vehicles = len(vehicles)
        depot_index = 0

        # Kreiraj routing model
        manager = pywrapcp.RoutingIndexManager(
            num_locations, num_vehicles, depot_index
        )
        routing = pywrapcp.RoutingModel(manager)

        # Distance callback
        def distance_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return distance_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Kapacitet - masa (kg)
        def demand_kg_callback(from_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            return int(locations[from_node].demand_kg)

        demand_kg_callback_index = routing.RegisterUnaryTransitCallback(demand_kg_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_kg_callback_index,
            0,  # slack
            [int(v.capacity_kg) for v in vehicles],  # vehicle capacities
            True,  # start cumul to zero
            "Capacity_KG",
        )

        # Kapacitet - volumen (m3) - pretvori u litru za int
        def demand_m3_callback(from_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            return int(locations[from_node].demand_m3 * 1000)  # m3 -> litara

        demand_m3_callback_index = routing.RegisterUnaryTransitCallback(demand_m3_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_m3_callback_index,
            0,
            [int(v.capacity_m3 * 1000) for v in vehicles],  # m3 -> litara
            True,
            "Capacity_M3",
        )

        # Time windows
        def time_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            travel_time = duration_matrix[from_node][to_node] // 60  # sekunde -> minute
            service_time = locations[from_node].service_time
            return travel_time + service_time

        time_callback_index = routing.RegisterTransitCallback(time_callback)
        routing.AddDimension(
            time_callback_index,
            60,  # max wait time (minuta)
            1440,  # max time per vehicle (24h)
            False,  # don't force start cumul to zero
            "Time",
        )

        time_dimension = routing.GetDimensionOrDie("Time")

        # Postavi time windows za svaku lokaciju
        for location_idx, location in enumerate(locations):
            index = manager.NodeToIndex(location_idx)
            time_dimension.CumulVar(index).SetRange(
                location.time_window_start,
                location.time_window_end,
            )

        # Minimiziraj ukupno vrijeme
        for i in range(num_vehicles):
            routing.AddVariableMinimizedByFinalizer(
                time_dimension.CumulVar(routing.Start(i))
            )
            routing.AddVariableMinimizedByFinalizer(
                time_dimension.CumulVar(routing.End(i))
            )

        # Dozvoli dropping lokacija ako ne stanu
        penalty = 100000
        for location_idx in range(1, num_locations):  # skip depot
            routing.AddDisjunction([manager.NodeToIndex(location_idx)], penalty)

        # Search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = self.time_limit_seconds

        # Riješi
        solution = routing.SolveWithParameters(search_parameters)

        if not solution:
            return OptimizationResult(
                success=False,
                routes=[],
                total_distance_m=0,
                total_duration_s=0,
                vehicle_assignments={},
                dropped_locations=[loc.id for loc in locations[1:]],
                message="Nije pronađeno rješenje",
            )

        # Izvuci rute iz rješenja
        routes: list[list[str]] = []
        vehicle_assignments: dict[str, int] = {}
        total_distance = 0
        total_duration = 0

        for vehicle_idx in range(num_vehicles):
            route: list[str] = []
            index = routing.Start(vehicle_idx)

            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                if node != depot_index:  # skip depot
                    location_id = locations[node].id
                    route.append(location_id)
                    vehicle_assignments[location_id] = vehicles[vehicle_idx].id

                previous_index = index
                index = solution.Value(routing.NextVar(index))
                total_distance += routing.GetArcCostForVehicle(
                    previous_index, index, vehicle_idx
                )

            # Dohvati vrijeme za rutu
            time_var = time_dimension.CumulVar(index)
            total_duration += solution.Value(time_var)

            if route:
                routes.append(route)

        # Pronađi dropped lokacije
        visited_ids = set()
        for route in routes:
            visited_ids.update(route)

        dropped = [
            loc.id for loc in locations[1:] if loc.id not in visited_ids
        ]

        return OptimizationResult(
            success=True,
            routes=routes,
            total_distance_m=total_distance,
            total_duration_s=total_duration * 60,  # minute -> sekunde
            vehicle_assignments=vehicle_assignments,
            dropped_locations=dropped,
            message=f"Optimizirano {len(routes)} ruta s {sum(len(r) for r in routes)} stopova",
        )


# Singleton
ortools_optimizer = ORToolsOptimizer()
