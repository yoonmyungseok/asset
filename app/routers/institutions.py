from fastapi import APIRouter

from app.data.institutions import INSTITUTION_GROUPS
from app.schemas.institution import InstitutionGroup

router = APIRouter(prefix="/institutions", tags=["institutions"])


@router.get("", response_model=list[InstitutionGroup])
def list_institutions():
    return INSTITUTION_GROUPS
