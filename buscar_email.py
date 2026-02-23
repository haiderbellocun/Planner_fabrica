import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="pruebas_haider",
    user="postgres",
    password="postgres"
)
cursor = conn.cursor()

# Buscar en users
print("Buscando 'anibal_anguloor' en public.users:")
cursor.execute("SELECT * FROM public.users WHERE email LIKE '%anibal%'")
print(f"Resultado: {cursor.fetchall()}")

# Buscar en profiles
print("\nBuscando 'anibal_anguloor' en public.profiles:")
cursor.execute("SELECT * FROM public.profiles WHERE email LIKE '%anibal%'")
print(f"Resultado: {cursor.fetchall()}")

cursor.close()
conn.close()
