import struct
import zlib
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "tests" / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)

def png(width: int, height: int):
    def chunk(kind: bytes, data: bytes):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    rows = b"".join(b"\x00" + b"\xb8\xc8\xc2" * width for _ in range(height))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")


PNG = png(900, 700)


def post(post_id: int):
    item = {
        "id": post_id, "rating": "g", "tag_string": "sample_artist original 1girl highres",
        "tag_string_general": "original 1girl", "tag_string_artist": "sample_artist",
        "tag_string_copyright": "", "tag_string_character": "", "tag_string_meta": "highres",
        "score": post_id % 100, "up_score": 10, "down_score": 0, "fav_count": 5,
        "uploader_name": "tester", "uploader_id": 55, "source": "https://x.com/example/status/1", "image_width": 900 + post_id % 4 * 300, "image_height": 700 + post_id % 5 * 360,
        "file_size": 2048, "file_ext": "jpg", "preview_file_url": f"https://cdn.example/{post_id}-preview.jpg",
        "large_file_url": f"https://cdn.example/{post_id}-large.jpg", "file_url": f"https://cdn.example/{post_id}.jpg",
        "md5": f"hash-{post_id}", "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
        "parent_id": None, "has_children": False, "pool_ids": [7] if post_id == 1000 else [], "is_pending": False, "is_flagged": False, "is_deleted": False,
    }
    if post_id % 1000 == 1:
        item.update({"file_ext": "zip", "file_url": f"https://cdn.example/{post_id}-frames.zip", "media_asset": {"duration": 2.5, "variants": [{"file_ext": "mp4", "url": f"https://cdn.example/{post_id}.mp4", "width": 720, "height": 720}]}})
    return item


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin="http://127.0.0.1:5173")
    page = context.new_page()
    unhandled_rejections = []
    page.expose_function("recordUnhandledRejection", lambda reason: unhandled_rejections.append(reason))
    page.add_init_script("window.addEventListener('unhandledrejection', event => window.recordUnhandledRejection(String(event.reason)))")
    errors = []
    downloads = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("download", lambda download: downloads.append(download.suggested_filename))

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

    copy_box = page.locator(".post-copy").first.bounding_box()
    select_box = page.locator(".post-select").first.bounding_box()
    assert copy_box and select_box and copy_box["x"] < select_box["x"]
    page.locator(".post-copy").first.click()
    page.get_by_label("Tags copied").wait_for()
    assert page.evaluate("navigator.clipboard.readText()") == "sample_artist, original, 1girl, highres"

    # A quick control click must not open the dwell tooltip.
    page.locator(".post-select").first.click()
    assert page.locator(".post-tooltip").count() == 0
    for index in range(1, 3):
        page.locator(".post-select").nth(index).click()
    assert page.locator(".batch-actions strong").inner_text() == "3"
    assert "selected" in page.locator(".batch-actions").inner_text()

    page.get_by_title("List layout").click()
    page.locator(".list-card-info").first.wait_for()
    image_box = page.locator(".post-image-link").first.bounding_box()
    info_box = page.locator(".list-card-info").first.bounding_box()
    assert image_box and info_box and image_box["x"] < info_box["x"]
    list_text = page.locator(".list-card-info").first.inner_text()
    assert "UPLOADER" in list_text.upper(), f"List information is incomplete: {list_text}"
    page.screenshot(path=ARTIFACTS / "phase3-list.png", full_page=False)

    page.get_by_title("Masonry layout").click()
    page.locator(".masonry-item").first.wait_for()
    masonry_heights = {round(item.bounding_box()["height"]) for item in page.locator(".masonry-item").all() if item.bounding_box()}
    assert len(masonry_heights) > 1, "Masonry cards still have a fixed height"
    page.screenshot(path=ARTIFACTS / "phase3-masonry.png", full_page=False)

    page.get_by_label("New quick tag").fill("phase3_tag")
    page.get_by_label("New quick tag").press("Enter")
    assert page.get_by_title("Remove phase3_tag").is_visible()
    page.reload()
    page.locator(".post-card").first.wait_for()
    assert page.get_by_title("Remove phase3_tag").is_visible(), "Quick tag was not persisted"
    page.get_by_title("Remove phase3_tag").click()
    assert page.get_by_title("Remove phase3_tag").count() == 0

    page.get_by_title("Grid layout").click()
    first_card = page.locator(".post-card").first
    first_card.hover(position={"x": 80, "y": 80})
    page.wait_for_timeout(1100)
    original_tag = page.locator(".tooltip-tag").filter(has_text="original")
    original_tag.hover()
    original_tag.get_by_title("Include original").click()
    assert page.locator(".filter-chip").filter(has_text="original").count() == 1
    assert page.locator(".detail-workspace.is-open").count() == 0

    page.mouse.move(1, 1)
    page.wait_for_timeout(200)
    page.locator(".post-image-link").first.click(force=True)
    assert page.locator(".detail-workspace.is-open").is_visible()
    assert page.locator(".post-information").get_by_text("Uploader", exact=True).is_visible()
    assert page.get_by_title("Open original post").get_attribute("href").startswith("https://danbooru.donmai.us/posts/")
    page.get_by_title("Close details").click()
    page.locator(".post-image-link").nth(1).click()
    assert page.locator(".detail-header h2").inner_text() == "#1001"
    page.locator(".detail-media-stage .media-placeholder").wait_for()
    page.get_by_title("Close details").click()
    page.locator(".post-image-link").first.click()
    with page.expect_download() as download_info:
        page.keyboard.press("d")
    assert download_info.value.suggested_filename.endswith(".jpg")
    viewer_image = page.locator(".detail-media-full")
    viewer_image.wait_for()
    before_zoom = viewer_image.get_attribute("style")
    page.mouse.move(720, 420)
    page.mouse.wheel(0, -700)
    page.wait_for_timeout(250)
    after_zoom = viewer_image.get_attribute("style")
    assert after_zoom != before_zoom, "Mouse wheel did not change detail media zoom"
    page.screenshot(path=ARTIFACTS / "phase3-desktop.png", full_page=True)
    page.keyboard.press("Escape")

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(300)
    page.screenshot(path=ARTIFACTS / "phase3-mobile.png", full_page=True)
    assert page.locator("body").evaluate("el => el.scrollWidth <= window.innerWidth")
    assert not unhandled_rejections, "Unhandled rejections: " + " | ".join(unhandled_rejections)
    assert not errors, "Browser errors: " + " | ".join(errors)
    print("phase3 acceptance passed: virtual grid, 3-item selection, detail media, download, responsive layout")
    browser.close()
