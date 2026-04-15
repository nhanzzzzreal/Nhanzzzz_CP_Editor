DEFAULT_SHORTCUTS = {
    "snippetShortcut": "Ctrl+Shift+P",
    # Thêm các phím tắt khác vào đây trong tương lai (ví dụ: "vimModeToggle": "Ctrl+V")
}

DEFAULT_GLOBAL_CONFIG = {
    "lastWorkspace": "", # This will be dynamically set by server.py
    "gppPath": "g++",
    "pythonPath": "python",
    "autoSaveDelay": 1500,
    "editorFontSize": 14,
    "editorFontFamily": "'JetBrains Mono', 'Fira Code', monospace",
    "appVersion": "v1.0.0",
    "openFileIds": [],
    "activeFileId": "",
    "treeState": {},
    "snippets": [],
    "shortcuts": DEFAULT_SHORTCUTS,
}

DEFAULT_CPP_SETTINGS = {
    "compiler": "g++",
    "optimization": "O2",
    "warnings": True,
    "extraWarnings": True,
    "std": "c++14",
    "timeLimit": 1000,
    "memoryLimit": 256,
    "useSandbox": True,
    "useFileIO": True,
    "customFileName": "",
}

DEFAULT_PYTHON_SETTINGS = {
    "compiler": "python",
    "timeLimit": 1000,
    "memoryLimit": 256,
    "useSandbox": True,
    "useFileIO": True,
    "customFileName": "",
}