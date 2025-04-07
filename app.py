# app.py
# Version: 2.5.3 (Fix IndentationError & Remove Duplication)
# Main Flask application file for the Dynamic Map Renderer

import os
import json
# import uuid # No longer needed for session IDs
from flask import Flask, request, jsonify, render_template # Removed session as flask_session
# Import send_from_directory explicitly
from flask import send_from_directory
from flask_socketio import SocketIO, emit as socketio_emit, join_room, leave_room
from werkzeug.utils import secure_filename
import copy
import traceback
import re # For basic session ID validation

# Configuration
APP_ROOT = os.path.dirname(os.path.abspath(__file__))
MAPS_FOLDER = os.path.join(APP_ROOT, 'maps')
CONFIGS_FOLDER = os.path.join(APP_ROOT, 'configs')
FILTERS_FOLDER = os.path.join(APP_ROOT, 'filters')
ALLOWED_MAP_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
# Basic validation for session IDs (alphanumeric, hyphen, underscore, 1-50 chars)
SESSION_ID_REGEX = re.compile(r'^[a-zA-Z0-9_-]{1,50}$')

# --- Filter Loading ---
available_filters = {}
# ** Full Implementation **
def load_single_filter(filter_id):
    filter_dir = os.path.join(FILTERS_FOLDER, filter_id)
    config_path = os.path.join(filter_dir, 'config.json')
    vertex_path = os.path.join(filter_dir, 'vertex.glsl')
    fragment_path = os.path.join(filter_dir, 'fragment.glsl')
    if not os.path.exists(config_path): return None
    try:
        with open(config_path, 'r', encoding='utf-8') as f: config_data = json.load(f)
        if not all(k in config_data for k in ['id', 'name', 'params']): raise ValueError("Invalid filter config structure")
        if config_data['id'] != filter_id: raise ValueError(f"Filter ID mismatch for '{filter_id}'")
        params = config_data.get('params', {})
        keys_to_remove = ['backgroundImageFilename', 'defaultFontFamily', 'defaultTextSpeed', 'fontSize']
        for key in keys_to_remove:
            if key in params: del params[key]
        config_data['params'] = params
        if os.path.exists(vertex_path): config_data['vertex_shader_path'] = os.path.join('filters', filter_id, 'vertex.glsl').replace('\\','/')
        if os.path.exists(fragment_path): config_data['fragment_shader_path'] = os.path.join('filters', filter_id, 'fragment.glsl').replace('\\','/')
        return config_data
    except Exception as e: print(f"Error loading filter '{filter_id}': {e}"); traceback.print_exc(); return None

def load_available_filters():
    global available_filters; print(f"Scanning for filters in: {FILTERS_FOLDER}"); loaded_filters = {}
    if not os.path.isdir(FILTERS_FOLDER): print(f"Warning: Filters directory not found: {FILTERS_FOLDER}"); return
    for item in os.listdir(FILTERS_FOLDER):
        item_path = os.path.join(FILTERS_FOLDER, item)
        if os.path.isdir(item_path):
            filter_id = item; filter_data = load_single_filter(filter_id)
            if filter_data: loaded_filters[filter_id] = filter_data; print(f"  - Loaded filter: {filter_data['name']} (ID: {filter_id})")
    available_filters = loaded_filters; print(f"Total filters loaded: {len(available_filters)}")

# --- File Extension Checker ---
def allowed_map_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_MAP_EXTENSIONS

# Initialize Flask App & Config
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = os.urandom(24)
app.config['MAPS_FOLDER'] = MAPS_FOLDER
app.config['CONFIGS_FOLDER'] = CONFIGS_FOLDER
app.config['FILTERS_FOLDER'] = FILTERS_FOLDER
os.makedirs(MAPS_FOLDER, exist_ok=True); os.makedirs(CONFIGS_FOLDER, exist_ok=True); os.makedirs(FILTERS_FOLDER, exist_ok=True)

