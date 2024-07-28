import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PMREMGenerator } from 'three/extras/PMREMGenerator.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';


const projObjects = {
    scene : undefined,          // Scene Three Object
    camera: undefined,          // Camera Three object
    controls: undefined,        // controls three object
    renderer: undefined,        // Renderer Three Object
    hdri : undefined,           // Three texture (gotten by rgbeloader)
    waves : [],
    waveMat : undefined
}
const wireframeMode = true;


// Function to rotate a 2D vector
const rotateVector2 = (vector, angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = vector.x * cos - vector.y * sin;
    const y = vector.x * sin + vector.y * cos;
    return new THREE.Vector2(x, y);
}

const initWaves = () => {
    projObjects.waves = [];         // Clear the waves
    const medianLength = 4.0;       // the length of the median wave. We will create waves randomly from half to double this median
    const ampToLengthRatio = 1/6;   // The ratio of the amplitude to wavelength. The amplitude must correspond to teh length for a abetter control
    const numOfWaves = 4;           // number of waves we need to create.
    // Wind Direction. Waves will be randomly created with this direction with some tilt
    const wind = new THREE.Vector2(0,1);
    const gravity = 10;             // 10m/s2
    const windMaxAngle = Math.PI/4; // Generating random winds tilted with this angle
    
    
    for(let i = 0 ; i < numOfWaves; i++){
        const wlen = medianLength/2 + Math.random()*(medianLength*2 - medianLength/2);
        const rad =  windMaxAngle * (Math.random()*2 - 1);      // Between -windMaxAngle and windMaxAngle rotation angle
        const dir = rotateVector2(wind, rad).setLength(1);
        projObjects.waves.push(
            {
                dir :  [dir.x, dir.y],
                speed : Math.sqrt(gravity * 2 * Math.PI / wlen),        // Speed in how many units per second does the wave move
                amplitude : wlen*ampToLengthRatio,
                length : wlen,
                steepness : Math.random()   // Random steepness
            }
        );
    }
}



const initRenderer = () => {
    projObjects.renderer = new THREE.WebGLRenderer();
    document.body.appendChild( projObjects.renderer.domElement );
    projObjects.renderer.setSize(window.innerWidth, window.innerHeight, false);
}

const initCamera = () => {
    projObjects.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    projObjects.camera.position.set(0, 1, 5);
    projObjects.controls = new OrbitControls( projObjects.camera, projObjects.renderer.domElement );
    projObjects.controls.update();
}


const initBackground = async () => {
    const rgbeLoader = new RGBELoader();
    projObjects.hdri = await rgbeLoader.loadAsync('./public/kloppenheim_06_puresky_1k.hdr');
    projObjects.hdri.mapping = THREE.EquirectangularReflectionMapping;

    // Set the scene background to the HDR texture
    projObjects.scene.background = projObjects.hdri;
}


