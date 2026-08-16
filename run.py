"""Development entrypoint for the WPY app.

Run with ``python run.py``. Host/port can be overridden via the ``HOST`` and
``PORT`` environment variables.
"""

from __future__ import annotations

import os

from wpy import create_app

app = create_app()

if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "5000"))
    app.run(host=host, port=port, debug=True)
