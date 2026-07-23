export function configureCamera(camera) {
    camera.position.set(1.2, 2.5, 11);
    camera.lookAt(0, .45, 0);
}

export function animateVaticanIdle(camera, elapsed, baseRotation, reducedMotion) {
    if (reducedMotion) {
        camera.rotation.copy(baseRotation);
        return;
    }
    camera.rotation.set(
        baseRotation.x + Math.sin(elapsed * .23) * .002,
        baseRotation.y + Math.sin(elapsed * .17) * .003,
        baseRotation.z + Math.sin(elapsed * .13) * .0005
    );
}
