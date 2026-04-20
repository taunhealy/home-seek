
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
            # Use 'prime-session' to ensure a stable IP for the login process
            username = parsed.username + "-session-prime" if parsed.username else None
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
