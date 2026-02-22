from pydantic import BaseModel, ConfigDict


class VoziloTipBase(BaseModel):
    naziv: str
    opis: str | None = None
    aktivan: bool = True


class VoziloTipCreate(VoziloTipBase):
    pass


class VoziloTipUpdate(BaseModel):
    naziv: str | None = None
    opis: str | None = None
    aktivan: bool | None = None


class VoziloTipOut(VoziloTipBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class VoziloBase(BaseModel):
    oznaka: str | None = None
    naziv: str | None = None
    tip_id: int | None = None
    warehouse_id: int | None = None
    nosivost_kg: float | None = None
    volumen_m3: float | None = None
    profil_rutiranja: str | None = None
    paleta: int | None = None
    aktivan: bool = True


class VoziloCreate(VoziloBase):
    pass


class VoziloUpdate(BaseModel):
    oznaka: str | None = None
    naziv: str | None = None
    tip_id: int | None = None
    warehouse_id: int | None = None
    nosivost_kg: float | None = None
    volumen_m3: float | None = None
    profil_rutiranja: str | None = None
    paleta: int | None = None
    aktivan: bool | None = None


class VoziloOut(VoziloBase):
    id: int
    registracija: str | None = None

    model_config = ConfigDict(from_attributes=True)


class VozacBase(BaseModel):
    ime: str
    prezime: str
    telefon: str | None = None
    email: str | None = None
    warehouse_id: int | None = None
    aktivan: bool = True


class VozacCreate(VozacBase):
    pass


class VozacUpdate(BaseModel):
    ime: str | None = None
    prezime: str | None = None
    telefon: str | None = None
    email: str | None = None
    warehouse_id: int | None = None
    aktivan: bool | None = None


class VozacOut(VozacBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
