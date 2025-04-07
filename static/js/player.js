// static/js/player.js
// Version: 1.24 (Revert - Init/Connect/Receive Initial State)
// Logic for Player view

// --- Global Variables ---
let scene, camera, renderer, planeMesh, material;
let socket = null;
let currentSessionId = null;
let textureLoader = new THREE.TextureLoader();
let clock = new THREE.Clock();
let currentFilterId = 'none';
let isRenderingPaused = false;
let filterDefinitions = {}; // Stores { filterId: { config: {...}, vertexShader: "...", fragmentShader: "..." } }
let currentViewState = {};
let currentFilterParams = {};
let currentMapContentPath = null;

// --- DOM Elements ---
const canvas = document.getElementById('player-canvas');
const statusDiv = document.getElementById('status');


// --- Initialization ---
async function init() {
    console.log("Player View Initializing (v1.24 Revert)...");

    textureLoader.setPath('/'); // Set base path for texture loading

    // Get Session ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentSessionId = urlParams.get('session');
    if (!currentSessionId) {
        displayStatus("ERROR: No session ID found in URL (?session=... is required)");
        console.error("No session ID found in URL.");
        document.body.innerHTML = `<p style="color:red; font-size: 1.2em; padding: 20px;">ERROR: No session ID found in URL (?session=... is required)</p>`;
        return;
    }
    displayStatus(`Initializing Session: ${currentSessionId}...`);
    console.log(`Player joining session: ${currentSessionId}`);

    // Load Filter Definitions first
    console.log("Calling loadAllFilterConfigs()...");
    try {
        await loadAllFilterConfigs();
        console.log("Finished loadAllFilterConfigs().");
    } catch (error) {
        console.error("Failed to load filter configs during init:", error);
        // Continue initialization, but filters might not work
    }


    // Scene, Camera, Renderer Setup
    console.log("Setting up Scene, Camera, Renderer...");
    scene = new THREE.Scene();
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 0.1, 100);
    camera.position.z = 10;
    try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0); // Transparent background for canvas
    } catch (error) {
        console.error("WebGL Initialization failed:", error);
        displayStatus("ERROR: WebGL failed to initialize.");
        isRenderingPaused = true; return;
     }
    console.log("Scene, Camera, Renderer setup complete.");


    // Material Setup
    console.log("Setting up Material...");
    const commonUniforms = {
         resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
         time: { value: 0.0 }
    };
    const initialVertexShader = getBasicVertexShader();
    const initialFragmentShader = getBasicFragmentShader();
    if (!initialVertexShader || !initialFragmentShader) {
        console.error("CRITICAL: Basic shaders failed to define!");
        displayStatus("ERROR: Failed to initialize rendering shaders.");
        isRenderingPaused = true; return;
    }
    console.log("Basic shaders obtained.");
    try {
        material = new THREE.ShaderMaterial({
            uniforms: { ...commonUniforms, mapTexture: { value: null } },
            vertexShader: initialVertexShader,
            fragmentShader: initialFragmentShader,
            transparent: true, depthWrite: false, side: THREE.DoubleSide
        });
        console.log("THREE.ShaderMaterial created.");
        material.addEventListener('error', (e) => {
            console.error(`SHADER ERROR for filter ${currentFilterId}:`, e.error);
            displayStatus(`ERROR: Shader failed for filter ${currentFilterId}. Reverting.`);
            const basicVert = getBasicVertexShader(); const basicFrag = getBasicFragmentShader();
            if (basicVert && basicFrag) { material.vertexShader = basicVert; material.fragmentShader = basicFrag; material.needsUpdate = true; }
            currentFilterId = 'none_fallback';
        });
    } catch (error) {
        console.error("Error creating initial ShaderMaterial:", error);
        displayStatus("ERROR: Failed to create rendering material.");
        isRenderingPaused = true; return;
    }
    console.log("Material setup complete.");


    // Geometry and Mesh
    console.log("Setting up Geometry and Mesh...");
    const geometry = new THREE.PlaneGeometry(1, 1);
    planeMesh = new THREE.Mesh(geometry, material);
    planeMesh.position.z = 0; planeMesh.visible = false; scene.add(planeMesh);
    console.log("Geometry and Mesh setup complete.");


    // Event Listeners and Connection
    console.log("Adding resize listener...");
    window.addEventListener('resize', onWindowResize, false);

    console.log("Calling connectWebSocket()...");
    connectWebSocket(); // Attempt connection
    console.log("Called connectWebSocket(). Starting animation loop...");

    animate();
    console.log("Initialization sequence complete.");
}