load_available_filters()
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# --- In-Memory State Storage ---
session_states = {}

# --- Helper Functions ---
# ** Corrected Indentation and Removed Semicolons **
def get_map_config_path(map_filename):
    secured_base = secure_filename(map_filename)
    config_filename = f"{secured_base}_config.json"
    return os.path.join(app.config['CONFIGS_FOLDER'], config_filename)

def load_map_config(map_filename):
    config_path = get_map_config_path(map_filename) # Removed semicolon
    if not os.path.exists(config_path):
        return None
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        # Check and migrate old path key
        if 'map_content_path' not in config_data and 'map_image_path' in config_data:
            config_data['map_content_path'] = config_data['map_image_path']
        if 'map_image_path' in config_data:
            del config_data['map_image_path']
        # Force display type
        config_data['display_type'] = "image"
        # Remove text/legacy filter params if they exist
        if 'filter_params' in config_data:
            params = config_data['filter_params']
            keys_to_remove = ['backgroundImageFilename', 'defaultFontFamily', 'defaultTextSpeed', 'fontSize']
            # Iterate safely
            for filter_id in list(params.keys()):
                if isinstance(params.get(filter_id), dict): # Use .get for safety
                    for key in keys_to_remove:
                        if key in params[filter_id]:
                            del params[filter_id][key]
            config_data['filter_params'] = params # Assign cleaned params back
        # Final check for essential key
        if 'map_content_path' not in config_data:
            return None
        return config_data
    except Exception as e:
        print(f"Error loading/parsing config for {map_filename}: {e}")
        traceback.print_exc()
        return None

def save_map_config(map_filename, config_data):
    config_path = get_map_config_path(map_filename) # Removed semicolon
    try:
        # Clean up before saving
        if 'map_image_path' in config_data:
            if 'map_content_path' not in config_data: config_data['map_content_path'] = config_data['map_image_path']
            del config_data['map_image_path']
        config_data['display_type'] = "image"
        if 'filter_params' in config_data:
            params = config_data['filter_params']
            keys_to_remove = ['backgroundImageFilename', 'defaultFontFamily', 'defaultTextSpeed', 'fontSize']
            for filter_id in list(params.keys()):
                 if isinstance(params.get(filter_id), dict): # Use .get for safety
                      for key in keys_to_remove:
                           if key in params[filter_id]: del params[filter_id][key]
            config_data['filter_params'] = params
        expected_path = os.path.join('maps', secure_filename(map_filename)).replace('\\', '/')
        config_data['map_content_path'] = expected_path # Ensure path matches filename
        # Write the file
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving config for {map_filename}: {e}")
        traceback.print_exc()
        return False

def get_default_filter_params():
    filter_params = {}
    text_params = ['defaultFontFamily', 'defaultTextSpeed', 'fontSize']
    for f_id, f_config in available_filters.items():
        filter_params[f_id] = {
            key: param_data.get('value')
            for key, param_data in f_config.get('params', {}).items()
            if 'value' in param_data and key != 'backgroundImageFilename' and key not in text_params
        }
    return filter_params

def get_default_session_state():
    default_filter_id = "none" if "none" in available_filters else list(available_filters.keys())[0] if available_filters else ""
    return {
        "map_content_path": None,
        "display_type": "image",
        "current_filter": default_filter_id,
        "view_state": { "center_x": 0.5, "center_y": 0.5, "scale": 1.0 },
        "filter_params": get_default_filter_params()
    }

