import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

client: AsyncIOMotorClient = None  # type: ignore
db: AsyncIOMotorDatabase = None  # type: ignore


async def connect_db() -> None:
    global client, db
    client = AsyncIOMotorClient(
        settings.mongodb_uri,
        tlsCAFile=certifi.where(),
    )
    db = client[settings.mongodb_db_name]
    # Verify connection
    await client.admin.command("ping")


async def close_db() -> None:
    global client
    if client:
        client.close()


def get_db() -> AsyncIOMotorDatabase:
    return db
