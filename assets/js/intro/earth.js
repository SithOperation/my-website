const vertexShader = `
varying vec2 vUv; varying vec3 vNormalW; varying vec3 vWorld;
void main(){vUv=uv; vNormalW=normalize(mat3(modelMatrix)*normal); vWorld=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
`;
const earthFragment = `
varying vec2 vUv; varying vec3 vNormalW; varying vec3 vWorld;
uniform vec3 sunDir;
uniform sampler2D dayMap; uniform sampler2D nightMap;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float f=0.;for(int i=0;i<6;i++){f+=noise(p)*(.5/pow(1.8,float(i)));p=p*2.03+17.1;}return f;}
void main(){
 vec2 p=vec2(vUv.x*10.,vUv.y*5.); float land=fbm(p)+.34*fbm(p*2.7)-.57;
 float polar=smoothstep(.76,.98,abs(vUv.y-.5)*2.); float day=max(dot(normalize(vNormalW),normalize(sunDir)),0.);
 vec3 nasaDay=texture2D(dayMap,vUv).rgb; vec3 nasaNight=texture2D(nightMap,vUv).rgb;
 vec3 ocean=mix(vec3(.002,.018,.045),vec3(.015,.12,.20),day);
 vec3 ground=mix(vec3(.035,.045,.025),vec3(.18,.22,.10),clamp(day,0.,1.));
 vec3 procedural=mix(ocean,ground,smoothstep(-.03,.08,land)); procedural=mix(procedural,vec3(.72,.78,.76),polar);
 vec3 col=mix(procedural,nasaDay,.88)*(.10+day*.98);
 col+=nasaNight*1.45*(1.-smoothstep(.03,.36,day)); gl_FragColor=vec4(col,1.);
}`;
const atmosphereFragment = `
varying vec3 vNormalW; varying vec3 vWorld;
void main(){vec3 viewDir=normalize(cameraPosition-vWorld);float rim=pow(1.-max(dot(viewDir,normalize(vNormalW)),0.),3.2);gl_FragColor=vec4(.08,.34,.72,rim*.48);}
`;

function seededPoints(THREE, count, radius) {
    const positions = new Float32Array(count * 3);
    let seed = 1947;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < count; i++) {
        const u = random() * 2 - 1, a = random() * Math.PI * 2, r = radius * (.72 + random() * .28);
        const s = Math.sqrt(1 - u * u);
        positions.set([r * s * Math.cos(a), r * u, r * s * Math.sin(a)], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xa9c9e7, size: .035, transparent: true, opacity: .72, sizeAttenuation: true }));
}

export function latitudeLongitudeToVector3(THREE, latitude, longitude, radius = 1) {
    const lat = THREE.MathUtils.degToRad(latitude);
    const lon = THREE.MathUtils.degToRad(longitude);
    const cosLat = Math.cos(lat);
    return new THREE.Vector3(
        -radius * cosLat * Math.cos(lon),
        radius * Math.sin(lat),
        radius * cosLat * Math.sin(lon)
    );
}

export function createEarthSystem(THREE, scene, { showTargetMarker = false } = {}) {
    const system = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const dayMap = loader.load("assets/textures/earth/nasa-blue-marble-2048.png");
    const nightMap = loader.load("assets/textures/earth/nasa-night-lights-3600.jpg");
    dayMap.colorSpace = nightMap.colorSpace = THREE.SRGBColorSpace;
    dayMap.anisotropy = nightMap.anisotropy = 4;
    const earthMaterial = new THREE.ShaderMaterial({
        vertexShader, fragmentShader: earthFragment,
        uniforms: {
            sunDir: { value: new THREE.Vector3(-8, 3, 8).normalize() },
            dayMap: { value: dayMap },
            nightMap: { value: nightMap }
        }
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(2, 128, 96), earthMaterial);
    system.rotation.z = THREE.MathUtils.degToRad(-23.44);
    const cloudMaterial = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader: `
        varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
        void main(){float n=noise(vUv*vec2(75.,38.))*.6+noise(vUv*vec2(210.,105.))*.4;gl_FragColor=vec4(.76,.84,.87,smoothstep(.57,.76,n)*.42);}
        `,
        transparent: true,
        depthWrite: false
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(2.035, 96, 64), cloudMaterial);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(2.12, 96, 64), new THREE.ShaderMaterial({
        vertexShader, fragmentShader: atmosphereFragment, transparent: true, side: THREE.BackSide,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x8294a8, transparent: true, opacity: .18 });
    const orbits = new THREE.Group();
    [-.65, .2, .85].forEach((tilt, index) => {
        const curve = new THREE.EllipseCurve(0, 0, 2.7 + index * .18, 2.7 + index * .18);
        const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(curve.getPoints(160)), orbitMaterial.clone());
        line.rotation.set(Math.PI / 2 + tilt, tilt * .3, index);
        orbits.add(line);
    });
    system.add(earth, clouds, atmosphere, orbits);
    const vaticanLocal = latitudeLongitudeToVector3(THREE, 41.9029, 12.4534, 2);
    let targetMarker = null;
    if (showTargetMarker) {
        targetMarker = new THREE.Mesh(
            new THREE.SphereGeometry(.035, 12, 8),
            new THREE.MeshBasicMaterial({ color: 0xff2538, depthTest: false })
        );
        targetMarker.position.copy(vaticanLocal).multiplyScalar(1.015);
        system.add(targetMarker);
    }
    scene.add(system);
    const stars = seededPoints(THREE, innerWidth < 768 ? 1100 : 2400, 90);
    scene.add(stars);
    const dispose = () => {
        scene.remove(system, stars);
        system.traverse(object => {
            object.geometry?.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.filter(Boolean).forEach(material => material.dispose());
        });
        stars.geometry.dispose();
        stars.material.dispose();
        dayMap.dispose();
        nightMap.dispose();
    };
    return { system, earth, clouds, atmosphere, orbits, stars, targetMarker, vaticanLocal, dispose };
}
