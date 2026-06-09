from functools import lru_cache

from supabase import Client, ClientOptions, create_client

from app.config import get_settings


def get_supabase_auth() -> Client:
    """Create a stateless client for user-facing Supabase Auth operations."""
    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured."
        )

    return create_client(
        settings.supabase_url,
        settings.supabase_publishable_key,
        options=ClientOptions(
            auto_refresh_token=False,
            persist_session=False,
        ),
    )


@lru_cache
def get_supabase() -> Client:
    """Create the privileged server-side client when it is first requested."""
    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured."
        )

    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
