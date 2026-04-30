import subprocess
import os

def setup_gcp_scheduler(project_id, service_url):
    """
    Provisions Cloud Scheduler jobs for Home-Seek Tier Pulses.
    Requires gcloud CLI to be authenticated.
    """
    
    # Tier Schedule Config
    schedules = [
        {"tier": "gold", "frequency": "*/10 * * * *", "label": "Gold Pulse (10m)"},      # Every 10 minutes
        {"tier": "silver", "frequency": "*/30 * * * *", "label": "Silver Pulse (30m)"}, # Every 30 minutes
        {"tier": "bronze", "frequency": "0 0 * * *", "label": "Bronze Pulse (24h)"}   # Every day at midnight
    ]
    
    print(f"--- [DEPLOY] Provisioning Home-Seek Pulse Engines for {project_id} ---")
    
    for s in schedules:
        tier = s["tier"]
        cron = s["frequency"]
        name = f"home-seek-pulse-{tier}"
        url = f"{service_url}/pulse/{tier}"
        
        # Build gcloud command
        cmd = [
            "gcloud", "scheduler", "jobs", "create", "http", name,
            f"--schedule={cron}",
            f"--uri={url}",
            "--http-method=POST",
            f"--project={project_id}",
            "--location=europe-west1", # Common GCP location, adjust if needed
            f"--description=Home-Seek {tier.capitalize()} automated listing scan"
        ]
        
        try:
            print(f"[PROCESS] Deploying {s['label']}...")
            # We use subprocess with shell=True for Windows compatibility
            result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            if "already exists" in result.stderr:
                print(f"[OK] {s['label']} already exists. Syncing...")
            elif result.returncode == 0:
                print(f"[SUCCESS] {s['label']} successfully deployed!")
            else:
                print(f"[ERROR] Error deploying {s['label']}: {result.stderr}")
                
        except Exception as e:
            print(f"[CRITICAL] Execution failed: {str(e)}")

if __name__ == "__main__":
    PROJECT_ID = "home-seek-98294"
    SERVICE_URL = "https://home-seek-api-861426645796.europe-west1.run.app" 
    
    print(f"--- [SYSTEM] Activating Pulse Triggers for {SERVICE_URL} ---")
    setup_gcp_scheduler(PROJECT_ID, SERVICE_URL)
