import urllib.request
import os

img_dir = r"C:\Users\taunh\.gemini\antigravity\brain\fc7a2ac6-adaa-4204-817e-76af4011c6c7\scratch\hof_imgs"
os.makedirs(img_dir, exist_ok=True)

imgs = [
    ("img_1.jpg", "https://images.prop24.com/265417734/Ensure1280x720"),
    ("img_2.jpg", "https://images.prop24.com/366258645/Ensure960x540"),
    ("img_3.jpg", "https://images.prop24.com/366258647/Ensure960x540"),
    ("img_4.jpg", "https://images.prop24.com/376433656/Ensure960x540"),
    ("img_5.jpg", "https://images.prop24.com/366258655/Ensure960x540"),
    ("img_6.jpg", "https://images.prop24.com/366258653/Ensure960x540"),
]

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36'}
for name, u in imgs:
    path = os.path.join(img_dir, name)
    try:
        req = urllib.request.Request(u, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp, open(path, 'wb') as f:
            f.write(resp.read())
        print(f"Downloaded {name}: {os.path.getsize(path)} bytes")
    except Exception as e:
        print(f"Error {name}: {e}")

