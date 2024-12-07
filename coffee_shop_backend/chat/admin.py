from django.contrib import admin
from .models import ChatMessage

admin.site.site_header = "My Custom Admin Panel bmmas"
admin.site.site_title = "Admin Portal bmmas"
admin.site.index_title = "Welcome to My Admin Panel bmmas"

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('order', 'short_message', 'sender_type', 'timestamp', 'is_read')
    list_filter = ('sender_type', 'timestamp', 'is_read')
    search_fields = ('message', 'sender_type')

    def short_message(self, obj):
        return (obj.message[:50] + "...") if len(obj.message) > 50 else obj.message
    
    short_message.short_description = "Message"
