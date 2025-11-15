#!/usr/bin/env python3
"""
Vygil FastAPI Backend - Video Intelligence API

Provides endpoints for video intelligence (TwelveLabs) and shopping lookup.
"""

import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("vygil-api")

# Pydantic models for API requests/responses
class HealthResponse(BaseModel):
    status: str
    timestamp: str

# Shopping / Browser-Use models
class ShoppingProduct(BaseModel):
    product_name: str
    brand: Optional[str] = None
    description: Optional[str] = None

class ShoppingRequest(BaseModel):
    products: List[ShoppingProduct]
    affiliate_tag: Optional[str] = None

class ShoppingItem(BaseModel):
    key: str
    title: Optional[str] = None
    url: Optional[str] = None
    affiliate_url: Optional[str] = None
    price: Optional[str] = None
    image: Optional[str] = None
    alternatives: Optional[List[Dict[str, Any]]] = None
    retailer: Optional[str] = None
    domain: Optional[str] = None

class ShoppingResponse(BaseModel):
    success: bool
    results: Dict[str, ShoppingItem]
    message: Optional[str] = None

app = FastAPI(
    title="Vygil Video Intelligence API",
    description="Video understanding and shopping enrichment backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TwelveLabs and shopping configuration
TWELVELABS_API_KEY = os.getenv("TWELVELABS_API_KEY")
TWELVELABS_INDEX_ID = os.getenv("TWELVELABS_INDEX_ID")
TWELVELABS_BASE_URL = os.getenv("TWELVELABS_API_BASE_URL", "https://api.twelvelabs.io/v1.3")
AMAZON_ASSOC_TAG = os.getenv("AMAZON_ASSOCIATES_TAG")
BROWSER_USE_API_KEY = os.getenv("BROWSER_USE_API_KEY")

@app.get("/health", response_model=HealthResponse)
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Basic health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
    )


@app.get("/api/agents")
async def get_agents():
    """Return a single logical agent representing Video Intelligence.

    This keeps older frontends that expect /api/agents working,
    but only advertises the video intelligence experience.
    """
    return {
        "agents": [
            {
                "id": "vygil-video-intelligence",
                "name": "Video Intelligence",
                "description": "AI-powered product detection in videos",
                "features": [
                    "Timeline product detection",
                    "Local video playback",
                    "Shopping link enrichment",
                ],
            }
        ]
    }


@app.get("/api/stats")
async def get_stats():
    """Compatibility stub for legacy activity stats.

    Returns a neutral payload so existing dashboards don't error,
    even though we no longer track screen activities.
    """
    return {
        "total_activities": 0,
        "average_confidence": 0.0,
        "session_start": None,
    }

@app.get("/api/videos")
async def list_videos():
    """List videos available for analysis.

    Prefers TwelveLabs index when credentials are present, but gracefully
    falls back to local files in the ./videos directory so the UI always
    has something to show.
    """
    # If TwelveLabs is configured, try to use it first
    if TWELVELABS_API_KEY and TWELVELABS_INDEX_ID:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{TWELVELABS_BASE_URL}/indexes/{TWELVELABS_INDEX_ID}/videos?page_limit=50",
                    headers={"x-api-key": TWELVELABS_API_KEY},
                )
                response.raise_for_status()
                data = response.json()

                videos = data.get("data", [])
                for video in videos:
                    filename = video.get("system_metadata", {}).get("filename")
                    if filename:
                        video["local_url"] = f"http://0.0.0.0:8000/videos/{filename}"

                if videos:
                    return {"success": True, "data": videos}
        except Exception as e:
            logger.warning(f"TwelveLabs video listing failed, falling back to local files: {e}")

    # Fallback: list local files from ./videos
    videos_dir = os.path.join(os.path.dirname(__file__), "..", "videos")
    items = []
    if os.path.isdir(videos_dir):
        for name in sorted(os.listdir(videos_dir)):
            path = os.path.join(videos_dir, name)
            if not os.path.isfile(path):
                continue
            items.append(
                {
                    "_id": name,  # use filename as id
                    "system_metadata": {
                        "filename": name,
                        "video_title": os.path.splitext(name)[0],
                    },
                    "hls": None,
                    "local_url": f"http://0.0.0.0:8000/videos/{name}",
                }
            )

    return {"success": True, "data": items}


