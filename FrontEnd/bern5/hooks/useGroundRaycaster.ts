import { useCallback, useRef } from 'react';
import * as THREE from 'three';

interface Options {
  snap: boolean;
  gridSize: number;
  maxDistance?: number;
  /** Y-coordinate of the horizontal plane to raycast against. Defaults to 0. */
  planeY?: number;
}

export interface GroundRaycaster {
  /** Returns world point on y=0, snapped to grid if `snap: true` in opts. */
  project: (event: PointerEvent | MouseEvent, dom: HTMLElement, camera: THREE.Camera) => { x: number; z: number } | null;
  /** Returns world point on y=0 WITHOUT grid snapping (raw raycast). */
  projectRaw: (event: PointerEvent | MouseEvent, dom: HTMLElement, camera: THREE.Camera) => { x: number; z: number } | null;
}

export function useGroundRaycaster(opts: Options): GroundRaycaster {
  const raycaster = useRef(new THREE.Raycaster());
  const ndc = useRef(new THREE.Vector2());
  // The plane normal is +Y; constant is -planeY so the plane is at y=planeY.
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const hit = useRef(new THREE.Vector3());
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const projectRaw = useCallback((event: PointerEvent | MouseEvent, dom: HTMLElement, camera: THREE.Camera) => {
    const rect = dom.getBoundingClientRect();
    ndc.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(ndc.current, camera);
    const planeY = optsRef.current.planeY ?? 0;
    plane.current.set(new THREE.Vector3(0, 1, 0), -planeY);
    const ok = raycaster.current.ray.intersectPlane(plane.current, hit.current);
    if (!ok) return null;
    const max = optsRef.current.maxDistance ?? 500;
    if (hit.current.length() > max) return null;
    return { x: hit.current.x, z: hit.current.z };
  }, []);

  const project = useCallback((event: PointerEvent | MouseEvent, dom: HTMLElement, camera: THREE.Camera) => {
    const raw = projectRaw(event, dom, camera);
    if (!raw) return null;
    if (!optsRef.current.snap) return raw;
    const g = optsRef.current.gridSize;
    return { x: Math.round(raw.x / g) * g, z: Math.round(raw.z / g) * g };
  }, [projectRaw]);

  return { project, projectRaw };
}
