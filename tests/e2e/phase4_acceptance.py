import struct
import zlib
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "tests" / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)


def png(width: int, height: int):
    def chunk(kind: bytes, data: bytes):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    rows = b"".join(b"\x00" + b"\x77\x9d\x8d" * width for _ in range(height))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


POSTS = [{
    "id": index, "rating": "g", "tag_string": "sample_artist original 1girl highres",
    "tag_string_general": "original 1girl", "tag_string_artist": "sample_artist",
    "tag_string_copyright": "", "tag_string_character": "", "tag_string_meta": "highres",
    "score": 42, "up_score": 45, "down_score": 3, "fav_count": 12,
    "uploader_name": "release-test", "uploader_id": 1, "source": "", "image_width": 900,
    "image_height": 700, "file_size": 1024, "file_ext": "jpg",
    "preview_file_url": f"https://cdn.example/{index}.jpg", "large_file_url": f"https://cdn.example/{index}.jpg",
    "file_url": f"https://cdn.example/{index}.jpg", "md5": str(index),
    "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
    "parent_id": None, "has_children": False, "pool_ids": [], "is_pending": False,
    "is_flagged": False, "is_deleted": False,
} for index in range(1, 41)]


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errors = []
    api_attempts = 0
    image_requests = 0
    fail_api = True
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))

    def route(request_route):
        nonlocal_api = request_route.request.url
        global api_attempts, image_requests, fail_api
        if "/__image?" in nonlocal_api:
            image_requests += 1
            request_route.fulfill(status=200, content_type="image/png", body=png(900, 700))
        elif "/__api/danbooru/posts.json" in nonlocal_api:
            api_attempts += 1
            if fail_api:
                request_route.fulfill(status=503, body="Source unavailable")
            else:
                request_route.fulfill(json=POSTS)
        elif "/__api/" in nonlocal_api:
            request_route.fulfill(json=[])
        else:
            request_route.continue_()

    page.route("**/*", route)
    page.goto("http://127.0.0.1:5173/src/newtab/index.html")
    page.get_by_role("button", name="Try again").wait_for()
    assert page.locator(".toast--error").is_visible()
    assert api_attempts == 1, f"duplicate initial GET requests: {api_attempts}"
    fail_api = False
    page.get_by_role("button", name="Try again").click()
    page.locator(".post-card").first.wait_for()
    page.get_by_text("Connection restored").wait_for()
    assert page.locator(".toast--error").count() == 0
    page.locator(".post-card img").first.wait_for()
    page.wait_for_timeout(1500)
    page.wait_for_timeout(3000)
    page.screenshot(path=ARTIFACTS / "phase4-light.png", full_page=False)
    page.get_by_title("Theme: system").click()
    assert page.locator("html").get_attribute("data-theme") == "light"
    page.get_by_title("Theme: light").click()
    assert page.locator("html").get_attribute("data-theme") == "dark"
    page.screenshot(path=ARTIFACTS / "phase4-dark.png", full_page=False)
    page.wait_for_timeout(1000)
    first_image_count = image_requests
    assert first_image_count > 0
    cached_entries = page.evaluate("""async () => await new Promise((resolve) => {
      const request = indexedDB.open('danbooru-viewer-media');
      request.onsuccess = () => {
        const count = request.result.transaction('thumbnails').objectStore('thumbnails').count();
        count.onsuccess = () => resolve(count.result);
        count.onerror = () => resolve(-1);
      };
      request.onerror = () => resolve(-1);
    })""")
    assert cached_entries > 0, f"thumbnail cache is empty ({cached_entries})"
    page.reload()
    page.locator(".post-card").first.wait_for()
    page.locator(".post-card img").first.wait_for()
    page.wait_for_timeout(1000)
    rendered_sources = page.locator(".post-card img").evaluate_all("els => els.map(el => el.src)")
    assert rendered_sources and all(source.startswith("blob:") for source in rendered_sources), "visible thumbnails did not use cached blobs"
    assert image_requests - first_image_count <= max(4, first_image_count // 10), f"too many thumbnails bypassed cache ({first_image_count} -> {image_requests})"
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(250)
    assert page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth")
    page.screenshot(path=ARTIFACTS / "phase4-mobile-dark.png", full_page=False)
    unexpected_errors = [error for error in errors if "503 (Service Unavailable)" not in error]
    assert not unexpected_errors, "Browser errors: " + " | ".join(unexpected_errors)
    print("phase4 acceptance passed: retry, toast, request dedupe, dark theme, image cache, responsive layout")
    browser.close()
