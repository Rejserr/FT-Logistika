"""Pydantic sheme za config module."""
from pydantic import BaseModel, ConfigDict, Field


class PrioritetBase(BaseModel):
    """Base shema za prioritet."""
    naziv: str = Field(..., min_length=1, max_length=100)
    tezina: int = Field(default=0)
    aktivan: bool = Field(default=True)


class PrioritetCreate(PrioritetBase):
    """Shema za kreiranje prioriteta."""
    pass


class PrioritetUpdate(BaseModel):
    """Shema za ažuriranje prioriteta."""
    naziv: str | None = None
    tezina: int | None = None
    aktivan: bool | None = None


class PrioritetOut(PrioritetBase):
    """Output shema za prioritet."""
    id: int

    model_config = ConfigDict(from_attributes=True)


class SettingBase(BaseModel):
    """Base shema za setting."""
    key: str = Field(..., min_length=1, max_length=100)
    value: str | None = None


class SettingCreate(SettingBase):
    """Shema za kreiranje settinga."""
    pass


class SettingUpdate(BaseModel):
    """Shema za ažuriranje settinga."""
    value: str | None = None


class SettingOut(SettingBase):
    """Output shema za setting."""
    model_config = ConfigDict(from_attributes=True)


class SettingsBulkUpdate(BaseModel):
    """Shema za bulk update settingsa."""
    settings: dict[str, str | None] = Field(..., min_length=1)


# ==============================================================================
# Status sheme
# ==============================================================================


class StatusBase(BaseModel):
    """Base shema za status."""
    id: str = Field(..., min_length=1, max_length=10)
    naziv: str = Field(..., min_length=1, max_length=100)
    opis: str | None = None
    redoslijed: int = Field(default=0)
    aktivan: bool = Field(default=True)


class StatusCreate(StatusBase):
    """Shema za kreiranje statusa."""
    pass


class StatusUpdate(BaseModel):
    """Shema za ažuriranje statusa."""
    naziv: str | None = None
    opis: str | None = None
    redoslijed: int | None = None
    aktivan: bool | None = None


class StatusOut(StatusBase):
    """Output shema za status."""
    model_config = ConfigDict(from_attributes=True)
