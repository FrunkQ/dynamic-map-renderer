// filters/retro_sci_fi_amber/fragment.glsl
// Version: 1.0 (Based on Green v1.8, modified tint)
#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D mapTexture;
// Filter uniforms
uniform float uScanlineIntensity;
uniform float uStaticAmount;
uniform float uCrtWarp;
uniform float uBrightness;
uniform float uContrast;
uniform float uAmberTint; // Specific to this version (replaces greenTint)
uniform float uVignetteAmount;
uniform float uInvertColors;
uniform float uFlicker;
uniform float uPictureRoll;
uniform float uDistortion;
uniform float uInterference;
uniform float uSkew;
uniform float uChromaticAberration;
uniform float uHumBarIntensity;
uniform float uRoundedCorners;
uniform float uWobbleSpeed;
uniform float uWobbleFrequency;
uniform float uWobbleAmplitude;
// System uniforms
uniform vec2 resolution;
uniform float time;

varying vec2 vUv; // Original UV from vertex shader

// Simple pseudo-random noise function
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// --- Effect Functions ---
float scanline(vec2 screenCoord, float intensity) {
    float lineFactor = mod(screenCoord.y * 0.5, 2.0);
    return 1.0 - smoothstep(0.9, 1.1, lineFactor) * intensity;
}

float vignette(vec2 uv, float amount) {
     uv = uv - 0.5;
     float radius = 0.75 - amount * 0.4;
     float softness = 0.4;
     return smoothstep(radius + softness, radius - softness, length(uv));
}

vec2 barrelDistortion(vec2 uv, float amount) {
    vec2 centeredUv = uv * 2.0 - 1.0;
    float distSq = dot(centeredUv, centeredUv);
    vec2 warpedUv = centeredUv * (1.0 + amount * distSq);
    return (warpedUv + 1.0) / 2.0;
}

float roundedCornerSDFMask(vec2 uv, float radius) {
    vec2 p = uv - 0.5;
    vec2 b = vec2(0.5 - radius);
    float d = length(max(abs(p) - b, 0.0)) - radius;
    return 1.0 - smoothstep(-0.005, 0.005, d);
}


void main() {
     // --- 1. Calculate final UV coordinates for sampling ---
     vec2 finalUv = vUv;
     finalUv = barrelDistortion(finalUv, uCrtWarp);
     if (finalUv.x < -0.2 || finalUv.x > 1.2 || finalUv.y < -0.2 || finalUv.y > 1.2) discard;
     finalUv.y = fract(finalUv.y + time * uPictureRoll);
     finalUv.x += (finalUv.y - 0.5) * uSkew;
     float distortionOffset = (random(vec2(finalUv.y * 15.0, time * 0.4)) - 0.5) * uDistortion;
     finalUv.x += distortionOffset;
     float wobbleOffset = sin(finalUv.y * uWobbleFrequency + time * uWobbleSpeed) * uWobbleAmplitude;
     finalUv.x += wobbleOffset;
     vec2 sampleUv = fract(finalUv);

     // --- 2. Sample Texture (with Chromatic Aberration) ---
     vec2 centerOffs = vUv - 0.5;
     float aberrDist = length(centerOffs);
     vec2 aberrDir = (aberrDist > 0.0001) ? normalize(centerOffs) : vec2(0.0);
     vec2 aberrOffs = aberrDir * uChromaticAberration * aberrDist;
     float r = texture2D(mapTexture, fract(sampleUv + aberrOffs)).r;
     float g = texture2D(mapTexture, fract(sampleUv)).g;
     float b = texture2D(mapTexture, fract(sampleUv - aberrOffs)).b;
     vec4 baseColor = texture2D(mapTexture, sampleUv);
     vec3 aberrColor = vec3(r, g, b);
     if (baseColor.a < 0.01) discard;

     // --- 3. Apply Color Effects ---
     float luminance = dot(aberrColor.rgb, vec3(0.299, 0.587, 0.114));
     if (uInvertColors > 0.5) {
         luminance = 1.0 - luminance;
     }

     // Apply Amber Tint (Specific to this filter version)
     // Mix luminance with an amber color (e.g., orange-yellow)
     vec3 amberBase = vec3(1.0, 0.65, 0.1); // Base amber color
     vec3 tintedColor = mix(vec3(luminance), amberBase * luminance, uAmberTint);
     // Alternative: vec3 tintedColor = vec3(luminance, luminance * (1.0 - uAmberTint * 0.4), luminance * (1.0 - uAmberTint * 0.9));


     // Brightness & Contrast
     tintedColor = (tintedColor - 0.5) * uContrast + 0.5;
     tintedColor = tintedColor * uBrightness;

     // Scanlines
     float scan = scanline(gl_FragCoord.xy, uScanlineIntensity);
     tintedColor *= scan;

     // Static Noise
     float staticNoise = (random(sampleUv * 2.5 + vec2(time * 0.2, -time * 0.1)) - 0.5);
     tintedColor += staticNoise * uStaticAmount * 1.5;

     // Interference (Make blotches amberish)
     float interferenceNoise = random(sampleUv * 0.6 + time * 0.05);
     float interferenceFactor = smoothstep(0.75 - uInterference * 0.2, 0.75 + uInterference * 0.2, interferenceNoise);
     tintedColor += interferenceFactor * uInterference * amberBase * 0.8; // Add amber blotches

     // Flicker
     float flickerAmount = (random(vec2(time * 8.0)) - 0.5) * uFlicker;
     tintedColor += flickerAmount;

     // Hum Bar
     float hum = sin(vUv.y * 20.0 + time * 3.0) * 0.5 + 0.5;
     tintedColor += hum * uHumBarIntensity * 0.05;

     // Vignette
     tintedColor *= vignette(vUv, uVignetteAmount);

     // --- 4. Final Masking & Output ---
     float cornerMask = roundedCornerSDFMask(vUv, uRoundedCorners);
     tintedColor *= cornerMask;
     float finalAlpha = baseColor.a * cornerMask;

     if (finalAlpha < 0.01) discard;

     tintedColor = clamp(tintedColor, 0.0, 1.0);

     gl_FragColor = vec4(tintedColor, finalAlpha);
}
