# ZefoyTiktokBot SDK configuration


_shared_config = None


def shared_config():
    """Return the process-wide config, built once on first use.

    The SDK reads the config on every request and never writes to it, so one
    instance is shared by every client rather than rebuilt per client.

    The returned dict is shared: treat it as read-only. Callers that need to
    mutate should use make_config, which always returns a fresh copy.
    """
    global _shared_config
    if _shared_config is None:
        _shared_config = make_config()
    return _shared_config


def make_config():
    """Build a fresh, fully materialised config dict.

    Every call rebuilds the whole structure, so prefer shared_config unless
    you need a private copy you intend to mutate.
    """
    return {
        "main": {
            "name": "ZefoyTiktokBot",
            "slug": "zefoy-tiktok-bot",
            "version": "0.0.1",
            "target": "py",
        },
        "feature": {
            "test": {
        "options": {
          "active": False,
        },
        "transport": "base",
      },
        },
        "options": {
            "base": "https://zefoy.com",
            "auth": {
                "prefix": "",
            },
            "headers": {
        "content-type": "application/json",
      },
            "entity": {
                "engagement": {},
            },
        },
        "entity": {
      "engagement": {
        "fields": [
          {
            "name": "amount",
            "short": "The amount of engagement to acquire (if applicable)",
            "type": "`$INTEGER`",
          },
          {
            "name": "estimatedTime",
            "short": "Estimated time to complete in seconds",
            "type": "`$INTEGER`",
          },
          {
            "name": "message",
            "short": "Response message",
            "type": "`$STRING`",
          },
          {
            "name": "status",
            "short": "Current status of the boost request",
            "type": "`$STRING`",
          },
          {
            "name": "success",
            "short": "Indicates if the request was successful",
            "type": "`$BOOLEAN`",
          },
          {
            "name": "type",
            "op": {
              "create": {
                "req": True,
                "type": "`$STRING`",
              },
            },
            "short": "The type of engagement boosted",
            "type": "`$STRING`",
          },
          {
            "name": "url",
            "req": True,
            "short": "The TikTok video or profile URL to boost",
            "type": "`$STRING`",
          },
        ],
        "name": "engagement",
        "op": {
          "create": {
            "input": "data",
            "name": "create",
            "points": [
              {
                "args": {},
                "kind": "http",
                "method": "POST",
                "orig": "/api/boost",
                "parts": [
                  "api",
                  "boost",
                ],
                "select": {},
                "transform": {
                  "req": "`reqdata`",
                  "res": "`body`",
                },
              },
            ],
          },
        },
        "relations": {
          "ancestors": [],
        },
      },
    },
    }
