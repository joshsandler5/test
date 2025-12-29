import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x080b16, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1020, 30, 220);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);

const ambient = new THREE.AmbientLight(0x9bb8ff, 0.35);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0x9ecbff, 1.1);
sun.position.set(30, 60, 20);
scene.add(sun);

const skyGeo = new THREE.SphereGeometry(220, 32, 32);
const skyMat = new THREE.MeshBasicMaterial({
  color: 0x070b1c,
  side: THREE.BackSide,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

const groundGeo = new THREE.PlaneGeometry(300, 300);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x101a2b,
  metalness: 0.2,
  roughness: 0.8,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const platformMat = new THREE.MeshStandardMaterial({
  color: 0x1d2c4d,
  metalness: 0.3,
  roughness: 0.4,
  emissive: 0x0a132b,
  emissiveIntensity: 0.4,
});

const platforms = [];
for (let i = 0; i < 45; i += 1) {
  const width = THREE.MathUtils.randFloat(6, 18);
  const depth = THREE.MathUtils.randFloat(6, 18);
  const height = THREE.MathUtils.randFloat(2, 10);
  const geo = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geo, platformMat);
  const angle = (i / 45) * Math.PI * 2;
  const radius = THREE.MathUtils.randFloat(25, 110);
  mesh.position.set(
    Math.cos(angle) * radius + THREE.MathUtils.randFloat(-8, 8),
    height * 0.5 + THREE.MathUtils.randFloat(2, 18),
    Math.sin(angle) * radius + THREE.MathUtils.randFloat(-8, 8)
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  platforms.push(mesh);
}

const spawnPlatform = new THREE.Mesh(
  new THREE.BoxGeometry(18, 4, 18),
  new THREE.MeshStandardMaterial({ color: 0x2a3b63, roughness: 0.5 })
);
spawnPlatform.position.set(0, 3, 0);
scene.add(spawnPlatform);
platforms.push(spawnPlatform);

const glowOrbs = [];
const orbGeo = new THREE.SphereGeometry(1.4, 16, 16);
const orbMat = new THREE.MeshStandardMaterial({
  color: 0x2bc0ff,
  emissive: 0x48e6ff,
  emissiveIntensity: 1.8,
  metalness: 0.2,
  roughness: 0.1,
});
for (let i = 0; i < 18; i += 1) {
  const orb = new THREE.Mesh(orbGeo, orbMat);
  orb.position.set(
    THREE.MathUtils.randFloatSpread(140),
    THREE.MathUtils.randFloat(8, 32),
    THREE.MathUtils.randFloatSpread(140)
  );
  const orbLight = new THREE.PointLight(0x55d7ff, 0.8, 30);
  orb.add(orbLight);
  scene.add(orb);
  glowOrbs.push(orb);
}

const starsGeo = new THREE.BufferGeometry();
const starCount = 500;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i += 1) {
  starPositions[i * 3] = THREE.MathUtils.randFloatSpread(300);
  starPositions[i * 3 + 1] = THREE.MathUtils.randFloat(40, 160);
  starPositions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(300);
}
starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const starsMat = new THREE.PointsMaterial({
  color: 0x9cc8ff,
  size: 0.7,
  transparent: true,
  opacity: 0.7,
});
const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

const player = {
  height: 2,
  position: new THREE.Vector3(0, 8, 8),
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  onGround: false,
};

const controls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  jump: false,
};

const overlay = document.getElementById("overlay");
const speedDisplay = document.getElementById("speed");

let yaw = 0;
let pitch = 0;

const raycaster = new THREE.Raycaster();
const grapple = {
  active: false,
  anchor: new THREE.Vector3(),
  restLength: 0,
  strength: 45,
  maxDistance: 80,
};

const grappleLineMat = new THREE.LineBasicMaterial({
  color: 0x7fe0ff,
  transparent: true,
  opacity: 0.9,
});
const grappleLineGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(),
  new THREE.Vector3(),
]);
const grappleLine = new THREE.Line(grappleLineGeo, grappleLineMat);
grappleLine.visible = false;
scene.add(grappleLine);

function lockPointer() {
  document.body.requestPointerLock();
}

overlay.addEventListener("click", () => {
  lockPointer();
});

document.addEventListener("pointerlockchange", () => {
  overlay.classList.toggle("hidden", document.pointerLockElement === document.body);
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== document.body) {
    return;
  }
  const sensitivity = 0.0022;
  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;
  pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
});

document.addEventListener("keydown", (event) => {
  if (event.code === "KeyW") controls.forward = true;
  if (event.code === "KeyS") controls.backward = true;
  if (event.code === "KeyA") controls.left = true;
  if (event.code === "KeyD") controls.right = true;
  if (event.code === "ShiftLeft") controls.sprint = true;
  if (event.code === "Space") controls.jump = true;
});

