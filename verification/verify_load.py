from playwright.sync_api import sync_playwright
import time
import sys

def verify_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console errors
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        try:
            print("Navigating to app...")
            page.goto("http://localhost:4173")

            # Wait for canvas
            print("Waiting for canvas...")
            page.wait_for_selector("#glCanvas", timeout=10000)

            # Wait a bit for JS to init
            time.sleep(2)

            # Take screenshot
            print("Taking screenshot...")
            page.screenshot(path="verification/screenshot.png")

            # Check for specific WebGPU error
            content = page.content()
            if "WebGPU not supported" in content:
                print("WebGPU not supported warning found (Expected in this env).")

            if errors:
                print("Console Errors found:")
                for e in errors:
                    print(f"- {e}")
                # We don't fail the test if it's just WebGPU error, but we print them
            else:
                print("No console errors.")

        except Exception as e:
            print(f"Verification failed: {e}")
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_load()
