import pytest

from app.services import omnisave_media
from app.services.omnisave_media import MediaMirrorPolicy, MediaPolicyError, mirror_media_item


class Scanner:
    def __init__(self, verdict="clean"):
        self.verdict = verdict

    async def scan(self, content, content_type):
        return self.verdict


class Store:
    def __init__(self):
        self.puts = []
        self.deletes = []

    async def put(self, key, content, content_type, metadata):
        self.puts.append((key, content, content_type, metadata))
        return f"stored://{key}"

    async def delete(self, key):
        self.deletes.append(key)


@pytest.mark.asyncio
async def test_mirroring_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("OMNISAVE_MEDIA_MIRROR_ENABLED", raising=False)
    result = await mirror_media_item(
        policy=MediaMirrorPolicy(),
        user_id="user-1",
        source_id="source-1",
        media_url="https://cdn.example.test/image.png",
        fetcher=lambda url: None,
        scanner=None,
        store=None,
    )
    assert result.status == "disabled"


def test_policy_rejects_private_resolved_addresses():
    policy = MediaMirrorPolicy()
    with pytest.raises(MediaPolicyError, match="media_private_address_blocked"):
        policy.validate_resolved_addresses("internal.example", ["10.0.0.8"])


def test_policy_rejects_non_image_content_and_large_body():
    policy = MediaMirrorPolicy(max_bytes=4)
    with pytest.raises(MediaPolicyError, match="media_content_type_blocked"):
        policy.validate_response("text/html", 2, b"ok")
    with pytest.raises(MediaPolicyError, match="media_body_size_exceeded"):
        policy.validate_response("image/png", None, b"12345")


@pytest.mark.asyncio
async def test_mirroring_requires_scanner_and_store(monkeypatch):
    monkeypatch.setenv("OMNISAVE_MEDIA_MIRROR_ENABLED", "true")
    with pytest.raises(MediaPolicyError, match="media_mirror_dependencies_required"):
        await mirror_media_item(
            policy=MediaMirrorPolicy(),
            user_id="user-1",
            source_id="source-1",
            media_url="https://cdn.example.test/image.png",
            fetcher=lambda url: None,
            scanner=None,
            store=None,
            retention_days=30,
        )


@pytest.mark.asyncio
async def test_mirroring_requires_clean_scan_and_stores_bounded_object(monkeypatch):
    monkeypatch.setenv("OMNISAVE_MEDIA_MIRROR_ENABLED", "true")
    monkeypatch.setattr(omnisave_media, "resolve_public_addresses", lambda host: ["93.184.216.34"])
    store = Store()

    async def fetcher(url):
        assert url == "https://cdn.example.test/image.png"
        return b"image-bytes", "image/png; charset=binary"

    result = await mirror_media_item(
        policy=MediaMirrorPolicy(),
        user_id="user-1",
        source_id="source-1",
        media_url="https://cdn.example.test/image.png#fragment",
        fetcher=fetcher,
        scanner=Scanner(),
        store=store,
        retention_days=30,
    )
    assert result.status == "mirrored"
    assert result.content_type == "image/png"
    assert result.bytes_stored == 11
    assert store.puts[0][0].startswith("omnisave/user-1/source-1/")

    with pytest.raises(MediaPolicyError, match="media_malware_scan_blocked"):
        await mirror_media_item(
            policy=MediaMirrorPolicy(),
            user_id="user-1",
            source_id="source-2",
            media_url="https://cdn.example.test/image.png",
            fetcher=fetcher,
            scanner=Scanner("infected"),
            store=store,
            retention_days=30,
        )


@pytest.mark.asyncio
async def test_delete_only_allows_owned_object_key_prefix():
    store = Store()
    await omnisave_media.delete_mirrored_media(store=store, key="omnisave/user-1/source-1/object")
    assert store.deletes == ["omnisave/user-1/source-1/object"]
    with pytest.raises(MediaPolicyError, match="media_object_key_invalid"):
        await omnisave_media.delete_mirrored_media(store=store, key="other/object")