@app.get("/api/videos/{video_id}")
async def get_video(video_id: str):
    """Get single video details.

    If TwelveLabs is configured, fetch from the index; otherwise
    synthesize a minimal record for a local file named `video_id`.
    """
    if TWELVELABS_API_KEY and TWELVELABS_INDEX_ID:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{TWELVELABS_BASE_URL}/indexes/{TWELVELABS_INDEX_ID}/videos/{video_id}",
                    headers={"x-api-key": TWELVELABS_API_KEY},
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.warning(f"TwelveLabs get_video failed for {video_id}, falling back to local: {e}")

    # Local fallback
    videos_dir = os.path.join(os.path.dirname(__file__), "..", "videos")
    path = os.path.join(videos_dir, video_id)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Video not found")

    return {
        "_id": video_id,
        "system_metadata": {
            "filename": video_id,
            "video_title": os.path.splitext(video_id)[0],
        },
        "hls": None,
        "local_url": f"http://0.0.0.0:8000/videos/{video_id}",
    }


@app.get("/api/videos/{video_id}/products")
async def get_products(video_id: str, force: bool = False):
    """Get products for a video.

    When TwelveLabs is configured, uses its `analyze` endpoint and caches
    results in the video metadata. If not, returns an empty product list
    so the UI still works with local-only videos.
    """
    if not (TWELVELABS_API_KEY and TWELVELABS_INDEX_ID):
        # Local-only mode: no video understanding available
        return {"success": True, "products": [], "cached": True}

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # Check if already analyzed (unless force=true)
            if not force:
                video_response = await client.get(
                    f"{TWELVELABS_BASE_URL}/indexes/{TWELVELABS_INDEX_ID}/videos/{video_id}",
                    headers={"x-api-key": TWELVELABS_API_KEY},
                )
                if video_response.status_code == 200:
                    video_data = video_response.json()
                    if video_data.get("user_metadata", {}).get("products"):
                        products = video_data["user_metadata"]["products"]
                        # Handle if stored as string
                        if isinstance(products, str):
                            import json as _json

                            products = _json.loads(products)
                        logger.info(f"Returning cached products for video {video_id}")
                        return {"success": True, "products": products, "cached": True}

            # Need to analyze
            logger.info(f"Analyzing video {video_id}...")

            prompt = """List all products shown in the video:

- timeline: [start_seconds, end_seconds]
- brand: brand name
- product_name: full name
- location: [x%, y%, width%, height%] as percentages (0-100)
- price: price if visible or mentioned
- description: what's shown/said about it

Return ONLY a JSON array, no markdown:
[{\"timeline\": [0, 10], \"brand\": \"Nike\", \"product_name\": \"Air Max\", \"location\": [20, 30, 15, 15], \"price\": \"$120\", \"description\": \"Running shoe\"}]"""

            analyze_response = await client.post(
                f"{TWELVELABS_BASE_URL}/analyze",
                headers={"x-api-key": TWELVELABS_API_KEY},
                json={"video_id": video_id, "prompt": prompt, "stream": False},
                timeout=120.0,
            )
            analyze_response.raise_for_status()

            analyze_data = analyze_response.json()
            raw_products = analyze_data.get("data", "[]")

            import json as _json

            # TwelveLabs may return either:
            # - a JSON array directly, or
            # - a stringified JSON array. Handle both.
            if isinstance(raw_products, list):
                products = raw_products
            elif isinstance(raw_products, str):
                s = raw_products.strip()
                if not s:
                    products = []
                else:
                    try:
                        products = _json.loads(s)
                    except Exception as parse_err:
                        logger.warning(f"Failed to parse products JSON from analyze() response: {parse_err}; raw={s!r}")
                        products = []
            else:
                logger.warning(f"Unexpected analyze() data format: {type(raw_products)}")
                products = []

            logger.info(f"Analysis complete: {len(products)} products found")

            # Save to metadata only when we have actual products.
            # When products is empty (e.g. model couldn't identify items),
            # skip the write to avoid noisy 400s from TwelveLabs.
            if products:
                try:
                    await client.put(
                        f"{TWELVELABS_BASE_URL}/indexes/{TWELVELABS_INDEX_ID}/videos/{video_id}",
                        headers={"x-api-key": TWELVELABS_API_KEY},
                        json={
                            "user_metadata": {
                                "products": products,
                                "analyzed_at": datetime.now().isoformat(),
                            }
                        },
                    )
                except Exception as put_err:
                    logger.warning(f"Failed to persist products metadata for {video_id}: {put_err}")

            return {"success": True, "products": products, "cached": False}

    except Exception as e:
        # In demo/dev mode we prefer to fail soft: log the issue but
        # still return a valid response so the UI keeps working.
        logger.error(f"Product analysis failed: {e}")
        return {
            "success": True,
            "products": [],
            "cached": False,
            "message": "Video analysis is currently unavailable or timed out. Showing an empty product list.",
        }


# Serve local video files
videos_path = os.path.join(os.path.dirname(__file__), '..', 'videos')
if os.path.exists(videos_path):
    app.mount("/videos", StaticFiles(directory=videos_path), name="videos")
    logger.info(f"Serving videos from: {videos_path}")


# ============= SHOPPING LOOKUP (BROWSER-USE) =============