def get_state_for_map(map_filename):
    config = load_map_config(map_filename)
    if config:
        loaded_filter_params = config.get("filter_params", {})
        default_filter_params = get_default_filter_params()
        for f_id, params in default_filter_params.items():
            if f_id not in loaded_filter_params:
                loaded_filter_params[f_id] = params
            else:
                # Ensure all default keys exist for this filter
                for key, default_value in params.items():
                    if key not in loaded_filter_params[f_id]:
                        loaded_filter_params[f_id][key] = default_value
        config["filter_params"] = loaded_filter_params
        config["display_type"] = "image" # Ensure type
        # Ensure view_state exists
        if "view_state" not in config:
             config["view_state"] = { "center_x": 0.5, "center_y": 0.5, "scale": 1.0 }
        return config
    else:
        # Generate default if config file missing but map exists
        map_path_on_disk = os.path.join(app.config['MAPS_FOLDER'], secure_filename(map_filename))
        if os.path.exists(map_path_on_disk) and allowed_map_file(map_filename):
            relative_path = os.path.join('maps', secure_filename(map_filename)).replace('\\', '/')
            display_type = "image"
            default_filter_id = "none" if "none" in available_filters else list(available_filters.keys())[0] if available_filters else ""
            print(f"Generating default image state for map: {relative_path}")
            return {
                "map_content_path": relative_path,
                "display_type": display_type,
                "current_filter": default_filter_id,
                "view_state": { "center_x": 0.5, "center_y": 0.5, "scale": 1.0 },
                "filter_params": get_default_filter_params()
            }
        else:
            print(f"Warning: Map file not found or not allowed: {map_filename}")
            return None

def merge_dicts(dict1, dict2):
    result = copy.deepcopy(dict1)
    for key, value in dict2.items():
        if isinstance(value, dict) and key in result and isinstance(result[key], dict):
            result[key] = merge_dicts(result[key], value)
        else:
            result[key] = value
    return result

# --- HTTP Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/player')
def player():
    session_id = request.args.get('session')
    if not session_id or not isinstance(session_id, str) or not SESSION_ID_REGEX.match(session_id):
        return "Error: Session ID is missing, invalid, or too long.", 400
    return render_template('player.html', session_id=session_id)

# --- Static File Serving ---
@app.route('/maps/<path:filename>')
def serve_map_image(filename):
    # ** Full Implementation Restored **
    print(f"[serve_map_image] Request for: {filename}")
    safe_base_filename = secure_filename(filename)
    print(f"[serve_map_image] Secured filename: {safe_base_filename}")
    if not allowed_map_file(safe_base_filename): print(f"[serve_map_image] ERROR: File type not allowed"); return jsonify({"error": "File type not allowed"}), 404
    maps_dir = app.config['MAPS_FOLDER']; print(f"[serve_map_image] Serving from directory: {maps_dir}")
    try:
        file_path = os.path.join(maps_dir, safe_base_filename); print(f"[serve_map_image] Attempting to serve file path: {file_path}")
        abs_maps_dir = os.path.abspath(maps_dir); abs_file_path = os.path.abspath(file_path)
        if not os.path.exists(file_path): print(f"[serve_map_image] ERROR: File does not exist"); raise FileNotFoundError
        if not abs_file_path.startswith(abs_maps_dir): print(f"[serve_map_image] ERROR: Path traversal attempt?"); raise FileNotFoundError
        print(f"[serve_map_image] Calling send_from_directory for dir='{maps_dir}', filename='{safe_base_filename}'")
        response = send_from_directory(maps_dir, safe_base_filename, as_attachment=False)
        print(f"[serve_map_image] send_from_directory successful for {safe_base_filename}")
        return response
    except FileNotFoundError: print(f"[serve_map_image] FileNotFoundError caught"); return jsonify({"error": "Map image file not found"}), 404
    except Exception as e: print(f"[serve_map_image] !!! UNEXPECTED ERROR serving '{safe_base_filename}' !!!"); print(f"[serve_map_image] Exception type: {type(e).__name__}"); print(f"[serve_map_image] Exception args: {e.args}"); traceback.print_exc(); return jsonify({"error": "Internal server error"}), 500