const initOcean = () => {
    const pmremGenerator = new PMREMGenerator(projObjects.renderer);
    const envMap = pmremGenerator.fromEquirectangular(projObjects.hdri).texture.clone();
    pmremGenerator.dispose();

    projObjects.waveMat = new THREE.ShaderMaterial( {
        uniforms: {
            time : {value : 1.0},
            
            WDirs : {value: projObjects.waves.flatMap((value) => value.dir)},
            WSpeeds : {value:  projObjects.waves.flatMap((value) => value.speed)},
            WAmplitudes : {value:  projObjects.waves.flatMap((value) => value.amplitude)},
            WLengths : {value:  projObjects.waves.flatMap((value) => value.length)},
            WSteep : {value :  projObjects.waves.flatMap((value) => value.steepness)},
            
            envMap: { value: envMap },
            reflective: {value : 1.0},
            color : {value : new THREE.Vector3(1,1,1)}
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;

            uniform float time;          // animation time
            uniform float WDirs[${2 * projObjects.waves.length}];      // wave direction
            uniform float WSpeeds[${ projObjects.waves.length}];
            uniform float WAmplitudes[${ projObjects.waves.length}];
            uniform float WLengths[${ projObjects.waves.length}];
            uniform float WSteep[${ projObjects.waves.length}];
            
            #define PI2 6.28318530718

            void main() {      
                vec3 nPos = vec3(position.xy,0.0);

                for(int i = 0 ; i < ${ projObjects.waves.length} ; i++){
                    // Pis in a cycle
                    float pis_cycle = WLengths[i] / PI2;
                    // Vertices on the same line are projected
                    vec2 dir = normalize(vec2(WDirs[i*2], WDirs[i*2+1]));
                    float dp = dot(dir, position.xy);
                    // frequency of the wave
                    float f = PI2/WLengths[i];
                    // phase = speed*frequney*time
                    float p = WSpeeds[i] * f * time;
                    // wave cos
                    float wcos = cos(f*dp + p);

                    nPos.x += (WSteep[i] /${ projObjects.waves.length}.0) * pis_cycle * WDirs[i*2] * wcos;
                    nPos.y += (WSteep[i] /${ projObjects.waves.length}.0) * pis_cycle * WDirs[i*2+1] * wcos;
                    nPos.z = WAmplitudes[i] * sin(dp*f + p);
                }

                // Create the normal matrix in the vertex shader
                vNormal = transpose(inverse(mat3(modelMatrix))) * normal;
                vPosition = vec3(modelMatrix * vec4(position, 1.0));
                // gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xyz, 1.0);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(nPos.xyz, 1.0);
            }
        `,
        fragmentShader: `
            uniform samplerCube envMap; 
            uniform vec3 color;
            uniform float reflective;

            // waves data:
            uniform float WDirs[${2* projObjects.waves.length}];      // wave direction
            uniform float WSpeeds[${ projObjects.waves.length}];
            uniform float WAmplitudes[${ projObjects.waves.length}];
            uniform float WLengths[${ projObjects.waves.length}];
            uniform float WSteep[${ projObjects.waves.length}];

            varying vec3 vPosition;
            varying vec3 vNormal;

            void main() {
                if(reflective == 0.0){
                    gl_FragColor = vec4(color, 1.0); 
                    return;
                }
                
                vec3 I = normalize(vPosition - cameraPosition);
                vec3 R = reflect(I, normalize(vNormal));
                vec3 envColor = textureCube(envMap, R).rgb;
            
                gl_FragColor = vec4(envColor, 1.0);
            }
        `,
        side: THREE.DoubleSide,
    } );
    
    // Objects Initializations
    const geometry = new THREE.PlaneGeometry(100, 100, 100, 100);
    const plane = new THREE.Mesh( geometry, projObjects.waveMat );
    plane.rotation.x = -Math.PI/2;

    // Creating Wireframe
    if(wireframeMode){
        const wireframe = new THREE.WireframeGeometry( plane.geometry );
        projObjects.waveMat.uniforms.reflective.value = 0.0;
        const line = new THREE.LineSegments( wireframe , projObjects.waveMat);
        line.material.depthTest = false;
        line.material.opacity = 0.25;
        line.material.transparent = true;
        line.rotation.x = plane.rotation.x;
        projObjects.scene.add(line);
    }else{
        projObjects.scene.add(plane);
    }
}


const initScene = async () =>{
    // Engine Initialization
    projObjects.scene = new THREE.Scene();
    await initBackground();
    initWaves();
    initOcean();
}


const init = async () => {
    initRenderer();
    initCamera();
    await initScene();
}



const draw = () => {
    const animate = () => {
        projObjects.waveMat.uniforms.time.value = performance.now() / 2000; // Time in seconds
        projObjects.controls.update();
        projObjects.renderer.render( projObjects.scene, projObjects.camera );
        projObjects.renderer.setAnimationLoop( animate );
    }
    projObjects.renderer.setAnimationLoop( animate );
}


await init();
draw();
