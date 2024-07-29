export const fstPassVShader = `
    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;


export const fstPassFShader = `
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
`;


//////////////////////////////


export const sndPassVShader =  `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;



export const sndPassFShader = ` 
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
`;