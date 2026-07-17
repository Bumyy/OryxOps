from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter(prefix="/efb", tags=["efb"])

@router.get("/weather")
async def get_airport_weather(icao: str):
    clean_icao = icao.strip().upper()
    if len(clean_icao) != 4:
        raise HTTPException(status_code=400, detail="Invalid ICAO code. Must be 4 characters.")
    
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 QRVLiveFlightSystem/1.0"
        }
        async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
            # Query last 5 hours of METARs to ensure we get at least 3 distinct observations
            metar_url = f"https://aviationweather.gov/api/data/metar?ids={clean_icao}&hours=5&format=json"
            taf_url = f"https://aviationweather.gov/api/data/taf?ids={clean_icao}&format=json"
            
            # Request reports concurrently
            metar_res = await client.get(metar_url)
            taf_res = await client.get(taf_url)
            
            metar_list = []
            taf_data = None
            
            if metar_res.status_code != 200:
                raise HTTPException(
                    status_code=502, 
                    detail=f"aviationweather.gov METAR request failed with status code {metar_res.status_code}"
                )
                
            try:
                m_json = metar_res.json()
            except (ValueError, TypeError) as json_err:
                raise HTTPException(
                    status_code=502,
                    detail=f"aviationweather.gov METAR response is not valid JSON (possibly WAF or block page): {json_err}"
                )
                
            if isinstance(m_json, list) and len(m_json) > 0:
                # Sort descending by observation time (newest first)
                sorted_metars = sorted(m_json, key=lambda x: x.get("obsTime", 0), reverse=True)
                # Deduplicate by report time (in case of double transmissions) and take latest 3
                seen_times = set()
                for m in sorted_metars:
                    rep_time = m.get("reportTime")
                    if rep_time not in seen_times:
                        seen_times.add(rep_time)
                        metar_list.append(m)
                        if len(metar_list) == 3:
                            break
                    
            if taf_res.status_code == 200:
                try:
                    t_json = taf_res.json()
                except (ValueError, TypeError) as json_err:
                    raise HTTPException(
                        status_code=502,
                        detail=f"aviationweather.gov TAF response is not valid JSON (possibly WAF or block page): {json_err}"
                    )
                if isinstance(t_json, list) and len(t_json) > 0:
                    taf_data = t_json[0]
                    
            if not metar_list:
                raise HTTPException(status_code=404, detail=f"No METAR report found for {clean_icao}")
                
            return {
                "metars": metar_list,
                "taf": taf_data
            }
            
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with aviationweather.gov: {exc}")

@router.get("/direction")
def get_flight_direction_route(dep: str, arr: str):
    from app.services.efb_service import calculate_flight_direction
    return {"direction": calculate_flight_direction(dep, arr)}

@router.get("/runways")
def get_airport_runways_route(icao: str):
    from app.services.efb_service import get_airport_runways
    return get_airport_runways(icao)


@router.get("/simbrief")
async def get_simbrief_ofp(userid: str):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 QRVLiveFlightSystem/1.0"
        }
        async with httpx.AsyncClient(headers=headers, timeout=15.0) as client:
            url = f"https://www.simbrief.com/api/xml.fetcher.php?userid={userid}&json=1"
            res = await client.get(url)
            if res.status_code != 200:
                raise HTTPException(status_code=res.status_code, detail="Failed to fetch from SimBrief")
            return res.json()
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to communicate with SimBrief: {exc}")


