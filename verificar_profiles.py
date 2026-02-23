import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="pruebas_haider",
    user="postgres",
    password="postgres"
)
cursor = conn.cursor()

# Ver TODOS los profiles (no solo los que tienen user_id válido)
print("TODOS LOS PROFILES EN LA BASE DE DATOS:\n")
cursor.execute("SELECT id, user_id, full_name, email FROM public.profiles ORDER BY email")

count = 0
for row in cursor.fetchall():
    prof_id, user_id, nombre, email = row
    count += 1
    print(f"{count}. {email} - {nombre} (user_id: {user_id})")

print(f"\nTotal profiles: {count}")

# Verificar si hay índices UNIQUE en email
print("\nRESTRICCIONES UNIQUE EN profiles.email:")
cursor.execute("""
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'profiles'
    AND constraint_type = 'UNIQUE'
""")

for row in cursor.fetchall():
    print(f"  - {row[0]}: {row[1]}")

cursor.close()
conn.close()
