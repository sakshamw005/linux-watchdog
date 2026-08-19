from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import init_db
from app.config import CORS_ORIGINS
from app.routes import system, processes, metrics, events, watchdog

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    init_db()
    yield

app = FastAPI(
    title="Embedded Linux Watchdog API",
    description="REST API and Diagnostic Engine for Embedded Linux Process Watchdog & Systems Monitoring",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(system.router)
app.include_router(processes.router)
app.include_router(metrics.router)
app.include_router(events.router)
app.include_router(watchdog.router)

@app.get("/")
def root():
    return {
        "service": "Embedded Linux Watchdog API",
        "status": "ONLINE",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
