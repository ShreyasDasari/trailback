import httpx

async def trash_email(message_id: str, oauth_token: str) -> dict:
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}/trash",
                headers={"Authorization": f"Bearer {oauth_token}"}
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "message_id": data["id"],
                    "labels": data.get("labelIds", [])
                }
            else:
                return {
                    "success": False,
                    "error": f"Gmail API returned {response.status_code}: {response.text}"
                }
    except Exception as e:
        return {"success": False, "error": str(e)}