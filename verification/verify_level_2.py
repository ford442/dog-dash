from playwright.sync_api import sync_playwright, Page, expect
import time

def verify_level_2(page: Page):
    page.goto("http://localhost:4173")
    page.wait_for_selector("#instructions")
    page.click("#instructions")

    # Wait a bit for game to start and level 2 to load
    page.wait_for_timeout(3000)

    # Take screenshot of Level 2
    page.screenshot(path="verification/level2_asteroids.png")

    # Check text
    level_text = page.locator("#level-display").inner_text()
    print(f"Level Text: {level_text}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_level_2(page)
        finally:
            browser.close()
