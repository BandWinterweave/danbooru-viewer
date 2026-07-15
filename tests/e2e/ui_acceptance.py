import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright


def post(post_id: int):
    return {
        "id": post_id,
        "rating": "g",
        "tag_string": "sample_artist sample_character 1girl blue_sky highres",
        "tag_string_general": "1girl blue_sky",
        "tag_string_artist": "sample_artist",
        "tag_string_copyright": "sample_series",
        "tag_string_character": "sample_character",
        "tag_string_meta": "highres",
        "score": 120,
        "up_score": 125,
        "down_score": -5,
        "fav_count": 84,
        "uploader_name": "phase_one",
        "source": "https://example.com/source",
        "image_width": 1400,
        "image_height": 1800,
        "file_size": 3145728,
        "file_ext": "jpg",
        "preview_file_url": f"https://placehold.co/360x440/cedbd4/18302a?text=Post+{post_id}",
        "large_file_url": f"https://placehold.co/700x900/cedbd4/18302a?text=Post+{post_id}",
        "file_url": f"https://placehold.co/1400x1800/cedbd4/18302a?text=Post+{post_id}",
        "md5": f"mock{post_id}",
        "created_at": "2026-07-15T10:00:00Z",
        "updated_at": "2026-07-15T10:00:00Z",
        "parent_id": None,
        "has_children": False,
    }


artifact_dir = Path("tests/artifacts")
artifact_dir.mkdir(parents=True, exist_ok=True)
requests = []
console_errors = []

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)

    def route_api(route):
        requests.append(route.request.url)
        if "autocomplete.json" in route.request.url:
            body = [{"value": "1girl", "label": "1girl", "category": 0, "post_count": 8000000}]
        else:
            page_number = int(parse_qs(urlparse(route.request.url).query).get("page", ["1"])[0])
            offset = (page_number - 1) * 40
            body = [post(offset + index) for index in range(1, 41)]
        route.fulfill(status=200, content_type="application/json", body=json.dumps(body))

    page.route("https://danbooru.donmai.us/**", route_api)
    page.goto("http://127.0.0.1:5173/")
    page.wait_for_load_state("networkidle")
    assert page.url.endswith("/src/newtab/index.html")
    page.get_by_placeholder("Search tags, artists, characters...").fill("1girl")
    page.get_by_placeholder("Search tags, artists, characters...").press("Enter")
    assert page.get_by_placeholder("Search tags, artists, characters...").input_value() == ""
    assert page.get_by_title("Remove 1girl").is_visible()
    page.locator(".post-card").first.wait_for()
    assert page.locator(".post-card").count() >= 40
    first_card = page.locator(".post-card").first
    assert first_card.get_attribute("data-post-url").startswith("https://danbooru.donmai.us/posts/1?q=")
    assert first_card.locator("img").get_attribute("src").endswith("Post+1")
    first_card.hover()
    assert first_card.locator(".overlay-tag").count() >= 5
    page.screenshot(path=str(artifact_dir / "phase1-hover.png"), full_page=False)

    first_card.click()
    assert page.locator(".detail-panel.is-open").is_visible()
    assert page.locator(".detail-header h2", has_text="#1").is_visible()
    page.locator(".tag-group--artist .detail-tag").first.get_by_title("Include sample_artist").click()
    page.locator(".detail-panel .icon-button").click()
    page.get_by_title("Remove sample artist").click()
    page.get_by_title("General / Safe").click()
    assert page.get_by_text("Rating: Safe", exact=True).is_visible()

    page.locator(".load-sentinel").scroll_into_view_if_needed()
    page.wait_for_timeout(1200)
    assert any("page=2" in url for url in requests)
    page.screenshot(path=str(artifact_dir / "phase1-desktop.png"), full_page=False)

    page.set_viewport_size({"width": 390, "height": 844})
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(250)
    assert page.locator(".search-form").is_visible()
    assert page.locator(".post-grid").evaluate("el => getComputedStyle(el).gridTemplateColumns.split(' ').length") == 2
    page.screenshot(path=str(artifact_dir / "phase1-mobile.png"), full_page=False)

    print(json.dumps({
        "cards": page.locator(".post-card").count(),
        "api_requests": len(requests),
        "page_2_loaded": any("page=2" in url for url in requests),
        "console_errors": console_errors,
    }))
    browser.close()