@app.route('/filters/<path:filter_id>/<shader_type>')
def serve_shader(filter_id, shader_type):
    # ** Full Implementation Restored **
    secured_filter_id = secure_filename(filter_id); secured_shader_type = secure_filename(shader_type)
    if secured_shader_type not in ['vertex.glsl', 'fragment.glsl']: return jsonify({"error": "Invalid shader type"}), 400
    filters_dir = app.config['FILTERS_FOLDER']; filter_subdir = os.path.join(filters_dir, secured_filter_id)
    try:
        shader_path = os.path.join(filter_subdir, secured_shader_type)
        if not os.path.exists(shader_path) or not os.path.abspath(shader_path).startswith(os.path.abspath(filters_dir)): raise FileNotFoundError
        return send_from_directory(filter_subdir, secured_shader_type, mimetype='text/plain')
    except FileNotFoundError: return jsonify({"error": "Shader file not found"}), 404
    except Exception as e: print(f"Err serve shader {filter_id}/{shader_type}: {e}"); return jsonify({"error": "Server error"}), 500

# --- API Routes ---
# ** Full Implementations Restored **
@app.route('/api/filters', methods=['GET'])
def get_filters():
    client_safe_filters = {}; text_params = ['defaultFontFamily', 'defaultTextSpeed', 'fontSize']
    for f_id, f_config in available_filters.items():
         safe_config = {k: v for k, v in f_config.items() if k not in ['vertex_shader_path', 'fragment_shader_path']}
         if 'params' in safe_config:
             params_copy = copy.deepcopy(safe_config['params']); keys_to_remove = ['backgroundImageFilename'] + text_params
             for key in keys_to_remove:
                 if key in params_copy: del params_copy[key]
             safe_config['params'] = params_copy
         client_safe_filters[f_id] = safe_config
    return jsonify(client_safe_filters)

@app.route('/api/maps', methods=['GET'])
def list_map_content():
    try:
        maps_dir = app.config['MAPS_FOLDER'];
        if not os.path.isdir(maps_dir): return jsonify([])
        content_files = [f for f in os.listdir(maps_dir) if os.path.isfile(os.path.join(maps_dir, f)) and allowed_map_file(f)]
        return jsonify(sorted(content_files))
    except Exception as e: print(f"Error listing map content: {e}"); return jsonify({"error": "Server error"}), 500

@app.route('/api/maps', methods=['POST'])
def upload_map_content():
    if 'mapFile' not in request.files: return jsonify({"error": "No file part"}), 400
    file = request.files['mapFile']
    if file.filename == '': return jsonify({"error": "No selected file"}), 400
    if file and allowed_map_file(file.filename):
        filename = secure_filename(file.filename); save_path = os.path.join(app.config['MAPS_FOLDER'], filename)
        try:
            file.save(save_path); config_path = get_map_config_path(filename)
            if not os.path.exists(config_path):
                 print(f"Creating default config for uploaded map '{filename}'.")
                 default_state = get_state_for_map(filename)
                 if default_state:
                     if not save_map_config(filename, default_state): print(f"Warning: Failed save default config.")
                 else: print(f"Warning: Could not generate default state.")
            return jsonify({"success": True, "filename": filename}), 201
        except Exception as e: print(f"Err save map upload '{filename}': {e}"); return jsonify({"error": "Could not save"}), 500
    else: return jsonify({"error": f"File type not allowed. Allowed: {', '.join(ALLOWED_MAP_EXTENSIONS)}"}), 400

@app.route('/api/config/<path:map_filename>', methods=['GET'])
def get_config(map_filename):
    secured_filename = secure_filename(map_filename)
    if not allowed_map_file(secured_filename): return jsonify({"error": "Invalid file type"}), 400
    map_state = get_state_for_map(secured_filename)
    if map_state: return jsonify(map_state)
    else: return jsonify({"error": "Map file not found"}), 404

