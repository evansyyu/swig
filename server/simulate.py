"""Send fake weight readings so you can test without the scale.

  python3 simulate.py 500 450        # bottle at 500 g, then a sip leaves it at 450 g
  python3 simulate.py --host 192.168.1.20 500 0 480

Each value is sent 6 times (about one stable reading). Default host: localhost:5000.
"""
import argparse
import json
import time
import urllib.request


def send(base, grams):
    req = urllib.request.Request(
        f"{base}/weight", data=json.dumps({"grams": grams}).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    urllib.request.urlopen(req, timeout=2).read()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("weights", nargs="+", type=float)
    p.add_argument("--host", default="localhost")
    p.add_argument("--port", type=int, default=5000)
    p.add_argument("--delay", type=float, default=0.05, help="seconds between readings")
    args = p.parse_args()
    base = f"http://{args.host}:{args.port}"
    for grams in args.weights:
        for _ in range(6):
            send(base, grams)
            time.sleep(args.delay)
        print(f"sent {grams} g")
    print(urllib.request.urlopen(f"{base}/api/status", timeout=2).read().decode())


if __name__ == "__main__":
    main()
