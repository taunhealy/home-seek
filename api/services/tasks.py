
import os
import json
from google.cloud import tasks_v2
from google.protobuf import timestamp_pb2
import datetime

class TaskManager:
    def __init__(self):
        self.project = os.getenv("FIREBASE_ID", "home-seek-98294")
        self.location = "europe-west1" # Matches your scheduler location
        self.queue = "sniper-pulse-queue"
        self.client = tasks_v2.CloudTasksClient()

    def enqueue_sniper_scan(self, payload: dict, service_url: str):
        """
        Dispatches a single sniper scan to Google Cloud Tasks.
        This provides a dedicated timeout and retry policy per user.
        """
        parent = self.client.queue_path(self.project, self.location, self.queue)

        # Build the task
        task = {
            "http_request": {
                "http_method": tasks_v2.HttpMethod.POST,
                "url": f"{service_url}/task/execute-distributed",
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps(payload).encode(),
            }
        }

        # Add OIDC token for secure internal communication if needed
        # (Cloud Run to Cloud Run usually uses OIDC)
        # task["http_request"]["oidc_token"] = {"service_account_email": ...}

        try:
            response = self.client.create_task(request={"parent": parent, "task": task})
            print(f"[TASKS] Dispatched Distributed Scan: {response.name}")
            return response.name
        except Exception as e:
            print(f"[TASKS] ERROR enqueuing task: {e}")
            return None
