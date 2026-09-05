from app.schemas.account import ORMModel


class InstitutionGroup(ORMModel):
    category: str
    label: str
    institutions: list[str]
