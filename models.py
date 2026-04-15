from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal, Union

class Snippet(BaseModel):
    id: str
    name: str
    content: str

class Shortcuts(BaseModel):
    snippetShortcut: str
    # Thêm các phím tắt khác vào đây trong tương lai

class GlobalConfig(BaseModel):
    lastWorkspace: str
    gppPath: str
    pythonPath: str
    autoSaveDelay: int
    editorFontSize: int
    editorFontFamily: str
    appVersion: str
    openFileIds: List[str]
    activeFileId: str
    treeState: Optional[Dict[str, bool]]
    snippets: List[Snippet]
    shortcuts: Shortcuts

# Common settings for both C++ and Python
class CompileAndRunSettings(BaseModel):
    timeLimit: int
    memoryLimit: int
    useSandbox: bool
    useFileIO: Optional[bool]
    customFileName: Optional[str]

class CppSettings(CompileAndRunSettings):
    compiler: str
    optimization: Literal['O0', 'O1', 'O2', 'O3']
    warnings: bool
    extraWarnings: bool
    std: Literal['c++11', 'c++14', 'c++17', 'c++20', 'c++23']

class PythonSettings(CompileAndRunSettings):
    compiler: str
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
    input: Optional[str] = None
    answer: Optional[str] = None
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