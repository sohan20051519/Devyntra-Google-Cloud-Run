
import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto("http://localhost:3000/#/deploy/new")

        # Wait for the repo selection to be available
        await page.wait_for_selector('select')

        # Click the "Deploy Now" button
        await page.click('button:has-text("Deploy Now")')

        # Wait for the deployment progress to appear
        await page.wait_for_selector('text=Deployment Progress')

        # Take a screenshot of the deployment progress
        await page.screenshot(path="jules-scratch/verification/deployment_animation.png")

        await browser.close()

asyncio.run(main())
