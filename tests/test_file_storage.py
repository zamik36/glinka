import os
import tempfile
import pytest

from fastapi import HTTPException
from app.infrastructure.file_storage import FileStorageService

class TestFileTypeValidation:
    def setup_method(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.service = FileStorageService()
        self.service.storage_dir = os.path.normpath(self.tmp_dir)

    def test_reject_exe_extension(self):
        with pytest.raises(HTTPException) as exc_info:
            self.service._validate_file_type("malware.exe", "application/octet-stream")
        assert exc_info.value.status_code == 400
        assert "not allowed" in exc_info.value.detail

    def test_reject_sh_extension(self):
        with pytest.raises(HTTPException) as exc_info:
            self.service._validate_file_type("script.sh", "text/x-shellscript")
        assert exc_info.value.status_code == 400

    def test_reject_html_extension(self):
        with pytest.raises(HTTPException) as exc_info:
            self.service._validate_file_type("page.html", "text/html")
        assert exc_info.value.status_code == 400

    def test_accept_jpg(self):
        self.service._validate_file_type("photo.jpg", "image/jpeg")

    def test_accept_pdf(self):
        self.service._validate_file_type("doc.pdf", "application/pdf")

    def test_reject_bad_mime_with_valid_ext(self):
        with pytest.raises(HTTPException) as exc_info:
            self.service._validate_file_type("photo.jpg", "text/html")
        assert exc_info.value.status_code == 400

    def test_accept_none_mime(self):
        self.service._validate_file_type("photo.png", None)


class TestPathTraversal:
    def setup_method(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.service = FileStorageService()
        self.service.storage_dir = os.path.normpath(self.tmp_dir)

    def test_reject_parent_traversal(self):
        with pytest.raises(ValueError, match="Invalid file path"):
            self.service._safe_path("../../etc/passwd")

    def test_reject_absolute_path(self):
        with pytest.raises(ValueError, match="Invalid file path"):
            self.service._safe_path("/etc/passwd")

    def test_accept_normal_filename(self):
        result = self.service._safe_path("abc123.jpg")
        assert result.startswith(self.tmp_dir)
        assert result.endswith("abc123.jpg")

    def test_reject_dot_dot_in_middle(self):
        with pytest.raises(ValueError, match="Invalid file path"):
            self.service._safe_path("subdir/../../../etc/shadow")


@pytest.mark.asyncio
class TestPaginationParams:
    async def test_default_pagination(self, client):
        resp = await client.get("/api/tasks")
        assert resp.status_code == 200

    async def test_custom_pagination(self, client):
        resp = await client.get("/api/tasks?limit=10&offset=0")
        assert resp.status_code == 200

    async def test_invalid_limit_too_high(self, client):
        resp = await client.get("/api/tasks?limit=500")
        assert resp.status_code == 400

    async def test_invalid_limit_zero(self, client):
        resp = await client.get("/api/tasks?limit=0")
        assert resp.status_code == 400

    async def test_negative_offset(self, client):
        resp = await client.get("/api/tasks?offset=-1")
        assert resp.status_code == 400
