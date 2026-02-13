from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('api/tracker/<str:person>/<str:date_str>/', views.get_tracker, name='get_tracker'),
    path('api/tracker/<str:person>/<str:date_str>/save/', views.save_tracker, name='save_tracker'),
    path('api/streaks/<str:person>/', views.get_streaks, name='get_streaks'),
    path('api/weekly/<str:person>/', views.get_weekly, name='get_weekly'),
    path('api/partner/<str:person>/', views.get_partner_summary, name='get_partner_summary'),
]
