import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..core.database import get_db

router = APIRouter(prefix="/stream", tags=["stream"])


@router.get("/events")
async def sse_stream():
    """
    Server-Sent Events endpoint.

    Polls MongoDB for changes every 3 seconds and pushes update
    notifications to connected clients.
    """

    async def event_generator():
        last_check = ""
        while True:
            await asyncio.sleep(3)
            try:
                db = get_db()
                latest = await db["people"].find_one(
                    {"last_seen": {"$ne": None}},
                    {"last_seen": 1},
                    sort=[("last_seen", -1)],
                )
                current = latest["last_seen"] if latest else ""
                if current != last_check:
                    last_check = current
                    payload = json.dumps({"type": "update", "ts": current})
                    yield f"data: {payload}\n\n"
            except Exception:
                pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
