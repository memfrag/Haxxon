import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const MANIFEST = {
  ship:        { file: 'craft_speederA', yaw: 0, scale: 0.55 },
  racer:       { file: 'craft_racer',    yaw: 0,       scale: 0.6 },
  turret:      { file: 'turret_single',  scale: 1.2 },
  turretDouble:{ file: 'turret_double',  scale: 1.2 },
  barrel:      { file: 'barrel',         scale: 1.8 },
  barrels:     { file: 'barrels',        scale: 1.3 },
  silo:        { file: 'rocket_fuelB',   scale: 1.4 },
  wall:        { file: 'corridor_windowClosed' },
  wallRoof:    { file: 'corridor_roof' },
  gate:        { file: 'gate_complex',   scale: 2.2 },
  dish:        { file: 'satelliteDish_large' },
  generator:   { file: 'machine_generatorLarge' },
  hangar:      { file: 'hangar_smallA' },
  chimney:     { file: 'chimney' },
  pipe:        { file: 'pipe_straight' },
  structure:   { file: 'structure_detailed' },
  crater:      { file: 'craterLarge' },
  craterSmall: { file: 'crater' },
  rocksSmall:  { file: 'rocks_smallA' },
  rocksSmallB: { file: 'rocks_smallB' },
  rock:        { file: 'rock' },
  rockLargeB:  { file: 'rock_largeB' },
  ground:      { file: 'terrain' },
  road:        { file: 'terrain_roadStraight' },
  roadCorner:  { file: 'terrain_roadCorner' },
  meteor:      { file: 'meteor' },
  meteorB:     { file: 'meteor_detailed' },
  meteorHalf:  { file: 'meteor_half' },
  rockLarge:   { file: 'rock_largeA' },
  platformLow: { file: 'platform_low' },
  rocketBase:  { file: 'rocket_baseA' },
  rocketSides: { file: 'rocket_sidesA' },
  rocketTop:   { file: 'rocket_topA' },
} as const;

export type ModelName = keyof typeof MANIFEST;

interface PrepDef { yaw?: number; scale?: number }

const protos = new Map<ModelName, THREE.Group>();

function prepare(scene: THREE.Object3D, def: PrepDef): THREE.Group {
  const box = new THREE.Box3().setFromObject(scene);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  scene.position.set(-cx, -box.min.y, -cz);   // footprint center -> origin, base -> y=0
  const inner = new THREE.Group();
  inner.add(scene);
  if (def.yaw) inner.rotation.y = def.yaw;
  inner.scale.setScalar(def.scale ?? 1);
  const wrapper = new THREE.Group();
  wrapper.add(inner);
  return wrapper;
}

export async function loadAll(onProgress: (frac: number) => void): Promise<void> {
  const loader = new GLTFLoader();
  const names = Object.keys(MANIFEST) as ModelName[];
  const total = names.length;
  let done = 0;
  await Promise.all(names.map(async (name) => {
    const def = MANIFEST[name] as PrepDef & { file: string };
    // BASE_URL respects Vite's configured base so models resolve under a GitHub Pages subpath.
    const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${def.file}.glb`);
    protos.set(name, prepare(gltf.scene, def));
    done++;
    onProgress(done / total);
  }));
}

export function clone(name: ModelName): THREE.Group {
  const proto = protos.get(name);
  if (!proto) throw new Error('asset not loaded: ' + name);
  return proto.clone(true);
}
