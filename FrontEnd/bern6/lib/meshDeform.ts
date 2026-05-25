// Bounding-box cage deformation for shape meshes.
//
// Approach: when 變形 starts on a shape, we BAKE the current parametric mesh
// (whatever buildShapeMesh produced) into a plain BufferGeometry snapshot
// stored on `shape.params.bakedGeometry`. From that moment on the renderer
// rebuilds the shape from the baked positions instead of the parametric
// definition — so a literal per-vertex remap survives subsequent renders.
//
// The cage drag updates the snapshot's positions array directly via the
// normalize-then-remap formula (Y is preserved):
//   nx = (x - originalBboxMinX) / originalBboxWidth
//   newX = newBboxMinX + nx * newBboxWidth
// Same for Z. The "original" bbox is captured ONCE at bake time so successive
// drags stay numerically stable.
//
// This module is pure utility — no Three.js scene side-effects beyond
// reading from a Group and producing/applying number arrays.

import * as THREE from 'three';

export interface BakedMeshEntry {
  childIndex: number;
  positions: number[];
  indices?: number[];
  normals?: number[];
  uvs?: number[];
}

export interface BakedGeometry {
  meshes: BakedMeshEntry[];
  originalBboxXZ: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/**
 * Snapshot every Mesh in `group` into a baked geometry record. Walks children
 * in their natural order so `childIndex` aligns with the same slot when the
 * group is rebuilt later (materials live on the rebuild side, indexed by
 * childIndex).
 */
export function bakeShapeGroup(group: THREE.Group): BakedGeometry {
  const meshes: BakedMeshEntry[] = [];
  let minX = +Infinity, maxX = -Infinity, minZ = +Infinity, maxZ = -Infinity;

  group.children.forEach((child, i) => {
    if (!(child instanceof THREE.Mesh)) return;
    const geo = child.geometry as THREE.BufferGeometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!posAttr) return;
    // World-space vertex (account for child local position e.g. mesh.position.y = h/2)
    const posArr = Array.from(posAttr.array as Float32Array);
    const local = new THREE.Vector3();
    for (let v = 0; v < posArr.length; v += 3) {
      local.set(posArr[v], posArr[v + 1], posArr[v + 2]);
      child.localToWorld(local);
      // Re-localize relative to GROUP (not world) so the bake stays valid
      // regardless of the shape's position/rotation in the world.
      group.worldToLocal(local);
      posArr[v]     = local.x;
      posArr[v + 1] = local.y;
      posArr[v + 2] = local.z;
      if (local.x < minX) minX = local.x;
      if (local.x > maxX) maxX = local.x;
      if (local.z < minZ) minZ = local.z;
      if (local.z > maxZ) maxZ = local.z;
    }
    const normalAttr = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const uvAttr     = geo.getAttribute('uv')     as THREE.BufferAttribute | undefined;
    const idxAttr    = geo.getIndex();
    meshes.push({
      childIndex: i,
      positions: posArr,
      normals: normalAttr ? Array.from(normalAttr.array as Float32Array) : undefined,
      uvs:     uvAttr     ? Array.from(uvAttr.array as Float32Array)     : undefined,
      indices: idxAttr    ? Array.from(idxAttr.array as Uint16Array | Uint32Array) : undefined,
    });
  });

  if (!Number.isFinite(minX)) { minX = -1; maxX = 1; minZ = -1; maxZ = 1; }
  return { meshes, originalBboxXZ: { minX, maxX, minZ, maxZ } };
}

/**
 * Re-emit a baked snapshot as a fresh THREE.Group whose children are
 * Meshes (one per baked entry) using the supplied materials list (indexed
 * by entry order). The result is functionally a parametric-free clone of the
 * original shape group.
 */
export function buildBakedGroup(baked: BakedGeometry, materials: THREE.Material[]): THREE.Group {
  const group = new THREE.Group();
  baked.meshes.forEach((entry, i) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(entry.positions, 3));
    if (entry.uvs)     geo.setAttribute('uv',     new THREE.Float32BufferAttribute(entry.uvs, 2));
    if (entry.normals) geo.setAttribute('normal', new THREE.Float32BufferAttribute(entry.normals, 3));
    if (entry.indices) geo.setIndex(entry.indices);
    // Recompute normals if none stored (post-deform we explicitly null them
    // so this branch fires).
    if (!entry.normals) geo.computeVertexNormals();
    const mat = materials[i] ?? materials[0] ?? new THREE.MeshPhongMaterial({ color: 0xcccccc });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
  });
  return group;
}

/**
 * Apply bbox-cage normalization-and-remap to a baked snapshot, returning a
 * NEW snapshot (immutable update). Y coords pass through untouched. Normals
 * are dropped so they're recomputed from the new positions on rebuild.
 */
export function applyBboxDeform(
  baked: BakedGeometry,
  newBbox: { minX: number; maxX: number; minZ: number; maxZ: number },
): BakedGeometry {
  const { minX: oMinX, maxX: oMaxX, minZ: oMinZ, maxZ: oMaxZ } = baked.originalBboxXZ;
  const oW = oMaxX - oMinX || 1;
  const oD = oMaxZ - oMinZ || 1;
  const nW = newBbox.maxX - newBbox.minX;
  const nD = newBbox.maxZ - newBbox.minZ;

  return {
    originalBboxXZ: baked.originalBboxXZ,  // never mutate the reference bbox
    meshes: baked.meshes.map(entry => {
      const newPositions = new Array(entry.positions.length);
      for (let i = 0; i < entry.positions.length; i += 3) {
        const x = entry.positions[i];
        const y = entry.positions[i + 1];
        const z = entry.positions[i + 2];
        const nx = (x - oMinX) / oW;
        const nz = (z - oMinZ) / oD;
        newPositions[i]     = newBbox.minX + nx * nW;
        newPositions[i + 1] = y;
        newPositions[i + 2] = newBbox.minZ + nz * nD;
      }
      return {
        ...entry,
        positions: newPositions,
        normals: undefined,  // force recompute on rebuild
      };
    }),
  };
}
