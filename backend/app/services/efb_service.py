import csv
import os
import airportsdata

# Initialize airports database (loads metadata in RAM globally once, fast and lightweight)
airports_db = airportsdata.load('ICAO')

def calculate_flight_direction(dep_icao: str, arr_icao: str) -> str:
    """
    Calculates flight direction (east or west) using the airportsdata library.
    Correctly accounts for International Date Line crossing.
    """
    try:
        dep_clean = dep_icao.strip().upper()
        arr_clean = arr_icao.strip().upper()
        
        dep_airport = airports_db.get(dep_clean)
        arr_airport = airports_db.get(arr_clean)
        
        if not dep_airport or not arr_airport:
            return "east"  # Fallback
            
        dep_lon = dep_airport['lon']
        arr_lon = arr_airport['lon']
        
        diff = arr_lon - dep_lon
        
        # Handle Date Line crossing
        if abs(diff) > 180:
            diff = diff - 360 if diff > 0 else diff + 360
            
        return "east" if diff >= 0 else "west"
    except Exception:
        return "east"  # Safe default

def get_airport_runways(icao_code: str) -> list:
    """
    Streams the runways.csv file line-by-line to extract runway information 
    for the specified airport. Does not load the entire file into memory.
    """
    runways = []
    clean_icao = icao_code.strip().upper()
    
    # Locate assets/runways.csv
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    csv_path = os.path.join(base_dir, "assets", "runways.csv")
    
    if not os.path.exists(csv_path):
        return []
        
    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("airport_ident") == clean_icao:
                    # Ignore closed runways
                    if row.get("closed") == "1":
                        continue
                        
                    length = int(row.get("length_ft") or 0)
                    width = int(row.get("width_ft") or 0)
                    
                    # 1. Low-end runway (e.g. 09L)
                    le_ident = row.get("le_ident")
                    if le_ident:
                        try:
                            le_heading = float(row.get("le_heading_degT") or 0)
                        except ValueError:
                            le_heading = 0
                            
                        if le_heading == 0:
                            digits = "".join([c for c in le_ident if c.isdigit()])
                            if digits:
                                le_heading = int(digits) * 10
                                
                        runways.append({
                            "designator": le_ident.upper(),
                            "length_ft": length,
                            "width_ft": width,
                            "heading": int(le_heading)
                        })
                        
                    # 2. High-end runway (reciprocal reciprocal e.g. 27R)
                    he_ident = row.get("he_ident")
                    if he_ident:
                        try:
                            he_heading = float(row.get("he_heading_degT") or 0)
                        except ValueError:
                            he_heading = 0
                            
                        if he_heading == 0:
                            digits = "".join([c for c in he_ident if c.isdigit()])
                            if digits:
                                he_heading = int(digits) * 10
                                
                        runways.append({
                            "designator": he_ident.upper(),
                            "length_ft": length,
                            "width_ft": width,
                            "heading": int(he_heading)
                        })
                        
        # Sort designators alphabetically/numerically for cleaner presentation
        return sorted(runways, key=lambda x: x["designator"])
    except Exception as e:
        print(f"Error reading runways database: {e}")
        return []
