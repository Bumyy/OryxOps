import urllib.request
import json

def check_simbrief():
    try:
        url = "https://www.simbrief.com/api/xml.fetcher.php?userid=921918&json=1"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            fetch_status = data.get("fetch", {}).get("status")
            print("Fetch Status:", fetch_status)
            if fetch_status == "Success":
                aircraft = data.get("aircraft", {})
                print("Aircraft Name:", aircraft.get("name"))
                print("Aircraft ICAO:", aircraft.get("icao_code"))
                print("Origin:", data.get("origin", {}).get("icao_code"))
                print("Destination:", data.get("destination", {}).get("icao_code"))
            else:
                print("Fetch error message:", data.get("fetch", {}).get("message"))
    except Exception as e:
        print("Error fetching from SimBrief:", e)

if __name__ == "__main__":
    check_simbrief()
