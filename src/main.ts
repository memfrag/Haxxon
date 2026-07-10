import '../style.css';
import * as THREE from 'three';
import { CAMERA, COLORS, FOG_NEAR, FOG_FAR } from './config';
import { loadAll } from './core/assets';
import { startLoop } from './core/loop';
import { Director } from './game/director';
import { World } from './game/world';
import { Player } from './game/player';
import { Bullets } from './game/bullets';
import { Aircraft } from './game/aircraft';
import { Fx } from './game/fx';
import { Hud } from './game/hud';
import { Audio } from './game/audio';
import { Game } from './game/game';

function makeStarfield(): THREE.Points {
  const N = 900;
  const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    positions[i * 3 + 0] = Math.random() * 240 - 120;
    positions[i * 3 + 1] = Math.random() * 95 - 70;
    positions[i * 3 + 2] = Math.random() * 200 - 160;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: COLORS.STARS, size: 2, sizeAttenuation: false });
  const stars = new THREE.Points(geo, mat);
  stars.frustumCulled = false;
  return stars;
}

(async () => {
  const hud = new Hud();
  try {
    const app = document.getElementById('app')!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    app.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.BG);
    scene.fog = new THREE.Fog(COLORS.FOG, FOG_NEAR, FOG_FAR);

    const h = CAMERA.VIEW_HEIGHT;
    let aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.OrthographicCamera(
      (-h * aspect) / 2, (h * aspect) / 2, h / 2, -h / 2, CAMERA.NEAR, CAMERA.FAR,
    );
    camera.position.set(CAMERA.OFFSET.x, CAMERA.OFFSET.y, CAMERA.OFFSET.z);
    camera.lookAt(CAMERA.LOOK_AT.x, CAMERA.LOOK_AT.y, CAMERA.LOOK_AT.z);

    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      aspect = window.innerWidth / window.innerHeight;
      camera.left = (-h * aspect) / 2;
      camera.right = (h * aspect) / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
    });

    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x30281e, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(15, 30, 10);
    scene.add(dir);

    scene.add(makeStarfield());

    await loadAll((frac) => hud.setLoading(frac));
    hud.hide('loading');

    const director = new Director();
    const world = new World(director);
    scene.add(world.group);

    const player = new Player(scene);
    const bullets = new Bullets(scene);
    const aircraft = new Aircraft(scene);
    const fx = new Fx(scene);
    const audio = new Audio();

    const game = new Game(scene, world, director, player, bullets, aircraft, fx, hud, audio);
    game.showTitle();

    startLoop((dt) => game.update(dt), () => renderer.render(scene, camera));
  } catch (err) {
    const box = document.getElementById('overlay-loading');
    if (box) {
      box.innerHTML = '<h1>ERROR</h1><pre style="color:#ff8080;max-width:80vw;white-space:pre-wrap">'
        + String((err as Error)?.stack || err) + '</pre>';
    }
    // eslint-disable-next-line no-console
    console.error(err);
  }
})();
