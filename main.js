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
import { fstPassFShader, fstPassVShader, sndPassFShader, sndPassVShader, thrPassFShader, thrPassVShader } from './shaders.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from 'three/addons/libs/stats.module.js';

/////////////////////////////////////////////
/////////////Constants Section///////////////
/////////////////////////////////////////////
const meta = {
    owidth : 100,        // Ocean width in THREE.JS units
    oheight : 100,       // Ocean height in THREE.JS units
    ohorS : 200,         // Ocean horizontal Segmentaion count
    overS : 200,         // Ocean vertical Segmentaion count
    tsize : 1024,        // Texture size
    mwaves : 5          // Max number of waves can be generated
}

// Gui Parameters
const stats = new Stats();
const gui = new GUI();
const parameters = {
    waves: [],
    tId : -1     // Used in visualization of the render targets. 0 = position texture, else = normal texture
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
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
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
    },
    {
        scene: new THREE.Scene(),
        camera:  new THREE.OrthographicCamera( -0.5, 0.5, 0.5, -0.5, 0.1, 1000),
        controls : undefined
    }
]

// Initialize ocean geometry. Scenes will use this to create a mesh.
const ocean = new THREE.PlaneGeometry(meta.owidth, meta.oheight, meta.ohorS, meta.overS); 
const torus = new THREE.TorusGeometry();
torus.translate(0,0.2,0);
torus.rotateX(Math.PI/2);
const torusMesh = new THREE.Mesh(
    torus,
    new THREE.MeshStandardMaterial({
        color:          new THREE.Color(0.3, 0, 0),
        roughness:      0.8,
        metalness:      0.,
        envMapIntensity :  1,
        envMapRotation : new THREE.Euler(0, Math.PI/2.5, 0)
    })
);


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
        update();
    }

    function addWave() {
        if(parameters.waves.length >= meta.mwaves){
            console.error("You have reached the maximum number of waves that you can generate. Max Number: ", meta.mwaves);
            return;
        }
        const wave = {
            length: 1,
            speed: 0,
            amplitude: 0,
            angle: 0,       // Angle of the wind
            steepness: 0,
            dir : [1,0]
        };
        parameters.waves.push(wave);
        const folder = gui.addFolder(`Wave ${parameters.waves.length}`);
        folder.add(wave, 'length', 1, 10, 0.1);
        folder.add(wave, 'amplitude', 0.01, 10, 0.01);
        folder.add(wave, 'steepness', 0, 1, 0.01);
        folder.add(wave, 'angle', 0, 360, 0.1).onChange((angle) => {
            const radian = (angle/180) * 3.1415926535;
            wave.dir =  [Math.cos(radian), Math.sin(radian)]
        });
        folder.add(wave, 'speed', 0, 10, 0.1);
        folder.add({ remove: () => removeWave(folder, wave) }, 'remove').name(`Remove Wave ${parameters.waves.length}`);
        folder.open();
        update();
    }

    function assignTId(opt) {
        switch(opt){
            case 'Main': parameters.tId = -1; break;
            case 'Position Map': parameters.tId = 0; break;
            case 'Normal Map': parameters.tId = 1; break;
        }
    }

    document.body.appendChild( stats.dom );
    stats.dom.style.transformOrigin = `top left`;
    stats.dom.style.transform = `scale(1.3)`;

    // Add button to add new rows
    gui.add({ addWave }, 'addWave').name('Add Wave');
    gui.add({option : 'Main'} , 'option', ['Main', 'Normal Map', 'Position Map']).name('Choose Option').onChange(assignTId);
    gui.onChange(update);
}

/**
 * In case there is no waves yet, it returns wcount = 0 and a temporary float32Array with 1 element on all uniforms. 
 * Thus, it is only a place holder to avoid shader issues.
 * @returns All the uniforms needed for teh first pass
 */
function getFstPassUniforms() { 
    if(parameters.waves.length === 0){
        const temp = new Float32Array(1).fill(0.0);
        return {
            time :        {value: performance.now() / 2000},
            wcount :      {value : parameters.waves.length},
            wlengths:     {value : temp},
            wspeeds:      {value : temp},
            wamplitudes:  {value : temp},
            wdirs:      {value : temp},
            wsteepnesses: {value : temp} 
        }
    }else{
        return {
            time :        {value: performance.now() / 2000},
            wcount :      {value : parameters.waves.length},
            wlengths:     {value : (parameters.waves.map((wave) => wave.length)    )},
            wspeeds:      {value : (parameters.waves.map((wave) => wave.speed)     )} ,
            wamplitudes:  {value : (parameters.waves.map((wave) => wave.amplitude) )} ,
            wdirs:        {value : (parameters.waves.flatMap(wave => wave.dir)) } ,     
            wsteepnesses: {value : (parameters.waves.map((wave) => wave.steepness) )} 
        }
    }

}

