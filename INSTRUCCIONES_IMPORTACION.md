# 📦 Instrucciones de Importación de Usuarios

## 🎯 Objetivo
Importar usuarios masivamente a la Fábrica de Contenido usando un archivo Excel o CSV.

---

## 📋 Requisitos Previos

### 1. Instalar dependencias de Python:
```bash
pip install psycopg2-binary bcrypt pandas openpyxl
```

### 2. Preparar archivo de datos

Tu archivo debe tener estas columnas **EXACTAS** (respeta mayúsculas/tildes):
- `Nombre` - Nombre completo del usuario
- `Correo Electrónico` - Email institucional (@cun.edu.co)
- `Profesión` - Profesión del usuario (opcional)
- `Cédula` - Número de cédula (será la contraseña inicial)
- `Cargo` - Cargo en la organización (opcional)

**Formatos soportados:**
- Excel: `usuarios.xlsx`
- CSV: `usuarios.csv`

Ver `usuarios_ejemplo.csv` para referencia.

---

## 🚀 Uso del Script

### Paso 1: Coloca tu archivo
Guarda tu archivo Excel/CSV como `usuarios.xlsx` o `usuarios.csv` en la carpeta `c:\app_planner\`

### Paso 2: Ejecuta el script
```bash
cd c:\app_planner
python import_users.py
```

### Paso 3: Revisa el resultado
El script mostrará el progreso en tiempo real:
- ✅ Usuarios creados exitosamente
- ⚠️ Usuarios omitidos (emails duplicados)
- ❌ Errores encontrados

---

## 📊 Esquema de Base de Datos

El script crea usuarios en 3 tablas:

### 1. `public.users` (Autenticación)
```sql
id              UUID PRIMARY KEY
email           TEXT UNIQUE
password_hash   TEXT (bcrypt de la cédula)
full_name       TEXT
is_active       BOOLEAN
```

### 2. `public.profiles` (Perfil)
```sql
id          UUID PRIMARY KEY
user_id     UUID → users.id
full_name   TEXT
email       TEXT
```

### 3. `public.user_roles` (Roles)
```sql
id          UUID PRIMARY KEY
user_id     UUID → profiles.id
role        ENUM ('user', 'project_leader', 'admin')
```

**Nota:** Todos los usuarios importados tienen rol `user` por defecto.

---

## 🔐 Contraseñas

⚠️ **IMPORTANTE:**
- Cada usuario tendrá su **cédula como contraseña inicial**
- Ejemplo: Si la cédula es `1234567890`, la contraseña será `1234567890`
- Recomienda a los usuarios cambiar su contraseña al primer inicio de sesión

---

## ⚠️ Solución de Problemas

### Error: "No se encontró el archivo"
- Verifica que el archivo esté en `c:\app_planner\`
- Verifica el nombre exacto: `usuarios.xlsx` o `usuarios.csv`

### Error: "Email ya existe"
- El email está duplicado en la base de datos
- El script omitirá ese usuario automáticamente

### Error: "Conexión a base de datos fallida"
- Verifica que PostgreSQL esté corriendo
- Verifica las credenciales en las variables de entorno

### Error: "Datos incompletos"
- Verifica que todas las filas tengan Nombre, Email y Cédula
- Elimina filas vacías del Excel/CSV

---

## 📝 Ejemplo de Ejecución Exitosa

```
📦 Conectando a la base de datos pruebas_haider...

📄 Leyendo archivo usuarios.xlsx...

📊 Se encontraron 25 usuarios para importar

================================================================================

[1/25] Procesando: Juan Pérez García (juan.perez@cun.edu.co)
  ✓ User creado (ID: 8a7b6c5d-...)
  ✓ Profile creado (ID: 9b8c7d6e-...)
  ✓ Rol asignado: user
  ✅ Usuario creado exitosamente

[2/25] Procesando: María López Ruiz (maria.lopez@cun.edu.co)
  ✓ User creado (ID: 7f6e5d4c-...)
  ✓ Profile creado (ID: 8g7f6e5d-...)
  ✓ Rol asignado: user
  ✅ Usuario creado exitosamente

...

================================================================================

📊 RESUMEN DE IMPORTACIÓN:
   Total procesados: 25
   ✅ Creados exitosamente: 23
   ❌ Fallidos/Omitidos: 2

🎉 Importación completada!

⚠️  IMPORTANTE: Todos los usuarios tienen su CÉDULA como contraseña inicial
   Recomienda a los usuarios cambiar su contraseña al primer login.
```

---

## 🔄 Si necesitas cambiar nombres de columnas

Edita el archivo `import_users.py` en la sección de configuración:

```python
# Mapeo de columnas de tu archivo Excel/CSV
COLUMNA_NOMBRE = "Nombre"           # Cambia si tu columna se llama diferente
COLUMNA_EMAIL = "Correo Electrónico"
COLUMNA_PROFESION = "Profesión"
COLUMNA_CEDULA = "Cédula"
COLUMNA_CARGO = "Cargo"
```

---

## 💡 Contacto
Si tienes problemas con la importación, verifica:
1. El formato del archivo coincide con el ejemplo
2. Las columnas tienen los nombres exactos
3. No hay filas vacías en el archivo
4. Los emails son válidos y únicos
