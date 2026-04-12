#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0601
#endif

#include <windows.h>
#include <iostream>
#include <string>
#include <iomanip>

struct MY_JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
    IO_COUNTERS IoInfo;
    SIZE_T ProcessMemoryLimit;
    SIZE_T JobMemoryLimit;
    SIZE_T PeakProcessMemoryLimit;
    SIZE_T PeakJobMemoryLimit;
};

struct ExecutionResult {
    std::string status = "RE";
    int exit_code = -1;
    double time_ms = 0;
    size_t memory_bytes = 0;
    std::string error_msg = "";
};

void print_json(const ExecutionResult& res) {
    std::cout << "{"
              << "\"status\":\"" << res.status << "\","
              << "\"exit_code\":" << res.exit_code << ","
              << "\"time_ms\":" << std::fixed << std::setprecision(2) << res.time_ms << ","
              << "\"memory_bytes\":" << res.memory_bytes << ","
              << "\"error_msg\":\"" << res.error_msg << "\""
              << "}" << std::endl;
}

int main(int argc, char* argv[]) {
    std::string cmd_line = "";
    int time_limit_ms = 1000;
    size_t memory_limit_mb = 256;

    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--cmd" && i + 1 < argc) cmd_line = argv[++i];
        else if (arg == "--time" && i + 1 < argc) time_limit_ms = std::stoi(argv[++i]);
        else if (arg == "--mem" && i + 1 < argc) memory_limit_mb = std::stoll(argv[++i]);
    }

    ExecutionResult res;
    HANDLE h_job = CreateJobObject(NULL, NULL);
    
    MY_JOBOBJECT_EXTENDED_LIMIT_INFORMATION jeli = { 0 };
    jeli.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_PROCESS_TIME | JOB_OBJECT_LIMIT_PROCESS_MEMORY | JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
    jeli.BasicLimitInformation.PerProcessUserTimeLimit.QuadPart = (LONGLONG)time_limit_ms * 10000;
    jeli.ProcessMemoryLimit = (SIZE_T)memory_limit_mb * 1024 * 1024;
    jeli.BasicLimitInformation.ActiveProcessLimit = 1;
    SetInformationJobObject(h_job, JobObjectExtendedLimitInformation, &jeli, sizeof(jeli));

    STARTUPINFO si = { sizeof(si) };
    PROCESS_INFORMATION pi = { 0 };
    si.dwFlags |= STARTF_USESTDHANDLES;
    si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
    si.hStdError = GetStdHandle(STD_ERROR_HANDLE);

    if (!CreateProcess(NULL, (LPSTR)cmd_line.c_str(), NULL, NULL, TRUE, CREATE_SUSPENDED | CREATE_BREAKAWAY_FROM_JOB | CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) {
        res.error_msg = "CreateProcess failed";
        print_json(res);
        return 1;
    }

    AssignProcessToJobObject(h_job, pi.hProcess);

    // --- BẮT ĐẦU ĐO THỜI GIAN THỰC (QPC) ---
    LARGE_INTEGER frequency, start, end;
    QueryPerformanceFrequency(&frequency);
    QueryPerformanceCounter(&start);

    ResumeThread(pi.hThread);
    DWORD wait_res = WaitForSingleObject(pi.hProcess, time_limit_ms + 500);

    QueryPerformanceCounter(&end);
    // ---------------------------------------

    JOBOBJECT_BASIC_ACCOUNTING_INFORMATION jbai = { 0 };
    QueryInformationJobObject(h_job, JobObjectBasicAccountingInformation, &jbai, sizeof(jbai), NULL);
    MY_JOBOBJECT_EXTENDED_LIMIT_INFORMATION jeli_final = { 0 };
    QueryInformationJobObject(h_job, JobObjectExtendedLimitInformation, &jeli_final, sizeof(jeli_final), NULL);

    // Tính toán Wall-clock Time bằng ms
    double wall_time_ms = (double)(end.QuadPart - start.QuadPart) * 1000.0 / frequency.QuadPart;
    // Lấy CPU Time từ Job (vẫn bị kẹt ở bội số 15.6ms)
    double cpu_time_ms = (double)jbai.TotalUserTime.QuadPart / 10000.0;

    // CHIẾN THUẬT: Ưu tiên Wall-time nếu CPU-time quá nhỏ hoặc không chính xác
    if (cpu_time_ms < 1.0) {
        res.time_ms = wall_time_ms;
    } else {
        // Nếu CPU-time > 15ms, ta dùng trung bình hoặc ưu tiên Wall-time để mượt mà hơn
        res.time_ms = wall_time_ms; 
    }
    
    res.memory_bytes = jeli_final.PeakProcessMemoryLimit;

    if (wait_res == WAIT_TIMEOUT) {
        TerminateProcess(pi.hProcess, 1);
        res.status = "TLE";
        res.time_ms = (double)time_limit_ms;
    } else {
        DWORD exit_code;
        GetExitCodeProcess(pi.hProcess, &exit_code);
        res.exit_code = (int)exit_code;
        if (exit_code == 0) res.status = "AC";
        else if (res.time_ms >= (double)time_limit_ms * 0.98) res.status = "TLE";
        else res.status = "RE";
    }

    print_json(res);
    CloseHandle(pi.hProcess); CloseHandle(pi.hThread); CloseHandle(h_job);
    return 0;
}

/*
g++ runner.cpp -o runner.exe -static -lkernel32 -lwinmm
*/