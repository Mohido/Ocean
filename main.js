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
 * 
 *  * 2 RenderTargets
 *      - One for the normals of the wave
 *      - One for the added position of the wave
 * 
 * NOTE: Start reading function callstacks from the main() function.
 * 
 * Copyrights and Contributions: Mohammed Al-Mahdawi <Mohido>
 */


/////////////////////////////////////////////
/////////////Imports Section/////////////////
/////////////////////////////////////////////
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; 
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { fstPassFShader, fstPassVShader, sndPassFShader, sndPassVShader } from './shaders.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';

/////////////////////////////////////////////
/////////////Constants Section///////////////
/////////////////////////////////////////////
const meta = {
    owidth : 20,        // Ocean width in THREE.JS units
    oheight : 20,       // Ocean height in THREE.JS units
    ohorS : 40,         // Ocean horizontal Segmentaion count
    overS : 40,         // Ocean vertical Segmentaion count
    tsize : 512,        // Texture size
}

// Gui Parameters
const stats = new Stats();
const gui = new GUI();
const parameters = {
    waves: []
};

// Initialize the renderer
const renderer = new THREE.WebGLRenderer();
if (!renderer.capabilities.isWebGL2) {
    console.error('WebGL2 is required but not supported');
}
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// multiple render target object. This is used as an output for the first pass. It won't be shown.
const renderTarget = new THREE.WebGLRenderTarget(meta.tsize, meta.tsize, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    encoding: THREE.LinearEncoding,
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
        vertexShader: fstPassVShader,
        fragmentShader: fstPassFShader
}))




/////////////////////////////////////////////
/////////////// Functions ///////////////////
/////////////////////////////////////////////

// Initializes teh stats and the waves adding window
function initGUI() {
    // Function to remove a row of parameters
    function removeWave(folder, wave) {
        // Remove wave
        const index = parameters.waves.indexOf(wave);
        if (index > -1) {
            parameters.waves.splice(index, 1);
        }

         // Remove all controllers within the folder
        folder.controllers.forEach(controller => {
            controller.destroy();
        });

        // Remove the folder itself
        folder.domElement.parentNode.removeChild(folder.domElement);
    }

    function addWave() {
        const wave = {
            length: 0,
            speed: 0,
            amplitude: 0,
            angle: 0,   // Angle of the wind
            steepness: 0
        };
        parameters.waves.push(wave);
        const folder = gui.addFolder(`Wave ${parameters.waves.length}`);
        folder.add(wave, 'length', 1, 10, 0.1);
        folder.add(wave, 'amplitude', 0.01, 10, 0.01);
        folder.add(wave, 'steepness', 0, 1, 0.01);
        folder.add(wave, 'angle', 0, 360, 0.1);
        folder.add(wave, 'speed', 1, 10, 0.1);
        folder.add({ remove: () => removeWave(folder, wave) }, 'remove').name(`Remove Wave ${parameters.waves.length}`);
        folder.open();
    }

    document.body.appendChild( stats.dom );
    stats.dom.style.transformOrigin = `top left`;
    stats.dom.style.transform = `scale(1.3)`;

    // Add button to add new rows
    gui.add({ addWave }, 'addWave').name('Add Wave');
}

// Initializes the Initial render pass
function initFstPass() {
    // Set camera position to look down the ocean
    passes[0].camera.position.z = 1;
    passes[0].camera.lookAt(new THREE.Vector3(0,0,0));
    
    // Adding the ocean
    passes[0].scene.add(ocean);
}

// Initializes the final render pass
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
        vertexShader:sndPassVShader,
        fragmentShader: sndPassFShader 
    });
    plane.material.needsUpdate = true;
    
    // Adding the ocean
    passes[1].scene.add(plane);
    passes[1].scene.background = new THREE.Color(0,0,0);
}

// render first pass into screen
function viewFstPass() {
    renderer.render(passes[0].scene, passes[0].camera);
}

// Renders the data into the render targets
function renderFstPass() {
    renderer.setRenderTarget(renderTarget);
    renderer.render(passes[0].scene, passes[0].camera);
    renderer.setRenderTarget(null);
}

// Renders second pass into screen
function renderSndPass() { 
    renderer.render(passes[1].scene, passes[1].camera);
}

// Updates everything
function update() {
    passes[1].controls.update();
    stats.update();
}

// Main Function
function main(){
    initGUI();
    initFstPass();
    initSndPass();

    const animate = () => {
        renderFstPass();
        renderSndPass();
        update();
        requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
}


main();
