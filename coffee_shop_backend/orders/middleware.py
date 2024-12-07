from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from urllib.parse import parse_qs
import logging

logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user(token_key):
    try:
        access_token = AccessToken(token_key)
        user = get_user_model().objects.get(id=access_token['user_id'])
        return user
    except Exception as e:
        logger.error(f"Token validation error: {str(e)}")
        return AnonymousUser()

class TokenAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        try:
            query_string = scope.get('query_string', b'').decode()
            query_params = parse_qs(query_string)
            token = query_params.get('token', [None])[0]
            
            # Allow public access for order tracking
            if 'order' in scope.get('path', ''):
                scope['user'] = AnonymousUser()
                return await super().__call__(scope, receive, send)
            
            # For other routes, require authentication
            if token:
                scope['user'] = await get_user(token)
            else:
                scope['user'] = AnonymousUser()
                
        except Exception as e:
            logger.error(f"Error in TokenAuthMiddleware: {str(e)}")
            scope['user'] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)

def TokenAuthMiddlewareStack(inner):
    return TokenAuthMiddleware(inner)
