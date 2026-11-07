CREATE TABLE IF NOT EXISTS grupos_vehiculos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  num_economico TEXT NOT NULL UNIQUE,
  vin TEXT,
  grupo_id INTEGER NOT NULL REFERENCES grupos_vehiculos(id)
);

CREATE TABLE IF NOT EXISTS conductores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

-- nombre_original = como viene en el Excel; evento = nombre ya unificado.
-- clasificado = 0 cuando el nombre no coincide con ninguna regla (hay que revisarlo).
CREATE TABLE IF NOT EXISTS tipos_evento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_original TEXT NOT NULL UNIQUE,
  evento TEXT NOT NULL,
  clasificado INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cargas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  archivo TEXT NOT NULL,
  fecha_carga TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  filas_leidas INTEGER,
  filas_nuevas INTEGER,
  filas_duplicadas INTEGER,
  filas_descartadas INTEGER
);

CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehiculo_id INTEGER NOT NULL REFERENCES vehiculos('id'),
  conductor_id INTEGER REFERENCES conductores('id'),
  tipo_evento_id INTEGER NOT NULL REFERENCES tipos_evento(id),
  carga_id INTEGER REFERENCES cargas(id),
  hora_inicio TEXT NOT NULL,          -- 'AAAA-MM-DD HH:MM:SS'
  hora_final TEXT,
  direccion TEXT,
  kilometraje REAL,
  velocidad REAL,
  velocidad_max REAL,
  duracion_seg INTEGER,
  estatus TEXT,                       -- Descartada: la marca el boton del panel o la columna Estatus del Excel
  categoria TEXT,                     -- Categoria del Evento
  protocolo TEXT,                     -- '1' si la casilla Protocolo del panel esta palomeada (si/no)
  protocolo_arch TEXT,                -- nombre del archivo subido a la carpeta Protocolo (NULL si no trae)
  grupo_id INTEGER REFERENCES grupos_vehiculos(id),   -- TAD del evento (Grupo de conductores del Excel); un vehiculo puede cambiar de TAD
  UNIQUE (vehiculo_id, hora_inicio, tipo_evento_id)   -- evita duplicados al recargar un Excel
);

CREATE INDEX IF NOT EXISTS idx_eventos_hora ON eventos(hora_inicio);
