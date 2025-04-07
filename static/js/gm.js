// static/js/gm.js
// Version: 1.52 (Restore Event Listeners, Handlers, and ResetUI)

// --- Global Variables ---
const currentSessionId = "my-game"; // Hardcoded Session ID
let availableFilters = {};
let mapList = [];
let currentState = {};
let socket = null;
let currentMapFilename = null; // Added back

// --- DOM Elements ---
const filterSelect = document.getElementById('filter-select');
const mapSelect = document.getElementById('map-select');
const playerUrlDisplay = document.getElementById('player-url-display');
const gmMapDisplay = document.getElementById('gm-map-display'); // Added back
const gmMapImage = document.getElementById('gm-map-image');     // Added back
const gmMapPlaceholder = document.getElementById('gm-map-placeholder'); // Added back
const filterControlsContainer = document.getElementById('filter-controls'); // Added back
const saveButton = document.getElementById('save-button');         // Added back
const mapUploadForm = document.getElementById('map-upload-form'); // Added back
const mapFileInput = document.getElementById('map-file-input');   // Added back
const uploadStatus = document.getElementById('upload-status');     // Added back
const copyPlayerUrlButton = document.getElementById('copy-player-url'); // Added back
const copyStatusDisplay = document.getElementById('copy-status');     // Added back
const viewXInput = document.getElementById('view-center-x'); // Added back
const viewYInput = document.getElementById('view-center-y'); // Added back
const viewScaleInput = document.getElementById('view-scale'); // Added back


console.log("DOM Element Refs Check -> filterSelect:", filterSelect);
console.log("DOM Element Refs Check -> mapSelect:", mapSelect);
console.log("DOM Element Refs Check -> playerUrlDisplay:", playerUrlDisplay);


// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("GM View Initializing (v1.52 - Restore Listeners & Handlers)..."); // Version updated

    console.log(`GM controlling HARDCODED Session ID: ${currentSessionId}`);

    console.log("Loading initial data (Filters and Maps)...");
    try {
        await loadAvailableFilters();
        populateFilterList();

        await populateMapList();
        console.log("Initial data loading and list population complete.");

        // *** ADDED BACK: Setup UI, WS, Listeners, Reset ***
        console.log("Setting up UI, WebSocket, Listeners...");
        updatePlayerUrlDisplay(); // Update URL display
        connectWebSocket();     // Connect WebSocket
        setupEventListeners();  // Attach event listeners
        resetUI();              // Reset UI to initial state
        // *** END ADDED BACK ***

        console.log("GM Initialization complete."); // Moved log

    } catch (error) {
        console.error("Error during initialization:", error);
        alert("Failed to load initial data. Check console.");
        resetUI(); // Attempt reset even on error
    }
});


// --- WebSocket Handling ---
// *** Full Implementation ***
function connectWebSocket() {
    console.log("--- connectWebSocket() called ---");
    if (typeof io === 'undefined') { console.error("WS Error: Socket.IO library not loaded!"); return; }
    console.log(`Attempting WebSocket connection...`);
    try { socket = io(); console.log("Socket.IO object created:", socket); }
    catch (error) { console.error("Error initializing Socket.IO connection:", error); return; }
    console.log("Setting up Socket.IO event handlers...");
    socket.on('connect', () => { console.log(`WebSocket connected: ${socket.id}`); });
    socket.on('disconnect', (reason) => { console.warn(`WebSocket disconnected: ${reason}`); });
    socket.on('connect_error', (error) => { console.error('WS connection error:', error); });
    socket.on('error', (data) => { console.error('Server WS Error:', data.message || data); });
    console.log("WebSocket event handlers set up.");
}

