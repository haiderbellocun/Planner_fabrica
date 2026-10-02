# One-off extractor for the 2026 factory report. Not part of the app runtime.
import json
import unicodedata
from datetime import datetime, date
from pathlib import Path

import openpyxl

SRC = Path(r"c:\Users\sebas\Downloads\INFORME DE PROYECTOS FÁBRICA DE CONTENIDO - 2026 (3).xlsx")
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "informeFabrica2026.json"


def fold(value) -> str:
    text = unicodedata.normalize("NFD", str(value))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return " ".join(text.upper().split())


def clean(value) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\n", " ").split())


def pretty(name: str) -> str:
    name = clean(name)
    if name and name == name.lower():
        return name[0].upper() + name[1:]
    return name


def presencia(raw) -> str | None:
    if raw is None or not str(raw).strip():
        return None
    token = fold(raw)
    if token in ("N/A", "NA", "-"):
        return "na"
    if "SIN INICIAR" in token or "PAUSA" in token:
        return "fuera"
    if "ALGUNOS" in token or "SE GRAB" in token:
        return "proceso"
    if "CORRECCION" in token or "EN PROCESO" in token:
        return "proceso"
    if any(k in token for k in ("TERMINADO", "COMPLETADO", "COMPLETO", "TERMINADOS")):
        return "dentro"
    if any(k in token for k in ("PLANTILLA", "RODAJE", "GUION")):
        return "puerta"
    return "proceso"


def cobertura(frentes: dict) -> str:
    vals = [v["presencia"] for v in frentes.values() if v["presencia"] != "na"]
    if not vals:
        return "fuera"
    if all(v == "dentro" for v in vals):
        return "completo"
    if any(v in ("dentro", "proceso") for v in vals):
        if all(v in ("dentro", "proceso") for v in vals):
            return "proceso" if any(v == "proceso" for v in vals) else "completo"
        return "parcial"
    if any(v == "puerta" for v in vals):
        return "puerta"
    return "fuera"


def nota_util(raw) -> str:
    note = clean(raw)
    if not note:
        return ""
    token = fold(note)
    if token in ("TERMINADO", "SIN INICIAR", "N/A", "NA"):
        return ""
    return note


def load_programas(wb):
    specs = [
        ("Tania ", "Tania", {"gif": 1, "analistas": 2, "presentadoras": 3}, 4, None),
        ("Producto ", "Producto", {"gif": 1, "analistas": 2}, 3, None),
        ("Registro Calificado", "Registro calificado", {"gif": 1, "analistas": 2}, 3, None),
        ("Diplomados Internos", "Diplomados internos", {"gif": 2, "analistas": 3, "presentadoras": 4}, 5, 1),
        ("Correciones", "Correcciones", {"gif": 1, "analistas": 2}, None, None),
        ("Diplomado de Salud", "Diplomado de salud", {"gif": 1, "analistas": 2, "presentadoras": 3}, None, None),
    ]
    programas = []
    for sheet, linea, frente_cols, nota_idx, area_idx in specs:
        ws = wb[sheet]
        for i, row in enumerate(ws.iter_rows(values_only=True), 1):
            if i == 1 or not row or not row[0]:
                continue
            nombre = pretty(row[0])
            if fold(nombre) == "PROGRAMA":
                continue
            frentes = {}
            for key, idx in frente_cols.items():
                if idx >= len(row):
                    continue
                raw = clean(row[idx])
                if not raw:
                    continue
                frentes[key] = {"raw": raw, "presencia": presencia(raw)}
            if not frentes:
                continue
            nota = nota_util(row[nota_idx]) if nota_idx is not None and nota_idx < len(row) else ""
            area = ""
            if area_idx is not None and area_idx < len(row) and row[area_idx]:
                area = clean(row[area_idx])
            programas.append(
                {
                    "id": f"{linea}-{i}",
                    "linea": linea,
                    "nombre": nombre,
                    "area": area,
                    "nota": nota,
                    "frentes": frentes,
                    "cobertura": cobertura(frentes),
                }
            )
    return programas


def load_dental(wb):
    ws = wb["Open Dental "]
    etapas = [
        ("Guiones maestro", 3),
        ("Guiones videos", 4),
        ("Audiovisual", 5),
        ("Instructivos", 6),
        ("Grabación", 7),
        ("Edición", 8),
        ("PDF", 9),
    ]
    modulos = []
    for i, row in enumerate(ws.iter_rows(min_row=50, max_row=59, values_only=True), 50):
        code = clean(row[1])
        nombre = clean(row[2])
        celdas = []
        for label, idx in etapas:
            raw = clean(row[idx]) or "Sin iniciar"
            celdas.append({"etapa": label, "raw": raw, "presencia": presencia(raw)})
        modulos.append({"id": code or f"M{i}", "nombre": nombre, "etapas": celdas})
    cursos = []
    for row in ws.iter_rows(min_row=63, max_row=70, values_only=True):
        nombre = clean(row[1])
        if not nombre:
            continue
        raw = clean(row[3]) or "Sin iniciar"
        cursos.append(
            {
                "nombre": nombre,
                "equipo": clean(row[2]),
                "raw": raw,
                "presencia": presencia(raw),
            }
        )
    return {"modulos": modulos, "cursosHtml": cursos}


