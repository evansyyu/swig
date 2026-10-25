"""Fill the leaderboard with demo users and streak history (for the pitch).

Run:  python3 seed_demo.py           (uses DATABASE_URL, same as the server)
      python3 seed_demo.py --remove  (deletes the demo users again)
"""
import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

import security
from db import init_db, session_scope
from models import DayLog, User

# username -> current streak; each also gets an older run so best streaks differ.
DEMO = {"mira.sips": 32, "noah.blue": 28, "ella.flow": 24, "sam.river": 21, "luna.drop": 19,
        "leo.alpine": 17, "ivy.stream": 12, "kai.wave": 9, "rio.mist": 5, "nova.tide": 2}
PASSWORD = "demo-password"


def seed():
    init_db()
    today = datetime.now(timezone.utc).date()
    rng = random.Random(7)
    with session_scope() as session:
        for username, streak in DEMO.items():
            if session.execute(select(User.id).where(User.username == username)).first():
                continue
            user = User(username=username, password_hash=security.hash_password(PASSWORD), goal_ml=2000)
            session.add(user)
            session.flush()
            met_days = [today - timedelta(days=n) for n in range(1, streak + 1)]
            older = rng.randint(3, streak + 8)
            met_days += [today - timedelta(days=streak + 2 + n) for n in range(older)]
            for day in met_days:
                session.add(DayLog(user_id=user.id, day=day, goal_ml=2000, consumed_ml=rng.randint(2000, 2600)))
    print(f"Seeded {len(DEMO)} demo users (password: {PASSWORD})")


def remove():
    init_db()
    with session_scope() as session:
        session.execute(delete(User).where(User.username.in_(DEMO)))
        session.execute(delete(DayLog).where(~DayLog.user_id.in_(select(User.id))))
    print("Removed demo users")


if __name__ == "__main__":
    remove() if "--remove" in sys.argv else seed()
