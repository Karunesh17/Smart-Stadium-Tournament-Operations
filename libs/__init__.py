# libs package
import sys
import os
import types

# Dynamically map the hyphenated folder 'shared-schemas' to the valid Python package path 'libs.shared_schemas'
libs_dir = os.path.dirname(os.path.abspath(__file__))
shared_schemas_dir = os.path.join(libs_dir, "shared-schemas")

if "libs.shared_schemas" not in sys.modules and os.path.exists(shared_schemas_dir):
    mod = types.ModuleType("libs.shared_schemas")
    mod.__path__ = [shared_schemas_dir]
    sys.modules["libs.shared_schemas"] = mod
