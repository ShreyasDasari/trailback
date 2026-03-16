import httpx

async def restore_revision(file_id: str, revision_id: str, oauth_token: str) -> dict:
    try:
        url = f"https://www.googleapis.com/drive/v3/files/{file_id}/revisions/{revision_id}"
        headers = {
            "Authorization": f"Bearer {oauth_token}",
            "Content-Type": "application/json"
        }
        body = {
            "published": False,
            "keepForever": True
        }

        async with httpx.AsyncClient() as client:
            response = await client.patch(url, headers=headers, json=body)

        if response.status_code != 200:
            return {
                "success": False,
                "error": f"Drive API returned {response.status_code}: {response.text}"
            }

        data = response.json()
        return {
            "success": True,
            "file_id": file_id,
            "revision_id": data.get("id", revision_id),
            "kind": data.get("kind")
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }