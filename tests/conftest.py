import os
import tempfile

import pytest
from fastapi.testclient import TestClient

# 테스트용 격리 DB (앱 import 전에 설정)
_test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
os.environ["ASSET_DB_PATH"] = _test_db.name

from app.main import app  # noqa: E402
from app.services.core import initialize_all
from app.database import SessionLocal


@pytest.fixture(scope="session")
def client():
    db = SessionLocal()
    initialize_all(db)
    db.close()
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _reset_between_tests():
    yield
