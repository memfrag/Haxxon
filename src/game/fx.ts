import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface Flash {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  targetScale: number;
}

const PART_COLORS = [0xffb347, 0xff6b35, 0xe8e8e8, 0x6b6b6b];
const partGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);

export class Fx {
  private particles: Particle[] = [];
  private flashes: Flash[] = [];

  constructor(private scene: THREE.Scene) {}

  explode(pos: THREE.Vector3 | { x: number; y: number; z: number }, big: boolean): void {
    const count = big ? 22 : 14;
    for (let i = 0; i < count; i++) {
      const color = PART_COLORS[Math.floor(Math.random() * PART_COLORS.length)];
      const mesh = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color }));
      mesh.position.set(pos.x, pos.y, pos.z);
      const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
        .normalize().multiplyScalar(2 + Math.random() * 4);
      dir.y += 1 + Math.random() * 3;
      this.scene.add(mesh);
      this.particles.push({ mesh, vel: dir, life: 0.9, maxLife: 0.9 });
    }
    const flashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true }),
    );
    flashMesh.position.set(pos.x, pos.y, pos.z);
    this.scene.add(flashMesh);
    this.flashes.push({ mesh: flashMesh, life: 0.25, maxLife: 0.25, targetScale: big ? 9 : 6 });
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.life -= dt;
      const s = Math.max(0.01, p.life / p.maxLife);
      p.mesh.scale.setScalar(s);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      const frac = 1 - Math.max(0, f.life) / f.maxLife;
      f.mesh.scale.setScalar(1 + frac * f.targetScale);
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - frac);
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        (f.mesh.material as THREE.Material).dispose();
        this.flashes.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const p of this.particles) { this.scene.remove(p.mesh); (p.mesh.material as THREE.Material).dispose(); }
    for (const f of this.flashes) { this.scene.remove(f.mesh); (f.mesh.material as THREE.Material).dispose(); }
    this.particles = [];
    this.flashes = [];
  }
}
