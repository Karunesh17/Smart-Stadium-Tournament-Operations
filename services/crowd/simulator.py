import time
import argparse
import random
import sys
import httpx

BASE_URL = "http://127.0.0.1:8000"

DEFAULT_AREAS = [
    {"name": "Gate A Entry Zone", "capacity": 1500},
    {"name": "North Stand", "capacity": 15000},
    {"name": "South Concourse Concessions", "capacity": 2500},
    {"name": "East Stand Concourse", "capacity": 3000}
]

def get_admin_token():
    client = httpx.Client(base_url=BASE_URL)
    # 1. Attempt to register an admin user for simulation setup
    admin_payload = {
        "name": "Crowd Simulator Admin",
        "email": "crowd.admin@stadium.com",
        "password": "simulatorpassword123",
        "role": "admin"
    }
    try:
        res = client.post("/api/v1/auth/register", json=admin_payload)
        if res.status_code == 201:
            print("Registered crowd simulator admin user.")
    except Exception as e:
        print(f"Admin registration note: {e}")

    # 2. Login to get Access Token
    try:
        res = client.post("/api/v1/auth/login", json={
            "email": "crowd.admin@stadium.com",
            "password": "simulatorpassword123"
        })
        if res.status_code == 200:
            token = res.json()["access_token"]
            return token
        else:
            print(f"Failed admin login: {res.text}")
            sys.exit(1)
    except Exception as e:
        print(f"Error logging in admin: {e}")
        sys.exit(1)

def setup_areas(token):
    headers = {"Authorization": f"Bearer {token}"}
    client = httpx.Client(base_url=BASE_URL, headers=headers)
    
    # Check current areas
    try:
        res = client.get("/api/v1/crowd/areas")
        existing_areas = res.json()
        if len(existing_areas) > 0:
            print(f"Found {len(existing_areas)} existing sectors. Skipping registration.")
            return existing_areas
    except Exception as e:
        print(f"Error querying areas: {e}")
        sys.exit(1)

    # Register default areas
    registered_areas = []
    for area in DEFAULT_AREAS:
        try:
            res = client.post("/api/v1/crowd/areas", json=area)
            if res.status_code == 201:
                print(f"Registered area sector: '{area['name']}' (Capacity: {area['capacity']})")
                registered_areas.append(res.json())
            else:
                print(f"Failed to register area '{area['name']}': {res.text}")
        except Exception as e:
            print(f"Error registering area: {e}")
            
    # Re-query all to get IDs
    res = client.get("/api/v1/crowd/areas")
    return res.json()

def run_simulator(args):
    token = get_admin_token()
    areas = setup_areas(token)
    
    if not areas:
        print("No areas available to simulate.")
        return

    headers = {"Authorization": f"Bearer {token}"}
    client = httpx.Client(base_url=BASE_URL, headers=headers)
    
    print("\n--- Starting telemetry generation stream ---")
    print(f"Spike Area Target: {args.spike_area or 'None'}")
    
    try:
        while True:
            for area in areas:
                area_id = area["id"]
                name = area["name"]
                capacity = area["capacity"]
                
                # Check if this is the target spike area
                if args.spike_area and args.spike_area.lower() in name.lower():
                    # Calculate spiked headcount (defaults to 95% of capacity)
                    if args.spike_count is not None:
                        count = min(capacity * 2, max(0, args.spike_count))
                    else:
                        count = int(capacity * 0.95)
                    print(f"[SPIKE ACTIVE] Overloading '{name}' to {count}/{capacity}")
                else:
                    # Normal random count distribution between 30% and 65% of capacity
                    count = int(capacity * random.uniform(0.3, 0.65))
                
                # POST telemetry reading
                payload = {"area_id": area_id, "count": count}
                try:
                    res = client.post("/api/v1/crowd/telemetry", json=payload)
                    if res.status_code == 201:
                        print(f"Telemetry Sent -> Sector: {name} | Count: {count} | Density: {round(count/capacity*100, 1)}%")
                    else:
                        print(f"Failed telemetry ingestion for '{name}': {res.text}")
                except Exception as e:
                    print(f"Ingestion network error: {e}")
                    
            if args.once:
                print("Single telemetry cycle completed (--once flag). Exiting.")
                break
                
            time.sleep(args.interval)
            
    except KeyboardInterrupt:
        print("\nSimulator stopped by user.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BLE/CCTV Crowd Sensor Telemetry Simulator")
    parser.add_argument("--spike-area", type=str, default=None, help="Name of area zone to spike density for")
    parser.add_argument("--spike-count", type=int, default=None, help="Explicit headcount value for spiked zone")
    parser.add_argument("--interval", type=float, default=3.0, help="Interval in seconds between telemetry cycles")
    parser.add_argument("--once", action="store_true", help="Run a single simulation sweep and exit")
    
    args = parser.parse_args()
    run_simulator(args)
