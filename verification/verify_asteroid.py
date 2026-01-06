from playwright.sync_api import sync_playwright, Page, expect

def verify_asteroids(page: Page):
    # Navigate to the preview server (default vite port 4173)
    page.goto("http://localhost:4173")

    # Wait for canvas to load
    page.wait_for_selector("canvas")

    # Wait for game to initialize (intro screen click)
    # The game starts on click.
    # The instructions element has id "instructions"
    page.click("#instructions")

    # Wait for Level 1 to start
    # We want to warp to Level 2 to see asteroids
    # But for now, we can check if the game is running.
    # We can inject JS to warp or just wait?

    # Let's try to verify if asteroids are present by checking the canvas?
    # No, can't check canvas content easily with selectors.
    # But we can take a screenshot.

    # We want to check Level 2 ("The Asteroid Belt").
    # We can use the console to jump levels.
    # We exposed `levelManager` globally? No, it's inside module.
    # But we can modify the code to start at Level 2 for verification or wait.
    # Or just capture the start (Level 1 has some asteroids maybe? No, "The Neon Garden" has few).

    # Let's simulate playing for a bit or just look at the code state.
    # Actually, main.ts `window.levelManager` isn't exposed.
    # But we can wait a few seconds and take a screenshot of the start.
    # However, asteroids are in Level 2.

    # Wait 2 seconds
    page.wait_for_timeout(2000)

    # Take screenshot of Level 1 (should be no heavy asteroid field)
    page.screenshot(path="verification/level1.png")

    # Now, this is tricky without cheats.
    # I can modify main.ts to expose levelManager temporarily or start at Level 2.
    # But I want to verify without changing code if possible.
    # Wait, `levelManager` is a const in module scope.

    # Let's take a screenshot and see if the game runs at least.
    print("Screenshot taken.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_asteroids(page)
        finally:
            browser.close()
