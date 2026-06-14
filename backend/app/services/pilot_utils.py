def get_pilot_avatar(pilot) -> str:
    from app.models.live_models import Pilot as _Pilot

    name = pilot.name
    ifc_val = pilot.ifc.strip() if pilot.ifc else ""

    ifc_username = ""
    if ifc_val:
        if "infiniteflight.com/u/" in ifc_val:
            parts = ifc_val.split("infiniteflight.com/u/")[-1].split("/")
            ifc_username = parts[0]
        elif not ifc_val.startswith("http") and not ifc_val.startswith("https://"):
            ifc_username = ifc_val

    if ifc_username:
        return f"https://community.infiniteflight.com/user_avatar/community.infiniteflight.com/{ifc_username.lower()}/90/1.png"

    seed = name.replace(" ", "").lower() if name else "default"
    return f"https://api.dicebear.com/7.x/bottts/svg?seed={seed}"
