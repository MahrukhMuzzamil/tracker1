from django.contrib import admin
from .models import DailyTracker, Goal


class GoalInline(admin.TabularInline):
    model = Goal
    extra = 0


@admin.register(DailyTracker)
class DailyTrackerAdmin(admin.ModelAdmin):
    list_display = ('person', 'date', 'salah_count', 'quran_read', 'mood')
    list_filter = ('person', 'date')
    inlines = [GoalInline]


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ('text', 'done', 'tracker')
