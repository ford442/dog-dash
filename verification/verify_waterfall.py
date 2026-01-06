
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the game (must be served)
        try:
            page.goto('http://localhost:4173')

            # Wait for game to load (canvas)
            page.wait_for_selector('#glCanvas')

            # Click instructions to start game
            page.click('#instructions')

            # Use console to jump to level 6 immediately
            # We access the internal state via 'window' if we exposed it,
            # OR we just simulate a very fast scroll or set the level manager.
            # Since we can't easily access the module scope variables unless we expose them...
            # We will rely on visual inspection of the first few seconds OR try to inject code.

            # Injection hack to set level
            page.evaluate("""
                // Assuming 'levelManager' is not globally exposed, we might be stuck.
                // But wait, the game is modular.
                // Let's try to expose it in main.ts first? No, too invasive.
                // Let's just wait and see if we can trigger it.
                // Actually, for verification, I should have exposed a cheat.

                // Since I can't jump, I will verify the build works and take a screenshot of the start.
                // But I really want to see the waterfall.
                // I'll take a screenshot of Level 1 first.
            """)

            time.sleep(2)
            page.screenshot(path='verification/level1.png')
            print('Screenshot Level 1 taken')

            # To see waterfalls, I need to reach 5200 distance.
            # I can try to speed up time?
            # Or I can patch main.ts temporarily to start at level 6.
        except Exception as e:
            print(f'Error: {e}')

        browser.close()

if __name__ == '__main__':
    run()
