import asyncio
import logging
import os
import uuid
import aiofiles
from fastapi import UploadFile, HTTPException
from app.core.config import settings

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
                      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                      '.txt', '.zip', '.rar', '.7z'}

ALLOWED_MIMES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
}


class FileStorageService:
    def __init__(self):
        self.storage_dir = os.path.normpath(settings.FILE_STORAGE_DIR)
        os.makedirs(self.storage_dir, exist_ok=True)

    def _validate_file_type(self, filename: str, content_type: str | None) -> None:
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed")
        if content_type and content_type not in ALLOWED_MIMES:
            raise HTTPException(status_code=400, detail=f"MIME type '{content_type}' is not allowed")

    def _safe_path(self, stored_path: str) -> str:
        full = os.path.normpath(os.path.join(self.storage_dir, stored_path))
        if not full.startswith(self.storage_dir + os.sep) and full != self.storage_dir:
            raise ValueError("Invalid file path")
        return full

    async def save(self, file: UploadFile) -> tuple[str, int]:
        filename = file.filename or "file"
        self._validate_file_type(filename, file.content_type)

        ext = os.path.splitext(filename)[1].lower()
        stored_name = f"{uuid.uuid4().hex}{ext}"
        full_path = self._safe_path(stored_name)

        size = 0
        async with aiofiles.open(full_path, "wb") as f:
            while chunk := await file.read(65536):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    await asyncio.to_thread(os.remove, full_path)
                    raise HTTPException(status_code=413, detail=f"File {filename} exceeds 10MB limit")
                await f.write(chunk)

        return stored_name, size

    def get_full_path(self, stored_path: str) -> str:
        return self._safe_path(stored_path)

    async def delete(self, stored_path: str) -> None:
        try:
            full_path = self._safe_path(stored_path)
        except ValueError:
            logging.getLogger(__name__).warning("Rejected path traversal attempt: %s", stored_path)
            return
        try:
            await asyncio.to_thread(os.remove, full_path)
        except OSError:
            logging.getLogger(__name__).warning("Failed to delete file: %s", full_path)