// Initializes the Initial render pass
function initFstPass() {
    // Set camera position to look down the ocean
    passes[0].camera.position.z = 1;
    passes[0].camera.lookAt(new THREE.Vector3(0,0,0));
    const mesh = new THREE.Mesh(
        ocean,
        new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            side: THREE.DoubleSide,
            defines: {
                PI2 : 6.28318530718,
                PI : 3.1415926535,
            },
            uniforms: getFstPassUniforms(),
            vertexShader: fstPassVShader(meta.mwaves),
            fragmentShader: fstPassFShader(meta.mwaves)
    }))

    // Adding the ocean
    passes[0].scene.add(mesh);
}

// Initializes the final render pass
function initSndPass() {
    // Set camera position to look down the ocean
    passes[1].camera.position.z = 40;
    passes[1].camera.position.x = 40;
    passes[1].camera.position.y = 40;
    passes[1].camera.lookAt(new THREE.Vector3(0,0,0));

    passes[1].controls = new OrbitControls( passes[1].camera,renderer.domElement );
    passes[1].controls.update();

    const mesh = new THREE.Mesh(
        ocean.clone().rotateX(Math.PI/2), 
        new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            defines: {
                PI2 : 6.28318530718,
                PI : 3.1415926535,
            },
            glslVersion : THREE.GLSL3,
            uniforms: {
                roughness : {value: 0.8},
                color : {value : new THREE.Color(0.0, 0.35, 0.73)},
                envMap : {value : passes[1].scene.background},
                tPosition: { value: renderTarget.textures[0] },  // Ocean Positions
                tNormal: { value: renderTarget.textures[1] }     // Ocean Normals
            },
            vertexShader:sndPassVShader,
            fragmentShader: sndPassFShader 
        })
    );

    

    // Adding the ocean
    passes[1].scene.add(mesh);
    passes[1].scene.add(torusMesh);
}

function init3rdPass(){
    // Set camera position to look down the ocean
    passes[2].camera.position.z = 1;
    passes[2].camera.lookAt(new THREE.Vector3(0,0,0));

    passes[2].controls = new OrbitControls( passes[2].camera, renderer.domElement );
    passes[2].controls.enableRotate = false;
    passes[2].controls.update();

    const triangle = new THREE.BufferGeometry();

    // create a simple square shape. We duplicate the top left and bottom right
    // vertices because each vertex needs to appear once per triangle.
    const vertices = new Float32Array( [
        -0.5, -0.5,  0.1, // v0
        1.5,  -0.5,  0.1, // v1
        -0.5,  1.5,  0.1, // v2
    ] );
    
    // itemSize = 3 because there are 3 values (components) per vertex
    triangle.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );

    const mesh = new THREE.Mesh(
        triangle, 
        new THREE.ShaderMaterial({
            side: THREE.DoubleSide,
            glslVersion : THREE.GLSL3,
            uniforms: {
                tId: {value : parameters.tId},
                tPosition: { value: renderTarget.textures[0] },  // Ocean Positions
                tNormal: { value: renderTarget.textures[1] }     // Ocean Normals
            },
            vertexShader: thrPassVShader,
            fragmentShader: thrPassFShader 
        })
    );

    // Adding the ocean
    passes[2].scene.add(mesh);
    passes[2].scene.background = new THREE.Color(0,0,0);
};


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
    renderer.setSize(window.innerWidth, window.innerHeight, true);
    renderer.render(passes[1].scene, passes[1].camera);
}

function render3rdPass(){
    renderer.setSize(meta.tsize, meta.tsize, true);
    renderer.render(passes[2].scene, passes[2].camera);
}

function updateFstPassUniforms() {
    passes[0].scene.traverse( function ( child ) {
        if ( child.material !== undefined && child.material.isShaderMaterial ) {
            Object.entries(getFstPassUniforms()).forEach(([uniform, data]) => {
                if (child.material.uniforms[uniform] !== undefined) {
                    child.material.uniforms[uniform].value = data.value;
                }
            });
        }
    })
}

