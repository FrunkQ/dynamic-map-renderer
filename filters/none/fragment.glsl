// filters/none/fragment.glsl
// Version: 1.1
#ifdef GL_ES
precision mediump float;
#endif
uniform sampler2D mapTexture;
uniform float uInvertDisplay; // Added uniform
varying vec2 vUv;

void main() {
    vec4 color = texture2D(mapTexture, vUv);
    if (color.a < 0.01) discard;

    // Invert color if requested
    if (uInvertDisplay > 0.5) {
        color.rgb = 1.0 - color.rgb;
    }

    gl_FragColor = color;
}
