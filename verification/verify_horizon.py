from playwright.sync_api import sync_playwright, Page, expect

def verify_horizon(page: Page):
    # Enable console logging
    page.on("console", lambda msg: print(f"Console: {msg.text}"))

    # Go to local preview (Vite default port 4173)
    page.goto("http://localhost:4173")

    # Wait for canvas
    page.wait_for_selector("#glCanvas")

    # Wait for JS to load
    page.wait_for_timeout(4000)

    # Check if instructions are visible
    visible = page.is_visible("#instructions")
    print(f"Instructions visible: {visible}")

    # Force click via JS to be sure
    print("Clicking instructions via JS...")
    page.evaluate("document.getElementById('instructions').click()")

    # Wait for transition
    page.wait_for_timeout(2000)

    # Screenshot
    print("Taking screenshot...")
    page.screenshot(path="verification/level3_horizon.png")

    print("Level 3 screenshot taken")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_horizon(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