function update3rdPassUniforms() {
    passes[2].scene.traverse( function ( child ) {
        if ( child.material !== undefined && child.material.isShaderMaterial ) {
            child.material.uniforms.tId.value = parameters.tId;
        }
    })
}

function loadEnvMap () {
    new EXRLoader().load('public/syferfontein_1d_clear_puresky_1k.exr', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        passes[1].scene.background = texture;
        passes[1].scene.backgroundRotation.y = Math.PI/2.5;

        passes[1].scene.traverse(child => {
            if(child.material && !child.material.isShaderMaterial){
                child.material.envMap = texture;
                child.material.needsUpdate = true;
            }
        });

        texture.dispose();
    })
    
    new EXRLoader().load('public/syferfontein_1d_clear_puresky_1k_blurred.exr', (blurred) => {
        blurred.mapping = THREE.EquirectangularReflectionMapping;
        passes[1].scene.traverse(child => {
            if(child.material && child.material.isShaderMaterial){
                child.material.uniforms.envMap.value = blurred;
                child.material.needsUpdate = true;
            }
        });
        blurred.dispose();
    });
};

function bounce(position){
    const uniforms = getFstPassUniforms();
    const nPosition = new THREE.Vector3(0,0,0);
    const nNormal = new THREE.Vector3(0,0,1);

    for(let i = 0 ; i < uniforms.wcount.value ; i++){
        // Pis in a cycle
        const l_pi2 = uniforms.wlengths.value[i] / (Math.PI*2);
        
        // Vertices on the same line are projected
        const dir = new THREE.Vector2(uniforms.wdirs.value[i*2], uniforms.wdirs.value[i*2+1]).setLength(1);
        const dp = dir.dot(position);

        // frequency of the wave
        const f = (Math.PI*2)/uniforms.wlengths.value[i];

        // phase = speed*frequney*time
        const p = uniforms.wspeeds.value[i]* f * uniforms.time.value;

        // wave cos
        const wcos = Math.cos(f*dp + p);
        const wsin = Math.sin(dp*f + p);
        const nAmp = (uniforms.wamplitudes.value[i] / uniforms.wcount.value);
        const nStp = (uniforms.wsteepnesses.value[i] / uniforms.wcount.value);

        nPosition.x += nStp * l_pi2 * dir.x * wcos;
        nPosition.y +=  nStp * l_pi2 * dir.y * wcos;
        // nPos.z +=  nAmp * wsin;
        nPosition.z += uniforms.wamplitudes.value[i] * wsin;

        nNormal.x -= dir.x * f * uniforms.wamplitudes.value[i] * wcos;
        nNormal.y -= dir.y * f * uniforms.wamplitudes.value[i] * wcos;
        nNormal.z -= nStp * wsin;
    }

    return {nPosition: nPosition, nNormal: nNormal.normalize() };
}

// Updates everything
function update() {
    if(parameters.tId === -1){
        passes[1].controls.enabled = true;
        passes[2].controls.enabled = false;
        const response = bounce(new THREE.Vector2(torusMesh.position.x, torusMesh.position.z));

        // Calculate theta and phi
        const theta = Math.atan2(response.nNormal.y, response.nNormal.x); // Rotation around the z-axis
        const phi = Math.acos(response.nNormal.z); // Rotation around the y-axis

        // Set the position of the mesh
        torusMesh.position.y = response.nPosition.z + 0.3;    

        // Apply the rotations to the mesh
        torusMesh.rotation.set(0, -theta, -phi);

    }
    else{
        passes[1].controls.enabled = false;
        passes[2].controls.enabled = true;
    }
    
    passes[1].controls.update();
    passes[2].controls.update();
    update3rdPassUniforms();
    updateFstPassUniforms();
    stats.update();
}

// Main Function
function main(){
    initGUI();
    
    initFstPass();
    initSndPass();
    init3rdPass();
    loadEnvMap ();
    

    const animate = () => {
        renderFstPass();
        if(parameters.tId === -1)
            renderSndPass();
        else
            render3rdPass();

        update();
        requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
}


///////////////////////////////////////
////////////// Events /////////////////
///////////////////////////////////////

window.addEventListener('resize', () => {
    passes[1].camera.aspect = window.innerWidth / window.innerHeight;
    passes[1].camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


///////////////////////////////////////
////////////// Main /////////////////
///////////////////////////////////////
main();
