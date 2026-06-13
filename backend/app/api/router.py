from fastapi import APIRouter

from app.api.endpoints import (
    admin,
    aircraft,
    auth,
    bookings,
    careers,
    discovery,
    groups,
    pilots,
    schedules,
    settings,
    tokens,
    transfers,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(pilots.router)
api_router.include_router(careers.router)
api_router.include_router(discovery.router)
api_router.include_router(aircraft.router)
api_router.include_router(groups.router)
api_router.include_router(tokens.router)
api_router.include_router(schedules.router)
api_router.include_router(bookings.router)
api_router.include_router(transfers.router)
api_router.include_router(settings.router)
api_router.include_router(admin.router)
