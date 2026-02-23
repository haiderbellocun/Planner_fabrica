"""
Script CORRECTO para importar usuarios
Considera que hay un TRIGGER que crea profiles automáticamente
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

ARCHIVO_USUARIOS = r"C:\Users\haider_bello\Downloads\HACER UN LISTADO (3).xlsx"
ROL_POR_DEFECTO = "user"

COLUMNA_NOMBRE = "Nombre"
COLUMNA_EMAIL = "Correo Electrónico"
COLUMNA_CEDULA = "Cédula"


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

    # Eliminar duplicados
    df['email_limpio'] = df[COLUMNA_EMAIL].apply(limpiar_email)
    df_limpio = df.drop_duplicates(subset=['email_limpio'], keep='first')

    print("=" * 80)
    print(f"IMPORTANDO {len(df_limpio)} USUARIOS\n")

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

            # Verificar si ya existe
            cursor.execute("SELECT id FROM public.users WHERE email = %s", (email,))
            if cursor.fetchone():
                print(f"[X] {email} - Ya existe")
                usuarios_omitidos += 1
                continue

            password_hash = generar_password_hash(cedula)

            print(f"[{usuarios_creados + 1}] {full_name} ({email})")

            # PASO 1: Insertar en users
            # (El trigger handle_new_user() creará automáticamente el profile)
            cursor.execute(
                """INSERT INTO public.users (email, password_hash, full_name, is_active)
                   VALUES (%s, %s, %s, true) RETURNING id""",
                (email, password_hash, full_name)
            )
            user_id = cursor.fetchone()[0]
            print(f"    [OK] User creado (ID: {user_id})")

            # PASO 2: Obtener el profile_id creado por el trigger
            cursor.execute(
                """SELECT id FROM public.profiles WHERE user_id = %s""",
                (user_id,)
            )
            profile_result = cursor.fetchone()

            if not profile_result:
                raise Exception("El trigger no creó el profile automáticamente")

            profile_id = profile_result[0]
            print(f"    [OK] Profile obtenido (ID: {profile_id})")

            # PASO 3: Asignar rol en user_roles
            cursor.execute(
                """INSERT INTO public.user_roles (user_id, role)
                   VALUES (%s, %s)""",
                (profile_id, ROL_POR_DEFECTO)
            )
            print(f"    [OK] Rol asignado: {ROL_POR_DEFECTO}")

            conn.commit()
            usuarios_creados += 1
            print(f"    [EXITO]\n")

        except Exception as e:
            conn.rollback()
            print(f"    [ERROR] {type(e).__name__}: {str(e)}\n")
            usuarios_omitidos += 1

    cursor.close()
    conn.close()

    # RESUMEN
    print("=" * 80)
    print("\nRESUMEN DE IMPORTACION:\n")
    print(f"  Total en archivo:   {len(df)}")
    print(f"  Usuarios unicos:    {len(df_limpio)}")
    print(f"  [OK] Creados:       {usuarios_creados}")
    print(f"  [X]  Omitidos:      {usuarios_omitidos}")
    print("\nImportacion completada!")
    print("\n[!] IMPORTANTE: Todos los usuarios tienen su CEDULA como contraseña inicial\n")


if __name__ == "__main__":
    try:
        importar_usuarios()
    except FileNotFoundError:
        print(f"ERROR: No se encontró el archivo '{ARCHIVO_USUARIOS}'")
    except Exception as e:
        print(f"ERROR: {str(e)}")
