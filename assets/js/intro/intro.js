import { createScene } from "./scene.js";
import { createOrbitalLighting } from "./lighting.js";
import { createEarthSystem } from "./earth.js";
import { configureCamera, animateVaticanIdle } from "./camera.js";
import { applyVaticanEnvironment, createCloudVeil, loadVaticanEnvironment } from "./transition.js";

const gsap = window.gsap;
const VATICAN_LATITUDE = 41.9029;
const VATICAN_LONGITUDE = 12.4534;
const DEVELOPMENT_TARGET_MARKER = false;

function revealHomepage(home) {
    document.body.classList.remove("intro-active");
    home.classList.add("site-revealed");
    gsap.fromTo(
        [".hero", "nav", ".card"],
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: .7, stagger: .08, ease: "power2.out", clearProps: "opacity,transform" }
    );
}

function removeIntroUI(root) {
    root.querySelector(".intro-ui")?.remove();
    root.removeAttribute("role");
    root.removeAttribute("aria-label");
    root.setAttribute("aria-hidden", "true");
    root.classList.add("is-vatican-background");
}

async function runFallback(root, home, { playSequence }) {
    root.classList.add("intro-static", "is-earth-fallback");
    if (playSequence) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        root.classList.add("is-fallback-transition");
        await new Promise(resolve => setTimeout(resolve, 700));
    }
    root.classList.add("is-vatican-fallback", "is-vatican-background");
    root.classList.remove("is-earth-fallback", "is-fallback-transition");
    removeIntroUI(root);
    revealHomepage(home);
    sessionStorage.setItem("orbital-intro-seen", "true");
}

function orientVaticanToCamera(THREE, globe, camera) {
    const axialTilt = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        THREE.MathUtils.degToRad(-23.44)
    );
    const tiltedTarget = globe.vaticanLocal.clone().normalize().applyQuaternion(axialTilt);
    const cameraDirection = camera.position.clone().normalize();
    const alignment = new THREE.Quaternion().setFromUnitVectors(tiltedTarget, cameraDirection);
    const destination = alignment.multiply(axialTilt);
    return { destination, surfaceDirection: cameraDirection };
}

export async function runIntro(root, { playSequence = true } = {}) {
    const canvas = root.querySelector("canvas");
    const status = root.querySelector(".intro-status");
    const skip = root.querySelector(".intro-skip");
    const home = document.querySelector(".overlay");
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const webgl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    const lowPerformance = !webgl || innerWidth < 560 || (navigator.hardwareConcurrency || 4) < 4;

    if (lowPerformance) {
        await runFallback(root, home, { playSequence });
        return;
    }

    const world = createScene(canvas);
    configureCamera(world.camera);
    world.scene.add(world.camera);
    createOrbitalLighting(world.THREE, world.scene);
    const globe = createEarthSystem(world.THREE, world.scene, { showTargetMarker: DEVELOPMENT_TARGET_MARKER });
    const veil = createCloudVeil(world.THREE, world.camera);
    const clock = new world.THREE.Clock();
    const baseVaticanRotation = new world.THREE.Euler(0, 0, 0);
    let vaticanMode = false;
    let animationFrame = 0;
    let visible = document.visibilityState === "visible";

    const scheduleFrame = () => {
        if (visible && !animationFrame) animationFrame = requestAnimationFrame(render);
    };
    const render = () => {
        animationFrame = 0;
        if (!visible) return;
        const elapsed = clock.getElapsedTime();
        if (!vaticanMode) {
            globe.earth.rotation.y += .00048;
            globe.clouds.rotation.y += .00066;
            globe.stars.rotation.y += .000025;
        } else {
            animateVaticanIdle(world.camera, elapsed, baseVaticanRotation, reducedMotion);
        }
        world.composer.render();
        scheduleFrame();
    };
    const onVisibilityChange = () => {
        visible = document.visibilityState === "visible";
        if (visible) {
            clock.start();
            scheduleFrame();
        } else if (!visible && animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
            clock.stop();
        }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    scheduleFrame();

    const environmentPromise = loadVaticanEnvironment(world.THREE, world.renderer);
    const enterVaticanMode = async ({ markSeen = true } = {}) => {
        const environment = await environmentPromise;
        applyVaticanEnvironment(world.scene, environment);
        vaticanMode = true;
        world.camera.position.set(0, 0, 0);
        world.camera.rotation.copy(baseVaticanRotation);
        globe.dispose();
        world.camera.remove(veil);
        veil.geometry.dispose();
        veil.material.dispose();
        removeIntroUI(root);
        revealHomepage(home);
        if (markSeen) sessionStorage.setItem("orbital-intro-seen", "true");
    };

    if (!playSequence) {
        await enterVaticanMode();
        return;
    }

    let skipRequested = false;
    let introTimeline = null;
    let resolveTimeline = null;
    skip.addEventListener("click", async () => {
        if (skipRequested || vaticanMode) return;
        skipRequested = true;
        introTimeline?.kill();
        resolveTimeline?.();
        await enterVaticanMode();
    }, { once: true });

    const { destination, surfaceDirection } = orientVaticanToCamera(world.THREE, globe, world.camera);
    const approachStart = new world.THREE.Vector3(.5, 1.55, 9);
    const approachEnd = surfaceDirection.clone().multiplyScalar(2.55);
    const approach = { progress: 0 };

    await new Promise(resolve => {
        resolveTimeline = resolve;
        introTimeline = gsap.timeline({ defaults: { ease: "power2.inOut" }, onComplete: resolve });
        introTimeline.to(canvas, { opacity: 1, duration: 1.8 })
            .to(world.camera.position, { x: .5, y: 1.55, z: 9, duration: 4.5 }, 0)
            .to(globe.system.quaternion, {
                x: destination.x, y: destination.y, z: destination.z, w: destination.w,
                duration: 4.5,
                onUpdate: () => globe.system.quaternion.normalize()
            }, 0)
            .to(status, { opacity: 1, duration: .35 })
            .call(() => {
                status.innerHTML = `<span>ESTABLISHING SECURE LINK</span><span>SATELLITE ACQUIRED</span><span>LOCATION VERIFIED</span><strong>VATICAN CITY / ${VATICAN_LATITUDE.toFixed(4)} N / ${VATICAN_LONGITUDE.toFixed(4)} E</strong>`;
                globe.orbits.children[1].material.color.set(0x8e1018);
                globe.orbits.children[1].material.opacity = .8;
            })
            .to(approach, {
                progress: 1,
                duration: 2.35,
                ease: "power3.in",
                onUpdate: () => {
                    world.camera.position.lerpVectors(approachStart, approachEnd, approach.progress);
                    const target = surfaceDirection.clone().multiplyScalar(2);
                    world.camera.lookAt(target);
                }
            })
            .to(status, { opacity: 0, duration: .3 }, "<1.2")
            .to(veil.material, { opacity: 1, duration: .72 }, "<1.1");
    });
    if (skipRequested) return;
    await environmentPromise;
    await enterVaticanMode();
}
