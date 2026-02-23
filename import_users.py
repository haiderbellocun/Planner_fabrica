"""
Script para importar usuarios masivamente a la Fábrica de Contenido
Usa la cédula como contraseña inicial para cada usuario

ESTRUCTURA DE TABLAS:
=====================

1. public.users (Autenticación)
   - id: UUID PRIMARY KEY
   - email: TEXT UNIQUE NOT NULL
   - password_hash: TEXT NOT NULL (bcrypt hash)
   - full_name: TEXT
   - avatar_url: TEXT
   - is_active: BOOLEAN DEFAULT true
   - created_at: TIMESTAMP
   - updated_at: TIMESTAMP
   - last_sign_in_at: TIMESTAMP

2. public.profiles (Perfil de Usuario)
   - id: UUID PRIMARY KEY
   - user_id: UUID FOREIGN KEY -> users.id
   - full_name: TEXT
   - email: TEXT
   - avatar_url: TEXT
   - created_at: TIMESTAMP
   - updated_at: TIMESTAMP

3. public.user_roles (Roles)
   - id: UUID PRIMARY KEY
   - user_id: UUID FOREIGN KEY -> profiles.id (¡IMPORTANTE!)
   - role: user_role_enum ('admin', 'project_leader', 'user')

ORDEN DE INSERCIÓN: users -> profiles -> user_roles
"""

import os
import psycopg2
import bcrypt
import pandas as pd
from datetime import datetime

# =========================
# CONFIG BD
# =========================
DB_HOST = os.getenv("PGHOST", "localhost")
DB_PORT = int(os.getenv("PGPORT", "5432"))
DB_NAME = os.getenv("PGDATABASE", "pruebas_haider")
DB_USER = os.getenv("PGUSER", "postgres")
DB_PASSWORD = os.getenv("PGPASSWORD", "postgres")

# =========================
# CONFIGURACIÓN
# =========================
ARCHIVO_USUARIOS = "usuarios.xlsx"  # Cambiar a .csv si es CSV
ROL_POR_DEFECTO = "user"  # Todos serán usuarios normales

# Mapeo de columnas de tu archivo Excel/CSV
COLUMNA_NOMBRE = "Nombre"
COLUMNA_EMAIL = "Correo Electrónico"
COLUMNA_PROFESION = "Profesión"
COLUMNA_CEDULA = "Cédula"
COLUMNA_CARGO = "Cargo"


def generar_password_hash(password: str) -> str:
    """Genera hash bcrypt de la contraseña"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def limpiar_email(email: str) -> str:
    """Limpia y normaliza el email"""
    return email.strip().lower()


def importar_usuarios():
    """Función principal de importación"""

    # Conectar a la base de datos
    print(f"📦 Conectando a la base de datos {DB_NAME}...\n")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    cursor = conn.cursor()

    # Leer archivo (detecta automáticamente Excel o CSV)
    print(f"📄 Leyendo archivo {ARCHIVO_USUARIOS}...\n")
    if ARCHIVO_USUARIOS.endswith('.csv'):
        df = pd.read_csv(ARCHIVO_USUARIOS)
    else:
        df = pd.read_excel(ARCHIVO_USUARIOS)

    total_usuarios = len(df)
    usuarios_creados = 0
    usuarios_fallidos = 0

    print(f"📊 Se encontraron {total_usuarios} usuarios para importar\n")
    print("=" * 80)

    # Procesar cada usuario
    for index, row in df.iterrows():
        try:
            # Extraer datos del Excel/CSV
            email = limpiar_email(row[COLUMNA_EMAIL])
            full_name = str(row[COLUMNA_NOMBRE]).strip()
            profesion = str(row.get(COLUMNA_PROFESION, '')).strip()
            cedula = str(row[COLUMNA_CEDULA]).strip()
            cargo = str(row.get(COLUMNA_CARGO, '')).strip()

            # Validar datos obligatorios
            if not email or not full_name or not cedula:
                print(f"❌ Fila {index + 2}: Datos incompletos (email, nombre o cédula vacíos)")
                usuarios_fallidos += 1
                continue

            # Usar cédula como contraseña
            password_hash = generar_password_hash(cedula)

            print(f"\n[{index + 1}/{total_usuarios}] Procesando: {full_name} ({email})")

            # PASO 1: Insertar en tabla users
            cursor.execute(
                """INSERT INTO public.users (email, password_hash, full_name, is_active)
                   VALUES (%s, %s, %s, true)
                   RETURNING id""",
                (email, password_hash, full_name)
            )
            user_id = cursor.fetchone()[0]
            print(f"  ✓ User creado (ID: {user_id})")

            # PASO 2: Insertar en tabla profiles
            cursor.execute(
                """INSERT INTO public.profiles (user_id, full_name, email)
                   VALUES (%s, %s, %s)
                   RETURNING id""",
                (user_id, full_name, email)
            )
            profile_id = cursor.fetchone()[0]
            print(f"  ✓ Profile creado (ID: {profile_id})")

            # PASO 3: Asignar rol en user_roles
            cursor.execute(
                """INSERT INTO public.user_roles (user_id, role)
                   VALUES (%s, %s)""",
                (profile_id, ROL_POR_DEFECTO)
            )
            print(f"  ✓ Rol asignado: {ROL_POR_DEFECTO}")

            # Confirmar transacción
            conn.commit()
            usuarios_creados += 1
            print(f"  ✅ Usuario creado exitosamente")

        except psycopg2.errors.UniqueViolation as e:
            conn.rollback()
            print(f"  ⚠️  Error de duplicado: {str(e)}")
            print(f"     Email: {email}")
            usuarios_fallidos += 1

        except Exception as e:
            conn.rollback()
            print(f"  ❌ Error ({type(e).__name__}): {str(e)}")
            usuarios_fallidos += 1

    # Cerrar conexión
    cursor.close()
    conn.close()

    # Resumen
    print("\n" + "=" * 80)
    print("\n📊 RESUMEN DE IMPORTACIÓN:")
    print(f"   Total procesados: {total_usuarios}")
    print(f"   ✅ Creados exitosamente: {usuarios_creados}")
    print(f"   ❌ Fallidos/Omitidos: {usuarios_fallidos}")
    print("\n🎉 Importación completada!")
    print("\n⚠️  IMPORTANTE: Todos los usuarios tienen su CÉDULA como contraseña inicial")
    print("   Recomienda a los usuarios cambiar su contraseña al primer login.\n")


if __name__ == "__main__":
    try:
        importar_usuarios()
    except FileNotFoundError:
        print(f"❌ Error: No se encontró el archivo '{ARCHIVO_USUARIOS}'")
        print(f"   Asegúrate de que el archivo esté en la misma carpeta que este script.")
    except psycopg2.OperationalError as e:
        print(f"❌ Error de conexión a la base de datos:")
        print(f"   {str(e)}")
        print(f"\n   Verifica las credenciales:")
        print(f"   - Host: {DB_HOST}")
        print(f"   - Port: {DB_PORT}")
        print(f"   - Database: {DB_NAME}")
        print(f"   - User: {DB_USER}")
    except Exception as e:
        print(f"❌ Error inesperado: {str(e)}")
