import os
import json
import subprocess
import uuid
import shutil
from typing import List, Optional

from models import Settings, GlobalConfig

CREATE_NO_WINDOW = 0x08000000

def execute_code_stream(path: str, code: str, testcases: List[dict], settings: Settings, global_config: Optional[GlobalConfig] = None, workspace_dir: str = "workspace"):
    python_cmd = global_config.pythonPath if global_config else "python"
    gpp_cmd = global_config.gppPath if global_config else "g++"
    is_python = "python" in settings.compiler.lower()
    
    # 1. Nhận diện file ảo
    is_temp_file = path.startswith("temp") and not os.path.isabs(path)
    
    if is_temp_file:
        dir_name = os.path.join(workspace_dir, ".cpe", "temp")
        os.makedirs(dir_name, exist_ok=True)
    else:
        dir_name = os.path.dirname(path) if os.path.exists(path) else workspace_dir

    file_name = os.path.basename(path)
    base_name = os.path.splitext(file_name)[0]
    
    io_base_name = settings.customFileName.strip() if settings.customFileName and settings.customFileName.strip() else base_name
    
    # --- LOGIC SANBOX ---
    is_sandbox = settings.useSandbox
    run_workspace = dir_name

    if is_sandbox:
        cpe_dir = os.path.join(dir_name, ".cpe")
        os.makedirs(cpe_dir, exist_ok=True)
        run_workspace = os.path.join(cpe_dir, f"workspace_{uuid.uuid4().hex[:8]}")
        os.makedirs(run_workspace, exist_ok=True)
    
    try:
        # 2. LUÔN GHI CODE VÀO 1 FILE THẬT TRONG RUN_WORKSPACE ĐỂ COMPILER ĐỌC ĐƯỢC
        src_file = os.path.join(run_workspace, file_name)
        with open(src_file, "w", encoding="utf-8", newline="\n") as f:
            f.write(code)

        # Cập nhật file gốc (nếu là file thật có trên ổ cứng)
        if not is_temp_file and os.path.exists(path) and src_file != path:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(code)

        if is_python:
            cmd = [python_cmd, "-u", file_name]
            yield json.dumps({"type": "compile_finish", "log": ""}) + "\n"
            
        else: # C++ Compilation
            exe_file = os.path.join(run_workspace, f"{base_name}.exe" if os.name == 'nt' else base_name)
            
            # 3. FIX LỖI: Sử dụng đường dẫn vật lý (src_file) thay vì đường dẫn ảo (path)
            compile_cmd = [gpp_cmd, src_file]
            
            if settings.optimization != "O0": compile_cmd.append(f"-{settings.optimization}")
            if settings.warnings: compile_cmd.append("-Wall")
            if settings.extraWarnings: compile_cmd.append("-Wextra")
            compile_cmd.extend(["-o", exe_file])
            
            proc = subprocess.run(compile_cmd, capture_output=True, text=True, cwd=run_workspace, creationflags=CREATE_NO_WINDOW)
            
            yield json.dumps({"type": "compile_finish", "log": proc.stderr}) + "\n"

            if proc.returncode != 0:
                for tc in testcases:
                    yield json.dumps({"type": "test_result", "result": {"id": tc["id"], "status": "CE", "output": "", "error_log": proc.stderr}}) + "\n"
                return
            
            cmd = [f"./{os.path.basename(exe_file)}" if os.name != 'nt' else exe_file]

        # Vòng lặp chạy từng Testcase
        inp_file = os.path.join(run_workspace, f"{io_base_name}.inp")
        out_file = os.path.join(run_workspace, f"{io_base_name}.out")

        for tc in testcases:
            try:
                timeout_sec = settings.timeLimit / 1000.0
                
                if settings.useFileIO:
                    with open(inp_file, "w", encoding="utf-8", newline="\n") as f: f.write(tc["input"])
                    if os.path.exists(out_file): os.remove(out_file)
                    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec, cwd=run_workspace, creationflags=CREATE_NO_WINDOW)
                else:
                    proc = subprocess.run(cmd, input=tc["input"], capture_output=True, text=True, timeout=timeout_sec, cwd=run_workspace, creationflags=CREATE_NO_WINDOW)
                
                if proc.returncode != 0:
                    status = "RE" 
                    out_text = proc.stdout.strip() + "\n" + proc.stderr.strip()
                else:
                    if settings.useFileIO:
                        out_text = open(out_file, "r", encoding="utf-8").read().strip() if os.path.exists(out_file) else "Error: .out not found"
                    else:
                        out_text = proc.stdout.strip()

                    actual_output = out_text.strip()
                    expected_answer = tc["answer"].strip()

                    # So sánh sau khi đã loại bỏ mọi dấu xuống dòng/khoảng trắng thừa
                    if not expected_answer:
                        status = "AC" # Nếu không có đáp án mẫu, coi như qua
                    elif actual_output == expected_answer:
                        status = "AC"
                    else:
                        status = "WA"
                    
                # Gửi kết quả của 1 testcase này về ngay lập tức
                yield json.dumps({"type": "test_result", "result": {
                    "id": tc["id"], "output": out_text, "status": status, "error_log": proc.stderr
                }}) + "\n"
                
            except subprocess.TimeoutExpired:
                yield json.dumps({"type": "test_result", "result": {"id": tc["id"], "output": "", "status": "TLE", "error_log": "Time Limit Exceeded"}}) + "\n"
            except Exception as e:
                yield json.dumps({"type": "test_result", "result": {"id": tc["id"], "output": "", "status": "RE", "error_log": str(e)}}) + "\n"
                
    finally:
        if is_sandbox and os.path.exists(run_workspace):
            shutil.rmtree(run_workspace, ignore_errors=True)