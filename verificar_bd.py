import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="pruebas_haider",
    user="postgres",
    password="postgres"
)
cursor = conn.cursor()

# Verificar cantidad en cada tabla
print("ESTADO DE LAS TABLAS:\n")

cursor.execute("SELECT COUNT(*) FROM public.users")
print(f"[OK] public.users: {cursor.fetchone()[0]} registros")

cursor.execute("SELECT COUNT(*) FROM public.profiles")
print(f"[OK] public.profiles: {cursor.fetchone()[0]} registros")

cursor.execute("SELECT COUNT(*) FROM public.user_roles")
print(f"[OK] public.user_roles: {cursor.fetchone()[0]} registros")

# Verificar usuarios con emails @cun.edu.co
print("\nUsuarios @cun.edu.co:\n")
cursor.execute("""
    SELECT u.email, p.full_name, ur.role
    FROM public.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE u.email LIKE '%@cun.edu.co'
    LIMIT 10
""")

for row in cursor.fetchall():
    email, nombre, rol = row
    print(f"  - {nombre or 'Sin nombre'} ({email}) - Rol: {rol or 'SIN ROL'}")

# Verificar inconsistencias
print("\nPOSIBLES PROBLEMAS:\n")

cursor.execute("""
    SELECT COUNT(*)
    FROM public.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
""")
sin_profile = cursor.fetchone()[0]
print(f"  [!] Usuarios sin profile: {sin_profile}")

cursor.execute("""
    SELECT COUNT(*)
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.id IS NULL
""")
sin_role = cursor.fetchone()[0]
print(f"  [!] Profiles sin rol: {sin_role}")

# Si hay usuarios sin rol, mostrarlos
if sin_role > 0:
    print(f"\nUsuarios SIN ROL ASIGNADO ({sin_role}):\n")
    cursor.execute("""
        SELECT p.full_name, p.email
        FROM public.profiles p
        LEFT JOIN public.user_roles ur ON ur.user_id = p.id
        WHERE ur.id IS NULL
        LIMIT 35
    """)
    for row in cursor.fetchall():
        nombre, email = row
        print(f"  - {nombre} ({email})")

cursor.close()
conn.close()
