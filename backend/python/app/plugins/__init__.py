import importlib
import pkgutil
import os
from fastapi import FastAPI

def register_plugins(app: FastAPI):
    plugins_path = os.path.dirname(__file__)
    
    for _, name, _ in pkgutil.iter_modules([plugins_path]):
        if name == "__init__":
            continue
            
        try:
            module = importlib.import_module(f"app.plugins.{name}.main")
            if hasattr(module, "router"):
                app.include_router(module.router, prefix=f"/api/v1/{name}", tags=[name])
                print(f"Loaded plugin: {name}")
        except Exception as e:
            print(f"Failed to load plugin {name}: {e}")