document.addEventListener("keyup", (event) => {
  if (event.code === "KeyW") controls.forward = false;
  if (event.code === "KeyS") controls.backward = false;
  if (event.code === "KeyA") controls.left = false;
  if (event.code === "KeyD") controls.right = false;
  if (event.code === "ShiftLeft") controls.sprint = false;
  if (event.code === "Space") controls.jump = false;
});

window.addEventListener("mousedown", () => {
  if (document.pointerLockElement !== document.body) {
    return;
  }
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects([...platforms, ground], false);
  if (hits.length > 0) {
    const hit = hits[0];
    if (hit.distance <= grapple.maxDistance) {
      grapple.active = true;
      grapple.anchor.copy(hit.point);
      grapple.restLength = Math.max(6, hit.distance * 0.65);
      grappleLine.visible = true;
    }
  }
});

window.addEventListener("mouseup", () => {
  grapple.active = false;
  grappleLine.visible = false;
});

function updateMovement(delta) {
  const speed = controls.sprint ? 18 : 12;
  const acceleration = controls.sprint ? 38 : 26;
  player.direction.set(0, 0, 0);
  if (controls.forward) player.direction.z -= 1;
  if (controls.backward) player.direction.z += 1;
  if (controls.left) player.direction.x -= 1;
  if (controls.right) player.direction.x += 1;
  if (player.direction.lengthSq() > 0) {
    player.direction.normalize();
    const moveAngle = Math.atan2(player.direction.x, player.direction.z) + yaw;
    const moveVector = new THREE.Vector3(
      Math.sin(moveAngle),
      0,
      Math.cos(moveAngle)
    );
    const accel = moveVector.multiplyScalar(acceleration * delta);
    player.velocity.add(accel);
  }

  const horizontalVelocity = new THREE.Vector3(player.velocity.x, 0, player.velocity.z);
  const horizontalSpeed = horizontalVelocity.length();
  if (!grapple.active && horizontalSpeed > speed) {
    horizontalVelocity.setLength(speed);
    player.velocity.x = horizontalVelocity.x;
    player.velocity.z = horizontalVelocity.z;
  }

  const friction = player.onGround ? 10 : 2.5;
  player.velocity.x -= player.velocity.x * friction * delta;
  player.velocity.z -= player.velocity.z * friction * delta;

  player.velocity.y -= 28 * delta;

  if (controls.jump && player.onGround) {
    player.velocity.y = 12;
    player.onGround = false;
  }

  if (grapple.active) {
    const toAnchor = grapple.anchor.clone().sub(player.position);
    const distance = toAnchor.length();
    if (distance > 1) {
      const stretch = Math.max(0, distance - grapple.restLength);
      const pullStrength =
        grapple.strength * (stretch / grapple.maxDistance) + 8;
      const pull = toAnchor.normalize().multiplyScalar(pullStrength * delta);
      player.velocity.add(pull);
      const swingBoost = new THREE.Vector3(-pull.z, 0, pull.x).multiplyScalar(
        0.8 * delta
      );
      player.velocity.add(swingBoost);
    }
  }

  player.position.add(player.velocity.clone().multiplyScalar(delta));

  if (player.position.y < player.height) {
    player.position.y = player.height;
    player.velocity.y = Math.max(0, player.velocity.y);
    player.onGround = true;
  }

  for (const platform of platforms) {
    const bounds = new THREE.Box3().setFromObject(platform);
    if (bounds.containsPoint(player.position)) {
      player.position.y = bounds.max.y + player.height;
      player.velocity.y = Math.max(0, player.velocity.y);
      player.onGround = true;
    }
  }
}

function updateCamera() {
  camera.position.copy(player.position);
  camera.rotation.set(pitch, yaw, 0, "YXZ");
}

function updateHUD() {
  const speed = Math.round(
    Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2)
  );
  speedDisplay.textContent = `Speed: ${speed}`;
}

function updateGrappleLine() {
  if (!grapple.active) {
    return;
  }
  const positions = grappleLine.geometry.attributes.position.array;
  positions[0] = player.position.x;
  positions[1] = player.position.y - 0.2;
  positions[2] = player.position.z;
  positions[3] = grapple.anchor.x;
  positions[4] = grapple.anchor.y;
  positions[5] = grapple.anchor.z;
  grappleLine.geometry.attributes.position.needsUpdate = true;
}

const clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  updateMovement(delta);
  updateCamera();
  updateHUD();
  updateGrappleLine();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