@app.route('/api/config/<path:map_filename>', methods=['POST'])
def save_config_api(map_filename):
    secured_filename = secure_filename(map_filename)
    if not allowed_map_file(secured_filename): return jsonify({"error": "Invalid file type"}), 400
    if not request.is_json: return jsonify({"error": "Request must be JSON"}), 400
    config_data = request.get_json()
    if not isinstance(config_data, dict) or not all(k in config_data for k in ("map_content_path", "current_filter", "view_state", "filter_params")): return jsonify({"error": "Invalid config data structure"}), 400
    if save_map_config(secured_filename, config_data): print(f"Map config saved: {secured_filename}"); return jsonify({"success": True}), 200
    else: return jsonify({"error": "Could not save map configuration"}), 500

# --- WebSocket Event Handlers ---
# ** Full Implementations with updated validation **
@socketio.on('connect')
def handle_connect(): print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect(): print(f"Client disconnected: {request.sid}")

@socketio.on('join_session')
def handle_join_session(data):
    if not isinstance(data, dict) or 'session_id' not in data: socketio_emit('error', {'message': 'Invalid join request.'}, to=request.sid); return
    session_id = data['session_id']
    if not session_id or not isinstance(session_id, str) or not SESSION_ID_REGEX.match(session_id): socketio_emit('error', {'message': f'Invalid session ID format or length.'}, to=request.sid); return
    join_room(session_id); print(f"Client {request.sid} joined session room: {session_id}")
    current_session_state = session_states.get(session_id)
    if not current_session_state: current_session_state = get_default_session_state(); session_states[session_id] = current_session_state
    print(f"Sending initial state for session {session_id} to client {request.sid}")
    socketio_emit('state_update', current_session_state, to=request.sid)

@socketio.on('gm_update')
def handle_gm_update(data):
    if not isinstance(data, dict) or 'session_id' not in data or 'update_data' not in data: return
    session_id = data['session_id']
    update_delta = data['update_data']
    if not session_id or not isinstance(session_id, str) or not SESSION_ID_REGEX.match(session_id): print(f"Error: GM update received with invalid session ID: {session_id}"); return
    if session_id not in session_states: print(f"Creating new session state for ID: {session_id}"); session_states[session_id] = get_default_session_state()
    print(f"Received GM update for session {session_id}: {json.dumps(update_delta)}")
    try:
        current_state = copy.deepcopy(session_states[session_id]); new_content_path = update_delta.get('map_content_path')
        if new_content_path and new_content_path != current_state.get('map_content_path'):
            map_filename = os.path.basename(new_content_path); map_path_on_disk = os.path.join(app.config['MAPS_FOLDER'], secure_filename(map_filename))
            if os.path.exists(map_path_on_disk) and allowed_map_file(map_filename):
                new_map_state = get_state_for_map(map_filename)
                if new_map_state: current_state = new_map_state; print(f"Session {session_id}: Reset state based on map '{map_filename}'.")
                else: print(f"Warning: Could not generate state for map '{map_filename}'."); return
            else: print(f"Warning: New content path invalid: '{new_content_path}'."); return
        elif new_content_path is None and 'map_content_path' in update_delta: current_state = get_default_session_state()
        updated_state = merge_dicts(current_state, update_delta); updated_state['display_type'] = 'image'
        session_states[session_id] = updated_state; print(f"Session {session_id}: State updated. Broadcasting.")
        socketio.emit('state_update', updated_state, room=session_id)
    except Exception as e: print(f"Error processing GM update for session {session_id}: {e}"); traceback.print_exc()

# --- Main Execution ---
if __name__ == '__main__':
    print("------------------------------------------")
    print("Starting Dynamic Map Renderer server...")
    print("Backend version: 2.5.2 (Hardcoded Session ID - Verified)") # Version updated
    print(f"Serving map images from: {app.config['MAPS_FOLDER']}")
    print(f"Using configs from: {app.config['CONFIGS_FOLDER']}")
    print(f"Loading filters from: {app.config['FILTERS_FOLDER']}")
    print("Access GM View: http://127.0.0.1:5000/")
    print("Access Player View: http://127.0.0.1:5000/player?session=my-game") # Example
    print("------------------------------------------")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, use_reloader=False)

# --- Removed duplicated placeholder implementations ---

