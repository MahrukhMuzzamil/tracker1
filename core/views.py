import json
from datetime import date, timedelta
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .models import DailyTracker, Goal


def home(request):
    """Render the main tracker page."""
    return render(request, 'tracker.html')


@require_http_methods(["GET"])
def get_tracker(request, person, date_str):
    """Get tracker data for a specific person and date."""
    try:
        tracker = DailyTracker.objects.get(person=person, date=date_str)
        goals = list(tracker.goals.values('id', 'text', 'done', 'order'))
        data = {
            'id': tracker.id,
            'person': tracker.person,
            'date': str(tracker.date),
            'salah': {
                'fajr': tracker.fajr,
                'dhuhr': tracker.dhuhr,
                'asr': tracker.asr,
                'maghrib': tracker.maghrib,
                'isha': tracker.isha,
                'tahajjud': tracker.tahajjud,
            },
            'quran': {
                'read': tracker.quran_read,
                'pages': tracker.quran_pages,
                'surah': tracker.quran_surah,
            },
            'habits': {
                'exercise': tracker.exercise,
                'no_junk_food': tracker.no_junk_food,
                'wake_early': tracker.wake_early,
                'dua_after_salah': tracker.dua_after_salah,
                'dhikr': tracker.dhikr,
                'sadaqah': tracker.sadaqah,
                'water': tracker.water,
                'sleep_hours': tracker.sleep_hours,
            },
            'goals': goals,
            'mood': tracker.mood,
            'notes': tracker.notes,
        }
        return JsonResponse(data)
    except DailyTracker.DoesNotExist:
        return JsonResponse({
            'person': person,
            'date': date_str,
            'salah': {'fajr': False, 'dhuhr': False, 'asr': False, 'maghrib': False, 'isha': False, 'tahajjud': False},
            'quran': {'read': False, 'pages': 0, 'surah': ''},
            'habits': {'exercise': False, 'no_junk_food': False, 'wake_early': False,
                       'dua_after_salah': False, 'dhikr': False, 'sadaqah': False,
                       'water': 0, 'sleep_hours': 0},
            'goals': [],
            'mood': 3,
            'notes': '',
        })


@csrf_exempt
@require_http_methods(["POST"])
def save_tracker(request, person, date_str):
    """Save tracker data for a specific person and date."""
    try:
        body = json.loads(request.body)
        salah = body.get('salah', {})
        quran = body.get('quran', {})
        habits = body.get('habits', {})

        tracker, created = DailyTracker.objects.update_or_create(
            person=person,
            date=date_str,
            defaults={
                'fajr': salah.get('fajr', False),
                'dhuhr': salah.get('dhuhr', False),
                'asr': salah.get('asr', False),
                'maghrib': salah.get('maghrib', False),
                'isha': salah.get('isha', False),
                'tahajjud': salah.get('tahajjud', False),
                'quran_read': quran.get('read', False),
                'quran_pages': quran.get('pages', 0),
                'quran_surah': quran.get('surah', ''),
                'exercise': habits.get('exercise', False),
                'no_junk_food': habits.get('no_junk_food', False),
                'wake_early': habits.get('wake_early', False),
                'dua_after_salah': habits.get('dua_after_salah', False),
                'dhikr': habits.get('dhikr', False),
                'sadaqah': habits.get('sadaqah', False),
                'water': habits.get('water', 0),
                'sleep_hours': habits.get('sleep_hours', 0),
                'mood': body.get('mood', 3),
                'notes': body.get('notes', ''),
            }
        )

        # Handle goals
        tracker.goals.all().delete()
        for i, goal in enumerate(body.get('goals', [])):
            Goal.objects.create(
                tracker=tracker,
                text=goal.get('text', ''),
                done=goal.get('done', False),
                order=i,
            )

        return JsonResponse({'success': True, 'id': tracker.id})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)


@require_http_methods(["GET"])
def get_streaks(request, person):
    """Calculate streaks for a specific person."""
    today = date.today()
    trackers = DailyTracker.objects.filter(person=person).order_by('-date')

    salah_streak = 0
    quran_streak = 0
    exercise_streak = 0
    total_days = trackers.count()

    # Calculate streaks by checking consecutive days
    check_date = today
    for t in trackers:
        if t.date > check_date:
            continue
        if t.date < check_date:
            break
        if t.all_salah:
            salah_streak += 1
        else:
            break
        check_date -= timedelta(days=1)

    check_date = today
    for t in trackers:
        if t.date > check_date:
            continue
        if t.date < check_date:
            break
        if t.quran_read:
            quran_streak += 1
        else:
            break
        check_date -= timedelta(days=1)

    check_date = today
    for t in trackers:
        if t.date > check_date:
            continue
        if t.date < check_date:
            break
        if t.exercise:
            exercise_streak += 1
        else:
            break
        check_date -= timedelta(days=1)

    return JsonResponse({
        'salahStreak': salah_streak,
        'quranStreak': quran_streak,
        'exerciseStreak': exercise_streak,
        'totalDaysTracked': total_days,
    })


@require_http_methods(["GET"])
def get_weekly(request, person):
    """Get weekly overview for a specific person."""
    today = date.today()
    week_data = []

    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_name = d.strftime('%a')
        date_str = str(d)

        try:
            t = DailyTracker.objects.get(person=person, date=d)
            week_data.append({
                'date': date_str,
                'day': day_name,
                'salahCount': t.salah_count,
                'habitCount': t.habit_count,
                'quran': t.quran_read,
                'mood': t.mood,
            })
        except DailyTracker.DoesNotExist:
            week_data.append({
                'date': date_str,
                'day': day_name,
                'salahCount': 0,
                'habitCount': 0,
                'quran': False,
                'mood': 0,
            })

    return JsonResponse(week_data, safe=False)


@require_http_methods(["GET"])
def get_partner_summary(request, person):
    """Get a quick summary of the partner's today data."""
    partner = 'mahrukh' if person == 'sajeel' else 'sajeel'
    today = date.today()

    try:
        t = DailyTracker.objects.get(person=partner, date=today)
        return JsonResponse({
            'partner': partner,
            'partner_display': 'Mahrukh' if partner == 'mahrukh' else 'Sajeel',
            'date': str(today),
            'has_data': True,
            'salahCount': t.salah_count,
            'quran': t.quran_read,
            'habitCount': t.habit_count,
            'mood': t.mood,
            'exercise': t.exercise,
            'water': t.water,
        })
    except DailyTracker.DoesNotExist:
        return JsonResponse({
            'partner': partner,
            'partner_display': 'Mahrukh' if partner == 'mahrukh' else 'Sajeel',
            'date': str(today),
            'has_data': False,
        })
