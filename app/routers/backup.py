import os
import shutil
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import DB_FILE, engine, get_db
from app.schemas.system import RestoreResponse

router = APIRouter(prefix="/backup", tags=["backup"])

DB_PATH = DB_FILE


@router.get("")
def download_backup():
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=404, detail="백업할 DB 파일이 없습니다.")
    filename = f"asset_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    return FileResponse(
        path=DB_PATH,
        filename=filename,
        media_type="application/octet-stream",
    )


@router.post("/restore", response_model=RestoreResponse)
async def restore_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="SQLite .db 파일만 업로드할 수 있습니다.")

    db.close()
    engine.dispose()

    backup_path = f"{DB_PATH}.bak"
    if os.path.exists(DB_PATH):
        shutil.copy2(DB_PATH, backup_path)

    contents = await file.read()
    with open(DB_PATH, "wb") as out:
        out.write(contents)

    return RestoreResponse(message="복구 완료", restored_at=datetime.utcnow())
