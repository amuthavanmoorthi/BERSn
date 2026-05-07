#!/usr/bin/env python3
"""BERSn geometry preview calculator.

This module is intentionally dependency-free so the Node backend can call it in
local Docker and production containers. TypeScript owns auth/database concerns;
Python owns calculation math.
"""

from __future__ import annotations

import json
import math
import sys
from typing import Any, Dict, List, Tuple


SHADING_COVERAGE = {
    "None": 0.0,
    "Horizontal": 0.35,
    "Vertical": 0.25,
    "Eggcrate": 0.60,
    "Louver": 0.45,
    "SH_NONE": 0.0,
    "SH_OVERHANG": 0.30,
    "SH_FIN": 0.20,
    "SH_EGGCRATE": 0.50,
    "SH_LOUVER": 0.40,
}

CLIMATE_REGIONS = {
    "REGION_A": {"id": "REGION_A", "label": "Zone A (Urban Core)", "ur": 1.0},
    "REGION_B": {"id": "REGION_B", "label": "Zone B (Urban)", "ur": 0.95},
    "REGION_C": {"id": "REGION_C", "label": "Zone C (Suburban)", "ur": 0.9},
    "REGION_D": {"id": "REGION_D", "label": "Zone D (Rural/Special)", "ur": 0.85},
}

USE_CATEGORIES = {
    "USE_OFFICE": {"id": "USE_OFFICE", "label": "Office", "aeui": 120, "leui": 35, "eeui": 8, "es": 0.15, "hasCentralDhwDefault": False},
    "USE_RETAIL": {"id": "USE_RETAIL", "label": "Retail", "aeui": 150, "leui": 50, "eeui": 5, "es": 0.12, "hasCentralDhwDefault": False},
    "USE_HOTEL": {"id": "USE_HOTEL", "label": "Hotel", "aeui": 180, "leui": 30, "eeui": 12, "es": 0.25, "hasCentralDhwDefault": True},
    "USE_HOSPITAL": {"id": "USE_HOSPITAL", "label": "Hospital", "aeui": 250, "leui": 45, "eeui": 15, "es": 0.30, "hasCentralDhwDefault": True},
    "USE_DORM": {"id": "USE_DORM", "label": "Dormitory", "aeui": 80, "leui": 20, "eeui": 10, "es": 0.20, "hasCentralDhwDefault": True},
    "USE_GYM": {"id": "USE_GYM", "label": "Gym/Recreation", "aeui": 130, "leui": 40, "eeui": 6, "es": 0.35, "hasCentralDhwDefault": True},
}

WALL_CONSTRUCTIONS = {
    "CONS_WALL_RC": {"id": "CONS_WALL_RC", "label": "RC Wall", "uValue": 3.5},
    "CONS_WALL_RC_INS": {"id": "CONS_WALL_RC_INS", "label": "RC + Insulation", "uValue": 0.65},
    "CONS_WALL_CURTAIN": {"id": "CONS_WALL_CURTAIN", "label": "Curtain Wall", "uValue": 2.0},
    "CONS_WALL_BRICK": {"id": "CONS_WALL_BRICK", "label": "Brick + Insulation", "uValue": 0.55},
}

ROOF_CONSTRUCTIONS = {
    "CONS_ROOF_RC": {"id": "CONS_ROOF_RC", "label": "RC Roof", "uValue": 2.8},
    "CONS_ROOF_RC_INS": {"id": "CONS_ROOF_RC_INS", "label": "RC + Insulation", "uValue": 0.45},
    "CONS_ROOF_GREEN": {"id": "CONS_ROOF_GREEN", "label": "Green Roof", "uValue": 0.35},
    "CONS_ROOF_COOL": {"id": "CONS_ROOF_COOL", "label": "Cool Roof", "uValue": 0.5},
}

SHADING_TYPES = {
    "SH_NONE": {"id": "SH_NONE", "label": "None", "ki": 1.0, "renderShadingType": "None"},
    "SH_OVERHANG": {"id": "SH_OVERHANG", "label": "Horizontal", "ki": 0.75, "renderShadingType": "Horizontal"},
    "SH_FIN": {"id": "SH_FIN", "label": "Vertical Fin", "ki": 0.8, "renderShadingType": "Vertical"},
    "SH_EGGCRATE": {"id": "SH_EGGCRATE", "label": "Eggcrate", "ki": 0.6, "renderShadingType": "Eggcrate"},
    "SH_LOUVER": {"id": "SH_LOUVER", "label": "Louver", "ki": 0.65, "renderShadingType": "Louver"},
}

GLAZING_TYPES = {
    "GLZ_CLEAR": {"id": "GLZ_CLEAR", "label": "Clear Single", "ug": 5.8, "etaI": 0.85},
    "GLZ_TINT": {"id": "GLZ_TINT", "label": "Tinted", "ug": 5.5, "etaI": 0.6},
    "GLZ_DBL": {"id": "GLZ_DBL", "label": "Double Clear", "ug": 2.8, "etaI": 0.7},
    "GLZ_DBL_LOW_E": {"id": "GLZ_DBL_LOW_E", "label": "Double Low-E", "ug": 1.8, "etaI": 0.55},
    "GLZ_TRIPLE": {"id": "GLZ_TRIPLE", "label": "Triple", "ug": 1.2, "etaI": 0.5},
    "GLZ_VACUUM": {"id": "GLZ_VACUUM", "label": "Vacuum", "ug": 0.5, "etaI": 0.35},
}

HVAC_SYSTEMS = {
    "HVAC_SPLIT": {"id": "HVAC_SPLIT", "label": "Split AC", "eac": 1.0, "params": {"cop": 3.0, "controls": "manual"}},
    "HVAC_VRF": {"id": "HVAC_VRF", "label": "VRF System", "eac": 0.75, "params": {"cop": 4.5, "controls": "auto"}},
    "HVAC_CHILLER": {"id": "HVAC_CHILLER", "label": "Chiller System", "eac": 0.65, "params": {"iplv": 5.5, "pumpEff": 0.8, "fanEff": 0.7}},
    "HVAC_CHILLER_VSD": {"id": "HVAC_CHILLER_VSD", "label": "Chiller+VSD", "eac": 0.5, "params": {"iplv": 6.5, "pumpEff": 0.85, "fanEff": 0.8}},
}

