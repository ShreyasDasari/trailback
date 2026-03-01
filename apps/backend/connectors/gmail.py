from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

async def trash_email(message_id: str, oauth_token: str) -> dict:
    try:
        creds = Credentials(token=oauth_token)
        service = build('gmail', 'v1', credentials=creds)
        result = service.users().messages().trash(
            userId='me',
            id=message_id
        ).execute()
        return {
            "success": True,
            "message_id": result['id'],
            "labels": result.get('labelIds', [])
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }