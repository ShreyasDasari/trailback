import httpx

async def delete_message(channel: str, ts: str, bot_token: str) -> dict:
    try:
        url = "https://slack.com/api/chat.delete"
        headers = {
            "Authorization": f"Bearer {bot_token}",
            "Content-Type": "application/json"
        }
        body = {
            "channel": channel,
            "ts": ts
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=body)

        if response.status_code != 200:
            return {
                "success": False,
                "error": f"Slack API returned {response.status_code}: {response.text}"
            }

        data = response.json()

        # Handle Slack-specific error codes
        if not data.get("ok"):
            error_code = data.get("error", "unknown_error")

            if error_code == "msg_too_old":
                return {
                    "success": False,
                    "error": "This message is too old to delete. Slack only allows deletion within approximately 24 hours."
                }

            return {
                "success": False,
                "error": f"Slack error: {error_code}"
            }

        return {
            "success": True,
            "channel": channel,
            "ts": ts
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }