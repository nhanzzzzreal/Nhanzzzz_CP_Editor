import os
import json
import subprocess
import shutil
import sys
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from models import GlobalConfig, CreateItemReq, RenameItemReq, FileDataSaveReq, FileContentSaveReq, RunAllReq, CppSettings, PythonSettings
from services import execute_code_stream

import threading
from PIL import Image
import pystray
from pystray import MenuItem as item
import webbrowser

from defaultconfig import DEFAULT_GLOBAL_CONFIG, DEFAULT_CPP_SETTINGS, DEFAULT_PYTHON_SETTINGS
# --- CẤU HÌNH THƯ MỤC ---
# Xác định đường dẫn gốc dựa trên môi trường chạy (script vs .exe)
if getattr(sys, 'frozen', False):
    # Chạy từ file .exe đã đóng gói
    # BASE_DIR là thư mục chứa file .exe
    BASE_DIR = os.path.dirname(sys.executable)
    # BUNDLE_DIR là thư mục tạm do PyInstaller tạo ra, chứa các file đóng gói
    BUNDLE_DIR = sys._MEIPASS
else:
    # Chạy từ file script .py
    # BASE_DIR là thư mục chứa file server.py
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    # Trong môi trường dev, BUNDLE_DIR cũng chính là BASE_DIR
    BUNDLE_DIR = BASE_DIR

# 1. Các file/thư mục cần "SỐNG SÓT" (Persistent) - được tạo và lưu cạnh file .exe
GLOBAL_CONFIG_FILE = os.path.join(BASE_DIR, "cpe_global_config.json")
# Thư mục workspace mặc định, có thể bị ghi đè bởi cấu hình
WORKSPACE_DIR = os.path.join(BASE_DIR, "workspace")

CREATE_NO_WINDOW = 0x08000000

# Đọc lại workspace cuối cùng nếu có
if os.path.exists(GLOBAL_CONFIG_FILE):
    try:
        with open(GLOBAL_CONFIG_FILE, "r", encoding="utf-8") as f:
            config = json.load(f)
            # Kiểm tra cả 2 tên biến để tránh lỗi
            saved_workspace = config.get("lastWorkspace") or config.get("last_workspace")
            if saved_workspace and os.path.exists(saved_workspace):
                WORKSPACE_DIR = saved_workspace
    except Exception:
        pass

META_DIR = os.path.join(WORKSPACE_DIR, ".cpe")
TEMP_DIR = os.path.join(META_DIR, "temp")

# Kiểm tra xem có đang chạy ở chế độ phát triển không (Vite sẽ phục vụ frontend)
IS_DEV_MODE = True #os.getenv("DEV_MODE", "false").lower() == "true"
os.makedirs(WORKSPACE_DIR, exist_ok=True)
os.makedirs(META_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

# Tạo 1 file mẫu nếu workspace trống
if not any(f != ".cpe" for f in os.listdir(WORKSPACE_DIR)):
    with open(os.path.join(WORKSPACE_DIR, "main.cpp"), "w", encoding="utf-8") as f:
        f.write("#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << endl;\n    return 0;\n}")

app = FastAPI()

dist_path = os.path.join(BUNDLE_DIR, "dist")
# Cho phép Frontend React gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API QUẢN LÝ FILE ---
@app.get("/api/app-config")
def get_app_config():
    """Trả về cấu hình toàn cục, hợp nhất từ file đã lưu và giá trị mặc định."""
    # Bắt đầu với một bản sao của cấu hình mặc định
    config_data = DEFAULT_GLOBAL_CONFIG.copy()

    if os.path.exists(GLOBAL_CONFIG_FILE):
        try:
            with open(GLOBAL_CONFIG_FILE, "r", encoding="utf-8") as f:
                saved_config = json.load(f)
                # Hợp nhất cấu hình đã lưu vào cấu hình mặc định
                # Các giá trị trong saved_config sẽ ghi đè lên giá trị mặc định,
                # đặc biệt xử lý trường 'shortcuts' là một dictionary lồng nhau
                config_data.update(saved_config) 
                if "shortcuts" in saved_config and isinstance(saved_config["shortcuts"], dict):
                    config_data["shortcuts"].update(saved_config["shortcuts"])
        except Exception:
            # Nếu file bị lỗi, chỉ sử dụng cấu hình mặc định đã được chuẩn bị
            pass
    
    # Luôn trả về thư mục làm việc hiện tại đang được server sử dụng
    config_data["lastWorkspace"] = WORKSPACE_DIR
    return config_data

@app.post("/api/app-config")
def save_app_config(config: GlobalConfig):
    """Lưu cấu hình toàn cục (phiên làm việc) xuống file"""
    global WORKSPACE_DIR
    try:
        data = config.model_dump()
        with open(GLOBAL_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
        
        # Cập nhật WORKSPACE_DIR trong bộ nhớ server nếu có thay đổi
        if os.path.exists(config.lastWorkspace):
            WORKSPACE_DIR = config.lastWorkspace
            
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/files/create")
def create_item(req: CreateItemReq):
    # Nếu parent_path là 'workspace', ta dùng đường dẫn gốc
    base = WORKSPACE_DIR if req.parent_path == 'workspace' else req.parent_path
    new_path = os.path.join(base, req.name)
    
    try:
        if req.type == 'folder':
            os.makedirs(new_path, exist_ok=True)
        else:
            if not os.path.exists(new_path):
                with open(new_path, "w", encoding="utf-8") as f:
                    f.write("") # Tạo file trống
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files")
def delete_item(path: str):
    try:
        if os.path.isdir(path):
            import shutil
            shutil.rmtree(path) # Xóa thư mục và nội dung bên trong
        else:
            os.remove(path)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/files/rename")
def rename_item(req: RenameItemReq):
    try:
        dir_name = os.path.dirname(req.old_path)
        new_path = os.path.join(dir_name, req.new_name)
        os.rename(req.old_path, new_path)
        
        # Nếu là đổi tên file, cần đổi tên luôn file cấu hình .json trong thư mục .cpe
        if os.path.isfile(new_path):
            old_meta = get_meta_file_path(req.old_path)
            if os.path.exists(old_meta):
                new_meta = get_meta_file_path(new_path)
                os.rename(old_meta, new_meta)
                
        return {"status": "success", "new_path": new_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- HELPER FUNCTIONS ---
def get_meta_file_path(file_path: str) -> str:
    is_temp_file = file_path.startswith("temp") and not os.path.isabs(file_path)
    
    if is_temp_file:
        # Nếu là file ảo, gom chung metadata vào WORKSPACE/.cpe/temp
        cpe_dir = os.path.join(WORKSPACE_DIR, ".cpe", "temp")
    else:
        # File nằm trong workspace -> tạo thư mục .cpe nằm ngay cùng cấp với file code
        dir_name = os.path.dirname(file_path)
        cpe_dir = os.path.join(dir_name, ".cpe")
        
    base_name = os.path.basename(file_path)
    os.makedirs(cpe_dir, exist_ok=True)
    return os.path.join(cpe_dir, f"{base_name}.json")

def build_folder_tree(current_path: str):
    """Đệ quy quét thư mục để gửi về cho TreeView của React"""
    name = os.path.basename(current_path)
    # Trả về full path và thay \ thành / để React dễ xử lý
    safe_path = current_path.replace('\\', '/')
    
    if os.path.isdir(current_path):
        children = []
        for child in sorted(os.listdir(current_path)):
            if child.startswith('.'): # Bỏ qua .cpe, .git, v.v...
                continue
            child_path = os.path.join(current_path, child)
            children.append(build_folder_tree(child_path))
        return {"id": safe_path, "name": name, "type": "folder", "children": children}
    return {"id": safe_path, "name": name, "type": "file"}

# --- API ENDPOINTS ---
@app.post("/api/files/open-dialog")
def open_file_dialog():
    import tkinter as tk
    from tkinter import filedialog
    import os
    
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)
        
        # Mở hộp thoại chọn file thay vì chọn thư mục
        file_path = filedialog.askopenfilename(title="Select File")
        root.destroy()
        
        if file_path and os.path.isfile(file_path):
            # Đồng bộ định dạng đường dẫn (thay \ thành /) cho giống với React Tree
            safe_path = os.path.abspath(file_path).replace('\\', '/')
            return {"status": "ok", "path": safe_path, "name": os.path.basename(safe_path)}
            
        return {"status": "cancelled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/workspace/open-dialog")
def open_workspace_dialog():
    import tkinter as tk
    from tkinter import filedialog
    import os
    import json
    global WORKSPACE_DIR, META_DIR, TEMP_DIR
    
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes('-topmost', True)

        folder_path = filedialog.askdirectory(title="Select Workspace Folder")
        root.destroy()

        if folder_path and os.path.isdir(folder_path):
            WORKSPACE_DIR = os.path.abspath(folder_path)

            # Cập nhật và tạo các thư mục meta cho workspace mới
            META_DIR = os.path.join(WORKSPACE_DIR, ".cpe")
            TEMP_DIR = os.path.join(META_DIR, "temp")
            os.makedirs(WORKSPACE_DIR, exist_ok=True)
            os.makedirs(META_DIR, exist_ok=True)
            os.makedirs(TEMP_DIR, exist_ok=True)

            # Đọc cấu hình hiện tại (nếu có) để giữ lại các cài đặt khác
            config_data = {}
            if os.path.exists(GLOBAL_CONFIG_FILE):
                with open(GLOBAL_CONFIG_FILE, "r", encoding="utf-8") as f:
                    try:
                        config_data = json.load(f)
                    except:
                        pass

            config_data["lastWorkspace"] = WORKSPACE_DIR
            # Reset lại trạng thái phiên làm việc (file đang mở) khi đổi workspace
            config_data["openFileIds"] = []
            config_data["activeFileId"] = ""

            with open(GLOBAL_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(config_data, f, indent=4)
                
            return {"status": "ok", "path": WORKSPACE_DIR}
        return {"status": "cancelled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/tree")
def get_tree():
    # File Tree luôn bắt đầu từ thư mục workspace
    tree = build_folder_tree(WORKSPACE_DIR)
    # Lấy danh sách con của workspace trực tiếp (không cần hiển thị root 'workspace')
    return tree.get("children", [])

@app.get("/api/files/data")
def get_file_data(path: str):
    """Trả về Nội dung code + Cài đặt + Testcases"""
    if not os.path.exists(path) and not path.startswith("temp"):
        raise HTTPException(status_code=404, detail="File not found")
        
    content = ""
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

    meta_path = get_meta_file_path(path)
    settings = None
    testcases = []
    
    is_python_file = path.endswith(".py")
    is_cpp_file = path.endswith(".cpp") or path.endswith(".c")

    # Xác định cài đặt mặc định dựa trên loại file
    default_settings_dict = {}
    if is_python_file:
        default_settings_dict = DEFAULT_PYTHON_SETTINGS.copy()
    else: # Mặc định là C++ cho các loại file không xác định hoặc C/C++
        default_settings_dict = DEFAULT_CPP_SETTINGS.copy()

    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                saved_settings = data.get("settings")
                if saved_settings:
                    # Hợp nhất cài đặt đã lưu vào cài đặt mặc định
                    default_settings_dict.update(saved_settings)
                testcases = data.get("testcases", [])
        except Exception:
            # Nếu file meta bị lỗi, chỉ sử dụng cài đặt mặc định
            pass

    # Tạo đối tượng Pydantic từ dữ liệu đã hợp nhất
    if is_python_file:
        settings = PythonSettings(**default_settings_dict)
    else:
        settings = CppSettings(**default_settings_dict)

    return {
        "content": content,
        "settings": settings,
        "testcases": testcases
    }

@app.post("/api/files/content")
def save_file_content(req: FileContentSaveReq):
    """Lưu code người dùng đang gõ"""
    if not req.path.startswith("temp"): # Bỏ qua việc ghi file nếu là file drag/drop ảo
        with open(req.path, "w", encoding="utf-8") as f:
            f.write(req.content)
    return {"status": "ok"}

@app.post("/api/files/data")
def save_file_data(req: FileDataSaveReq):
    """Lưu testcase và settings vào json"""
    meta_path = get_meta_file_path(req.path)
    data = {
        "settings": req.settings.model_dump() if req.settings else None,
        "testcases": [tc.model_dump() for tc in req.testcases] if req.testcases else []
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
    return {"status": "ok"}

@app.post("/api/run/stream")
async def run_stream(req: RunAllReq):
    return StreamingResponse(
        execute_code_stream(
            req.path,
            req.code,
            [tc.model_dump() for tc in req.testcases],
            req.settings,
            req.globalConfig,
            workspace_dir=WORKSPACE_DIR
        ),
        media_type="text/event-stream"
    )


# Chỉ phục vụ các file tĩnh và index.html nếu KHÔNG ở chế độ phát triển (production build)
# Ở chế độ phát triển, Vite sẽ phục vụ frontend
if not IS_DEV_MODE:
    if os.path.exists(dist_path):
        app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="static")

        @app.get("/{full_path:path}")
        async def serve_react_app(full_path: str):
            if full_path.startswith("api"):
                 return None
            return FileResponse(os.path.join(dist_path, "index.html"))

def quit_window(icon, item):
    """Hàm để thoát ứng dụng hoàn toàn"""
    icon.stop()
    os._exit(0) # Thoát cưỡng bách toàn bộ process

def show_window(icon, item):
    """Hàm để mở trình duyệt"""
    webbrowser.open("http://localhost:3690")

def run_tray_icon():
    """Khởi tạo và chạy Tray Icon"""
    # Đường dẫn đến file icon (sử dụng favicon của bạn)
    # Nếu chạy từ EXE, cần lấy path từ sys._MEIPASS
    icon_path = os.path.join(BUNDLE_DIR, "dist", "icon.ico") 
    
    # Nếu không tìm thấy file icon, có thể tạo một ảnh màu đơn giản để tránh crash
    if os.path.exists(icon_path):
        image = Image.open(icon_path)
    else:
        image = Image.new('RGB', (64, 64), color=(73, 109, 137))

    # Tạo menu cho Tray Icon
    menu = (
        item('Open Web Interface', show_window),
        item('Quit Application', quit_window),
    )

    icon = pystray.Icon("Nhanzzzz CP Server", image, "Nhanzzzz CP Server", menu)
    icon.run()

if __name__ == "__main__":
    import uvicorn
    from threading import Timer

    # 1. Chạy Tray Icon trong một Thread riêng
    tray_thread = threading.Thread(target=run_tray_icon, daemon=True)
    tray_thread.start()

    # 2. Tự động mở trình duyệt lần đầu
    # if getattr(sys, 'frozen', False):
    #     # Khi đã đóng gói (production build), mở cổng của backend nơi phục vụ frontend
    #     Timer(1.5, lambda: webbrowser.open("http://localhost:3691")).start()
    # elif IS_DEV_MODE:
    #     # Ở chế độ phát triển, mở cổng của Vite dev server
    #     Timer(1.5, lambda: webbrowser.open("http://localhost:3690")).start()

    uvicorn.run(app, host="0.0.0.0", port=3691)