import { EXRLoader } from "../../vendor/three/addons/loaders/EXRLoader.js";

export const VATICAN_BACKGROUND_YAW = 0;

export async function loadVaticanEnvironment(THREE, renderer) {
    const texture = await new EXRLoader().loadAsync("assets/hdr/vatican_road_4k.exr");
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const generator = new THREE.PMREMGenerator(renderer);
    generator.compileEquirectangularShader();
    const environment = generator.fromEquirectangular(texture).texture;
    generator.dispose();
    return { background: texture, environment };
}

export function createCloudVeil(THREE, camera) {
    const material = new THREE.MeshBasicMaterial({ color: 0xd9e0e2, transparent: true, opacity: 0, depthTest: false });
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), material);
    veil.position.set(0, 0, -1);
    camera.add(veil);
    return veil;
}

export function applyVaticanEnvironment(scene, environment) {
    scene.background = environment.background;
    scene.environment = environment.environment;
    if ("backgroundRotation" in scene) scene.backgroundRotation.y = VATICAN_BACKGROUND_YAW;
    if ("environmentRotation" in scene) scene.environmentRotation.y = VATICAN_BACKGROUND_YAW;
}