def _make_product_key(brand: Optional[str], name: str) -> str:
    """Stable dict key for a product, deduping brand from name if already included."""
    name_s = (name or "").strip()
    b = (brand or "").strip()
    if b.lower() == "unknown":
        b = ""
    if b and b.lower() in name_s.lower():
        return name_s.lower()
    return f"{(b + ' ' + name_s).strip()}".lower()


def _dedup_query(brand: Optional[str], name: str) -> str:
    """Human-facing search query: include brand only if not already in name (preserve casing)."""
    name_s = (name or "").strip()
    b = (brand or "").strip()
    if not b or b.lower() == "unknown":
        return name_s
    if b.lower() in name_s.lower():
        return name_s
    return f"{b} {name_s}".strip()


async def _browser_use_lookup(query: str) -> Dict[str, Any]:
    """Use browser_use Agent to find product info.
    Returns a dict with keys: title, url, price, image, alternatives (list).
    """
    try:
        # Newer browser_use versions expose Agent and Browser directly,
        # and no longer provide BrowserConfig.
        from browser_use import Agent, Browser  # type: ignore
        from browser_use.agent.views import AgentHistoryList  # type: ignore
    except Exception as e:
        raise RuntimeError(f"browser_use not available: {e}")

    # Allow passing API key via environment for cloud/browser-use services if needed
    if BROWSER_USE_API_KEY:
        os.environ["BROWSER_USE_API_KEY"] = BROWSER_USE_API_KEY

    # BrowserSession / Browser can be created without an explicit config;
    # defaults are taken from the browser_use CONFIG.
    browser = Browser()
    task = f"""
    Search online for the best match for: {query}.
    Steps:
    1. Go to Google and search for \"{query} Amazon\".
    2. Click the first Amazon product link.
    3. Extract and return JSON only with keys: title, url, price, image.
       Example: {{"title":"...","url":"https://...","price":"$...","image":"https://..."}}
    4. Also find up to 2 cheaper alternative retailers (non-Amazon) and return them in a JSON array field `alternatives`,
       each item with keys: title, url, price.
    Return only a single JSON object.
    """

    # Newer Agent signature expects task as the first parameter;
    # we also pass the Browser instance so it can reuse the session.
    agent = Agent(task=task, browser=browser)
    history: AgentHistoryList = await agent.run()

    # Try to recover a JSON blob from the agent history.
    # Prefer any extracted_content on the last successful action.
    raw_text: Optional[str] = None
    try:
        for h in reversed(history.history):
            res = getattr(h, "result", None)
            if res is not None and getattr(res, "extracted_content", None):
                raw_text = res.extracted_content  # type: ignore[attr-defined]
                break
    except Exception:
        raw_text = None

    if raw_text is None:
        # Fallback to string representation of the history object.
        raw_text = str(history)

    # Normalize to dict by extracting the first JSON object found.
    try:
        import json as _json, re as _re
        m = _re.search(r"\{[\s\S]*\}", raw_text)
        data = _json.loads(m.group(0)) if m else {}
    except Exception:
        data = {}

    if not isinstance(data, dict):
        data = {}

    # Ensure expected fields exist
    data.setdefault("title", None)
    data.setdefault("url", None)
    data.setdefault("price", None)
    data.setdefault("image", None)
    if not isinstance(data.get("alternatives"), list):
        data["alternatives"] = []

    return data


def _with_affiliate(url: Optional[str], tag: Optional[str]) -> Optional[str]:
    """Append or replace Amazon Associates tag for Amazon URLs only.
    - Leaves non-Amazon URLs unchanged
    - Replaces existing tag if present
    - Preserves other query params and fragments
    """
    if not url or not tag:
        return url
    try:
        from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
        parts = urlparse(url)
        host = (parts.hostname or '').lower()
        if not host or 'amazon.' not in host:
            # Do not append tag to non-Amazon URLs (also skip amzn.to shortener)
            return url
        if host == 'amzn.to':
            return url
        qs = dict(parse_qsl(parts.query, keep_blank_values=True))
        qs['tag'] = tag
        new_query = urlencode(qs, doseq=True)
        return urlunparse((parts.scheme, parts.netloc, parts.path, parts.params, new_query, parts.fragment))
    except Exception:
        # Fallback: conservative behavior, return original
        return url


def _parse_price_value(price: Optional[str]) -> Optional[float]:
    """Extract a numeric price from a string like "$9.50" or "9,999.00" or "$12.99 - $14.99".
    Returns None if no numeric portion is found."""
    if not price or not isinstance(price, str):
        return None
    import re
    s = price.strip()
    # If a range like "$12.99 - $14.99", take the minimum
    parts = re.split(r"\s*[-–]\s*", s)
    candidates = []
    for p in parts:
        m = re.search(r"(\d{1,3}(?:[\s,]\d{3})*(?:\.\d+)?|\d+\.\d+|\d+)", p)
        if not m:
            continue
        num = m.group(1)
        num = num.replace(",", "").replace(" ", "")
        try:
            candidates.append(float(num))
        except Exception:
            pass
    if not candidates:
        return None
    return min(candidates)


