import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';


const projObjects = {
    scene : undefined,          // Scene Three Object
    camera: undefined,          // Camera Three object
    controls: undefined,        // controls three object
    renderer: undefined,        // Renderer Three Object
    waves : [],
    waveMat : undefined,
    pmremGenerator : undefined
}
const wireframeMode = false;


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
    const medianLength = 3.0;       // the length of the median wave. We will create waves randomly from half to double this median
    const ampToLengthRatio = 1/30;   // The ratio of the amplitude to wavelength. The amplitude must correspond to teh length for a abetter control
    const numOfWaves = 4;           // number of waves we need to create.
    // Wind Direction. Waves will be randomly created with this direction with some tilt
    const wind = new THREE.Vector2(0,1);
    const gravity = 10;             // 10m/s2
    const windMaxAngle = Math.PI/2; // Generating random winds tilted with this angle
    
    
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
    projObjects.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    projObjects.renderer.toneMappingExposure = 1;
}

const initCamera = () => {
    projObjects.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    projObjects.camera.position.set(0, 1, 5);
    projObjects.controls = new OrbitControls( projObjects.camera, projObjects.renderer.domElement );
    projObjects.controls.update();
}


const initBackground = async () => {
    new EXRLoader().load('public/syferfontein_1d_clear_puresky_1k.exr' , (texture) => {
        const tex =  projObjects.pmremGenerator.fromEquirectangular(texture).texture;
        tex.mapping = THREE.CubeUVReflectionMapping;
        projObjects.scene.background = tex;
        texture.dispose();
    }); 
}


const initOcean = async () => {
    projObjects.waveMat = new THREE.ShaderMaterial( {
        uniforms: {
            time : {value : 1.0},
            
            WDirs : {value: projObjects.waves.flatMap((value) => value.dir)},
            WSpeeds : {value:  projObjects.waves.flatMap((value) => value.speed)},
            WAmplitudes : {value:  projObjects.waves.flatMap((value) => value.amplitude)},
            WLengths : {value:  projObjects.waves.flatMap((value) => value.length)},
            WSteep : {value :  projObjects.waves.flatMap((value) => value.steepness)},

            myEnvMap : {value : null, type: 't'},
            reflective: {value : 0.3},
            color : {value : new THREE.Vector3(0,94,184).multiplyScalar(1/256)},
            envMapIntensity : {value : 1.0},
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
                vec3 nNormal = vec3(0.0, 0.0, 1.0);


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
                    float wsin = sin(dp*f + p);
                    float nAmp = (WAmplitudes[i] / ${ projObjects.waves.length}.0);
                    float nStp = (WSteep[i] / ${ projObjects.waves.length}.0);

                    nPos.x += nStp * pis_cycle * WDirs[i*2] * wcos;
                    nPos.y +=  nStp * pis_cycle * WDirs[i*2+1] * wcos;
                    // nPos.z +=  nAmp * wsin;
                    nPos.z += WAmplitudes[i] * wsin;

                    nNormal.x -= dir.x * f * WAmplitudes[i] * wcos;
                    nNormal.y -= dir.y * f * WAmplitudes[i] * wcos;
                    nNormal.z -= nStp * wsin;
                }


                // Create the normal matrix in the vertex shader
                vNormal = transpose(inverse(mat3(modelMatrix))) * nNormal.xyz;
                vNormal = normalize(vNormal);
                vPosition = vec3(modelMatrix * vec4(nPos, 1.0));
                gl_Position = projectionMatrix * modelViewMatrix * vec4(nPos.xyz, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D myEnvMap; 
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

            #define PI2 6.28318530718
            #define PI 3.14159265

            void main() {
                // if(reflective == 0.0){
                //     gl_FragColor = vec4(vNormal, 1.0); 
                //     return;
                // }
                vec3 I = normalize(vPosition - cameraPosition);
                vec3 R = reflect(I, normalize(vNormal));


                // Convert reflection vector to spherical coordinates
                float theta = atan(R.z, R.x); // Longitude
                float phi = acos(R.y); // Latitude

                // Convert spherical coordinates to UV coordinates
                float u = (theta / PI2) + 0.5;
                float v = phi / PI;

                // Sample the equirectangular texture
                vec3 envColor = texture(myEnvMap, vec2(u, v)).rgb;
    
                vec3 finalColor = mix(color, vec3(1.0), vPosition.y)*(1.0 - reflective) + envColor*reflective;
                
                // gl_FragColor = vec4(envColor,1.0);
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
        side: THREE.DoubleSide,
    } );

    // Objects Initializations
    const geometry = new THREE.PlaneGeometry(100, 100, 400, 400);
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


const bouncePoint = (point,time) => {
    const PI2 = Math.PI*2;
    const nPos = new THREE.Vector3(point.x, point.y, point.z);

    for(let i = 0 ; i < projObjects.waves.length ; i++){
        // Pis in a cycle
        const pis_cycle = projObjects.waves[i].length / PI2;
        // Vertices on the same line are projected
        const dir = projObjects.waves[i].dir;
        const nDir = (new THREE.Vector2(dir[0], dir[1])).setLength(1);

        const dp =  nDir.dot(new THREE.Vector2(point.x, point.y));

        // frequency of the wave
        const f = PI2/projObjects.waves[i].length;

        // phase = speed*frequney*time
        const p = projObjects.waves[i].speed  * f *time;

        // wave cos
        const wcos = Math.cos(f*dp + p);

        nPos.x += ( projObjects.waves[i].steepness / projObjects.waves.length) * pis_cycle * nDir.x * wcos;
        nPos.y += ( projObjects.waves[i].steepness / projObjects.waves.length) * pis_cycle * nDir.y * wcos;
        nPos.z += projObjects.waves[i].amplitude * Math.sin(dp*f + p);
    }
    return nPos;
}


const initScene = async () =>{
    // Engine Initialization
    projObjects.scene = new THREE.Scene();
    initWaves();

    projObjects.pmremGenerator = new THREE.PMREMGenerator(projObjects.renderer);
    projObjects.pmremGenerator.compileEquirectangularShader(); 
    await initOcean();
    new EXRLoader().load('public/syferfontein_1d_clear_puresky_1k_blurred.exr' , (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        // texture.encoding = THREE.RGBEEncoding; // Assuming your input texture is HDR

        // const tex =  projObjects.pmremGenerator.fromEquirectangular(texture).texture;
        // console.log(tex);   

        projObjects.waveMat.envMap = {value: texture, type:'t'} ;
        projObjects.waveMat.uniforms.myEnvMap =  {value: texture, type:'t'};
        // projObjects.waveMat.uniforms.color.value = new THREE.Vector3(0,1,0);
        projObjects.waveMat.needsUpdate = true;
        projObjects.waveMat.uniformsNeedUpdate = true;

        texture.dispose();
    }); 
    
    await initBackground();

    projObjects.pmremGenerator.dispose();
}


const init = async () => {
    initRenderer();
    initCamera();
    await initScene();
}



const draw = () => {
    const animate = () => {
        projObjects.waveMat.uniforms.time.value = performance.now() / 10000; // Time in seconds
        const p = bouncePoint(projObjects.camera.position, projObjects.waveMat.uniforms.time.value);
        projObjects.controls.update();
        projObjects.renderer.render( projObjects.scene, projObjects.camera );
        projObjects.renderer.setAnimationLoop( animate );
    }
    projObjects.renderer.setAnimationLoop( animate );
}


await init();
draw();