// --- Filter Definition Loading ---
async function loadAllFilterConfigs() {
    console.log("[loadAllFilterConfigs] Fetching filter configurations...");
    try {
        const response = await fetch('/api/filters');
        console.log("[loadAllFilterConfigs] Fetch complete. Status:", response.status, "Ok:", response.ok);
        if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status}`); }
        const jsonData = await response.json();
        console.log("[loadAllFilterConfigs] JSON parsed successfully.");
        // Assign fetched data to the global variable
        filterDefinitions = jsonData || {};
        console.log("[loadAllFilterConfigs] Filter configurations assigned:", Object.keys(filterDefinitions));
    } catch (error) {
        console.error("[loadAllFilterConfigs] Error fetching or parsing filter configs:", error);
        displayStatus("ERROR: Could not load filter definitions.");
        filterDefinitions = {}; // Ensure it's an object on error
        // Optionally re-throw if init should halt on filter load failure
        // throw error;
    }
    console.log("[loadAllFilterConfigs] Function finished.");
}

async function loadFilterShaders(filterId) {
     // Check if config exists in our loaded definitions
     if (!filterDefinitions[filterId]) {
         console.warn(`Config missing for filter '${filterId}'. Cannot load shaders.`);
         // Optionally try reloading all configs again? For now, just fail.
         // await loadAllFilterConfigs();
         // if (!filterDefinitions[filterId]) {
             displayStatus(`ERROR: Config missing for filter ${filterId}.`);
             return false;
         // }
     }
     // Check if shaders are already loaded (cached in the definition object)
     if (filterDefinitions[filterId].vertexShader && filterDefinitions[filterId].fragmentShader) {
         // console.log(`Shaders already loaded for filter: ${filterId}`);
         return true;
     }

     console.log(`Fetching shaders for filter: ${filterId}`);
     try {
         const vertPath = `/filters/${encodeURIComponent(filterId)}/vertex.glsl`;
         const fragPath = `/filters/${encodeURIComponent(filterId)}/fragment.glsl`;
         const [vertResponse, fragResponse] = await Promise.all([fetch(vertPath), fetch(fragPath)]);
         if (!vertResponse.ok) throw new Error(`Vert fetch failed (${vertResponse.status})`);
         if (!fragResponse.ok) throw new Error(`Frag fetch failed (${fragResponse.status})`);
         const [vertexShader, fragmentShader] = await Promise.all([vertResponse.text(), fragResponse.text()]);
         // Store loaded shaders back into the definition object
         filterDefinitions[filterId].vertexShader = vertexShader;
         filterDefinitions[filterId].fragmentShader = fragmentShader;
         console.log(`Shaders loaded successfully for ${filterId}`);
         return true;
     } catch (error) {
         console.error(`Error loading shaders for ${filterId}:`, error);
         displayStatus(`ERROR loading shaders for ${filterId}.`);
         delete filterDefinitions[filterId].vertexShader;
         delete filterDefinitions[filterId].fragmentShader;
         return false;
     }
}

// --- WebSocket Handling ---
function connectWebSocket() {
    console.log("--- connectWebSocket() called ---");
    if (!currentSessionId) { console.error("WS Error: No Session ID."); return; }
    console.log(`Checking for Socket.IO library (typeof io): ${typeof io}`);
    if (typeof io === 'undefined') { console.error("WS Error: Socket.IO library not loaded!"); return; }
    console.log(`Attempting WebSocket connection for session: ${currentSessionId}...`);
    try {
        socket = io(); // Connect
        console.log("Socket.IO object created:", socket);
    } catch (error) { console.error("Error initializing Socket.IO connection:", error); return; }
    console.log("Setting up Socket.IO event handlers...");
    socket.on('connect', () => { console.log(`WebSocket connected: ${socket.id}`); displayStatus(`Connected.`); socket.emit('join_session', { session_id: currentSessionId }); });
    socket.on('disconnect', (reason) => { console.warn(`WebSocket disconnected: ${reason}`); displayStatus(`Disconnected.`); });
    socket.on('connect_error', (error) => { console.error('WebSocket connection error:', error); displayStatus(`Connection Error.`); });
    socket.on('state_update', handleStateUpdate);
    socket.on('error', (data) => { console.error('Server WS Error:', data.message || data); displayStatus(`SERVER ERROR.`); });
    console.log("WebSocket event handlers set up.");
}


// --- State Update Handler ---
async function handleStateUpdate(state) {
    console.log('[handleStateUpdate] Received state:', JSON.stringify(state));
    if (!state || typeof state !== 'object') { console.error("Invalid state received."); return; }
    displayStatus("Applying state..."); isRenderingPaused = false;
    currentViewState = state.view_state || { center_x: 0.5, center_y: 0.5, scale: 1.0 };
    const newFilterId = state.current_filter || 'none';
    const newContentPath = state.map_content_path || null;
    console.log(`[handleStateUpdate] Processing: Path='${newContentPath}', Filter='${newFilterId}'`);
    // Update filter params based on received state
    if (state.filter_params && state.filter_params[newFilterId]) { currentFilterParams = state.filter_params[newFilterId]; }
    else { const filterConfig = filterDefinitions[newFilterId]; currentFilterParams = {}; if (filterConfig?.params) { for (const key in filterConfig.params) { if (filterConfig.params[key].value !== undefined) { currentFilterParams[key] = filterConfig.params[key].value; } } } }
    currentFilterParams = currentFilterParams || {};

    try {
        let shaderChanged = false; let shadersOk = true;
        // 1. Update Shaders if needed
        if (newFilterId !== currentFilterId || !filterDefinitions[newFilterId]?.vertexShader) {
            console.log(`Filter change/load: ${currentFilterId} -> ${newFilterId}`);
            shadersOk = await loadFilterShaders(newFilterId);
            if (!shadersOk) { /* Fallback to basic */ material.vertexShader = getBasicVertexShader(); material.fragmentShader = getBasicFragmentShader(); currentFilterId = 'none_fallback'; shaderChanged = true; }
            else { /* Assign new shaders */ const newVert = filterDefinitions[newFilterId].vertexShader; const newFrag = filterDefinitions[newFilterId].fragmentShader; if(material.vertexShader !== newVert){ material.vertexShader = newVert; shaderChanged = true; } if(material.fragmentShader !== newFrag){ material.fragmentShader = newFrag; shaderChanged = true; } currentFilterId = newFilterId; }
        }
        // 2. Update Uniforms
        const filterConfig = filterDefinitions[currentFilterId]; // Use potentially updated currentFilterId
        if (shadersOk && filterConfig) { updateUniformsForMaterial(material, filterConfig, currentFilterParams); }
        else { cleanupUniforms(material, null); }
        if (shaderChanged) { material.needsUpdate = true; console.log("Shader material marked for update.");}

        // 3. Update Texture if path changed
        if (newContentPath !== currentMapContentPath) {
            console.log(`Content path change: ${currentMapContentPath} -> ${newContentPath}`);
            await updateTexture(newContentPath, material, 'foreground'); // Load new texture or clear if null
            currentMapContentPath = newContentPath;
        } else {
             // Ensure plane visibility matches texture state even if path didn't change
             planeMesh.visible = material.uniforms.mapTexture.value !== null;
        }
        // 4. Update Camera
        updateCameraView(currentViewState);
        console.log("[handleStateUpdate] Update applied successfully."); displayStatus("");
    } catch (error) { console.error("[handleStateUpdate] Error applying state:", error); displayStatus(`ERROR applying state.`); }
}

// --- Uniform Handling ---
function updateUniformsForMaterial(targetMaterial, filterConfig, paramsForFilter) {
    const expectedUniforms = new Set(['mapTexture', 'resolution', 'time']); const currentUniforms = targetMaterial.uniforms; let uniformsChanged = false;
    if (filterConfig?.params) { for (const paramKey in filterConfig.params) { const paramDef = filterConfig.params[paramKey]; if (paramKey === 'backgroundImageFilename') continue; const uniformName = `u${paramKey.charAt(0).toUpperCase() + paramKey.slice(1)}`; expectedUniforms.add(uniformName); const value = paramsForFilter?.[paramKey] ?? paramDef.value ?? null; if (typeof value === 'number' && isFinite(value)) { if (!currentUniforms[uniformName]) { currentUniforms[uniformName] = { value: value }; uniformsChanged = true; } else if (currentUniforms[uniformName].value !== value) { currentUniforms[uniformName].value = value; uniformsChanged = true; } } else { if (currentUniforms[uniformName] && currentUniforms[uniformName].value !== null) { currentUniforms[uniformName].value = null; uniformsChanged = true; } } } }
    if (cleanupUniforms(targetMaterial, expectedUniforms)) { uniformsChanged = true; }
}
function cleanupUniforms(targetMaterial, expectedUniformSet) {
     const baseUniforms = ['mapTexture', 'resolution', 'time']; let removed = false;
     for (const uniformName in targetMaterial.uniforms) { if (baseUniforms.includes(uniformName)) continue; if (expectedUniformSet && !expectedUniformSet.has(uniformName)) { delete targetMaterial.uniforms[uniformName]; removed = true; } else if (!expectedUniformSet) { delete targetMaterial.uniforms[uniformName]; removed = true; } } return removed;
}

// --- Texture Handling ---
async function updateTexture(newTexturePath, targetMaterial, logPrefix = 'texture') {
    let aspectChanged = false; const currentUniformValue = targetMaterial.uniforms.mapTexture?.value; const currentUniformSrc = currentUniformValue?.image?.src || null; const potentialFullUrl = newTexturePath ? new URL(newTexturePath, window.location.origin).href : null; const pathChanged = currentUniformSrc !== potentialFullUrl;
    console.log(`[updateTexture] Called. Path: ${newTexturePath}, PathChanged: ${pathChanged}`);
    if (!newTexturePath) { if (currentUniformValue) { console.log(`[updateTexture] Clearing texture.`); currentUniformValue.dispose(); targetMaterial.uniforms.mapTexture.value = null; if (planeMesh) { planeMesh.scale.set(1, 1, 1); planeMesh.visible = false; aspectChanged = true; } } return Promise.resolve(aspectChanged); }
    if (pathChanged) { console.log(`[updateTexture] Loading new texture: ${newTexturePath}`); displayStatus(`Loading map...`); return new Promise((resolve, reject) => { textureLoader.load(newTexturePath, (texture) => { try { const texImg = texture.image; console.log(`[updateTexture] onLoad: Success. Path: ${newTexturePath}`, texImg); if (targetMaterial?.uniforms?.mapTexture) { if (targetMaterial.uniforms.mapTexture.value) targetMaterial.uniforms.mapTexture.value.dispose(); targetMaterial.uniforms.mapTexture.value = texture; texture.needsUpdate = true; if (texImg?.naturalWidth > 0 && texImg?.naturalHeight > 0) { const textureAspect = texImg.naturalWidth / texImg.naturalHeight; if (planeMesh.scale.x !== textureAspect || planeMesh.scale.y !== 1.0) { planeMesh.scale.set(textureAspect, 1.0, 1.0); aspectChanged = true; console.log(`[updateTexture] onLoad: Plane aspect updated: ${textureAspect.toFixed(3)}`); } planeMesh.visible = true; console.log("[updateTexture] onLoad: Plane visible."); } else { console.warn("[updateTexture] onLoad: Invalid texture dims."); planeMesh.visible = false; } displayStatus(""); resolve(aspectChanged); } else { reject(new Error("Material missing")); } } catch(e) { reject(e); } }, undefined, (error) => { console.error(`[updateTexture] onError: Failed loading texture ${newTexturePath}`, error); displayStatus(`ERROR loading map.`); if (targetMaterial?.uniforms?.mapTexture) targetMaterial.uniforms.mapTexture.value = null; if (planeMesh) planeMesh.visible = false; reject(error); } ); });
    } else { console.log(`[updateTexture] Path unchanged.`); planeMesh.visible = targetMaterial.uniforms.mapTexture.value !== null; return Promise.resolve(false); }
}

// --- Camera Handling ---
function updateCameraView(viewState) {
    if (!viewState || typeof viewState.scale !== 'number' || typeof viewState.center_x !== 'number' || typeof viewState.center_y !== 'number') { viewState = { scale: 1.0, center_x: 0.5, center_y: 0.5 }; } if (!planeMesh || !camera) { return; } const planeWidth = planeMesh.scale.x; const planeHeight = planeMesh.scale.y; const effectiveScale = Math.max(0.01, viewState.scale); const viewHeight = planeHeight / effectiveScale; const viewWidth = viewHeight * (window.innerWidth / window.innerHeight); camera.left = -viewWidth / 2; camera.right = viewWidth / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; const offsetX = (viewState.center_x - 0.5) * planeWidth; const offsetY = -(viewState.center_y - 0.5) * planeHeight; camera.position.x = offsetX; camera.position.y = offsetY; camera.updateProjectionMatrix();
}

// --- Event Listeners & Animation Loop ---
function onWindowResize() {
    if (!camera || !renderer || !material) return; const width = window.innerWidth; const height = window.innerHeight; const aspect = width / height; const viewHeight = camera.top - camera.bottom; const viewWidth = viewHeight * aspect; camera.left = -viewWidth / 2; camera.right = viewWidth / 2; camera.updateProjectionMatrix(); renderer.setSize(width, height); if (material?.uniforms?.resolution) material.uniforms.resolution.value.set(width, height);
}
function animate() {
    requestAnimationFrame(animate); if (isRenderingPaused || !renderer || !scene || !camera) return; const elapsedTime = clock.getElapsedTime(); if (material?.uniforms?.time) material.uniforms.time.value = elapsedTime; try { renderer.render(scene, camera); } catch (e) { console.error("Render loop error:", e); displayStatus(`ERROR rendering.`); isRenderingPaused = true; }
}

// --- Utility & Fallbacks ---
function displayStatus(message) { if (statusDiv) { statusDiv.textContent = message; statusDiv.style.display = message ? 'block' : 'none'; } }
// Ensure shader functions are implemented
function getBasicVertexShader() {
    return `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;
}
function getBasicFragmentShader() {
    return `
        #ifdef GL_ES
        precision mediump float;
        #endif
        uniform sampler2D mapTexture;
        varying vec2 vUv;
        void main() {
            vec4 texColor = texture2D(mapTexture, vUv);
            if (texColor.a < 0.01) { discard; }
            gl_FragColor = texColor;
        }
    `;
}

// --- Start Application ---
document.addEventListener('DOMContentLoaded', init);

