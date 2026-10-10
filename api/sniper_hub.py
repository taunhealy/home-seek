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
        self.geometry("1180x820")
        
        self.server_process = None
        self.pulse_thread = None
        self.is_pulsing = False
        
        # Intercept window close for clean process shutdown
        self.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Grid Layout (Sidebar | Main Console)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        # ==========================================
        # 1. SCROLLABLE SIDEBAR (Control & Filters)
        # ==========================================
        self.sidebar_frame = ctk.CTkScrollableFrame(self, width=340, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        
        # Logo & Server Status
        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="Sniper Engine", font=ctk.CTkFont(size=20, weight="bold"))
        self.logo_label.pack(pady=(15, 4))
        
        self.server_status_label = ctk.CTkLabel(self.sidebar_frame, text="Backend: OFFLINE", text_color="gray", font=ctk.CTkFont(size=12, weight="bold"))
        self.server_status_label.pack(pady=(0, 8))
        
        self.btn_toggle_server = ctk.CTkButton(self.sidebar_frame, text="Boot Extraction Server", command=self.toggle_server)
        self.btn_toggle_server.pack(fill="x", padx=15, pady=(0, 6))

        # Invisible Mode
        self.headless_var = ctk.BooleanVar(value=False)
        self.headless_switch = ctk.CTkSwitch(self.sidebar_frame, text="Invisible Mode (Headless)", variable=self.headless_var)
        self.headless_switch.pack(anchor="w", padx=20, pady=(4, 15))

        # --- SECTION: TARGET & PORTAL ---
        self._create_section_label("🎯 MISSION TARGET")
        
        self.keyword_entry = ctk.CTkEntry(self.sidebar_frame, placeholder_text="Area / Suburb (e.g. Sea Point, Fish Hoek)")
        self.keyword_entry.pack(fill="x", padx=15, pady=(2, 4))

        # Quick Zone Preset Buttons
        preset_row = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        preset_row.pack(fill="x", padx=15, pady=(0, 6))
        
        btn_fav = ctk.CTkButton(
            preset_row, 
            text="⭐ My Favourites", 
            command=lambda: self._set_keyword("My Favourites"),
            fg_color="#334155", 
            hover_color="#475569", 
            font=ctk.CTkFont(size=10, weight="bold"),
            height=24
        )
        btn_fav.pack(side="left", fill="x", expand=True, padx=(0, 2))

        btn_south = ctk.CTkButton(
            preset_row, 
            text="🏖️ Deep South", 
            command=lambda: self._set_keyword("Deep South"),
            fg_color="#334155", 
            hover_color="#475569", 
            font=ctk.CTkFont(size=10, weight="bold"),
            height=24
        )
        btn_south.pack(side="left", fill="x", expand=True, padx=(2, 2))

        btn_sea = ctk.CTkButton(
            preset_row, 
            text="🌊 Sea Point", 
            command=lambda: self._set_keyword("Sea Point"),
            fg_color="#334155", 
            hover_color="#475569", 
            font=ctk.CTkFont(size=10, weight="bold"),
            height=24
        )
        btn_sea.pack(side="left", fill="x", expand=True, padx=(2, 0))

        self.source_var = ctk.StringVar(value="Property24")
        self.source_menu = ctk.CTkOptionMenu(
            self.sidebar_frame, 
            variable=self.source_var, 
            values=["Property24", "FB Marketplace", "Huis Huis", "Huis Huis Pet Friendly", "Sea Point Rentals", "All Sources"]
        )
        self.source_menu.pack(fill="x", padx=15, pady=(0, 14))

        # --- SECTION: EXPLORE LEASE & AGENT FILTERS ---
        self._create_section_label("🛡️ LANDLORD & LEASE TYPE")
        
        # Direct Landlord (No Agents) Filter - Active by default
        self.no_agents_var = ctk.BooleanVar(value=True)
        self.no_agents_switch = ctk.CTkSwitch(
            self.sidebar_frame, 
            text="No Agents (Direct Landlord Only)", 
            variable=self.no_agents_var,
            progress_color="#10b981"
        )
        self.no_agents_switch.pack(anchor="w", padx=20, pady=(2, 8))

        # Auto-Open in Browser Switch - Active by default
        self.auto_open_var = ctk.BooleanVar(value=True)
        self.auto_open_switch = ctk.CTkSwitch(
            self.sidebar_frame, 
            text="🌐 Auto-Open Links in Browser", 
            variable=self.auto_open_var,
            progress_color="#3b82f6"
        )
        self.auto_open_switch.pack(anchor="w", padx=20, pady=(2, 8))

        # Rental Category (Any / Long Term / Short Term / Room Share)
        self._create_sub_label("Rental Category:")
        self.rental_type_var = ctk.StringVar(value="Any")
        self.rental_type_seg = ctk.CTkSegmentedButton(
            self.sidebar_frame, 
            values=["Any", "Long Term", "Short Term", "Room Share"], 
            variable=self.rental_type_var
        )
        self.rental_type_seg.pack(fill="x", padx=15, pady=(0, 8))

        # Lease Term Length (Multi-Select Checkboxes)
        self._create_sub_label("Lease Term Length (Multi-Select):")
        lease_frame = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        lease_frame.pack(fill="x", padx=15, pady=(0, 10))

        r1 = ctk.CTkFrame(lease_frame, fg_color="transparent")
        r1.pack(fill="x", pady=(0, 4))
        self.term_m2m_var = ctk.BooleanVar(value=False)
        self.cb_m2m = ctk.CTkCheckBox(r1, text="M2M (1m)", variable=self.term_m2m_var, font=ctk.CTkFont(size=11))
        self.cb_m2m.pack(side="left", expand=True, fill="x")

        self.term_3m_var = ctk.BooleanVar(value=False)
        self.cb_3m = ctk.CTkCheckBox(r1, text="3 Months", variable=self.term_3m_var, font=ctk.CTkFont(size=11))
        self.cb_3m.pack(side="left", expand=True, fill="x")

        r2 = ctk.CTkFrame(lease_frame, fg_color="transparent")
        r2.pack(fill="x", pady=(0, 4))
        self.term_6m_var = ctk.BooleanVar(value=False)
        self.cb_6m = ctk.CTkCheckBox(r2, text="6 Months", variable=self.term_6m_var, font=ctk.CTkFont(size=11))
        self.cb_6m.pack(side="left", expand=True, fill="x")

        self.term_12m_var = ctk.BooleanVar(value=False)
        self.cb_12m = ctk.CTkCheckBox(r2, text="12 Months+", variable=self.term_12m_var, font=ctk.CTkFont(size=11))
        self.cb_12m.pack(side="left", expand=True, fill="x")

        # --- SECTION: BUDGET & DIMENSIONS ---
        self._create_section_label("💰 BUDGET & SPACE")
        
        price_row = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        price_row.pack(fill="x", padx=15, pady=(2, 6))
        
        self.min_price_entry = ctk.CTkEntry(price_row, placeholder_text="Min R")
        self.min_price_entry.pack(side="left", fill="x", expand=True, padx=(0, 4))
        
        self.max_price_entry = ctk.CTkEntry(price_row, placeholder_text="Max R")
        self.max_price_entry.pack(side="right", fill="x", expand=True, padx=(4, 0))

        self.min_sqm_entry = ctk.CTkEntry(self.sidebar_frame, placeholder_text="Min Size (m²)")
        self.min_sqm_entry.pack(fill="x", padx=15, pady=(0, 14))

        # --- SECTION: PROPERTY SPECS ---
        self._create_section_label("🛏️ PROPERTY SPECS")
        
        self._create_sub_label("Bedrooms:")
        self.beds_var = ctk.StringVar(value="Any")
        self.beds_seg = ctk.CTkSegmentedButton(
            self.sidebar_frame, 
            values=["Any", "1", "2", "3", "4+"], 
            variable=self.beds_var
        )
        self.beds_seg.pack(fill="x", padx=15, pady=(0, 8))

        self.baths_var = ctk.StringVar(value="Any Baths")
        self.baths_menu = ctk.CTkOptionMenu(
            self.sidebar_frame, 
            variable=self.baths_var, 
            values=["Any Baths", "1+ Bath", "2+ Baths", "3+ Baths"]
        )
        self.baths_menu.pack(fill="x", padx=15, pady=(0, 6))

        self.layout_var = ctk.StringVar(value="Any Layout")
        self.layout_menu = ctk.CTkOptionMenu(
            self.sidebar_frame, 
            variable=self.layout_var, 
            values=["Any Layout", "Apartment", "House", "Cottage", "Studio", "Room"]
        )
        self.layout_menu.pack(fill="x", padx=15, pady=(0, 6))

        self.furnished_var = ctk.StringVar(value="Any Furnishing")
        self.furnished_menu = ctk.CTkOptionMenu(
            self.sidebar_frame, 
            variable=self.furnished_var, 
            values=["Any Furnishing", "Furnished", "Unfurnished"]
        )
        self.furnished_menu.pack(fill="x", padx=15, pady=(0, 6))

        self.pets_var = ctk.BooleanVar(value=False)
        self.pets_switch = ctk.CTkSwitch(
            self.sidebar_frame, 
            text="🐾 Pet Friendly Only", 
            variable=self.pets_var,
            progress_color="#10b981"
        )
        self.pets_switch.pack(anchor="w", padx=20, pady=(6, 14))

        # --- SECTION: ACTIONS ---
        self._create_section_label("🚀 MISSION DISPATCH")
        
        self.btn_manual_snipe = ctk.CTkButton(
            self.sidebar_frame, 
            text="🎯 Snipe Now (Filtered Mission)", 
            command=self.manual_snipe, 
            fg_color="#f59e0b", 
            hover_color="#d97706",
            font=ctk.CTkFont(size=13, weight="bold")
        )
        self.btn_manual_snipe.pack(fill="x", padx=15, pady=(4, 6))

        self.btn_quick_favourites = ctk.CTkButton(
            self.sidebar_frame, 
            text="⭐ Snipe: My Favourites (Deep South + 5)", 
            command=self.quick_favourites, 
            fg_color="#d97706", 
            hover_color="#b45309",
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.btn_quick_favourites.pack(fill="x", padx=15, pady=(0, 6))

        self.btn_quick_seapoint = ctk.CTkButton(
            self.sidebar_frame, 
            text="⚡ Snipe: Sea Point (Quick)", 
            command=self.quick_seapoint, 
            fg_color="#ec4899", 
            hover_color="#db2777"
        )
        self.btn_quick_seapoint.pack(fill="x", padx=15, pady=(0, 6))

        self.btn_force_hunt = ctk.CTkButton(
            self.sidebar_frame, 
            text="🏹 HUNT NOW (WEB SCAN)", 
            command=self.force_pulse, 
            fg_color="#3b82f6", 
            hover_color="#2563eb"
        )
        self.btn_force_hunt.pack(fill="x", padx=15, pady=(0, 6))

        self.btn_re_match = ctk.CTkButton(
            self.sidebar_frame, 
            text="🧠 ALERTS SCAN (DB ONLY)", 
            command=self.intel_re_match, 
            fg_color="#10b981", 
            hover_color="#059669"
        )
        self.btn_re_match.pack(fill="x", padx=15, pady=(0, 6))

        self.btn_stop_scan = ctk.CTkButton(
            self.sidebar_frame, 
            text="🛑 ABORT / STOP MISSION", 
            command=self.stop_scraping, 
            fg_color="#dc2626", 
            hover_color="#b91c1c",
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.btn_stop_scan.pack(fill="x", padx=15, pady=(0, 10))

        self.btn_prime_session = ctk.CTkButton(
            self.sidebar_frame, 
            text="🔐 Prime Login Session", 
            command=self.prime_session, 
            fg_color="#8b5cf6", 
            hover_color="#7c3aed"
        )
        self.btn_prime_session.pack(fill="x", padx=15, pady=(0, 6))

        self.btn_diag = ctk.CTkButton(
            self.sidebar_frame, 
            text="🩺 Run Pro Diagnostic", 
            command=self.run_prod_diag, 
            fg_color="#6366f1", 
            hover_color="#4f46e5"
        )
        self.btn_diag.pack(fill="x", padx=15, pady=(0, 15))

        # ==========================================
        # 2. MAIN CONSOLE (Telemetry & Output)
        # ==========================================
        self.main_frame = ctk.CTkFrame(self)
        self.main_frame.grid(row=0, column=1, padx=20, pady=20, sticky="nsew")
        self.main_frame.grid_rowconfigure(2, weight=1)
        self.main_frame.grid_columnconfigure(0, weight=1)

        self.console_title = ctk.CTkLabel(
            self.main_frame, 
            text="Active Mission Telemetry", 
            font=ctk.CTkFont(size=18, weight="bold")
        )
        self.console_title.grid(row=0, column=0, sticky="w", padx=20, pady=(20, 5))
        
        self.cookie_status = ctk.CTkLabel(
            self.main_frame, 
            text="Checking Facebook Auth...", 
            font=ctk.CTkFont(size=12)
        )
        self.cookie_status.grid(row=1, column=0, sticky="w", padx=20, pady=(0, 10))
        
        self.terminal = ctk.CTkTextbox(
            self.main_frame, 
            font=ctk.CTkFont(family="Consolas", size=12), 
            text_color="#10b981", 
            fg_color="#090d16"
        )
        self.terminal.grid(row=2, column=0, sticky="nsew", padx=20, pady=(0, 20))
        
        self.log_text("SYSTEM INITIALIZED. Explore filters loaded & ready.")
        self.log_text("👉 Select an Area (or click '⭐ My Favourites') and click '🎯 Snipe Now' to begin.")
        self.check_cookies()
        self.check_initial_server_status()

    # --- UI Helpers ---
    def _create_section_label(self, text: str):
        lbl = ctk.CTkLabel(
            self.sidebar_frame, 
            text=text, 
            font=ctk.CTkFont(size=12, weight="bold"), 
            text_color="#94a3b8"
        )
        lbl.pack(anchor="w", padx=15, pady=(10, 4))

    def _create_sub_label(self, text: str):
        lbl = ctk.CTkLabel(
            self.sidebar_frame, 
            text=text, 
            font=ctk.CTkFont(size=11), 
            text_color="#64748b"
        )
        lbl.pack(anchor="w", padx=15, pady=(2, 2))

    def log_text(self, message):
        msg = f"[{dt.datetime.now().strftime('%H:%M:%S')}] {message}\n"
        self.terminal.insert("end", msg)
        self.terminal.see("end")

    def check_initial_server_status(self):
        def _check():
            try:
                res = requests.get("http://localhost:8000/docs", timeout=1.5)
                if res.status_code == 200:
                    self.server_status_label.configure(text="Backend: ONLINE (Port 8000)", text_color="#10b981")
                    self.log_text("⚡ Extraction Server is ONLINE (Port 8000). Ready to search!")
            except Exception:
                pass
        threading.Thread(target=_check, daemon=True).start()

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

    def get_python_exec(self):
        venv_python = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".venv", "Scripts", "python.exe"))
        if os.path.exists(venv_python):
            return venv_python
        return sys.executable

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
            
            api_dir = os.path.dirname(os.path.abspath(__file__))
            env["PYTHONPATH"] = api_dir + (os.pathsep + env["PYTHONPATH"] if "PYTHONPATH" in env else "")
            py_exe = self.get_python_exec()
            cmd = f'"{py_exe}" -m uvicorn main_local:app --app-dir "{api_dir}" --host 0.0.0.0 --port 8000'
            self.server_process = subprocess.Popen(
                cmd, 
                shell=True, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.STDOUT, 
                text=True,
                cwd=api_dir,
                env=env
            )
            self.btn_toggle_server.configure(text="Shutdown Server", fg_color="#ef4444")
            self.server_status_label.configure(text="Backend: ONLINE (Port 8000)", text_color="#10b981")
            threading.Thread(target=self._stream_server_logs, daemon=True).start()
        else:
            self.log_text("🛑 Shutting down server and scraping engines...")
            # 1. Send abort signal to stop active scans
            try:
                requests.post("http://127.0.0.1:8000/stop-scan", timeout=2)
            except: pass

            # 2. Kill the process tree on Windows to ensure uvicorn and playwright aren't orphaned
            if self.server_process:
                try:
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(self.server_process.pid)], capture_output=True)
                except: pass
                try:
                    self.server_process.terminate()
                except: pass
                self.server_process = None

            # 3. Clean up port 8000 in case any process is still holding it
            try:
                cmd = 'Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -Force'
                subprocess.run(["powershell", "-Command", cmd], capture_output=True)
            except: pass

            self.btn_toggle_server.configure(text="Boot Extraction Server", fg_color=["#3B8ED0", "#1F6AA5"])
            self.server_status_label.configure(text="Backend: OFFLINE", text_color="gray")
            self.log_text("⚡ Extraction Server is OFFLINE.")

    def _stream_server_logs(self):
        for line in self.server_process.stdout:
            self.terminal.insert("end", line)
            self.terminal.see("end")

    def prime_session(self):
        """Opens a browser and KEEPS IT OPEN for manual login/2FA."""
        self.log_text("🔐 PRIMING SESSION: A browser will open. Please log in manually and COMPLETE 2FA.")
        self.log_text("⏳ The bot will wait until you close the browser window yourself.")
        
        def _thread():
            prime_script = """
import asyncio
import os
from playwright.async_api import async_playwright
async def run():
    async with async_playwright() as p:
        user_data_path = os.path.join(os.getcwd(), 'local_session')
        fixed_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        
        proxy_config = None
        proxy_url = os.environ.get("HTTP_PROXY")
        if proxy_url:
            import urllib.parse
            parsed = urllib.parse.urlparse(proxy_url)
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
            subprocess.run([self.get_python_exec(), "prime_helper.py"])
            self.log_text("✅ SESSION PRIMED: Login captured! You can now use 'Snipe Now' freely.")
            self.check_cookies()

        threading.Thread(target=_thread, daemon=True).start()

    def intel_re_match(self):
        user_id = "taun_test_user"
        self.log_text(f"🧠 ANALYZING GLOBAL INTEL for {user_id} (DB Only)...")
        
        def _post():
            success = False
            for attempt in range(15):
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
            success = False
            for attempt in range(15):
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
        keyword = self.keyword_entry.get().strip()
        source_name = self.source_var.get()
        if not keyword:
            self.log_text("⚠️ ERROR: Enter an Area / Suburb (e.g. Sea Point, Fish Hoek).")
            return

        source_id_map = {
            "Huis Huis": "Lix5HlnnquOBb8KjEsCa", 
            "Huis Huis Pet Friendly": "x8j0OMfg6xn5X9aPI2MI", 
            "Sea Point Rentals": "BFqKlkZ1oTzkXpuJ9nQ3",
            "FB Marketplace": "0JPElXlENPTODJGr8hU9", 
            "Property24": "llLUh4dRz0mu7p2lHbtC"
        }
        source_id = source_id_map.get(source_name)
        source_ids = [source_id] if source_id else None

        # Parse Budget & Dimensions
        min_p_raw = self.min_price_entry.get().strip().replace("R", "").replace(",", "")
        max_p_raw = self.max_price_entry.get().strip().replace("R", "").replace(",", "")
        min_sqm_raw = self.min_sqm_entry.get().strip().replace(",", "")

        min_price = int(min_p_raw) if min_p_raw.isdigit() else None
        max_price = int(max_p_raw) if max_p_raw.isdigit() else None
        min_sqm = int(min_sqm_raw) if min_sqm_raw.isdigit() else None

        # Parse Specs
        beds_val = self.beds_var.get()
        min_beds = None
        if beds_val in ["1", "2", "3"]:
            min_beds = int(beds_val)
        elif beds_val == "4+":
            min_beds = 4

        baths_val = self.baths_var.get()
        min_baths = None
        if "1+" in baths_val: min_baths = 1
        elif "2+" in baths_val: min_baths = 2
        elif "3+" in baths_val: min_baths = 3

        rental_type_map = {
            "Any": None,
            "Long Term": "long-term",
            "Short Term": "short-term",
            "Room Share": "room-share"
        }
        rental_type = rental_type_map.get(self.rental_type_var.get())

        selected_terms = []
        if self.term_m2m_var.get(): selected_terms.append("1")
        if self.term_3m_var.get(): selected_terms.append("3")
        if self.term_6m_var.get(): selected_terms.append("6")
        if self.term_12m_var.get(): selected_terms.append("12")

        lease_terms_disp = ", ".join([f"{t}m" if t != "1" else "1 (M2M)" for t in selected_terms]) if selected_terms else "Any"

        layout_raw = self.layout_var.get()
        layout = layout_raw if layout_raw != "Any Layout" else None

        furn_raw = self.furnished_var.get()
        furnished = furn_raw.lower() if furn_raw != "Any Furnishing" else None

        no_agents = self.no_agents_var.get()
        pet_friendly = self.pets_var.get()
        auto_open = self.auto_open_var.get()

        payload = {
            "query": keyword,
            "search_query": keyword,
            "source_ids": source_ids,
            "user_id": "taun_test_user",
            "no_agents": no_agents,
            "rental_type": rental_type,
            "lease_term": selected_terms if selected_terms else None,
            "lease_terms": selected_terms,
            "auto_open_links": auto_open,
            "min_price": min_price,
            "max_price": max_price,
            "min_bedrooms": min_beds,
            "bathrooms": min_baths,
            "layout": layout,
            "property_sub_type": layout,
            "furnished": furnished,
            "pet_friendly": pet_friendly,
            "min_sqm": min_sqm
        }

        self.log_text(f"🎯 MISSION DISPATCHED: {keyword} @ {source_name}")
        self.log_text(f"   [FILTERS] NoAgents: {no_agents} | Terms: {lease_terms_disp} | Category: {self.rental_type_var.get()} | AutoOpen: {auto_open}")
        self.log_text(f"   [SPECS] Budget: R{min_price or 0}-R{max_price or 'Any'} | Beds: {beds_val} | Baths: {baths_val} | Pets: {pet_friendly}")

        def _post():
            success = False
            for attempt in range(15):
                try:
                    res = requests.post(
                        "http://127.0.0.1:8000/trigger-snipe", 
                        json=payload,
                        proxies={"http": None, "https": None},
                        timeout=30
                    )
                    if res.status_code == 200:
                        task_id = res.json().get("task_id", "N/A")
                        self.log_text(f"✅ MISSION ACTIVE: Local node executing task {task_id}")
                    else:
                        self.log_text(f"⚠️ Server returned status: {res.status_code}")
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

    def _set_keyword(self, text: str):
        self.keyword_entry.delete(0, "end")
        self.keyword_entry.insert(0, text)

    def quick_favourites(self):
        """One-click mission for My Favourites (Deep South only + Meadowridge, Bergvliet, Constantia, Hout Bay, Llandudno)."""
        self._set_keyword("My Favourites")
        self.source_var.set("Property24")
        self.manual_snipe()

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
                requests.post("http://127.0.0.1:8000/force-pulse", timeout=5)
                self.log_text("[SUCCESS] PULSE SIGNAL RECEIVED: Heartbeat commenced.")
            except: 
                self.log_text("[FAILED] FAILED: Is the server running?")
        
        threading.Thread(target=_kick, daemon=True).start()

    def run_prod_diag(self):
        self.log_text("🩺 Diagnostic Started...")
        threading.Thread(target=lambda: requests.post("http://127.0.0.1:8000/diag/proxy-check"), daemon=True).start()

    def stop_scraping(self):
        """Immediately aborts any active scraping mission."""
        self.log_text("🛑 ABORT: Requesting immediate halt to running scans...")
        def _abort():
            try:
                res = requests.post("http://127.0.0.1:8000/stop-scan", timeout=5)
                if res.status_code == 200:
                    self.log_text("🛑 SUCCESS: Scan cancellation acknowledged by server.")
                else:
                    self.log_text(f"⚠️ Abort signal returned status code {res.status_code}")
            except Exception as e:
                self.log_text(f"⚠️ Could not reach server to cancel scan: {e}")
        threading.Thread(target=_abort, daemon=True).start()

    def on_closing(self):
        """Ensures that shutting down the UI also terminates background processes."""
        if self.server_process is not None:
            self.toggle_server()
        self.destroy()

if __name__ == "__main__":
    app = SniperHub()
    app.mainloop()
