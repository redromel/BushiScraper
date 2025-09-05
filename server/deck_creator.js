import { url } from "inspector";
import { chromium } from "playwright";






export async function createDecklist(cardList, cardClass, deckName) {
    const browser = await chromium.launch({headless:  true});
    const page = await browser.newPage();

    await page.goto("https://decklog-en.bushiroad.com/create?c=6", {waitUntil: "domcontentloaded", timeout: 15000});

    const cookieDialog = page.locator('#CybotCookiebotDialog');

    if(cookieDialog.isVisible()){
        await page.getByRole("button", {name: "Allow All"}).click();
    }
}