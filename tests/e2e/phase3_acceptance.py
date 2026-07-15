import base64
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "tests" / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")


def post(post_id: int):
    return {
        "id": post_id, "rating": "g", "tag_string": "sample_artist original 1girl highres",
        "tag_string_general": "original 1girl", "tag_string_artist": "sample_artist",
        "tag_string_copyright": "", "tag_string_character": "", "tag_string_meta": "highres",
        "score": post_id % 100, "up_score": 10, "down_score": 0, "fav_count": 5,
        "uploader_name": "tester", "source": "", "image_width": 1200, "image_height": 1600,
        "file_size": 2048, "file_ext": "jpg", "preview_file_url": f"https://cdn.example/{post_id}-preview.jpg",
        "large_file_url": f"https://cdn.example/{post_id}-large.jpg", "file_url": f"https://cdn.example/{post_id}.jpg",
        "md5": f"hash-{post_id}", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
        "parent_id": None, "has_children": False, "pool_ids": [7] if post_id == 1000 else [],
    }


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))

    def route(request_route):
        url = request_route.request.url
        if "/__image?" in url:
            request_route.fulfill(status=200, content_type="image/png", body=PNG)
            return
        if "/__api/danbooru/" in url:
            parsed = urlparse(url)
            if parsed.path.endswith("/posts.json"):
                page_number = int(parse_qs(parsed.query).get("page", ["1"])[0])
                request_route.fulfill(json=[post(page_number * 1000 + i) for i in range(40)])
            elif parsed.path.endswith("/notes.json"):
                request_route.fulfill(json=[{"id": 1, "x": 100, "y": 120, "width": 240, "height": 100, "body": "Translated note", "is_active": True}])
            elif parsed.path.endswith("/related_tag.json"):
                request_route.fulfill(json={"related_tags": [["related_tag", 0], ["another_tag", 0]]})
            elif parsed.path.endswith("/pools.json"):
                request_route.fulfill(json=[{"id": 7, "name": "sample_pool", "post_count": 12}])
            elif "/posts/" in parsed.path:
                request_route.fulfill(json=post(999))
            else:
                request_route.fulfill(json=[])
            return
        request_route.continue_()

    page.route("**/*", route)
    page.goto("http://127.0.0.1:5173/src/newtab/index.html")
    page.wait_for_load_state("networkidle")
    page.locator(".post-card").first.wait_for()
    assert page.locator(".post-card").count() < 40, "PostGrid is not virtualized"

    for index in range(3):
        page.locator(".post-select").nth(index).click()
    assert page.locator(".batch-actions strong").inner_text() == "3"
    assert "selected" in page.locator(".batch-actions").inner_text()

    page.locator(".post-image-link").first.click()
    assert page.locator(".detail-panel.is-open").is_visible()
    page.locator("button[title='Open image viewer']").last.click()
    page.locator(".yarl__container").wait_for()
    page.keyboard.press("Control+Shift+S")
    page.wait_for_timeout(200)
    assert page.get_by_title("Pause").is_visible(), "Slideshow shortcut did not start playback"
    assert page.locator(".image-note").count() == 1
    with page.expect_download() as download_info:
        page.keyboard.press("d")
    assert download_info.value.suggested_filename.endswith(".jpg")
    page.screenshot(path=ARTIFACTS / "phase3-desktop.png", full_page=True)
    page.keyboard.press("Escape")

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(300)
    page.screenshot(path=ARTIFACTS / "phase3-mobile.png", full_page=True)
    assert page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth")
    assert not errors, "Browser errors: " + " | ".join(errors)
    print("phase3 acceptance passed: virtual grid, 3-item selection, detail, slideshow, notes, responsive layout")
    browser.close()
