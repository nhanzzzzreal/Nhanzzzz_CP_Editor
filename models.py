from pydantic import BaseModel
from typing import List, Optional, Dict, Any

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

class Settings(BaseModel):
    compiler: str
    optimization: str
    warnings: bool
    extraWarnings: bool
    fastCompile: bool
    outputFile: str
    timeLimit: int
    memoryLimit: int
    useSandbox: bool
    useFileIO: Optional[bool] = True
    customFileName: Optional[str] = ""

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

class FileDataSaveReq(BaseModel):
    path: str
    settings: Optional[Settings] = None
    testcases: Optional[List[TestCase]] = None

class FileContentSaveReq(BaseModel):
    path: str
    content: str

class RunAllReq(BaseModel):
    path: str
    code: str
    testcases: List[TestCase]
    settings: Settings
    globalConfig: Optional[GlobalConfig] = None