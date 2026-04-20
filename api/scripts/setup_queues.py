
import subprocess
import os

def setup_gcp_queues(project_id):
    """
    Provisions the Distributed Task Queues for Home-Seek.
    """
    location = "europe-west1"
    queue_name = "sniper-pulse-queue"
    
    print(f"--- [DEPLOY] Provisioning Home-Seek Task Queues in {location} ---")
    
    # 📡 CREATE QUEUE
    # We use a 10-minute timeout for the distributed tasks
    cmd = [
        "gcloud", "tasks", "queues", "create", queue_name,
        f"--project={project_id}",
        f"--location={location}",
        "--max-concurrent-dispatches=10", # Throttle if needed to protect the AI/Proxy
        "--max-attempts=3",
        "--min-backoff=10s",
        "--max-backoff=100s"
    ]
    
    try:
        print(f"[PROCESS] Creating Queue: {queue_name}...")
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
        if "already exists" in result.stderr:
            print(f"[OK] Queue '{queue_name}' already exists.")
        elif result.returncode == 0:
            print(f"[SUCCESS] Queue '{queue_name}' successfully provisioned!")
        else:
            print(f"[ERROR] Fail: {result.stderr}")
            
    except Exception as e:
        print(f"[CRITICAL] Execution failed: {str(e)}")

if __name__ == "__main__":
    PROJECT_ID = "home-seek-98294"
    setup_gcp_queues(PROJECT_ID)
