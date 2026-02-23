import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="pruebas_haider",
    user="postgres",
    password="postgres"
)
cursor = conn.cursor()

print("VERIFICANDO TRIGGERS EN LAS TABLAS\n")
print("=" * 80)

# Ver triggers en users
print("\nTRIGGERS en public.users:")
cursor.execute("""
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'users'
    AND event_object_schema = 'public'
""")

triggers_users = cursor.fetchall()
if triggers_users:
    for trigger in triggers_users:
        print(f"  - {trigger[0]}: {trigger[1]} -> {trigger[2]}")
else:
    print("  (ninguno)")

# Ver triggers en profiles
print("\nTRIGGERS en public.profiles:")
cursor.execute("""
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'profiles'
    AND event_object_schema = 'public'
""")

triggers_profiles = cursor.fetchall()
if triggers_profiles:
    for trigger in triggers_profiles:
        print(f"  - {trigger[0]}: {trigger[1]} -> {trigger[2]}")
else:
    print("  (ninguno)")

# Buscar específicamente el user_id que aparece en el error
print("\n" + "=" * 80)
print("\nBUSCANDO user_id del primer error: 622bc979-00ea-430a-8bf5-26a340cc63c7\n")

cursor.execute("""
    SELECT * FROM public.users WHERE id = '622bc979-00ea-430a-8bf5-26a340cc63c7'
""")
user = cursor.fetchone()
if user:
    print(f"  [!] ENCONTRADO en users: {user}")
else:
    print(f"  [ ] NO existe en users")

cursor.execute("""
    SELECT * FROM public.profiles WHERE user_id = '622bc979-00ea-430a-8bf5-26a340cc63c7'
""")
profile = cursor.fetchone()
if profile:
    print(f"  [!] ENCONTRADO en profiles: {profile}")
else:
    print(f"  [ ] NO existe en profiles")

cursor.close()
conn.close()
