import bcrypt
import time

# 1. This is a sample hash from your database (Cost Factor 10)
# In your demo, you can replace this with a real hash from your Firestore
stored_hash = b"$2b$10$5Rjs2zUogAN5kzQcbqKDMeZstDCnQPeIMXLYeZu5FcKR3Ef.TQUyO"

# 2. The "Dictionary" - common passwords an attacker would try
password_list = ["123456", "password", "admin123", "animua2026", "secretpassword", "Hannah123456789"]

def run_audit():
    print("--- ANIMUA Security Audit: Bcrypt Brute-Force Test ---")
    print(f"Target Hash: {stored_hash.decode()}\n")

    for guess in password_list:
        start_time = time.time()
        
        # This function performs the actual 'work' of checking the password
        is_match = bcrypt.checkpw(guess.encode('utf-8'), stored_hash)
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"Testing: '{guess}'")
        print(f"Result: {'MATCH FOUND!' if is_match else 'Invalid'}")
        print(f"Time taken: {duration:.4f} seconds\n")

if __name__ == "__main__":
    run_audit()