from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    media_responses = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: media_responses.append((response.status, response.headers.get("content-range"), response.headers.get("content-length"))) if "sample-" in response.url and response.url.endswith(".webm") else None)
    page.goto("http://127.0.0.1:5173/src/newtab/index.html")
    page.locator(".post-image-link").first.wait_for(timeout=30000)
    page.locator(".post-image-link").first.click()
    page.locator(".detail-workspace.is-open").wait_for()
    page.locator(".post-information").wait_for()
    page.locator(".detail-media-full").wait_for(timeout=30000)
    page.wait_for_function("document.querySelector('.detail-media-full')?.naturalWidth > 0", timeout=30000)
    page.get_by_title("Close details").click()
    page.get_by_placeholder("Search tags, artists, characters...").fill("filetype:zip animated")
    page.get_by_role("button", name="Search", exact=True).click()
    page.locator(".post-card video").first.wait_for(timeout=30000)
    page.locator(".post-card video").first.hover()
    try:
        page.wait_for_function("document.querySelector('.post-card video')?.readyState >= 2", timeout=30000)
    except Exception:
        state = page.locator(".post-card video").first.evaluate("video => ({readyState: video.readyState, networkState: video.networkState, error: video.error?.message, src: video.currentSrc})")
        raise AssertionError(f"Ugoira video failed to decode: {state}, responses={media_responses}")
    assert page.locator(".post-card video").first.evaluate("video => video.readyState >= 2")
    page.locator(".post-image-link").first.click()
    page.locator(".detail-media-stage video").wait_for(timeout=30000)
    page.get_by_title("Close details").click()
    page.keyboard.press("Control+Shift+C")
    page.get_by_role("button", name="Safebooru", exact=True).click()
    page.get_by_title("Explicit").click()
    page.locator(".state-panel").wait_for(timeout=30000)
    page.wait_for_function("!document.querySelector('.state-panel')?.innerText.includes('Reading the index')", timeout=30000)
    assert "Unexpected end of JSON input" not in page.locator("body").inner_text()
    safebooru_state = page.locator(".state-panel").inner_text()
    assert "No posts match this search" in safebooru_state, f"Safebooru explicit state: {safebooru_state}"
    assert not errors, "Browser errors: " + " | ".join(errors)
    page.screenshot(path=ROOT / "tests" / "artifacts" / "real-ugoira.png", full_page=False)
    print("real media smoke passed: Danbooru ugoira WebM variant loaded")
    browser.close()