LIGHTING_SYSTEMS = {
    "LGT_FLUO": {"id": "LGT_FLUO", "label": "Fluorescent", "el": 1.0, "params": {"lpd": 15, "controls": "switch"}},
    "LGT_T5": {"id": "LGT_T5", "label": "T5 Fluorescent", "el": 0.8, "params": {"lpd": 12, "controls": "switch"}},
    "LGT_LED": {"id": "LGT_LED", "label": "LED", "el": 0.6, "params": {"lpd": 9, "controls": "switch"}},
    "LGT_LED_DIM": {"id": "LGT_LED_DIM", "label": "LED + Dimming", "el": 0.45, "params": {"lpd": 8, "controls": "dimmer"}},
    "LGT_LED_SMART": {"id": "LGT_LED_SMART", "label": "LED + Smart", "el": 0.35, "params": {"lpd": 7, "controls": "smart"}},
}

ELEVATOR_TYPES = {
    "ET_ACVV": {"id": "ET_ACVV", "label": "ACVV", "et": 1.0},
    "ET_VVVF": {"id": "ET_VVVF", "label": "VVVF", "et": 0.6},
    "ET_VVVF_REGEN": {"id": "ET_VVVF_REGEN", "label": "VVVF Regen", "et": 0.4},
}

DHW_SYSTEMS = {
    "DHW_NONE": {"id": "DHW_NONE", "label": "None", "ehw": 0.0},
    "DHW_ELECTRIC": {"id": "DHW_ELECTRIC", "label": "Electric", "ehw": 1.0},
    "DHW_GAS": {"id": "DHW_GAS", "label": "Gas", "ehw": 0.8},
    "DHW_HEATPUMP": {"id": "DHW_HEATPUMP", "label": "Heat Pump", "ehw": 0.4},
    "DHW_HEATPUMP_TANK": {"id": "DHW_HEATPUMP_TANK", "label": "Heat Pump + Tank", "ehw": 0.35},
    "DHW_SOLAR": {"id": "DHW_SOLAR", "label": "Solar", "ehw": 0.2},
}


def _num(params: Dict[str, Any], key: str, fallback: float) -> float:
    value = params.get(key, fallback)
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = fallback
    if not math.isfinite(number):
        number = fallback
    return number


def _positive(params: Dict[str, Any], key: str, fallback: float) -> float:
    return max(0.0, _num(params, key, fallback))


def _bucket_orientation(angle: float) -> str:
    normalized = angle % 360.0
    if normalized >= 315.0 or normalized < 45.0:
        return "north"
    if normalized < 135.0:
        return "east"
    if normalized < 225.0:
        return "south"
    return "west"


def _distribute_equal(total_wall_area: float) -> Dict[str, float]:
    quarter = total_wall_area / 4.0
    return {
        "wallNorth": quarter,
        "wallSouth": quarter,
        "wallEast": quarter,
        "wallWest": quarter,
    }


def _subtract_interval(parts: List[Tuple[float, float]], blocked: Tuple[float, float]) -> List[Tuple[float, float]]:
    block_start, block_end = blocked
    if block_end <= block_start:
        return parts

    remaining: List[Tuple[float, float]] = []
    for start, end in parts:
        if block_end <= start or block_start >= end:
            remaining.append((start, end))
            continue
        if block_start > start:
            remaining.append((start, min(block_start, end)))
        if block_end < end:
            remaining.append((max(block_end, start), end))
    return [(start, end) for start, end in remaining if end > start]


def _union_rect_area(rects: List[Tuple[float, float, float, float]]) -> float:
    x_points = sorted({value for x1, x2, _, _ in rects for value in (x1, x2)})
    if len(x_points) < 2:
        return 0.0

    area = 0.0
    for left, right in zip(x_points, x_points[1:]):
        if right <= left:
            continue
        z_intervals = [
            (z1, z2)
            for x1, x2, z1, z2 in rects
            if x1 < right and x2 > left
        ]
        if not z_intervals:
            continue
        z_intervals.sort()
        merged: List[Tuple[float, float]] = []
        for start, end in z_intervals:
            if not merged or start > merged[-1][1]:
                merged.append((start, end))
            else:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        area += (right - left) * sum(end - start for start, end in merged)
    return max(0.0, area)


def _rectilinear_union_metrics(
    rects: List[Tuple[float, float, float, float]],
    height: float,
    azimuth: float,
) -> Tuple[Dict[str, float], float, float]:
    """Return exposed directional wall areas for a union of axis-aligned rectangles.

    Rectangles are expressed as (x_min, x_max, z_min, z_max). X maps east/west,
    Z maps north/south, matching the Three.js footprint controls.
    """

    walls = {"wallNorth": 0.0, "wallSouth": 0.0, "wallEast": 0.0, "wallWest": 0.0}

    for index, (x1, x2, z1, z2) in enumerate(rects):
        edges = (
            ("north", z2, (x1, x2), 0.0),
            ("east", x2, (z1, z2), 90.0),
            ("south", z1, (x1, x2), 180.0),
            ("west", x1, (z1, z2), 270.0),
        )

        for side, line, interval, normal_angle in edges:
            exposed_parts = [interval]
            for other_index, (ox1, ox2, oz1, oz2) in enumerate(rects):
                if other_index == index:
                    continue

                if side == "north" and oz1 <= line < oz2:
                    exposed_parts = _subtract_interval(exposed_parts, (ox1, ox2))
                elif side == "south" and oz1 < line <= oz2:
                    exposed_parts = _subtract_interval(exposed_parts, (ox1, ox2))
                elif side == "east" and ox1 <= line < ox2:
                    exposed_parts = _subtract_interval(exposed_parts, (oz1, oz2))
                elif side == "west" and ox1 < line <= ox2:
                    exposed_parts = _subtract_interval(exposed_parts, (oz1, oz2))

            exposed_length = sum(end - start for start, end in exposed_parts)
            if exposed_length <= 0:
                continue
            bucket = _bucket_orientation(normal_angle + azimuth)
            walls[f"wall{bucket.capitalize()}"] += exposed_length * height

    wall_area = sum(walls.values())
    return walls, wall_area, _union_rect_area(rects)


def _ellipse_circumference(major_radius: float, minor_radius: float) -> float:
    if major_radius <= 0 or minor_radius <= 0:
        return 0.0
    return math.pi * (
        3.0 * (major_radius + minor_radius)
        - math.sqrt((3.0 * major_radius + minor_radius) * (major_radius + 3.0 * minor_radius))
    )


def _box_metrics(params: Dict[str, Any]) -> Tuple[Dict[str, float], float, float]:
    width = _positive(params, "width", 40.0)
    length = _positive(params, "length", 30.0)
    height = _positive(params, "height", 45.0)
    azimuth = _num(params, "azimuth", 0.0)

    walls = {"wallNorth": 0.0, "wallSouth": 0.0, "wallEast": 0.0, "wallWest": 0.0}
    side_configs = (
        (width * height, azimuth),
        (length * height, azimuth + 90.0),
        (width * height, azimuth + 180.0),
        (length * height, azimuth + 270.0),
    )
    for area, angle in side_configs:
        bucket = _bucket_orientation(angle)
        walls[f"wall{bucket.capitalize()}"] += area

    return walls, 2.0 * (width + length) * height, width * length


