export function createOrbitalLighting(THREE, scene) {
    const sun = new THREE.DirectionalLight(0xfff7e8, 4.4);
    sun.position.set(-8, 3, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x18355a, 0x000000, .18));
    return sun;
}
