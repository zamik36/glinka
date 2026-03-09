from fastapi import Request


def get_real_ip(request: Request) -> str:
    """Return the real client IP, respecting X-Forwarded-For set by Caddy.

    The *last* entry is used because Caddy appends the real client IP at the
    end of the chain.  Using the first entry would allow spoofing by sending a
    crafted X-Forwarded-For header from the client.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"
