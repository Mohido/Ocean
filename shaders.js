/**
 * Generates a vertex shader and returns it
 * 
 * @param {number} maxCount refers to the maximum number of waves the vertex shader will expect
 * @returns vertex shader as text
 */
export const fstPassVShader = (maxCount) => 
`
    uniform float time; 

    uniform int wcount;
    uniform float wlengths[${maxCount}];
    uniform float wspeeds[${maxCount}];
    uniform float wamplitudes[${maxCount}];
    uniform float wdirs[${maxCount*2}];
    uniform float wsteepnesses[${maxCount}];

    varying vec3 nNormal;
    varying vec3 nPosition;

    void main() {
        nPosition = position.xyz;
        nNormal = normal.xyz;

        for(int i = 0 ; i < wcount ; i++){
            // Pis in a cycle
            float l_pi2 = wlengths[i] / PI2;
            
            // Vertices on the same line are projected
            vec2 dir = normalize(vec2(wdirs[i*2], wdirs[i*2+1]));
            float dp = dot(dir, position.xy);

            // frequency of the wave
            float f = PI2/wlengths[i];

            // phase = speed*frequney*time
            float p = wspeeds[i] * f * time;

            // wave cos
            float wcos = cos(f*dp + p);
            float wsin = sin(dp*f + p);
            float nAmp = (wamplitudes[i] / float(wcount));
            float nStp = (wsteepnesses[i] / float(wcount));

            nPosition.x += nStp * l_pi2 * dir.x * wcos;
            nPosition.y +=  nStp * l_pi2 * dir.y * wcos;
            // nPos.z +=  nAmp * wsin;
            nPosition.z += wamplitudes[i] * wsin;

            nNormal.x -= dir.x * f * wamplitudes[i] * wcos;
            nNormal.y -= dir.y * f * wamplitudes[i] * wcos;
            nNormal.z -= nStp * wsin;
        }
        nNormal = normalize(nNormal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;


export const fstPassFShader = (maxCount) => 
`
    precision highp float;
    precision highp int;

    uniform int wcount;
    uniform float wlengths[${maxCount}];
    uniform float wspeeds[${maxCount}];
    uniform float wamplitudes[${maxCount}];
    uniform float wdirs[${maxCount*2}];
    uniform float wsteepnesses[${maxCount}];


    // layout(location = 0) out vec4 pc_FragColor;
    layout(location = 0) out vec4 tPosition;
    layout(location = 1) out vec4 tNormal;

    varying vec3 nNormal;
    varying vec3 nPosition;

    void main() {
        tPosition = vec4(nPosition, 1.0);               // Red 
        tNormal = vec4(nNormal, 1.0);                   // Green
        // pc_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
    }
`;


//////////////////////////////


export const sndPassVShader =  `
    uniform sampler2D tPosition;
    uniform sampler2D tNormal;    

    varying vec3 wPos; // World position
    varying vec3 wNor; // World position
    varying vec2 vUv;

    void main() {
        // Local new position and normal
        vec3 nPos = texture(tPosition, uv).xzy + position.xyz; 
        vec3 nNor = texture(tNormal, uv).xyz;
        
        // World position and normal
        wPos = (modelMatrix * vec4(nPos, 1.0)).xyz;
        wNor = normalize(transpose(inverse(mat3(modelMatrix))) * nNor.xyz);
        vUv = uv;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(nPos, 1.0);
    }
`;



export const sndPassFShader = ` 
    precision highp float;
    precision highp int;
    layout(location = 0) out vec4 pc_FragColor;

    uniform sampler2D envMap;
    uniform vec3 color;     // Surface Diffuse color
    uniform float roughness; // surface roughness
    varying vec3 wPos;
    varying vec3 wNor;
    varying vec2 vUv;

    vec2 dirToUv(vec3 R){
        // Convert reflection vector to spherical coordinates
        float theta = atan(R.z, R.x); // Longitude
        float phi = acos(R.y); // Latitude

        // Convert spherical coordinates to UV coordinates
        float u = (theta / PI2) + 0.5;
        float v = phi / PI;
        
        return vec2(u,v);
    }

    void main() {
        vec3 I = normalize(wPos - cameraPosition);
        vec3 R = reflect(I, normalize(wNor));
        vec3 L_ = texture(envMap, dirToUv(R)).rgb;

        vec3 L = color/PI + L_*(1.0 - roughness);
        pc_FragColor = vec4(L, 1.0);
    }
`;


////////////////////////////////


export const thrPassVShader = `
varying vec2 vUv;

void main() {
    vUv = position.xy + vec2(0.5) ;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;


export const thrPassFShader = `
precision highp float;
precision highp int;

uniform int tId;                // Which texture to render
uniform sampler2D tPosition;
uniform sampler2D tNormal;

varying vec2 vUv;

layout(location = 0) out vec4 pc_FragColor;

void main() {
    if(vUv.x > 1.0 || vUv.y > 1.0)
        pc_FragColor = vec4(0.0,0.0,0.0,1.0);
    else if(tId == 0)
        pc_FragColor = vec4(texture(tPosition, vUv).rgb, 1.0);
    else
        pc_FragColor = vec4(texture(tNormal, vUv).rgb, 1.0);
}

`;