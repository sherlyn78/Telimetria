"""Conexion a SQLite. Crea la base y las tablas si no existen."""
import sqlite3

import config


def conectar():
    config.RUTA_BD.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(config.RUTA_BD)
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(config.SCHEMA.read_text(encoding="utf-8"))
    columnas = {f[1] for f in con.execute("PRAGMA table_info(eventos)")}
    # protocolo: '1' cuando la casilla del panel esta palomeada (si no, NULL).
    # protocolo_arch: nombre del archivo subido a la carpeta de Protocolo (NULL si no trae).
    for nueva in ("estatus", "categoria", "motivo", "protocolo", "protocolo_arch"):
        if nueva not in columnas:
            con.execute(f"ALTER TABLE eventos ADD COLUMN {nueva} TEXT")
    if "grupo_id" not in columnas:    # TAD por evento
        con.execute("ALTER TABLE eventos ADD COLUMN grupo_id INTEGER REFERENCES grupos_vehiculos(id)")
        con.execute("""UPDATE eventos SET grupo_id = (SELECT grupo_id FROM vehiculos v WHERE v.id = eventos.vehiculo_id)WHERE grupo_id IS NULL""")
    con.execute("CREATE INDEX IF NOT EXISTS idx_eventos_grupo ON eventos(grupo_id)")
    con.commit()
    return con