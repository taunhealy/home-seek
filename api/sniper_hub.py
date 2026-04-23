import customtkinter as ctk
import threading
import subprocess
import os
import sys
import json
import time
import requests
import datetime as dt

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("green")

class SniperHub(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Home-Seek | Local Extraction Console")
        self.geometry("1000x650")
        
        self.server_process = None
        self.pulse_thread = None
        self.is_pulsing = False
        
        # Grid Layout
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # --- Sidebar ---
        self.sidebar_frame = ctk.CTkFrame(self, width=220, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        
        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="Sniper Engine", font=ctk.CTkFont(size=20, weight="bold"))
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 10))
        
        self.server_status_label = ctk.CTkLabel(self.sidebar_frame, text="Backend: OFFLINE", text_color="gray")
        self.server_status_label.grid(row=1, column=0, padx=20, pady=5)
        
        self.btn_toggle_server = ctk.CTkButton(self.sidebar_frame, text="Boot Extraction Server", command=self.toggle_server)
        self.btn_toggle_server.grid(row=2, column=0, padx=20, pady=10)

        # 🚀 [PROMINENT] HEADLESS TOGGLE
        self.headless_var = ctk.BooleanVar(value=False)
        self.headless_switch = ctk.CTkSwitch(self.sidebar_frame, text="Invisible Mode (Headless)", variable=self.headless_var)
        self.headless_switch.grid(row=3, column=0, padx=20, pady=(5, 15))

        # NEW: AUTH MAINTENANCE
        self.auth_label = ctk.CTkLabel(self.sidebar_frame, text="🔐 SESSION AUTH", font=ctk.CTkFont(size=14, weight="bold"))
        self.auth_label.grid(row=4, column=0, padx=20, pady=(30, 5))

        self.btn_prime_session = ctk.CTkButton(self.sidebar_frame, text="Prime Login Session", command=self.prime_session, fg_color="#8b5cf6", hover_color="#7c3aed")
        self.btn_prime_session.grid(row=5, column=0, padx=20, pady=10)

        # Targeting Controls
        self.target_label = ctk.CTkLabel(self.sidebar_frame, text="🎯 TARGETING", font=ctk.CTkFont(size=14, weight="bold"))
        self.target_label.grid(row=6, column=0, padx=20, pady=(30, 5))

        self.keyword_entry = ctk.CTkEntry(self.sidebar_frame, placeholder_text="Keyword (e.g. Sea Point)")
        self.keyword_entry.grid(row=7, column=0, padx=20, pady=5, sticky="ew")

        self.source_var = ctk.StringVar(value="Select Source")
        self.source_menu = ctk.CTkOptionMenu(self.sidebar_frame, variable=self.source_var, values=["Huis Huis", "Huis Huis Pet Friendly", "Sea Point Rentals", "FB Marketplace", "Property24"])
        self.source_menu.grid(row=8, column=0, padx=20, pady=5, sticky="ew")

        self.btn_manual_snipe = ctk.CTkButton(self.sidebar_frame, text="Snipe Now", command=self.manual_snipe, fg_color="#f59e0b", hover_color="#d97706")
        self.btn_manual_snipe.grid(row=9, column=0, padx=20, pady=10)

        # NEW: QUICK SNIPE
        self.quick_label = ctk.CTkLabel(self.sidebar_frame, text="[Missions] QUICK SNIPES", font=ctk.CTkFont(size=14, weight="bold"))
        self.quick_label.grid(row=10, column=0, padx=20, pady=(30, 5))

        self.btn_quick_seapoint = ctk.CTkButton(self.sidebar_frame, text="Snipe: Sea Point (Huis Huis)", command=self.quick_seapoint, fg_color="#ec4899", hover_color="#db2777")
        self.btn_quick_seapoint.grid(row=11, column=0, padx=20, pady=10)

        # Advanced Pulse & Diag (Moved down to prevent overlap)
        self.btn_re_match = ctk.CTkButton(self.sidebar_frame, text="🧠 ALERTS SCAN (DB ONLY)", command=self.intel_re_match, fg_color="#10b981", hover_color="#059669")
        self.btn_re_match.grid(row=12, column=0, padx=20, pady=(30, 5))

        self.btn_force_hunt = ctk.CTkButton(self.sidebar_frame, text="🏹 HUNT NOW (WEB SCAN)", command=self.force_pulse, fg_color="#3b82f6", hover_color="#2563eb")
        self.btn_force_hunt.grid(row=13, column=0, padx=20, pady=5)

        self.btn_diag = ctk.CTkButton(self.sidebar_frame, text="Run Pro Diagnostic", command=self.run_prod_diag, fg_color="#6366f1", hover_color="#4f46e5")
        self.btn_diag.grid(row=14, column=0, padx=20, pady=10)
        
        
        # --- Main Console ---
        self.main_frame = ctk.CTkFrame(self)
        self.main_frame.grid(row=0, column=1, padx=20, pady=20, sticky="nsew")
        self.main_frame.grid_rowconfigure(2, weight=1)
        self.main_frame.grid_columnconfigure(0, weight=1)

        self.console_title = ctk.CTkLabel(self.main_frame, text="Active Mission Telemetry", font=ctk.CTkFont(size=16, weight="bold"))
        self.console_title.grid(row=0, column=0, sticky="w", padx=20, pady=(20, 10))
        
        # Facebook Security Audit
        self.cookie_status = ctk.CTkLabel(self.main_frame, text="Checking Facebook Auth...", font=ctk.CTkFont(size=12))
        self.cookie_status.grid(row=1, column=0, sticky="w", padx=20, pady=5)
        
        self.terminal = ctk.CTkTextbox(self.main_frame, font=ctk.CTkFont(family="Consolas", size=12), text_color="#10b981", fg_color="#000000")
        self.terminal.grid(row=2, column=0, sticky="nsew", padx=20, pady=20)
        
        self.log_text("SYSTEM INITIALIZED. Waiting for orders...")
        self.check_cookies()

    def log_text(self, message):
        msg = f"[{dt.datetime.now().strftime('%H:%M:%S')}] {message}\n"
        self.terminal.insert("end", msg)
        self.terminal.see("end")

    def check_cookies(self):
        cookie_path = "cookies.json"
        if os.path.exists(cookie_path):
            try:
                with open(cookie_path, "r") as f:
                    cookies = json.load(f)
                    c_user = next((c['value'] for c in cookies if c['name'] == 'c_user'), None)
                    if c_user:
                        self.cookie_status.configure(text=f"🔐 Facebook Auth: Validated (c_user: {c_user})", text_color="#10b981")
                    else:
                        self.cookie_status.configure(text="⚠️ Facebook Auth: No c_user found in JSON", text_color="#f59e0b")
            except Exception as e:
                self.cookie_status.configure(text="❌ Facebook Auth: Corrupt JSON", text_color="#ef4444")
        else:
            self.cookie_status.configure(text="❌ Facebook Auth: cookies.json NOT FOUND", text_color="#ef4444")

    def toggle_server(self):
        if self.server_process is None:
            self.log_text("🔍 Clearing Port 8000...")
            try:
                cmd = 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -Force'
                subprocess.run(["powershell", "-Command", cmd], capture_output=True)
            except: pass

            self.log_text("Booting Uvicorn server (Local Stealth Mode)...")
            env = os.environ.copy()
            env["LOCAL_SNIPER"] = "True"
            env["PYTHONUNBUFFERED"] = "1"
            env["HEADLESS"] = "true" if self.headless_var.get() else "false"
            
            self.server_process = subprocess.Popen(
                "python -m uvicorn main:app --host 0.0.0.0 --port 8000", 
                shell=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.STDOUT, 
                text=True,
                env=env
            )
            self.btn_toggle_server.configure(text="Shutdown Server", fg_color="#ef4444")
            self.server_status_label.configure(text="Backend: ONLINE (Port 8000)", text_color="#10b981")
            threading.Thread(target=self._stream_server_logs, daemon=True).start()
        else:
            self.server_process.terminate()
            self.server_process = None
            self.btn_toggle_server.configure(text="Boot Extraction Server", fg_color=["#3B8ED0", "#1F6AA5"])
            self.server_status_label.configure(text="Backend: OFFLINE", text_color="gray")

    def _stream_server_logs(self):
        for line in self.server_process.stdout:
            self.terminal.insert("end", line)
            self.terminal.see("end")

    def prime_session(self):
        """Opens a browser and KEEPS IT OPEN for manual login/2FA."""
        self.log_text("🔐 PRIMING SESSION: A browser will open. Please log in manually and COMPLETE 2FA.")
        self.log_text("⏳ The bot will wait until you close the browser window yourself.")
        
        def _thread():
            import sys
            env = os.environ.copy()
            env["LOCAL_SNIPER"] = "True"
            env["AUTH_PRIME_MODE"] = "True" 
            # We'll run a specific priming script
            prime_script = """
import asyncio
import os
from playwright.async_api import async_playwright
async def run():
    async with async_playwright() as p:
        user_data_path = os.path.join(os.getcwd(), 'local_session')
        fixed_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        
        # [ALIGNED] Use Proxy for Priming if available
        proxy_config = None
        proxy_url = os.environ.get("HTTP_PROXY")
        if proxy_url:
            import urllib.parse
            parsed = urllib.parse.urlparse(proxy_url)
            # Standard format for Decodo/BrightData
            username = f"{parsed.username}-session-prime" if parsed.username else None
            proxy_config = {"server": f"{parsed.hostname}:{parsed.port}", "username": username, "password": parsed.password}

        context = await p.chromium.launch_persistent_context(
            user_data_dir=user_data_path,
            headless=False,
            user_agent=fixed_ua,
            viewport={'width': 1920, 'height': 1080},
            proxy=proxy_config,
            args=['--no-sandbox']
        )
        page = await context.new_page()
        await page.goto('https://www.facebook.com')
        print('PRIME: Browser open. Log in and close when done.')
        # Wait indefinitely until closed
        while True:
            try:
                if context.pages == []: break
                await asyncio.sleep(1)
            except: break
        await context.close()
        print('PRIME: Session captured and directory locked.')
if __name__ == '__main__':
    asyncio.run(run())
"""
            with open("prime_helper.py", "w") as f: f.write(prime_script)
            subprocess.run([sys.executable, "prime_helper.py"])
            self.log_text("✅ SESSION PRIMED: Login captured! You can now use 'Snipe Now' freely.")
            self.check_cookies()

        threading.Thread(target=_thread, daemon=True).start()

    def intel_re_match(self):
        user_id = "taun_test_user"
        self.log_text(f"🧠 ANALYZING GLOBAL INTEL for {user_id} (DB Only)...")
        
        def _post():
            import time
            success = False
            for attempt in range(15): # 30s total window
                try:
                    res = requests.post(
                        "http://127.0.0.1:8000/trigger-re-match", 
                        json={"user_id": user_id},
                        proxies={"http": None, "https": None},
                        timeout=30
                    )
                    data = res.json()
                    if data.get("status") == "success":
                        self.log_text(f"✅ INTEL SCAN COMPLETE: Cross-referencing {data.get('intel_pool')} listings.")
                        success = True
                    else:
                        self.log_text(f"❌ Intel Error: {data.get('message')}")
                        break
                    break
                except requests.exceptions.ConnectionError:
                    if attempt == 0:
                        self.log_text("⏳ STATION: Server is still warming up... holding intel scan in queue.")
                    time.sleep(2)
                except Exception as e:
                    self.log_text(f"❌ API Error: {e}")
                    break
            
            if not success and attempt == 14:
                 self.log_text("❌ TIMEOUT: Server failed to respond after 30s.")
        
        threading.Thread(target=_post, daemon=True).start()

    def force_pulse(self):
        user_id = "taun_test_user"
        self.log_text(f"🚀 INITIATING PROACTIVE ALERTS SCAN for {user_id}...")
        
        def _post():
            import time
            success = False
            for attempt in range(15): # 30s total window
                try:
                    res = requests.post(
                        "http://127.0.0.1:8000/trigger-full-scan", 
                        json={"user_id": user_id},
                        proxies={"http": None, "https": None},
                        timeout=30
                    )
                    data = res.json()
                    if data.get("status") == "success":
                        self.log_text(f"✅ BATCH DISPATCHED: {data.get('mission_count')} alerts in queue.")
                        success = True
                    else:
                        self.log_text(f"❌ Batch Error: {data.get('message')}")
                        break
                    break
                except requests.exceptions.ConnectionError:
                    if attempt == 0:
                        self.log_text("⏳ STATION: Server is still warming up... holding global scan in queue.")
                    time.sleep(2)
                except Exception as e:
                    self.log_text(f"❌ API Error: {e}")
                    break
            
            if not success and attempt == 14:
                 self.log_text("❌ TIMEOUT: Server failed to respond after 30s.")
        
        threading.Thread(target=_post, daemon=True).start()

    def manual_snipe(self):
        keyword = self.keyword_entry.get()
        source_name = self.source_var.get()
        if not keyword or source_name == "Select Source":
            self.log_text("⚠️ ERROR: Enter keyword and select source.")
            return

        source_id_map = {
            "Huis Huis": "Lix5HlnnquOBb8KjEsCa", 
            "Huis Huis Pet Friendly": "x8j0OMfg6xn5X9aPI2MI", 
            "Sea Point Rentals": "BFqKlkZ1oTzkXpuJ9nQ3",
            "FB Marketplace": "0JPElXlENPTODJGr8hU9", 
            "Property24": "llLUh4dRz0mu7p2lHbtC"
        }
        source_id = source_id_map.get(source_name)
        
        self.log_text(f"🎯 SNIPING: {keyword} @ {source_name}...")
        def _post():
            import time
            success = False
            for attempt in range(15): # 30s total window
                try:
                    requests.post(
                        "http://127.0.0.1:8000/trigger-snipe", 
                        json={"query": keyword, "source_ids": [source_id], "user_id": "taun_test_user"},
                        proxies={"http": None, "https": None},
                        timeout=30
                    )
                    success = True
                    break
                except requests.exceptions.ConnectionError:
                    if attempt == 0:
                        self.log_text("⏳ STATION: Server is still warming up... holding mission in queue.")
                    time.sleep(2)
                except Exception as e:
                    self.log_text(f"❌ API Error: {e}")
                    break
            
            if not success and attempt == 14:
                 self.log_text("❌ TIMEOUT: Server failed to respond after 30s.")
        
        threading.Thread(target=_post, daemon=True).start()

    def quick_seapoint(self):
        """One-click mission for Sea Point @ Huis Huis."""
        self.keyword_entry.delete(0, "end")
        self.keyword_entry.insert(0, "Sea Point")
        self.source_var.set("Huis Huis")
        self.manual_snipe()

    def trigger_manual_heartbeat(self):
        """Kicks the autonomous server heartbeat instantly."""
        self.log_text("[PULSE] PROXY PULSE: Sending manual kick to autonomous node...")
        def _kick():
            try:
                # Trigger the heart instead of the old loop
                requests.post("http://127.0.0.1:8000/force-pulse", timeout=5)
                self.log_text("[SUCCESS] PULSE SIGNAL RECEIVED: Heartbeat commenced.")
            except: 
                self.log_text("[FAILED] FAILED: Is the server (main.py) running?")
        
        threading.Thread(target=_kick, daemon=True).start()

    def run_prod_diag(self):
        self.log_text("🩺 Diagnostic Started...")
        threading.Thread(target=lambda: requests.post("http://127.0.0.1:8000/diag/proxy-check"), daemon=True).start()

if __name__ == "__main__":
    app = SniperHub()
    app.mainloop()
