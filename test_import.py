import psycopg2
import bcrypt

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="pruebas_haider",
    user="postgres",
    password="postgres"
)

# Intentar insertar UN usuario de prueba
email = "prueba_test@cun.edu.co"
full_name = "Usuario de Prueba"
cedula = "1234567890"

password_hash = bcrypt.hashpw(cedula.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

cursor = conn.cursor()

try:
    print("1. Insertando en users...")
    cursor.execute(
        """INSERT INTO public.users (email, password_hash, full_name, is_active)
           VALUES (%s, %s, %s, true)
           RETURNING id""",
        (email, password_hash, full_name)
    )
    user_id = cursor.fetchone()[0]
    print(f"   OK - User creado (ID: {user_id})")

    print("\n2. Insertando en profiles...")
    cursor.execute(
        """INSERT INTO public.profiles (user_id, full_name, email)
           VALUES (%s, %s, %s)
           RETURNING id""",
        (user_id, full_name, email)
    )
    profile_id = cursor.fetchone()[0]
    print(f"   OK - Profile creado (ID: {profile_id})")

    print("\n3. Insertando en user_roles...")
    cursor.execute(
        """INSERT INTO public.user_roles (user_id, role)
           VALUES (%s, 'user')""",
        (profile_id,)
    )
    print(f"   OK - Rol asignado")

    conn.commit()
    print("\n[EXITO] Usuario creado completamente!\n")

except Exception as e:
    conn.rollback()
    print(f"\n[ERROR] {type(e).__name__}: {e}\n")
    import traceback
    traceback.print_exc()

cursor.close()
conn.close()
