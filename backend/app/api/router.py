from fastapi import APIRouter

from app.api.endpoints import (
    admin,
    aircraft,
    auth,
    bookings,
    careers,
    discovery,
    efb,
    groups,
    if_live,
    pilots,
    routes,
    schedules,
    settings,
    transfers,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(pilots.router)
api_router.include_router(careers.router)
api_router.include_router(discovery.router)
api_router.include_router(aircraft.router)
api_router.include_router(groups.router)
api_router.include_router(routes.router)
api_router.include_router(schedules.router)
api_router.include_router(bookings.router)
api_router.include_router(transfers.router)
api_router.include_router(settings.router)
api_router.include_router(efb.router)
api_router.include_router(admin.router)
api_router.include_router(if_live.router)
