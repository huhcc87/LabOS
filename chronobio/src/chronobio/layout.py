"""Deterministic graph layout, computed once so the time slider never moves nodes.

Each connected cluster is laid out on its own (Fruchterman-Reingold, pure
Python) inside a box sized to its node count, then the boxes are packed into
rows. Laying clusters out separately matters: one global force layout pushes
unrelated clusters far apart, which squeezes every cluster's own nodes on top
of each other. Same input + seed always gives the same output.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

Point = tuple[float, float]

MIN_NODE_GAP = 74            # px between node centres (labels need room)
BOX_PER_NODE = 120           # box side grows with sqrt(cluster size)


@dataclass(frozen=True)
class Layout:
    pos: dict[str, Point]
    width: int
    height: int              # figure drawing area; legends are added below it


def components(node_ids: list[str], edges: list[tuple[str, str]]) -> list[list[str]]:
    parent = {n: n for n in node_ids}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for a, b in edges:
        if a in parent and b in parent:
            parent[find(a)] = find(b)
    groups: dict[str, list[str]] = {}
    for n in sorted(parent):
        groups.setdefault(find(n), []).append(n)
    return sorted(groups.values(), key=lambda g: (-len(g), g[0]))


def _force_layout(ids: list[str], edges: list[tuple[str, str]], seed: int, iterations: int) -> list[list[float]]:
    n = len(ids)
    rng = random.Random(seed)
    index = {nid: i for i, nid in enumerate(ids)}
    pos = [[math.cos(2 * math.pi * i / n) + rng.uniform(-.01, .01),
            math.sin(2 * math.pi * i / n) + rng.uniform(-.01, .01)] for i in range(n)]
    pairs = {(index[a], index[b]) for a, b in edges if a in index and b in index and a != b}
    k = math.sqrt(4.0 / n)
    temp = 0.4
    for _ in range(iterations):
        disp = [[0.0, 0.0] for _ in range(n)]
        for i in range(n):
            for j in range(i + 1, n):
                dx, dy = pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]
                dist = math.hypot(dx, dy) or 1e-6
                force = k * k / dist
                fx, fy = dx / dist * force, dy / dist * force
                disp[i][0] += fx; disp[i][1] += fy
                disp[j][0] -= fx; disp[j][1] -= fy
        for a, b in pairs:
            dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
            dist = math.hypot(dx, dy) or 1e-6
            force = dist * dist / k
            fx, fy = dx / dist * force, dy / dist * force
            disp[a][0] -= fx; disp[a][1] -= fy
            disp[b][0] += fx; disp[b][1] += fy
        for i in range(n):
            length = math.hypot(*disp[i]) or 1e-6
            step = min(length, temp)
            pos[i][0] += disp[i][0] / length * step
            pos[i][1] += disp[i][1] / length * step
        temp = max(temp * 0.97, 0.005)
    return pos


def _separate(points: list[list[float]], box_w: float, box_h: float, pad: float) -> None:
    """Push apart any two nodes closer than MIN_NODE_GAP, keeping them inside the box."""
    for _ in range(60):
        moved = False
        for i in range(len(points)):
            for j in range(i + 1, len(points)):
                dx, dy = points[j][0] - points[i][0], points[j][1] - points[i][1]
                dist = math.hypot(dx, dy)
                if dist >= MIN_NODE_GAP:
                    continue
                if dist < 1e-6:
                    dx, dy, dist = 1.0, 0.0, 1.0
                push = (MIN_NODE_GAP - dist) / 2 + 0.5
                points[i][0] -= dx / dist * push; points[i][1] -= dy / dist * push
                points[j][0] += dx / dist * push; points[j][1] += dy / dist * push
                moved = True
        for p in points:
            p[0] = min(max(p[0], pad), box_w - pad)
            p[1] = min(max(p[1], pad), box_h - pad)
        if not moved:
            return


def _cluster(ids: list[str], edges: list[tuple[str, str]], seed: int, iterations: int) -> tuple[list[list[float]], float, float]:
    """Positions inside their own (0,0)-(w,h) box, plus the box size."""
    m = len(ids)
    pad = 42.0
    if m == 1:
        return [[60.0, 45.0]], 120.0, 90.0
    if m == 2:
        return [[pad, 45.0], [pad + 150.0, 45.0]], 150.0 + 2 * pad, 90.0
    side = max(220.0, BOX_PER_NODE * math.sqrt(m))
    raw = _force_layout(ids, edges, seed, iterations)
    xs, ys = [p[0] for p in raw], [p[1] for p in raw]
    sx, sy = (max(xs) - min(xs)) or 1.0, (max(ys) - min(ys)) or 1.0
    pts = [[pad + (p[0] - min(xs)) / sx * (side - 2 * pad), pad + (p[1] - min(ys)) / sy * (side - 2 * pad)] for p in raw]
    _separate(pts, side, side, pad)
    return pts, side, side


def layout(
    node_ids: list[str], edges: list[tuple[str, str]], *,
    width: int = 960, margin: int = 36, gap: int = 24, iterations: int = 250, seed: int = 7,
) -> Layout:
    ids = sorted(set(node_ids))
    if not ids:
        return Layout({}, width, 480)
    pos: dict[str, Point] = {}
    x = y = float(margin)
    row_h = 0.0
    for cluster in components(ids, edges):
        members = set(cluster)
        pts, w, h = _cluster(cluster, [(a, b) for a, b in edges if a in members and b in members], seed, iterations)
        if x > margin and x + w > width - margin:           # wrap to the next shelf
            x, y, row_h = float(margin), y + row_h + gap, 0.0
        for nid, (px, py) in zip(cluster, pts):
            pos[nid] = (x + px, y + py)
        x += w + gap
        row_h = max(row_h, h)
    return Layout(pos, width, max(480, int(y + row_h + margin)))
