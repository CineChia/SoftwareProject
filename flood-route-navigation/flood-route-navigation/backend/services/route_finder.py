"""
route_finder.py

Loads the simplified Caloocan road network and computes the "safest"
route between two nodes using Dijkstra's algorithm, where each edge's
weight is its real-world distance multiplied by a flood-risk penalty
derived from the current hazard level of the zone it passes through.

- Severe risk (level 4) edges are excluded entirely (treated as impassable),
  matching how a real evacuation-routing system should behave.
- Higher risk levels increase the effective "cost" of an edge so the
  algorithm prefers safer, possibly longer, roads.
"""

import json
import heapq
import math
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Multiplier applied to an edge's real distance based on the current
# flood risk level of the zone it passes through (1=Low .. 4=Severe).
RISK_PENALTY = {
    0: 1.0,   # not in any flood zone
    1: 1.2,   # Low
    2: 1.8,   # Moderate
    3: 3.0,   # High
    4: None,  # Severe -> impassable (excluded from the graph)
}


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def load_network() -> dict:
    with open(DATA_DIR / "road_network.json", "r", encoding="utf-8") as f:
        return json.load(f)


def get_nodes() -> list:
    data = load_network()
    return data["nodes"]


def build_weighted_graph(risk_by_zone: dict) -> dict:
    """
    Returns adjacency list:
      { node_id: [ {to, weight_km, distance_km, road, flood_zone_id, risk_level}, ... ] }
    Edges through a zone at severe risk are omitted (impassable).
    Graph is undirected (roads can be traveled both ways).
    """
    data = load_network()
    nodes_by_id = {n["id"]: n for n in data["nodes"]}
    graph = {n["id"]: [] for n in data["nodes"]}

    for edge in data["edges"]:
        a, b = nodes_by_id[edge["from"]], nodes_by_id[edge["to"]]
        distance_km = _haversine_km(a["lat"], a["lng"], b["lat"], b["lng"])

        zone_id = edge.get("flood_zone_id")
        risk_level = risk_by_zone.get(zone_id, {}).get("level", 0) if zone_id else 0
        multiplier = RISK_PENALTY.get(risk_level, 1.0)

        if multiplier is None:
            # Severe risk: road considered impassable/closed, skip this edge entirely
            continue

        weight_km = distance_km * multiplier
        edge_info_fwd = {
            "to": b["id"], "weight_km": weight_km, "distance_km": distance_km,
            "road": edge["road"], "flood_zone_id": zone_id, "risk_level": risk_level,
        }
        edge_info_bwd = {
            "to": a["id"], "weight_km": weight_km, "distance_km": distance_km,
            "road": edge["road"], "flood_zone_id": zone_id, "risk_level": risk_level,
        }
        graph[a["id"]].append(edge_info_fwd)
        graph[b["id"]].append(edge_info_bwd)

    return graph


def find_safest_route(origin_id: str, destination_id: str, risk_by_zone: dict) -> Optional[dict]:
    """
    Dijkstra's algorithm over the risk-weighted graph.
    Returns None if no passable route exists (e.g. everything severed by
    severe-risk closures), otherwise a dict with the path, total distance,
    effective (risk-weighted) cost, and any flood zones traversed.
    """
    graph = build_weighted_graph(risk_by_zone)
    nodes_by_id = {n["id"]: n for n in get_nodes()}

    if origin_id not in graph or destination_id not in graph:
        return None

    dist = {node_id: math.inf for node_id in graph}
    prev = {node_id: None for node_id in graph}
    dist[origin_id] = 0
    pq = [(0, origin_id)]
    visited = set()

    while pq:
        d, u = heapq.heappop(pq)
        if u in visited:
            continue
        visited.add(u)
        if u == destination_id:
            break
        for edge in graph[u]:
            v = edge["to"]
            nd = d + edge["weight_km"]
            if nd < dist[v]:
                dist[v] = nd
                prev[v] = (u, edge)
                heapq.heappush(pq, (nd, v))

    if dist[destination_id] == math.inf:
        return None

    # Reconstruct path
    path_nodes = []
    path_edges = []
    cur = destination_id
    while cur != origin_id:
        p = prev[cur]
        if p is None:
            return None
        prev_node, edge = p
        path_nodes.append(cur)
        path_edges.append(edge)
        cur = prev_node
    path_nodes.append(origin_id)
    path_nodes.reverse()
    path_edges.reverse()

    total_distance_km = sum(e["distance_km"] for e in path_edges)
    total_cost_km = sum(e["weight_km"] for e in path_edges)
    zones_crossed = sorted({e["flood_zone_id"] for e in path_edges if e["flood_zone_id"]})

    coordinates = [
        {"lat": nodes_by_id[nid]["lat"], "lng": nodes_by_id[nid]["lng"], "name": nodes_by_id[nid]["name"], "id": nid}
        for nid in path_nodes
    ]

    return {
        "path_node_ids": path_nodes,
        "coordinates": coordinates,
        "segments": [
            {
                "from": path_nodes[i],
                "to": path_nodes[i + 1],
                "road": path_edges[i]["road"],
                "distance_km": round(path_edges[i]["distance_km"], 2),
                "risk_level": path_edges[i]["risk_level"],
                "flood_zone_id": path_edges[i]["flood_zone_id"],
            }
            for i in range(len(path_edges))
        ],
        "total_distance_km": round(total_distance_km, 2),
        "total_risk_weighted_km": round(total_cost_km, 2),
        "flood_zones_crossed": zones_crossed,
        "estimated_minutes": round((total_distance_km / 20) * 60),  # assumes ~20km/h avg city speed
    }
