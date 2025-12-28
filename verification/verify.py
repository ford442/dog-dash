from playwright.sync_api import sync_playwright

def verify_game_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:4173")
            # Click instruction to start
            page.click("#instructions")
            # Wait for game to initialize
            page.wait_for_timeout(2000)
            # Take screenshot
            page.screenshot(path="verification/screenshot.png")
            print("Screenshot taken")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_game_load()
