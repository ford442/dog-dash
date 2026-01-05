
from playwright.sync_api import sync_playwright
import time

def verify_reentry():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.goto('http://localhost:4173')
        page.wait_for_timeout(5000)

        # Force click the center of the screen where the button is likely to be
        # or force click the instructions div
        page.locator('#instructions').click(force=True)

        page.wait_for_timeout(1000)

        # Press H
        page.keyboard.press('h')

        page.wait_for_timeout(2000)

        page.screenshot(path='verification/reentry_effect.png')
        browser.close()

if __name__ == '__main__':
    verify_reentry()
