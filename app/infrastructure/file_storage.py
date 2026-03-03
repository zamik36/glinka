import os
import uuid
import aiofiles
from fastapi import UploadFile, HTTPException
from app.core.config import settings

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

class FileStorageService:
    def __init__(self):
        self.storage_dir = settings.FILE_STORAGE_DIR
        os.makedirs(self.storage_dir, exist_ok=True)

    async def save(self, file: UploadFile) -> tuple[str, int]:
        ext = os.path.splitext(file.filename or "file")[1]
        stored_name = f"{uuid.uuid4().hex}{ext}"
        full_path = os.path.join(self.storage_dir, stored_name)

        size = 0
        async with aiofiles.open(full_path, "wb") as f:
            while chunk := await file.read(65536):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    await f.close()
                    os.remove(full_path)
                    raise HTTPException(status_code=413, detail=f"File {file.filename} exceeds 10MB limit")
                await f.write(chunk)

        return stored_name, size

    def get_full_path(self, stored_path: str) -> str:
        return os.path.join(self.storage_dir, stored_path)
