"""
Script mejorado para importar usuarios
Detecta y elimina duplicados automáticamente
"""

import os
import psycopg2
import bcrypt
import pandas as pd

# CONFIG BD
DB_HOST = os.getenv("PGHOST", "localhost")
DB_PORT = int(os.getenv("PGPORT", "5432"))
DB_NAME = os.getenv("PGDATABASE", "pruebas_haider")
DB_USER = os.getenv("PGUSER", "postgres")
DB_PASSWORD = os.getenv("PGPASSWORD", "postgres")

ARCHIVO_USUARIOS = "usuarios.xlsx"
ROL_POR_DEFECTO = "user"

COLUMNA_NOMBRE = "Nombre"
COLUMNA_EMAIL = "Correo Electrónico"
COLUMNA_PROFESION = "Profesión"
COLUMNA_CEDULA = "Cédula"
COLUMNA_CARGO = "Cargo"


def generar_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def limpiar_email(email: str) -> str:
    return email.strip().lower()


def importar_usuarios():
    print(f"Conectando a la base de datos {DB_NAME}...\n")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    cursor = conn.cursor()

    print(f"Leyendo archivo {ARCHIVO_USUARIOS}...\n")
    if ARCHIVO_USUARIOS.endswith('.csv'):
        df = pd.read_csv(ARCHIVO_USUARIOS)
    else:
        df = pd.read_excel(ARCHIVO_USUARIOS)

    # DETECTAR DUPLICADOS EN EL ARCHIVO
    print("=" * 80)
    print("PASO 1: DETECTANDO DUPLICADOS EN EL ARCHIVO\n")

    df['email_limpio'] = df[COLUMNA_EMAIL].apply(limpiar_email)
    duplicados_en_archivo = df[df.duplicated(subset=['email_limpio'], keep='first')]

    if len(duplicados_en_archivo) > 0:
        print(f"[!] Se encontraron {len(duplicados_en_archivo)} emails duplicados en el archivo:\n")
        for idx, row in duplicados_en_archivo.iterrows():
            print(f"  - Fila {idx + 2}: {row[COLUMNA_NOMBRE]} ({row[COLUMNA_EMAIL]})")
        print("\n>>> Estos duplicados serán OMITIDOS automáticamente.\n")
    else:
        print("[OK] No se encontraron duplicados en el archivo.\n")

    # ELIMINAR DUPLICADOS (mantener solo el primero)
    df_limpio = df.drop_duplicates(subset=['email_limpio'], keep='first')
    total_unicos = len(df_limpio)

    print(f"Total usuarios en archivo: {len(df)}")
    print(f"Usuarios únicos a importar: {total_unicos}\n")

    # VERIFICAR EMAILS YA EXISTENTES EN BD
    print("=" * 80)
    print("PASO 2: VERIFICANDO EMAILS EXISTENTES EN BD\n")

    emails_existentes = set()
    for _, row in df_limpio.iterrows():
        email = limpiar_email(row[COLUMNA_EMAIL])
        cursor.execute("SELECT email FROM public.users WHERE email = %s", (email,))
        if cursor.fetchone():
            emails_existentes.add(email)

    if emails_existentes:
        print(f"[!] {len(emails_existentes)} emails ya existen en la BD y serán omitidos:\n")
        for email in sorted(emails_existentes):
            print(f"  - {email}")
        print()
    else:
        print("[OK] Ningún email existe en la BD.\n")

    # IMPORTAR USUARIOS
    print("=" * 80)
    print("PASO 3: IMPORTANDO USUARIOS\n")

    usuarios_creados = 0
    usuarios_omitidos = 0

    for index, row in df_limpio.iterrows():
        try:
            email = limpiar_email(row[COLUMNA_EMAIL])
            full_name = str(row[COLUMNA_NOMBRE]).strip()
            cedula = str(row[COLUMNA_CEDULA]).strip()

            if not email or not full_name or not cedula:
                print(f"[X] Fila {index + 2}: Datos incompletos - OMITIDO")
                usuarios_omitidos += 1
                continue

            # Saltar si ya existe en BD
            if email in emails_existentes:
                usuarios_omitidos += 1
                continue

            password_hash = generar_password_hash(cedula)

            print(f"[{usuarios_creados + 1}] {full_name} ({email})")

            # PASO 1: users
            cursor.execute(
                """INSERT INTO public.users (email, password_hash, full_name, is_active)
                   VALUES (%s, %s, %s, true) RETURNING id""",
                (email, password_hash, full_name)
            )
            user_id = cursor.fetchone()[0]

            # PASO 2: profiles
            cursor.execute(
                """INSERT INTO public.profiles (user_id, full_name, email)
                   VALUES (%s, %s, %s) RETURNING id""",
                (user_id, full_name, email)
            )
            profile_id = cursor.fetchone()[0]

            # PASO 3: user_roles
            cursor.execute(
                """INSERT INTO public.user_roles (user_id, role)
                   VALUES (%s, %s)""",
                (profile_id, ROL_POR_DEFECTO)
            )

            conn.commit()
            usuarios_creados += 1

        except Exception as e:
            conn.rollback()
            print(f"    [ERROR] {type(e).__name__}: {str(e)}")
            usuarios_omitidos += 1

    cursor.close()
    conn.close()

    # RESUMEN FINAL
    print("\n" + "=" * 80)
    print("\nRESUMEN DE IMPORTACION:\n")
    print(f"  Total en archivo:        {len(df)}")
    print(f"  Duplicados en archivo:   {len(duplicados_en_archivo)}")
    print(f"  Ya existían en BD:       {len(emails_existentes)}")
    print(f"  [OK] Creados:            {usuarios_creados}")
    print(f"  [X]  Omitidos:           {usuarios_omitidos}")
    print("\nImportacion completada!")
    print("\n[!] IMPORTANTE: Todos los usuarios tienen su CEDULA como contraseña inicial\n")


if __name__ == "__main__":
    try:
        importar_usuarios()
    except FileNotFoundError:
        print(f"ERROR: No se encontró el archivo '{ARCHIVO_USUARIOS}'")
    except Exception as e:
        print(f"ERROR: {str(e)}")
