import os
import sqlite3
import json
import zstandard as zstd
import logging

# Cấu hình log để dễ dàng theo dõi lỗi nếu có
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Database")

compressor = zstd.ZstdCompressor(level=3)
decompressor = zstd.ZstdDecompressor()

def get_db_info(code_file_path: str):
    """Phân tích đường dẫn an toàn."""
    if not code_file_path:
        return None, None
    folder_path = os.path.dirname(os.path.abspath(code_file_path))
    file_name = os.path.basename(code_file_path)
    db_path = os.path.join(folder_path, "cpe_data.db")
    return db_path, file_name

def init_folder_db(db_path: str):
    """Khởi tạo DB và tạo bảng, xử lý lỗi quyền ghi hoặc thư mục không tồn tại."""
    try:
        # Đảm bảo thư mục cha tồn tại trước khi tạo DB
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        conn = sqlite3.connect(db_path, timeout=5) # Timeout để tránh treo khi USB chậm
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        
        # Bảng problems (thay thế problem_data cũ, lưu thông tin cơ bản về file code)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS problems (
                file_name TEXT PRIMARY KEY, -- Tên file code (ví dụ: main.cpp)
                sketches_bin BLOB
            )
        """)
        
        # Bảng settings (lưu cài đặt biên dịch/chạy cho từng bài toán)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                problem_file_name TEXT PRIMARY KEY, -- Khóa ngoại tới problems.file_name
                compiler TEXT NOT NULL,
                optimization TEXT, -- NULL nếu là Python
                warnings BOOLEAN, -- NULL nếu là Python
                extra_warnings BOOLEAN, -- NULL nếu là Python
                std TEXT, -- NULL nếu là Python
                time_limit INTEGER NOT NULL,
                memory_limit INTEGER NOT NULL,
                use_sandbox BOOLEAN NOT NULL,
                use_file_io BOOLEAN NOT NULL,
                custom_file_name TEXT,
                checker TEXT DEFAULT 'Ignore Trailing Space (Default)',
                FOREIGN KEY (problem_file_name) REFERENCES problems(file_name) ON DELETE CASCADE
            )""")

        # Bảng testcases (lưu từng testcase riêng lẻ)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS testcases (
                id TEXT PRIMARY KEY, -- UUID của testcase từ frontend
                problem_file_name TEXT NOT NULL, -- Khóa ngoại tới problems.file_name
                name TEXT,
                input TEXT, -- Có thể NULL khi mới tạo hoặc để trống
                answer TEXT, -- Có thể NULL khi mới tạo hoặc để trống
                output TEXT,
                status TEXT NOT NULL,
                time INTEGER,
                memory INTEGER,
                FOREIGN KEY (problem_file_name) REFERENCES problems(file_name) ON DELETE CASCADE
            )""")
        conn.commit()
        
        try:
            conn.execute("ALTER TABLE settings ADD COLUMN checker TEXT DEFAULT 'Ignore Trailing Space (Default)'")
        except:
            pass
        try:
            conn.execute("ALTER TABLE testcases ADD COLUMN name TEXT")
        except:
            pass
        try:
            conn.execute("ALTER TABLE testcases ADD COLUMN memory INTEGER")
        except:
            pass
        return conn
    except Exception as e:
        logger.error(f"Không thể khởi tạo Database tại {db_path}: {e}")
        return None

def get_problem_data(code_file_path: str):
    """
    Đọc data an toàn. 
    Trả về (None, []) nếu có bất kỳ lỗi nào xảy ra.
    """
    db_path, file_name = get_db_info(code_file_path)
    
    # Trường hợp không có file DB: Trả về dữ liệu mặc định ngay
    if not db_path or not os.path.exists(db_path):
        return None, []
        
    conn = None
    try:
        conn = sqlite3.connect(db_path, timeout=5)
        cursor = conn.cursor()
        
        # 1. Lấy settings
        settings_dict = None
        has_checker = True
        try:
            cursor.execute("""
                SELECT compiler, optimization, warnings, extra_warnings, std,
                       time_limit, memory_limit, use_sandbox, use_file_io, custom_file_name, checker
                FROM settings WHERE problem_file_name = ?
            """, (file_name,))
            settings_row = cursor.fetchone()
        except sqlite3.OperationalError:
            cursor.execute("""
                SELECT compiler, optimization, warnings, extra_warnings, std,
                       time_limit, memory_limit, use_sandbox, use_file_io, custom_file_name
                FROM settings WHERE problem_file_name = ?
            """, (file_name,))
            settings_row = cursor.fetchone()
            has_checker = False
        
        if settings_row:
            settings_dict = {
                "compiler": settings_row[0],
                "optimization": settings_row[1],
                "warnings": bool(settings_row[2]) if settings_row[2] is not None else None,
                "extraWarnings": bool(settings_row[3]) if settings_row[3] is not None else None,
                "std": settings_row[4],
                "timeLimit": settings_row[5],
                "memoryLimit": settings_row[6],
                "useSandbox": bool(settings_row[7]),
                "useFileIO": bool(settings_row[8]),
                "customFileName": settings_row[9],
                "checker": settings_row[10] if has_checker else "Ignore Trailing Space (Default)"
            }

        # 2. Lấy testcases
        testcases = []
        try:
            cursor.execute("""
                SELECT id, name, input, answer, output, status, time, memory
                FROM testcases WHERE problem_file_name = ?
                ORDER BY rowid
            """, (file_name,))
            testcase_rows = cursor.fetchall()
            for tc_row in testcase_rows:
                testcases.append({
                    "id": tc_row[0],
                    "name": tc_row[1],
                    "input": tc_row[2],
                    "answer": tc_row[3],
                    "output": tc_row[4] if tc_row[4] is not None else "",
                    "status": tc_row[5],
                    "time": tc_row[6] if tc_row[6] is not None else -1,
                    "memory": tc_row[7] if len(tc_row) > 7 and tc_row[7] is not None else -1
                })
        except sqlite3.OperationalError:
            try:
                cursor.execute("""
                    SELECT id, name, input, answer, output, status, time
                    FROM testcases WHERE problem_file_name = ?
                    ORDER BY rowid
                """, (file_name,))
                testcase_rows = cursor.fetchall()
                for tc_row in testcase_rows:
                    testcases.append({
                        "id": tc_row[0],
                        "name": tc_row[1],
                        "input": tc_row[2],
                        "answer": tc_row[3],
                        "output": tc_row[4] if tc_row[4] is not None else "",
                        "status": tc_row[5],
                        "time": tc_row[6] if tc_row[6] is not None else -1,
                        "memory": -1
                    })
            except sqlite3.OperationalError:
                cursor.execute("""
                    SELECT id, input, answer, output, status, time
                    FROM testcases WHERE problem_file_name = ?
                    ORDER BY rowid
                """, (file_name,))
                testcase_rows = cursor.fetchall()
                for tc_row in testcase_rows:
                    testcases.append({
                        "id": tc_row[0],
                        "input": tc_row[1],
                        "answer": tc_row[2],
                        "output": tc_row[3] if tc_row[3] is not None else "",
                        "status": tc_row[4],
                        "time": tc_row[5] if tc_row[5] is not None else -1,
                        "memory": -1
                    })
        
        if not settings_row and not testcase_rows:
            return None, []
                
        return settings_dict, testcases

    except sqlite3.Error as e:
        logger.error(f"Lỗi truy vấn SQLite: {e}")
        return None, []
    finally:
        if conn:
            conn.close()

def save_problem_data(code_file_path: str, settings_dict: dict, testcases_list: list):
    """Ghi data an toàn, bỏ qua nếu không thể ghi (ví dụ USB bị khóa Read-only)."""
    db_path, file_name = get_db_info(code_file_path)
    if not db_path: return
    
    conn = init_folder_db(db_path)
    if not conn: return # Không thể mở kết nối thì thoát luôn
    
    try:
        cursor = conn.cursor()
        
        # 1. Lưu hoặc cập nhật bảng problems (chỉ cần file_name)
        cursor.execute("""
            INSERT OR IGNORE INTO problems (file_name) VALUES (?)
        """, (file_name,))

        # 2. Lưu hoặc cập nhật bảng settings
        if settings_dict:
            # Xác định các trường cụ thể cho C++ hoặc Python
            is_python = "python" in settings_dict.get("compiler", "").lower()
            
            settings_values = {
                "problem_file_name": file_name,
                "compiler": settings_dict.get("compiler"),
                "optimization": settings_dict.get("optimization") if not is_python else None,
                "warnings": settings_dict.get("warnings") if not is_python else None,
                "extra_warnings": settings_dict.get("extraWarnings") if not is_python else None,
                "std": settings_dict.get("std") if not is_python else None,
                "time_limit": settings_dict.get("timeLimit"),
                "memory_limit": settings_dict.get("memoryLimit"),
                "use_sandbox": settings_dict.get("useSandbox"),
                "use_file_io": settings_dict.get("useFileIO"),
                "custom_file_name": settings_dict.get("customFileName"),
                "checker": settings_dict.get("checker", "Ignore Trailing Space (Default)")
            }
            
            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO settings (
                        problem_file_name, compiler, optimization, warnings, extra_warnings, std,
                        time_limit, memory_limit, use_sandbox, use_file_io, custom_file_name, checker
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, tuple(settings_values.values()))
            except sqlite3.OperationalError:
                try:
                    cursor.execute("ALTER TABLE settings ADD COLUMN checker TEXT DEFAULT 'Ignore Trailing Space (Default)'")
                    cursor.execute("""
                        INSERT OR REPLACE INTO settings (
                            problem_file_name, compiler, optimization, warnings, extra_warnings, std,
                            time_limit, memory_limit, use_sandbox, use_file_io, custom_file_name, checker
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, tuple(settings_values.values()))
                except:
                    settings_values.pop("checker", None)
                    cursor.execute("""
                        INSERT OR REPLACE INTO settings (
                            problem_file_name, compiler, optimization, warnings, extra_warnings, std,
                            time_limit, memory_limit, use_sandbox, use_file_io, custom_file_name
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, tuple(settings_values.values()))

        # 3. Xóa testcases cũ và thêm testcases mới
        cursor.execute("DELETE FROM testcases WHERE problem_file_name = ?", (file_name,))
        if testcases_list:
            testcase_data = []
            for tc in testcases_list:
                testcase_data.append((
                    tc.get("id"), file_name, tc.get("name"), tc.get("input"), tc.get("answer"),
                    tc.get("output"), tc.get("status"), tc.get("time"), tc.get("memory", -1)
                ))
            try:
                cursor.executemany("""
                    INSERT INTO testcases (id, problem_file_name, name, input, answer, output, status, time, memory)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", testcase_data)
            except sqlite3.OperationalError:
                testcase_data_old = []
                for tc in testcases_list:
                    testcase_data_old.append((
                        tc.get("id"), file_name, tc.get("name"), tc.get("input"), tc.get("answer"),
                        tc.get("output"), tc.get("status"), tc.get("time")
                    ))
                cursor.executemany("""
                    INSERT INTO testcases (id, problem_file_name, name, input, answer, output, status, time)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""", testcase_data_old)
        conn.commit()
    except Exception as e:
        logger.error(f"Lỗi khi lưu dữ liệu cho {file_name}: {e}")
    finally:
        conn.close()

def update_testcase_result(code_file_path: str, tc_id: str, output: str, status: str, time: int, memory: float):
    """Chỉ cập nhật kết quả của một testcase cụ thể để tối ưu hiệu suất khi chạy hàng loạt."""
    db_path, file_name = get_db_info(code_file_path)
    if not db_path or not os.path.exists(db_path):
        return
        
    try:
        with sqlite3.connect(db_path, timeout=5) as conn:
            conn.execute("""
                UPDATE testcases 
                SET output = ?, status = ?, time = ?, memory = ?
                WHERE id = ? AND problem_file_name = ?
            """, (output, status, time, memory, tc_id, file_name))
    except Exception as e:
        logger.error(f"Lỗi khi cập nhật kết quả testcase {tc_id}: {e}")

def rename_problem_data(old_code_path: str, new_code_path: str):
    """Đổi tên an toàn, không crash nếu file DB không tồn tại."""
    old_db_path, old_name = get_db_info(old_code_path)
    new_db_path, new_name = get_db_info(new_code_path)
    
    if not old_db_path or not os.path.exists(old_db_path):
        return
        
    if old_db_path == new_db_path:
        try:
            with sqlite3.connect(old_db_path) as conn:
                conn.execute("UPDATE problems SET file_name = ? WHERE file_name = ?", (new_name, old_name))
                conn.execute("UPDATE settings SET problem_file_name = ? WHERE problem_file_name = ?", (new_name, old_name))
                conn.execute("UPDATE testcases SET problem_file_name = ? WHERE problem_file_name = ?", (new_name, old_name))
        except Exception as e:
            logger.error(f"Lỗi khi đổi tên record trong DB: {e}")

def delete_problem_data(code_file_path: str):
    """Xóa an toàn, dọn dẹp file DB nếu thư mục trống."""
    db_path, file_name = get_db_info(code_file_path)
    if not db_path or not os.path.exists(db_path):
        return
        
    try:
        with sqlite3.connect(db_path) as conn:
            # Xóa từ bảng problems sẽ tự động xóa các bản ghi liên quan trong settings và testcases nhờ ON DELETE CASCADE
            conn.execute("DELETE FROM problems WHERE file_name = ?", (file_name,))
            
            # Kiểm tra xem còn bài nào khác dùng chung DB này không
            cursor = conn.cursor()
            # Đếm số lượng bài toán còn lại trong DB này
            cursor.execute("SELECT COUNT(*) FROM problems")
            count = cursor.fetchone()[0]
            
        # Nếu DB không còn dữ liệu bài nào, xóa luôn file cho sạch thư mục
        if count == 0:
            # Đóng kết nối hoàn toàn trước khi xóa file
            import time
            time.sleep(0.1) # Chờ một chút để hệ thống thả file
            for suffix in ["", "-wal", "-shm"]:
                f = db_path + suffix
                if os.path.exists(f):
                    try: os.remove(f)
                    except: pass
    except Exception as e:
        logger.error(f"Lỗi khi xóa dữ liệu bài tập: {e}")

# --- CẤU TRÚC FILE DATABASE.PY ---
# File này quản lý việc lưu trữ và truy xuất dữ liệu liên quan đến các bài toán (problems),
# cài đặt biên dịch/chạy (settings) và các testcase của từng bài toán.
#
# Dữ liệu được lưu trữ trong cơ sở dữ liệu SQLite, với mỗi thư mục chứa file code
# sẽ có một file `cpe_data.db` riêng biệt.
#
# Các bảng chính trong DB:
# 1.  `problems`: Lưu thông tin cơ bản về file code (tên file, dữ liệu sketch).
# 2.  `settings`: Lưu cài đặt biên dịch/chạy (compiler, timeLimit, memoryLimit, v.v.) cho từng bài toán.
# 3.  `testcases`: Lưu trữ các testcase riêng lẻ (input, answer, output, status, time) cho từng bài toán.
#
# Các hàm chính:
# - `get_db_info`: Phân tích đường dẫn file code để xác định đường dẫn DB và tên file.
# - `init_folder_db`: Khởi tạo file DB và tạo các bảng cần thiết.
# - `get_problem_data`: Đọc cài đặt và testcase của một bài toán từ DB.
# - `save_problem_data`: Lưu cài đặt và testcase của một bài toán vào DB.
# - `rename_problem_data`: Cập nhật tên file trong DB khi file code được đổi tên.
# - `delete_problem_data`: Xóa dữ liệu của một bài toán khỏi DB, và xóa file DB nếu không còn bài toán nào.