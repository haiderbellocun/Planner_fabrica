import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="pruebas_haider",
    user="postgres",
    password="postgres"
)
cursor = conn.cursor()

# Ver TODOS los users
print("TODOS LOS USERS EN LA BASE DE DATOS:\n")
cursor.execute("SELECT id, email, full_name FROM public.users ORDER BY email")

count = 0
for row in cursor.fetchall():
    user_id, email, nombre = row
    count += 1
    print(f"{count}. {email} - {nombre}")

print(f"\nTotal users: {count}")

# Verificar restricciones UNIQUE en users
print("\nRESTRICCIONES UNIQUE EN users.email:")
cursor.execute("""
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'users'
    AND constraint_type IN ('UNIQUE', 'PRIMARY KEY')
""")

for row in cursor.fetchall():
    print(f"  - {row[0]}: {row[1]}")

# Ver índices
print("\nINDICES EN users:")
cursor.execute("""
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'users'
""")

for row in cursor.fetchall():
    print(f"  - {row[0]}")
    print(f"    {row[1]}")

cursor.close()
conn.close()
