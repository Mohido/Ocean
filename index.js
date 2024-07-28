import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js';
import { PMREMGenerator } from 'three/extras/PMREMGenerator.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';


const projObjects = {
    scene : undefined,          // Scene Three Object
    camera: undefined,          // Camera Three object
    controls: undefined,        // controls three object
    renderer: undefined,        // Renderer Three Object
    hdri : undefined,           // Three texture (gotten by rgbeloader)
}

const wireframeMode = true;

const waves = [
    {
        dir : [0.0, 1.0],
        speed : 1.0,
        amplitude : 1.0,
        length : 4
    }
]


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
    const envMap = pmremGenerator.fromEquirectangular(projObjects.hdri).texture;
    pmremGenerator.dispose();

    const myShaderMaterial = new THREE.ShaderMaterial( {
        uniforms: {
            time : {value : 1.0},
            
            WDirs : {value: waves.flatMap((value) => value.dir)},
            WSpeeds : {value: waves.flatMap((value) => value.speed)},
            WAmplitudes : {value: waves.flatMap((value) => value.amplitude)},
            WLengths : {value: waves.flatMap((value) => value.length)},

            envMap: { value: envMap },
            reflective: {value : 1.0},
            color : {value : new THREE.Vector3(1,1,1)}
        },
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;

            uniform float time;          // animation time
            uniform float WDirs[${2*waves.length}];      // wave direction
            uniform float WSpeeds[${waves.length}];
            uniform float WAmplitudes[${waves.length}];
            uniform float WLengths[${waves.length}];
            
            void main() {        
                // Create the normal matrix in the vertex shader
                vNormal = transpose(inverse(mat3(modelMatrix))) * normal;
                vPosition = vec3(modelMatrix * vec4(position, 1.0));
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform samplerCube envMap; 
            uniform vec3 color;
            uniform float reflective;

            // waves data:
            uniform float WDirs[${2*waves.length}];      // wave direction
            uniform float WSpeeds[${waves.length}];
            uniform float WAmplitudes[${waves.length}];
            uniform float WLengths[${waves.length}];


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
    const geometry = new THREE.PlaneGeometry(20, 20, 40, 40);
    const plane = new THREE.Mesh( geometry, myShaderMaterial );
    plane.rotation.x = -Math.PI/2;

    // Creating Wireframe
    if(wireframeMode){
        const wireframe = new THREE.WireframeGeometry( plane.geometry );
        myShaderMaterial.uniforms.reflective.value = 0.0;
        const line = new THREE.LineSegments( wireframe , myShaderMaterial);
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
    initOcean();
}


const init = async () => {
    initRenderer();
    initCamera();
    await initScene();
}



const draw = () => {
    const animate = () => {
        projObjects.controls.update();
        projObjects.renderer.render( projObjects.scene, projObjects.camera );
        projObjects.renderer.setAnimationLoop( animate );
    }
    projObjects.renderer.setAnimationLoop( animate );
}


await init();
draw();