def _rank_alternatives(alts: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    if not isinstance(alts, list):
        return []
    ranked = []
    for a in alts:
        if not isinstance(a, dict):
            continue
        price_num = _parse_price_value(a.get("price"))
        a = {**a, "price_num": price_num}
        ranked.append(a)
    # Sort by price_num (None -> at end)
    ranked.sort(key=lambda x: (float('inf') if x.get('price_num') is None else x['price_num']))
    # Mark the first with a valid price as cheapest
    for r in ranked:
        if r.get('price_num') is not None:
            r['cheapest'] = True
            break
    return ranked


def _infer_domain_retailer(url: Optional[str]) -> Dict[str, Optional[str]]:
    if not url:
        return {"domain": None, "retailer": None}
    try:
        from urllib.parse import urlparse
        host = urlparse(url).hostname or ''
        host = host.lower()
        # Normalize to second-level domain
        parts = host.split('.')
        domain = host
        if len(parts) >= 2:
            domain = '.'.join(parts[-2:])
        retailer_map = {
            'amazon.com': 'Amazon', 'amazon.co.uk': 'Amazon', 'amazon.ca': 'Amazon',
            'walmart.com': 'Walmart',
            'target.com': 'Target',
            'bestbuy.com': 'Best Buy',
            'ebay.com': 'eBay',
            'homedepot.com': 'Home Depot',
            'lowes.com': "Lowe's",
            'aliexpress.com': 'AliExpress',
            'newegg.com': 'Newegg',
            'costco.com': 'Costco',
            'bhphotovideo.com': 'B&H',
        }
        retailer = retailer_map.get(domain, domain)
        return {"domain": domain, "retailer": retailer}
    except Exception:
        return {"domain": None, "retailer": None}


@app.post("/api/shopping/lookup", response_model=ShoppingResponse)
async def shopping_lookup(req: ShoppingRequest):
    """Enrich detected products with links/prices/alternatives using Browser Use.
    Gracefully falls back to Amazon search links if enrichment fails.
    """
    affiliate_tag = req.affiliate_tag or AMAZON_ASSOC_TAG
    results: Dict[str, ShoppingItem] = {}

    for p in req.products:
        key = _make_product_key(p.brand, p.product_name)
        query = _dedup_query(p.brand, p.product_name)

        enriched: Dict[str, Any] = {}
        try:
            enriched = await _browser_use_lookup(query)
        except Exception as e:
            logger.warning(f"Browser-Use lookup failed for '{query}': {e}. Falling back to Amazon search.")
            # Fallback minimal result using Amazon search URL
            from urllib.parse import quote_plus as _qp
            search_url = f"https://www.amazon.com/s?k={_qp(query)}"
            enriched = {
                "title": p.product_name,
                "url": search_url,
                "price": None,
                "image": None,
                # Provide retailer search alternatives so UI can show a comparison table
                "alternatives": [
                    {"title": p.product_name, "url": f"https://www.walmart.com/search?q={_qp(query)}", "price": None},
                    {"title": p.product_name, "url": f"https://www.target.com/s?searchTerm={_qp(query)}", "price": None},
                    {"title": p.product_name, "url": f"https://www.bestbuy.com/site/searchpage.jsp?st={_qp(query)}", "price": None}
                ]
            }

        affiliate_url = _with_affiliate(enriched.get("url"), affiliate_tag)
        # Rank and annotate alternatives
        ranked_alts = _rank_alternatives(enriched.get("alternatives") or [])
        for a in ranked_alts:
            dr = _infer_domain_retailer(a.get('url'))
            a['domain'] = dr.get('domain')
            a['retailer'] = dr.get('retailer')
            a_aff = _with_affiliate(a.get('url'), affiliate_tag)
            if a_aff != a.get('url'):
                a['affiliate_url'] = a_aff

        # Annotate primary
        prim_dr = _infer_domain_retailer(enriched.get("url"))
        results[key] = ShoppingItem(
            key=key,
            title=enriched.get("title"),
            url=enriched.get("url"),
            affiliate_url=affiliate_url,
            price=enriched.get("price"),
            image=enriched.get("image"),
            alternatives=ranked_alts,
            retailer=prim_dr.get('retailer'),
            domain=prim_dr.get('domain')
        )

    return ShoppingResponse(success=True, results=results)

# Serve static frontend files (for production)
if os.path.exists("../frontend/dist"):
    app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")

def main():
    """Run the FastAPI server"""
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()
