import asyncio
import httpx
import time
import os

# Use local test server or fallback to a live port if deployed locally
BASE_URL = os.getenv("API_URL", "http://127.0.0.1:8000")

async def load_test_checkout_concurrency():
    """
    Simulate 150 simultaneous fans trying to buy 1 item each from a stock of 50.
    Exactly 50 should succeed, and 100 should fail. The final stock must be exactly 0 (no negative stock).
    """
    print("\n--- Starting Load Test: Checkout Concurrency (150 requests vs 50 stock) ---")
    
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        # We need a fan token. First, register and login.
        try:
            await client.post("/api/v1/auth/register", json={
                "name": "Load Tester", "email": "loadtester@stadium.com", "password": "pass", "role": "fan"
            })
        except Exception:
            pass # might exist
            
        login_res = await client.post("/api/v1/auth/login", json={"email": "loadtester@stadium.com", "password": "pass"})
        if login_res.status_code != 200:
            print(f"Skipping Load Test: Unable to authenticate loadtester. Is server running at {BASE_URL}?")
            return
            
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # We need to find an item with exactly 50 stock, or we just rely on the API to process them.
        # Note: Since this is an external script, it expects the server to be running and populated, 
        # or it can run against the standard test databases if integrated into pytest.
        # For simplicity, we just bombard the endpoint. We will use item_id = 1.
        
        print(f"Bombarding POST /api/v1/sales for item_id 1 with 150 concurrent tasks...")
        start_time = time.time()
        
        async def make_purchase():
            res = await client.post("/api/v1/sales", json={"item_id": 1, "quantity": 1}, headers=headers)
            return res.status_code

        tasks = [make_purchase() for _ in range(150)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        duration = time.time() - start_time
        
        successes = sum(1 for r in results if r == 200)
        failures = sum(1 for r in results if r == 400) # Bad Request (Insufficient Stock)
        errors = sum(1 for r in results if r not in [200, 400])
        
        print(f"Results completed in {duration:.2f} seconds.")
        print(f"Successful checkouts: {successes}")
        print(f"Stock denied checkouts: {failures}")
        print(f"Server errors / other: {errors}")


async def load_test_telemetry_firehose():
    """
    Simulate hundreds of BLE/CCTV sensors continuously pinging the crowd telemetry API.
    """
    print("\n--- Starting Load Test: Telemetry Firehose (300 requests) ---")
    
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        print(f"Bombarding POST /api/v1/crowd/telemetry with 300 concurrent sweep tasks...")
        start_time = time.time()
        
        async def transmit_telemetry(idx):
            # cycle through area_ids 1 to 5
            area_id = (idx % 5) + 1
            res = await client.post("/api/v1/crowd/telemetry", json={"area_id": area_id, "count": 20 + idx})
            return res.status_code

        tasks = [transmit_telemetry(i) for i in range(300)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        duration = time.time() - start_time
        
        successes = sum(1 for r in results if r == 200)
        errors = sum(1 for r in results if r != 200)
        
        print(f"Results completed in {duration:.2f} seconds.")
        print(f"Successful transmissions: {successes}")
        print(f"Failed transmissions: {errors}")

async def main():
    try:
        await load_test_checkout_concurrency()
        await load_test_telemetry_firehose()
    except Exception as e:
        print(f"Load tests failed to complete: {e}")

if __name__ == "__main__":
    asyncio.run(main())
