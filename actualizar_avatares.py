"""
Script para actualizar los avatares de los usuarios en la base de datos
"""

import os
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="pruebas_haider",
    user="postgres",
    password="postgres"
)
cursor = conn.cursor()

# Obtener todos los archivos de avatares
avatares_dir = "public/avatars"
archivos_avatares = os.listdir(avatares_dir)

print(f"Actualizando avatares desde {avatares_dir}...\n")
print("=" * 80)

actualizados = 0
no_encontrados = 0

for archivo in archivos_avatares:
    # Obtener el email del nombre del archivo (sin extensión)
    email = os.path.splitext(archivo)[0].lower()
    avatar_url = f"/avatars/{archivo}"

    # Buscar el usuario por email
    cursor.execute("SELECT id FROM public.users WHERE email = %s", (email,))
    user_result = cursor.fetchone()

    if not user_result:
        print(f"[X] No se encontró usuario con email: {email}")
        no_encontrados += 1
        continue

    user_id = user_result[0]

    # Actualizar el avatar_url en profiles
    cursor.execute(
        """UPDATE public.profiles
           SET avatar_url = %s
           WHERE user_id = %s""",
        (avatar_url, user_id)
    )

    # También actualizar en users
    cursor.execute(
        """UPDATE public.users
           SET avatar_url = %s
           WHERE id = %s""",
        (avatar_url, user_id)
    )

    print(f"[OK] {email} -> {avatar_url}")
    actualizados += 1

conn.commit()
cursor.close()
conn.close()

print("\n" + "=" * 80)
print(f"\nRESUMEN:")
print(f"  Total archivos: {len(archivos_avatares)}")
print(f"  [OK] Actualizados: {actualizados}")
print(f"  [X]  No encontrados: {no_encontrados}")
print("\nAvatares actualizados correctamente!\n")