def load_escuela(wb):
    ws = wb["Escuela Influencers"]
    fases = []
    for row in ws.iter_rows(min_row=3, max_row=10, values_only=True):
        nombre = clean(row[1])
        raw = clean(row[2])
        if not nombre:
            continue
        fases.append(
            {
                "nombre": nombre,
                "raw": raw,
                "entregables": clean(row[3]),
                "presencia": presencia(raw),
            }
        )
    etapas = []
    for row in ws.iter_rows(min_row=15, max_row=18, values_only=True):
        nombre = clean(row[1])
        if not nombre:
            continue
        avance = row[2]
        etapas.append({"nombre": nombre, "avance": float(avance or 0)})
    return {"fases": fases, "etapas": etapas}


def load_tendencias(wb):
    ws = wb["Tendencias"]
    indicadores = []
    for row in ws.iter_rows(min_row=3, max_row=5, values_only=True):
        indicadores.append(
            {
                "nombre": clean(row[1]),
                "meta": clean(row[2]),
                "avance": clean(row[3]),
                "estado": clean(row[4]),
            }
        )
    semana = []
    for row in ws.iter_rows(min_row=10, max_row=13, values_only=True):
        semana.append(
            {
                "dia": clean(row[1]),
                "actividad": clean(row[2]),
                "entregable": clean(row[3]),
                "estado": clean(row[4]),
            }
        )
    return {
        "pausado": True,
        "indicadores": indicadores,
        "semana": semana,
        "inicio": "2026-08-05",
        "fechasProgramadas": 14,
        "noEntregados": 2,
        "entregados": 12,
        "nota": "Dos fechas (1 martes y 1 jueves) quedaron sin video. El proyecto está pausado.",
    }


def load_bienestar(wb):
    ws = wb["Bienestar "]
    materiales = [
        {"tipo": "Videos", "total": 17, "listos": 5, "pendientes": 12},
        {"tipo": "Infografías", "total": 28, "listos": 28, "pendientes": 0},
        {"tipo": "Pódcast", "total": 2, "listos": 2, "pendientes": 0},
    ]
    apps = []
    for row in ws.iter_rows(min_row=13, max_row=19, values_only=True):
        nombre = clean(row[1])
        if not nombre:
            continue
        apps.append(
            {
                "nombre": nombre,
                "videos": int(row[2] or 0),
                "infografias": int(row[3] or 0),
                "podcast": int(row[4] or 0),
                "estadoVideos": clean(row[5]),
            }
        )
    return {
        "materiales": materiales,
        "apps": apps,
        "proyectoTerminado": True,
        "nota": "La hoja marca el proyecto y cada aplicativo como terminados. El conteo deja 12 videos sin registrar como listos (5 de 17).",
    }


def iso(value) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return clean(value)[:10]


def load_remaster(wb):
    ws = wb["Remasterizacion "]
    programas = []
    hitos = []
    for i, row in enumerate(ws.iter_rows(min_row=2, max_row=13, values_only=True), 2):
        nombre = clean(row[1])
        if nombre and fold(nombre) != "PROYECTO TERMINADO":
            programas.append(
                {
                    "nombre": nombre,
                    "tipo": clean(row[2]),
                    "raw": clean(row[3]),
                    "presencia": presencia(row[3]),
                }
            )
        if row[7]:
            hitos.append(
                {
                    "fecha": iso(row[7]),
                    "actividad": clean(row[8]),
                    "alcance": clean(row[9]),
                }
            )
    return {
        "programas": programas,
        "hitos": hitos,
        "proyectoTerminado": True,
        "resumen": {
            "total": 11,
            "editados": 11,
            "grabadosPorEditar": 11,
            "pendientesGrabacion": 0,
        },
    }


def main():
    wb = openpyxl.load_workbook(SRC, data_only=True)
    payload = {
        "fuente": "INFORME DE PROYECTOS FÁBRICA DE CONTENIDO - 2026",
        "programas": load_programas(wb),
        "openDental": load_dental(wb),
        "escuela": load_escuela(wb),
        "tendencias": load_tendencias(wb),
        "bienestar": load_bienestar(wb),
        "remasterizacion": load_remaster(wb),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT} programas={len(payload['programas'])}")


if __name__ == "__main__":
    main()
