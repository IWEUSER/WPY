"""WPY - a small Flask web application.

The package exposes an application factory, :func:`create_app`, so the app can
be configured differently for local development and tests.
"""

from __future__ import annotations

import os

from flask import Flask

from . import db
from .routes import bp


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        DATABASE=os.path.join(app.instance_path, "wpy.sqlite"),
    )

    if test_config:
        app.config.update(test_config)

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    app.register_blueprint(bp)

    return app
