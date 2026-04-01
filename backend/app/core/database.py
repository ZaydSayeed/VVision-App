import logging

import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

logger = logging.getLogger("vvision-api")

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

    # Log database details
    collections = await db.list_collection_names()
    logger.info(f"Database: {settings.mongodb_db_name}")
    logger.info(f"Collections: {collections}")

    # Ensure indexes for performance
    await db["users"].create_index("supabase_uid", unique=True)
    await db["patients"].create_index("link_code", unique=True)
    await db["people"].create_index("patient_id")
    await db["alerts"].create_index("patient_id")
    await db["help_alerts"].create_index("patient_id")
    await db["routines"].create_index("patient_id")
    await db["medications"].create_index("patient_id")
    logger.info("Indexes ensured")


async def close_db() -> None:
    global client
    if client:
        client.close()


def get_db() -> AsyncIOMotorDatabase:
    return db