// --- Data Loading & UI Population ---
// *** Full Implementations ***
async function loadAvailableFilters() { console.log("[loadAvailableFilters] Fetching filter configurations..."); try { const response = await fetch('/api/filters'); console.log("[loadAvailableFilters] Fetch complete. Status:", response.status, "Ok:", response.ok); if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status}`); } const jsonData = await response.json(); console.log("[loadAvailableFilters] JSON parsed successfully."); availableFilters = jsonData || {}; console.log("[loadAvailableFilters] Filter configurations assigned:", Object.keys(availableFilters)); } catch (error) { console.error("[loadAvailableFilters] Error:", error); availableFilters = {}; throw error; } }
function populateFilterList() { console.log("Attempting to populate filter list..."); if (!filterSelect) { console.error("populateFilterList: filterSelect element not found!"); return; } filterSelect.innerHTML = ''; console.log(" -> Value of availableFilters inside populateFilterList:", availableFilters); if (!availableFilters || typeof availableFilters !== 'object' || Object.keys(availableFilters).length === 0) { console.warn("Cannot populate: availableFilters empty."); filterSelect.innerHTML = '<option value="">-- No Filters --</option>'; return; } let filterIds; try { filterIds = Object.keys(availableFilters); const sortedFilterIds = filterIds.sort((a, b) => { if (a === 'none') return -1; if (b === 'none') return 1; const filterA = availableFilters[a]; const filterB = availableFilters[b]; const nameA = (filterA && filterA.name) ? filterA.name : a; const nameB = (filterB && filterB.name) ? filterB.name : b; return nameA.localeCompare(nameB); }); console.log(" -> Sorted filter IDs:", sortedFilterIds); sortedFilterIds.forEach(filterId => { const filterData = availableFilters[filterId]; if (filterData) { addFilterOption(filterData.name || filterId, filterId); } else { console.warn(`Filter definition missing for ID: ${filterId}`); } }); console.log(`Filter options length AFTER loop: ${filterSelect.options.length}`); const defaultSelection = availableFilters['none'] ? 'none' : (sortedFilterIds[0] || ''); if (filterSelect.options.length > 0) { if (filterSelect.querySelector(`option[value="${defaultSelection}"]`)) { filterSelect.value = defaultSelection; } else { filterSelect.value = filterSelect.options[0].value; } } console.log("Filter list population complete. Final selection:", filterSelect.value); } catch (error) { console.error("Error during filter list population:", error); filterSelect.innerHTML = '<option value="">-- Error --</option>'; } }
async function populateMapList() { console.log("Fetching and populating map list..."); if (!mapSelect) { console.error("populateMapList: mapSelect not found!"); return; } mapSelect.innerHTML = '<option value="">-- Loading Maps --</option>'; try { const response = await fetch('/api/maps'); if (!response.ok) { throw new Error(`HTTP error! Status: ${response.status}`); } const mapData = await response.json(); mapList = mapData || []; console.log("Map list fetched:", mapList); mapSelect.innerHTML = '<option value="">-- Select Map --</option>'; if (mapList && mapList.length > 0) { mapList.forEach(addMapOption); console.log(`Map list populated with ${mapSelect.options.length - 1} options.`); } else { console.warn("No maps found."); mapSelect.innerHTML = '<option value="">-- No Maps --</option>'; } currentMapFilename = null; } catch (error) { console.error('Error fetching/populating map list:', error); mapSelect.innerHTML = '<option value="">-- Error --</option>'; mapList = []; throw error; } }
function addMapOption(filename) { if (!mapSelect) { return; } const option = document.createElement('option'); option.value = filename; option.textContent = filename; try { mapSelect.appendChild(option); } catch (error) { console.error(`Error appending map option ${filename}:`, error); } }
function addFilterOption(displayName, filterId) { if (!filterSelect) { return; } const option = document.createElement('option'); option.value = filterId; option.textContent = displayName; try { filterSelect.appendChild(option); } catch (error) { console.error(`!!! Error using filterSelect.appendChild() for option ${filterId}:`, error); } }

// --- UI Reset ---
// *** ADDED BACK ***
function resetUI() {
    console.log("Resetting GM UI elements...");
    if (gmMapImage) { gmMapImage.src = ''; gmMapImage.style.display = 'none'; } else { console.error("resetUI: gmMapImage missing"); }
    if (gmMapDisplay) { gmMapDisplay.style.display = 'none'; } else { console.error("resetUI: gmMapDisplay missing"); }
    if (gmMapPlaceholder) { gmMapPlaceholder.style.display = 'block'; gmMapPlaceholder.textContent = 'Select a map...'; } else { console.error("resetUI: gmMapPlaceholder missing"); }
    if (filterSelect && filterSelect.options.length > 0) { const defaultFilterId = availableFilters['none'] ? 'none' : (Object.keys(availableFilters)[0] || ''); if (filterSelect.querySelector(`option[value="${defaultFilterId}"]`)) { filterSelect.value = defaultFilterId; } else { filterSelect.value = filterSelect.options[0].value; } } else { console.warn("resetUI: Filter list not populated or missing."); }
    if(filterControlsContainer) { filterControlsContainer.innerHTML = '<p>Select map for filter params.</p>'; } else { console.error("resetUI: filterControlsContainer missing"); }
    if(viewXInput) viewXInput.disabled = true; else console.error("resetUI: viewXInput missing");
    if(viewYInput) viewYInput.disabled = true; else console.error("resetUI: viewYInput missing");
    if(viewScaleInput) viewScaleInput.disabled = true; else console.error("resetUI: viewScaleInput missing");
    if(saveButton) { saveButton.disabled = true; saveButton.title = "Select map first"; } else { console.error("resetUI: saveButton missing"); }
    const xSpan = viewXInput?.previousElementSibling?.querySelector('.slider-value'); const ySpan = viewYInput?.previousElementSibling?.querySelector('.slider-value'); const scaleSpan = viewScaleInput?.previousElementSibling?.querySelector('.slider-value');
    if (xSpan) xSpan.textContent = ` (0.50)`; if (ySpan) ySpan.textContent = ` (0.50)`; if (scaleSpan) scaleSpan.textContent = ` (1.00x)`;
    if (mapSelect && mapSelect.options.length > 0) { mapSelect.value = ""; } else { console.warn("resetUI: Map list not populated or missing."); }
    currentMapFilename = null; currentState = {};
    console.log(" -> resetUI complete.");
}
// *** END ADDED BACK ***

// *** ADDED BACK ***
async function loadMapDataForGM(filename) {
    if (!filename) { resetUI(); return; } currentMapFilename = filename; console.log(`Loading GM preview data for map: ${filename}`); if(gmMapPlaceholder) gmMapPlaceholder.style.display = 'none'; if(gmMapImage) gmMapImage.style.display = 'none'; if(gmMapDisplay) gmMapDisplay.style.display = 'flex'; try { const apiUrl = `/api/config/${encodeURIComponent(filename)}?t=${Date.now()}`; console.log(`Fetching config for GM preview: ${apiUrl}`); const configResponse = await fetch(apiUrl); if (!configResponse.ok) { throw new Error(`Config load failed (${configResponse.status})`); } const mapConfig = await configResponse.json(); console.log("Loaded map config for GM:", mapConfig); console.log(" -> Received view_state from config:", JSON.stringify(mapConfig?.view_state)); currentState = mapConfig; if (!currentState || typeof currentState !== 'object') throw new Error("Invalid config data."); currentState.view_state = currentState.view_state || { center_x: 0.5, center_y: 0.5, scale: 1.0 }; currentState.current_filter = currentState.current_filter || (availableFilters['none'] ? 'none' : Object.keys(availableFilters)[0] || ''); currentState.filter_params = currentState.filter_params || get_default_filter_params(); currentState.display_type = "image"; currentState.map_content_path = currentState.map_content_path || `maps/${filename}`; const imageUrl = currentState.map_content_path; if (!imageUrl) throw new Error("Map content path missing."); if(gmMapImage) { gmMapImage.src = imageUrl; gmMapImage.alt = `Preview of ${filename}`; gmMapImage.style.display = 'block'; } else { console.error("loadMapDataForGM: gmMapImage not found!");} if (availableFilters[currentState.current_filter]) { if(filterSelect) filterSelect.value = currentState.current_filter; else console.error("loadMapDataForGM: filterSelect not found!"); } updateFilterControls(); updateViewControls(); if(viewXInput) viewXInput.disabled = false; if(viewYInput) viewYInput.disabled = false; if(viewScaleInput) viewScaleInput.disabled = false; if(saveButton) { saveButton.disabled = false; saveButton.title = `Save settings to ${filename}_config.json`; } } catch (error) { console.error(`Error loading GM preview data for ${filename}:`, error); alert(`Error loading preview: ${error.message}`); resetUI(); }
}
// *** END ADDED BACK ***

// *** ADDED BACK ***
function updateFilterControls() {
    if (!filterControlsContainer) return; filterControlsContainer.innerHTML = ''; if (!currentState || !currentState.current_filter) { filterControlsContainer.innerHTML = '<p>Select map first.</p>'; return; } const filterId = currentState.current_filter; const filterDefinition = availableFilters[filterId]; if (!filterDefinition) { filterControlsContainer.innerHTML = `<p style="color:red;">Error: Filter definition missing.</p>`; return; } if (!filterDefinition.params || Object.keys(filterDefinition.params).length === 0) { filterControlsContainer.innerHTML = `<p>No parameters.</p>`; return; } const fieldset = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = `${filterDefinition.name || filterId} Params`; fieldset.appendChild(legend); currentState.filter_params = currentState.filter_params || {}; currentState.filter_params[filterId] = currentState.filter_params[filterId] || {}; const currentParamsForFilter = currentState.filter_params[filterId];
    for (const paramKey in filterDefinition.params) { if (paramKey === 'backgroundImageFilename') continue; const paramConfig = filterDefinition.params[paramKey]; const currentValue = currentParamsForFilter[paramKey] ?? paramConfig.value; if (currentParamsForFilter[paramKey] === undefined) { currentParamsForFilter[paramKey] = paramConfig.value; } const controlDiv = document.createElement('div'); const label = document.createElement('label'); label.htmlFor = `param-${paramKey}`; label.textContent = paramConfig.label || paramKey; let input; let valueSpan = null; if (paramConfig.min === 0 && paramConfig.max === 1 && paramConfig.step === 1) { input = document.createElement('input'); input.type = 'checkbox'; input.checked = (currentValue === 1.0 || currentValue === 1); label.style.display = 'inline-block'; input.style.verticalAlign = 'middle'; input.style.marginLeft = '5px'; input.style.width = 'auto'; label.appendChild(input); } else { input = document.createElement('input'); input.type = 'range'; input.min = paramConfig.min ?? 0; input.max = paramConfig.max ?? 1; input.step = paramConfig.step ?? 0.01; const numericValue = parseFloat(currentValue); input.value = isNaN(numericValue) ? paramConfig.value : Math.max(input.min, Math.min(input.max, numericValue)); valueSpan = document.createElement('span'); valueSpan.className = 'slider-value'; valueSpan.id = `param-value-${paramKey}`; valueSpan.textContent = ` (${parseFloat(input.value).toFixed(paramConfig?.step >= 0.1 ? 2 : 3)})`; label.appendChild(valueSpan); controlDiv.appendChild(label); controlDiv.appendChild(input); } input.id = `param-${paramKey}`; input.dataset.paramKey = paramKey; input.dataset.filterId = filterId; input.addEventListener('input', handleControlChange); input.addEventListener('change', handleControlChange); if (input.type === 'checkbox') { fieldset.appendChild(label); } else { fieldset.appendChild(controlDiv); } } filterControlsContainer.appendChild(fieldset);
}
// *** END ADDED BACK ***

// --- Event Handling ---
// *** ADDED BACK ***
function setupEventListeners() {
    console.log("--- Running setupEventListeners ---");
    // REMOVED Session ID Input Listener
    if (mapSelect) { mapSelect.addEventListener('change', handleMapSelectionChange); console.log(" -> Listener attached to mapSelect 'change'"); } else { console.error("setupEventListeners: mapSelect not found!"); }
    if (filterSelect) { filterSelect.addEventListener('change', handleFilterChange); console.log(" -> Listener attached to filterSelect 'change'"); } else { console.error("setupEventListeners: filterSelect not found!"); }
    if (saveButton) { saveButton.addEventListener('click', saveConfiguration); console.log(" -> Listener attached to saveButton 'click'"); } else { console.error("setupEventListeners: saveButton not found!"); }
    if (mapUploadForm) { mapUploadForm.addEventListener('submit', handleMapUpload); console.log(" -> Listener attached to mapUploadForm 'submit'"); } else { console.error("setupEventListeners: mapUploadForm not found!"); }
    if (viewXInput) { viewXInput.addEventListener('input', handleViewChange); console.log(" -> Listener attached to viewXInput 'input'"); } else { console.error("setupEventListeners: viewXInput not found!"); }
    if (viewYInput) { viewYInput.addEventListener('input', handleViewChange); console.log(" -> Listener attached to viewYInput 'input'"); } else { console.error("setupEventListeners: viewYInput not found!"); }
    if (viewScaleInput) { viewScaleInput.addEventListener('input', handleViewChange); console.log(" -> Listener attached to viewScaleInput 'input'"); } else { console.error("setupEventListeners: viewScaleInput not found!"); }
    if (copyPlayerUrlButton) { copyPlayerUrlButton.addEventListener('click', copyPlayerUrlToClipboard); console.log(" -> Listener attached to copyPlayerUrlButton 'click'"); } else { console.error("setupEventListeners: copyPlayerUrlButton not found!"); }
    console.log("--- setupEventListeners complete ---");
}
// *** END ADDED BACK ***


// Define Handlers
// *** ADDED BACK ***
async function handleMapSelectionChange(event) { console.log("--- handleMapSelectionChange Fired! ---"); const selectedFilename = event.target.value; if (!selectedFilename) { resetUI(); sendUpdate({ map_content_path: null, display_type: 'image' }); return; } console.log(`Map selected by GM: ${selectedFilename}`); const newPath = `maps/${selectedFilename}`; const newType = 'image'; console.log(`Sending content switch update: path=${newPath}, type=${newType}`); sendUpdate({ map_content_path: newPath, display_type: newType }); await loadMapDataForGM(selectedFilename); console.log(`GM preview updated for ${selectedFilename}`); }
function handleFilterChange(event) { console.log("--- handleFilterChange Fired! ---"); if (!currentMapFilename) { alert("Select map first."); event.target.value = currentState.current_filter || ''; return; } const newFilterId = event.target.value; console.log(`Filter selected: ${newFilterId}`); currentState.current_filter = newFilterId; currentState.filter_params = currentState.filter_params || {}; if (!currentState.filter_params[newFilterId]) { const filterDef = availableFilters[newFilterId]; currentState.filter_params[newFilterId] = {}; if (filterDef?.params) { for (const key in filterDef.params) { if (key !== 'backgroundImageFilename' && filterDef.params[key].value !== undefined) { currentState.filter_params[newFilterId][key] = filterDef.params[key].value; } } } } updateFilterControls(); const updatePayload = { current_filter: newFilterId, filter_params: { [newFilterId]: currentState.filter_params[newFilterId] || {} } }; sendUpdate(updatePayload); }
async function handleMapUpload(event) { console.log("--- handleMapUpload Fired! ---"); event.preventDefault(); if (!mapFileInput || !mapFileInput.files || mapFileInput.files.length === 0) { uploadStatus.textContent = 'Select file.'; uploadStatus.style.color = 'orange'; return; } const file = mapFileInput.files[0]; const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']; if (!allowedTypes.includes(file.type)) { uploadStatus.textContent = 'Invalid file type.'; uploadStatus.style.color = 'red'; return; } const formData = new FormData(); formData.append('mapFile', file); uploadStatus.textContent = 'Uploading...'; uploadStatus.style.color = 'black'; try { const response = await fetch('/api/maps', { method: 'POST', body: formData }); const result = await response.json(); if (response.ok && result.success) { uploadStatus.textContent = `Success: ${result.filename}`; uploadStatus.style.color = 'green'; mapFileInput.value = ''; await populateMapList(); if (mapList.includes(result.filename)) { mapSelect.value = result.filename; handleMapSelectionChange({ target: mapSelect }); } } else { uploadStatus.textContent = `Failed: ${result.error || 'Server error'}`; uploadStatus.style.color = 'red'; } } catch (error) { console.error('Upload error:', error); uploadStatus.textContent = 'Failed: Network error.'; uploadStatus.style.color = 'red'; } }
function handleControlChange(event) { console.log("--- handleControlChange Fired! --- Target:", event.target.id); if (!currentMapFilename || !currentState || !currentState.filter_params) return; const input = event.target; const filterId = input.dataset.filterId; const paramKey = input.dataset.paramKey; if (!filterId || !paramKey || paramKey === 'backgroundImageFilename') return; let value; if (input.type === 'checkbox') { value = input.checked ? 1.0 : 0.0; } else if (input.type === 'range' || input.type === 'number') { value = parseFloat(input.value); } else { value = input.value; } if (input.type === 'range') { const valueSpan = document.getElementById(`param-value-${paramKey}`); if (valueSpan) { const paramConfig = availableFilters[filterId]?.params[paramKey]; if (paramConfig?.min === 0 && paramConfig?.max === 1 && paramConfig?.step === 1) { valueSpan.textContent = ` (${value === 1.0 ? 'On' : 'Off'})`; } else { valueSpan.textContent = ` (${value.toFixed(paramConfig?.step >= 0.1 ? 2 : 3)})`; } } } currentState.filter_params = currentState.filter_params || {}; currentState.filter_params[filterId] = currentState.filter_params[filterId] || {}; if (currentState.filter_params[filterId][paramKey] !== value) { currentState.filter_params[filterId][paramKey] = value; const updatePayload = { filter_params: { [filterId]: { [paramKey]: value } } }; sendUpdate(updatePayload); } }
function handleViewChange(event) { console.log("--- handleViewChange Fired! --- Target:", event.target.id); if (!currentMapFilename || !currentState || !currentState.view_state) return; const input = event.target; const key = input.id.replace('view-', '').replace('-', '_'); const value = parseFloat(input.value); if (currentState.view_state[key] !== value) { currentState.view_state[key] = value; updateViewControls(); const updatePayload = { view_state: { [key]: value } }; sendUpdate(updatePayload); } }
// *** END ADDED BACK ***


// --- State Updates & Saving ---
// *** ADDED BACK ***
function sendUpdate(updateData) { console.log("--- sendUpdate called ---"); console.log(" -> updateData:", JSON.stringify(updateData)); console.log(" -> socket connected:", socket?.connected); console.log(" -> currentSessionId:", currentSessionId); const validIdRegex = /^[a-zA-Z0-9_-]{1,50}$/; if (!currentSessionId || !validIdRegex.test(currentSessionId)) { console.error("Cannot send update: Session ID is empty or invalid."); return; } if (!socket || !socket.connected) { console.warn("Cannot send update: WS disconnected."); return; } const payload = { session_id: currentSessionId, update_data: updateData }; console.log(`Attempting to emit 'gm_update':`, JSON.stringify(payload)); try { socket.emit('gm_update', payload); console.log(" -> 'gm_update' emitted."); } catch (error) { console.error("!!! Error during socket.emit:", error); } }
async function saveConfiguration() { console.log("--- saveConfiguration Fired! ---"); console.log(" -> Checking currentMapFilename:", currentMapFilename); if (!currentMapFilename) { console.log(" -> FAILED check: file missing."); alert("Select map first."); return; } console.log(" -> Check passed: file present."); console.log(" -> Checking currentState:", currentState); console.log(" -> Checking currentState.map_content_path:", currentState?.map_content_path); if (!currentState || !currentState.map_content_path) { console.log(" -> FAILED check: state invalid."); alert("Cannot save: state invalid."); return; } console.log(" -> Check passed: state present."); const expectedPath = `maps/${currentMapFilename}`; if (currentState.map_content_path !== expectedPath) { console.warn(`Adjusting path before save.`); currentState.map_content_path = expectedPath; } if (currentState.map_image_path) delete currentState.map_image_path; if (currentState.filter_params) { for (const filterId in currentState.filter_params) { if (currentState.filter_params[filterId]?.backgroundImageFilename !== undefined) { delete currentState.filter_params[filterId].backgroundImageFilename; } const textParams = ['defaultFontFamily', 'defaultTextSpeed', 'fontSize']; textParams.forEach(p => { if (currentState.filter_params[filterId]?.[p] !== undefined) { delete currentState.filter_params[filterId][p]; } }); } } console.log("Saving configuration:", JSON.stringify(currentState)); saveButton.textContent = "Saving..."; saveButton.disabled = true; try { console.log(`Sending POST to /api/config/${encodeURIComponent(currentMapFilename)}`); const response = await fetch(`/api/config/${encodeURIComponent(currentMapFilename)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(currentState), }); console.log("Save fetch response status:", response.status, "Ok:", response.ok); const contentType = response.headers.get("content-type"); let result = { success: response.ok }; if (contentType && contentType.indexOf("application/json") !== -1) { console.log("Attempting to parse JSON response..."); result = await response.json(); console.log("Save response result:", result); } else { console.log("Response was not JSON."); if (!response.ok) { result.error = `Save failed: ${response.status}`; } } if (response.ok && result.success) { console.log("Save successful."); alert(`Configuration saved for ${currentMapFilename}!`); } else { throw new Error(result.error || `Save failed: ${response.status}`); } } catch (error) { console.error('Save configuration error:', error); alert(`Error saving configuration: ${error.message}`); } finally { saveButton.textContent = "Save Map Config"; saveButton.disabled = !currentMapFilename; console.log("Save finally block executed."); } }
// *** END ADDED BACK ***


// --- View State Handling ---
// *** ADDED BACK ***
function updateViewControls() { console.log("--- updateViewControls called ---"); if (!currentState?.view_state) { console.log(" -> No view_state, disabling."); if(viewXInput) viewXInput.disabled = true; if(viewYInput) viewYInput.disabled = true; if(viewScaleInput) viewScaleInput.disabled = true; return; } const { center_x = 0.5, center_y = 0.5, scale = 1.0 } = currentState.view_state; console.log(` -> Applying view_state: x=${center_x}, y=${center_y}, scale=${scale}`); if(viewXInput) viewXInput.value = center_x; if(viewYInput) viewYInput.value = center_y; if(viewScaleInput) viewScaleInput.value = scale; const xSpan = viewXInput?.previousElementSibling?.querySelector('.slider-value'); const ySpan = viewYInput?.previousElementSibling?.querySelector('.slider-value'); const scaleSpan = viewScaleInput?.previousElementSibling?.querySelector('.slider-value'); if (xSpan) xSpan.textContent = ` (${center_x.toFixed(2)})`; if (ySpan) ySpan.textContent = ` (${center_y.toFixed(2)})`; if (scaleSpan) scaleSpan.textContent = ` (${scale.toFixed(2)}x)`; if(viewXInput) viewXInput.disabled = false; if(viewYInput) viewYInput.disabled = false; if(viewScaleInput) viewScaleInput.disabled = false; }
// *** END ADDED BACK ***


