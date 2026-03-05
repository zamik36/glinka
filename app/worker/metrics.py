from prometheus_client import Counter, Histogram

reminders_sent_total = Counter(
    "reminders_sent_total",
    "Total number of reminders successfully sent",
)

reminders_failed_total = Counter(
    "reminders_failed_total",
    "Total number of reminders that failed to send",
    ["reason"],
)

reminder_latency_seconds = Histogram(
    "reminder_latency_seconds",
    "Seconds between scheduled remind_at and actual send time",
    buckets=[1, 5, 15, 30, 60, 300, 600],
)
