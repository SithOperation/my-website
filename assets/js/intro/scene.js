import * as THREE from "../../vendor/three/three.module.js";
import { EffectComposer } from "../../vendor/three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../../vendor/three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "../../vendor/three/addons/postprocessing/OutputPass.js";

export function createScene(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.25 : 1.75));
    renderer.setSize(innerWidth, innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000103);
    scene.fog = new THREE.FogExp2(0x02050a, .012);
    const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .05, 250);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());

    const resize = () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight, false);
        composer.setSize(innerWidth, innerHeight);
    };
    addEventListener("resize", resize, { passive: true });
    return { THREE, renderer, scene, camera, composer, dispose: () => removeEventListener("resize", resize) };
}
