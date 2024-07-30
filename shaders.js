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
        vec3 nPos = texture(tPosition, uv).xyz; 
        vec3 nNor = texture(tNormal, uv).xyz;
        
        // World position and normal
        wPos = (modelMatrix * vec4(position + nPos, 1.0)).xyz;
        wNor = normalize(transpose(inverse(mat3(modelMatrix))) * nNor.xyz);
        vUv = uv;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + nPos, 1.0);
    }
`;



export const sndPassFShader = ` 
    precision highp float;
    precision highp int;
    layout(location = 0) out vec4 pc_FragColor;

    uniform sampler2D envMap;
    uniform vec3 color;     // Surface Diffuse color

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

        pc_FragColor = vec4(texture(envMap, dirToUv(R)).rgb, 1.0);
    }
`;


export const sndPassFShaderPbr = ` 
    precision highp float;
    precision highp int;
    layout(location = 0) out vec4 pc_FragColor;

    uniform sampler2D envMap;
    uniform int scount;     // Sample count for pbr
    uniform vec3 color;     // Surface Diffuse color
    uniform vec3 fcolor;    // Specular Color
    uniform float roughness; // Roughenss of the surface

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

    /**
     Used for creating a bias from the given point.
    */
    uint base_hash(uvec2 p) {
        p = 1103515245U*((p >> 1U)^(p.yx));
        uint h32 = 1103515245U*((p.x)^(p.y>>3U));
        return h32^(h32 >> 16);
    }

    /**
     An implementation of Holton sequence which is uniformly distributed function.
    */
    vec2 PseudoRandom2D(in int i){
        return fract(vec2(i*ivec2(12664745, 9560333))/exp2(24.0));
    }

    float reitz_distribution_GGX(vec3 N, vec3 H, float a)
    {
        float a2     = a*a;
        float NdotH  = max(dot(N, H), 0.0);
        float NdotH2 = NdotH*NdotH;
        
        float nom    = a2;
        float denom  = (NdotH2 * (a2 - 1.0) + 1.0);
        denom        = PI * denom * denom;
        
        return nom / denom;
    }


    float schlick_geometry_GGX(vec3 N, vec3 V, float k)
    {
        float NdotV = max(dot(N, V), 0.0);
        float nom   = NdotV;
        float denom = NdotV * (1.0 - k) + k;
        
        return nom / denom;
    }

    float smith_schlick_geometry(vec3 N, vec3 V, vec3 L, float k)
    {
        return schlick_geometry_GGX(N,V,k) *  schlick_geometry_GGX(N,L,k);
    }

    vec3 schlick_frasnel(vec3 N, vec3 V, vec3 F0)
    {   
        return F0 + (1.0 - F0) * pow(1.0 - dot(N,V), 5.0);
    }


    vec3 render(vec3 R, vec3 N, vec3 I, mat3 w2lMatrix){
        vec3 L_ = texture(envMap, dirToUv(R)).rgb;  // Incoming light color

        vec3 H = normalize(R+I);
        vec3 F = schlick_frasnel(N, I, fcolor);
        float D = reitz_distribution_GGX(N, H, roughness);
        float G = smith_schlick_geometry(N, I, H, roughness*roughness/2.);
        
        vec3 specular = F*D*G/(4.* dot(R,N)*dot(I,N));
        vec3 diffuse = color.rgb/PI; 

        return L_*dot(I,N)*(diffuse + specular);
    }

    /*Calculates the color based on specific pbr*/
    vec3 pbr(vec3 I, vec3 R, vec3 N){
        vec3 X = normalize(cross(I,N));
        vec3 Y = normalize(cross(X,N));
        mat3 lMatrix = mat3(X,N,Y);                     // Local matrix of the normal (The 'normal' space)
        mat3 w2lMatrix = transpose(lMatrix);            // World to Local Matrix (brings the 'world' to 'normal' space)
        
        vec3 L = render(R, N, I, w2lMatrix);         // Perfect Reflection Contribution
        
        // Monte-Carlo Sampling..
        int bias = int(base_hash(floatBitsToUint(vUv))); 
        for(int i = bias; i < scount + bias - 1; i++){
            vec2 hl = PseudoRandom2D(i);
            float ourV_sqrt = sqrt(1. -  hl.y* hl.y);
            vec3 R_ = normalize( lMatrix * vec3( ourV_sqrt*cos(2.*PI *  hl.x), hl.y, ourV_sqrt*sin(2.*PI *  hl.x)));
            L += render(R_, N, I, w2lMatrix) / (float(scount));
        } 
        return L;
    }

    void main() {
        vec3 I = normalize(wPos - cameraPosition);
        vec3 R = reflect(I, normalize(wNor));
        vec3 N = wNor;
        
        vec3 L = pbr(I, R, N);
        
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