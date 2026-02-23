import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="pruebas_haider",
    user="postgres",
    password="postgres"
)
cursor = conn.cursor()

print("ESTADO ACTUAL DE LA BASE DE DATOS\n")
print("=" * 80)

# Contar registros
cursor.execute("SELECT COUNT(*) FROM public.users")
total_users = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM public.profiles")
total_profiles = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM public.user_roles")
total_roles = cursor.fetchone()[0]

print(f"\nTOTAL DE REGISTROS:")
print(f"  public.users:       {total_users}")
print(f"  public.profiles:    {total_profiles}")
print(f"  public.user_roles:  {total_roles}")

# Users sin profile
cursor.execute("""
    SELECT COUNT(*)
    FROM public.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.id IS NULL
""")
users_sin_profile = cursor.fetchone()[0]

# Profiles sin user_role
cursor.execute("""
    SELECT COUNT(*)
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.id IS NULL
""")
profiles_sin_role = cursor.fetchone()[0]

print(f"\nINCONSISTENCIAS:")
print(f"  Users sin profile:     {users_sin_profile}")
print(f"  Profiles sin rol:      {profiles_sin_role}")

# Mostrar todos los users
print(f"\n" + "=" * 80)
print("\nTODOS LOS USERS EN LA TABLA:\n")
cursor.execute("""
    SELECT u.id, u.email, u.full_name,
           p.id as profile_id,
           ur.role
    FROM public.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.user_roles ur ON ur.user_id = p.id
    ORDER BY u.email
""")

count = 0
for row in cursor.fetchall():
    user_id, email, nombre, profile_id, role = row
    count += 1
    status = "OK" if profile_id and role else "INCOMPLETO"
    print(f"{count:2d}. [{status:10s}] {email:40s} - {nombre}")
    if not profile_id:
        print(f"     [!] Sin profile")
    if profile_id and not role:
        print(f"     [!] Sin rol")

cursor.close()
conn.close()

print(f"\n" + "=" * 80)
print("\nOPCIONES:")
print("1. LIMPIAR usuarios incompletos (sin profile o sin rol)")
print("2. ELIMINAR TODOS los usuarios (empezar de cero)")
print("3. COMPLETAR usuarios incompletos (agregar profiles y roles faltantes)")