// --- Session/Player URL Display ---
// *** ADDED BACK ***
function updatePlayerUrlDisplay() { console.log("--- updatePlayerUrlDisplay called ---"); console.log(" -> playerUrlDisplay element:", playerUrlDisplay); console.log(" -> currentSessionId:", currentSessionId); const validIdRegex = /^[a-zA-Z0-9_-]{1,50}$/; if (playerUrlDisplay && currentSessionId && validIdRegex.test(currentSessionId)) { const playerPath = `/player?session=${encodeURIComponent(currentSessionId)}`; const fullUrl = window.location.origin + playerPath; console.log(" -> Constructed URL:", fullUrl); playerUrlDisplay.value = fullUrl; console.log(" -> Set playerUrlDisplay.value to:", playerUrlDisplay.value); } else if (playerUrlDisplay) { console.warn(" -> Could not update Player URL: Session ID invalid or missing."); playerUrlDisplay.value = "Enter valid Session ID above..."; } else { console.error(" -> Could not update Player URL: element not found."); } }
function copyPlayerUrlToClipboard() { console.log("--- copyPlayerUrlToClipboard Fired! ---"); if (!playerUrlDisplay) return; playerUrlDisplay.select(); playerUrlDisplay.setSelectionRange(0, 99999); try { const successful = document.execCommand('copy'); if (successful) { copyStatusDisplay.textContent = 'Copied!'; copyStatusDisplay.style.color = 'green'; } else { throw new Error('execCommand failed'); } } catch (err) { console.error('Failed to copy Player URL:', err); copyStatusDisplay.textContent = 'Copy failed.'; copyStatusDisplay.style.color = 'red'; if (navigator.clipboard) { navigator.clipboard.writeText(playerUrlDisplay.value).then(() => { copyStatusDisplay.textContent = 'Copied!'; copyStatusDisplay.style.color = 'green'; }).catch(clipErr => { console.error('navigator.clipboard fallback failed:', clipErr); copyStatusDisplay.textContent = 'Copy failed.'; copyStatusDisplay.style.color = 'red'; }); } } setTimeout(() => { copyStatusDisplay.textContent = ''; }, 2500); }
// *** END ADDED BACK ***

// --- Helpers ---
// *** ADDED BACK ***
function get_default_filter_params() { const fp = {}; for (const f_id in availableFilters) { const fc = availableFilters[f_id]; fp[f_id] = {}; if (fc && fc.params) { for (const key in fc.params) { if (fc.params[key].value !== undefined && key !== 'backgroundImageFilename') { fp[f_id][key] = fc.params[key].value; } } } } return fp; }
// *** END ADDED BACK ***

