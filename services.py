import os
import json
import subprocess
import uuid
import shutil
import time
import sys
from typing import List, Optional, Union
import database
from models import CppSettings, PythonSettings, GlobalConfig, Settings

# --- HẰNG SỐ ĐỂ ẨN CỬA SỔ TERMINAL ---
CREATE_NO_WINDOW = 0x08000000

class DotDict(dict):
    def __getattr__(self, item):
        if item in self:
            return self[item]
        raise AttributeError(item)

def execute_code_stream(path: str, code: str, settings_dict: dict, global_config_dict: Optional[dict] = None, workspace_dir: str = "workspace", target_testcase_id: Optional[str] = None):
    settings = DotDict(settings_dict)
    global_config = DotDict(global_config_dict) if global_config_dict else None

    # --- NEW WORKFLOW: Get testcases directly from the database ---
    # The 'testcases' argument is removed. We trust the data that was just saved by the server endpoint.
    current_settings, all_db_testcases = database.get_problem_data(path)
    testcases_to_run = all_db_testcases
    
    if target_testcase_id:
        testcases_to_run = [tc for tc in all_db_testcases if tc["id"] == target_testcase_id]

    if not testcases_to_run:
        # This case should be rare since the server just saved them, but it's good practice to check.
        yield json.dumps({"type": "log", "log": "Warning: No testcases found in database to run."}) + "\n"
        return
    # --- END NEW WORKFLOW ---

    python_cmd = global_config.pythonPath if global_config else "python"
    gpp_cmd = global_config.gppPath if global_config else "g++"
    is_python = "python" in settings.compiler.lower()
    
    # --- ĐẢM BẢO ĐƯỜNG DẪN ĐẾN RUNNER.EXE LÀ TUYỆT ĐỐI ---
    # Giả định runner.exe nằm ở thư mục gốc của project (cùng cấp với file chạy python chính)
    runner_exe_path = os.path.join(os.getcwd(), "runner.exe")
    
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
        # 2. GHI CODE VÀO FILE THẬT
        src_file = os.path.join(run_workspace, file_name)
        with open(src_file, "w", encoding="utf-8", newline="") as f:
            f.write(code)

        if not is_temp_file and os.path.exists(path) and src_file != path:
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(code)

        if is_python:
            python_settings: PythonSettings = settings # Type hint for clarity
            cmd = [python_settings.compiler, "-u", file_name]
            yield json.dumps({"type": "compile_finish", "log": ""}) + "\n"
            
        else: # C++ Compilation
            cpp_settings: CppSettings = settings # Type hint for clarity
            exe_file = os.path.join(run_workspace, f"{base_name}.exe" if os.name == 'nt' else base_name)
            
            compile_cmd = [cpp_settings.compiler, src_file, f"-std={cpp_settings.std}"]
            if cpp_settings.optimization != "O0": compile_cmd.append(f"-{cpp_settings.optimization}")
            if cpp_settings.warnings: compile_cmd.append("-Wall")
            if cpp_settings.extraWarnings: compile_cmd.append("-Wextra")
            compile_cmd.extend(["-o", exe_file])

            yield json.dumps({"type": "log", "log": f"Compiler command: {' '.join(compile_cmd)}"}) + "\n"

            # Vẫn dùng CREATE_NO_WINDOW để ẩn terminal khi biên dịch
            proc = subprocess.run(compile_cmd, capture_output=True, text=True, cwd=run_workspace)
            
            yield json.dumps({"type": "compile_finish", "log": proc.stderr}) + "\n"

            if proc.returncode != 0:
                for tc in testcases_to_run:
                    yield json.dumps({"type": "test_result", "result": {"id": tc["id"], "status": "CE", "output": "", "error_log": proc.stderr}}) + "\n"
                # --- LƯU TRẠNG THÁI CE VÀO DATABASE ---
                if not is_temp_file and path:
                    for db_tc in all_db_testcases:
                        if target_testcase_id and db_tc["id"] != target_testcase_id:
                            continue
                        db_tc["status"] = "CE"
                    database.save_problem_data(path, current_settings, all_db_testcases)
                    yield json.dumps({"type": "results_saved", "path": path}) + "\n"
                return
            
            cmd = [f"./{os.path.basename(exe_file)}" if os.name != 'nt' else exe_file]

        # Đường dẫn in/out (nếu dùng File IO)
        inp_file = os.path.join(run_workspace, f"{io_base_name}.inp")
        out_file = os.path.join(run_workspace, f"{io_base_name}.out")

        # 3. VÒNG LẶP CHẠY TỪNG TESTCASE QUA RUNNER.EXE
        # --- XỬ LÝ CUSTOM CHECKER ---
        checker_name = settings.get("checker", "Ignore Trailing Space (Default)")
        is_default_checker = checker_name.startswith("Ignore Trailing Space") or checker_name == ""
        checker_exe = None
        
        base_dir = os.path.dirname(os.path.abspath(__file__))
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
            
        if not is_default_checker:
            checker_basename = os.path.splitext(checker_name)[0]
            checker_file_cpp = os.path.join(base_dir, "checkers", f"{checker_basename}.cpp")
            checker_file_exe = os.path.join(base_dir, "checkers", f"{checker_basename}.exe")

            if os.path.exists(checker_file_exe):
                # Ưu tiên dùng file .exe đã được dịch sẵn trong thư mục checkers
                checker_exe = checker_file_exe
            elif os.path.exists(checker_file_cpp):
                checker_exe = os.path.join(workspace_dir, ".cpe", "temp", f"{checker_basename}.exe")
                if not os.path.exists(checker_exe) or os.path.getmtime(checker_file_cpp) > os.path.getmtime(checker_exe):
                    yield json.dumps({"type": "log", "log": f"Compiling custom checker {checker_basename}.cpp..."}) + "\n"
                    gpp_path = global_config.gppPath if global_config else "g++"
                    subprocess.run([gpp_path, checker_file_cpp, "-o", checker_exe, "-O2", "-std=c++14"], capture_output=True)
            else:
                yield json.dumps({"type": "log", "log": f"Warning: Checker {checker_basename} not found. Falling back to default."}) + "\n"
                is_default_checker = True
                
        yield json.dumps({"type": "log", "log": f"Using Checker: {checker_exe if not is_default_checker else 'Ignore Trailing Space (Default)'}"}) + "\n"

        for tc in testcases_to_run:
            tc_index = testcases_to_run.index(tc) + 1
            yield json.dumps({"type": "log", "log": f"--- Running Testcase #{tc_index} (ID: {tc['id']}) ---"}) + "\n"
            result_to_yield = None
            try:
                timeout_sec = settings.timeLimit / 1000.0
                memory_limit_mb = getattr(settings, 'memoryLimit', 256)

                if settings.useFileIO:
                    with open(inp_file, "w", encoding="utf-8", newline="") as f: 
                        f.write(tc["input"])
                    if os.path.exists(out_file): 
                        os.remove(out_file)

                # Chuyển lệnh gốc thành string để truyền cho C++ Runner
                cmd_str = " ".join(cmd)
                
                # Cấu hình gọi runner.exe
                runner_cmd = [
                    runner_exe_path,
                    "--time", str(settings.timeLimit),
                    "--mem", str(memory_limit_mb),
                    "--cmd", cmd_str
                ]
                
                # Gọi C++ Runner
                proc = subprocess.Popen(
                    runner_cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    cwd=run_workspace,
                    creationflags=CREATE_NO_WINDOW # Ẩn cửa sổ Console của Runner
                )
                
                input_data = "" if settings.useFileIO else tc["input"]
                
                # Đợi kết quả trả về. Ta cho thêm 1.0s vì bản thân runner.exe đã tự quản lý timeout.
                out_stdout, out_stderr = proc.communicate(input=input_data, timeout=timeout_sec + 1.0)
                
                # Phân tích kết quả từ Runner
                raw_stdout = out_stdout or ""
                lines_for_json = raw_stdout.rstrip().splitlines()
                runner_result = None
                actual_stdout = ""
                
                if lines_for_json:
                    try:
                        last_line = lines_for_json[-1]
                        runner_result = json.loads(last_line)
                        # Tìm vị trí của chuỗi JSON cuối cùng để tách lấy phần output thực tế
                        # Điều này giúp giữ nguyên toàn bộ khoảng trắng/xuống dòng ở cuối của actual_stdout
                        idx = raw_stdout.rfind(last_line)
                        actual_stdout = raw_stdout[:idx]
                    except json.JSONDecodeError:
                        actual_stdout = raw_stdout
                        runner_result = {"status": "RE", "error_msg": "Không thể parse JSON từ runner", "time_ms": 0}
                else:
                    runner_result = {"status": "RE", "error_msg": "Runner không trả về kết quả", "time_ms": 0}

                # Trích xuất dữ liệu
                runner_status = runner_result.get("status", "RE")
                exec_time = runner_result.get("time_ms", 0)
                exec_memory = round(runner_result.get("memory_bytes", 0) / (1024 * 1024), 2) # Giữ 2 chữ số thập phân cho chính xác (VD: 6.45MB)
                error_msg = runner_result.get("error_msg", "")
                
                # Ghép thêm stderr của child process nếu có lỗi
                if out_stderr and not error_msg:
                    error_msg = out_stderr.strip()

                # Kiểm tra trạng thái do Runner đánh giá (TLE/RE)
                if runner_status != "AC":
                    status = runner_status
                    out_text = (actual_stdout + "\n" + error_msg).strip()
                    # Nếu runner báo TLE, thời gian trả về phải là time limit, không phải thời gian thực tế đã chạy
                    if status == "TLE":
                        exec_time = settings.timeLimit
                else:
                    # Nếu Runner đánh giá code chạy xong bình thường (AC), ta đi check kết quả đúng/sai
                    if settings.useFileIO:
                        out_text = open(out_file, "r", encoding="utf-8").read() if os.path.exists(out_file) else "Error: .out không tìm thấy"
                    else:
                        out_text = actual_stdout

                    actual_output = out_text.replace('\r\n', '\n')
                    expected_answer = str(tc.get("answer") or "").replace('\r\n', '\n')

                    if is_default_checker:
                        ans_stripped = expected_answer.strip()
                        out_stripped = actual_output.strip()
                        if not ans_stripped:
                            status = "AC" 
                        elif out_stripped == ans_stripped:
                            status = "AC"
                        else:
                            status = "WA"
                    else:
                        # Chấm bằng Custom Checker
                        ans_file = os.path.join(run_workspace, f"{io_base_name}.ans")
                        with open(ans_file, "w", encoding="utf-8", newline="") as f:
                            f.write(expected_answer)
                            
                        if not settings.useFileIO:
                            with open(out_file, "w", encoding="utf-8", newline="") as f:
                                f.write(actual_output)
                            with open(inp_file, "w", encoding="utf-8", newline="") as f:
                                f.write(tc.get("input", ""))
                                
                        if checker_exe and os.path.exists(checker_exe):
                            chk_proc = subprocess.run(
                                [checker_exe, inp_file, out_file, ans_file], 
                                capture_output=True, 
                                text=True,
                                creationflags=CREATE_NO_WINDOW
                            )
                            if chk_proc.returncode == 0:
                                status = "AC"
                            else:
                                status = "WA"
                                chk_msg = chk_proc.stderr.strip() or chk_proc.stdout.strip()
                                if chk_msg: error_msg = f"Checker: {chk_msg}"
                        else:
                            status = "WA"
                            error_msg = "Checker executable not found or failed to compile."
                    
                result_to_yield = {
                    "id": tc["id"], "output": out_text, "status": status, "error_log": error_msg, "time": int(exec_time), "memory": exec_memory
                }
                
            except subprocess.TimeoutExpired:
                # Fallback cuối cùng nếu runner.exe bị treo
                proc.kill()
                proc.communicate()
                result_to_yield = {"id": tc["id"], "output": "", "status": "TLE", "error_log": "Time Limit Exceeded (Python Timeout)", "time": settings.timeLimit, "memory": -1}
            except Exception as e:
                result_to_yield = {"id": tc["id"], "output": "", "status": "RE", "error_log": f"System Error: {str(e)}", "time": -1, "memory": -1}
            
            if result_to_yield:
                yield json.dumps({"type": "test_result", "result": result_to_yield}) + "\n"
                
                # --- LƯU KẾT QUẢ NGAY SAU MỖI TESTCASE ---
                if not is_temp_file and path:
                    try:
                        for db_tc in all_db_testcases:
                            if db_tc["id"] == tc["id"]:
                                db_tc["output"] = result_to_yield.get("output", "")
                                db_tc["status"] = result_to_yield.get("status", "pending")
                                db_tc["time"] = result_to_yield.get("time", -1)
                                db_tc["memory"] = result_to_yield.get("memory", -1)
                                break
         
                        # Sử dụng UPDATE trực tiếp thay vì ghi đè toàn bộ dữ liệu file
                        database.update_testcase_result(
                            path,
                            tc["id"],
                            result_to_yield.get("output", ""),
                            result_to_yield.get("status", "pending"),
                            result_to_yield.get("time", -1),
                            result_to_yield.get("memory", -1)
                        )
                    except Exception as e:
                        yield json.dumps({"type": "log", "log": f"Server Error: Could not save results: {str(e)}"}) + "\n"

        if not is_temp_file and path:
            yield json.dumps({"type": "results_saved", "path": path}) + "\n"
                
    finally:
        if is_sandbox and os.path.exists(run_workspace):
            shutil.rmtree(run_workspace, ignore_errors=True)