def _shape_metrics(geometry_type: str, params: Dict[str, Any]) -> Tuple[Dict[str, float], float, float]:
    height = _positive(params, "height", 45.0)

    if geometry_type == "box":
        return _box_metrics(params)

    if geometry_type == "lShape":
        l1 = _positive(params, "l1", 40.0)
        w1 = _positive(params, "w1", 20.0)
        l2 = _positive(params, "l2", 20.0)
        w2 = _positive(params, "w2", 15.0)
        direction = -1.0 if str(params.get("lDirection") or "right") == "left" else 1.0
        main = (-w1 / 2.0, w1 / 2.0, -l1 / 2.0, l1 / 2.0)
        ext_center_x = direction * ((w1 / 2.0) + (w2 / 2.0))
        ext_center_z = (l1 - l2) / 2.0
        extension = (
            ext_center_x - (w2 / 2.0),
            ext_center_x + (w2 / 2.0),
            ext_center_z - (l2 / 2.0),
            ext_center_z + (l2 / 2.0),
        )
        return _rectilinear_union_metrics([main, extension], height, _num(params, "azimuth", 0.0))

    if geometry_type == "tShape":
        l1 = _positive(params, "l1", 40.0)
        w1 = _positive(params, "w1", 15.0)
        l2 = _positive(params, "l2", 30.0)
        w2 = _positive(params, "w2", 20.0)
        wing_position = str(params.get("wingPosition") or "center")
        wing_center_z = 0.0
        if wing_position == "left":
            wing_center_z = (l1 / 2.0) - (w2 / 2.0)
        elif wing_position == "right":
            wing_center_z = (-l1 / 2.0) + (w2 / 2.0)
        stem = (-w1 / 2.0, w1 / 2.0, -l1 / 2.0, l1 / 2.0)
        wing = (-l2 / 2.0, l2 / 2.0, wing_center_z - (w2 / 2.0), wing_center_z + (w2 / 2.0))
        return _rectilinear_union_metrics([stem, wing], height, _num(params, "azimuth", 0.0))

    if geometry_type == "cylinder":
        radius = _positive(params, "radius", 15.0)
        wall_area = 2.0 * math.pi * radius * height
        footprint_area = math.pi * radius * radius
        return _distribute_equal(wall_area), wall_area, footprint_area

    if geometry_type == "ellipse":
        major_radius = _positive(params, "majorRadius", 25.0)
        minor_radius = _positive(params, "minorRadius", 15.0)
        wall_area = _ellipse_circumference(major_radius, minor_radius) * height
        footprint_area = math.pi * major_radius * minor_radius
        return _distribute_equal(wall_area), wall_area, footprint_area

    if geometry_type == "arc":
        outer_radius = _positive(params, "arcRadius", 30.0)
        depth = _positive(params, "depth", 20.0)
        inner_radius = max(0.0, outer_radius - depth)
        angle_rad = math.radians(max(0.0, min(_num(params, "arcAngle", 90.0), 360.0)))
        perimeter = (outer_radius * angle_rad) + (inner_radius * angle_rad) + (2.0 * depth)
        wall_area = perimeter * height
        footprint_area = 0.5 * angle_rad * max(0.0, (outer_radius * outer_radius) - (inner_radius * inner_radius))
        return _distribute_equal(wall_area), wall_area, footprint_area

    if geometry_type == "fan":
        outer_radius = _positive(params, "outerRadius", 30.0)
        inner_radius = min(_positive(params, "innerRadius", 10.0), outer_radius)
        angle_rad = math.radians(max(0.0, min(_num(params, "fanAngle", 90.0), 360.0)))
        radial_depth = outer_radius - inner_radius
        perimeter = (outer_radius * angle_rad) + (inner_radius * angle_rad) + (2.0 * radial_depth)
        wall_area = perimeter * height
        footprint_area = 0.5 * angle_rad * max(0.0, (outer_radius * outer_radius) - (inner_radius * inner_radius))
        return _distribute_equal(wall_area), wall_area, footprint_area

    return _box_metrics(params)


def _round_metric(value: float) -> float:
    return round(float(value), 4)


def _round_kpi(value: float) -> float:
    return round(float(value), 6)


def _clamp(value: float, lower: float, upper: float) -> float:
    return min(max(float(value), lower), upper)


def _lookup(table: Dict[str, Dict[str, Any]], selected_id: str, fallback_id: str) -> Dict[str, Any]:
    return dict(table.get(selected_id) or table[fallback_id])


