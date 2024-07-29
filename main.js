/**
 * 
 * This file handles everything about our Threejs project, from creating the menu's to rendering the waves.
 * 
 * The project mainly contains:
 *  * 2 Scenes:
 *      - First Pass Scene which will generate a normal map with the wave position texture
 *      - Second pass scene which will be the final pass. 
 * 
 *  * 2 Cameras:
 *      - First camera is used to render the first scene. It is an orthographic camera used to generate textures data
 *      - Second camera is used in the final pass render.
 */

/////////////////////////////////////////////
/////////////Imports Section/////////////////
/////////////////////////////////////////////
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; 
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';



/////////////////////////////////////////////
/////////////Constants Section///////////////
/////////////////////////////////////////////
const meta = {
    owidth : 20,        // Ocean width in THREE.JS units
    oheight : 20,       // Ocean height in THREE.JS units
    ohorS : 40,        // Ocean horizontal Segmentaion count
    overS : 40,        // Ocean vertical Segmentaion count
    tsize : 512,        // Texture size
}

// Initialize the renderer
const renderer = new THREE.WebGLRenderer();
// Check for WebGL2 support
if (!renderer.capabilities.isWebGL2) {
    console.error('WebGL2 is required but not supported');
}
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// multiple render target object. This is used as an output for the first pass. It won't be shown.
const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    encoding: THREE.LinearEncoding,
    depthBuffer: true,
    stencilBuffer: false,
    count :  2
});


// Create scenes and camera
const passes = [
    {
        scene: new THREE.Scene(),
        camera : new THREE.OrthographicCamera(meta.owidth / -2, meta.owidth / 2, meta.oheight / 2, meta.oheight / -2, 0.1, 1000),
    },
    {
        scene: new THREE.Scene(),
        camera: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
        controls : undefined
    }
]


// Initialize objects with custom shader material
const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(meta.owidth, meta.oheight, meta.ohorS, meta.overS),
    new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        side: THREE.DoubleSide,
        vertexShader: `
            void main() {
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            precision highp float;
			precision highp int;
            
            // layout(location = 0) out vec4 pc_FragColor;
            layout(location = 0) out vec4 tPosition;
            layout(location = 1) out vec4 tNormal;

            void main() {
                tPosition = vec4(1.0, 0.0, 0.0, 1.0);           // Red 
                tNormal = vec4(0.0, 1.0, 0.0, 1.0);          // Green
                // pc_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
            }
        `
}))




/////////////////////////////////////////////
/////////////// Functions ///////////////////
/////////////////////////////////////////////

// Creates first pass objects
function initFstPass() {
    // Set camera position to look down the ocean
    passes[0].camera.position.z = 1;
    passes[0].camera.lookAt(new THREE.Vector3(0,0,0));
    
    // Adding the ocean
    passes[0].scene.add(ocean);
}


// Draw the first pass into the screen.
function viewFstPass() {
    renderer.render(passes[0].scene, passes[0].camera);
}


// Renders the data into the render targets
function renderFstPass() {
    renderer.setRenderTarget(renderTarget);
    renderer.render(passes[0].scene, passes[0].camera);
}



function initSndPass() {
    // Set camera position to look down the ocean
    passes[1].camera.position.z = 10;
    passes[1].camera.lookAt(new THREE.Vector3(0,0,0));

    passes[1].controls = new OrbitControls( passes[1].camera,renderer.domElement );
    passes[1].controls.update();

    
    const plane = ocean.clone();
    // plane.material =  new THREE.MeshBasicMaterial({color: new THREE.Color(1,0,0), side: THREE.DoubleSide});
    plane.material =  new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        glslVersion : THREE.GLSL3,
        uniforms: {
            tPosition: { value: renderTarget.textures[0] },  // Ocean Positions
            tNormal: { value: renderTarget.textures[1] }     // Ocean Normals
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: ` 
            precision highp float;
			precision highp int;

            uniform sampler2D tPosition;
            uniform sampler2D tNormal;
            varying vec2 vUv;

            layout(location = 0) out vec4 pc_FragColor;

            void main() {
                vec3 tPos = texture(tPosition, vUv).rgb;
                vec3 tNorm = texture(tNormal, vUv).rgb;

                pc_FragColor = vec4(tPos.r, tNorm.g, 0.0, 1.0);
            }
        `
    });
    plane.material.needsUpdate = true;
    
    // Adding the ocean
    passes[1].scene.add(plane);
    passes[1].scene.background = new THREE.Color(0,0,0);
}


function renderSndPass() { 
    renderer.setRenderTarget(null);
    renderer.render(passes[1].scene, passes[1].camera);
}


function update() {
    passes[1].controls.update();
}

// Initiate Drawing
function main(){
    initFstPass();
    initSndPass();
    let printed = false;
    // // Animation loop
    const animate = () => {
        renderFstPass();
        renderSndPass();
        // viewFstPass();
        update();
        requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
}


main();
