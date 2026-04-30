import asyncio
import os
import sys
from pathlib import Path

# Add the project root to sys.path so we can import services
current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
sys.path.append(str(project_root))

from services.database import get_user_alerts

async def main():
    user_id = "taun_test_user"
    print(f"Fetching alerts for {user_id}...")
    alerts = await get_user_alerts(user_id)
    if not alerts:
        print("No alerts found.")
        return

    print(f"Found {len(alerts)} alerts:")
    for i, alert in enumerate(alerts):
        print(f"\n--- Alert {i+1} ---")
        for k, v in alert.items():
            print(f"  {k}: {v}")

if __name__ == "__main__":
    asyncio.run(main())