def _options(table: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [dict(value) for value in table.values()]


def _lookup_context(payload: Dict[str, Any]) -> Dict[str, Any]:
    context = payload.get("lookupContext")
    return context if isinstance(context, dict) else {}


def _context_section(payload: Dict[str, Any], section_name: str) -> Dict[str, Any]:
    section = _lookup_context(payload).get(section_name)
    return section if isinstance(section, dict) else {}


def _context_item(
    payload: Dict[str, Any],
    section_name: str,
    item_name: str,
    fallback_table: Dict[str, Dict[str, Any]],
    selected_id: str,
    fallback_id: str,
) -> Dict[str, Any]:
    item = _context_section(payload, section_name).get(item_name)
    return dict(item) if isinstance(item, dict) else _lookup(fallback_table, selected_id, fallback_id)


def _context_options(
    payload: Dict[str, Any],
    section_name: str,
    option_name: str,
    fallback_table: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    options = _context_section(payload, section_name).get("availableOptions")
    if isinstance(options, dict) and isinstance(options.get(option_name), list):
        return [dict(item) for item in options[option_name] if isinstance(item, dict)]
    return _options(fallback_table)


def _field(data: Dict[str, Any], *keys: str, fallback: Any = None) -> Any:
    for key in keys:
        if key in data and data[key] is not None:
            return data[key]
    return fallback


def _metric_number(data: Dict[str, Any], *keys: str, fallback: float = 0.0) -> float:
    value = _field(data, *keys, fallback=fallback)
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = fallback
    return number if math.isfinite(number) else fallback


def _safe_exempt_areas(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    rows = []
    for index, zone in enumerate(value):
        if not isinstance(zone, dict):
            continue
        rows.append(
            {
                "id": str(zone.get("id") or f"zone-{index + 1}"),
                "name": str(zone.get("name") or ""),
                "reason": str(zone.get("reason") or "outdoor"),
                "area": _round_metric(max(0.0, _num(zone, "area", 0.0))),
            }
        )
    return rows


def _build_project_page(payload: Dict[str, Any], metrics: Dict[str, float]) -> Dict[str, Any]:
    inputs = payload.get("project") if isinstance(payload.get("project"), dict) else {}
    project_record = payload.get("projectRecord") if isinstance(payload.get("projectRecord"), dict) else {}
    region = _context_item(
        payload,
        "project",
        "climateRegion",
        CLIMATE_REGIONS,
        str(inputs.get("selected_region") or "REGION_A"),
        "REGION_A",
    )
    use_category = _context_item(
        payload,
        "project",
        "buildingUseCategory",
        USE_CATEGORIES,
        str(inputs.get("selected_use_category") or "USE_OFFICE"),
        "USE_OFFICE",
    )
    full_year_ac = use_category.get("fullYearAc") if isinstance(use_category.get("fullYearAc"), dict) else None
    if full_year_ac:
        use_category = {
            **use_category,
            "aeui": _metric_number(full_year_ac, "AEUI"),
            "leui": _metric_number(full_year_ac, "LEUI"),
            "eeui": _metric_number(full_year_ac, "EEUI"),
        }
    selected_es = _context_section(payload, "project").get("esValue")
    if selected_es is not None:
        use_category = {**use_category, "es": selected_es, "selectedEs": selected_es}
    exempt_areas = _safe_exempt_areas(inputs.get("exempt_areas"))
    total_exempt_area = sum(zone["area"] for zone in exempt_areas)
    requested_af = inputs.get("total_floor_area")
    try:
        af = float(requested_af) if requested_af is not None else float(metrics.get("estimatedFloorArea", 0.0))
    except (TypeError, ValueError):
        af = float(metrics.get("estimatedFloorArea", 0.0))
    af = max(0.0, af)
    afe = max(0.0, af - total_exempt_area)
    area_band = _context_section(payload, "project").get("areaBand")
    return {
        "source": use_category.get("source", "python_preview_tables"),
        "climateRegion": region,
        "buildingUseCategory": use_category,
        "projectRecord": project_record,
        "floorAreas": {
            "af": _round_metric(af),
            "afSource": "request.total_floor_area" if requested_af is not None else "geometry.estimatedFloorArea",
            "totalExemptAfk": _round_metric(total_exempt_area),
            "afe": _round_metric(afe),
            "exemptZones": exempt_areas,
            "formula": "AFe = AF - sum(Afk)",
        },
        "officialReferences": {
            "areaBand": area_band if isinstance(area_band, dict) else None,
            "appendix1Code": use_category.get("appendix1Code"),
            "selectedEs": selected_es,
            "table32Label": use_category.get("table32Label"),
            "ur": region.get("ur", 1.0),
            "warnings": use_category.get("warnings", []),
            "yohjHPerYr": use_category.get("yohjHPerYr"),
        },
        "availableOptions": {
            "climateRegions": _context_options(payload, "project", "climateRegions", CLIMATE_REGIONS),
            "buildingUseCategories": _context_options(payload, "project", "useCategories", USE_CATEGORIES),
        },
    }


def _build_envelope_page(payload: Dict[str, Any]) -> Dict[str, Any]:
    inputs = payload.get("envelope") if isinstance(payload.get("envelope"), dict) else {}
    wall = _context_item(payload, "envelope", "wallConstruction", WALL_CONSTRUCTIONS, str(inputs.get("selected_wall") or "CONS_WALL_RC_INS"), "CONS_WALL_RC_INS")
    roof = _context_item(payload, "envelope", "roofConstruction", ROOF_CONSTRUCTIONS, str(inputs.get("selected_roof") or "CONS_ROOF_RC_INS"), "CONS_ROOF_RC_INS")
    shading = _context_item(payload, "envelope", "shadingType", SHADING_TYPES, str(inputs.get("selected_shading") or "SH_OVERHANG"), "SH_OVERHANG")
    glazing = _context_item(payload, "envelope", "glazingType", GLAZING_TYPES, str(inputs.get("selected_glazing") or "GLZ_DBL_LOW_E"), "GLZ_DBL_LOW_E")
    wall_u = _metric_number(wall, "uValue", "U")
    roof_u = _metric_number(roof, "uValue", "U")
    ki = _metric_number(shading, "ki", "Ki", fallback=1.0)
    ug = _metric_number(glazing, "ug", "U")
    eta_i = _metric_number(glazing, "etaI", "eta_i", "eta")
    return {
        "source": "backend_lookup_context",
        "wallConstruction": wall,
        "roofConstruction": roof,
        "shadingType": shading,
        "glazingType": glazing,
        "summary": {
            "wallUValue": wall_u,
            "roofUValue": roof_u,
            "ki": ki,
            "ug": ug,
            "etaI": eta_i,
        },
        "availableOptions": {
            "wallConstructions": _context_options(payload, "envelope", "wallConstructions", WALL_CONSTRUCTIONS),
            "roofConstructions": _context_options(payload, "envelope", "roofConstructions", ROOF_CONSTRUCTIONS),
            "shadingTypes": _context_options(payload, "envelope", "shadingTypes", SHADING_TYPES),
            "glazingTypes": _context_options(payload, "envelope", "glazingTypes", GLAZING_TYPES),
        },
    }


def _build_mep_page(payload: Dict[str, Any]) -> Dict[str, Any]:
    inputs = payload.get("mep") if isinstance(payload.get("mep"), dict) else {}
    hvac = _context_item(payload, "mep", "hvacSystem", HVAC_SYSTEMS, str(inputs.get("selected_hvac") or "HVAC_VRF"), "HVAC_VRF")
    lighting = _context_item(payload, "mep", "lightingSystem", LIGHTING_SYSTEMS, str(inputs.get("selected_lighting") or "LGT_LED"), "LGT_LED")
    elevator = _context_item(payload, "mep", "elevatorType", ELEVATOR_TYPES, str(inputs.get("selected_elevator") or "ET_VVVF"), "ET_VVVF")
    dhw = _context_item(payload, "mep", "dhwSystem", DHW_SYSTEMS, str(inputs.get("selected_dhw") or "DHW_NONE"), "DHW_NONE")
    elevator_count = max(0, int(_num(inputs, "elevator_count", 4.0)))
    eac = _metric_number(hvac, "eac", "defaultEAC", "EAC_base", fallback=1.0)
    el = _metric_number(lighting, "el", "defaultEL", "EL_base", fallback=1.0)
    et = _metric_number(elevator, "et", "EtValue", fallback=1.0)
    ehw = _metric_number(dhw, "ehw", "EHW", fallback=0.0)
    return {
        "source": "backend_lookup_context",
        "hvacSystem": hvac,
        "lightingSystem": lighting,
        "elevatorSystem": {**elevator, "count": elevator_count},
        "dhwSystem": dhw,
        "summary": {
            "eac": eac,
            "el": el,
            "et": et,
            "ehw": ehw,
            "elevatorCount": elevator_count,
        },
        "availableOptions": {
            "hvacSystems": _context_options(payload, "mep", "hvacSystems", HVAC_SYSTEMS),
            "lightingSystems": _context_options(payload, "mep", "lightingSystems", LIGHTING_SYSTEMS),
            "elevatorTypes": _context_options(payload, "mep", "elevatorTypes", ELEVATOR_TYPES),
            "dhwSystems": _context_options(payload, "mep", "dhwSystems", DHW_SYSTEMS),
        },
    }


def _normalise_evc_evmin(ev: float, evc: float, evmin: float) -> float:
    if evc == evmin:
        return 0.0
    # CalcEngine formula: EEV = (EVc - EV) / (EVc - EVmin), capped at 1.0.
    # The full CalcEngine endpoint requires non-negative EEV, so clamp lower at 0 for live previews.
    return _clamp((evc - ev) / (evc - evmin), 0.0, 1.0)


def _glazing_thresholds_for_wwr(wwr: float) -> Dict[str, Any]:
    if wwr > 0.4:
        return {"evc": 3.5, "evmin": 1.8, "label": "窗平均熱傳透率Uaf（>40%）"}
    if wwr > 0.3:
        return {"evc": 3.5, "evmin": 1.8, "label": "窗平均熱傳透率Uaf（40%>=WWR>30%）"}
    if wwr > 0.2:
        return {"evc": 5.0, "evmin": 2.5, "label": "窗平均熱傳透率Uaf（30%>=WWR>20%）"}
    return {"evc": 5.5, "evmin": 2.8, "label": "窗平均熱傳透率Uaf（WWR<=20%）"}


def _shading_thresholds_for_wwr(wwr: float) -> Dict[str, Any]:
    if wwr > 0.5:
        return {"evc": 0.2, "evmin": 0.1, "label": "非住宿類建築窗平均遮陽係數SF（開窗率>50%）"}
    if wwr > 0.4:
        return {"evc": 0.3, "evmin": 0.15, "label": "非住宿類建築窗平均遮陽係數SF（50%>=WWR>40%）"}
    if wwr > 0.3:
        return {"evc": 0.4, "evmin": 0.2, "label": "非住宿類建築窗平均遮陽係數SF（40%>=WWR>30%）"}
    if wwr > 0.2:
        return {"evc": 0.5, "evmin": 0.25, "label": "非住宿類建築窗平均遮陽係數SF（30%>=WWR>20%）"}
    return {"evc": 0.6, "evmin": 0.3, "label": "非住宿類建築窗平均遮陽係數SF（WWR<=20%）"}


def _eelj_for_floors(average_floors: float) -> Dict[str, Any]:
    floors = max(1.0, average_floors)
    if floors <= 6:
        return {"floorBand": "2F-6F", "eelj": 3.49}
    if floors <= 16:
        return {"floorBand": "7F-16F", "eelj": 8.24}
    if floors <= 30:
        return {"floorBand": "17F-30F", "eelj": 9.42}
    return {"floorBand": "31F+", "eelj": 16.48}


def _calculate_eteui(elevator_count: int, eelj: float, yohj: float, afe: float) -> float:
    if afe <= 0:
        return 0.0
    return (0.6 * elevator_count * eelj * yohj) / afe


def _calculate_weights(aeui: float, leui: float, eteui: float) -> Dict[str, float]:
    denominator = aeui + leui + eteui
    if denominator <= 0:
        return {"a": 0.0, "b": 0.0, "c": 0.0}
    return {"a": aeui / denominator, "b": leui / denominator, "c": eteui / denominator}


def _calculate_score(eei: float) -> float:
    safe_eei = max(0.0, eei)
    if safe_eei <= 0.8:
        score = 50.0 + 40.0 * (0.8 - safe_eei) / 0.3
    else:
        score = 50.0 * (2.0 - safe_eei) / 1.2
    return _clamp(score, 0.0, 100.0)


def _calculate_scale_values(aeui: float, leui: float, eeui: float, eteui: float, ur: float, hpeui: float = 0.0) -> Dict[str, float]:
    base_sum = aeui + leui + eteui + hpeui
    return {
        "EUIn": ur * (0.5 * base_sum + eeui),
        "EUIg": ur * (0.8 * base_sum + eeui),
        "EUIm": ur * (1.0 * base_sum + eeui),
        "EUImax": ur * (2.0 * base_sum + eeui),
    }


def _calculate_indicators(score_eee: float, scale_values: Dict[str, float], beta1: float, cfn: float) -> Dict[str, Any]:
    eui_n = scale_values["EUIn"]
    eui_g = scale_values["EUIg"]
    eui_m = scale_values["EUIm"]
    eui_max = scale_values["EUImax"]
    if score_eee > 50.0:
        eui_star = eui_g - (score_eee - 50.0) * (eui_g - eui_n) / 40.0
        equation = "3.21a"
    else:
        eui_star = eui_g + (50.0 - score_eee) * (eui_max - eui_g) / 50.0
        equation = "3.21b"
    return {
        "EUI_star": eui_star,
        "CEI_star": eui_star * beta1,
        "TEUI": eui_star / cfn if cfn > 0 else 0.0,
        "ESR": (eui_m - eui_star) / eui_m if eui_m > 0 else 0.0,
        "EUI_star_equation": equation,
    }


def _grade_from_score(score_eee: float) -> Tuple[str, int]:
    score_display = int(round(score_eee))
    if score_display >= 90:
        return "1+", score_display
    if score_display >= 80:
        return "1", score_display
    if score_display >= 70:
        return "2", score_display
    if score_display >= 60:
        return "3", score_display
    if score_display >= 50:
        return "4", score_display
    if score_display >= 40:
        return "5", score_display
    if score_display >= 20:
        return "6", score_display
    return "7", score_display


def _calculate_grade(score_eee: float, eui_star: float, scale_values: Dict[str, float]) -> Dict[str, Any]:
    eui_n = scale_values["EUIn"]
    eui_g = scale_values["EUIg"]
    eui_max = scale_values["EUImax"]
    thresholds = {
        "1+": eui_n,
        "1": eui_n + (10.0 / 40.0) * (eui_g - eui_n),
        "2": eui_n + (20.0 / 40.0) * (eui_g - eui_n),
        "3": eui_n + (30.0 / 40.0) * (eui_g - eui_n),
        "4": eui_g,
        "5": eui_g + (10.0 / 50.0) * (eui_max - eui_g),
        "6": eui_g + (30.0 / 50.0) * (eui_max - eui_g),
    }
    grade_by_score, score_display = _grade_from_score(score_eee)
    if eui_star <= thresholds["1+"]:
        grade_by_eui = "1+"
    elif eui_star <= thresholds["1"]:
        grade_by_eui = "1"
    elif eui_star <= thresholds["2"]:
        grade_by_eui = "2"
    elif eui_star <= thresholds["3"]:
        grade_by_eui = "3"
    elif eui_star <= thresholds["4"]:
        grade_by_eui = "4"
    elif eui_star <= thresholds["5"]:
        grade_by_eui = "5"
    elif eui_star <= thresholds["6"]:
        grade_by_eui = "6"
    else:
        grade_by_eui = "7"
    return {
        "grade": grade_by_score,
        "scoreDisplay": score_display,
        "gradeByScore": grade_by_score,
        "gradeByEui": grade_by_eui,
        "euiThresholds": thresholds,
        "isGradeConsistent": grade_by_score == grade_by_eui,
    }


def _calculate_envelope_efficiency(envelope_page: Dict[str, Any], metrics: Dict[str, float]) -> Dict[str, Any]:
    summary = envelope_page.get("summary") if isinstance(envelope_page.get("summary"), dict) else {}
    wall_u = _metric_number(summary, "wallUValue", fallback=2.0)
    roof_u = _metric_number(summary, "roofUValue", fallback=0.8)
    ug = _metric_number(summary, "ug", fallback=3.5)
    eta_i = _metric_number(summary, "etaI", fallback=0.7)
    ki = _metric_number(summary, "ki", fallback=0.4)
    total_wall = _metric_number(metrics, "totalWallArea")
    total_window = _metric_number(metrics, "totalWindowArea")
    roof_area = _metric_number(metrics, "roofArea")
    opaque_wall_area = max(0.0, total_wall - total_window)
    wwr = _metric_number(metrics, "overallWwr")

    wall_baseline = {"evc": 2.0, "evmin": 1.0, "label": "外牆平均熱傳透率Uaw（非住宿類建築）"}
    roof_baseline = {"evc": 0.8, "evmin": 0.4, "label": "屋頂平均熱傳透率Uar（不分區）"}
    glazing_baseline = _glazing_thresholds_for_wwr(wwr)
    shading_baseline = _shading_thresholds_for_wwr(wwr)

    components = [
        {
            "id": "UAW",
            "label": wall_baseline["label"],
            "area": opaque_wall_area,
            "EV": wall_u,
            "EVc": wall_baseline["evc"],
            "EVmin": wall_baseline["evmin"],
            "EEV": _normalise_evc_evmin(wall_u, wall_baseline["evc"], wall_baseline["evmin"]),
            "source": "Technical.pdf Appendix 2 Table 1 Uaw; CalcEngine /calc/bersn/formulas/eev normalization",
        },
        {
            "id": "UAR",
            "label": roof_baseline["label"],
            "area": roof_area,
            "EV": roof_u,
            "EVc": roof_baseline["evc"],
            "EVmin": roof_baseline["evmin"],
            "EEV": _normalise_evc_evmin(roof_u, roof_baseline["evc"], roof_baseline["evmin"]),
            "source": "Technical.pdf Appendix 2 Table 1 Uar; CalcEngine /calc/bersn/formulas/eev normalization",
        },
        {
            "id": "UAF",
            "label": glazing_baseline["label"],
            "area": total_window,
            "EV": ug,
            "EVc": glazing_baseline["evc"],
            "EVmin": glazing_baseline["evmin"],
            "EEV": _normalise_evc_evmin(ug, glazing_baseline["evc"], glazing_baseline["evmin"]),
            "source": "Technical.pdf Appendix 2 Table 1 Uaf; CalcEngine /calc/bersn/formulas/eev normalization",
        },
        {
            "id": "SF",
            "label": shading_baseline["label"],
            "area": total_window,
            "EV": ki * eta_i,
            "EVc": shading_baseline["evc"],
            "EVmin": shading_baseline["evmin"],
            "EEV": _normalise_evc_evmin(ki * eta_i, shading_baseline["evc"], shading_baseline["evmin"]),
            "source": "Technical.pdf Appendix 2 Table 1 SF; ηi follows referenced building energy design standard",
        },
    ]

    weighted_area = sum(component["area"] for component in components if component["area"] > 0)
    eev = (
        sum(component["EEV"] * component["area"] for component in components if component["area"] > 0) / weighted_area
        if weighted_area > 0
        else 0.0
    )

    return {
        "EEV": _round_kpi(eev),
        "aggregation": "area_weighted_component_preview",
        "components": [
            {
                **component,
                "area": _round_metric(component["area"]),
                "EV": _round_kpi(component["EV"]),
                "EEV": _round_kpi(component["EEV"]),
            }
            for component in components
        ],
        "note": "Live CONFIG preview uses the same CalcEngine EEV normalization per component, then area-weights components so the page can react to geometry, wall, roof, glazing, and shading inputs.",
    }


def _calculate_performance(
    project_page: Dict[str, Any],
    envelope_page: Dict[str, Any],
    mep_page: Dict[str, Any],
    metrics: Dict[str, float],
) -> Dict[str, Any]:
    use_category = project_page.get("buildingUseCategory") if isinstance(project_page.get("buildingUseCategory"), dict) else {}
    region = project_page.get("climateRegion") if isinstance(project_page.get("climateRegion"), dict) else {}
    floor_areas = project_page.get("floorAreas") if isinstance(project_page.get("floorAreas"), dict) else {}
    mep_summary = mep_page.get("summary") if isinstance(mep_page.get("summary"), dict) else {}

    aeui = _metric_number(use_category, "aeui", "AEUI", fallback=120.0)
    leui = _metric_number(use_category, "leui", "LEUI", fallback=35.0)
    eeui = _metric_number(use_category, "eeui", "EEUI", fallback=8.0)
    es = _metric_number(use_category, "selectedEs", "es", "Es", fallback=0.15)
    ur = _metric_number(region, "ur", "UR", fallback=1.0)
    af = _metric_number(floor_areas, "af", fallback=_metric_number(metrics, "estimatedFloorArea"))
    afk_total = _metric_number(floor_areas, "totalExemptAfk")
    afe = max(1.0, _metric_number(floor_areas, "afe", fallback=af - afk_total))
    eac = _metric_number(mep_summary, "eac", fallback=1.0)
    el = _metric_number(mep_summary, "el", fallback=1.0)
    et = _metric_number(mep_summary, "et", fallback=1.0)
    elevator_count = int(max(0, _metric_number(mep_summary, "elevatorCount", fallback=0.0)))
    yohj = _metric_number(use_category, "yohjHPerYr", "YOHj", fallback=2500.0)
    eelj = _eelj_for_floors(_metric_number(metrics, "averageFloors", fallback=1.0))
    eteui = _calculate_eteui(elevator_count, eelj["eelj"], yohj, afe)
    weights = _calculate_weights(aeui, leui, eteui)
    envelope_efficiency = _calculate_envelope_efficiency(envelope_page, metrics)
    eev = _metric_number(envelope_efficiency, "EEV")
    eei = (
        weights["a"] * (eac - eev * es)
        + weights["b"] * el
        + weights["c"] * et
    )
    score = _calculate_score(eei)
    scale_values = _calculate_scale_values(aeui, leui, eeui, eteui, ur, hpeui=0.0)
    beta1 = 0.474
    cfn = 0.91
    indicators = _calculate_indicators(score, scale_values, beta1, cfn)
    grade = _calculate_grade(score, indicators["EUI_star"], scale_values)

    return {
        "source": "Backend Python reuses CalcEngine formula chain: /calc/bersn/formulas/general-full",
        "formulaVersion": "v1.0",
        "branchType": "GENERAL_NO_HOT_WATER",
        "kpis": {
            "eei": _round_kpi(eei),
            "score": _round_kpi(score),
            "grade": grade["grade"],
            "scoreDisplay": grade["scoreDisplay"],
            "esr": _round_kpi(indicators["ESR"] * 100.0),
            "esrRatio": _round_kpi(indicators["ESR"]),
            "afe": _round_metric(afe),
            "af": _round_metric(af),
            "afkTotal": _round_metric(afk_total),
            "euiStar": _round_kpi(indicators["EUI_star"]),
            "ceiStar": _round_kpi(indicators["CEI_star"]),
            "teui": _round_kpi(indicators["TEUI"]),
            "isNZCB": grade["grade"] == "1+" and indicators["ESR"] >= 0.5,
        },
        "inputsUsed": {
            "AF": _round_metric(af),
            "AFk_total_m2": _round_metric(afk_total),
            "AFe": _round_metric(afe),
            "AEUI": _round_kpi(aeui),
            "LEUI": _round_kpi(leui),
            "EEUI": _round_kpi(eeui),
            "UR": _round_kpi(ur),
            "Es": _round_kpi(es),
            "EAC": _round_kpi(eac),
            "EEV": _round_kpi(eev),
            "EL": _round_kpi(el),
            "Et": _round_kpi(et),
            "beta1": beta1,
            "CFn": cfn,
            "elevators": [
                {
                    "Nej": elevator_count,
                    "Eelj": eelj["eelj"],
                    "YOHj": yohj,
                    "floorBand": eelj["floorBand"],
                }
            ],
        },
        "outputs": {
            "EtEUI": _round_kpi(eteui),
            "weights": {key: _round_kpi(value) for key, value in weights.items()},
            "scaleValues": {key: _round_kpi(value) for key, value in scale_values.items()},
            "indicators": {
                "EUI_star": _round_kpi(indicators["EUI_star"]),
                "CEI_star": _round_kpi(indicators["CEI_star"]),
                "TEUI": _round_kpi(indicators["TEUI"]),
                "ESR": _round_kpi(indicators["ESR"]),
                "EUI_star_equation": indicators["EUI_star_equation"],
            },
            "gradeResult": grade,
            "envelopeEfficiency": envelope_efficiency,
        },
        "formulaTrace": [
            "AFe = AF - ΣAfk (Technical.pdf §3-2-1 / CalcEngine afe)",
            "EtEUI = 0.6 × Σ(Nej × Eelj × YOHj) / AFe (Eq. 3.2)",
            "a,b,c = AEUI,LEUI,EtEUI / (AEUI+LEUI+EtEUI) (Eq. 3.3-3.5)",
            "EEI = a×(EAC - EEV×Es) + b×EL + c×Et (Eq. 3.6)",
            "SCOREEE follows Eq. 3.16a/3.16b",
            "EUIn/EUIg/EUIm/EUImax follow Eq. 3.17-3.20",
            "EUI*, CEI*, TEUI, ESR follow Eq. 3.21-3.24",
            "Grade follows Technical.pdf §3-7 Table 3.4 / CalcEngine grade-general",
        ],
        "officialReferences": {
            "buildingUseCategory": use_category.get("source"),
            "climateRegion": region.get("source"),
            "wall": (envelope_page.get("wallConstruction") or {}).get("source") if isinstance(envelope_page.get("wallConstruction"), dict) else None,
            "roof": (envelope_page.get("roofConstruction") or {}).get("source") if isinstance(envelope_page.get("roofConstruction"), dict) else None,
            "glazing": (envelope_page.get("glazingType") or {}).get("source") if isinstance(envelope_page.get("glazingType"), dict) else None,
            "shading": (envelope_page.get("shadingType") or {}).get("source") if isinstance(envelope_page.get("shadingType"), dict) else None,
            "hvac": (mep_page.get("hvacSystem") or {}).get("source") if isinstance(mep_page.get("hvacSystem"), dict) else None,
            "lighting": (mep_page.get("lightingSystem") or {}).get("source") if isinstance(mep_page.get("lightingSystem"), dict) else None,
            "elevator": (mep_page.get("elevatorSystem") or {}).get("source") if isinstance(mep_page.get("elevatorSystem"), dict) else None,
        },
    }


def calculate_geometry_preview(payload: Dict[str, Any]) -> Dict[str, Any]:
    objects = payload.get("objects")
    if not isinstance(objects, list) or not objects:
        raise ValueError("objects must be a non-empty array")

    floor_height_m = float(payload.get("floor_height_m", 3.5) or 3.5)
    floor_height_m = floor_height_m if floor_height_m > 0 else 3.5
    envelope_page = _build_envelope_page(payload)
    selected_shading = envelope_page.get("shadingType") if isinstance(envelope_page.get("shadingType"), dict) else {}
    default_shading_coverage = _metric_number(
        selected_shading,
        "shadingCoverage",
        fallback=float(SHADING_COVERAGE.get(str(selected_shading.get("renderShadingType") or "None"), 0.0)),
    )

    totals = {
        "wallNorth": 0.0,
        "wallSouth": 0.0,
        "wallEast": 0.0,
        "wallWest": 0.0,
        "winNorth": 0.0,
        "winSouth": 0.0,
        "winEast": 0.0,
        "winWest": 0.0,
        "totalWallArea": 0.0,
        "totalWindowArea": 0.0,
        "roofArea": 0.0,
        "estimatedFloorArea": 0.0,
        "weightedShadingArea": 0.0,
        "weightedFloors": 0.0,
    }
    object_results: List[Dict[str, Any]] = []

    for index, obj in enumerate(objects):
        if not isinstance(obj, dict):
            raise ValueError(f"objects[{index}] must be an object")
        geometry_type = str(obj.get("type") or "box")
        params = obj.get("params") if isinstance(obj.get("params"), dict) else {}
        height = _positive(params, "height", 45.0)
        wwr = min(max(_num(params, "wwr", 0.35), 0.0), 0.99)
        shading_type = str(params.get("shadingType") or "None")
        shading_factor = float(SHADING_COVERAGE.get(shading_type, default_shading_coverage))

        walls, wall_area, roof_area = _shape_metrics(geometry_type, params)
        win_north = walls["wallNorth"] * wwr
        win_south = walls["wallSouth"] * wwr
        win_east = walls["wallEast"] * wwr
        win_west = walls["wallWest"] * wwr
        window_area = wall_area * wwr
        floors = max(1, int(round(height / floor_height_m)))
        floor_area = roof_area * floors

        totals["wallNorth"] += walls["wallNorth"]
        totals["wallSouth"] += walls["wallSouth"]
        totals["wallEast"] += walls["wallEast"]
        totals["wallWest"] += walls["wallWest"]
        totals["winNorth"] += win_north
        totals["winSouth"] += win_south
        totals["winEast"] += win_east
        totals["winWest"] += win_west
        totals["totalWallArea"] += wall_area
        totals["totalWindowArea"] += window_area
        totals["roofArea"] += roof_area
        totals["estimatedFloorArea"] += floor_area
        totals["weightedShadingArea"] += window_area * shading_factor
        totals["weightedFloors"] += floors * roof_area

        object_results.append(
            {
                "id": obj.get("id") or f"object-{index + 1}",
                "type": geometry_type,
                "metrics": {
                    "wallArea": _round_metric(wall_area),
                    "windowArea": _round_metric(window_area),
                    "roofArea": _round_metric(roof_area),
                    "estimatedFloorArea": _round_metric(floor_area),
                    "floors": floors,
                    "wwr": _round_metric(wwr),
                },
            }
        )

    total_wall = totals["totalWallArea"]
    total_window = totals["totalWindowArea"]
    roof_area = totals["roofArea"]
    average_floors = totals["weightedFloors"] / roof_area if roof_area > 0 else 0.0

    # --- Ki: actual BERSn shading coefficient (NOT effectiveShadingRatio) ---
    selected_ki = _metric_number(selected_shading, "ki", "Ki", fallback=1.0)

    metrics = {
        "wallNorth": _round_metric(totals["wallNorth"]),
        "wallSouth": _round_metric(totals["wallSouth"]),
        "wallEast": _round_metric(totals["wallEast"]),
        "wallWest": _round_metric(totals["wallWest"]),
        "winNorth": _round_metric(totals["winNorth"]),
        "winSouth": _round_metric(totals["winSouth"]),
        "winEast": _round_metric(totals["winEast"]),
        "winWest": _round_metric(totals["winWest"]),
        "totalWallArea": _round_metric(total_wall),
        "totalWindowArea": _round_metric(total_window),
        "roofArea": _round_metric(roof_area),
        "overallWwr": _round_metric(total_window / total_wall if total_wall > 0 else 0.0),
        # ki = actual BERSn Ki coefficient for EEV (e.g. 0.6 for Eggcrate)
        "ki": _round_kpi(selected_ki),
        # effectiveShadingRatio = area-weighted shading coverage ratio (0–1)
        "effectiveShadingRatio": _round_metric(
            totals["weightedShadingArea"] / total_window if total_window > 0 else 0.0
        ),
        "estimatedFloorArea": _round_metric(totals["estimatedFloorArea"]),
        "averageFloors": _round_metric(average_floors),
    }

    project_page = _build_project_page(payload, metrics)
    mep_page = _build_mep_page(payload)
    performance = _calculate_performance(project_page, envelope_page, mep_page, metrics)
    geometry_page = {
        "metrics": metrics,
        "objects": object_results,
    }

    # --- Build renderParams: inject selected envelope types into every shape ---
    # The 3-D viewer uses params.shadingType and params.glassType to render the
    # facade appearance. We override per-shape values with the globally selected
    # envelope settings so the view always reflects what the Envelope panel shows.

    # Map panel shading id → renderer ShadingType string
    render_shading_type = str(
        (selected_shading.get("renderShadingType") if isinstance(selected_shading, dict) else None)
        or "None"
    )

    # Map panel glazing id → renderer GlassType string expected by ThreeDViewer
    _GLAZING_TO_GLASS_TYPE: Dict[str, str] = {
        "GLZ_CLEAR":    "Single",
        "GLZ_TINT":     "Single",
        "GLZ_DBL":      "Double",
        "GLZ_DBL_LOW_E":"Double",
        "GLZ_TRIPLE":   "Triple-LowE",
        "GLZ_VACUUM":   "Vacuum",
    }
    envelope_glazing = envelope_page.get("glazingType") if isinstance(envelope_page.get("glazingType"), dict) else {}
    glazing_id = str(envelope_glazing.get("id") or "GLZ_DBL_LOW_E")
    render_glass_type = _GLAZING_TO_GLASS_TYPE.get(glazing_id, "Double")

    render_objects: List[Dict[str, Any]] = []
    for obj in objects:
        obj_params = dict(obj.get("params", {})) if isinstance(obj.get("params"), dict) else {}
        obj_params["shadingType"] = render_shading_type
        obj_params["glassType"]   = render_glass_type
        render_objects.append({**obj, "params": obj_params})

    return {
        "project": project_page,
        "envelope": envelope_page,
        "mep": mep_page,
        "performance": performance,
        "geometry": geometry_page,
        "metrics": metrics,
        "objects": object_results,
        "renderParams": {
            "objects": render_objects,
        },
    }


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
        result = calculate_geometry_preview(payload)
        sys.stdout.write(json.dumps({"ok": True, **result}, ensure_ascii=False))
        return 0
    except Exception as exc:  # pragma: no cover - command boundary
        sys.stdout.write(
            json.dumps(
                {
                    "ok": False,
                    "error_code": "BERSN_GEOMETRY_PREVIEW_FAILED",
                    "message": str(exc),
                },
                ensure_ascii=False,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
