from django.db import models


class DailyTracker(models.Model):
    PERSON_CHOICES = [
        ('sajeel', 'Sajeel'),
        ('mahrukh', 'Mahrukh'),
    ]

    person = models.CharField(max_length=50, choices=PERSON_CHOICES)
    date = models.DateField()

    # Salah
    fajr = models.BooleanField(default=False)
    dhuhr = models.BooleanField(default=False)
    asr = models.BooleanField(default=False)
    maghrib = models.BooleanField(default=False)
    isha = models.BooleanField(default=False)
    tahajjud = models.BooleanField(default=False)

    # Quran
    quran_read = models.BooleanField(default=False)
    quran_pages = models.IntegerField(default=0)
    quran_surah = models.CharField(max_length=200, blank=True, default='')

    # Habits
    exercise = models.BooleanField(default=False)
    no_junk_food = models.BooleanField(default=False)
    wake_early = models.BooleanField(default=False)
    dua_after_salah = models.BooleanField(default=False)
    dhikr = models.BooleanField(default=False)
    sadaqah = models.BooleanField(default=False)
    water = models.IntegerField(default=0)
    sleep_hours = models.FloatField(default=0)

    # Mood & Notes
    mood = models.IntegerField(default=3)
    notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('person', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.get_person_display()} — {self.date}"

    @property
    def salah_count(self):
        return sum([self.fajr, self.dhuhr, self.asr, self.maghrib, self.isha])

    @property
    def all_salah(self):
        return self.fajr and self.dhuhr and self.asr and self.maghrib and self.isha

    @property
    def habit_count(self):
        return sum([
            self.exercise, self.no_junk_food, self.wake_early,
            self.dua_after_salah, self.dhikr, self.sadaqah
        ])


class Goal(models.Model):
    tracker = models.ForeignKey(DailyTracker, on_delete=models.CASCADE, related_name='goals')
    text = models.CharField(max_length=500)
    done = models.BooleanField(default=False)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        status = '✓' if self.done else '○'
        return f"{status} {self.text}"
