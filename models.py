from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal, Union

class Snippet(BaseModel):
    id: str
    name: str
    content: str

class GlobalConfig(BaseModel):
    lastWorkspace: str
    gppPath: str = "g++"
    pythonPath: str = "python"
    autoSaveDelay: int = 5000
    editorFontSize: int = 14
    editorFontFamily: str = "'JetBrains Mono', 'Fira Code', monospace"
    appVersion: str = "v1.0.0"
    openFileIds: List[str] = []
    activeFileId: str = ""
    treeState: Optional[Dict[str, bool]] = {}
    snippets: List[Snippet] = []
    snippetShortcut: str = "Ctrl+Shift+P"

# Common settings for both C++ and Python
class CompileAndRunSettings(BaseModel):
    timeLimit: int
    memoryLimit: int
    useSandbox: bool
    useFileIO: Optional[bool] = True
    customFileName: Optional[str] = ""

class CppSettings(CompileAndRunSettings):
    compiler: str = "g++"
    optimization: Literal['O0', 'O1', 'O2', 'O3'] = "O2"
    warnings: bool = True
    extraWarnings: bool = True
    std: Literal['c++11', 'c++14', 'c++17', 'c++20', 'c++23'] = "c++14"

class PythonSettings(CompileAndRunSettings):
    compiler: str = "python"
    # No specific Python-only settings for now

# Union type for settings
Settings = Union[CppSettings, PythonSettings]


class CreateItemReq(BaseModel):
    parent_path: str
    name: str
    type: str # 'file' hoặc 'folder'

class DeleteItemReq(BaseModel):
    path: str

class RenameItemReq(BaseModel):
    old_path: str
    new_name: str

class TestCase(BaseModel):
    id: str
    input: str
    answer: str
    output: Optional[str] = ""
    status: Optional[str] = "pending"
    time: Optional[int] = -1

class FileDataSaveReq(BaseModel):
    path: str
    settings: Optional[Settings] = None # Use the union type here
    testcases: Optional[List[TestCase]] = None

class FileContentSaveReq(BaseModel):
    path: str
    content: str

class RunAllReq(BaseModel):
    path: str
    code: str
    testcases: List[TestCase]
    settings: Settings # Use the union type here
    globalConfig: Optional[GlobalConfig] = None