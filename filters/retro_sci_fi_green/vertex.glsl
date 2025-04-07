// filters/retro_sci_fi_green/vertex.glsl
// Version: 1.2
varying vec2 vUv;

void main() {
    vUv = uv; // Pass original UVs
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
